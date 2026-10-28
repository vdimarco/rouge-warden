"""A walk plants a step on the stride. A sprint plants sooner. Standing still is silent.

Built with the system compiler. This does not run Unreal.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("step_tone_test.cpp")
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecStep.h").read_text()
SWAY = (ROOT / "Source/Quebec/QuebecSway.h").read_text()
NIGHT = (ROOT / "Source/Quebec/QuebecNight.h").read_text()
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]


class StepToneTests(unittest.TestCase):
    def test_the_stride_and_the_tap(self):
        compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
        self.assertTrue(compilers)
        with tempfile.TemporaryDirectory() as directory:
            for name in compilers:
                strict = subprocess.run(
                    [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_STEP_STRICT", str(SOURCE)],
                    capture_output=True, text=True, check=False)
                self.assertEqual(strict.returncode, 0, strict.stderr)
                binary = Path(directory) / "step_tone_test"
                build = subprocess.run(
                    [name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"],
                    capture_output=True, text=True, check=False)
                self.assertEqual(build.returncode, 0, build.stderr)
                run = subprocess.run([str(binary)], capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("0 failures", run.stdout)
                break

    def test_the_player_hears_the_step_and_the_opening_stays(self):
        self.assertIn("QuebecStep::Consume(StepAlong", GAME)
        self.assertIn("Player->PlayStepTone(StepFoot)", GAME)
        self.assertIn("if (GetCharacterMovement()->IsFalling() || GetCharacterMovement()->IsSwimming()) return;", GAME)
        self.assertIn("inline constexpr double WalkOmega = 7.2", SWAY)
        self.assertIn("WalkCmPerSecond * WalkInterval()", HEADER)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("OpeningHour = 22.f", NIGHT)


if __name__ == "__main__":
    unittest.main()
