"""A walk leaves pale puffs at the rear shoe. Rain and the leaf cards stay."""
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
SCUFF = (ROOT / "Source/Quebec/QuebecScuff.h").read_text()
RAIN = (ROOT / "Scripts/rain_streak.hlsl").read_text()


def dust_block():
    start = GAME.index("void AQuebecCharacter::UpdateFootDust")
    end = GAME.index("void AQuebecCharacter::Tick", start)
    return GAME[start:end]


class ScuffTests(unittest.TestCase):
    def test_the_puff_is_born_at_the_rear_shoe(self):
        block = dust_block()
        self.assertIn("inline constexpr int Count = 5;", SCUFF)
        self.assertIn("inline constexpr double Life = 0.7;", SCUFF)
        self.assertIn("inline constexpr double Interval = 0.16;", SCUFF)
        self.assertIn("inline constexpr double WalkSpeed = 80.;", SCUFF)
        self.assertIn("inline constexpr double FootBack = 40.;", SCUFF)
        self.assertIn("Out.Back = Clamped * 84.;", SCUFF)
        self.assertIn("Out.Radius = (12. + Clamped * 32.) * Fade;", SCUFF)
        self.assertIn("QuebecScuff::WalkSpeed", block)
        self.assertIn("GetVelocity().Size2D()", block)
        self.assertIn("WasRecentlyRendered(1.f)", block)
        self.assertIn("NM_DedicatedServer", block)
        self.assertIn('TEXT("/Engine/BasicShapes/Sphere.Sphere")', block)
        self.assertIn('TEXT("/Game/Materials/M_White.M_White")', block)
        self.assertIn("Dust.Radius / 50.", block)
        self.assertIn("ApplyStreetSway(DeltaSeconds);\n    UpdateFootsteps(DeltaSeconds);\n    UpdateFootDust(DeltaSeconds);", GAME)
        self.assertIn("void UpdateFootDust(float DeltaSeconds);", HEADER)
        self.assertIn("float3 Box = float3(2000.0, 2000.0, 1200.0);", RAIN)
        self.assertNotIn("LeafCount", block)
        self.assertIn("void AQuebecCharacter::ScuffAges", GAME)
        self.assertIn("nordScuff", GAME)
        self.assertEqual(SCUFF.count("inline constexpr double WalkSpeed = 80.;"), 1)
        self.assertEqual(SCUFF.count("inline constexpr double Life = 0.7;"), 1)

    def test_the_shell_samples_a_puff_before_it_dies(self):
        self.assertIn("constexpr float ShellStateSeconds = 0.1f;", GAME)
        self.assertIn("BrowserStateElapsed >= ShellStateSeconds", GAME)
        self.assertNotIn("BrowserStateElapsed >= .5f", GAME)
        self.assertLess(0.1 * 5, 0.7)
        self.assertGreater(0.5 * 2, 0.7)

    def test_the_header_matches_the_offline_trail(self):
        binary = Path("/tmp/scuff_test")
        subprocess.run(
            ["g++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-O1",
             f"-I{ROOT / 'Source/Quebec'}", str(ROOT / "Scripts/scuff_test.cpp"),
             "-o", str(binary), "-lm"],
            check=True,
        )
        result = subprocess.run([str(binary)], check=True, capture_output=True, text=True)
        self.assertTrue(result.stdout.startswith("NORD_SCUFF_OK"))
        print(result.stdout.strip())


if __name__ == "__main__":
    unittest.main()
