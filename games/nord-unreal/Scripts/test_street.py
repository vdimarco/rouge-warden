"""Rough night ground picks up the lights above it. NightFactor 0 leaves the colour."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _sat(v):
    return max(0.0, min(1.0, v))


def _smooth(edge0, edge1, value):
    t = _sat((value - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def _glow(rgb):
    peak = max(rgb)
    warm = _sat((rgb[0] - rgb[2]) / max(peak, 1.0e-3))
    hot = _smooth(0.20, 0.48, peak) * _smooth(0.34, 0.60, warm)
    white = _smooth(0.62, 0.88, peak) * (1.0 - _smooth(0.25, 0.45, warm))
    neon = tuple(_sat(peak * s) for s in (1.2, 0.40, 0.16))
    lamp = tuple(_sat(peak * s) for s in (1.0, 0.96, 0.82))
    return tuple(n * hot + l * white for n, l in zip(neon, lamp))


def sheen(color, samples, *, normal_z, roughness, below, night, sky=False, crew=0.0, foliage=0.0, smooth_reflection=0.0):
    """Port of the column gather. `samples` runs from the pixel toward the horizon."""
    gathered = (0.0, 0.0, 0.0)
    for sample in samples:
        glow = _glow(sample)
        gathered = tuple(max(a, b) for a, b in zip(gathered, glow))
    mask = (_smooth(0.85, 0.96, normal_z) * _smooth(0.55, 0.75, roughness) * below
            * (0.0 if sky else 1.0) * (1.0 - crew) * (1.0 - foliage) * (1.0 - smooth_reflection))
    mix = mask * 0.85 * _sat(night)
    dest = tuple(_sat(c + g) for c, g in zip(color, gathered))
    return tuple(c + (d - c) * mix for c, d in zip(color, dest))


class StreetSheenTests(unittest.TestCase):
    def test_shader_keeps_the_day_paints(self):
        hlsl = comic_hlsl()
        self.assertIn('float HorizonV = saturate(HorizonNdc * -0.5 + 0.5);', hlsl)
        self.assertIn('SheenI <= 16', hlsl)
        self.assertIn('float RoadMix = RoadMask * 0.85 * saturate(NightFactor);', hlsl)
        self.assertIn('float MoonDisc = pow(MoonDot, 900.0);', hlsl)
        self.assertIn('float Coat = Clear * (0.62 + 0.38 * CoatEdge) * SkyHit;', hlsl)
        self.assertIn('CloudMask * (Sky ? 1.0 : 0.0)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertNotIn('CloudCover', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_clear_day_and_walls_and_paint_stay(self):
        road = (0.025, 0.024, 0.028)
        window = (0.55, 0.28, 0.09)
        brick = (0.06, 0.025, 0.018)
        samples = (brick,) * 8 + (window,) + (brick,) * 7
        day = sheen(road, samples, normal_z=1.0, roughness=0.9, below=1.0, night=0.0)
        self.assertEqual(day, road)
        wall = sheen(brick, samples, normal_z=0.0, roughness=0.9, below=1.0, night=1.0)
        self.assertEqual(wall, brick)
        paint = sheen((0.03, 0.20, 0.18), samples, normal_z=1.0, roughness=0.30, below=1.0, night=1.0)
        self.assertEqual(paint, (0.03, 0.20, 0.18))
        above = sheen(road, samples, normal_z=1.0, roughness=0.9, below=0.0, night=1.0)
        self.assertEqual(above, road)

    def test_a_window_and_a_headlight_land_on_the_road(self):
        road = (0.025, 0.024, 0.028)
        window = (0.55, 0.28, 0.09)
        lamp = (0.95, 0.92, 0.75)
        dark = (0.02, 0.02, 0.03)
        orange = sheen(road, (dark,) * 15 + (window,), normal_z=1.0, roughness=0.9, below=1.0, night=1.0)
        self.assertGreater(orange[0], road[0] + 0.3)
        self.assertGreater(orange[0], orange[2])
        white = sheen(road, (lamp,) + (dark,) * 15, normal_z=1.0, roughness=0.9, below=1.0, night=1.0)
        self.assertGreater(white[0], road[0] + 0.4)
        self.assertGreater(white[2], road[2] + 0.3)


if __name__ == '__main__':
    unittest.main()
