"""On foot, a missing crew rig rocks the body. The blend space is left alone.

This reads the source and compiles QuebecSway.h. It does not run the Unreal automation test.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = (ROOT / "Source/Quebec/QuebecSway.h").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
GAME_H = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()

assert "inline constexpr double WalkRoll = 12." in HEADER
assert "inline constexpr double IdleShare = 0.34" in HEADER
assert "inline constexpr double WalkOmega = 7.2" in HEADER
assert "inline constexpr double IdleOmega = 1.8" in HEADER
assert "CameraArm->SocketOffset = FVector(0., 70., 110.);" in GAME
assert "const FRotator Look(-16.f, Yaw, 0.f);" in GAME
assert "GetMesh()->SetRelativeRotation(FRotator(0., -90., 0.));" in GAME
assert "CasualStand->SetRelativeLocation(FVector(0., 0., -96.));" in GAME
assert "SwayPhase = static_cast<float>(QuebecSway::Advance(SwayPhase, DeltaSeconds, Speed));" in GAME
assert "const QuebecSway::FPose Sway = QuebecSway::Pose(SwayPhase, Speed);" in GAME
assert "GetMesh()->SetRelativeLocation(FVector(0., Sway.Side, -96. + Sway.Bob));" in GAME
assert "GetMesh()->SetRelativeRotation(FRotator(Sway.Pitch, Yaw, Sway.Roll));" in GAME
assert "CasualStand->SetRelativeRotation(FRotator(Sway.Pitch, 0., Sway.Roll));" in GAME
assert "Cast<UQuebecCrewAnimInstance>(GetMesh()->GetAnimInstance())" in GAME
assert "GetCharacterMovement()->IsSwimming()" in GAME
assert "GetCharacterMovement()->IsFalling()" in GAME
assert "IsKnocked()" in GAME
assert "bInVehicle" in GAME
assert "void ApplyStreetSway(float DeltaSeconds);" in GAME_H

source = ROOT / "Scripts/sway_test.cpp"
binary = Path("/tmp/sway_test")
subprocess.run(
    ["g++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-O1",
     f"-I{ROOT / 'Source/Quebec'}", str(source), "-o", str(binary), "-lm"],
    check=True,
)
result = subprocess.run([str(binary)], check=True, capture_output=True, text=True)
print(result.stdout.strip())
print("NORD_SWAY_PY_OK")
