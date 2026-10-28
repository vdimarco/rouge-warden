"""Glossy bodywork takes a sky clearcoat. Rubber, crew, foliage and the pond stay matte."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _unit(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _hash(ix, iy):
    n = math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
    return n - math.floor(n)


def _noise(px, py):
    ix, iy = math.floor(px), math.floor(py)
    fx, fy = px - ix, py - iy
    fx = fx * fx * (3.0 - 2.0 * fx)
    fy = fy * fy * (3.0 - 2.0 * fy)
    a, b = _hash(ix, iy), _hash(ix + 1.0, iy)
    c, d = _hash(ix, iy + 1.0), _hash(ix + 1.0, iy + 1.0)
    return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy


def _smooth(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def clearcoat(ray, normal, roughness, *, smooth_reflection=0.0, crew=0.0, foliage=0.0, sky=False):
    """Return (weight, reflected colour) for a unit view ray and unit normal."""
    ray, normal = _unit(ray), _unit(normal)
    dot = sum(n * r for n, r in zip(normal, ray))
    refl = tuple(r - 2.0 * dot * n for r, n in zip(ray, normal))
    denom = refl[2] if refl[2] > 0.07 else 0.07
    field = _noise(refl[0] / denom * 0.55, refl[1] / denom * 0.55)
    cloud = _smooth(0.52, 0.72, field) * _smooth(0.04, 0.13, refl[2])
    t = max(0.0, min(1.0, refl[2] / 0.40))
    colour = (
        0.64 + (0.30 - 0.64) * t,
        0.76 + (0.50 - 0.76) * t,
        0.90 + (0.84 - 0.90) * t,
    )
    colour = tuple(c + (w - c) * cloud for c, w in zip(colour, (0.97, 0.97, 0.95)))
    hit = _smooth(0.0, 0.08, refl[2])
    clear = ((1.0 - _smooth(0.20, 0.42, roughness)) * (1.0 - smooth_reflection)
             * (1.0 - crew) * (1.0 - foliage) * (0.0 if sky else 1.0))
    ndv = max(0.0, min(1.0, sum(n * -r for n, r in zip(normal, ray))))
    edge = (1.0 - ndv) ** 5
    return clear * (0.62 + 0.38 * edge) * hit, colour


def paint(colour, ray, normal, roughness, **gates):
    weight, reflected = clearcoat(ray, normal, roughness, **gates)
    return tuple(c + (k - c) * weight for c, k in zip(colour, reflected))


class ClearcoatTests(unittest.TestCase):
    def test_shader_keeps_the_sky_paint_and_the_haze_line(self):
        hlsl = comic_hlsl()
        self.assertIn('float3 Refl = reflect(Ray, NormalC);', hlsl)
        self.assertIn('(1.0 - smoothstep(0.20, 0.42, Roughness))', hlsl)
        self.assertIn('float Coat = Clear * (0.62 + 0.38 * CoatEdge) * SkyHit;', hlsl)
        self.assertIn('CloudMask * (Sky ? 1.0 : 0.0)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_paint_and_glass_take_the_sky_and_the_matte_surfaces_do_not(self):
        # A hood facing the walking camera: the view ray points slightly down, the normal is up.
        ray, normal = (0.96, 0.05, -0.22), (0.05, 0.0, 1.0)
        teal = (0.03, 0.20, 0.18)
        weight, _ = clearcoat(ray, normal, 0.30)
        self.assertGreater(weight, 0.30)
        coated = paint(teal, ray, normal, 0.30)
        self.assertGreater(coated[2] - teal[2], 0.15)
        self.assertGreater(coated[2], coated[0])
        glass = paint((0.04, 0.08, 0.11), ray, normal, 0.18)
        self.assertGreater(glass[2], 0.30)
        self.assertEqual(clearcoat(ray, normal, 0.92)[0], 0.0)
        self.assertEqual(clearcoat(ray, normal, 0.55)[0], 0.0)
        self.assertEqual(clearcoat(ray, normal, 0.30, crew=1.0)[0], 0.0)
        self.assertEqual(clearcoat(ray, normal, 0.30, foliage=1.0)[0], 0.0)
        self.assertEqual(clearcoat(ray, normal, 0.30, sky=True)[0], 0.0)
        self.assertEqual(clearcoat(ray, normal, 0.17, smooth_reflection=1.0)[0], 0.0)
        self.assertEqual(paint(teal, ray, normal, 0.92), teal)


if __name__ == '__main__':
    unittest.main()
