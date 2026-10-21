"""Build and run the engine-independent short-way test with every available system compiler."""
from pathlib import Path
import json
import math
import re
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("cut_test.cpp")
ROOT = SOURCE.parents[1] / "Source" / "Quebec"
START = (24000.0, 18000.0)
BEND = (26800.0, 14500.0)
FINISH = (24000.0, 11000.0)
RECOVER = (24000.0, 18900.0)
SPOTS = (START, BEND, FINISH, RECOVER)
LEGS = ((START, FINISH), (START, BEND), (BEND, FINISH))

def nearest_road(path, spot):
    text = (ROOT / path).read_text()
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

for spot in SPOTS:
    for name in ("LaFontaineMap.h", "LaFontaineExtensionMap.h"):
        gap = nearest_road(name, spot)
        assert gap > 1400, f"{spot} is {gap:.0f} cm from a road centre in {name}"

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
for origin, end in LEGS:
    shell = 1e18
    for building in manifest["buildings"]:
        for ring in building["footprints"]:
            if len(ring) < 2:
                continue
            xs = [point[0] for point in ring]
            ys = [point[1] for point in ring]
            if max(origin[0], end[0]) + 250 < min(xs) or min(origin[0], end[0]) - 250 > max(xs):
                continue
            if max(origin[1], end[1]) + 250 < min(ys) or min(origin[1], end[1]) - 250 > max(ys):
                continue
            shell = min(shell, segment_clearance(ring, origin, end))
    assert shell > 200, f"the line from {origin} to {end} is {shell:.0f} cm from a building shell"

FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_CUT_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"cut_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} cut test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")
