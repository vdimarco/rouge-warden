"""Avenues on the radar get a cased stroke. Side streets stay the grey line."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def radar_block():
    start = GAME.index("const auto RoadWidthCm")
    end = GAME.index("const float CreditRight", start)
    return GAME[start:end]


class RadarRankTests(unittest.TestCase):
    def test_avenues_are_cased_and_side_streets_stay_grey(self):
        block = radar_block()
        self.assertIn(">= 900.f", block)
        self.assertIn("LaFontaine::RoadSegmentWidths[Index]", block)
        self.assertIn("LaFontaineExtension::RoadSegmentWidths[Extension]", block)
        self.assertIn("CollegeBathurst::RoadSegmentWidths[Index]", block)
        self.assertIn("return 400.f", block)
        self.assertIn("if (Pass == 0 && bAvenue) continue;", block)
        self.assertIn("if (Pass > 0 && !bAvenue) continue;", block)
        local = block.index("FLinearColor(.53f, .58f, .59f, .85f), 1.5f * Scale")
        casing = block.index("Ink, 5.2f * Scale")
        fill = block.index("FLinearColor(.92f, .89f, .82f, .95f), 2.6f * Scale")
        self.assertLess(local, casing)
        self.assertLess(casing, fill)
        self.assertIn("ClipHUDRadarSegment(A, B, Center, MapRadius)", block)
        # The rim-road guard stays in the clip. This round does not retune it.
        self.assertIn("if (Enter > Leave) return false;", GAME)

    def test_nine_metres_matches_the_center_line_gate(self):
        traces = (ROOT / "Source/Quebec/QuebecTraces.cpp").read_text()
        self.assertIn("Width < 900.f", traces)
        self.assertIn(">= 900.f", radar_block())


if __name__ == "__main__":
    unittest.main()
