"""Build and run the engine-independent steering assist test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("steer_assist_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
outputs = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run([name, *FLAGS, "-fsyntax-only", "-DQUEBEC_STEER_STRICT", str(SOURCE)], capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"steer_assist_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} steer assist test failed:\n{run.stdout}{run.stderr}"
        # The closed-loop scenario as written: a 150 ms delay, both drivers, both tasks.
        assert "hold the street heading, delay 150 ms:" in run.stdout and "return to the lane centre, delay 150 ms:" in run.stdout, \
            f"{name} skipped the closed-loop runs"
        outputs[name] = run.stdout
        print(f"{name} ({version}): {run.stdout.strip().splitlines()[-1]}")
summaries = {name: [line for line in text.splitlines() if "heading swings over all speeds" in line] for name, text in outputs.items()}
assert len({tuple(lines) for lines in summaries.values()}) == 1, f"closed-loop results differ between compilers: {summaries}"
print(outputs[compilers[0]].strip())
print("NORD_STEER_ASSIST_OK", len(compilers), "compilers")
