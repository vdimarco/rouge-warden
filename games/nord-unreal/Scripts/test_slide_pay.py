"""Build and run the engine-independent slide-pay test with every available system compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().with_name("slide_pay_test.cpp")
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run(
            [name, *FLAGS, "-fsyntax-only", "-DQUEBEC_SLIDE_PAY_STRICT", str(SOURCE)],
            capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"slide_pay_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} slide pay test failed:\n{run.stdout}{run.stderr}"
        assert run.stdout.strip().endswith("0 failures"), f"{name} printed no summary:\n{run.stdout}"
        print(f"{name} ({version}): {run.stdout.strip()}")

# The pay frame plays the notes. The lock chirp keeps its own catch.
ROOT = SOURCE.parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
pay = GAME.index("if (Slide.Tick(Step, Speed, LateralSpeed, bHandbrake, bFailsafe))")
block = GAME[pay:GAME.index("MoveWithCollision", pay)]
assert "QuebecSlide::ChainTitle(Slide.LastGrade, Slide.Chain, Title);" in block and "Player->PlaySlidePay(Slide.Chain);" in block, "the slide pay does not play the notes"
assert GAME.count("Player->PlaySlidePay(Slide.Chain);") == 1, "the slide notes play from more than one place"
assert "UFUNCTION(Client, Unreliable) void ClientPlaySlidePay(int32 Chain);" in HEADER, "the notes do not reach the driver's client"
assert "QuebecSkidTone::Caught(bLocked, bWasSkidLocked, Speed)" in GAME, "the lock chirp lost its catch"
assert "QuebecSlidePay::SampleAt(Frame, Chain)" in GAME, "the chain does not reach the notes"
print("the slide pay plays the notes once, with the chain")
