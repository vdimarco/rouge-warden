"""Broadleaf crowns use the clustered canopy, and the opening aim stays.

This does not run Unreal.
"""
import unittest
from pathlib import Path

from leaf_crown import LEAF_SHADE, canopy_name, crown_place

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
LEAVES = (ROOT / "Source/Quebec/QuebecVegetation.cpp").read_text()
GEO = ROOT / "Data/EnvironmentRefresh/Geometry"


class LeafCrownTests(unittest.TestCase):
    def test_a_broadleaf_crown_is_a_clustered_canopy(self):
        tree = {"style": 0, "seed": 1844596393, "crown_radius_cm": 400.0, "height_cm": 1200.0}
        name = canopy_name(tree)
        self.assertEqual(name, "Canopy0_%d.obj" % ((1844596393 // 11) % 4))
        materials = {line.split()[1] for line in (GEO / name).read_text().splitlines() if line.startswith("usemtl ")}
        self.assertTrue({"Leaf0", "Leaf1", "Leaf2"} <= materials)
        self.assertEqual(canopy_name({"style": 2, "seed": 9}), "Canopy2_0.obj")
        sxy, sz, z0 = crown_place(tree, 654.0, 220.0, 948.0)
        self.assertAlmostEqual(948.0 * sz + z0, 1200.0, places=3)
        self.assertAlmostEqual(220.0 * sz + z0, 1200.0 * 0.23, places=3)
        self.assertAlmostEqual(sxy * 654.0, 400.0, places=3)
        self.assertEqual(len(LEAF_SHADE), 3)
        self.assertIn("constexpr int32 LeafCount = 10;", LEAVES)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
