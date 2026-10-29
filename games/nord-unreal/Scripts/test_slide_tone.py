"""A played handbrake slide screams in the drive loop. A straight run and a gripped turn stay quiet.

Built with the system compiler. This does not run Unreal, and nobody listened in the game.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("slide_tone_test.cpp")
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
CLASSES = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecSlideTone.h").read_text()
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]


class SlideToneTests(unittest.TestCase):
    def test_a_played_slide_screams(self):
        compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
        self.assertTrue(compilers)
        with tempfile.TemporaryDirectory() as directory:
            for name in compilers:
                strict = subprocess.run(
                    [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_SLIDE_STRICT", str(SOURCE)],
                    capture_output=True, text=True, check=False)
                self.assertEqual(strict.returncode, 0, strict.stderr)
                binary = Path(directory) / "slide_tone_test"
                build = subprocess.run(
                    [name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"],
                    capture_output=True, text=True, check=False)
                self.assertEqual(build.returncode, 0, build.stderr)
                wav = Path(directory) / "slide.wav"
                run = subprocess.run([str(binary), str(wav)], capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("0 failures", run.stdout)
                self.assertIn("live ", run.stdout)
                self.assertGreater(wav.stat().st_size, 44 + 24000 * 2 * 5)
                break

    def test_the_drive_loop_uses_the_same_line(self):
        self.assertIn('#include "QuebecSlide.h"', HEADER)
        self.assertIn("QuebecSlide::MinLateral", HEADER)
        self.assertIn("QuebecSlide::MinSpeed", HEADER)
        self.assertIn("DriveWave->SetSampleRate(24000);", GAME)
        self.assertIn("inline constexpr int SampleRate = 24000;", HEADER)
        self.assertIn("QuebecSlideTone::Target(Speed,LateralSpeed,bHandbrake)", GAME)
        self.assertIn("QuebecSlideTone::Follow(SlideToneGain,SlideGoal,1.f/static_cast<float>(QuebecSlideTone::SampleRate))", GAME)
        self.assertIn("Engine+Squeal+Scream", GAME)
        self.assertIn("QuebecSlideTone::FVoice SlideVoice;", CLASSES)
        # A driver who leaves the car does not carry a scream into the next one.
        start = GAME.index("void AQuebecCar::UpdateDriveAudio")
        self.assertIn("SlideToneGain=0.f;", GAME[start:start + 600])


if __name__ == "__main__":
    unittest.main()
