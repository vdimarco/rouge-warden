"""The missing crew rig draws the clothed casual idle, not the mannequin."""
import unittest
from pathlib import Path

from bake_officer_stand import SOURCE, height_cm, stand_mesh

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def _face_leads(parts):
    import numpy as np
    eyes = np.concatenate([part[0] for part in parts if part[3] == "Eye"])
    hair = np.concatenate([part[0] for part in parts if part[3] == "Hair"])
    return float(eyes[:, 0].mean() - hair[:, 0].mean())


class PlayerStandTests(unittest.TestCase):
    def test_the_missing_rig_prefers_the_casual_idle(self):
        stand = GAME.index('TEXT("/Game/Plateau/Life/Civilians/MenCasual/SM_MenCasualStand.SM_MenCasualStand")')
        hide_manny = GAME.index("GetMesh()->SetVisibility(false);", stand)
        body = GAME.index("GetMesh()->SetSkeletalMesh(Body);", stand)
        show_rig = GAME.index("GetMesh()->SetVisibility(true);", stand)
        self.assertLess(stand, hide_manny)
        self.assertLess(hide_manny, body)
        self.assertLess(stand, show_rig)
        self.assertLess(show_rig, body)
        self.assertIn('TEXT("CasualStand")', GAME)
        self.assertIn("SetRelativeLocation(FVector(0., 0., -96.))", GAME)

    def test_the_idle_is_a_standing_person_facing_forward(self):
        parts = stand_mesh(SOURCE / "MenCasual.glb")
        self.assertGreater(height_cm(parts), 170.0)
        self.assertLess(height_cm(parts), 200.0)
        self.assertGreater(sum(len(part[2]) for part in parts), 4000)
        self.assertGreater(_face_leads(parts), 2.0)
        positions = __import__("numpy").concatenate([part[0] for part in parts])
        self.assertLess(abs(float(positions[:, 2].min())), 0.05)


if __name__ == "__main__":
    unittest.main()
