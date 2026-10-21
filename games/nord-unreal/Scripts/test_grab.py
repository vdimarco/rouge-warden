"""Build and run the engine-independent grab test with every available system compiler."""
from pathlib import Path
import math
import re
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("grab_test.cpp")
ROOT = SOURCE.parents[1] / "Source" / "Quebec"
SPOTS = ((62000.0, 14000.0), (62000.0, 14900.0), (62000.0, 7000.0))

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

FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_GRAB_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"grab_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} grab test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")
