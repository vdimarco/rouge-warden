"""Clear-day surfaces take a warm sun and a cool shade. Night, gloss, sky and crew stay."""
import ast
import math
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUN = (-0.62, -0.48, 0.62)


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def _unit(v):
    length = math.sqrt(sum(c * c for c in v))
    return tuple(c / length for c in v)


def _smooth(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def _sat(v):
    return tuple(max(0.0, min(1.0, c)) for c in v)


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def half_lambert(normal):
    sun = _unit(SUN)
    normal = _unit(normal)
    half = sum(n * s for n, s in zip(normal, sun)) * 0.5 + 0.5
    half = max(0.0, min(1.0, half))
    return half * half


def day_grade(color, normal, roughness, *, night=0.0, sky=False, crew=0.0):
    """Return the colour after the clear-day warm-cool grade."""
    lum = _lum(color)
    share = (_smooth(0.28, 0.62, roughness) * _smooth(0.08, 0.16, lum)
             * (1.0 - max(0.0, min(1.0, night))) * (0.0 if sky else 1.0) * (1.0 - crew))
    cool, warm = (0.62, 0.96, 1.18), (1.55, 1.12, 0.42)
    half = half_lambert(normal)
    tint = tuple(c + (w - c) * half for c, w in zip(cool, warm))
    graded = _sat(tuple(c * t for c, t in zip(color, tint)))
    kept = _lum(graded)
    scale = lum / max(kept, 1.0e-3)
    graded = _sat(tuple(c * scale for c in graded))
    return tuple(c + (g - c) * share for c, g in zip(color, graded))


class DayGradeTests(unittest.TestCase):
    def test_shader_keeps_the_grade_and_the_locked_tail(self):
        hlsl = comic_hlsl()
        self.assertIn('float3 DayCool = float3(0.62, 0.96, 1.18);', hlsl)
        self.assertIn('float3 DayWarm = float3(1.55, 1.12, 0.42);', hlsl)
        self.assertIn('float3 DayTint = lerp(DayCool, DayWarm, Half);', hlsl)
        self.assertIn('float DayOpen = smoothstep(0.08, 0.16, DayLum);', hlsl)
        self.assertIn('float DayMatte = smoothstep(0.28, 0.62, Roughness);', hlsl)
        self.assertIn(
            'float DayShare = DayMatte * DayOpen * (1.0 - saturate(NightFactor)) * (Sky ? 0.0 : 1.0) * (1.0 - PrintedCrew);',
            hlsl)
        self.assertIn('DayGraded *= DayLum / max(DayKept, 1.0e-3);', hlsl)
        self.assertIn('Color = lerp(Color, saturate(DayGraded), DayShare);', hlsl)
        self.assertLess(hlsl.index('float Coat = Clear'), hlsl.index('float3 DayCool'))
        self.assertLess(hlsl.index('float3 DayCool'), hlsl.index('float3 MoonDir'))
        self.assertIn('Color = lerp(Color, NightCol, saturate(NightFactor));', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)

    def test_sun_and_shade_split_hue_and_the_gates_stay_put(self):
        brick = (0.62, 0.30, 0.14)
        road = (0.45, 0.44, 0.42)
        lit = day_grade(brick, (0.0, -1.0, 0.0), 0.90)
        shade = day_grade(brick, (0.0, 1.0, 0.0), 0.90)
        self.assertGreater((lit[0] - lit[2]) - (shade[0] - shade[2]), 0.12)
        self.assertAlmostEqual(_lum(lit), _lum(brick), delta=0.02)
        self.assertAlmostEqual(_lum(shade), _lum(brick), delta=0.02)
        warmed = day_grade(road, (0.0, 0.0, 1.0), 0.90)
        self.assertGreater(warmed[0] - warmed[2], road[0] - road[2] + 0.06)
        self.assertEqual(day_grade(brick, (0.0, -1.0, 0.0), 0.90, night=1.0), brick)
        self.assertEqual(day_grade(brick, (0.0, -1.0, 0.0), 0.90, sky=True), brick)
        self.assertEqual(day_grade(brick, (0.0, -1.0, 0.0), 0.90, crew=1.0), brick)
        self.assertEqual(day_grade(brick, (0.0, -1.0, 0.0), 0.12), brick)
        dark = (0.05, 0.04, 0.04)
        self.assertEqual(day_grade(dark, (0.0, 0.0, 1.0), 0.90), dark)
        paint = day_grade((0.36, 0.045, 0.055), (0.0, 0.0, 1.0), 0.30)
        self.assertLess(max(abs(a - b) for a, b in zip(paint, (0.36, 0.045, 0.055))), 0.02)


if __name__ == '__main__':
    unittest.main()
