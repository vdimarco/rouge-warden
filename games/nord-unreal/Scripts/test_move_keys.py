"""Prove the arrow keys walk and drive on the same axes as WASD, and are not also actions."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
INI = (ROOT / "Config" / "DefaultInput.ini").read_text()
HUD = (ROOT / "Source" / "Quebec" / "QuebecGameplay.cpp").read_text()
PAGE = (ROOT / "Browser" / "index.html").read_text()

actions = re.findall(r'\+ActionMappings=\(ActionName="([^"]+)".*?Key=([^,\)]+)', INI)
axes = re.findall(r'\+AxisMappings=\(AxisName="([^"]+)",Scale=(-?\d+\.\d+),Key=([^,\)]+)', INI)
assert actions and axes, "the input file has no mappings"

scale = {(name, key): float(value) for name, value, key in axes}
arrows = ("Up", "Down", "Left", "Right")

assert scale[("MoveForward", "W")] == 1.0
assert scale[("MoveForward", "S")] == -1.0
assert scale[("MoveForward", "Up")] == 1.0, "Up does not walk forward"
assert scale[("MoveForward", "Down")] == -1.0, "Down does not walk back"
assert scale[("MoveRight", "D")] == 1.0
assert scale[("MoveRight", "A")] == -1.0
assert scale[("MoveRight", "Right")] == 1.0, "Right does not strafe right"
assert scale[("MoveRight", "Left")] == -1.0, "Left does not strafe left"

arrow_uses = [key for _name, _scale, key in axes if key in arrows]
assert arrow_uses == ["Up", "Down", "Right", "Left"], arrow_uses
assert not any(key in arrows for _name, key in actions), "an arrow key is also an action"

graded = {
    "NumPadOne": -0.33,
    "NumPadTwo": -0.66,
    "NumPadFour": 0.33,
    "NumPadFive": 0.66,
}
for key, expected in graded.items():
    uses = [(name, value) for name, value, mapped in axes if mapped == key]
    assert uses == [("MoveRight", f"{expected:.6f}")], uses

walk = {
    ("MoveForward", "NumPadEight"): 0.33,
    ("MoveForward", "NumPadNine"): 0.66,
    ("MoveForward", "NumPadThree"): -0.33,
    ("MoveForward", "NumPadSix"): -0.66,
    ("MoveRight", "NumPadSeven"): -0.33,
    ("MoveRight", "NumPadZero"): -0.66,
    ("MoveRight", "Multiply"): 0.33,
    ("MoveRight", "Add"): 0.66,
}
for (name, key), expected in walk.items():
    assert abs(scale[(name, key)] - expected) < 1e-6, (name, key)
    uses = [(axis, value) for axis, value, mapped in axes if mapped == key]
    assert len(uses) == 1, uses
assert scale[("MoveForward", "W")] == 1.0 and scale[("MoveRight", "D")] == 1.0

assert "WASD or arrows  Drive / steer" in HUD
assert "WASD</b> or arrows Move / drive" in PAGE
print(f"{len(axes)} axis mappings, arrows match WASD, 0 failures")
