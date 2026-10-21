"""The on-foot camera sits on the right shoulder and still holds the capsule in frame.

This is a port of Quebec.Camera.LookBounds. It does not run the Unreal automation test.
"""
from pathlib import Path
import math

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAMEPLAY = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
COMBAT = (ROOT / "Source/Quebec/QuebecCombat.cpp").read_text()

WALKER = "CameraArm->SocketOffset = FVector(0., 70., 55.);"
CAR = "CameraArm->SocketOffset = FVector(0., 0., 80.);"
IDLE = "const FVector CombatSocketOffset(0., 70., 55.);"
AIM = "const FVector CombatAimSocketOffset(0., 70., 62.);"
assert WALKER in GAMEPLAY, "walker socket left the right shoulder"
assert CAR in GAMEPLAY, "the car socket must stay centered"
assert IDLE in COMBAT and AIM in COMBAT, "aim must keep the same sideways offset as idle"


def axes(pitch, yaw):
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = np.array((cp * cy, cp * sy, sp))
    right = np.array((-sy, cy, 0.0))
    up = np.array((-sp * cy, -sp * sy, cp))
    return forward, right, up


def worst_frame(socket_y, socket_z=55.0, arm=420.0, fov=90.0):
    """Largest normalized head/feet coordinate across the pitches and aspects the engine test uses."""
    worst = 0.0
    for pitch in (-25.0, -6.0, -5.0):
        for yaw in (0.0, 25.0):
            forward, right, up = axes(pitch, yaw)
            cam = -arm * forward + socket_y * right + socket_z * up
            for aspect in (16.0 / 9.0, 9.0 / 20.0):
                tan_v = math.tan(math.radians(fov * 0.5)) / (16.0 / 9.0)
                for height in (-96.0, 96.0):
                    delta = np.array((0.0, 0.0, height)) - cam
                    depth = float(np.dot(delta, forward))
                    assert depth > 0.0, "capsule endpoint fell behind the camera"
                    vert = abs(float(np.dot(delta, up)) / (depth * tan_v))
                    horiz = abs(float(np.dot(delta, right)) / (depth * tan_v * aspect))
                    worst = max(worst, vert, horiz)
    return worst


centered = worst_frame(0.0)
shoulder = worst_frame(70.0)
tight = worst_frame(90.0)
assert shoulder < 0.80, f"shoulder framing crowds the portrait edge ({shoulder:.3f})"
assert centered < shoulder, "a shoulder offset must move the figure off center"
assert tight > 0.90, "the port should still reject a 90 cm shoulder as too tight"
# At rest the figure is to the left of the view, which is the open street on the right.
forward, right, up = axes(-12.0, 0.0)
cam = -420.0 * forward + 70.0 * right + 55.0 * up
side = float(np.dot(-cam, right))
assert side < -40.0, f"figure should sit left of center, got camera-right {side:.1f}"
print(f"shoulder framing worst {shoulder:.3f} (centered {centered:.3f}, 90 cm {tight:.3f})")
print("NORD_CAMERA_SHOULDER_OK")
