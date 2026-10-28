"""The radar heading is a paper wedge inside an ink wedge, so it survives the avenue."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def arrow_block():
    start = GAME.index("const FVector2D Tip = Center + Nose * 10.f * Scale;")
    end = GAME.index('Text(TEXT("N")', start)
    return GAME[start:end]


class RadarArrowTests(unittest.TestCase):
    def test_the_ink_wedge_is_drawn_before_the_paper_wedge(self):
        block = arrow_block()
        self.assertIn("const FVector2D ArrowMid = (Tip + TailA + TailB) / 3.f;", block)
        self.assertIn("ArrowMid + (Tip - ArrowMid) * 1.55f", block)
        self.assertIn("ArrowMid + (TailA - ArrowMid) * 1.55f", block)
        self.assertIn("ArrowMid + (TailB - ArrowMid) * 1.55f", block)
        ink = block.index("DrawLine(CaseLeft.X, CaseLeft.Y, CaseRight.X, CaseRight.Y, Ink, 2.f * Scale);")
        paper = block.index("DrawLine(FillLeft.X, FillLeft.Y, FillRight.X, FillRight.Y, Paper, 2.f * Scale);")
        outline = block.index("DrawLine(TailA.X, TailA.Y, Tip.X, Tip.Y, Paper, 2.f * Scale);")
        self.assertLess(ink, paper)
        self.assertLess(paper, outline)
        self.assertEqual(block.count("for (int32 Row = 0; Row <= 14; ++Row)"), 2)
        self.assertIn("const FVector2D TailA = Center - Nose * 5.f * Scale + Side * 5.f * Scale;", block)

    def test_avenues_stay_cased(self):
        self.assertIn("Ink, 5.2f * Scale", GAME)
        self.assertIn("FLinearColor(.92f, .89f, .82f, .95f), 2.6f * Scale", GAME)


if __name__ == "__main__":
    unittest.main()
