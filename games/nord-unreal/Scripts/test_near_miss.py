"""Build and run the engine-independent near-miss test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("near_miss_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_NEAR_MISS_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"near_miss_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} near miss test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")

# The player's car uses the same rule, and contact voids it.
ROOT = SOURCE.parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
DRIVE = (ROOT / "Source/Quebec/QuebecDrive.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
assert "QuebecNearMiss::FState NearMiss;" in HEADER, "the car keeps no near-miss state"
assert GAME.count("TickNearMiss(Step, GetDriverController());") == 1, "the drive step does not check near misses"
assert "NearMiss.Pass(Speed, Was, Is)" in GAME and 'TEXT("NEAR MISS")' in GAME, "the car does not use the rule"
assert "Other->PlanarVelocity()-Mine)*Step" in GAME, "the step-back offset changed"
thud = DRIVE.index("void AQuebecCar::PlayImpactThud(")
assert "NearMiss.Tick(0.f, true);" in DRIVE[thud:DRIVE.index("Due(", thud)], "contact does not void a near miss"
print("the car checks near misses each step, and contact voids them")
