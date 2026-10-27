"""A session can start on Sherbrooke or on Rue Rachel. The opening stays the default.

Built with the system compiler. This does not run Unreal.
"""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("place_test.cpp")
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
PLACE = (ROOT / "Source/Quebec/QuebecPlace.h").read_text()
PAGE = (ROOT / "Browser/index.html").read_text()
SCRIPT = (ROOT / "Browser/place.js").read_text()
NIGHT = (ROOT / "Source/Quebec/QuebecNight.h").read_text()
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]


class PlaceTests(unittest.TestCase):
    def test_rachel_is_a_second_start(self):
        compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
        self.assertTrue(compilers)
        with tempfile.TemporaryDirectory() as directory:
            for name in compilers:
                strict = subprocess.run(
                    [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_PLACE_STRICT", str(SOURCE)],
                    capture_output=True, text=True, check=False)
                self.assertEqual(strict.returncode, 0, strict.stderr)
                binary = Path(directory) / "place_test"
                build = subprocess.run(
                    [name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"],
                    capture_output=True, text=True, check=False)
                self.assertEqual(build.returncode, 0, build.stderr)
                run = subprocess.run([str(binary)], capture_output=True, text=True, check=False)
                self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("0 failures", run.stdout)
                break

    def test_the_game_and_the_page_can_start_there(self):
        self.assertIn("QuebecPlace::PlaceAt", GAME)
        self.assertIn('TEXT("NordPlace=")', GAME)
        self.assertIn("ServerBeginPlace(Index)", GAME)
        self.assertIn("FrameTheStreet(Spot.Yaw)", GAME)
        self.assertIn("QuebecStreetLook::OpeningYaw", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("void BeginPlaceKey(int32 Index);", HEADER)
        self.assertIn("OpeningHour = 22.f", NIGHT)
        self.assertIn('{"Rachel"', PLACE)
        self.assertIn('id="place-rachel"', PAGE)
        self.assertIn('id="place-sherbrooke"', PAGE)
        self.assertIn("data-key=\"48\"", PAGE)
        self.assertIn("place === 'rachel'", SCRIPT)


if __name__ == "__main__":
    unittest.main()
