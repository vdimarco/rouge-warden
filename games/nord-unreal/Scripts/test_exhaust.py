"""A running car leaves a short column at the tail. Bonnet smoke stays for a wreck."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DRIVE = (ROOT / "Source/Quebec/QuebecDrive.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()


def exhaust_block():
    start = DRIVE.index("void AQuebecCar::UpdateExhaust")
    return DRIVE[start:]


class ExhaustTests(unittest.TestCase):
    def test_the_tailpipe_is_separate_from_the_bonnet_smoke(self):
        block = exhaust_block()
        smoke = DRIVE.index("void AQuebecCar::UpdateDamageSmoke")
        self.assertLess(smoke, DRIVE.index("void AQuebecCar::UpdateExhaust"))
        self.assertIn("FVector(150.,25.*(NextSmokePuff%3-1),40.)", DRIVE)
        self.assertIn('TEXT("/Game/Materials/M_Dark.M_Dark")', DRIVE)
        self.assertIn("BodyDamage >= SmokeDamage", DRIVE)
        self.assertIn("const bool bRunning = !IsWrecked() && (FMath::Abs(Speed) > 80.f || FMath::Abs(Throttle) > 0.05f);", block)
        self.assertIn("FVector(-240.f, 14.f * static_cast<float>(NextExhaust % 3 - 1), 18.f)", block)
        self.assertIn("(-GetActorForwardVector() * 160.f + FVector(0.f, 0.f, 180.f)) * DeltaSeconds", block)
        self.assertIn("FMath::Lerp(0.16f, 0.55f, FMath::Min(1.f, Life * 1.4f))", block)
        self.assertIn('TEXT("/Game/Materials/M_White.M_White")', block)
        self.assertIn("constexpr int32 ExhaustPuffCount = 6;", DRIVE)
        self.assertIn("constexpr float ExhaustPuffLife = 1.1f;", DRIVE)
        self.assertIn("constexpr float ExhaustInterval = 0.16f;", DRIVE)
        self.assertIn("UpdateDamageSmoke(DeltaSeconds);\n    UpdateExhaust(DeltaSeconds);", GAME)
        self.assertIn("void UpdateExhaust(float DeltaSeconds);", HEADER)
        self.assertNotIn("rain_streak", block)

    def test_a_stopped_car_does_not_run_and_a_rolling_one_does(self):
        def running(speed, throttle, wrecked):
            return (not wrecked) and (abs(speed) > 80.0 or abs(throttle) > 0.05)
        self.assertFalse(running(0.0, 0.0, False))
        self.assertFalse(running(40.0, 0.0, False))
        self.assertTrue(running(120.0, 0.0, False))
        self.assertTrue(running(0.0, 0.2, False))
        self.assertFalse(running(400.0, 1.0, True))

    def test_the_column_leaves_the_tail_and_rises(self):
        # Car at the origin, facing +X. Age in seconds. Side index 0, 1, 2.
        def puff(age, side):
            spawn_y = 14.0 * ((side % 3) - 1)
            return (-240.0 - 160.0 * age, spawn_y, 18.0 + 180.0 * age)
        near = puff(0.0, 1)
        far = puff(1.0, 1)
        self.assertEqual(near, (-240.0, 0.0, 18.0))
        self.assertLess(far[0], near[0])
        self.assertGreater(far[2], near[2] + 150.0)
        self.assertLess(puff(0.16, 0)[1], 0.0)
        self.assertGreater(puff(0.32, 2)[1], 0.0)


if __name__ == "__main__":
    unittest.main()
