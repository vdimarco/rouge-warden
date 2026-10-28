"""Wide roads get a broken white center line. Narrow streets stay bare."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACES = (ROOT / "Source/Quebec/QuebecTraces.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def _constants():
    width = float(re.search(r"Width < ([0-9.]+)f", TRACES).group(1))
    length = float(re.search(r"Length < ([0-9.]+)f", TRACES).group(1))
    start, step = (float(v) for v in re.search(r"Along = ([0-9.]+)f; Along < Length - ([0-9.]+)f; Along \+= ([0-9.]+)f", TRACES).groups()[0::2])
    margin = float(re.search(r"Along < Length - ([0-9.]+)f", TRACES).group(1))
    return width, length, start, margin, step


def dash_count(road_length, start, margin, step):
    count = 0
    along = start
    while along < road_length - margin:
        count += 1
        along += step
    return count


class LanePaintTests(unittest.TestCase):
    def test_only_wide_roads_are_painted_and_the_dash_is_a_flat_plane(self):
        width, length, start, margin, step = _constants()
        self.assertEqual((width, length, start, margin, step), (900.0, 1500.0, 250.0, 250.0, 450.0))
        self.assertIn("FVector(1.8f, .22f, 1.f)", TRACES)
        self.assertIn('TEXT("M_White")', TRACES)
        self.assertIn("NM_DedicatedServer", TRACES)
        self.assertIn("IsToronto", TRACES)
        # The boulevard beside the spawn is 8351 cm. The loop leaves a gap between 180 cm dashes.
        self.assertEqual(dash_count(8351.0, start, margin, step), 18)
        self.assertLess(1400.0, length)

    def test_the_host_and_a_remote_client_each_paint_once(self):
        self.assertIn("if (!bToronto) AQuebecLanePaint::Spawn(GetWorld());", GAME)
        self.assertIn("if (IsLocalController() && GetNetMode() == NM_Client) AQuebecLanePaint::Spawn(GetWorld());", GAME)
        self.assertIn("for (TActorIterator<AQuebecLanePaint> It(World); It; ++It) return 0;", TRACES)


if __name__ == "__main__":
    unittest.main()
