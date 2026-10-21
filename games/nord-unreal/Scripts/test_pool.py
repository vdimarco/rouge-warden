"""A road pixel picks up a warm pool from a lamp head. NightFactor 0 leaves the colour."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TAPS = tuple((x, -y) for y in (40, 56, 72, 88, 104, 120, 136) for x in (-64, -32, 0, 32, 64))


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _sat(v):
    return max(0.0, min(1.0, v))


def _smooth(edge0, edge1, value):
    t = _sat((value - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def pool(color, samples, *, normal_z, roughness, below, night, sky=False, crew=0.0, foliage=0.0, smooth_reflection=0.0):
    """Port of the lamp-pool gather. `samples` matches TAPS."""
    weight = 0.0
    for (tap_x, tap_y), sample in zip(TAPS, samples):
        peak = max(sample)
        warm = _sat((sample[0] - sample[2]) / max(peak, 1.0e-3))
        hit = float(peak >= 0.82) * float(warm >= 0.40) * float(warm <= 0.78)
        dist = math.hypot(tap_x, tap_y)
        weight = max(weight, hit * _sat(1.0 - dist / 180.0))
    mask = (_smooth(0.85, 0.96, normal_z) * _smooth(0.55, 0.75, roughness) * below
            * (0.0 if sky else 1.0) * (1.0 - crew) * (1.0 - foliage) * (1.0 - smooth_reflection))
    mix = mask * _sat(night)
    dest = tuple(_sat(c + p * weight) for c, p in zip(color, (0.45, 0.22, 0.07)))
    return tuple(c + (d - c) * mix for c, d in zip(color, dest))


class LampPoolTests(unittest.TestCase):
    def test_shader_keeps_the_day_paints_and_adds_the_pool(self):
        hlsl = comic_hlsl()
        self.assertEqual(hlsl.count('PoolTap'), 3)
        self.assertIn('for (int PoolI = 0; PoolI < 35; PoolI++)', hlsl)
        self.assertIn('float PoolHit = step(0.82, PoolPeak) * step(0.40, PoolWarm) * step(PoolWarm, 0.78);', hlsl)
        self.assertIn('float3 PoolCol = float3(0.45, 0.22, 0.07);', hlsl)
        self.assertIn('RoadMask * saturate(NightFactor)', hlsl)
        self.assertIn('float MoonDisc = pow(MoonDot, 900.0);', hlsl)
        self.assertIn('float Coat = Clear * (0.62 + 0.38 * CoatEdge) * SkyHit;', hlsl)
        self.assertIn('CloudMask * (Sky ? 1.0 : 0.0)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertIn('float RoadMix = RoadMask * 0.85 * saturate(NightFactor);', hlsl)
        self.assertNotIn('CloudCover', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)
        self.assertEqual(len(TAPS), 35)

    def test_day_walls_paint_windows_and_headlights_stay(self):
        road = (0.025, 0.024, 0.028)
        window = (0.55, 0.28, 0.09)
        headlight = (0.95, 0.92, 0.75)
        lamp = (0.95, 0.72, 0.35)
        dark = (0.02, 0.02, 0.03)
        lit = [dark] * 35
        lit[22] = lamp
        self.assertEqual(TAPS[22], (0, -104))
        day = pool(road, lit, normal_z=1.0, roughness=0.9, below=1.0, night=0.0)
        self.assertEqual(day, road)
        wall = pool(road, lit, normal_z=0.0, roughness=0.9, below=1.0, night=1.0)
        self.assertEqual(wall, road)
        paint = pool((0.03, 0.20, 0.18), lit, normal_z=1.0, roughness=0.30, below=1.0, night=1.0)
        self.assertEqual(paint, (0.03, 0.20, 0.18))
        windows = pool(road, [window] * 35, normal_z=1.0, roughness=0.9, below=1.0, night=1.0)
        self.assertEqual(windows, road)
        beams = [dark] * 35
        beams[22] = headlight
        white = pool(road, beams, normal_z=1.0, roughness=0.9, below=1.0, night=1.0)
        self.assertEqual(white, road)

    def test_a_lamp_head_warms_the_road_under_it(self):
        road = (0.025, 0.024, 0.028)
        lamp = (0.95, 0.72, 0.35)
        samples = [(0.02, 0.02, 0.03)] * 35
        samples[22] = lamp
        warmed = pool(road, samples, normal_z=1.0, roughness=0.9, below=1.0, night=1.0)
        self.assertGreater(warmed[0], road[0] + 0.15)
        self.assertGreater(warmed[0], warmed[2] + 0.10)


if __name__ == '__main__':
    unittest.main()
