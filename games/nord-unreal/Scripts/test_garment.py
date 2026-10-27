"""A missing crew rig prefers the hoodie, whose garment has a hood and shorts.

This reads the source and the CC0 GLBs. It does not run Unreal.
"""
import unittest
from pathlib import Path

from bake_officer_stand import SOURCE, _load_glb

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def _slots(path, part):
    document, _blob = _load_glb(path)
    names = []
    for node in document["nodes"]:
        if "mesh" not in node or part not in node.get("name", ""):
            continue
        mesh = document["meshes"][node["mesh"]]
        for prim in mesh["primitives"]:
            names.append(document["materials"][prim["material"]]["name"])
    return names


class GarmentTests(unittest.TestCase):
    def test_the_missing_rig_prefers_the_hoodie(self):
        hoodie = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SK_MenHoodie.SK_MenHoodie")')
        walk = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Walk.A_MenHoodie_Walk")')
        idle = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Idle.A_MenHoodie_Idle")')
        casual = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual")')
        self.assertLess(hoodie, casual)
        self.assertLess(walk, casual)
        self.assertLess(idle, casual)
        block = GAME[hoodie:casual]
        self.assertIn("CrewWalk = HoodieWalk;", block)
        self.assertIn("CrewIdle = HoodieIdle;", block)
        self.assertIn("CrewRun = HoodieRun;", block)
        self.assertIn('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/A_MenHoodie_Run.A_MenHoodie_Run")', block)
        self.assertIn("GetMesh()->SetVisibility(true);", block)
        self.assertIn("CasualStand->SetVisibility(false);", block)
        self.assertIn("GetMesh()->SetRelativeRotation(FRotator(0., 0., 0.));", block)
        self.assertNotIn("SetMaterial", block)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)

    def test_the_hoodie_has_a_hood_and_the_calves_are_bare(self):
        hoodie_body = _slots(SOURCE / "MenHoodie.glb", "Body")
        hoodie_legs = _slots(SOURCE / "MenHoodie.glb", "Legs")
        casual_legs = _slots(SOURCE / "MenCasual.glb", "Legs")
        self.assertIn("Purple", hoodie_body)
        self.assertIn("Skin", hoodie_legs)
        self.assertNotIn("Skin", casual_legs)


if __name__ == "__main__":
    unittest.main()
