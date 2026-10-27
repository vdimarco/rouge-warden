"""Build and run the engine-independent tab test with every available system compiler."""
from pathlib import Path
import json
import math
import re
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("tab_test.cpp")
ROOT = SOURCE.parents[1] / "Source" / "Quebec"
HEADER = (ROOT / "QuebecTab.h").read_text()

def const(name):
    found = re.search(rf"inline constexpr double {name} = (-?[0-9.]+);", HEADER)
    assert found, name
    return float(found.group(1))

COUNTER = (const("CounterX"), const("CounterY"))
ROAD_A = (const("RoadAx"), const("RoadAy"))
ROAD_B = (const("RoadBx"), const("RoadBy"))
RECEIPT = (const("ReceiptX"), const("ReceiptY"))
GATE = ((ROAD_A[0] + ROAD_B[0]) * 0.5, (ROAD_A[1] + ROAD_B[1]) * 0.5)

def nearest_road(path, spot, stop):
    text = (ROOT / path).read_text()
    cut = text.find(stop)
    if cut >= 0:
        text = text[:cut]
    pattern = re.compile(
        r"\{FVector\((-?[0-9.]+),(-?[0-9.]+),[0-9.]+\),FVector\((-?[0-9.]+),(-?[0-9.]+),[0-9.]+\)\}"
    )
    best = 1e18
    for ax, ay, bx, by in pattern.findall(text):
        ax, ay, bx, by = map(float, (ax, ay, bx, by))
        dx, dy = bx - ax, by - ay
        length = dx * dx + dy * dy
        if length < 1e-6:
            gap = math.hypot(spot[0] - ax, spot[1] - ay)
        else:
            along = max(0.0, min(1.0, ((spot[0] - ax) * dx + (spot[1] - ay) * dy) / length))
            gap = math.hypot(spot[0] - (ax + along * dx), spot[1] - (ay + along * dy))
        best = min(best, gap)
    return best

def road_gap(spot):
    return min(
        nearest_road("LaFontaineMap.h", spot, "RoadSegmentWidths"),
        nearest_road("LaFontaineExtensionMap.h", spot, "RadarRoadSegments"),
    )

for spot, name in ((COUNTER, "counter"), (RECEIPT, "receipt")):
    gap = road_gap(spot)
    assert gap > 1400, f"the {name} is only {gap:.0f} cm off a road centre"
gate_gap = road_gap(GATE)
assert gate_gap < 80, f"the lane is {gate_gap:.0f} cm off its road"

def point_segment(px, py, sx, sy, ex, ey):
    dx, dy = ex - sx, ey - sy
    length = dx * dx + dy * dy
    if length < 1e-6:
        return math.hypot(px - sx, py - sy)
    along = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / length))
    return math.hypot(px - (sx + along * dx), py - (sy + along * dy))

def inside(px, py, ring):
    contained = False
    previous = len(ring) - 1
    for index, (xi, yi) in enumerate(ring):
        xj, yj = ring[previous]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / ((yj - yi) or 1e-12) + xi):
            contained = not contained
        previous = index
    return contained

def crosses(ax, ay, bx, by, cx, cy, dx, dy):
    def side(px, py, qx, qy, rx, ry):
        return (qy - py) * (rx - qx) - (qx - px) * (ry - qy)
    return side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 and side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0

def segment_clearance(ring, origin, end):
    if inside(*origin, ring) or inside(*end, ring):
        return 0.0
    best = 1e18
    count = len(ring)
    for index in range(count):
        ax, ay = ring[index]
        bx, by = ring[(index + 1) % count]
        if crosses(*origin, *end, ax, ay, bx, by):
            return 0.0
        best = min(best, point_segment(ax, ay, *origin, *end), point_segment(*origin, ax, ay, bx, by), point_segment(*end, ax, ay, bx, by))
    return best

manifest = json.loads((ROOT.parents[1] / "Data" / "CityBuildings" / "manifest.json").read_text())

def shell_between(origin, end):
    shell = 1e18
    for building in manifest["buildings"]:
        for ring in building["footprints"]:
            if len(ring) < 2:
                continue
            xs = [point[0] for point in ring]
            ys = [point[1] for point in ring]
            if max(origin[0], end[0]) + 5000 < min(xs) or min(origin[0], end[0]) - 5000 > max(xs):
                continue
            if max(origin[1], end[1]) + 5000 < min(ys) or min(origin[1], end[1]) - 5000 > max(ys):
                continue
            shell = min(shell, segment_clearance(ring, origin, end))
    return shell

for spot, name in ((COUNTER, "counter"), (RECEIPT, "receipt"), (GATE, "lane")):
    shell = shell_between(spot, (spot[0] + 180., spot[1] + 40.))
    assert 250 < shell < 4500, f"the {name} is {shell:.0f} cm from a building shell"

others = []
for path in ROOT.glob("Quebec*.h"):
    if path.name == "QuebecTab.h":
        continue
    pairs = {name: float(value) for name, value in re.findall(r"inline constexpr double (\w+)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)\s*;", path.read_text())}
    for name, value in pairs.items():
        if name.endswith("X") and name[:-1] + "Y" in pairs:
            others.append((pairs[name], pairs[name[:-1] + "Y"]))
for spot, name in ((COUNTER, "counter"), (RECEIPT, "receipt"), (GATE, "lane")):
    nearest = min(math.hypot(spot[0] - other[0], spot[1] - other[1]) for other in others)
    assert nearest > 12000, f"the {name} is only {nearest:.0f} cm from another mark"

FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_TAB_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"tab_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} tab test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")
