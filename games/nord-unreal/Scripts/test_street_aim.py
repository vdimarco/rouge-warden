"""The on-foot opening look aims down the nearest avenue. The pitch and the socket stay.

This reads the source and compiles QuebecStreetLook.h. It does not run the Unreal automation test.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = (ROOT / "Source/Quebec/QuebecStreetLook.h").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
GAME_H = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
COMBAT = (ROOT / "Source/Quebec/QuebecCombat.cpp").read_text()
JOBS = (ROOT / "Source/Quebec/QuebecSideJobs.cpp").read_text()

assert "double MinWidthCm = 900." in HEADER
assert "double ReachCm = 2500." in HEADER
assert "double LeadCm = 1800." in HEADER
assert "CameraArm->SocketOffset = FVector(0., 70., 110.);" in GAME
assert "const FRotator Look(-16.f, Yaw, 0.f);" in GAME
assert "Player->FrameTheStreet(QuebecStreetLook::OpeningYaw(GetWorld(), Walker->GetActorLocation(), StartRotation.Yaw));" in GAME
assert "FrameTheStreet(Car->GetActorRotation().Yaw);" in GAME
assert "const FRotator Target(-12.f," in GAME
assert "NewController->SetControlRotation(GetActorRotation() + FRotator(-12., 0., 0.));" in GAME
assert "Player->FrameTheStreet(QuebecStreetLook::OpeningYaw(World, Spot, 0.f));" in COMBAT
assert "Player->FrameTheStreet(Yaw);" in COMBAT
assert "Player->FrameTheStreet(Facing.Yaw, true);" in JOBS
assert "QUEBEC_API float OpeningYaw(const UWorld* World, const FVector& Here, float FallbackYaw);" in GAME_H
assert "LaFontaine::RoadSegmentWidths[Index]" in GAME
assert "CollegeBathurst::RoadSegmentWidths[Index]" in GAME
assert "LaFontaineExtension::RoadSegmentWidths[Extra]" in GAME

source = ROOT / "Scripts/street_aim_test.cpp"
binary = Path("/tmp/street_aim_test")
subprocess.run(
    ["g++", "-std=c++20", "-Wall", "-Wextra", "-Werror", "-O1",
     f"-I{ROOT / 'Source/Quebec'}", str(source), "-o", str(binary), "-lm"],
    check=True,
)
result = subprocess.run([str(binary)], check=True, capture_output=True, text=True)
print(result.stdout.strip())
print("NORD_STREET_AIM_PY_OK")
