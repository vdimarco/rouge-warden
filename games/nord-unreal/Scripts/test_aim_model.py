"""Build and run the engine-independent aim and combat model test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("aim_model_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
tables = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run([name, *FLAGS, "-fsyntax-only", "-DQUEBEC_AIM_STRICT", str(SOURCE)], capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"aim_model_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary), "--table"], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} aim model test failed:\n{run.stdout}{run.stderr}"
        assert "checks passed" in run.stdout, f"{name} did not report its checks"
        tables[name] = run.stdout
        print(f"{name} ({version}): {run.stdout.strip().splitlines()[-1]}")
assert len(set(tables.values())) == 1, "the weapon and pickup tables differ between compilers"
print(tables[compilers[0]].strip())
print("NORD_AIM_MODEL_OK", len(compilers), "compilers")
