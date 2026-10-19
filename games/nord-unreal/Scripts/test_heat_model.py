"""Build and run the engine-independent wanted level and police pursuit test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("heat_model_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
outputs = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run([name, *FLAGS, "-fsyntax-only", "-DQUEBEC_HEAT_STRICT", str(SOURCE)], capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"heat_model_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} heat model test failed:\n{run.stdout}{run.stderr}"
        outputs[name] = run.stdout.strip()
        print(f"{name} ({version}): {outputs[name]}")
assert len(set(outputs.values())) == 1, f"results differ between compilers: {outputs}"
print("NORD_HEAT_MODEL_OK", len(compilers), "compilers")
