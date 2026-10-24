"""Build and run the engine-independent NORD mobile gauntlet model test with every available system compiler.

Scripts/gauntlet_model_test.cpp checks the Plateau loop over the real LaFontaine road set, a kinematic car at 30 and
120 Hz, the run phases, the stuck rule and the expected-CVar parser. This script then checks five things. The shared
fixture Data/Gauntlet/fixtures/frametimes_expected.json matches its CSV. The model's frame statistics match that JSON.
The numbers the model repeats match Data/Gauntlet/loop.json. The loop.json duration estimates cover the modelled runs.
The Gauntlet controller in Source/QuebecGauntletTest repeats the setup exit code and the console variable names of the
subsystem.
"""
import csv
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gauntlet_tune  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().with_name("gauntlet_model_test.cpp")
FIXTURE = ROOT / "Data/Gauntlet/fixtures/frametimes.csv"
EXPECTED = json.loads((ROOT / "Data/Gauntlet/fixtures/frametimes_expected.json").read_text())
LOOP = json.loads((ROOT / "Data/Gauntlet/loop.json").read_text())
FLAGS = ["-std=c++20", "-Wall", "-Wextra", "-Wshadow", "-Wconversion", "-Wdouble-promotion", "-Werror", "-O1"]
COUNTS = ("frames", "over_33_3ms", "over_50ms", "over_66_7ms", "over_250ms")
TIMES = ("seconds", "p50_ms", "p95_ms", "p99_ms", "max_ms")


def summary(values):
    """The fixture rule, written again here: the sorted value at ceil((n - 1) * fraction); counts are strictly over."""
    ordered = sorted(values)
    pick = lambda fraction: ordered[math.ceil((len(ordered) - 1) * fraction)]
    over = lambda limit: sum(value > limit for value in values)
    return {"frames": len(values), "seconds": round(sum(values) / 1000.0, 6), "p50_ms": pick(.5), "p95_ms": pick(.95),
            "p99_ms": pick(.99), "max_ms": ordered[-1], "over_33_3ms": over(33.3), "over_50ms": over(50.0),
            "over_66_7ms": over(66.7), "over_250ms": over(250.0)}


def fields(line):
    """The key=value pairs of one log line, as text."""
    return dict(part.split("=", 1) for part in line.split() if "=" in part)


# The fixture pair agrees with itself: the legs follow loop.json drive order, and the CSV has frames on each limit.
with FIXTURE.open(newline="") as handle:
    reader = csv.DictReader(handle)
    assert reader.fieldnames == ["frame_ms", "leg"], f"fixture columns are frame_ms and leg, not {reader.fieldnames}"
    rows = list(reader)
legs = {}
for row in rows:
    legs.setdefault(row["leg"], []).append(float(row["frame_ms"]))
order = LOOP["order"]
names = [f"{first}-{second}" for first, second in zip(order, order[1:] + order[:1])]
assert list(legs) == names == list(EXPECTED["legs"]), (list(legs), names, list(EXPECTED["legs"]))
every = [value for values in legs.values() for value in values]
assert summary(every) == EXPECTED["lap"], (summary(every), EXPECTED["lap"])
for name in names:
    assert summary(legs[name]) == EXPECTED["legs"][name], (name, summary(legs[name]), EXPECTED["legs"][name])
for limit in (33.3, 50.0, 66.7, 250.0):
    assert limit in every, f"the fixture has a frame of exactly {limit} ms, which must not count"

# The numbers the model repeats, by their loop.json path. Booleans print as 1 and 0.
wanted = {f"drive.{key}": value for key, value in LOOP["drive"].items()}
wanted.update({f"route.{key}": value for key, value in LOOP["route"].items()})
wanted.update({f"exit_codes.{key}": value for key, value in LOOP["exit_codes"].items()})
wanted.update({f"run_limits.{key}": value for key, value in LOOP["run_limits"].items()})
for mode, settings in LOOP["modes"].items():
    wanted.update({f"modes.{mode}.{key}": float(value) for key, value in settings.items()})
native = LOOP["budgets"]["native"]
wanted.update({f"budgets.native.{key}": native[key] for key in ("frame_budget_ms", "slow_frame_ms", "hitch_ms", "long_frame_ms")})
wanted["eye_fov_deg"] = LOOP["eye_fov_deg"]
cameras = {stop["label"]: stop["camera"] for stop in LOOP["stops"]}
stops = {f"stop.{index}": f"{label}:{cameras[label]}" for index, label in enumerate(order)}

compilers = [name for name in ("c++", "g++", "clang++") if shutil.which(name)]
assert compilers, "no C++ compiler found (c++, g++ or clang++)"
outputs = {}
with tempfile.TemporaryDirectory() as directory:
    for name in compilers:
        version = subprocess.run([name, "--version"], capture_output=True, text=True).stdout.splitlines()[0]
        strict = subprocess.run([name, *FLAGS, "-fsyntax-only", "-DQUEBEC_GAUNTLET_STRICT", str(SOURCE)], capture_output=True, text=True)
        assert strict.returncode == 0, f"{name} strict compile failed:\n{strict.stderr}"
        binary = Path(directory) / f"gauntlet_model_test_{name.replace('+', 'p')}"
        build = subprocess.run([name, *FLAGS, str(SOURCE), "-o", str(binary), "-lm"], capture_output=True, text=True)
        assert build.returncode == 0, f"{name} build failed:\n{build.stderr}"
        run = subprocess.run([str(binary), str(FIXTURE)], capture_output=True, text=True)
        assert run.returncode == 0, f"{name} gauntlet model test failed:\n{run.stdout}{run.stderr}"
        lines = run.stdout.strip().splitlines()
        assert lines[-1].startswith("NORD_GAUNTLET_MODEL_TEST_OK"), f"{name} did not finish:\n{run.stdout}"
        for mode in LOOP["modes"]:
            for rate in (30, 120):
                assert any(line.startswith(f"{mode} at {rate} Hz: lap") for line in lines), f"{name} skipped the {mode} lap at {rate} Hz"

        # The modelled loop sits a quarter of the range inside each loop.json length limit, so a small road-data change
        # (one more segment, the Y flip) does not fail the route gate.
        length = float(re.search(r"^Plateau loop (\d+) m", run.stdout, re.M).group(1))
        low, high = LOOP["route"]["length_min_m"], LOOP["route"]["length_max_m"]
        assert low + (high - low) / 4 <= length <= high - (high - low) / 4, f"{name}: the {length} m loop is near the {low} to {high} m limits"

        # The planning estimates cover the modelled runs: lap_estimate_s each lap, and gauntlet_tune.run_estimate_s
        # without its start-up the time from BeginPlay to done. Otherwise tune --until could overrun the GPU window.
        durations = LOOP["durations"]
        for line in lines:
            found = re.match(r"(\w+) at \d+ Hz: lap ([\d.]+) s driving, finished at ([\d.]+) s", line)
            if found:
                mode, lap, finished = found.group(1), float(found.group(2)), float(found.group(3))
                in_game = gauntlet_tune.run_estimate_s(LOOP, mode) - durations["start_estimate_s"]
                assert lap <= durations["lap_estimate_s"] <= LOOP["drive"]["max_lap_s"], f"{name}: {line} against {durations}"
                assert finished <= in_game, f"{name}: the {mode} run ends at {finished} s, after its {in_game} s estimate"

        # The model's frame statistics against the expected JSON. It prints times with 3 decimals.
        printed = {}
        for line in lines:
            if line.startswith("NORD_GAUNTLET_FIXTURE "):
                pairs = fields(line)
                printed[pairs.pop("leg", "lap")] = pairs
        assert list(printed) == ["lap", *names], f"{name} fixture lines: {list(printed)}"
        for key, pairs in printed.items():
            expected = EXPECTED["lap"] if key == "lap" else EXPECTED["legs"][key]
            assert set(pairs) == set(COUNTS + TIMES), (name, key, sorted(pairs))
            for field in COUNTS:
                assert int(pairs[field]) == expected[field], (name, key, field, pairs[field], expected[field])
            for field in TIMES:
                assert abs(float(pairs[field]) - expected[field]) <= 5e-4, (name, key, field, pairs[field], expected[field])

        # The numbers the model repeats against loop.json, and every loop.json number the model should repeat.
        constants = fields(next(line for line in lines if line.startswith("NORD_GAUNTLET_CONSTANTS ")))
        for key, value in wanted.items():
            assert key in constants, f"{name}: the model does not print {key} from loop.json"
            assert abs(float(constants[key]) - float(value)) <= 1e-9, f"{name}: {key} is {constants[key]} in the model and {value} in loop.json"
        for key, value in stops.items():
            assert constants.get(key) == value, f"{name}: {key} is {constants.get(key)} in QuebecGauntletRoute.h and {value} in loop.json"
        extra = sorted(set(constants) - set(wanted) - set(stops))
        assert not extra, f"{name}: the model prints numbers loop.json does not hold: {extra}"

        outputs[name] = run.stdout.strip()
        print(f"{name} ({version}): {lines[-1]}")
assert len(set(outputs.values())) == 1, f"results differ between compilers: {sorted(outputs)}"

# The Gauntlet controller module needs no Quebec header, so it repeats the setup exit code and the two console variable
# names of the subsystem. They must agree with loop.json and Source/Quebec/QuebecGauntlet.cpp.
CONTROLLER = (ROOT / "Source/QuebecGauntletTest/QuebecGauntletController.cpp").read_text()
SUBSYSTEM = (ROOT / "Source/Quebec/QuebecGauntlet.cpp").read_text()
assert f"constexpr int32 SetupExit = {LOOP['exit_codes']['setup']};" in CONTROLLER, "the controller's SetupExit differs from loop.json"
for variable in ("ExitVariableName", "ControllerVariableName"):
    pattern = rf'{variable} = TEXT\("([\w.]+)"\)'
    found = [re.search(pattern, text).group(1) for text in (CONTROLLER, SUBSYSTEM)]
    assert found[0] == found[1], f"{variable} is {found[0]} in the controller and {found[1]} in the subsystem"
print("\n".join(line for line in outputs[compilers[0]].splitlines() if not line.startswith("NORD_GAUNTLET_CONSTANTS")))
print("NORD_GAUNTLET_MODEL_OK", len(compilers), "compilers,", len(names), "legs,", len(wanted) + len(stops), "loop.json numbers")
