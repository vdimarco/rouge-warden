"""The on-foot camera sits on the right shoulder and still holds the capsule in frame.

This is a port of Quebec.Camera.LookBounds. It does not run the Unreal automation test.
"""
from pathlib import Path
import math

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAMEPLAY = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
COMBAT = (ROOT / "Source/Quebec/QuebecCombat.cpp").read_text()

WALKER = "CameraArm->SocketOffset = FVector(0., 70., 110.);"
CAR = "CameraArm->SocketOffset = FVector(0., 0., 80.);"
IDLE = "const FVector CombatSocketOffset(0., 70., 110.);"
AIM = "const FVector CombatAimSocketOffset(0., 70., 117.);"
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


def worst_frame(socket_y, socket_z=110.0, arm=420.0, fov=90.0):
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
assert shoulder < 0.90, f"shoulder framing crowds the portrait edge ({shoulder:.3f})"
assert tight > 0.90, "the port should still reject a 90 cm shoulder as too tight"
# The height term now dominates the worst corner, so the shoulder is checked on its own axis.
def horizontal(socket_y):
    fwd, rt, upward = axes(-12.0, 0.0)
    cam_h = -420.0 * fwd + socket_y * rt + 110.0 * upward
    depth = float(np.dot(-cam_h, fwd))
    tan_half = math.tan(math.radians(45.0)) / (16.0 / 9.0)
    return abs(float(np.dot(-cam_h, rt)) / (depth * tan_half * (16.0 / 9.0)))

assert horizontal(70.0) > horizontal(0.0) + 0.05, "a shoulder offset must move the figure off center"
# At rest the figure is to the left of the view, which is the open street on the right.
forward, right, up = axes(-12.0, 0.0)
cam = -420.0 * forward + 70.0 * right + 110.0 * up
side = float(np.dot(-cam, right))
assert side < -40.0, f"figure should sit left of center, got camera-right {side:.1f}"
# A higher socket drops the orbit target in a 16:9 frame at the walking pitch.
tan_v = math.tan(math.radians(45.0)) / (16.0 / 9.0)

def vertical(socket_z):
    cam_z = -420.0 * forward + 70.0 * right + socket_z * up
    depth = float(np.dot(-cam_z, forward))
    return float(np.dot(-cam_z, up)) / (depth * tan_v)

assert vertical(110.0) < vertical(55.0) - 0.10, "the higher socket should drop the figure"
print(f"shoulder framing worst {shoulder:.3f} (centered {centered:.3f}, 90 cm {tight:.3f})")
print("NORD_CAMERA_SHOULDER_OK")
