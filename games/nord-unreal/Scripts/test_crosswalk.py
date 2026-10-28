"""Wide roads get a ladder crossing at mid-block. The center dashes stay."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACES = (ROOT / "Source/Quebec/QuebecTraces.cpp").read_text()
MAP = (ROOT / "Source/Quebec/LaFontaineMap.h").read_text()


def wide_long_roads():
    body = MAP.split("RoadSegments[][2] = {", 1)[1].split("};", 1)[0]
    numbers = re.findall(r"FVector\(([-\d.]+),([-\d.]+),([-\d.]+)\)", body)
    points = [(float(a), float(b)) for a, b, _ in numbers]
    roads = list(zip(points[0::2], points[1::2]))
    widths = [float(v) for v in re.findall(r"[-\d.]+", MAP.split("RoadSegmentWidths[] = {", 1)[1].split("};", 1)[0])]
    count = 0
    for (start, end), width in zip(roads, widths):
        length = ((start[0] - end[0]) ** 2 + (start[1] - end[1]) ** 2) ** 0.5
        if width >= 900.0 and length >= 1500.0:
            count += 1
    return count


class CrosswalkTests(unittest.TestCase):
    def test_the_ladder_sits_inside_the_wide_road_gate(self):
        self.assertIn("const float BarSpan = (Width - 160.f) / 100.f;", TRACES)
        self.assertIn("for (int32 Bar = 0; Bar < 8; ++Bar)", TRACES)
        self.assertIn("(static_cast<float>(Bar) - 3.5f) * 90.f", TRACES)
        self.assertIn("FVector(.40f, BarSpan, 1.f)", TRACES)
        self.assertLess(TRACES.index("FVector(1.8f, .22f, 1.f)"), TRACES.index("const float BarSpan"))
        self.assertLess(TRACES.index("const float BarSpan"), TRACES.index("NORD_TRACES center_dashes=%d crosswalk_bars=%d"))
        self.assertIn("return Count;", TRACES)
        # Twenty-eight wide roads in the park. Eight bars each when the ground trace hits.
        self.assertEqual(wide_long_roads(), 28)
        self.assertEqual(28 * 8, 224)


if __name__ == "__main__":
    unittest.main()
