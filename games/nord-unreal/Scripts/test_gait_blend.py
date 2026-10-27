"""The walk and the run meet in the middle, and the side run is its own clip.

The opening camera stays. This does not run Unreal, and it does not play a blend space.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from bake_officer_stand import SOURCE, _accessor, _load_glb
from gait_blend import slerp, walk_run_share

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
GAIT = (ROOT / "Source/Quebec/QuebecGait.h").read_text()


def _rotation(suffix, bone, phase):
    document, blob = _load_glb(SOURCE / "MenHoodie.glb")
    anim = next(item for item in document["animations"] if item["name"].endswith(suffix))
    node = next(index for index, item in enumerate(document["nodes"]) if item.get("name") == bone)
    channel = next(
        item for item in anim["channels"]
        if item["target"]["node"] == node and item["target"]["path"] == "rotation")
    sampler = anim["samplers"][channel["sampler"]]
    times = _accessor(document, blob, sampler["input"]).reshape(-1)
    values = _accessor(document, blob, sampler["output"])
    time = float(times[-1]) * phase
    index = max(0, int(np.searchsorted(times, time) - 1))
    if index >= len(times) - 1:
        return values[-1]
    span = times[index + 1] - times[index]
    blend = 0.0 if span < 1e-8 else (time - times[index]) / span
    return slerp(values[index], values[index + 1], blend)


def _angle(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    return math.degrees(2 * math.acos(np.clip(abs(float(np.dot(a, b))), 0, 1)))


class GaitBlendTests(unittest.TestCase):
    def test_half_speed_is_half_the_run(self):
        self.assertEqual(walk_run_share(450.0), 0.0)
        self.assertAlmostEqual(walk_run_share(625.0), 0.5)
        self.assertEqual(walk_run_share(800.0), 1.0)
        self.assertIn("constexpr double Walk = 450.;", GAIT)
        self.assertIn("constexpr double Sprint = 800.;", GAIT)
        walk = _rotation("|Walk", "LowerLeg.L", 0.28)
        run = _rotation("|Run", "LowerLeg.L", 0.28)
        mid = slerp(walk, run, 0.5)
        self.assertGreater(_angle(walk, run), 30.0)
        self.assertGreater(_angle(mid, walk), 15.0)
        self.assertGreater(_angle(mid, run), 15.0)
        names = [item["name"] for item in _load_glb(SOURCE / "MenHoodie.glb")[0]["animations"]]
        self.assertTrue(any(name.endswith("|Run_Left") for name in names))
        self.assertIn("Speed > 520.f && CrewRun ? CrewRun", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
