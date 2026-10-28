"""The missing officer rig draws the clothed idle, not the cylinder."""
import unittest
from pathlib import Path

from bake_officer_stand import SOURCE, height_cm, stand_mesh

ROOT = Path(__file__).resolve().parents[1]
POLICE = (ROOT / "Source/Quebec/QuebecPolice.cpp").read_text()


def _face_leads(parts):
    import numpy as np
    eyes = np.concatenate([part[0] for part in parts if part[3] == "Eye"])
    hair = np.concatenate([part[0] for part in parts if part[3] == "Hair"])
    return float(eyes[:, 0].mean() - hair[:, 0].mean())


class OfficerStandTests(unittest.TestCase):
    def test_the_fallback_prefers_the_baked_idle(self):
        suit = POLICE.index('TEXT("/Game/Plateau/Life/Civilians/MenSuit/SM_MenSuitStand.SM_MenSuitStand")')
        hoodie = POLICE.index('TEXT("/Game/Plateau/Life/Civilians/MenHoodie/SM_MenHoodieStand.SM_MenHoodieStand")')
        stand = POLICE.index('TEXT("FallbackStand")')
        cylinder = POLICE.index('TEXT("FallbackTorso")')
        self.assertLess(suit, cylinder)
        self.assertLess(hoodie, cylinder)
        self.assertLess(stand, cylinder)

    def test_the_idle_is_a_standing_person_facing_forward(self):
        for name in ("MenSuit", "MenHoodie"):
            parts = stand_mesh(SOURCE / f"{name}.glb")
            self.assertGreater(height_cm(parts), 170.0)
            self.assertLess(height_cm(parts), 200.0)
            self.assertGreater(sum(len(part[2]) for part in parts), 4000)
            self.assertGreater(_face_leads(parts), 2.0)
            positions = __import__("numpy").concatenate([part[0] for part in parts])
            self.assertLess(abs(float(positions[:, 2].min())), 0.05)


if __name__ == "__main__":
    unittest.main()
