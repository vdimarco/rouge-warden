"""The opening clock is night, and three neon blades sit in that look.

Rain stays off the default. The weather chain and the clear fallback stay.
The opening aim stays. This does not run Unreal.
"""
import math
import re
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecSky.h").read_text()
NIGHT = (ROOT / "Source/Quebec/QuebecNight.h").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
BROWSER = (ROOT / "Scripts/browser_streaming.py").read_text()


def _project(point):
    spawn = np.array([38793.0165416717, -7522.815200551502, 120.0])
    pitch, yaw = -16.0, 110.076
    arm, sock_y, sock_z = 420.0, 70.0, 110.0
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = np.array((cp * cy, cp * sy, sp))
    right = np.array((-sy, cy, 0.0))
    up = np.array((-sp * cy, -sp * sy, cp))
    cam = spawn - arm * forward + sock_y * right + sock_z * up
    view = np.array(point, dtype=np.float64) - cam
    depth = float(np.dot(view, forward))
    tan_h = math.tan(math.radians(45.0))
    tan_v = tan_h * (540.0 / 960.0)
    x = float(np.dot(view, right)) / (depth * tan_h)
    y = float(np.dot(view, up)) / (depth * tan_v)
    return (x + 1.0) * 0.5 * 960.0, (1.0 - y) * 0.5 * 540.0, depth


class OpeningNightTests(unittest.TestCase):
    def test_the_opening_hour_is_night_and_the_aim_stays(self):
        self.assertIn("inline constexpr float OpeningHour = 22.f;", NIGHT)
        self.assertIn("float StartHour = QuebecShade::OpeningHour, DayMinutes = 40.f;", SKY)
        self.assertIn("SetClock(FMath::IsFinite(StartHour) ? StartHour : QuebecShade::OpeningHour, Now);", SKY)
        self.assertIn("float FrozenHour = 22.f;", HEADER)
        self.assertIn("float Hour = 22.f;", HEADER)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)
        self.assertIn('NORD_SKY_ARGS", "-NordHour=22 -NordFreezeTime"', BROWSER)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("for (const QuebecShade::FNeonSign& Sign : QuebecShade::NeonSigns)", SKY)
        self.assertIn("Glow->SetVisibility(bLampsOn);", SKY)
        signs = re.findall(r"\{\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),", NIGHT)
        self.assertEqual(len(signs), 3)
        for x, y, z in signs:
            px, py, depth = _project((float(x), float(y), float(z)))
            self.assertGreater(depth, 200.0)
            self.assertGreater(px, 40.0)
            self.assertLess(px, 920.0)
            self.assertGreater(py, 40.0)
            self.assertLess(py, 500.0)
            self.assertGreater(180.0 / depth * (480.0 / math.tan(math.radians(45.0))), 40.0)


if __name__ == "__main__":
    unittest.main()
