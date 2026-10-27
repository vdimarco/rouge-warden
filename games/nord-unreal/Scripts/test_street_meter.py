"""The street column is a framed card and the vitals bars are quartered meters."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def rule_edge(scale):
    return min(max(2.0, 2.0 * scale), 4.0 * scale)


def lip(scale, bar_height):
    return min(max(1.0, 2.0 * scale), bar_height * 0.4)


def gap(scale, bar_width):
    return min(max(2.0, 3.0 * scale), bar_width * 0.08)


class StreetMeterTests(unittest.TestCase):
    def test_column_frame_and_meter_are_in_the_street_hud(self):
        source = (ROOT / 'Source/Quebec/QuebecGameHUD.cpp').read_text()
        self.assertIn('DrawRect(Panel.CopyWithNewOpacity(.62f), PanelX, PanelY, PanelW, PanelH)', source)
        self.assertNotIn('Panel.CopyWithNewOpacity(.34f)', source)
        self.assertIn('const float RuleEdge = FMath::Min(FMath::Max(2.f, 2.f * S), 4.f * S)', source)
        self.assertIn('DrawRect(Accent, PanelX, PanelY, RuleEdge, PanelH)', source)
        self.assertIn('for (int32 Notch = 1; Notch < 4; ++Notch)', source)
        self.assertIn('const float Lip = FMath::Min(FMath::Max(1.f, 2.f * S), BarHeight * .4f)', source)
        self.assertIn('DrawRect(Paper.CopyWithNewOpacity(.9f), PosX, PosY, Fill, Lip)', source)
        self.assertIn('DrawRect(bCutFill ? Cut : Paper.CopyWithNewOpacity(.85f), At, PosY, Gap, BarHeight)', source)
        self.assertIn('return bBusy ? 158.f : 0.f', source)
        self.assertIn('PISTOL', (ROOT / 'Source/Quebec/QuebecCombat.cpp').read_text())
        self.assertNotIn('PISTOLET', (ROOT / 'Source/Quebec/QuebecCombat.cpp').read_text())

    def test_rule_stays_in_the_padding_and_the_meter_stays_a_bar(self):
        for scale in (0.4, 0.6, 1.0, 1.5):
            edge = rule_edge(scale)
            self.assertLessEqual(edge, 4.0 * scale + 1e-6)
            self.assertLessEqual(edge, 6.0 * scale + 1e-6)
            health = max(7.0 * scale, 4.0)
            armor = max(5.0 * scale, 3.0)
            for height in (health, armor):
                self.assertGreaterEqual(lip(scale, height), 1.0)
                self.assertLessEqual(lip(scale, height), height * 0.4 + 1e-6)
            width = 150.0 * scale
            cut = gap(scale, width)
            self.assertGreaterEqual(width, cut * 4.0)
            for notch in (1, 2, 3):
                at = width * (notch / 4.0) - cut * 0.5
                self.assertGreaterEqual(at, -1e-6)
                self.assertLessEqual(at + cut, width + 1e-6)


if __name__ == '__main__':
    unittest.main()
