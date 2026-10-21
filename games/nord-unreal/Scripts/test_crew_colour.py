"""Printed crew keeps source hue. A coloured key would push a warm-dark tee toward blue."""
import ast
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LUMA = (0.299, 0.587, 0.114)
# CurlyMetalhead generated-v2 base colour: the black tee is warm-dark, not indigo.
TEE = (0.086, 0.055, 0.044)
SKIN = (0.55, 0.29, 0.15)


def comic_hlsl():
    tree = ast.parse((ROOT / 'Scripts/apply_comic_style.py').read_text())
    return next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'HLSL' for t in node.targets))


def dot(colour):
    return sum(channel * weight for channel, weight in zip(colour, LUMA))


def clip(colour):
    return tuple(max(0.0, min(1.0, channel)) for channel in colour)


def smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def banded(colour, saturation=1.05):
    """Crew band mix is 0, so light is the continuous luminance curve in the comic grade."""
    lum = dot(colour)
    light = lum ** 0.82
    chroma = tuple(channel / max(lum, 1.0e-3) for channel in colour)
    graded = clip(tuple(channel * light for channel in chroma))
    l2 = dot(graded)
    return clip(tuple(l2 + (channel - l2) * saturation for channel in graded))


def scalar_shade(colour, half, low=0.70, high=1.08):
    base = banded(colour)
    shade = low + (high - low) * half
    return clip(tuple(channel * shade for channel in base))


def coloured_key(colour, half):
    """The rejected grade: cool wash, then a blue-to-warm key."""
    base = list(banded(colour))
    shadow = 1.0 - smoothstep(0.04, 0.32, dot(base))
    wash = (0.05, 0.07, 0.11)
    base = [channel + extra * shadow for channel, extra in zip(base, wash)]
    key = tuple((1.0 - half) * dark + half * light for dark, light in zip((0.62, 0.70, 0.86), (1.16, 1.06, 0.94)))
    return clip(tuple(channel * scale for channel, scale in zip(base, key)))


class CrewColourTests(unittest.TestCase):
    def test_shader_shades_crew_without_repainting_hue(self):
        hlsl = comic_hlsl()
        self.assertIn('float CrewShade = lerp(0.70, 1.08, Half);', hlsl)
        self.assertIn('(1.0 - PrintedCrew)', hlsl)
        self.assertNotIn('float3(0.62, 0.70, 0.86)', hlsl)
        self.assertIn('float3 Rim = float3(0.90, 0.94, 1.0)', hlsl)
        self.assertEqual(hlsl.count('(1.0 - max(PrintedCrew, Foliage))'), 3)
        self.assertIn('float3(0.05, 0.07, 0.11)', hlsl)

    def test_warm_dark_tee_stays_warm_where_the_coloured_key_goes_blue(self):
        kept = scalar_shade(TEE, 0.0)
        rejected = coloured_key(TEE, 0.0)
        self.assertGreater(kept[0], kept[2])
        self.assertGreater(rejected[2], rejected[0])
        skin = scalar_shade(SKIN, 1.0)
        self.assertGreater(skin[0], skin[1])
        self.assertGreater(skin[1], skin[2])


if __name__ == '__main__':
    unittest.main()
