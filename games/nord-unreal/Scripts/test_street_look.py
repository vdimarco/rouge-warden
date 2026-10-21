"""The on-foot opening look tips down the street. The socket and the clamps stay.

This reads the source. It does not run the Unreal automation test.
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
COMBAT = (ROOT / "Source/Quebec/QuebecCombat.cpp").read_text()
JOBS = (ROOT / "Source/Quebec/QuebecSideJobs.cpp").read_text()

assert "CameraArm->SocketOffset = FVector(0., 70., 110.);" in GAME
assert "PlayerCameraManager->ViewPitchMin = -25.f;" in GAME
assert "PlayerCameraManager->ViewPitchMax = -5.f;" in GAME
assert "NewController->SetControlRotation(GetActorRotation() + FRotator(-12., 0., 0.));" in GAME
assert "const FRotator Target(-12.f," in GAME
assert "const FRotator Look(-16.f, Yaw, 0.f);" in GAME
assert "Player->FrameTheStreet(NewController->GetControlRotation().Yaw);" in GAME
assert "FrameTheStreet(Car->GetActorRotation().Yaw);" in GAME
assert "Player->FrameTheStreet(StartRotation.Yaw);" in GAME
assert "SetControlRotation(Car->GetActorRotation())" not in GAME
assert "Player->FrameTheStreet(Yaw);" in COMBAT
assert "Player->FrameTheStreet(0.f);" in COMBAT
assert "SetControlRotation(FRotator::ZeroRotator)" not in COMBAT
assert "Player->FrameTheStreet(Facing.Yaw, true);" in JOBS
assert "void FrameTheStreet(float Yaw, bool bResetCamera = false);" in HEADER
assert "virtual void FinishRestartPlayer(AController* NewPlayer, const FRotator& StartRotation) override;" in HEADER


def horizon_from_top(pitch):
    """Share of a 16:9, 90° frame that sits above a level horizon."""
    half_v = math.atan(math.tan(math.radians(45.0)) * (9.0 / 16.0))
    ndc = math.tan(math.radians(-pitch)) / math.tan(half_v)
    return (1.0 - ndc) / 2.0


# An unset pitch of 0 is clamped to the upward stop. The opening look is below that.
stop = horizon_from_top(-5.0)
opening = horizon_from_top(-16.0)
assert stop > 0.40, stop
assert 0.18 < opening < 0.30, opening
assert opening < stop - 0.12, (opening, stop)
print(f"horizon from top {stop:.3f} -> {opening:.3f}")
print("NORD_STREET_LOOK_OK")
