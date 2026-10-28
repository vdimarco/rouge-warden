"""Night grade paints a moon and a spill. NightFactor 0 leaves the clear-day colour."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TAPS = (
    (6, 0), (4, 4), (0, 6), (-4, 4),
    (-6, 0), (-4, -4), (0, -6), (4, -4),
    (14, 0), (10, 10), (0, 14), (-10, 10),
    (-14, 0), (-10, -10), (0, -14), (10, -10),
)


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _sat(v):
    return max(0.0, min(1.0, v))


def _smooth(edge0, edge1, value):
    t = _sat((value - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def _unit(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _classify(rgb):
    peak = max(rgb)
    warm = _sat((rgb[0] - rgb[2]) / max(peak, 1.0e-3))
    hot = _smooth(0.20, 0.48, peak) * _smooth(0.34, 0.60, warm)
    white = _smooth(0.62, 0.88, peak) * (1.0 - _smooth(0.25, 0.45, warm))
    neon = tuple(_sat(peak * s) for s in (1.2, 0.40, 0.16))
    lamp = tuple(_sat(peak * s) for s in (1.0, 0.96, 0.82))
    return hot, white, neon, lamp


def grade(color, here, taps, ray, night, sky=False):
    """Port of the night block. `taps` is 16 scene-colour samples."""
    moon = _unit((0.90, 0.22, 0.25))
    ray = _unit(ray)
    dot = _sat(sum(a * b for a, b in zip(ray, moon)))
    disc = dot ** 900.0
    halo = dot ** 5.0
    halo_mix = _sat(halo * 0.65)
    moon_col = (0.62, 0.72, 1.0)
    sky_col = tuple(c * (1.0 - halo_mix) + m * halo_mix for c, m in zip(color, moon_col))
    disc_col = (0.93, 0.95, 1.0)
    sky_col = tuple(c * (1.0 - disc) + d * disc for c, d in zip(sky_col, disc_col))

    hot, white, neon, lamp = _classify(here)
    bloom = (0.0, 0.0, 0.0)
    for tap in taps:
        tap_hot, tap_white, tap_neon, tap_lamp = _classify(tap)
        bloom = tuple(b + n * tap_hot + l * tap_white for b, n, l in zip(bloom, tap_neon, tap_lamp))
    bloom = tuple(b / 16.0 for b in bloom)
    body = tuple(_sat(c + b * 1.6) for c, b in zip(color, bloom))
    if hot > 0.5:
        body = tuple(max(b, n) for b, n in zip(body, neon))
    if white > 0.5:
        body = tuple(max(b, n) for b, n in zip(body, lamp))
    night_col = sky_col if sky else body
    weight = _sat(night)
    return tuple(c + (n - c) * weight for c, n in zip(color, night_col))


class NightGradeTests(unittest.TestCase):
    def test_shader_keeps_the_day_paints_and_adds_the_moon(self):
        hlsl = comic_hlsl()
        self.assertIn('float MoonDisc = pow(MoonDot, 900.0);', hlsl)
        self.assertIn('float MoonHalo = pow(MoonDot, 5.0);', hlsl)
        self.assertIn('float3 MoonCol = float3(0.62, 0.72, 1.0);', hlsl)
        self.assertIn('float2(14, 0)', hlsl)
        self.assertIn('float2(-10, -10)', hlsl)
        self.assertIn('NightI < 16', hlsl)
        self.assertIn('Color = lerp(Color, NightCol, saturate(NightFactor));', hlsl)
        self.assertIn('float Coat = Clear * (0.62 + 0.38 * CoatEdge) * SkyHit;', hlsl)
        self.assertIn('CloudMask * (Sky ? 1.0 : 0.0)', hlsl)
        self.assertIn('Haze * 0.85 * (Sky ? 0.0 : 1.0)', hlsl)
        self.assertNotIn('CloudCover', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)
        source = (ROOT / 'Scripts/apply_comic_style.py').read_text()
        self.assertIn("parameter_name='NightFactor'", source)
        self.assertIn("MPC_NordAtmosphere", source)

    def test_clear_day_is_unchanged(self):
        window = (0.55, 0.28, 0.09)
        dark = (0.06, 0.025, 0.018)
        sky = (0.02, 0.03, 0.06)
        moon = _unit((0.90, 0.22, 0.25))
        for color, here, ray, is_sky in (
            (window, window, (0.0, 0.2, -0.9), False),
            (dark, dark, (0.0, 0.2, -0.9), False),
            (sky, sky, moon, True),
        ):
            out = grade(color, here, (here,) * 16, ray, 0.0, sky=is_sky)
            self.assertEqual(out, color)

    def test_a_warm_window_moves_toward_neon_and_dark_brick_stays(self):
        window = (0.55, 0.28, 0.09)
        brick = (0.06, 0.025, 0.018)
        hot, white, _, _ = _classify(window)
        self.assertGreater(hot, 0.5)
        self.assertEqual(white, 0.0)
        lit = grade(window, window, (brick,) * 16, (0.0, 0.2, -0.9), 1.0)
        self.assertGreater(lit[0], window[0])
        self.assertLess(abs(lit[1] - window[1]), 1e-9)
        dark_hot, dark_white, _, _ = _classify(brick)
        self.assertEqual(dark_hot, 0.0)
        self.assertEqual(dark_white, 0.0)
        stayed = grade(brick, brick, (brick,) * 16, (0.0, 0.2, -0.9), 1.0)
        self.assertEqual(stayed, brick)

    def test_a_headlight_is_white_and_spills(self):
        lamp = (0.95, 0.92, 0.75)
        road = (0.025, 0.024, 0.028)
        hot, white, _, _ = _classify(lamp)
        self.assertEqual(hot, 0.0)
        self.assertGreater(white, 0.5)
        # The road pixel itself is dark. One nearby tap is the headlight.
        taps = (road,) * 15 + (lamp,)
        spill = grade(road, road, taps, (0.0, 0.2, -0.9), 1.0)
        self.assertGreater(spill[0], road[0])
        self.assertGreater(spill[1], road[1])
        self.assertGreater(spill[2], road[2])

    def test_the_moon_disc_lands_on_an_aligned_sky_ray_only(self):
        sky = (0.02, 0.03, 0.06)
        moon = _unit((0.90, 0.22, 0.25))
        side = _unit((-moon[1], moon[0], 0.0))
        self.assertAlmostEqual(sum(a * b for a, b in zip(moon, side)), 0.0, places=6)
        disc = grade(sky, sky, (sky,) * 16, moon, 1.0, sky=True)
        self.assertAlmostEqual(disc[0], 0.93, places=6)
        self.assertAlmostEqual(disc[1], 0.95, places=6)
        self.assertAlmostEqual(disc[2], 1.0, places=6)
        plain = grade(sky, sky, (sky,) * 16, side, 1.0, sky=True)
        self.assertEqual(plain, sky)


if __name__ == '__main__':
    unittest.main()
