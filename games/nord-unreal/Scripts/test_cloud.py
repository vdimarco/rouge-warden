"""Cumulus painted on sky pixels, and nowhere on the street."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _hash(ix, iy):
    n = math.sin(ix * 127.1 + iy * 311.7) * 43758.5453
    return n - math.floor(n)


def _noise(px, py):
    ix, iy = math.floor(px), math.floor(py)
    fx, fy = px - ix, py - iy
    fx = fx * fx * (3.0 - 2.0 * fx)
    fy = fy * fy * (3.0 - 2.0 * fy)
    a = _hash(ix, iy)
    b = _hash(ix + 1.0, iy)
    c = _hash(ix, iy + 1.0)
    d = _hash(ix + 1.0, iy + 1.0)
    return (a * (1.0 - fx) + b * fx) * (1.0 - fy) + (c * (1.0 - fx) + d * fx) * fy


def _smooth(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def cloud_paint(ray):
    """Return (mask, colour) for a unit view ray. Mask is 0 when the ray does not rise."""
    rx, ry, rz = ray
    denom = rz if rz > 0.07 else 0.07
    uvx, uvy = rx / denom, ry / denom
    warp = _noise(uvx * 0.28 + 2.0, uvy * 0.28 + 7.0)
    uv2x = uvx * 0.55 + warp * 1.6
    uv2y = uvy * 0.55 + warp * 0.65 * 1.6
    low = _noise(uv2x, uv2y)
    high = _noise(uvx * 1.265 + 3.2, uvy * 1.265 + 8.4)
    field = low * 0.75 + high * 0.25
    cover = _smooth(0.52, 0.68, field)
    skirt = _smooth(0.45, 0.54, field) * 0.50
    body = max(cover, skirt)
    lift = _smooth(0.04, 0.13, rz)
    thick = max(0.0, min(1.0, (field - 0.48) / 0.24))
    sun_x = -0.62 / math.hypot(0.62, 0.48)
    slope = _noise(uv2x + 0.18, uv2y)
    face = max(0.0, min(1.0, (slope - low) / 0.18 * sun_x * 4.0 + 0.5))
    shade = (1.0 - thick) * face
    col = (
        0.48 + (0.98 - 0.48) * thick,
        0.54 + (0.98 - 0.54) * thick,
        0.64 + (0.96 - 0.64) * thick,
    )
    col = tuple(c + (w - c) * shade for c, w in zip(col, (0.96, 0.82, 0.64)))
    return max(0.0, min(1.0, body * lift)), col


def paint_pixel(color, ray, sky):
    mask, col = cloud_paint(ray)
    mix = mask * (1.0 if sky else 0.0)
    return tuple(c + (k - c) * mix for c, k in zip(color, col))


class CloudPaintTests(unittest.TestCase):
    def test_shader_paints_sky_only_and_leaves_the_haze_line(self):
        hlsl = comic_hlsl()
        self.assertIn('float2 CloudUv = Ray.xy / max(Ray.z, 0.07);', hlsl)
        self.assertIn('float Field = LowN * 0.75 + HighN * 0.25;', hlsl)
        self.assertIn('float Cover = smoothstep(0.52, 0.68, Field);', hlsl)
        self.assertIn('float Lift = smoothstep(0.04, 0.13, Ray.z);', hlsl)
        self.assertIn('CloudMask * (Sky ? 1.0 : 0.0)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)
        self.assertNotIn('CloudCover', hlsl)

    def test_a_rising_ray_can_be_a_cloud_and_the_street_stays(self):
        # Walking-camera samples from the top of the 960x540 frame, pitch -12, FOV 90.
        cloudy, _ = cloud_paint((0.9638, 0.0009, 0.2667))
        gap, _ = cloud_paint((0.8449, -0.4869, 0.2218))
        self.assertGreater(cloudy, 0.9)
        self.assertEqual(gap, 0.0)
        self.assertEqual(cloud_paint((0.7, 0.1, -0.2))[0], 0.0)
        sky_in = (0.45, 0.62, 0.86)
        self.assertNotEqual(paint_pixel(sky_in, (0.9638, 0.0009, 0.2667), sky=True), sky_in)
        self.assertEqual(paint_pixel(sky_in, (0.9638, 0.0009, 0.2667), sky=False), sky_in)
        # The thick sample is brighter than a clear blue sky.
        painted = paint_pixel(sky_in, (0.9638, 0.0009, 0.2667), sky=True)
        self.assertGreater(sum(painted) / 3.0, sum(sky_in) / 3.0)


if __name__ == '__main__':
    unittest.main()
