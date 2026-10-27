"""A held gas pedal reaches full power in 50 ms. The old wait was 200 ms.

Built with the system compiler. This does not run Unreal.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("pedal_test.cpp")
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
MODEL = (ROOT / "Scripts/gauntlet_model_test.cpp").read_text()
STEER = (ROOT / "Source/Quebec/QuebecSteerAssist.h").read_text()
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]


class PedalTests(unittest.TestCase):
    def test_full_gas_arrives_in_one_twentieth(self):
        compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
        self.assertTrue(compilers)
        with tempfile.TemporaryDirectory() as directory:
            for name in compilers:
                strict = subprocess.run(
                    [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_PEDAL_STRICT", str(SOURCE)],
                    capture_output=True, text=True, check=False)
                self.assertEqual(strict.returncode, 0, strict.stderr)
                binary = Path(directory) / "pedal_test"
                build = subprocess.run(
                    [name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"],
                    capture_output=True, text=True, check=False)
                self.assertEqual(build.returncode, 0, build.stderr)
                run = subprocess.run([str(binary)], capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("0 failures", run.stdout)
                break

    def test_the_game_uses_the_same_rate(self):
        self.assertIn("inline constexpr float ThrottleRate = 20.f;", STEER)
        self.assertIn("inline constexpr float HoldRate = 3.5f;", STEER)
        self.assertIn("QuebecSteer::ThrottleRate", GAME)
        self.assertNotIn("DriveThrottle,Throttle,Step,5.f", GAME.replace(" ", ""))
        self.assertIn("QuebecSteer::ThrottleRate", MODEL)
        self.assertNotIn("Throttle, Step, 5.f", MODEL)


if __name__ == "__main__":
    unittest.main()
