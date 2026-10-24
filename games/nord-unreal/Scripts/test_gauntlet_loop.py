"""Offline checks for Scripts/gauntlet_loop.py with a fake RunUAT, a fake packaged game, a fake nvidia-smi and a fake
stream sampler (no Unreal, no GPU, no browser).

Run from games/nord-unreal:  python3 Scripts/test_gauntlet_loop.py
Checks both command lines (direct and RunUnreal), the run folder layout, the sky and label refusals, the contention
label, the CVar readback with the fixed CVars, the phone profile flag, a look run scored against a ceiling, a short
tune with its native confirmation and round report, a partial look run that gives no Look, a stale --reference or one
without every still or with a contended ceiling run refused, a tune whose first candidate plan holds the ceiling
render, a slow host found from its slowest clean run (not a hung one), a stream lap with its trigger file, lap window
and page clock and the host's result line after the sampler stopped, a stream lost inside the lap failed in a solo
or input row while the host drove on, unverified in a relay row and after a host crash, a whole two-viewer or relay
row report-only, a two-viewer row unverified when a slot decoded nothing or without nvidia-smi listings and failed at
another size or with a size change, a failed drive that fails a two-viewer row and leaves a relay row unverified, the
input row (unverified without drags through the whole lap), one stream command per run, on NordHost only and at a rung
with a size (also on the command line), the co-op guard without contended two-viewer rows and with each row paired
with the baseline's from its window at its rung and orientation (a failed pair lasts, and an unverified baseline row
does not reach back to an earlier window), a failed two-viewer drive that drops the candidate,
the input row needed by a ranked candidate, only the newest solo stream row per rung and orientation in the round
report while a failed row stays a failure, no runner-up confirmed while a better ranked candidate has only missing
evidence, the next candidate's confirmation, confirmation runs that end before --until (planned with the longest run so
far and with the search's slower host), a cut, twice contended or twice unverified confirmation run again and
unverified in the round report until then unless it holds a failed run, a contended or unverified run run once more, a
ranked baseline confirmed once and named as confirm_native names it, and not run first once the round dropped it, a
baseline confirmed only when it is ranked, and first only when it is ranked above the candidate, confirm's stop reason
kept current, the
write-profile refusal without --approved, and that browser_streaming.py without NORD_STREAM_QUALITY keeps today's
exact launch line.
The fake game quits only after the fake nvidia-smi listed it twice, so the VRAM and contention checks do not depend
on how fast a loaded machine samples.
Everything is written to a temporary folder; the real Saved/Gauntlet and Config/DefaultDeviceProfiles.ini are never
written.
"""
import contextlib
import copy
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_streaming  # noqa: E402
import gauntlet_loop as L  # noqa: E402
import gauntlet_tune as T  # noqa: E402

LOOP = L.M.load_loop()
PINNED = "-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather"

# The packaged game and the NordMobileLoop node in one fake: it reads the gauntlet flags (or the -test= params), reads
# the expected CVars back, and writes what Source/Quebec/QuebecGauntlet.cpp writes: the NORD_GAUNTLET lines, a CSV
# profiler file with leg events in native/, the stills of a look run and native/route.json. Under the RunUnreal role the
# CSV lands outside the run folder, so the runner's copy from the "csv=" log line is checked too.
FAKE_GAME = r'''
import atexit, json, math, os, re, sys, time, zlib
from pathlib import Path
import numpy as np
from PIL import Image

role, args = sys.argv[1], sys.argv[2:]
state = Path(os.environ["FAKE_STATE"])
with (state / "pids").open("a") as handle:
    handle.write(f"{os.getpid()}\n")
if role == "idle":
    time.sleep(60)
    sys.exit(0)

def listed_twice():
    """Quit only once the fake nvidia-smi listed this game in two process tables. The runner reads its own processes
    between two tables, so it counts this game as its own and has its VRAM in a sample, however slow a loaded machine
    makes the sampler (a fixed run time could end before the first sample)."""
    deadline = time.time() + 60
    while time.time() < deadline:
        listed = (state / "listed").read_text().split() if (state / "listed").exists() else []
        if listed.count(str(os.getpid())) >= 2:
            return
        time.sleep(.02)

atexit.register(listed_twice)
loop = json.loads(Path(os.environ["FAKE_LOOP"]).read_text())
if role == "uat":
    test = next(a for a in args if a.startswith("-test="))
    found = re.fullmatch(r"-test=NordMobileLoop\((.*)\)", test)
    params = {key: value.strip("'") for key, value in re.findall(r"(\w+)=('[^']*'|[^,]*)", found.group(1))}
    run, mode, laps = Path(params["run"]), params["mode"], int(params["laps"])
    width, height = map(int, params["size"].split("x"))
    sky = loop["skies"][params["sky"].replace("-", "_")]["args"]
    expect = Path(params["expect"])
    execcmds = Path(params["execcmds"]).read_text() if "execcmds" in params else ""
    log, csv_dir = run / "native/game.log", run / "native"
else:
    flag = lambda name: next((a.split("=", 1)[1] for a in args if a.startswith(name + "=")), None)
    run, mode, laps = Path(flag("-NordGauntletRun")), flag("-NordGauntletMode"), int(flag("-NordGauntletLaps"))
    width, height = int(flag("-ResX")), int(flag("-ResY"))
    sky = [a for a in args if a.startswith(("-NordHour=", "-NordWeather="))]
    expect, execcmds = Path(flag("-NordGauntletExpect")), flag("-ExecCmds") or ""
    log, csv_dir = Path(flag("-abslog")), Path(os.environ["FAKE_CSV_DIR"])
(run / "fake-argv.json").write_text(json.dumps({"role": role, "argv": args}))
lines = []
say = lambda text: lines.append("[2026.10.23-22.00.00:000][  0]LogTemp: Display: " + text)
order = loop["order"]
legs = [f"{order[n]}-{order[(n + 1) % len(order)]}" for n in range(len(order))]
say(f"NORD_GAUNTLET begin mode={mode} laps={laps} run={run}")
if not (any(a.startswith("-NordHour=") for a in sky) and any(a.startswith("-NordWeather=") for a in sky)):
    say("NORD_GAUNTLET error=no_sky (pass -NordHour= and -NordWeather=, or the run measures no sky)")
    say("NORD_GAUNTLET result exit=3 reason=no_sky mode=perf laps=1 max_offset_m=0.000")
    log.write_text("\n".join(lines) + "\n")
    sys.exit(3)
for n, leg in enumerate(legs):
    say(f"NORD_GAUNTLET route stop={order[n]} x_m={360 - n * 100:.2f} y_m={62 + n * 50:.2f} along_m={n * 700:.1f} leg={leg} leg_m=700.0")
mismatch = os.environ.get("FAKE_MISMATCH")
checked = 0
for row in expect.read_text().splitlines():
    if row and not row.startswith("#"):
        name, _, value = row.partition("=")
        checked += 1
        actual = "50" if name == mismatch else value + ".000000"
        say(f"NORD_GAUNTLET cvar name={name} expected={value} actual={actual} match={int(name != mismatch)}")
say(f"NORD_GAUNTLET cvars checked={checked} mismatches={int(bool(mismatch))} file={expect}")
time.sleep(float(os.environ.get("FAKE_RUN_S", ".35")))
if mismatch:
    say("NORD_GAUNTLET fail exit=4 reason=cvar_mismatch lap=0 leg=0 along_m=0.0 x_m=360.00 y_m=62.00 reversals=0")
    say("NORD_GAUNTLET result exit=4 reason=cvar_mismatch mode=perf laps=1 max_offset_m=0.000")
    log.write_text("\n".join(lines) + "\n")
    sys.exit(4)
cvars = dict(pair.split(" ") for pair in execcmds.split(",") if pair)
total = sum(int(value) for name, value in cvars.items() if name.startswith("sg."))
load = .3 * (total - 15) + .05 * (float(cvars.get("r.ScreenPercentage", 75)) - 75)
sky_name = "night_rain" if "-NordWeather=Rain" in sky else "day"
if mode == "perf":
    rows = ["FrameTime,GameThreadTime,RenderThreadTime,RHIThreadTime,GPUTime,EVENTS"]
    row = lambda ms, event="": rows.append(f"{ms:.3f},{ms * .5:.3f},{ms * .6:.3f},{ms * .4:.3f},{ms - 4:.3f},{event}")
    for index in range(30):
        row(40.0, "NordGauntlet/warm lap" if index == 0 else "")
    measured = []
    for lap in range(1, laps + 1):
        for leg_index, leg in enumerate(legs):
            for index in range(60):
                ms = 18 + load + leg_index * .3 + (index % 5) * .4
                measured.append(ms)
                row(ms, f"NordGauntlet/leg={leg} lap={lap}" if index == 0 else "")
    row(90.0, "NordGauntlet/done")
    row(91.0)
    rows += [rows[0], "[platform],Linux,[cpu],fake,[gpu],NVIDIA GeForce RTX 4090,[gpudriver],610.57,[engineversion],5.8.3,"
                      "[shaderplatform],VULKAN_SM6"]
    for lap in range(1 + laps):
        if lap == 0:
            say("NORD_GAUNTLET lap=0 warm=begin")
        for leg_index, leg in enumerate(legs):
            say(f"NORD_GAUNTLET leg={leg} lap={lap} begin")
            say(f"NORD_GAUNTLET stop={order[(leg_index + 1) % len(order)]} lap={lap} pass")
    say(f"NORD_GAUNTLET done laps={laps}")
    csv_path = (run / "native" if role == "direct" else csv_dir) / f"NordGauntlet-{mode}-{sky_name}.csv"
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.write_text("\n".join(rows) + "\n")
    say(f"NORD_GAUNTLET csv={csv_path}")
    ordered = sorted(measured)
    pick = lambda f: ordered[math.ceil((len(ordered) - 1) * f)]
    say(f"NORD_GAUNTLET summary leg=all lap=all mode={mode} frames={len(measured)} seconds={sum(measured) / 1000:.3f} p50_ms={pick(.5):.3f} "
        f"p95_ms={pick(.95):.3f} p99_ms={pick(.99):.3f} max_ms={ordered[-1]:.3f} over_33_3ms=0 over_50ms=0 over_66_7ms=0 over_250ms=0")
    say(f"NORD_GAUNTLET summary leg={legs[0]} lap=all frames=60 seconds=1.200 p50_ms=1.000 p95_ms=99.000 p99_ms=99.000 max_ms=99.000 "
        "over_33_3ms=9 over_50ms=9 over_66_7ms=9 over_250ms=0")
else:
    sigma = max(0.0, .15 * (30 - total))
    y, x = np.mgrid[0:height, 0:width]
    # FAKE_LOOK_STUCK_AFTER=n: the car is stuck after n stops (exit 2). FAKE_LOOK_SKIP_SKY: that sky's stills never land,
    # and the run still exits 0, as when a sky switch fails without an error line.
    stuck_after, skip = int(os.environ.get("FAKE_LOOK_STUCK_AFTER", "0")), os.environ.get("FAKE_LOOK_SKIP_SKY")
    for shown in loop["sky_order"]:
        say(f"NORD_GAUNTLET sky={shown} hour=15.0 weather=Clear")
        for number, label in enumerate(order):
            if stuck_after and number == stuck_after:
                say(f"NORD_GAUNTLET fail exit=2 reason=stuck lap=1 leg={number} along_m=700.0 x_m=0.00 y_m=0.00 reversals=0")
                say("NORD_GAUNTLET result exit=2 reason=stuck mode=look laps=1 max_offset_m=0.000")
                log.write_text("\n".join(lines) + "\n")
                sys.exit(2)
            say(f"NORD_GAUNTLET stop={label} lap=1 hold=begin hold_s=24.0")
            for view in loop["views"]["per_stop"] if shown != skip else []:
                seed = zlib.crc32(f"{shown}{label}{view}".encode())
                base = 128 + 40 * np.sin(x / 40 + seed % 7) * np.cos(y / 30 + seed % 5)
                image = np.clip(base + np.random.default_rng(seed).normal(0, 1, base.shape) * sigma, 0, 255).astype(np.uint8)
                path = run / loop["names"]["still"].format(sky=shown, label=label, view=view, width=width, height=height)
                path.parent.mkdir(parents=True, exist_ok=True)
                Image.fromarray(np.stack([image] * 3, -1)).save(path)
                say(f"NORD_GAUNTLET still stop={label} view={view} sky={shown} file={path}")
    say("NORD_GAUNTLET done laps=1")
(run / "native").mkdir(exist_ok=True)
stops = [{"label": label, "x_m": 360.0 - n * 100, "y_m": 62.0 + n * 50, "yaw_deg": 0.0, "along_m": n * 700.0, "leg_m": 700.0}
         for n, label in enumerate(order)]
(run / "native/route.json").write_text(json.dumps({"version": 1, "mode": mode, "exit": 0, "exit_name": "done", "loop_length_m": 3475.0,
                                                   "max_offset_m": 1.2, "max_measured_offset_m": 1.0, "reversals": 0, "stops": stops,
                                                   "samples": [{"t": 0.0, "x_m": 360.5, "y_m": 62.5, "offset_m": .3},
                                                               {"t": 0.1, "x_m": 362.0, "y_m": 64.0, "offset_m": .2}]}))
say(f"NORD_GAUNTLET route={run / 'native/route.json'} samples=2 max_offset_m=1.200")
say(f"NORD_GAUNTLET result exit=0 reason=done mode={mode} laps={laps} max_offset_m=1.200")
log.write_text("\n".join(lines) + "\n")
sys.exit(int(os.environ.get("FAKE_EXIT", "0")))
'''

# nvidia-smi: the plain process table lists the live fake games (as Quebec), any foreign process from foreign.json and
# Xorg, and notes the games it listed in listed; the compute query lists nothing, as on a Vulkan-only host; pmon prints
# two samples of the games.
FAKE_SMI = r'''
import json, os, sys, time
from pathlib import Path
state = Path(os.environ["FAKE_STATE"])
args = sys.argv[1:]

def game(pid):
    try:
        return "game.py" in Path(f"/proc/{pid}/cmdline").read_bytes().decode(errors="replace")
    except OSError:
        return False

def games():
    pids = [int(p) for p in (state / "pids").read_text().split()] if (state / "pids").exists() else []
    return sorted({pid for pid in pids if game(pid)})

own = games()
foreign = json.loads((state / "foreign.json").read_text()) if (state / "foreign.json").exists() else []
rows = [(pid, "/home/von/rouge-warden/games/nord-unreal/Builds/Browser/Linux/Quebec/Binaries/Linux/Quebec", 4100) for pid in own]
rows += [(row["pid"], row["name"], row["mib"]) for row in foreign] + [(2172, "/usr/lib/xorg/Xorg", 4)]
if not args:
    # Each table names the games it listed, so a game waits for two tables before it quits (FAKE_GAME listed_twice).
    with (state / "listed").open("a") as handle:
        handle.write("".join(f"{pid}\n" for pid in own))
    print("| Processes:                                                                              |")
    print("|  GPU   GI   CI              PID   Type   Process name                        GPU Memory |")
    print("|=========================================================================================|")
    for pid, name, mib in rows:
        print(f"|    0   N/A  N/A    {pid:>10}      G   {name:<40} {mib:>6}MiB |")
elif args[0].startswith("--query-compute-apps"):
    pass
elif any(a.startswith("--query-gpu=utilization") for a in args):
    print("35, 5000, 24564, 19000")
elif any(a.startswith("--query-gpu=name") for a in args):
    print("NVIDIA GeForce RTX 4090, 610.57, 24564")
elif args[0] == "pmon":
    print("# gpu         pid   type     sm    mem    enc    dec     fb   command")
    print("# Idx           #    C/G      %      %      %      %     MB   name")
    for step in range(100):  # until the runner stops it, as the real pmon -d 1 runs
        for pid in games():
            print(f"    0  {pid:>10}     G     {40 + step % 2 * 10}     20      -      -   4100   Quebec", flush=True)
        time.sleep(.05)
'''

# stream-sample.mjs: it plays the host's part too (the NORD_GAUNTLET lines go to the host log, NordFriend1's
# NORD_STREAM_FPS lines to the friend log), waits for each stop in the trigger file before it saves that stop's shots,
# and decodes 30 frames per second with one 600 ms stall before the lap. It writes sample.json and frames.json in the
# sampler's own layout: shots/<NN>-<line>-video.png and -page.png listed in sample.json, the size, latency and QP
# events, the page's performance.timeOrigin, and frames with performance.now() times. After the done line it samples
# until the runner writes END to the trigger file, as the sampler stops before the host quits. The host's CSV file,
# native/route.json and its summary and result lines come FAKE_RESULT_S (2 s) after the sampler quit, as the host
# waits for its CSV file first (QuebecGauntlet.cpp Complete).
FAKE_SAMPLER = r'''
import json, os, sys, time
from pathlib import Path
import numpy as np
from PIL import Image

args = sys.argv[1:]
value = lambda name: args[args.index(name) + 1] if name in args else None
out = Path(value("--out"))
out.mkdir(parents=True, exist_ok=True)
(out / "sampler-argv.json").write_text(json.dumps(args))
trigger, host_log, friend_log = Path(value("--trigger")), Path(os.environ["FAKE_HOST_LOG"]), Path(os.environ["FAKE_FRIEND_LOG"])
loop = json.loads(Path(os.environ["FAKE_LOOP"]).read_text())
width, height = next(e["size"] for e in loop["sizes"].values()
                     if e["rung"] == int(value("--pin")) and (e["size"][1] > e["size"][0]) == ("--portrait" in args))
start = time.time() * 1000
origin = start - 1000.0  # performance.timeOrigin: the page loaded a second before the measurement
samples, shots, frames, shown = [], [], [], [start]
# The QP of 40 comes before the lap, so only the lap's 20 counts.
events = [{"timeMs": start, "kind": "received", "width": width, "height": height}, {"timeMs": start, "kind": "qp", "avgQP": 40}]

def tick(seconds):
    end = time.time() + seconds
    while time.time() < end:
        now = time.time() * 1000
        while shown[0] + 1000 / 30 <= now:
            shown[0] += 1000 / 30
            frames.append({"presentedFrames": len(frames), "expectedDisplayTime": shown[0] - origin, "mediaTime": len(frames) / 30,
                           "width": width, "height": height})
        decoded = len(frames)
        samples.append({"timeMs": now, "framesDecoded": decoded, "framesReceived": decoded, "framesDropped": 0,
                        "bytesReceived": decoded * 20000, "freezeCount": 0, "totalFreezesDuration": 0, "totalDecodeTime": decoded * .004,
                        "jitterBufferDelay": decoded * .05, "jitterBufferEmittedCount": decoded, "packetsLost": 0,
                        "roundTripTime": .002, "jitter": .001, "totalProcessingDelay": decoded * .03, "jitterBufferTargetDelay": decoded * .04,
                        "width": width, "height": height, "requested": f"{width}x{height}", "candidate": {"type": "host"}, "codec": "video/VP8"})
        time.sleep(.05)

def stall(seconds):
    time.sleep(seconds)
    shown[0] = time.time() * 1000

def say(text, log=None):
    if value("--slot") == "NordHost":
        with (log or host_log).open("a") as handle:
            handle.write("[2026.10.23-23.00.00:000][  0]LogQuebec: Display: " + text + "\n")

tick(.2)
order = loop["order"]
for n, label in enumerate(order):
    say(f"NORD_GAUNTLET route stop={label} x_m=0.00 y_m=0.00 along_m={n * 700:.1f} leg={label}-{order[(n + 1) % len(order)]} leg_m=700.0")
for row in Path(os.environ["FAKE_EXPECT"]).read_text().splitlines():
    if row and not row.startswith("#"):
        name, want = row.split("=", 1)
        say(f"NORD_GAUNTLET cvar name={name} expected={want} actual={want} match=1")
# Before the lap NordFriend1 is still awake, and the first keyframe after the resize stalls the decoder for 600 ms.
say("NORD_STREAM_FPS frames=150 seconds=5.00 sleeping=0 streamer=NordFriend1", friend_log)
tick(.1)
stall(.6)
tick(.3)
say(f"NORD_GAUNTLET leg={order[0]}-{order[1]} lap=1 begin")
tick(.3)
for label in order[1:] + order[:1]:
    say(f"NORD_GAUNTLET stop={label} lap=1 hold=begin hold_s=4.0")
    say("NORD_STREAM_FPS frames=150 seconds=5.00 sleeping=0 streamer=NordHost")
    say("NORD_STREAM_FPS frames=5 seconds=5.00 sleeping=1 streamer=NordFriend1", friend_log)
    events += [{"timeMs": time.time() * 1000, "kind": "latency", "averageE2ELatency": 40.0},
               {"timeMs": time.time() * 1000, "kind": "qp", "avgQP": 20}]
    deadline = time.time() + 4
    while label not in trigger.read_text().split() and time.time() < deadline:
        tick(.05)
    if label in trigger.read_text().split():
        (out / "shots").mkdir(exist_ok=True)
        name = f"{len(shots) + 1:02d}-{label}"
        Image.fromarray(np.full((height, width, 3), 90, np.uint8)).save(out / "shots" / f"{name}-video.png")
        Image.fromarray(np.full((390, 844, 3), 30, np.uint8)).save(out / "shots" / f"{name}-page.png")
        shots.append({"line": label, "timeMs": time.time() * 1000, "video": f"shots/{name}-video.png", "page": f"shots/{name}-page.png",
                      "width": width, "height": height})
    tick(.15)
    if label != order[0]:
        say(f"NORD_GAUNTLET leg={label}-{order[(order.index(label) + 1) % len(order)]} lap=1 begin")
say("NORD_GAUNTLET done laps=1")
deadline = time.time() + 4
while "END" not in trigger.read_text().split() and time.time() < deadline:
    tick(.05)
(out / "frames.json").write_text(json.dumps(frames))
(out / "sample.json").write_text(json.dumps({"slot": value("--slot"), "cameraSweep": "--look" in args, "timeOrigin": origin,
                                             "samples": samples, "events": events, "shots": shots,
                                             "summary": {"decodedFps": 30.0, "jitterBufferMsPerFrame": 50.0, "decodeMsPerFrame": 4.0,
                                                         "delay": {"rttMs": {"mean": 2.1, "max": 3.0}, "jitterMs": {"mean": 1.0, "max": 2.0},
                                                                   "frontend": {"events": 3, "averageE2ELatency": 38.0}},
                                                         "encoderQp": {"events": 6, "mean": 23.3, "max": 40}}}))
if value("--slot") == "NordHost" and os.fork() == 0:
    time.sleep(float(os.environ.get("FAKE_RESULT_S", "2")))
    native = Path(os.environ["FAKE_EXPECT"]).parent / "native"
    native.mkdir(exist_ok=True)
    rows = ["FrameTime,GameThreadTime,RenderThreadTime,RHIThreadTime,GPUTime,EVENTS"]
    for n, label in enumerate(order):
        event = f"NordGauntlet leg={label}-{order[(n + 1) % len(order)]} lap=1"
        rows += [f"{16.7 + k % 3 * .1:.3f},8.000,9.000,6.000,{12 + n:.3f},{event if k == 0 else ''}" for k in range(30)]
    rows += ["16.7,8,9,6,12,", "16.7,8,9,6,12,"]
    (native / "NordGauntlet-stream-night_rain.csv").write_text("\n".join(rows) + "\n")
    stops = [{"label": label, "x_m": 0.0, "y_m": 0.0, "along_m": n * 700.0, "leg_m": 700.0} for n, label in enumerate(order)]
    (native / "route.json").write_text(json.dumps({"version": 1, "mode": "stream", "exit": 0, "exit_name": "done", "loop_length_m": 3475.0,
                                                   "max_offset_m": 0.9, "stops": stops, "samples": [{"t": 0.0, "x_m": 0.2, "y_m": 0.1, "offset_m": .2}]}))
    say("NORD_GAUNTLET summary leg=S1-S2 lap=all frames=30 p95_ms=16.900")
    say("NORD_GAUNTLET result exit=0 reason=done mode=stream laps=1 max_offset_m=0.900")
    os._exit(0)
'''


def small_loop():
    """loop.json with stills small enough for a quick test and a short search."""
    loop = copy.deepcopy(LOOP)
    for entry, size in zip(loop["sizes"].values(), ([96, 48], [48, 96], [80, 40], [40, 80])):
        assert (entry["size"][0] > entry["size"][1]) == (size[0] > size[1])
        entry["size"] = size
    loop["search"]["max_candidates"] = 6
    return loop


SMALL = small_loop()


def gates(verdict):
    return {gate["name"]: gate for gate in verdict["gates"]}


def failing(verdict):
    return {gate["name"]: (gate["value"], gate["result"]) for gate in verdict["gates"] if gate["result"] != "pass"}


def check_default_line():
    """NORD_STREAM_QUALITY unset or current: today's exact launch line, written out here on its own."""
    quality = ("sg.ViewDistanceQuality 2,sg.AntiAliasingQuality 2,sg.ShadowQuality 2,sg.GlobalIlluminationQuality 2,sg.ReflectionQuality 2,"
               "sg.PostProcessQuality 2,sg.TextureQuality 2,sg.EffectsQuality 2,sg.FoliageQuality 2,sg.GlobalIlluminationQuality 1,"
               "sg.ReflectionQuality 1,sg.ShadowQuality 1,r.Shadow.Virtual.Enable 0,r.ScreenPercentage 75,t.MaxFPS 60,"
               "MediaIO.EnableExperimentalScheduling 0")
    stream = ["-RenderOffscreen", "-ForceRes", "-ResX=1280", "-ResY=720", "-AudioMixer", "-Unattended", "-NoDebugExecBindings",
              "-PixelStreamingConnectionURL=ws://127.0.0.1:8888", "-PixelStreamingEncoderCodec=VP8", "-PixelStreamingWebRTCFps=60",
              "-PixelStreamingWebRTCMaxBitrate=12000000", "-PixelStreamingWebRTCMinBitrate=100000",
              "-PixelStreamingWebRTCStartBitrate=2000000", "-PixelStreamingKeyFilter=Tilde"]
    binary = str(browser_streaming.PROJECT / "Builds/Browser/Linux/Quebec/Binaries/Linux/Quebec")
    host = [binary, "Quebec", "/Game/Maps/LaFontaine?listen", *stream, "-PixelStreamingID=NordHost", "-ExecCmds=" + quality,
            "-abslog=host.log", "-NordStreamFps", "-NordTouchControls", "-NordIdleThrottle", "-port=7791", "-NordHour=15", "-NordFreezeTime"]
    friend = [binary, "Quebec", "127.0.0.1:7791", *stream, "-PixelStreamingID=NordFriend1", "-ExecCmds=" + quality,
              "-abslog=friend.log", "-NordStreamFps", "-NordTouchControls", "-NordIdleThrottle", "-NordNoCampaignSave",
              "-saveddirsuffix=BrowserGuest"]
    for environment in ({}, {"NORD_STREAM_QUALITY": "current"}):
        with patch.dict(os.environ, environment, clear=True):
            assert browser_streaming.game_command(False, Path("host.log")) == host, environment
            assert browser_streaming.game_command(True, Path("friend.log")) == friend, environment
    print("default line ok: no NORD_STREAM_QUALITY (and current) keeps both players' launch lines byte for byte")


def check_refusals(out, state):
    before, pids = sorted(out.iterdir()), (state / "pids").read_text() if (state / "pids").exists() else ""
    unpinned = copy.deepcopy(SMALL)
    unpinned["skies"]["night_rain"]["args"] = ["-NordHour=22", "-NordFreezeTime", "-NordFreezeWeather"]
    for loop, arguments, text in ((unpinned, {}, "pinned sky"), (SMALL, {"label": "bad label"}, "label"),
                                  (SMALL, {"quality": "file:/etc/passwd"}, "NORD_STREAM_QUALITY"), (SMALL, {"laps": 0}, "--laps")):
        try:
            L.native_run(loop, "perf", "top_landscape", "night-rain", direct=True, **arguments)
        except RuntimeError as error:
            assert text in str(error), (text, error)
        else:
            raise AssertionError("must be refused: " + text)
    assert sorted(out.iterdir()) == before, "a refused run leaves no folder"
    assert ((state / "pids").read_text() if (state / "pids").exists() else "") == pids, "a refused run launches nothing"
    with patch.dict(os.environ, {"NORD_STREAM_GAUNTLET": str(out / "run"), "NORD_SKY_ARGS": "-NordHour=22 -NordFreezeTime"}, clear=True):
        try:
            browser_streaming.game_command(False, Path("host.log"))
        except RuntimeError as error:
            assert "NORD_STREAM_GAUNTLET" in str(error) and "-NordWeather=" in str(error)
        else:
            raise AssertionError("the launcher must refuse NORD_STREAM_GAUNTLET without a pinned weather")
    print("refusals ok: unpinned sky, label, quality path and laps launch nothing; the launcher refuses an unpinned gauntlet")


def check_direct_perf(out, package):
    run, verdict = L.native_run(SMALL, "perf", "top_landscape", "night-rain", label="direct-perf", direct=True)
    assert run.parent == out and re.fullmatch(r"\d{8}T\d{6}Z-direct-perf", run.name), run
    for name in ("run.json", "quality.expect", "quality.execcmds", "native/game.log", "native/stdout.log", "native/gpu.json",
                 "native/pmon.log", "native/legs.json", "native/route.json", "verdict.json", "review.html"):
        assert (run / name).is_file(), name
    assert [path.name for path in (run / "native").glob("*.csv")] == ["NordGauntlet-perf-night_rain.csv"]
    meta = json.loads((run / "run.json").read_text())
    command = meta["command"]
    assert command[:3] == ["bash", str(package / "Quebec.sh"), "/Game/Maps/LaFontaine"] and command[-1] == f"-abslog={run}/native/game.log"
    for flag in ("-RenderOffscreen", "-windowed", "-ForceRes", "-ResX=96", "-ResY=48", "-unattended", "-nosound", "-csvGpuStats",
                 "-csvCompression=0", "-ExecCmds=" + browser_streaming.QUALITY, "-NordGauntlet", "-NordGauntletMode=perf",
                 f"-NordGauntletRun={run}", "-NordGauntletLaps=1", f"-NordGauntletExpect={run}/quality.expect", *PINNED.split(),
                 "-NordNoPolice", "-NordNoCampaign", "-NordNoSideJobs", "-NordNoCampaignSave"):
        assert flag in command, flag
    assert "-NordNoAmbient" not in command and json.loads((run / "fake-argv.json").read_text())["argv"] == command[2:]
    assert meta["exit"] == {"code": 0, "name": "done", "source": "log", "process": 0, "timed_out": False}, meta["exit"]
    assert meta["readback"]["t.MaxFPS"] == "60.000000" and meta["hardware"]["gpu"] == "NVIDIA GeForce RTX 4090"
    assert meta["sky"] == "night_rain" and meta["size"] == [96, 48] and meta["quality"]["name"] == "current"
    assert verdict["status"] == "pass", failing(verdict)
    assert {"frame_p95", "frame_p95:S5-S1", "hitches_per_30s", "vram_peak_mib", "cvar_mismatches", "fps_cap", "game_exit",
            "summary_p95_diff", "gpu_process_samples"} <= set(gates(verdict))
    assert gates(verdict)["vram_peak_mib"]["value"] == 4100 and "contended_by" not in verdict
    assert verdict["report_only"]["ignored_desktop_processes"] == ["/usr/lib/xorg/Xorg"]
    assert verdict["report_only"]["heaviest_leg"] == "S5-S1" and verdict["report_only"]["gpu_sm_percent"], verdict["report_only"]
    gpu = json.loads((run / "native/gpu.json").read_text())
    assert gpu["before"]["processes"] and gpu["samples"] and set(gpu["own"]) & {row["pid"] for s in gpu["samples"] for row in s["processes"]}
    legs = json.loads((run / "native/legs.json").read_text())
    assert legs["ranked_by_p95"][0]["leg"] == "S5-S1" and legs["leg_order_ok"]
    assert L.main(["report", str(run)]) == 0 and json.loads((run / "verdict.json").read_text())["status"] == "pass"
    route, passed = L.route_report(SMALL, run)
    assert passed and route["header_current"] and [g["result"] for g in route["run"]["gates"]] == ["pass"] * 5, route["run"]
    print("direct perf ok: profile_package-style command, folder layout, readback, pass verdict, route checks")


def check_rununreal_perf(out, package):
    run, verdict = L.native_run(SMALL, "perf", "top_landscape", "night-rain", laps=2, label="rununreal-perf")
    command = json.loads((run / "run.json").read_text())["command"]
    assert command == [str(L.UAT), "RunUnreal", f"-project={L.UPROJECT}", f"-ScriptsForProject={L.UPROJECT}", "-platform=Linux",
                       "-configuration=Development", f"-build={package}",
                       f"-test=NordMobileLoop(mode=perf,size=96x48,sky=night-rain,laps=2,run='{run}',"
                       f"execcmds='{run}/quality.execcmds',expect='{run}/quality.expect',maxduration={L.run_timeout(SMALL, 'perf', 2)})"], command
    assert json.loads((run / "fake-argv.json").read_text())["role"] == "uat"
    assert [path.name for path in (run / "native").glob("*.csv")] == ["NordGauntlet-perf-night_rain.csv"], "copied from the csv= line"
    assert verdict["status"] == "pass", failing(verdict)
    assert gates(verdict)["frame_p95"]["note"] == "median of the per-lap values"
    print("RunUnreal perf ok: RunUAT command and -test= params, CSV copied from the csv= line, two laps by the median per-lap p95")


def check_contended(out, state):
    foreign = state / "foreign.json"
    free = next(pid for pid in range(999_999, 900_000, -1) if not Path(f"/proc/{pid}").exists())
    foreign.write_text(json.dumps([{"pid": free, "name": "/home/von/.steam/steamapps/common/dota 2 beta/game/bin/linuxsteamrt64/dota2",
                                    "mib": 3000}]))
    try:
        run, verdict = L.native_run(SMALL, "perf", "top_landscape", "night-rain", label="contended", direct=True)
    finally:
        foreign.unlink()
    assert verdict["status"] == "contended" and [row["pid"] for row in verdict["contended_by"]] == [free], verdict.get("contended_by")
    assert not failing(verdict), "the gates themselves pass; contention alone labels the run"
    assert T.result_from_verdict(verdict)["contended"] and not T.feasibility(SMALL, T.result_from_verdict(verdict))[0]
    print("contention ok: a foreign GPU process (dota2) labels the run contended and the tuner never ranks it")


def check_mismatch_and_phone():
    with patch.dict(os.environ, {"FAKE_MISMATCH": "r.ScreenPercentage"}):
        run, verdict = L.native_run(SMALL, "perf", "top_landscape", "night-rain", label="mismatch", direct=True)
    assert verdict["status"] == "fail" and gates(verdict)["game_exit"]["value"] == 4, failing(verdict)
    assert gates(verdict)["cvar_mismatches"]["result"] == "fail" and "r.ScreenPercentage=50 (want 75)" in gates(verdict)["cvar_mismatches"]["note"]
    assert L.run_error(json.loads((run / "run.json").read_text())) == "game exit 4 (cvar_mismatch)"
    with patch.dict(os.environ, {"FAKE_RUN_S": "30"}):
        run, verdict = L.native_run(SMALL, "perf", "top_landscape", "night-rain", label="timeout", direct=True, timeout=1)
    meta = json.loads((run / "run.json").read_text())
    assert meta["exit"] == {"code": 5, "name": "timeout", "source": "runner", "process": None, "timed_out": True}, meta["exit"]
    assert verdict["status"] == "fail" and gates(verdict)["game_exit"]["result"] == "fail"
    run, verdict = L.native_run(SMALL, "perf", "top_landscape", "day", quality="phone", label="phone", direct=True)
    command = json.loads((run / "run.json").read_text())["command"]
    assert "-DeviceProfile=NordPhoneStream" in command and not any(a.startswith("-ExecCmds=") for a in command)
    assert not (run / "quality.execcmds").exists() and "-NordHour=15" in command and "-NordWeather=Clear" in command
    expected = L.expected_from_file(run / "quality.expect")
    # The section's CVars, plus the fixed CVars it does not set (TSR comes from DefaultEngine.ini), are read back.
    fixed = SMALL["fixed"]
    unfixed = lambda cvars: {name: value for name, value in cvars.items() if name not in fixed}
    assert T.same_cvars(unfixed(expected), unfixed(T.read_profile(T.PROFILES_INI.read_text())["cvars"])), expected
    assert all(name in expected and T.values_match(value, expected[name]) for name, value in fixed.items()), expected
    meta = json.loads((run / "run.json").read_text())
    assert meta["quality"]["expected"]["r.AntiAliasingMethod"] == "4" and meta["readback"]["r.AntiAliasingMethod"] == "4.000000"
    assert gates(verdict)["cvar_mismatches"]["value"] == 0 and verdict["status"] == "pass", failing(verdict)
    print("readback ok: a CVar mismatch fails the run with exit 4, a hung game is killed as a timeout (exit 5), "
          "phone passes -DeviceProfile and reads the section and the fixed CVars back")


def check_reference(out):
    group, verdict = L.reference_run(SMALL, direct=True)
    result = json.loads((group / "reference.json").read_text())
    assert group.parent == out and set(result["sizes"]) == set(SMALL["size_use"]["confirm"]), result["sizes"]
    for size_key, entry in result["sizes"].items():
        assert len(entry["repeat"]) == 20 and entry["min"] == 1.0 and Path(entry["a"]["run"]).parent == group / "runs", size_key
        assert json.loads((Path(entry["b"]["run"]) / "run.json").read_text())["quality"]["path"] == str(group / "candidates/00-ceiling.execcmds")
    assert verdict["status"] == "pass" and set(gates(verdict)) == {f"{name}:{size}" for name in ("repeat_ssim_min", "repeat_stills")
                                                                   for size in ("top_landscape", "top_portrait")}, gates(verdict)
    assert (group / "review.html").read_text().count('class="row"') == 40 and L.main(["report", str(group)]) == 0
    print("reference ok: the ceiling twice at both confirm sizes, run-to-run SSIM 1.0 on all 40 stills")
    return group


def check_look(out):
    ceiling = T.make_candidate(SMALL, None, "ceiling", 0, "ceiling", cvars=SMALL["profiles"]["ceiling"]["cvars"], look_only=True)
    execcmds, _ = T.write_candidate_files(out / "test-candidates", ceiling)
    reference, verdict = L.native_run(SMALL, "look", "top_landscape", "day", quality=f"file:{execcmds}", label="ceiling-look", direct=True)
    names = L.still_names(SMALL, "look", "day", [96, 48])
    assert len(names) == 20 and all((reference / name).is_file() for name in names) and verdict["status"] == "pass", failing(verdict)
    assert "-NordNoAmbient" in json.loads((reference / "run.json").read_text())["command"]
    assert "frame_p95" not in gates(verdict) and gates(verdict)["stills"]["value"] == 20
    run, verdict = L.native_run(SMALL, "look", "top_landscape", "day", label="current-look", direct=True, ceiling=reference)
    images = verdict["values"]["images"]
    assert len(images) == 20 and all(.85 <= value < 1 for value in images.values()), images
    assert gates(verdict)["image_ssim_min"]["result"] == "pass" and verdict["status"] == "pass", failing(verdict)
    page = (run / "review.html").read_text()
    assert page.count('class="row"') == 20 and "day/S1-eye-96x48" in page
    print(f"look ok: 20 stills per size, -NordNoAmbient, mean SSIM {verdict['values']['look']:.4f} against the ceiling")


def check_tune(out):
    group, tune = L.tune_run(SMALL)
    assert group.parent == out and tune == json.loads((group / "tune.json").read_text())
    assert tune["stop_reason"] == "max_candidates" and tune["measured"] == 6, (tune["stop_reason"], tune["measured"])
    phases = [record["phase"] for record in tune["candidates"] if record["id"] != "baseline"]
    assert phases == ["baseline", "baseline", "ceiling", "ceiling", "step", "step"], phases
    assert tune["ties"]["repeat"]["min"] == 1.0 and tune["baseline"]["feasible"] and tune["winner"] not in (None, "baseline")
    for record in tune["candidates"]:
        if record["id"] == "baseline":
            continue
        assert (group / "candidates" / (record["id"] + ".execcmds")).is_file() and (group / "candidates" / (record["id"] + ".expect")).is_file()
        folders = tune["runs"][record["id"]]
        assert set(folders) == ({"look"} if record["look_only"] else {"perf", "look"}), (record["id"], folders)
        assert all(Path(folder).parent == group / "runs" for folder in folders.values())
    winner = next(record for record in tune["candidates"] if record["id"] == tune["winner"])
    assert tune["baseline"]["look"] is not None, "the baseline Look needs the ceiling stills before it runs"
    assert winner["look"] > tune["baseline"]["look"] and len(winner["images"]) == 20
    assert Path(tune["runs"][next(r["id"] for r in tune["candidates"] if r["phase"] == "ceiling")]["look"]).name.endswith("ceiling-first-look")
    # The winner passed, so the confirmation stops there; a ranked baseline below it, or an unranked one, does not run.
    confirmation = tune["native_confirmation"]
    assert [result["id"] for result in confirmation["results"]] == [tune["winner"]], confirmation
    assert confirmation["confirmed_native"] == tune["winner"] and all(len(result["runs"]) == 4 for result in confirmation["results"])
    assert {(run["sky"], run["size"]) for run in confirmation["results"][0]["runs"]} == {
        (sky, size) for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]}
    print(f"tune ok: 6 candidates ({tune['winner']} wins), every run kept, native confirmation of the winner alone")
    return group, tune


def check_tune_with_reference(out, reference):
    group, tune = L.tune_run(SMALL, reference=reference, confirm=False)
    sizes = json.loads((reference / "reference.json").read_text())["sizes"]["top_landscape"]
    ceilings = [tune["runs"][r["id"]]["look"] for r in tune["candidates"] if r["phase"] == "ceiling"]
    assert ceilings == [sizes["a"]["run"], sizes["b"]["run"]] and not any((group / "runs").glob("*ceiling*")), ceilings
    assert tune["ties"]["repeat"]["min"] == 1.0 and tune["baseline"]["look"] is not None and "native_confirmation" not in tune
    # A reference from another commit or another build would score every Look against an outdated ceiling.
    stale = out.parent / "stale-reference"
    shutil.copytree(reference, stale)
    stored = json.loads((reference / "reference.json").read_text())
    for change in ({"commit": dict(stored["commit"], commit="0" * 40)}, {"build": dict(stored["build"], bytes=1)}):
        (stale / "reference.json").write_text(json.dumps(dict(stored, **change)))
        before = sorted(out.iterdir())
        try:
            L.tune_run(SMALL, reference=stale, confirm=False)
        except RuntimeError as error:
            assert "render a new reference" in str(error), error
        else:
            raise AssertionError("a reference from another commit or build must be refused: " + ", ".join(change))
        assert sorted(out.iterdir()) == before, "a refused tune makes no folder"
    print("tune with --reference ok: the stored ceiling renders are reused, nothing is rendered twice; another commit or build is refused")


def check_reference_missing_sky(out):
    """Both ceiling runs lost their night stills (10 of 20, exit 0). The reference fails, and tune --reference refuses
    it before any run, because every candidate needs all 20 stills scored against the ceiling."""
    with patch.dict(os.environ, {"FAKE_LOOK_SKIP_SKY": "night_rain"}):
        group, verdict = L.reference_run(SMALL, direct=True)
    count = gates(verdict)["repeat_stills:top_landscape"]
    assert verdict["status"] == "fail" and count["value"] == 10 and count["result"] == "fail", failing(verdict)
    before = sorted(out.iterdir())
    try:
        L.tune_run(SMALL, reference=group, confirm=False)
    except RuntimeError as error:
        assert "stills fail" in str(error) and "No run was started" in str(error), error
    else:
        raise AssertionError("a reference without every still must be refused")
    assert sorted(out.iterdir()) == before, "a refused tune makes no folder"
    print("reference without the night stills ok: its stills gate fails, and tune --reference refuses it")


def check_reference_contended(out, state):
    """A foreign GPU process during the second ceiling render at the tune size. tune --reference refuses the stored
    reference before any run, as the tune refuses a contended ceiling that it renders itself."""
    real, foreign = L.native_run, state / "foreign.json"
    free = next(pid for pid in range(999_999, 900_000, -1) if not Path(f"/proc/{pid}").exists())

    def native_run(loop, mode, *args, **kwargs):
        contend = kwargs.get("label") == "ceiling-b-top_landscape"
        if contend:
            foreign.write_text(json.dumps([{"pid": free, "name": "dota2", "mib": 3000}]))
        try:
            return real(loop, mode, *args, **kwargs)
        finally:
            if contend:
                foreign.unlink()

    with patch.object(L, "native_run", native_run):
        group, verdict = L.reference_run(SMALL, direct=True)
    assert verdict["status"] == "contended" and not failing(verdict), failing(verdict)
    before = sorted(out.iterdir())
    try:
        L.tune_run(SMALL, reference=group, confirm=False)
    except RuntimeError as error:
        assert "ceiling run b" in str(error) and "contended" in str(error) and "No run was started" in str(error), error
    else:
        raise AssertionError("a reference with a contended ceiling run must be refused")
    assert sorted(out.iterdir()) == before, "a refused tune makes no folder"
    print("contended reference ok: tune --reference refuses a stored ceiling run that a foreign GPU process shared")


def check_tune_partial_look():
    """A look run stuck after S1 (2 of 20 stills, exit 2), or one whose night stills never land (10 of 20, exit 0),
    gives its candidate an error and no Look, so the tune never ranks it on the views it kept."""
    real = L.native_run
    broken = {"04": {"FAKE_LOOK_STUCK_AFTER": "1"}, "05": {"FAKE_LOOK_SKIP_SKY": "night_rain"}}

    def native_run(loop, mode, *args, **kwargs):
        label = kwargs.get("label") or ""
        with patch.dict(os.environ, broken.get(label[:2], {}) if label.endswith("-look") else {}):
            return real(loop, mode, *args, **kwargs)

    with patch.object(L, "native_run", native_run):
        group, tune = L.tune_run(SMALL, confirm=False)
    records = {record["id"][:2]: record for record in tune["candidates"]}
    stuck, dark = records["04"], records["05"]
    assert stuck["result"]["error"] == "game exit 2 (stuck)" and stuck["look"] is None and stuck["images"] is None, stuck["result"]
    assert dark["result"]["error"] == "look run: stills fail, 10 of 20 stills scored" and dark["look"] is None, dark["result"]
    assert not stuck["eligible"] and not dark["eligible"] and tune["ranking"] == ["baseline"], tune["ranking"]
    print("partial look ok: a stuck look run and one without its night stills give an error and no Look")


def check_tune_first_ceiling_contended(state):
    """A foreign GPU process during the first ceiling render: the tune renders the ceiling again before it scores the
    baseline, so the baseline keeps a Look and the round can still compare against it."""
    real, labels, foreign = L.native_run, [], state / "foreign.json"
    free = next(pid for pid in range(999_999, 900_000, -1) if not Path(f"/proc/{pid}").exists())

    def native_run(loop, mode, *args, **kwargs):
        labels.append(kwargs.get("label"))
        contend = labels[-1] == "ceiling-first-look" and labels.count("ceiling-first-look") == 1
        if contend:
            foreign.write_text(json.dumps([{"pid": free, "name": "dota2", "mib": 3000}]))
        try:
            return real(loop, mode, *args, **kwargs)
        finally:
            if contend:
                foreign.unlink()

    with patch.object(L, "native_run", native_run):
        group, tune = L.tune_run(SMALL, confirm=False)
    assert labels.count("ceiling-first-look") == 2, labels
    contended = [record["id"] for record in tune["candidates"] if record["phase"] == "baseline" and record["contended"]]
    assert len(contended) == 1, contended
    baseline = next(record for record in tune["candidates"] if record["id"] == "baseline")
    assert tune["baseline"]["look"] is not None and len(baseline["aggregate_of"]) == 2, baseline
    assert tune["ties"]["repeat"]["min"] == 1.0, tune["ties"]
    print(f"first ceiling contended ok: {contended[0]} runs again after a second ceiling render; the baseline keeps a Look")

def check_tune_window():
    """Without --reference the tune's first candidate renders the ceiling look, then its perf and look runs, and its plan
    holds all three. With a fake clock where each run takes its estimate, no run ends after --until: a window between
    the perf and look runs and all three starts nothing, and a window for all three runs them and stops there."""
    clock, real_native, real_search = [3_000_000.0], L.native_run, T.search
    first, calls = L.first_candidate_s(SMALL, None), []

    def native_run(loop, mode, *args, **kwargs):
        result = real_native(loop, mode, *args, **kwargs)
        clock[0] += T.run_estimate_s(loop, mode, kwargs.get("laps"))
        calls.append((kwargs.get("label"), clock[0]))
        return result

    assert first == T.candidate_estimate_s(SMALL) + T.run_estimate_s(SMALL, "look") > T.candidate_estimate_s(SMALL)
    with patch.object(L, "native_run", native_run), patch.object(T, "search", lambda *a, **k: real_search(*a, clock=lambda: clock[0], **k)):
        for room, labels in ((T.candidate_estimate_s(SMALL) + 10, []),
                             (first + 10, ["ceiling-first-look", "00-baseline-a-perf", "00-baseline-a-look"])):
            calls.clear()
            until = clock[0] + room
            group, tune = L.tune_run(SMALL, until=until, confirm=False)
            assert [label for label, _ in calls] == labels and all(end <= until for _, end in calls), (room, calls)
            assert tune["stop_reason"] == "window_end" and tune["measured"] == (1 if labels else 0), (tune["stop_reason"], tune["measured"])
    print(f"tune window ok: the first candidate is planned with the ceiling look run ({first} s), so no run ends after --until")


def check_tune_slow_host():
    """Every native run takes 1.3 times its estimate, and a foreign GPU process shares the first baseline perf run. The
    ceiling render and the perf and look runs then fall in separate search attempts, none longer than the first
    candidate's plan, so planned_candidate_s shows no slowdown. The tune keeps its slowest run against that run's
    estimate (host_slowdown), so the confirmation plans each run 1.3 times longer than the estimate."""
    clock, real_native, real_search, labels = [3_000_000.0], L.native_run, T.search, []
    first = L.first_candidate_s(SMALL, None)

    def native_run(loop, mode, *args, **kwargs):
        run, verdict = real_native(loop, mode, *args, **kwargs)
        clock[0] += 1.3 * T.run_estimate_s(loop, mode, kwargs.get("laps"))
        labels.append(kwargs.get("label"))
        return run, dict(verdict, status="contended") if labels[-1] == "00-baseline-a-perf" else verdict

    with patch.object(L, "native_run", native_run), patch.object(L.time, "time", lambda: clock[0]), \
            patch.object(T, "search", lambda *a, **k: real_search(*a, clock=lambda: clock[0], **k)):
        group, tune = L.tune_run(SMALL, until=clock[0] + 2.5 * first, confirm=False)
    assert labels == ["ceiling-first-look", "00-baseline-a-perf", "01-baseline-a-perf", "01-baseline-a-look"], labels
    assert tune["planned_candidate_s"] == first, "no search attempt is longer than the first candidate's plan"
    estimate = T.run_estimate_s(SMALL, "perf", SMALL["confirm_laps"])
    plan = L.confirm_plan(SMALL, tune)["run_s"]
    assert abs(tune["host_slowdown"] - 1.3) < 1e-9 and abs(plan - 1.3 * estimate) < 1e-6, (tune.get("host_slowdown"), plan, estimate)
    # The first candidate's look run hangs to the runner's limit (3 times its estimate, exit 5 timeout). That run, and
    # the contended one above, show no speed of this host: host_slowdown leaves them out, and the plan uses it, though
    # the hung candidate also lengthened planned_candidate_s.
    clock[0] = 3_000_000.0
    labels.clear()

    def hung_run(loop, mode, *args, **kwargs):
        run, verdict = real_native(loop, mode, *args, **kwargs)
        hung = kwargs.get("label") == "00-baseline-a-look"
        clock[0] += (3.0 if hung else 1.3) * T.run_estimate_s(loop, mode, kwargs.get("laps"))
        labels.append(kwargs.get("label"))
        if hung:
            edit_json(run / "run.json", lambda meta: dict(meta, exit={"code": 5, "name": "timeout", "source": "runner",
                                                                      "process": None, "timed_out": True}))
            verdict = dict(verdict, status="fail")
        return run, verdict

    with patch.object(L, "native_run", hung_run), patch.object(L.time, "time", lambda: clock[0]), \
            patch.object(T, "search", lambda *a, **k: real_search(*a, clock=lambda: clock[0], **k)):
        group, tune = L.tune_run(SMALL, until=clock[0] + 2.5 * first, confirm=False)
    assert "00-baseline-a-look" in labels and tune["planned_candidate_s"] > 1.3 * first, (labels, tune["planned_candidate_s"])
    plan = L.confirm_plan(SMALL, tune)["run_s"]
    assert abs(tune["host_slowdown"] - 1.3) < 1e-9 and abs(plan - 1.3 * estimate) < 1e-6, (tune.get("host_slowdown"), plan, estimate)
    print(f"slow host ok: a contended first perf run hides the slowdown from planned_candidate_s, and host_slowdown "
          f"plans each confirmation run at {plan:.0f} s, not {estimate} s; a hung run does not lengthen the plan")


def start_stream(out, state, run, quality, **options):
    """A gauntlet lifecycle for run, with an idle fake host whose command line carries the world flags, and one
    stream_run on it. Returns the verdict."""
    (run / "stream.expect").write_text(browser_streaming.gauntlet_expect(quality))
    host_log, friend_log = out.parent / f"host-{run.name}.log", out.parent / f"friend-{run.name}.log"
    host_log.write_text("LogInit: Display: the native host started\n")
    host = subprocess.Popen([sys.executable, str(state.parent / "game.py"), "idle", *PINNED.split(), "-NordGauntlet",
                             "-NordGauntletMode=stream", *SMALL["world_flags"]["all"]], start_new_session=True)
    # On a busy machine the /proc cmdline of a child that Popen just started was seen empty for a moment. The launcher
    # marks the lifecycle running only once its host is up, so wait for the host's arguments here too.
    deadline = time.monotonic() + 10
    while not Path(f"/proc/{host.pid}/cmdline").read_bytes() and time.monotonic() < deadline:
        time.sleep(.01)
    lifecycle = {"launcher_pid": 1, "phase": "running", "stream_quality": quality, "stream_settings": {},
                 "gauntlet": {"run": str(run), "host_log": str(host_log), "expect": str(run / "stream.expect"), "sky": PINNED.split()},
                 "children": [{"name": "host", "pid": host.pid, "stdout": "host.stdout.log"}]}
    L.write_json(L.LIFECYCLE, lifecycle)
    try:
        with patch.dict(os.environ, {"FAKE_HOST_LOG": str(host_log), "FAKE_FRIEND_LOG": str(friend_log),
                                     "FAKE_EXPECT": str(run / "stream.expect")}):
            return L.stream_run(SMALL, run, slot="NordHost", pin=0, **options)[1]
    finally:
        host.kill()
        host.wait()


def rejudge(run, name, change):
    """A copy of a judged stream run, outside Saved/Gauntlet so no round counts it, with change(folder) applied."""
    copied = run.parent.parent / "rejudged" / name
    shutil.copytree(run, copied)
    change(copied)
    return L.judge(copied, SMALL)


def edit_json(path, change):
    data = json.loads(Path(path).read_text())
    Path(path).write_text(json.dumps(change(data)))


def check_stream(out, state, group, winner):
    run = out / "20261023T230000Z-stream-winner"
    run.mkdir()
    quality = browser_streaming.stream_quality(f"file:{group / 'candidates' / (winner + '.execcmds')}")
    verdict = start_stream(out, state, run, quality, seconds=5)
    argv = json.loads((run / "stream/sampler-argv.json").read_text())
    assert argv == ["--slot", "NordHost", "--url", "http://127.0.0.1:8100/", "--seconds", "5", "--warmup", "2", "--frames", "--latency",
                    "--pin", "0", "--trigger", str(run / "stream/trigger.txt"), "--out", str(run / "stream")], argv
    holds = SMALL["order"][1:] + SMALL["order"][:1]
    assert (run / "stream/trigger.txt").read_text().split() == holds + ["END"], "one trigger line per hold, then END at the done line"
    assert sorted(path.name for path in (run / "stream/shots").glob("*-video.png")) == sorted(
        f"{n:02d}-{s}-video.png" for n, s in enumerate(holds, 1))
    for name in ("run.json", "stream/sample.json", "stream/frames.json", "stream/events.json", "stream/gpu.json", "stream/host.log",
                 "stream/friend-events.json", "stream/friend.log", "verdict.json", "review.html"):
        assert (run / name).is_file(), name
    assert verdict["status"] == "pass", (failing(verdict), verdict.get("notes"))
    # The host's result line came 2 s after the sampler quit at END; the runner followed the host log on to it.
    assert gates(verdict)["game_exit"]["value"] == 0 and gates(verdict)["game_exit"]["result"] == "pass", gates(verdict)["game_exit"]
    assert any("NORD_GAUNTLET result exit=0" in event["line"] for event in json.loads((run / "stream/events.json").read_text()))
    assert verdict["report_only"]["stop_frames"]["S1"] == "stream/shots/05-S1-video.png"
    assert verdict["report_only"]["encoder_qp"]["mean"] == 20.0, "the lap's QP events, not the whole sample's"
    assert gates(verdict)["size_changes"]["value"] == 0, "the received event before the lap is outside the window"
    assert gates(verdict)["received_size"]["value"] == "96x48" and gates(verdict)["received_size"]["result"] == "pass"
    assert gates(verdict)["friend_awake_windows"]["value"] == 0, "NordFriend1 was awake only before the lap"
    assert verdict["report_only"]["native_frames_ms"]["frame"]["p95_ms"] == 16.9 and len(verdict["report_only"]["native_legs_by_p95"]) == 5
    assert {"decoded_fps_mean", "freezes", "decoded_over_50ms_percent", "longest_gap_ms", "jitter_buffer_ms_per_frame",
            "native_fps_min", "decoded_vs_native_fps", "size_changes", "game_exit", "cvar_mismatches"} <= set(gates(verdict))
    assert 29 <= verdict["values"]["decoded_fps"] <= 31 and gates(verdict)["longest_gap_ms"]["value"] < 40, "the 600 ms stall is before the lap"
    assert verdict["delay"]["gated"] is False and verdict["delay"]["values"]["delay"]["rttMs"]["mean"] == 2.1
    lap_delay = verdict["delay"]["values"]["lap_delay"]
    assert abs(lap_delay["rttMs"]["mean"] - 2.0) < 1e-9 and abs(lap_delay["processingMsPerFrame"] - 30) < 1e-6, lap_delay
    assert lap_delay["frontend"] == {"events": 5, "averageE2ELatency": 40.0}, lap_delay["frontend"]
    assert verdict["delay"]["label"].startswith("host-PC headless Chromium")
    assert not any("ms" in gate["unit"] and "rtt" in gate["name"].lower() for gate in verdict["gates"]), "no gate cites a delay"
    meta = json.loads((run / "run.json").read_text())
    assert meta["row"] == "solo" and meta["size"] == [96, 48] and meta["quality"]["name"] == "file"
    assert meta["world_flags"] == SMALL["world_flags"]["all"] and "-NordGauntletMode=stream" in meta["host_command"], meta["host_command"]
    assert meta["readback"]["t.MaxFPS"] == "60" and meta["friend_log"].endswith("friend-" + run.name + ".log")
    # The page's performance.timeOrigin cuts the decoded frames to the lap. An older sample without it keeps the
    # whole-sample intervals as report-only, and its interval gates are unverified, never pass.
    report = json.loads((run / "stream/sample.json").read_text())
    events = json.loads((run / "stream/events.json").read_text())
    window = L.lap_window(events)[0]
    assert window == (next(e["ms"] for e in events if "NORD_GAUNTLET leg=S1-S2 lap=1 begin" in e["line"]),
                      next(e["ms"] for e in events if "NORD_GAUNTLET done laps=1" in e["line"])), "route and summary lines are not the lap"
    cut = L.lap_sample(report, run / "stream", window)
    old = L.lap_sample({key: value for key, value in report.items() if key != "timeOrigin"}, run / "stream", window)
    assert old["intervals"] is None and old["whole_intervals"]["frames"] > cut["intervals"]["frames"] and old["notes"] and not cut["notes"]
    assert old["whole_intervals"]["longest_gap_ms"] >= 600 > 40 > cut["intervals"]["longest_gap_ms"], (old["whole_intervals"], cut["intervals"])
    unclocked = rejudge(run, "no-time-origin", lambda folder: edit_json(folder / "stream/sample.json",
                                                                       lambda data: {k: v for k, v in data.items() if k != "timeOrigin"}))
    assert {name: gates(unclocked)[name]["result"] for name in ("decoded_over_50ms_percent", "longest_gap_ms")} == {
        "decoded_over_50ms_percent": "unverified", "longest_gap_ms": "unverified"}, failing(unclocked)
    assert unclocked["status"] == "unverified" and unclocked["report_only"]["whole_sample_intervals"]["longest_gap_ms"] >= 600
    # The verdict does not need the sampler's own summary (missing when the sampler failed first): the lap still has delay.
    unsummed = rejudge(run, "no-summary", lambda folder: edit_json(folder / "stream/sample.json",
                                                                  lambda data: {k: v for k, v in data.items() if k != "summary"}))
    assert unsummed["status"] == "pass" and unsummed["delay"]["values"]["lap_delay"]["rttMs"]["max"] == 2.0, unsummed["delay"]
    assert unsummed["report_only"]["encoder_qp"]["mean"] == 20.0
    # The streamer ignored the pinned rung and sent 1280x720 all lap: one size, so size_changes stays 0, but the size fails.
    def resize(folder, width, height):
        edit_json(folder / "stream/sample.json", lambda data: dict(data, samples=[dict(s, width=width, height=height) for s in data["samples"]]))
    wrong = rejudge(run, "wrong-size", lambda folder: resize(folder, 1280, 720))
    assert gates(wrong)["received_size"]["value"] == "1280x720" and gates(wrong)["received_size"]["result"] == "fail"
    assert gates(wrong)["size_changes"]["value"] == 0 and wrong["status"] == "fail"
    assert gates(rejudge(run, "no-size", lambda folder: resize(folder, 0, 0)))["received_size"]["result"] == "unverified"
    # NordFriend1 woke during the lap, so two games rendered: the solo row fails.
    awake = rejudge(run, "friend-awake", lambda folder: edit_json(folder / "stream/friend-events.json", lambda rows: [
        dict(row, line=row["line"].replace("sleeping=1", "sleeping=0")) for row in rows]))
    assert gates(awake)["friend_awake_windows"]["value"] == 5 and awake["status"] == "fail", gates(awake)["friend_awake_windows"]
    two = out / "20261023T230500Z-two-viewers"
    (two / "stream/NordFriend1").mkdir(parents=True)
    for name in ("stream/events.json", "stream/gpu.json", "stream/sample.json", "stream/frames.json"):
        (two / name).write_text((run / name).read_text())
    for name in ("sample.json", "frames.json"):
        (two / "stream/NordFriend1" / name).write_text((run / "stream" / name).read_text())
    L.write_json(two / "run.json", dict(meta, label=two.name, row="two_viewer", slots=["NordHost", "NordFriend1"]))
    paired = L.judge(two, SMALL)
    # A two-viewer row gates nothing. Whole, it is report-only, not unverified, so notes-host step 8 does not sample a
    # clean row again, and the stream command (here report on its folder) exits 0.
    assert paired["status"] == "report-only" and paired["gates"] == [] and "summary" not in paired, paired["status"]
    assert 29 <= paired["values"]["two_viewer_fps"] <= 31 and set(paired["report_only"]["two_viewer"]["per_slot"]) == {"NordHost", "NordFriend1"}
    printed = io.StringIO()
    with contextlib.redirect_stdout(printed):
        code = L.main(["report", str(two)])
    assert code == 0 and json.loads(printed.getvalue())["status"] == "report-only", (code, printed.getvalue())
    assert 'class="report-only"' in (two / "review.html").read_text()
    def foreign_gpu(folder):
        edit_json(folder / "stream/gpu.json", lambda data: dict(data, samples=[
            dict(sample, processes=sample["processes"] + [{"pid": 4242, "name": "dota2", "used_mib": 3000}]) for sample in data["samples"]]))
    assert rejudge(two, "two-viewers-contended", foreign_gpu)["status"] == "contended"
    # NordFriend1's slot has no sample: no mean, so the co-op guard does not count the row, and it is unverified.
    unsampled = rejudge(two, "two-viewers-no-friend", lambda folder: (folder / "stream/NordFriend1/sample.json").unlink())
    assert unsampled["values"]["two_viewer_fps"] is None and unsampled["status"] == "unverified", unsampled["values"]
    # A relay row gates nothing either: report-only once every one of its stream figures has a value, else unverified.
    relay = out / "20261023T230600Z-relay"
    shutil.copytree(run, relay)
    for name in ("verdict.json", "review.html"):
        (relay / name).unlink()
    L.write_json(relay / "run.json", dict(meta, label=relay.name, row="relay"))
    relayed = L.judge(relay, SMALL)
    assert relayed["status"] == "report-only" and relayed["gates"] == [], relayed["status"]
    assert all(gate["result"] != "unverified" for gate in relayed["report_only"]["relay"]["gates"])
    relay_unclocked = rejudge(relay, "relay-no-time-origin", lambda folder: edit_json(
        folder / "stream/sample.json", lambda data: {k: v for k, v in data.items() if k != "timeOrigin"}))
    assert relay_unclocked["status"] == "unverified", relay_unclocked["status"]
    try:
        L.stream_run(SMALL, run)
    except RuntimeError as error:
        assert "already has a stream sample" in str(error)
    else:
        raise AssertionError("a second sample needs a fresh lifecycle")
    try:
        L.stream_run(SMALL, out / "another-run")
    except RuntimeError as error:
        assert "NORD_STREAM_GAUNTLET" in str(error)
    else:
        raise AssertionError("the lifecycle must belong to the run")
    print("stream ok: sampler flags, a trigger line and a decoded frame per hold, END at the lap end, the lap window and clock, "
          "received size, NordFriend1 asleep, world flags and readback, pass verdict, the lap's delay apart")
    return run, two, relay


def check_stream_lost(run):
    """The stream went away in the middle of the lap and did not come back (no connected peer, counters at 0), so the
    sampler stopped 10 s later, before the lap ended. With NordHost still driving, its exit 0 logged or its process
    still running when the runner stopped following the log, that fails the row, as a long freeze does. After a host
    crash (no done or result line, and its process gone) the row is unverified: a crash is not the profile's fault.
    The same loss fails an input row, whose drags stopped with the stream. A relay row gates nothing, so it reads
    unverified, also when its stream figures kept values."""
    meta = json.loads((run / "run.json").read_text())
    assert meta.get("host_running") is True, "the fake host still ran when the runner stopped following its log"
    assert gates(json.loads((run / "verdict.json").read_text()))["stream_lost_in_lap"]["value"] == 0, "the clean lap kept its stream"
    window = L.lap_window(json.loads((run / "stream/events.json").read_text()))[0]
    middle = (window[0] + window[1]) / 2
    counters_at_zero = {key: 0 for key in ("framesDecoded", "framesReceived", "bytesReceived", "totalDecodeTime",
                                           "jitterBufferDelay", "jitterBufferEmittedCount")}

    def lose(folder, log_ends=False, running=True, kind="solo", zero=True):
        edit_json(folder / "stream/sample.json", lambda data: dict(data, samples=[
            dict(sample, peerStates=["connected"]) if sample["timeMs"] < middle else
            dict(sample, peerStates=["disconnected"], **(counters_at_zero if zero else {}))
            for sample in data["samples"] if sample["timeMs"] < middle + 200]))
        if log_ends:
            edit_json(folder / "stream/events.json", lambda rows: [row for row in rows if row["ms"] < middle])
        edit_json(folder / "run.json", lambda data: dict(data, host_running=running, row=kind))

    for name, options, status, value in (("stream-lost", {}, "fail", 1),
                                         ("stream-lost-host-ran", {"log_ends": True}, "fail", 1),
                                         ("stream-lost-host-crashed", {"log_ends": True, "running": False}, "unverified", None),
                                         ("stream-lost-input", {"kind": "input"}, "fail", 1)):
        lost = rejudge(run, name, lambda folder: lose(folder, **options))
        assert lost["status"] == status and gates(lost)["stream_lost_in_lap"]["value"] == value, (name, failing(lost))
    # The relay's stream figures keep their values here (counters not reset), so only the lost stream makes it partial.
    relay = rejudge(run, "stream-lost-relay", lambda folder: lose(folder, kind="relay", zero=False))
    held = {gate["name"]: gate["result"] for gate in relay["report_only"]["relay"]["gates"]}
    assert relay["status"] == "unverified" and held["stream_lost_in_lap"] == "fail", (relay["status"], held)
    assert any("stream went away inside the lap" in note for note in relay["notes"]), relay["notes"]
    print("stream lost ok: a stream gone inside the lap fails a solo or input row while the host drove on, leaves a relay "
          "row unverified, and is unverified after a crash")


def check_two_viewer_whole(two):
    """A two-viewer row counts for the co-op guard only when it compares with the baseline's. NordFriend1's video
    stopped at the lap start while its peer stayed connected, so its sampler went on with flat counters: that slot
    decoded nothing inside the lap, and its 0 FPS would halve the mean. A row without nvidia-smi process listings (a
    foreign process would not show) does not compare either. Each such row is unverified, so notes-host step 8 samples
    it again. A row at another size than the pinned rung's, or with a size change inside the lap, fails NordHost's
    gate, so it fails as a solo row does: a size that changes every time with two viewers drops the candidate instead
    of holding the round open."""
    window = L.lap_window(json.loads((two / "stream/events.json").read_text()))[0]

    def freeze_friend(folder):
        def flat(data):
            held = next(sample["framesDecoded"] for sample in data["samples"] if sample["timeMs"] >= window[0])
            return dict(data, samples=[dict(sample, framesDecoded=held) if sample["timeMs"] >= window[0] else sample
                                       for sample in data["samples"]])
        edit_json(folder / "stream/NordFriend1/sample.json", flat)

    def resize_both(folder):
        for sample in ("stream/sample.json", "stream/NordFriend1/sample.json"):
            edit_json(folder / sample, lambda data: dict(data, samples=[dict(s, width=1280, height=720) for s in data["samples"]]))

    def unlisted(folder):
        edit_json(folder / "stream/gpu.json", lambda data: dict(data, before=dict(data["before"], processes=[]),
                                                                after=dict(data["after"], processes=[]),
                                                                samples=[dict(sample, processes=[]) for sample in data["samples"]]))

    def resize_in_lap(folder):
        # One received-size change in the middle of the lap: the stream scaled down under the load of two viewers.
        edit_json(folder / "stream/sample.json", lambda data: dict(data, events=(data.get("events") or []) + [
            {"timeMs": (window[0] + window[1]) / 2, "kind": "received", "width": 1058, "height": 488}]))

    frozen = rejudge(two, "two-viewers-friend-frozen", freeze_friend)
    assert frozen["report_only"]["two_viewer"]["per_slot"]["NordFriend1"] == 0.0, frozen["report_only"]["two_viewer"]["per_slot"]
    for found, held in ((frozen, "NordFriend1 decoded no frame inside the lap"),
                        (rejudge(two, "two-viewers-no-listing", unlisted), "gpu_process_samples unverified")):
        assert found["values"]["two_viewer_fps"] is None and found["status"] == "unverified", (held, found["status"], found["values"])
        assert any(held in note for note in found["notes"]), (held, found["notes"])
    for name, change, failed in (("two-viewers-wrong-size", resize_both, [("received_size", "1280x720")]),
                                 ("two-viewers-size-change", resize_in_lap, [("size_changes", 1)])):
        found = rejudge(two, name, change)
        assert found["status"] == "fail" and [(gate["name"], gate["value"]) for gate in found["gates"]] == failed, (
            name, found["status"], found["gates"])
        assert found["values"]["two_viewer_fps"] is None, (name, found["values"])
    print("two-viewer whole ok: a slot that decoded nothing or no nvidia-smi listing leaves the row unverified; another "
          "size or a size change fails it")


def check_failed_drive(out, two, relay):
    """NordHost's drive failed inside the lap (stuck, exit 2): the lap window ends at the fail line, so the figures
    cover part of a lap. A relay row is then unverified and sampled again. A two-viewer row fails, as a solo row with
    that exit fails, so a drive that fails every time with two viewers drops the candidate (check_report_coop_failed_drive)
    instead of holding the round open."""
    stuck_drive = lambda folder: edit_json(folder / "stream/events.json", lambda rows: [
        dict(row, line=row["line"].replace("done laps=1", "fail exit=2 reason=stuck").replace("exit=0 reason=done", "exit=2 reason=stuck"))
        for row in rows])
    relay_stuck = rejudge(relay, "relay-stuck", stuck_drive)
    assert relay_stuck["status"] == "unverified" and relay_stuck["report_only"]["relay"]["gates"], relay_stuck["status"]
    assert any("relay row is unverified" in note for note in relay_stuck.get("notes", [])), relay_stuck.get("notes")
    stuck = rejudge(two, "two-viewers-stuck", stuck_drive)
    assert stuck["values"]["two_viewer_fps"] is None and 29 <= stuck["report_only"]["two_viewer"]["mean_decoded_fps"] <= 31, stuck["values"]
    assert stuck["status"] == "fail" and [(gate["name"], gate["value"]) for gate in stuck["gates"]] == [("game_exit", 2)], stuck["gates"]
    assert any("game_exit failed inside the lap" in note for note in stuck["notes"]), stuck["notes"]
    with contextlib.redirect_stdout(io.StringIO()):
        assert L.main(["report", str(out.parent / "rejudged/two-viewers-stuck")]) == 1, "stream and report exit 1"
    print("failed drive ok: a relay row whose drive failed is unverified, a two-viewer row with that drive fails")


def check_follow_to_result(out):
    """After the sampler stops, the runner follows the host log to its result line, and no longer once the host quit
    or the wait ends, so a host that died without that line costs no full wait."""
    log = out.parent / "follow-host.log"
    log.write_text("")
    tail = L.LogTail(log, [])
    tail.start()
    gone = next(pid for pid in range(999_999, 900_000, -1) if not Path(f"/proc/{pid}").exists())
    try:
        for children, seconds, line, came in (([{"name": "host", "pid": gone}], 30, None, False),
                                              ([{"name": "host", "pid": os.getpid()}], .3, None, False),
                                              ([{"name": "host", "pid": os.getpid()}], 30, "NORD_GAUNTLET result exit=0 reason=done", True)):
            if line:
                threading.Timer(.3, lambda: log.write_text(line + "\n")).start()
            started = time.monotonic()
            assert L.follow_to_result(tail, {"children": children}, seconds) is came, (children, seconds)
            assert time.monotonic() - started < 3, f"waited {time.monotonic() - started:.1f} s"
    finally:
        tail.stop()
    print("follow to result ok: the result line ends the wait, and a host that quit or the wait's end stops it")


def check_stream_input(out, state, group, winner):
    """The input row: the sampler drags on the stream all lap (--look); the car must keep its path. The lateral error
    and the exit come from the car's own drive, so a row without drags through the whole gated lap is unverified,
    never pass: a sampler killed at the runner's limit (no sample.json, as SIGKILL skips its finally block), one that
    never reached the page, one that crashed in the middle of the lap with its peer connected, a sample without the
    --look sweep, and a stream command started after the lap began."""
    run = out / "20261023T231000Z-stream-input"
    run.mkdir()
    quality = browser_streaming.stream_quality(f"file:{group / 'candidates' / (winner + '.execcmds')}")
    verdict = start_stream(out, state, run, quality, look=True)
    argv = json.loads((run / "stream/sampler-argv.json").read_text())
    assert argv[argv.index("--seconds") + 1] == str(L.stream_seconds(SMALL)) == "925" and argv[-1] == "--look", argv
    assert json.loads((run / "run.json").read_text())["row"] == "input"
    assert [gate["name"] for gate in verdict["gates"]] == ["max_lateral_m", "game_exit", "stream_lost_in_lap", "drags_cover_lap"]
    assert verdict["status"] == "pass", failing(verdict)
    assert gates(verdict)["max_lateral_m"]["value"] == .9 and verdict["report_only"]["input"]["gates"], verdict["report_only"].keys()
    route, _ = L.route_report(SMALL, run)
    assert {gate["name"]: gate["result"] for gate in route["run"]["gates"]}["max_lateral_m"] == "pass"
    assert {gate["name"]: gate["result"] for gate in route["run"]["gates"]}["stop_order"] == "pass", "the stream host log has the stops"
    off = rejudge(run, "input-off-path", lambda folder: edit_json(folder / "native/route.json", lambda data: dict(data, max_offset_m=3.1)))
    assert gates(off)["max_lateral_m"]["result"] == "fail" and off["status"] == "fail"
    window = L.lap_window(json.loads((run / "stream/events.json").read_text()))[0]
    middle = (window[0] + window[1]) / 2

    def killed(folder):
        for name in ("sample.json", "frames.json"):
            (folder / "stream" / name).unlink()
        edit_json(folder / "run.json", lambda meta: dict(meta, sampler_exit=[None]))

    def no_page(folder):
        edit_json(folder / "stream/sample.json", lambda data: dict(data, samples=[], events=[], shots=[], passed=False, error="TimeoutError"))
        edit_json(folder / "run.json", lambda meta: dict(meta, sampler_exit=[1]))

    def crashed(folder):
        # The fake lap is shorter than COVER_GRACE_MS, so the host lines after the cut move 60 s later, as in a real lap.
        edit_json(folder / "stream/sample.json", lambda data: dict(data, samples=[s for s in data["samples"] if s["timeMs"] < middle]))
        edit_json(folder / "stream/events.json", lambda rows: [dict(row, ms=row["ms"] + 60000) if row["ms"] >= middle else row
                                                               for row in rows])
        edit_json(folder / "run.json", lambda meta: dict(meta, sampler_exit=[1]))

    for name, change in (("killed", killed), ("no-page", no_page), ("crashed", crashed),
                         ("no-sweep", lambda folder: edit_json(folder / "stream/sample.json", lambda data: dict(data, cameraSweep=False))),
                         ("late", lambda folder: edit_json(folder / "stream/events.json", lambda rows: [dict(row, late=True) for row in rows]))):
        found = rejudge(run, "input-" + name, change)
        assert found["status"] == "unverified" and gates(found)["drags_cover_lap"]["result"] == "unverified", (name, failing(found))
        assert gates(found)["max_lateral_m"]["result"] == gates(found)["game_exit"]["result"] == "pass", (name, failing(found))
    try:
        L.stream_run(SMALL, run, look=True, relay=True)
    except RuntimeError as error:
        assert "--look is its own row" in str(error)
    else:
        raise AssertionError("--look with --relay must be refused")
    print("input row ok: --look reaches the sampler, the default sample length is 925 s, the lateral error is gated, and "
          "a row without drags through the whole lap is unverified")


def check_stream_one_command(out):
    """One stream command per run, on NordHost. A NordFriend1 row alone wakes NordFriend1 (friend_awake_windows), so
    --two-viewers samples both slots in one command. A second command on a run would share the first one's folder."""
    run = out / "20261023T232000Z-stream-one-command"
    run.mkdir()
    host_log = out.parent / f"host-{run.name}.log"
    host_log.write_text("")
    gone = next(pid for pid in range(999_999, 900_000, -1) if not Path(f"/proc/{pid}").exists())
    lifecycle = {"launcher_pid": 1, "phase": "running", "stream_quality": browser_streaming.stream_quality("current"),
                 "gauntlet": {"run": str(run), "host_log": str(host_log), "sky": PINNED.split()},
                 "children": [{"name": "host", "pid": gone}]}
    # Phase starting: the launcher has not started NordFriend1 yet, or not seen it welcomed. GpuWatch reads the children
    # once, so a NordFriend1 started after the stream command would make the row contended. The runner waits for running.
    L.write_json(L.LIFECYCLE, dict(lifecycle, phase="starting"))
    try:
        L.stream_run(SMALL, run, pin=0, seconds=1)
    except RuntimeError as error:
        assert "still starting" in str(error) and "NORD host and friend are connected" in str(error), error
    else:
        raise AssertionError("a lifecycle that is still starting must be refused")
    assert not (run / "stream").exists() and not (run / "run.json").exists(), "a refused row starts nothing"
    L.write_json(L.LIFECYCLE, lifecycle)
    for options, text in (({"slot": "NordFriend1"}, "Every gauntlet row samples NordHost"),
                          ({"slot": "NordFriend1", "relay": True}, "Every gauntlet row samples NordHost"),
                          ({"slot": "NordFriend1", "two_viewers": True}, "Every gauntlet row samples NordHost")):
        try:
            L.stream_run(SMALL, run, pin=0, seconds=1, **options)
        except RuntimeError as error:
            assert text in str(error), (options, error)
        else:
            raise AssertionError(f"must be refused: {options}")
        assert not (run / "stream").exists() and not (run / "run.json").exists(), "a refused row starts nothing"
    # The command line offers NordHost only, so stream --help does not list a slot that stream_run refuses.
    errors = io.StringIO()
    try:
        with contextlib.redirect_stderr(errors):
            L.main(["stream", "--run", str(run), "--slot", "NordFriend1", "--pin", "0"])
    except SystemExit as error:
        assert error.code == 2 and "invalid choice: 'NordFriend1'" in errors.getvalue(), (error.code, errors.getvalue())
    else:
        raise AssertionError("the stream command line must refuse --slot NordFriend1")
    assert not (run / "stream").exists() and not (run / "run.json").exists(), "a refused row starts nothing"
    # loop.json has sizes for rungs 0 and 1 only. A row at rung 2 or 3 has no expected size, so it could never pass:
    # stream refuses it, also on the command line, and starts nothing.
    for pin in (2, 3):
        try:
            L.stream_run(SMALL, run, pin=pin, seconds=1)
        except RuntimeError as error:
            assert "--pin must be a rung with a size in loop.json (0, 1)" in str(error), error
        else:
            raise AssertionError(f"--pin {pin} must be refused")
    errors = io.StringIO()
    try:
        with contextlib.redirect_stderr(errors):
            L.main(["stream", "--run", str(run), "--pin", "2", "--portrait"])
    except SystemExit as error:
        assert error.code == 1 and "rung 2 has no portrait size" in errors.getvalue(), (error.code, errors.getvalue())
    else:
        raise AssertionError("the stream command line must refuse --pin 2")
    assert not (run / "stream").exists() and not (run / "run.json").exists(), "a refused row starts nothing"
    # A first command is still sampling: its folder exists, but it has no sample.json yet.
    (run / "stream").mkdir()
    try:
        L.stream_run(SMALL, run, pin=0, seconds=1, two_viewers=True)
    except RuntimeError as error:
        assert "Another stream command" in str(error) and "--two-viewers" in str(error), error
    else:
        raise AssertionError("a second stream command on one run must be refused")
    assert not (run / "run.json").exists() and list((run / "stream").iterdir()) == []
    print("one command ok: a lifecycle still starting, NordFriend1 alone (also by the command line), a rung without a "
          "size in loop.json and a second stream command on one run are refused")


def check_report_and_profile(group, tune):
    assert L.main(["report", str(group)]) == 1, "the round is not confirmed while stream rows are missing"
    after = json.loads((group / "tune.json").read_text())
    results = {result["id"]: result for result in after["confirmation"]["results"]}
    assert after["confirmation"]["confirmed"] is None and after["stream_evidence"][tune["winner"]][0]["status"] == "pass"
    assert any(reason.startswith("stream rows missing") for reason in results[tune["winner"]]["reasons"]), results
    assert "co-op guard unverified" in results[tune["winner"]]["reasons"]
    verdict = json.loads((group / "verdict.json").read_text())
    assert gates(verdict)["confirmed"]["result"] == "unverified" and gates(verdict)["look_vs_baseline"]["result"] == "pass"
    # One repeat gate, from the tune's two ceiling renders: a second, unverified copy would hold every round at unverified.
    assert [gate["name"] for gate in verdict["gates"]].count("repeat_ssim_min") == 1, verdict["gates"]
    assert gates(verdict)["repeat_ssim_min"]["result"] == "pass" and gates(verdict)["repeat_ssim_min"]["value"] == 1.0
    assert verdict["status"] == "unverified" and (group / "report.json").is_file() and (group / "review.html").is_file()
    page = (group / "review.html").read_text()
    assert page.count('class="row"') == 20 and page.count('class="flip"') == 20 and "05-S1-video.png" in page
    ini = L.PROFILES_INI.read_text()
    real = T.PROFILES_INI.read_text()
    for arguments in (["write-profile", str(group), "--candidate", tune["winner"]],):
        try:
            L.main(arguments)
        except SystemExit as error:
            assert error.code == 2
        else:
            raise AssertionError("write-profile must refuse without --approved")
    assert L.PROFILES_INI.read_text() == ini and not (group / "approval.json").exists()
    assert L.main(["write-profile", str(group), "--candidate", tune["winner"], "--approved"]) == 0
    record = next(record for record in tune["candidates"] if record["id"] == tune["winner"])
    assert T.same_cvars(T.read_profile(L.PROFILES_INI.read_text())["cvars"], record["cvars"]) and L.PROFILES_INI.read_text() != ini
    approval = json.loads((group / "approval.json").read_text())
    assert approval["candidate"] == tune["winner"] and approval["note"] == "this candidate is not the confirmed one"
    ceiling = next(record["id"] for record in tune["candidates"] if record["look_only"])
    written = L.PROFILES_INI.read_text()
    try:
        L.main(["write-profile", str(group), "--candidate", ceiling, "--approved"])
    except SystemExit as error:
        assert error.code == 1
    else:
        raise AssertionError("a look-only candidate never becomes the phone profile")
    assert L.PROFILES_INI.read_text() == written and T.PROFILES_INI.read_text() == real, "the checked-in profile is never written here"
    print("report and profile ok: unconfirmed without stream rows, review rows with A/B flip, write-profile only with --approved")


def check_report_window_cut(group, tune):
    """A native confirmation that the window cut, or that a foreign GPU process shared twice, is missing evidence, as
    one that did not run. The round's confirmed gate stays unverified while a ranked candidate has only missing
    evidence, also after a better ranked candidate failed. A cut result that also holds a failed run counts as failed."""
    winner = tune["winner"]
    following = next(candidate for candidate in tune["ranking"] if candidate not in (winner, "baseline"))
    fail, shared = "day top_landscape: fail (frame_p95)", f"{L.CONFIRM_CONTENDED}: night_rain top_portrait"
    # (case, reasons by candidate, ranking or None for the tune's, confirmed gate, text in its note)
    cases = (("cut", {winner: [L.CONFIRM_CUT]}, None, "unverified", L.CONFIRM_CUT),
             ("cut-after-fail", {winner: [fail, L.CONFIRM_CUT]}, [winner], "fail", L.CONFIRM_CUT),
             ("failed-then-cut", {winner: [fail], following: [L.CONFIRM_CUT]}, None, "unverified", L.CONFIRM_CUT),
             ("contended", {winner: [shared]}, [winner], "unverified", L.CONFIRM_CONTENDED),
             ("contended-after-fail", {winner: [fail, shared]}, [winner], "fail", L.CONFIRM_CONTENDED))
    for name, reasons, ranking, result, note in cases:
        copied = group.parent.parent / "report-window" / name
        shutil.copytree(group, copied)

        def change(data):
            native = data["native_confirmation"]
            runs = next(row["runs"] for row in native["results"] if row["id"] == winner)
            native["results"] = [row for row in native["results"] if row["id"] not in reasons] + [
                {"id": candidate, "runs": runs if why == [fail] else runs[:1], "reasons": why, "passed": False}
                for candidate, why in reasons.items()]
            data["ranking"] = ranking or data["ranking"]
            return data

        edit_json(copied / "tune.json", change)
        verdict = L.round_report(copied, SMALL)
        assert gates(verdict)["confirmed"]["result"] == result and verdict["status"] == result, (name, failing(verdict))
        assert note in gates(verdict)["confirmed"]["note"], (name, gates(verdict)["confirmed"])
    print("window-cut report ok: a cut or twice contended confirmation leaves the round unverified, also after a better "
          "ranked candidate failed; a failed run before the cut or the second contended run fails it")


def report_hall(hall, ranking=("04-shadows2",)):
    """A tune folder in its own Saved/Gauntlet (hall), so no other stream run counts: the baseline and the ranked
    candidates passed the native confirmation. Returns (group, row); row(...) adds one judged stream row of a candidate."""
    group = hall / "20261023T200000Z-tune"
    base = T.make_candidate(SMALL, T.baseline_levels(SMALL), "baseline", 0)
    names = ("baseline",) + tuple(name for name in ranking if name != "baseline")
    records = [dict(base, id=name, phase="baseline" if name == "baseline" else "step") for name in names]
    for record in records:
        T.write_candidate_files(group / "candidates", record)
    runs = [{"run": "x", "sky": sky, "size": size, "status": "pass"} for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]]
    T.write_tune(group / "tune.json", {"started_at": "2026-10-23T20:00:00Z", "candidates": records, "ranking": list(ranking),
                                       "winner": ranking[0], "native_confirmation": {"results": [
                                           {"id": name, "runs": runs, "reasons": [], "passed": True} for name in names]}})

    def row(candidate, label, kind, status, fps=None, pin=0, portrait=False, started="2026-10-23T23:00:00Z"):
        quality = ({"name": "current"} if candidate == "baseline" else
                   {"name": "file", "path": str(group / "candidates" / f"{candidate}.execcmds")})
        folder = hall / f"20261023T230000Z-{label}"
        L.write_json(folder / "run.json", {"kind": "stream", "started_at": started, "label": folder.name, "row": kind,
                                           "pin": pin, "portrait": portrait, "quality": quality})
        L.write_json(folder / "verdict.json", {"status": status, "gates": [], "values": {"two_viewer_fps": fps}})
        return folder

    return group, row


def solo_rows(row, candidate, failed=None):
    """A candidate's solo rows at every stream size, all passing but the size failed, and its passing input row."""
    for key in SMALL["size_use"]["stream"]:
        entry = SMALL["sizes"][key]
        row(candidate, f"{candidate}-{key}", "solo", "fail" if key == failed else "pass", pin=entry["rung"],
            portrait=entry["size"][1] > entry["size"][0])
    row(candidate, f"{candidate}-input", "input", "pass")


def stream_rows(row, candidate, failed=None, two=30.0):
    """solo_rows, and the candidate's two-viewer row."""
    solo_rows(row, candidate, failed)
    row(candidate, f"{candidate}-two", "two_viewer", "report-only", two)


@contextlib.contextmanager
def working_dir(folder):
    """Run commands from folder, as the host runs them from games/nord-unreal/."""
    before = os.getcwd()
    os.chdir(folder)
    try:
        yield
    finally:
        os.chdir(before)


def check_report_coop_contended(out):
    """The co-op guard skips a two-viewer row that a foreign GPU process shared. The baseline's clean row at 30 fps
    drops a candidate at 25 fps, and a later contended baseline row at 20 fps cannot let it pass. A contended row alone
    leaves the guard unverified."""
    hall = out.parent / "coop-hall"
    group, row = report_hall(hall)
    for candidate in ("baseline", "04-shadows2"):
        solo_rows(row, candidate)
    row("04-shadows2", "04-two", "two_viewer", "report-only", 25.0)
    clean = row("baseline", "baseline-two-a", "two_viewer", "report-only", 30.0)
    drop = "two-viewer FPS 25.0 is 5.0 below the baseline's 30.0"
    with patch.object(L, "OUT", hall):
        for name, change, gate, reason in (("clean", None, "fail", drop),
                                           ("contended later", lambda: row("baseline", "baseline-two-b", "two_viewer", "contended", 20.0,
                                                                           started="2026-10-23T23:10:00Z"), "fail", drop),
                                           ("contended alone", lambda: shutil.rmtree(clean), "unverified", "co-op guard unverified")):
            if change:
                change()
            verdict = L.round_report(group, SMALL)
            confirmation = json.loads((group / "tune.json").read_text())["confirmation"]
            reasons = next(result["reasons"] for result in confirmation["results"] if result["id"] == "04-shadows2")
            assert confirmation["confirmed"] is None and reasons == [reason], (name, confirmation)
            assert gates(verdict)["confirmed"]["result"] == gate, (name, gates(verdict)["confirmed"])
    print("co-op guard ok: a contended two-viewer row never counts; the clean baseline row drops the candidate")


def check_report_stream_latest(out):
    """The newest solo row per rung and orientation counts, by run.json started_at: a row sampled again replaces an
    older one that is contended or unverified. A failed row stays a failure, also when a newer row passed. A newest row
    that is contended, unverified or without a verdict is missing evidence, so the round is unverified; a newest failed
    row fails it. The newer row's folder name sorts first, as the user names the folders."""
    newer = "20261023T230000Z-a-newer"
    # (case, older and newer status of 04-shadows2's rung 0 landscape row, confirmed gate, 04-shadows2's reasons)
    cases = (("contended-then-pass", ("contended", "pass"), "pass", []),
             ("unverified-then-pass", ("unverified", "pass"), "pass", []),
             ("fail-then-pass", ("fail", "pass"), "fail", ["stream 20261023T230000Z-z-older: fail"]),
             ("pass-then-contended", ("pass", "contended"), "unverified", [f"stream row unverified: {newer} (contended)"]),
             ("pass-then-unverified", ("pass", "unverified"), "unverified", [f"stream row unverified: {newer} (unverified)"]),
             ("pass-then-no-verdict", ("pass", None), "unverified", [f"stream row unverified: {newer} (no verdict)"]),
             ("pass-then-fail", ("pass", "fail"), "fail", [f"stream {newer}: fail"]))
    for name, (older, latest), gate, reasons in cases:
        hall = out.parent / "latest-hall" / name
        group, row = report_hall(hall)
        for candidate in ("baseline", "04-shadows2"):
            for key in SMALL["size_use"]["stream"][1:] if candidate == "04-shadows2" else SMALL["size_use"]["stream"]:
                entry = SMALL["sizes"][key]
                row(candidate, f"{candidate}-{key}", "solo", "pass", pin=entry["rung"], portrait=entry["size"][1] > entry["size"][0])
            row(candidate, f"{candidate}-input", "input", "pass")
            row(candidate, f"{candidate}-two", "two_viewer", "report-only", 30.0)
        assert SMALL["size_use"]["stream"][0] == "top_landscape" and SMALL["sizes"]["top_landscape"]["rung"] == 0
        row("04-shadows2", "z-older", "solo", older)
        row("04-shadows2", "a-newer", "solo", latest, started="2026-10-23T23:10:00Z")
        with patch.object(L, "OUT", hall):
            verdict = L.round_report(group, SMALL)
        confirmation = json.loads((group / "tune.json").read_text())["confirmation"]
        found = next(result["reasons"] for result in confirmation["results"] if result["id"] == "04-shadows2")
        assert found == reasons and gates(verdict)["confirmed"]["result"] == gate, (name, found, gates(verdict)["confirmed"])
        assert confirmation["confirmed"] == ("04-shadows2" if gate == "pass" else None), (name, confirmation)
    print("latest stream row ok: a row sampled again replaces an older contended or unverified one; a failed row stays "
          "a failure; a newest contended or unverified row is missing evidence")


def check_report_better_open(out):
    """A better ranked candidate with only missing evidence holds the round: report confirms no lower ranked candidate
    in its place, so the confirmed gate stays unverified. Only a failure of the better one confirms the next one."""
    cut = lambda data: dict(data, native_confirmation={"results": [
        dict(result, runs=result["runs"][:1], reasons=[L.CONFIRM_CUT], passed=False) if result["id"] == "04-shadows2" else result
        for result in data["native_confirmation"]["results"]]})
    # (case, 04-shadows2's rung 0 landscape row, its two-viewer row, a tune.json change, confirmed, confirmed gate)
    cases = (("row-contended", "contended", "report-only", None, None, "unverified"),
             ("native-cut", "pass", "report-only", cut, None, "unverified"),
             ("two-viewer-contended", "pass", "contended", None, None, "unverified"),
             ("row-failed", "fail", "report-only", None, "05-gi2", "pass"))
    for name, landscape, two, change, confirmed, gate in cases:
        hall = out.parent / "open-hall" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        for candidate in ("baseline", "04-shadows2", "05-gi2"):
            for key in SMALL["size_use"]["stream"]:
                entry = SMALL["sizes"][key]
                status = landscape if (candidate, key) == ("04-shadows2", "top_landscape") else "pass"
                row(candidate, f"{candidate}-{key}", "solo", status, pin=entry["rung"], portrait=entry["size"][1] > entry["size"][0])
            row(candidate, f"{candidate}-input", "input", "pass")
            row(candidate, f"{candidate}-two", "two_viewer", two if candidate == "04-shadows2" else "report-only", 30.0)
        if change:
            edit_json(group / "tune.json", change)
        with patch.object(L, "OUT", hall):
            verdict = L.round_report(group, SMALL)
        confirmation = json.loads((group / "tune.json").read_text())["confirmation"]
        assert confirmation["confirmed"] == confirmed and gates(verdict)["confirmed"]["result"] == gate, (name, confirmation)
        assert [result["id"] for result in confirmation["results"]] == ["baseline", "04-shadows2"] + ([confirmed] if confirmed else []), name
    print("better ranked open ok: a contended row, a cut confirmation or an unverified co-op guard of the winner keeps "
          "the runner-up unconfirmed; a failed row confirms it")


def check_report_coop_window(out):
    """The co-op guard pairs each two-viewer row of a candidate with the baseline's from the same window: the one
    sampled last before it, else the first after it, at most 12 hours apart. A pair more than 2 FPS apart drops the
    candidate for good. So the baseline row that notes-host step 8 samples with the next candidate, in the same window
    or the next one, does not bring back a dropped candidate, nor does a newer row of that candidate. Rows more than 12
    hours apart, or at another rung or orientation, do not pair, and the guard is unverified. When the baseline's last
    row before the candidate does not count (unverified here, in a morning window 10 hours after the night's), the
    guard does not reach back to the night's counted row: it pairs with the morning's counted row after the candidate.
    confirm reads the round as report does, so it runs the next candidate and not the dropped one."""
    night, next_night = "2026-10-23T", "2026-10-24T"
    drop = "two-viewer FPS 27.5 is 2.5 below the baseline's 30.0"
    dropped = [("baseline", night + "22:00:00Z", 30.0), ("04-shadows2", night + "22:30:00Z", 27.5)]
    # (case, two-viewer rows as (candidate, started_at, FPS), confirmed, 04-shadows2's reasons)
    cases = (("next-window", dropped + [("baseline", next_night + "22:00:00Z", 29.0), ("05-gi2", next_night + "22:30:00Z", 29.0)],
              "05-gi2", [drop]),
             ("same-window", dropped + [("baseline", night + "23:00:00Z", 29.0), ("05-gi2", night + "23:30:00Z", 29.0)], "05-gi2", [drop]),
             ("sampled-again", dropped + [("baseline", night + "23:00:00Z", 29.8), ("04-shadows2", night + "23:30:00Z", 29.5),
                                          ("05-gi2", night + "23:45:00Z", 29.6)], "05-gi2", [drop]),
             ("baseline-after", [("04-shadows2", night + "22:00:00Z", 29.0), ("baseline", night + "22:30:00Z", 30.0)], "04-shadows2", []),
             ("other-night", [("baseline", "2026-10-22T22:00:00Z", 30.0), ("04-shadows2", night + "22:30:00Z", 29.5)], None,
              ["co-op guard unverified"]),
             # A row at rung 1 in portrait, a smaller frame, does not compare with the baseline's at rung 0 in landscape.
             ("other-size", [("baseline", night + "22:00:00Z", 30.0),
                             ("04-shadows2", night + "22:30:00Z", 31.0, {"pin": 1, "portrait": True})], None, ["co-op guard unverified"]),
             ("morning-baseline-unverified", [("baseline", night + "22:00:00Z", 32.0),
                                              ("baseline", next_night + "08:00:00Z", None, {"status": "unverified"}),
                                              ("04-shadows2", next_night + "08:20:00Z", 29.5), ("baseline", next_night + "08:40:00Z", 30.0)],
              "04-shadows2", []))
    for name, twos, confirmed, reasons in cases:
        hall = out.parent / "coop-window" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        for candidate in ("baseline", "04-shadows2", "05-gi2"):
            solo_rows(row, candidate)
        for number, (candidate, started, fps, *options) in enumerate(twos):
            options = dict(options[0]) if options else {}
            row(candidate, f"{candidate}-two-{number}", "two_viewer", options.pop("status", "report-only"), fps, started=started, **options)
        with patch.object(L, "OUT", hall):
            verdict = L.round_report(group, SMALL)
        confirmation = json.loads((group / "tune.json").read_text())["confirmation"]
        found = next(result["reasons"] for result in confirmation["results"] if result["id"] == "04-shadows2")
        assert confirmation["confirmed"] == confirmed and found == reasons, (name, confirmation)
        assert gates(verdict)["confirmed"]["result"] == ("pass" if confirmed else "unverified"), (name, gates(verdict)["confirmed"])
    # The same window, with 04-shadows2's native confirmation cut and 05-gi2's not run: confirm skips the dropped
    # 04-shadows2 and confirms 05-gi2.
    calls = []

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        calls.append(label)
        return L.new_run_dir(label, parent), {"status": "pass", "gates": []}

    hall = out.parent / "coop-window" / "same-window-confirm"
    group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
    edit_json(group / "tune.json", lambda data: dict(data, native_confirmation={"results": [
        dict(result, runs=result["runs"][:1], reasons=[L.CONFIRM_CUT], passed=False) if result["id"] == "04-shadows2" else result
        for result in data["native_confirmation"]["results"] if result["id"] != "05-gi2"]}))
    for candidate in ("baseline", "04-shadows2", "05-gi2"):
        solo_rows(row, candidate)
    for number, (candidate, started, fps) in enumerate(cases[1][1]):
        row(candidate, f"{candidate}-two-{number}", "two_viewer", "report-only", fps, started=started)
    with patch.object(L, "OUT", hall), patch.object(L, "native_run", native_run), contextlib.redirect_stdout(io.StringIO()):
        assert L.main(["confirm", str(group)]) == 0
    assert calls == [f"confirm-05-gi2-{sky}-{size}" for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]], calls
    print("co-op window ok: each two-viewer row pairs with the baseline's from its window, also after an unverified "
          "baseline row, a failed pair drops the candidate for good, and confirm runs the next candidate")


def check_report_coop_failed_drive(out):
    """NordHost's drive failed inside the lap of a two-viewer row (stuck, exit 2) each of the three times it was
    sampled, so each row reads fail. A failed row of 04-shadows2 is a lasting failure, as a failed solo row is: report
    drops it and confirms 05-gi2 instead of waiting on a row that never counts. When the baseline's two-viewer drive
    fails, the baseline has no row to pair with, so the guard of 04-shadows2 stays unverified and the round waits on
    it; the baseline's result names the failed rows."""
    for name, failed, confirmed, waiting in (("candidate", "04-shadows2", "05-gi2", None),
                                             ("baseline", "baseline", None, "04-shadows2")):
        hall = out.parent / "coop-failed-drive" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        for candidate in ("baseline", "04-shadows2", "05-gi2"):
            solo_rows(row, candidate)
            if candidate == failed:
                for number in range(3):
                    row(candidate, f"{candidate}-two-stuck-{number}", "two_viewer", "fail", started=f"2026-10-23T23:{number}0:00Z")
            else:
                row(candidate, f"{candidate}-two", "two_viewer", "report-only", 30.0)
        with patch.object(L, "OUT", hall):
            L.round_report(group, SMALL)
        report = json.loads((group / "report.json").read_text())
        results = {result["id"]: result["reasons"] for result in report["confirmation"]["results"]}
        assert report["confirmed"] == confirmed and report["waiting_on"] == waiting, (name, report["confirmation"])
        assert all(f"stream 20261023T230000Z-{failed}-two-stuck-{n}: fail" in results[failed] for n in range(3)), (name, results)
        if failed == "baseline":
            assert results["04-shadows2"] == ["co-op guard unverified"], results
    print("failed two-viewer drive ok: a candidate whose drive fails with two viewers is dropped; when the baseline's "
          "fails, the round waits on the guard")


def check_report_input_row(out):
    """A ranked candidate needs its input row (stream --look). A failed one drops the candidate, also when a newer one
    passed; a missing one, or a newest one that is contended, is missing evidence. The unranked baseline needs none. A
    failed solo row at rung 2, which loop.json has no size for, is not one of the round's rows."""
    later = "2026-10-23T23:30:00Z"
    first, second = "20261023T230000Z-04-shadows2-input-0", "20261023T230000Z-04-shadows2-input-1"
    # (case, 04-shadows2's input rows as (status, started_at), confirmed, 04-shadows2's reasons)
    cases = (("input-pass", [("pass", None)], "04-shadows2", []),
             ("input-missing", [], None, ["stream rows missing: input row"]),
             ("input-failed", [("fail", None)], "05-gi2", [f"stream {first}: fail"]),
             ("input-failed-then-pass", [("fail", None), ("pass", later)], "05-gi2", [f"stream {first}: fail"]),
             ("input-contended", [("pass", None), ("contended", later)], None, [f"stream row unverified: {second} (contended)"]))
    for name, inputs, confirmed, reasons in cases:
        hall = out.parent / "input-hall" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        for candidate in ("baseline", "04-shadows2", "05-gi2"):
            for key in SMALL["size_use"]["stream"]:
                entry = SMALL["sizes"][key]
                row(candidate, f"{candidate}-{key}", "solo", "pass", pin=entry["rung"], portrait=entry["size"][1] > entry["size"][0])
            row(candidate, f"{candidate}-two", "two_viewer", "report-only", 30.0)
        row("05-gi2", "05-gi2-input", "input", "pass")
        for number, (status, started) in enumerate(inputs):
            row("04-shadows2", f"04-shadows2-input-{number}", "input", status, **({"started": started} if started else {}))
        row("04-shadows2", "04-shadows2-rung2", "solo", "fail", pin=2)
        with patch.object(L, "OUT", hall):
            verdict = L.round_report(group, SMALL)
        confirmation = json.loads((group / "tune.json").read_text())["confirmation"]
        found = {result["id"]: result["reasons"] for result in confirmation["results"]}
        assert confirmation["confirmed"] == confirmed and found["04-shadows2"] == reasons, (name, confirmation)
        assert found["baseline"] == [] and gates(verdict)["confirmed"]["result"] == ("pass" if confirmed else "unverified"), (name, found)
    print("input row ok: a ranked candidate needs it, a failed one drops the candidate, a missing or contended one "
          "holds the round; a row at a rung without a size does not count")


def check_confirm_next(group, tune):
    """The winner passed natively but a stream row dropped it: confirm runs the next ranked candidate's native
    confirmation and adds it to tune.json. It writes no profile."""
    before = json.loads((group / "tune.json").read_text())
    done = [result["id"] for result in before["native_confirmation"]["results"]]
    following = next((candidate for candidate in tune["ranking"] if candidate not in done), None)
    assert following is not None, (tune["ranking"], done)
    profile = L.PROFILES_INI.read_text()
    assert L.main(["confirm", str(group)]) == 0
    after = json.loads((group / "tune.json").read_text())["native_confirmation"]
    assert [result["id"] for result in after["results"]] == done + [following], after["results"]
    added = after["results"][-1]
    assert added["passed"] and len(added["runs"]) == 4 and added["added_at"] and after["confirmed_native"] == tune["winner"]
    assert L.PROFILES_INI.read_text() == profile, "confirm writes no profile"
    # The winner's rung 0 landscape row, sampled again, failed: report drops the winner and reads the next result.
    dropped = L.OUT / "20261023T235900Z-stream-winner-failed"
    L.write_json(dropped / "run.json", {"kind": "stream", "started_at": L.iso_now(), "label": dropped.name, "row": "solo", "pin": 0,
                                        "portrait": False, "quality": {"name": "file", "path": str(group / "candidates" / f"{tune['winner']}.execcmds")}})
    L.write_json(dropped / "verdict.json", {"status": "fail", "gates": [], "values": {}})
    L.main(["report", str(group)])
    results = {result["id"]: result for result in json.loads((group / "tune.json").read_text())["confirmation"]["results"]}
    assert "native confirmation not run" not in results[following]["reasons"], results[following]
    for arguments, text in ((["--candidate", following], "already has"), (["--candidate", "02-ceiling-a"], "not ranked")):
        try:
            L.main(["confirm", str(group), *arguments])
        except SystemExit as error:
            assert error.code == 1, (arguments, error.code)
        else:
            raise AssertionError("confirm must refuse " + " ".join(arguments))
    assert [result["id"] for result in json.loads((group / "tune.json").read_text())["native_confirmation"]["results"]] == done + [following]
    print(f"confirm ok: {following} confirmed natively after the winner, added to tune.json, no profile written")


def check_confirm_window(out):
    """Confirmation against --until, with a fake clock and a fake native_run that takes the planned run time and
    launches nothing. No run starts unless its estimate ends before --until. The baseline here is not ranked, so it
    takes no window time. A result the window cut is not done: confirm runs it again and replaces it, and --candidate
    accepts it. A cut result that also holds a failed run is done, so confirm keeps it and runs the next ranked
    candidate. A ranked baseline below the candidate runs only after the candidate failed."""
    run_s = T.run_estimate_s(SMALL, "perf", SMALL["confirm_laps"])
    full = len(SMALL["sky_order"]) * len(SMALL["size_use"]["confirm"])
    clock, calls, took, shared, failing = [1_000_000.0], [], [run_s], {}, set()

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        calls.append((label, clock[0] + took[0]))
        clock[0] += took[0]
        # shared[label]: how many more runs of that label a foreign GPU process shares. A label in failing fails.
        shared[label] = shared.get(label, 0) - 1
        status = "contended" if shared[label] >= 0 else "fail" if label in failing else "pass"
        return L.new_run_dir(label, parent), {"status": status, "gates": []}

    base = T.make_candidate(SMALL, T.baseline_levels(SMALL), "baseline", 0)
    tune = {"candidates": [dict(base, id=name) for name in ("baseline", "04-shadows2", "05-gi2")],
            "ranking": ["04-shadows2", "05-gi2"], "winner": "04-shadows2"}
    # The search left 60 s, or room for one run of the winner.
    cases = (("short", 60, 0, []), ("winner-cut", 1.5 * run_s, 1, ["--candidate", "04-shadows2"]))
    with patch.object(L, "native_run", native_run), patch.object(L.time, "time", lambda: clock[0]):
        for name, room, ran, arguments in cases:
            group, until = out.parent / "confirm-window" / name, clock[0] + room
            calls.clear()
            native = L.confirm_native(SMALL, tune, group, until=until)
            T.write_tune(group / "tune.json", dict(tune, native_confirmation=native))
            assert all(end <= until for _, end in calls), f"{name}: a run ended {max(e for _, e in calls) - until:.0f} s after --until"
            assert [result["id"] for result in native["results"]] == ["04-shadows2"] and native["stop_reason"] == "window_end", native
            cut = native["results"][-1]
            assert len(cut["runs"]) == ran and cut["reasons"] == ["the window ended before every confirmation run"], cut
            calls.clear()
            assert L.main(["confirm", str(group), *arguments]) == 0, name
            after = json.loads((group / "tune.json").read_text())["native_confirmation"]
            assert [result["id"] for result in after["results"]] == ["04-shadows2"], after["results"]
            assert all(result["passed"] and len(result["runs"]) == full for result in after["results"]), after["results"]
            assert after["confirmed_native"] == "04-shadows2" and [label for label, _ in calls] == [
                f"confirm-04-shadows2-{sky}-{size}" for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]], calls
            assert after["stop_reason"] is None, f"{name}: every result finished, so no stop reason stays: {after['stop_reason']}"
        # The baseline is itself the best ranked candidate without a finished confirmation: confirm runs it once, and
        # when it passes it is the confirmed one, as confirm_native picks it.
        group = out.parent / "confirm-window" / "baseline-ranked"
        failed = {"id": "04-shadows2", "reasons": ["day top_landscape: fail (frame_p95)"], "passed": False,
                  "runs": [{"run": "x", "sky": sky, "size": size, "status": "fail"} for sky in SMALL["sky_order"]
                           for size in SMALL["size_use"]["confirm"]]}
        cut = {"id": "baseline", "runs": failed["runs"][:1], "reasons": [L.CONFIRM_CUT], "passed": False}
        T.write_tune(group / "tune.json", dict(tune, ranking=["04-shadows2", "baseline", "05-gi2"], native_confirmation={
            "results": [failed, cut], "confirmed_native": None, "stop_reason": "window_end"}))
        calls.clear()
        assert L.main(["confirm", str(group)]) == 0
        after = json.loads((group / "tune.json").read_text())["native_confirmation"]
        assert len(calls) == full and [result["id"] for result in after["results"]] == ["04-shadows2", "baseline"], (calls, after)
        assert after["stop_reason"] is None, f"the cut baseline finished, so window_end does not stay: {after['stop_reason']}"
        assert after["confirmed_native"] == "baseline", after["confirmed_native"]
        # The ranked baseline below the candidate does not run first: report reads it only after the candidate. The
        # candidate fails, the next confirm runs the baseline, which passes, and confirm names the baseline as
        # confirm_native does.
        failing.add("confirm-04-shadows2-day-top_landscape")
        low = dict(tune, ranking=["04-shadows2", "baseline"])
        group = out.parent / "confirm-window" / "baseline-below"
        T.write_tune(group / "tune.json", low)
        calls.clear()
        assert L.main(["confirm", str(group)]) == 1
        assert calls and all(label.startswith("confirm-04-shadows2-") for label, _ in calls), calls
        assert L.main(["confirm", str(group)]) == 0
        after = json.loads((group / "tune.json").read_text())["native_confirmation"]
        native = L.confirm_native(SMALL, low, out.parent / "confirm-window" / "baseline-below-native")
        assert [result["id"] for result in after["results"]] == ["04-shadows2", "baseline"], after["results"]
        assert after["confirmed_native"] == native["confirmed_native"] == "baseline", (after["confirmed_native"], native["confirmed_native"])
        # A host 1.5 times slower than the estimate: each run is planned with the longest one measured so far, within one
        # candidate (room for 2.6 estimates) and from the failed winner to the next candidate (room for 7.2), as the
        # search plans.
        took[0] = 1.5 * run_s
        for name, room in (("slow", 2.6 * run_s), ("slow-winner", 7.2 * run_s)):
            group, until = out.parent / "confirm-window" / name, clock[0] + room
            calls.clear()
            native = L.confirm_native(SMALL, tune, group, until=until)
            assert all(end <= until for _, end in calls), f"{name}: a run ended {max(e for _, e in calls) - until:.0f} s after --until"
            assert [result["id"] for result in native["results"]] == ["04-shadows2", "05-gi2"] and native["stop_reason"] == "window_end", native
            assert native["results"][-1]["reasons"] == [L.CONFIRM_CUT], native["results"][-1]
        failing.clear()
        # The search found the host 1.5 times slower than its plan (planned_candidate_s), with and without --reference:
        # the first confirmation run of tune and of confirm is planned 1.5 times longer, so none starts in a window of
        # 1.2 estimates. A search at the model's speed leaves the plan as it was, and the first run starts.
        for reference, slower, started in ((None, 1.5, False), ("reference", 1.5, False), (None, 1.0, True)):
            searched = dict(tune, reference=reference, planned_candidate_s=slower * L.first_candidate_s(SMALL, reference))
            group, until = out.parent / "confirm-window" / f"searched-{reference}-{slower}", clock[0] + 1.2 * run_s
            took[0] = slower * run_s
            calls.clear()
            native = L.confirm_native(SMALL, searched, group, until=until)
            assert bool(calls) is started and all(end <= until for _, end in calls), (reference, slower, calls)
            T.write_tune(group / "tune.json", dict(searched, native_confirmation=native))
            calls.clear()
            L.confirm_next(SMALL, group, until=clock[0] + 1.2 * run_s)
            assert bool(calls) is started, (reference, slower, calls)
        # A foreign GPU process shares the winner's last confirmation run. Once: that run runs again and the winner is
        # confirmed. Twice: the result is missing evidence and not finished, the confirmation stops there, and confirm
        # --candidate runs the winner again and replaces its result.
        took[0] = run_s
        label = "confirm-04-shadows2-night_rain-top_portrait"
        for name, times in (("contended-once", 1), ("contended-twice", 2)):
            group = out.parent / "confirm-window" / name
            shared.clear()
            shared[label] = times
            native = L.confirm_native(SMALL, tune, group)
            T.write_tune(group / "tune.json", dict(tune, native_confirmation=native))
            winner = native["results"][-1]
            assert [result["id"] for result in native["results"]] == ["04-shadows2"], native["results"]
            assert [run["status"] for run in winner["runs"]].count("contended") == times and len(winner["runs"]) == full + 1
            if times == 1:
                assert winner["passed"] and native["confirmed_native"] == "04-shadows2" and native["stop_reason"] is None, native
                # The window cuts the next candidate's confirmation: the stop reason says so, and the winner stays confirmed.
                L.confirm_next(SMALL, group, until=clock[0] + 1)
                after = json.loads((group / "tune.json").read_text())["native_confirmation"]
                assert after["stop_reason"] == "window_end" and after["confirmed_native"] == "04-shadows2", after
                continue
            assert winner["reasons"] == [f"{L.CONFIRM_CONTENDED}: night_rain top_portrait"] and not L.confirmation_finished(SMALL, winner)
            assert native["confirmed_native"] is None and native["stop_reason"] == "contended", native
            calls.clear()
            assert L.main(["confirm", str(group), "--candidate", "04-shadows2"]) == 0
            after = json.loads((group / "tune.json").read_text())["native_confirmation"]
            assert after["confirmed_native"] == "04-shadows2" and after["results"][-1]["passed"] and len(calls) == full, (after, calls)
            assert after["stop_reason"] is None, after["stop_reason"]
        # 04-shadows2 failed a run before the window cut its confirmation, or before a foreign GPU process shared a later
        # run twice. Report counts that result as failed, so confirm keeps it and runs the next ranked candidate. When a
        # foreign GPU process then shares 05-gi2's first run twice, the stop reason is contended, not window_end.
        passed = {"id": "baseline", "reasons": [], "passed": True,
                  "runs": [{"run": "x", "sky": sky, "size": size, "status": "pass"} for sky in SMALL["sky_order"]
                           for size in SMALL["size_use"]["confirm"]]}
        first = {"run": "x", "sky": "day", "size": "top_landscape", "status": "fail"}
        twice = [{"run": "y", "sky": "day", "size": "top_portrait", "status": "contended"}] * 2
        for name, runs, tail, contend, code, stop in (
                ("failed-then-cut", [first], L.CONFIRM_CUT, 2, 1, "contended"),
                ("failed-then-contended", [first] + twice, f"{L.CONFIRM_CONTENDED}: day top_portrait", 0, 0, None)):
            group = out.parent / "confirm-window" / name
            failed = {"id": "04-shadows2", "runs": runs, "reasons": ["day top_landscape: fail (frame_p95)", tail], "passed": False}
            T.write_tune(group / "tune.json", dict(tune, native_confirmation={"results": [passed, failed], "confirmed_native": None,
                                                                              "stop_reason": "window_end"}))
            shared.clear()
            shared["confirm-05-gi2-day-top_landscape"] = contend
            calls.clear()
            assert L.main(["confirm", str(group)]) == code, name
            after = json.loads((group / "tune.json").read_text())["native_confirmation"]
            assert [result["id"] for result in after["results"]] == ["baseline", "04-shadows2", "05-gi2"], (name, after["results"])
            assert after["results"][1] == failed and all("confirm-04-shadows2" not in label for label, _ in calls), (name, calls)
            assert after["stop_reason"] == stop and after["confirmed_native"] == (None if contend else "05-gi2"), (name, after)
            try:
                L.main(["confirm", str(group), "--candidate", "04-shadows2"])
            except SystemExit as error:
                assert error.code == 1, (name, error.code)
            else:
                raise AssertionError(f"{name}: confirm --candidate must refuse a result that holds a failed run")
    print("confirm window ok: no run ends after --until, a slow host raises the plan (also the first run, from the search), "
          "confirm runs a cut result again and replaces it, a ranked baseline runs once and can be the confirmed one, "
          "a contended run runs once more, a failed run is final also in a cut or contended result, and confirm keeps "
          "the stop reason current")


def check_confirm_dropped(out):
    """A failed stream row or the co-op guard dropped the winner while its native confirmation was cut, or never ran
    (tune --no-confirm). Its native confirmation cannot change the verdict, so confirm runs the next ranked candidate
    (and not the unranked baseline, which has no result) and refuses --candidate for the dropped one, as report reads
    the round.
    It does so also when the folder is relative, as notes-host step 9 gives it, and its runs get absolute folders."""
    calls, parents = [], []

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        calls.append(label)
        parents.append(parent)
        return L.new_run_dir(label, parent), {"status": "pass", "gates": []}

    def refused(arguments):
        errors = io.StringIO()
        try:
            with contextlib.redirect_stderr(errors):
                L.main(["confirm", *arguments])
        except SystemExit as error:
            assert error.code == 1, (arguments, error.code)
            return errors.getvalue()
        raise AssertionError("confirm must refuse " + " ".join(arguments))

    # The window cut the winner's confirmation after one run, and 05-gi2 never ran; or tune --no-confirm ran none.
    cut = lambda data: dict(data, native_confirmation={"results": [
        dict(result, runs=result["runs"][:1], reasons=[L.CONFIRM_CUT], passed=False) if result["id"] == "04-shadows2" else result
        for result in data["native_confirmation"]["results"] if result["id"] != "05-gi2"], "confirmed_native": None,
        "stop_reason": "window_end"})
    unconfirmed = lambda data: {key: value for key, value in data.items() if key != "native_confirmation"}
    drops = {"row": ("top_landscape", 30.0, "stream 20261023T230000Z-04-shadows2-top_landscape: fail"),
             "coop": (None, 25.0, "two-viewer FPS 25.0 is 5.0 below the baseline's 30.0")}
    labels = lambda candidates: [f"confirm-{candidate}-{sky}-{size}" for candidate in candidates for sky in SMALL["sky_order"]
                                 for size in SMALL["size_use"]["confirm"]]
    # notes-host step 9 runs confirm from games/nord-unreal/ with a relative folder; here it is relative to out.parent.
    cases = [(native, drop, given) for native in (("cut", cut, L.CONFIRM_CUT, ["05-gi2"]),
                                                  ("no-confirm", unconfirmed, "native confirmation not run", ["05-gi2"]))
             for drop in drops.items() for given in ("absolute", "relative")]
    with patch.object(L, "native_run", native_run):
        for (native_name, change, missing, ran), (drop, (failed, two, reason)), given in cases:
            name = f"{native_name}-{drop}-{given}"
            hall = out.parent / "dropped-hall" / name
            group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
            folder = str(group if given == "absolute" else group.relative_to(out.parent))
            edit_json(group / "tune.json", change)
            stream_rows(row, "baseline")
            stream_rows(row, "04-shadows2", failed, two)
            with patch.object(L, "OUT", hall), working_dir(out.parent):
                # The stream rows' quality paths are absolute, as browser_streaming resolves them; the folder may not be.
                L.round_report(Path(folder), SMALL)
                results = {result["id"]: result["reasons"] for result in
                           json.loads((group / "tune.json").read_text())["confirmation"]["results"]}
                assert results["04-shadows2"] == [missing, reason], (name, results)
                calls.clear()
                parents.clear()
                assert L.main(["confirm", folder]) == 0, name
                assert calls == labels(ran), (name, calls)
                # A run under a relative folder would hand the game a path relative to another working directory.
                assert all(Path(parent).is_absolute() and Path(parent).resolve() == (group / "runs").resolve()
                           for parent in parents), (name, parents)
                native = json.loads((group / "tune.json").read_text())["native_confirmation"]
                kept = {result["id"]: result["reasons"] for result in native["results"]}
                # The dropped winner's cut result stays as it was, and a winner without one gets none.
                assert native["confirmed_native"] == "05-gi2" and kept["05-gi2"] == [], (name, native)
                assert kept.get("04-shadows2") == ([L.CONFIRM_CUT] if native_name == "cut" else None), (name, kept)
                calls.clear()
                message = refused([folder, "--candidate", "04-shadows2"])
                assert "is dropped" in message and reason in message and not calls, (name, message, calls)
                message = refused([folder])
                assert "Every ranked candidate" in message and not calls, (name, message, calls)
                # 05-gi2's stream rows then pass: report confirms it.
                stream_rows(row, "05-gi2")
                verdict = L.round_report(Path(folder), SMALL)
                assert json.loads((group / "tune.json").read_text())["confirmation"]["confirmed"] == "05-gi2", name
                assert gates(verdict)["confirmed"]["result"] == "pass", (name, gates(verdict)["confirmed"])
    print("confirm after a drop ok: a winner that a failed stream row or the co-op guard dropped is not confirmed again "
          "when its confirmation was cut or never ran, also from a relative folder; confirm runs the next ranked candidate "
          "and refuses --candidate for it")


def check_confirm_dropped_baseline(out):
    """The baseline is ranked first, the window cut its native confirmation, and its rung 0 landscape row failed, so
    the round dropped it. confirm runs the next ranked candidate (05-gi2) and not the baseline's cut confirmation
    first: that result cannot change the verdict, and a cut there would stop the candidate from running."""
    calls = []

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        calls.append(label)
        return L.new_run_dir(label, parent), {"status": "pass", "gates": []}

    hall = out.parent / "dropped-baseline"
    group, row = report_hall(hall, ranking=("baseline", "05-gi2"))
    edit_json(group / "tune.json", lambda data: dict(data, native_confirmation={"results": [
        dict(result, runs=result["runs"][:1], reasons=[L.CONFIRM_CUT], passed=False)
        for result in data["native_confirmation"]["results"] if result["id"] == "baseline"], "confirmed_native": None,
        "stop_reason": "window_end"}))
    stream_rows(row, "baseline", failed="top_landscape")
    stream_rows(row, "05-gi2")
    with patch.object(L, "OUT", hall), patch.object(L, "native_run", native_run), contextlib.redirect_stdout(io.StringIO()):
        assert L.main(["confirm", str(group)]) == 0
        verdict = L.round_report(group, SMALL)
    assert calls == [f"confirm-05-gi2-{sky}-{size}" for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]], calls
    native = json.loads((group / "tune.json").read_text())["native_confirmation"]
    assert [result["id"] for result in native["results"]] == ["baseline", "05-gi2"] and native["results"][0]["reasons"] == [L.CONFIRM_CUT]
    assert json.loads((group / "report.json").read_text())["confirmed"] == "05-gi2" and gates(verdict)["confirmed"]["result"] == "pass"
    print("dropped baseline ok: confirm runs the next ranked candidate without the dropped baseline's cut confirmation")


def check_confirm_unverified(out):
    """A native confirmation run that is unverified (a gate without a value and none failed) runs once more, as a
    contended run does, so one missed nvidia-smi listing does not leave the rest of the window idle: when the second
    run gives a verdict, the candidate is confirmed in the same window. A second unverified run is missing evidence,
    not a failure. The confirmation stops at that candidate (stop_reason unverified), report confirms no lower ranked
    candidate and waits on it, and confirm runs it again and replaces its result. With a failed run in the same
    result, the result is final and the next candidate is confirmed."""
    unverified, failing_runs, calls = {}, set(), []

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        # unverified[label]: how many more runs of that label are unverified.
        calls.append(label)
        unverified[label] = unverified.get(label, 0) - 1
        status = "unverified" if unverified[label] >= 0 else "fail" if label in failing_runs else "pass"
        found = {"unverified": [{"name": "vram_peak_mib", "result": "unverified"}], "fail": [{"name": "frame_p95", "result": "fail"}]}
        return L.new_run_dir(label, parent), {"status": status, "gates": found.get(status, [])}

    label = "confirm-04-shadows2-day-top_landscape"
    full = len(SMALL["sky_order"]) * len(SMALL["size_use"]["confirm"])
    for name, times, failed in (("unverified-once", 1, False), ("unverified", 2, False), ("unverified-and-failed", 2, True)):
        hall = out.parent / "confirm-unverified" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        for candidate in ("baseline", "04-shadows2", "05-gi2"):
            stream_rows(row, candidate)
        tune = json.loads((group / "tune.json").read_text())
        unverified.clear()
        unverified[label] = times
        calls.clear()
        if failed:
            failing_runs.add("confirm-04-shadows2-night_rain-top_portrait")
        with patch.object(L, "OUT", hall), patch.object(L, "native_run", native_run), contextlib.redirect_stdout(io.StringIO()):
            native = L.confirm_native(SMALL, tune, group)
            T.write_tune(group / "tune.json", dict(tune, native_confirmation=native))
            L.round_report(group, SMALL)
            report = json.loads((group / "report.json").read_text())
            winner = next(result for result in native["results"] if result["id"] == "04-shadows2")
            assert calls.count(label) == 2 and len(winner["runs"]) == full + 1, (name, calls)
            if times == 1:
                assert winner["passed"] and L.confirmation_finished(SMALL, winner), (name, winner)
                assert native["confirmed_native"] == report["confirmed"] == "04-shadows2" and native["stop_reason"] is None, native
                continue
            assert winner["reasons"][0] == f"{L.CONFIRM_UNVERIFIED}: day top_landscape: unverified (vram_peak_mib)", winner
            if failed:
                assert native["confirmed_native"] == "05-gi2" and native["stop_reason"] is None, native
                assert report["confirmed"] == "05-gi2", report["confirmation"]
                continue
            assert [result["id"] for result in native["results"]] == ["04-shadows2"], native["results"]
            assert native["confirmed_native"] is None and native["stop_reason"] == "unverified", native
            assert report["confirmed"] is None and report["waiting_on"] == "04-shadows2", report["confirmation"]
            # confirm runs 04-shadows2 again, which now gives a verdict, and the round confirms it.
            unverified.clear()
            assert L.main(["confirm", str(group)]) == 0
            after = json.loads((group / "tune.json").read_text())["native_confirmation"]
            assert after["confirmed_native"] == "04-shadows2" and after["stop_reason"] is None, after
            L.round_report(group, SMALL)
            assert json.loads((group / "report.json").read_text())["confirmed"] == "04-shadows2"
        failing_runs.clear()
    print("unverified confirmation run ok: it runs once more; a second one is missing evidence that holds the round until "
          "confirm runs it again; with a failed run the result is final")


def check_confirm_baseline_open(out):
    """Report reads the baseline's native result only when it reaches the baseline in the ranking. So tune and confirm
    run the baseline's native confirmation only when report reads it before the candidate's: when the baseline is
    ranked above the candidate. An unranked baseline, or one ranked below 04-shadows2, takes no window time: tune runs
    and confirms 04-shadows2 alone. When an earlier tune left an unranked baseline's result open (an unverified run),
    and a failed stream row dropped 04-shadows2, confirm in a window with room for 5 runs (also with --candidate) runs
    05-gi2's 4 runs, not the baseline's first, and report confirms 05-gi2. A baseline ranked above the candidate runs
    first, and when it does not finish (an unverified run twice, or a run contended twice), it stops the
    confirmation."""
    unverified, shared, calls, clock = set(), {}, [], [1_000_000.0]
    run_s = T.run_estimate_s(SMALL, "perf", SMALL["confirm_laps"])

    def native_run(loop, mode, size_key, sky, laps=1, quality="current", label=None, direct=False, parent=None, **_):
        calls.append(label)
        clock[0] += run_s
        shared[label] = shared.get(label, 0) - 1
        status = "contended" if shared[label] >= 0 else "unverified" if label in unverified else "pass"
        found = [{"name": "vram_peak_mib", "result": "unverified"}] if status == "unverified" else []
        return L.new_run_dir(label, parent), {"status": status, "gates": found}

    labels = lambda candidate: [f"confirm-{candidate}-{sky}-{size}" for sky in SMALL["sky_order"]
                                for size in SMALL["size_use"]["confirm"]]
    first = labels("baseline")[0]
    # As an earlier tune left it: the unranked baseline's result is open and 04-shadows2 passed natively, but its rung 0
    # landscape row failed, so report waits on 05-gi2. The baseline's 4 runs would take the window and cut 05-gi2.
    hall = out.parent / "baseline-open" / "earlier-tune"
    group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
    open_baseline = {"id": "baseline", "passed": False, "reasons": [f"{L.CONFIRM_UNVERIFIED}: day top_landscape: unverified (vram_peak_mib)"],
                     "runs": [{"run": "x", "sky": sky, "size": size, "status": "unverified" if (sky, size) == ("day", "top_landscape") else "pass"}
                              for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]]}
    earlier = dict(json.loads((group / "tune.json").read_text()))
    earlier["native_confirmation"] = {"confirmed_native": "04-shadows2", "stop_reason": "unverified", "results": [open_baseline] + [
        result for result in earlier["native_confirmation"]["results"] if result["id"] == "04-shadows2"]}
    stream_rows(row, "baseline")
    stream_rows(row, "04-shadows2", failed="top_landscape")
    stream_rows(row, "05-gi2")
    for candidate in (None, "05-gi2"):
        T.write_tune(group / "tune.json", earlier)
        calls.clear()
        with patch.object(L, "OUT", hall), patch.object(L, "native_run", native_run), patch.object(L.time, "time", lambda: clock[0]), \
                contextlib.redirect_stdout(io.StringIO()):
            outcome = L.confirm_next(SMALL, group, candidate, until=clock[0] + 5.5 * run_s)
            L.round_report(group, SMALL)
        report = json.loads((group / "report.json").read_text())
        assert calls == labels("05-gi2") and outcome["id"] == "05-gi2" and outcome["passed"], (candidate, calls, outcome)
        assert report["confirmed"] == "05-gi2" and report["waiting_on"] is None, (candidate, report["confirmation"])
    # (case, ranking, how the baseline's first run ends, the runs of the tune's confirmation, whether 04-shadows2 is
    # confirmed). An unverified run runs once more, so a baseline run that is unverified every time runs twice.
    cases = (("unranked", ("04-shadows2", "05-gi2"), "unverified", labels("04-shadows2"), True),
             ("ranked-below", ("04-shadows2", "baseline", "05-gi2"), "unverified", labels("04-shadows2"), True),
             ("ranked-above", ("baseline", "04-shadows2"), "unverified", [first] + labels("baseline"), False),
             ("ranked-above-contended", ("baseline", "04-shadows2"), "contended", [first, first], False))
    for name, ranking, ending, ran, goes_on in cases:
        hall = out.parent / "baseline-open" / name
        group, row = report_hall(hall, ranking=ranking)
        for candidate in ("baseline", "04-shadows2"):
            stream_rows(row, candidate)
        tune = {key: value for key, value in json.loads((group / "tune.json").read_text()).items() if key != "native_confirmation"}
        unverified.clear()
        shared.clear()
        if ending == "unverified":
            unverified.add(first)
        else:
            shared[first] = 2
        calls.clear()
        with patch.object(L, "OUT", hall), patch.object(L, "native_run", native_run), contextlib.redirect_stdout(io.StringIO()):
            native = L.confirm_native(SMALL, tune, group)
            T.write_tune(group / "tune.json", dict(tune, native_confirmation=native))
            L.round_report(group, SMALL)
        report = json.loads((group / "report.json").read_text())
        assert calls == ran, (name, calls)
        assert native["confirmed_native"] == report["confirmed"] == ("04-shadows2" if goes_on else None), (
            name, native, report["confirmation"])
        assert report["waiting_on"] == (None if goes_on else "baseline"), (name, report["waiting_on"])
        if not goes_on:
            assert native["results"][0]["id"] == "baseline" and not L.confirmation_finished(SMALL, native["results"][0]), (
                name, native["results"])
    print("open baseline confirmation ok: tune and confirm run the baseline only when it is ranked above the candidate, "
          "so an unranked baseline or one ranked below takes no window time; one ranked above that does not finish "
          "stops the confirmation")


def check_waiting_on(out):
    """tune and report print waiting_on, the candidate whose stream rows notes-host step 8 samples. When the winner
    failed its native confirmation and 05-gi2 passed, it is 05-gi2, so no lifecycle samples a dropped winner. When the
    winner's confirmation was cut or never ran, it is the winner. Once a candidate is confirmed, or a failure dropped
    every ranked candidate, it is empty."""
    def printed(arguments):
        text = io.StringIO()
        with contextlib.redirect_stdout(text):
            L.main(arguments)
        return json.loads(text.getvalue().splitlines()[-1])

    def native(failed):
        """Every ranked candidate in failed failed its day top_portrait confirmation run; the others passed."""
        def change(data):
            results = [dict(result, reasons=["day top_portrait: fail (frame_p95_ms)"], passed=False) if result["id"] in failed
                       else result for result in data["native_confirmation"]["results"]]
            passed = next((ranked for ranked in data["ranking"] if ranked not in failed), None)
            return dict(data, native_confirmation={"results": results, "confirmed_native": passed, "stop_reason": None})
        return change

    cut = lambda data: dict(data, native_confirmation={"results": [
        dict(result, runs=result["runs"][:1], reasons=[L.CONFIRM_CUT], passed=False) if result["id"] == "04-shadows2" else result
        for result in data["native_confirmation"]["results"] if result["id"] != "05-gi2"], "confirmed_native": None,
        "stop_reason": "window_end"})
    unconfirmed = lambda data: {key: value for key, value in data.items() if key != "native_confirmation"}
    # (case, tune.json change, confirmed_native, waiting_on before any candidate row, after its rows passed, confirmed)
    cases = (("winner-failed-native", native({"04-shadows2"}), "05-gi2", "05-gi2", None, "05-gi2"),
             ("winner-passed", None, None, "04-shadows2", None, "04-shadows2"),
             ("winner-cut", cut, None, "04-shadows2", "04-shadows2", None),
             ("no-confirm", unconfirmed, None, "04-shadows2", "04-shadows2", None),
             ("every-one-failed", native({"04-shadows2", "05-gi2"}), None, None, None, None))
    for name, change, confirmed_native, before, after, confirmed in cases:
        hall = out.parent / "waiting-hall" / name
        group, row = report_hall(hall, ranking=("04-shadows2", "05-gi2"))
        if change:
            edit_json(group / "tune.json", change)
        stream_rows(row, "baseline")
        tune = dict(json.loads((group / "tune.json").read_text()), stop_reason="max_candidates")
        with patch.object(L, "OUT", hall), patch.object(L, "tune_run", lambda *_: (group, tune)):
            line = printed(["tune"])
            assert line["winner"] == "04-shadows2" and line["confirmed_native"] == confirmed_native, (name, line)
            assert line["waiting_on"] == before, (name, line)
            line = printed(["report", str(group)])
            assert line["waiting_on"] == before, (name, line)
            assert json.loads((group / "report.json").read_text())["waiting_on"] == before, name
            assert json.loads((group / "verdict.json").read_text())["waiting_on"] == before, name
            if before:
                stream_rows(row, before)
                line = printed(["report", str(group)])
                report = json.loads((group / "report.json").read_text())
                assert line["waiting_on"] == after and report["confirmed"] == confirmed, (name, line, report["confirmation"])
    print("waiting_on ok: tune and report name the candidate to sample, the one that passed natively and not a winner "
          "that failed; the winner while its confirmation is cut or not run; none once one is confirmed or all failed")


def main():
    with tempfile.TemporaryDirectory() as directory, contextlib.ExitStack() as stack:
        root = Path(directory)
        out, state, package = root / "Saved/Gauntlet", root / "fake/state", root / "fake/package"
        for folder in (out, state, package / "Quebec/Saved/Profiling/CSV", root / "fake/ue/Engine/Build/BatchFiles"):
            folder.mkdir(parents=True)
        (root / "fake/game.py").write_text(FAKE_GAME)
        (root / "fake/smi.py").write_text(FAKE_SMI)
        (root / "fake/sampler.py").write_text(FAKE_SAMPLER)
        (package / "Quebec.sh").write_text(f'#!/bin/bash\nexec "{sys.executable}" "{root}/fake/game.py" direct "$@"\n')
        uat = root / "fake/ue/Engine/Build/BatchFiles/RunUAT.sh"
        uat.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{root}/fake/game.py" uat "$@"\n')
        uat.chmod(0o755)
        (root / "fake/loop.json").write_text(json.dumps(SMALL))
        ini = root / "DefaultDeviceProfiles.ini"
        ini.write_text(T.PROFILES_INI.read_text())
        stack.enter_context(patch.dict(os.environ, {"FAKE_STATE": str(state), "FAKE_LOOP": str(root / "fake/loop.json"),
                                                    "FAKE_CSV_DIR": str(package / "Quebec/Saved/Profiling/CSV")}))
        for target, name, value in ((L, "OUT", out), (browser_streaming, "GAUNTLET", out), (L, "PACKAGE", package), (L, "UAT", uat),
                                    (L, "SMI", [sys.executable, str(root / "fake/smi.py")]),
                                    (L, "SAMPLER", [sys.executable, str(root / "fake/sampler.py")]), (L, "SAMPLE_S", .1),
                                    (L, "TAIL_S", .05), (L, "LIFECYCLE", root / "BrowserStreaming/lifecycle.json"), (L, "PROFILES_INI", ini),
                                    # A fixed commit: the checkpoint job may commit while this runs, which would refuse the reference.
                                    (L, "git_state", lambda: {"commit": "f" * 40, "dirty": False})):
            stack.enter_context(patch.object(target, name, value))
        check_default_line()
        check_refusals(out, state)
        check_direct_perf(out, package)
        check_rununreal_perf(out, package)
        check_contended(out, state)
        check_mismatch_and_phone()
        check_look(out)
        reference = check_reference(out)
        group, tune = check_tune(out)
        check_tune_first_ceiling_contended(state)
        check_tune_with_reference(out, reference)
        check_reference_missing_sky(out)
        check_reference_contended(out, state)
        check_tune_partial_look()
        check_tune_window()
        check_tune_slow_host()
        run, two, relay = check_stream(out, state, group, tune["winner"])
        check_stream_lost(run)
        check_two_viewer_whole(two)
        check_failed_drive(out, two, relay)
        check_follow_to_result(out)
        check_stream_input(out, state, group, tune["winner"])
        check_stream_one_command(out)
        check_report_and_profile(group, tune)
        check_report_window_cut(group, tune)
        check_report_coop_contended(out)
        check_report_stream_latest(out)
        check_report_better_open(out)
        check_report_coop_window(out)
        check_report_coop_failed_drive(out)
        check_report_input_row(out)
        check_confirm_next(group, tune)
        check_confirm_window(out)
        check_confirm_dropped(out)
        check_confirm_dropped_baseline(out)
        check_confirm_unverified(out)
        check_confirm_baseline_open(out)
        check_waiting_on(out)
    print("NORD_GAUNTLET_LOOP_OK")


if __name__ == "__main__":
    main()
