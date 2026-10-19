"""Build and run the engine-independent side-job rules test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("job_rules_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
tables = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run([name, *FLAGS, "-fsyntax-only", "-DQUEBEC_JOBS_STRICT", str(SOURCE)], capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"job_rules_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} job rules test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        tables[name] = subprocess.run([str(binary), "--table"], capture_output=True, text=True, check=True).stdout
        print(f"{name} ({version}): {run.stdout.strip().splitlines()[-1]}")
assert len(set(tables.values())) == 1, "job point table differs between compilers"
print(tables[compilers[0]].strip())
