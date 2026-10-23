"""The prepared hoodie walk is a cycle, not one pose.

The sheet samples the glTF clip whose duration matches the prepared walk.
This does not run Unreal.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from bake_officer_stand import SOURCE, _accessor, _load_glb

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SWAY = (ROOT / "Source/Quebec/QuebecSway.h").read_text()


def _turn(path, bone):
    document, blob = _load_glb(path)
    anim = next(item for item in document["animations"] if item["name"].endswith("|Walk"))
    node = next(index for index, item in enumerate(document["nodes"]) if item.get("name") == bone)
    channel = next(
        item for item in anim["channels"]
        if item["target"]["node"] == node and item["target"]["path"] == "rotation")
    sampler = anim["samplers"][channel["sampler"]]
    times = _accessor(document, blob, sampler["input"]).reshape(-1)
    values = _accessor(document, blob, sampler["output"])
    first = values[0] / np.linalg.norm(values[0])
    turns = []
    for value in values[1:]:
        other = value / np.linalg.norm(value)
        turns.append(math.degrees(2 * math.acos(np.clip(abs(float(np.dot(first, other))), 0, 1))))
    return float(times[-1]), int(len(times)), max(turns)


class WalkCycleTests(unittest.TestCase):
    def test_the_hoodie_walk_changes_pose(self):
        duration, samples, leg = _turn(SOURCE / "MenHoodie.glb", "UpperLeg.L")
        _duration, _samples, arm = _turn(SOURCE / "MenHoodie.glb", "UpperArm.L")
        self.assertGreater(duration, 1.0)
        self.assertGreaterEqual(samples, 8)
        self.assertGreater(leg, 30.0)
        self.assertGreater(arm, 30.0)
        hoodie = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SK_MenHoodie.SK_MenHoodie")')
        casual = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual")')
        block = GAME[hoodie:casual]
        self.assertIn("CrewWalk = HoodieWalk;", block)
        self.assertIn("CrewRun = nullptr;", block)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("inline constexpr double WalkRoll = 12.;", SWAY)
        self.assertIn("inline constexpr double IdleShare = 0.34;", SWAY)


if __name__ == "__main__":
    unittest.main()
