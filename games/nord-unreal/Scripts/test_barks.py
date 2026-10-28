"""Build and run the engine-independent mission-bark test with every available system compiler.

Also checks the spoken words still match the resident dialogue in QuebecGameplay.cpp.
"""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("bark_test.cpp")
HEADER = Path(__file__).resolve().parents[1] / "Source" / "Quebec" / "QuebecBarks.h"
GAMEPLAY = Path(__file__).resolve().parents[1] / "Source" / "Quebec" / "QuebecGameplay.cpp"
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]

header_lines = re.findall(r'"([^"]+)"', HEADER.read_text().split("inline const char* Line", 1)[1].split("};", 1)[0])
dialogue = GAMEPLAY.read_text().split("AQuebecParkResident::DialogueForStyle", 1)[1].split("return Lines", 1)[0]
resident_lines = re.findall(r'TEXT\("([^"]*)"\)', dialogue)
assert header_lines == resident_lines, f"bark lines diverged:\n{header_lines}\n{resident_lines}"

compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_BARKS_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"bark_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} bark test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")
