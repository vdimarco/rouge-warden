"""A played drive earns one graded slide banner when the slide ends. A straight run, a tap and a gripped turn earn none.

Built with the system compiler. This does not run Unreal.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("slide_test.cpp")
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecSlide.h").read_text()
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]


class SlideTests(unittest.TestCase):
    def test_a_played_slide_earns_one_banner(self):
        compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
        self.assertTrue(compilers)
        with tempfile.TemporaryDirectory() as directory:
            for name in compilers:
                strict = subprocess.run(
                    [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_SLIDE_STRICT", str(SOURCE)],
                    capture_output=True, text=True, check=False)
                self.assertEqual(strict.returncode, 0, strict.stderr)
                binary = Path(directory) / "slide_test"
                build = subprocess.run(
                    [name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"],
                    capture_output=True, text=True, check=False)
                self.assertEqual(build.returncode, 0, build.stderr)
                run = subprocess.run([str(binary)], capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("0 failures", run.stdout)
                self.assertIn("pay ", run.stdout)
                self.assertIn("grade BIG SLIDE", run.stdout)
                break

    def test_the_car_uses_the_same_rule(self):
        self.assertIn("inline constexpr float HoldSeconds = 0.35f;", HEADER)
        self.assertIn("inline constexpr float MinLateral = 180.f;", HEADER)
        self.assertIn("inline constexpr float AgainSeconds = 1.5f;", HEADER)
        self.assertIn("Slide.Tick(Step, Speed, LateralSpeed, bHandbrake, bFailsafe)", GAME)
        self.assertIn("QuebecSlide::Title(Slide.LastGrade)", GAME)
        self.assertIn("else Slide = QuebecSlide::FState();", GAME)
        self.assertIn('TEXT("Held for %.1f s"), Slide.LastSeconds', GAME)
        self.assertIn("inline constexpr float BigLateral = 550.f;", HEADER)
        self.assertIn("inline constexpr float HugeLateral = 700.f;", HEADER)
        self.assertIn("QuebecSlide::NoticeSeconds", GAME)
        self.assertIn("QuebecNotice::Show", GAME)


if __name__ == "__main__":
    unittest.main()
