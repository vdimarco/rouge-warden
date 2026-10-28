"""The radar and the play page share one clock line. Weather names stay English."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecSky.h").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
CARD = (ROOT / "Browser/mission-card.js").read_text()


def hud_clock(hour, weather):
    minutes = min(24 * 60 - 1, max(0, int(hour * 60)))
    return f"{minutes // 60:02d}:{minutes % 60:02d} · {weather}"


class ClockLineTests(unittest.TestCase):
    def test_the_radar_and_the_shell_use_one_line(self):
        self.assertIn("FString AQuebecSky::GetClockLine() const", SKY)
        self.assertIn("FString GetClockLine() const;", HEADER)
        self.assertEqual(SKY.count('TEXT("%02d:%02d · %s")'), 1)
        self.assertIn("RightText(Sky->GetClockLine()", GAME)
        self.assertIn("SkyLine = Sky->GetClockLine();", GAME)
        self.assertIn("nordSky", GAME)
        self.assertNotIn("FloorToInt(Sky->GetHour()", GAME)
        self.assertIn("Math.floor(Number(hour) * 60)", CARD)

    def test_the_hour_floors_and_the_names_stay_plain(self):
        self.assertEqual(hud_clock(15, "CLEAR"), "15:00 · CLEAR")
        self.assertEqual(hud_clock(15.9, "RAIN"), "15:54 · RAIN")
        self.assertEqual(hud_clock(0, "FOG"), "00:00 · FOG")
        self.assertEqual(hud_clock(24, "CLEAR"), "23:59 · CLEAR")
        self.assertEqual(hud_clock(-3, "BREEZY"), "00:00 · BREEZY")
        for name in ("CLEAR", "BREEZY", "OVERCAST", "FOG", "DRIZZLE", "RAIN"):
            self.assertNotRegex(hud_clock(8, name), r"[éèêà]")


if __name__ == "__main__":
    unittest.main()
