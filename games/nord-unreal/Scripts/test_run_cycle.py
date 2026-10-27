"""The hoodie run is its own clip, shorter than the walk.

The prepared FBX is the CC0 run already in the source glTF. This does not
run Unreal, so the saved sequence is still the editor's import.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from bake_officer_stand import SOURCE, _accessor, _load_glb

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
PREPARED = ROOT / "Data/Art/Plateau/Civilians/Prepared"


def _turn(suffix, bone):
    document, blob = _load_glb(SOURCE / "MenHoodie.glb")
    anim = next(item for item in document["animations"] if item["name"].endswith(suffix))
    node = next(index for index, item in enumerate(document["nodes"]) if item.get("name") == bone)
    channel = next(
        item for item in anim["channels"]
        if item["target"]["node"] == node and item["target"]["path"] == "rotation")
    sampler = anim["samplers"][channel["sampler"]]
    times = _accessor(document, blob, sampler["input"]).reshape(-1)
    values = _accessor(document, blob, sampler["output"])
    first = values[0] / np.linalg.norm(values[0])
    turns = []
    for value in values:
        other = value / np.linalg.norm(value)
        turns.append(math.degrees(2 * math.acos(np.clip(abs(float(np.dot(first, other))), 0, 1))))
    return float(times[-1]), max(turns)


class RunCycleTests(unittest.TestCase):
    def test_the_hoodie_run_is_not_the_walk(self):
        run_time, run_leg = _turn("|Run", "LowerLeg.L")
        walk_time, walk_leg = _turn("|Walk", "LowerLeg.L")
        _time, run_foot = _turn("|Run", "Foot.L")
        self.assertLess(run_time, 1.0)
        self.assertGreater(run_time, 0.5)
        self.assertGreater(walk_time, run_time)
        self.assertGreater(run_leg, 60.0)
        self.assertGreater(run_leg, walk_leg + 20.0)
        self.assertGreater(run_foot, 120.0)
        fbx = (PREPARED / "A_MenHoodie_Run.fbx").read_bytes()
        self.assertTrue(fbx.startswith(b"Kaydara FBX Binary"))
        self.assertIn(b"UpperLeg.L", fbx)
        self.assertIn('"file": "A_MenHoodie_Run.fbx"', (PREPARED / "manifest.json").read_text())
        hoodie = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SK_MenHoodie.SK_MenHoodie")')
        casual = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual")')
        block = GAME[hoodie:casual]
        self.assertIn(
            'TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Run.A_MenHoodie_Run")', block)
        self.assertIn("CrewRun = HoodieRun;", block)
        self.assertIn("Speed > 520.f && CrewRun ? CrewRun", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
