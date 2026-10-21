"""Ground pixels darken where an upright surface meets them at the same depth."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def contact_from_neighbor(ground_z, neighbor_z, depth_gap, sky=False):
    """One tap. Ground darkens only when the neighbor is upright and within 70 cm."""
    ground_here = smoothstep(0.82, 0.94, ground_z) * (0.0 if sky else 1.0)
    upright = 1.0 - smoothstep(0.35, 0.55, neighbor_z)
    close = 1.0 - smoothstep(40.0, 70.0, abs(depth_gap))
    contact = upright * close
    return ground_here * min(1.0, contact / 3.0)


class ContactTests(unittest.TestCase):
    def test_shader_taps_the_ground_contact_and_keeps_the_crew_masks(self):
        hlsl = comic_hlsl()
        self.assertIn('const float2 ContactTap[8]', hlsl)
        self.assertIn('float Close = 1.0 - smoothstep(40.0, 70.0, abs(NeighborDepth - DepthC));', hlsl)
        self.assertIn('float GroundHere = smoothstep(0.82, 0.94, NormalC.z)', hlsl)
        self.assertIn('lerp(1.0, 0.38, saturate(Contact / 3.0) * GroundHere)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_a_foot_darkens_the_street_and_a_far_sample_does_not(self):
        self.assertGreater(contact_from_neighbor(0.98, 0.05, 20.0), 0.2)
        self.assertEqual(contact_from_neighbor(0.98, 0.05, 200.0), 0.0)
        self.assertEqual(contact_from_neighbor(0.98, 0.95, 20.0), 0.0)
        self.assertEqual(contact_from_neighbor(0.98, 0.05, 20.0, sky=True), 0.0)
        self.assertEqual(contact_from_neighbor(0.2, 0.05, 20.0), 0.0)


if __name__ == '__main__':
    unittest.main()
