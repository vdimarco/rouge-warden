"""The flat HUD cards gain a paper rule that stays outside the type."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class HudRuleTests(unittest.TestCase):
    def test_rule_sits_inside_the_card_and_outside_the_type(self):
        source = (ROOT / 'Source/Quebec/QuebecGameplay.cpp').read_text()
        self.assertIn('PanelRule(MissionX, MissionY, MissionWidth, MissionHeight)', source)
        self.assertIn('PanelRule(PromptX, PromptY, PromptWidth, PromptHeight)', source)
        self.assertIn('PanelRule(Margin, TopClear, Width, Height)', source)
        self.assertIn('const float Inset = 4.f * Scale', source)
        self.assertIn('const float Tick = 6.f * Scale', source)
        self.assertIn('DrawRect(Accent, MissionX, MissionY, 2.f * Scale, MissionHeight)', source)
        self.assertIn('Text(Line, Accent, MissionX + 12.f * Scale, RowY, .9f)', source)
        for scale in (0.4, 1.0, 2.0):
            inset = 4.0 * scale
            weight = max(1.0, 2.0 * scale)
            text = 12.0 * scale
            self.assertLess(inset + weight * 0.5, text)
            self.assertLessEqual(inset + 6.0 * scale, text)


if __name__ == '__main__':
    unittest.main()
