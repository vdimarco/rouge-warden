"""Leaves drift off the nearest crown. Rain streaks and the walking socket stay."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VEG = (ROOT / "Source/Quebec/QuebecVegetation.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecVegetation.h").read_text()
RAIN = (ROOT / "Scripts/rain_streak.hlsl").read_text()


def leaf_block():
    return VEG[VEG.index("void AQuebecVegetation::UpdateLeaves"):]


class LeafTests(unittest.TestCase):
    def test_cards_leave_the_crown_and_the_rain_shader_stays(self):
        block = leaf_block()
        self.assertIn("constexpr int32 LeafCount = 8;", VEG)
        self.assertIn("constexpr float LeafLife = 2.2f;", VEG)
        self.assertIn("constexpr float LeafInterval = 0.22f;", VEG)
        self.assertIn("Leaf->AddWorldOffset(FVector(55.f, 120.f, -140.f) * DeltaSeconds);", block)
        self.assertIn("FVector(22.f * static_cast<float>(NextLeaf % 5 - 2), 16.f * static_cast<float>(NextLeaf % 3 - 1), 420.f)", block)
        self.assertIn("FVector(0.90f, 0.90f, 0.90f)", block)
        self.assertIn('TEXT("/Engine/BasicShapes/Plane.Plane")', block)
        self.assertIn('TEXT("/Game/Art/M_DetailedAutumnLeaves.M_DetailedAutumnLeaves")', block)
        self.assertIn("GetInstancesOverlappingSphere(Pawn->GetActorLocation(), 1800.f, true)", block)
        self.assertIn("FMath::Square(1800.0)", block)
        self.assertIn("PrimaryActorTick.bCanEverTick = true;", VEG)
        self.assertIn("void UpdateLeaves(float DeltaSeconds);", HEADER)
        self.assertNotIn("rain_streak", block)
        self.assertIn("float3 Box = float3(2000.0, 2000.0, 1200.0);", RAIN)

    def test_a_far_tree_does_not_shed_and_a_near_one_does(self):
        def near(distance):
            return distance * distance < 1800.0 * 1800.0

        self.assertTrue(near(400.0))
        self.assertTrue(near(1799.0))
        self.assertFalse(near(1800.0))
        self.assertFalse(near(4000.0))

    def test_a_card_drops_away_from_the_crown(self):
        def card(index, age, tree=(0.0, 0.0, 0.0)):
            origin = (
                tree[0] + 22.0 * ((index % 5) - 2),
                tree[1] + 16.0 * ((index % 3) - 1),
                tree[2] + 420.0,
            )
            return (origin[0] + 55.0 * age, origin[1] + 120.0 * age, origin[2] - 140.0 * age)

        fresh = card(1, 0.0)
        self.assertEqual(fresh, (-22.0, 0.0, 420.0))
        fallen = card(1, 2.0)
        self.assertLess(fallen[2], fresh[2] - 150.0)
        self.assertGreater(fallen[1], fresh[1] + 200.0)


if __name__ == "__main__":
    unittest.main()
