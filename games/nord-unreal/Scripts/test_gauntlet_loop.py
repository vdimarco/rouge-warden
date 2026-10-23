"""Offline checks for Scripts/gauntlet_loop.py with a fake RunUAT, a fake packaged game, a fake nvidia-smi and a fake
stream sampler (no Unreal, no GPU, no browser).

Run from games/nord-unreal:  python3 Scripts/test_gauntlet_loop.py
Checks both command lines (direct and RunUnreal), the run folder layout, the sky and label refusals, the contention
label, the CVar readback, the phone profile flag, a look run scored against a ceiling, a short tune with its native
confirmation and round report, a stream lap with its trigger file and lap window, the write-profile refusal without
--approved, and that browser_streaming.py without NORD_STREAM_QUALITY keeps today's exact launch line. Everything is
written to a temporary folder; the real Saved/Gauntlet and Config/DefaultDeviceProfiles.ini are never written.
"""
import contextlib
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
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
import json, math, os, re, sys, time, zlib
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
    for shown in loop["sky_order"]:
        say(f"NORD_GAUNTLET sky={shown} hour=15.0 weather=Clear")
        for label in order:
            say(f"NORD_GAUNTLET stop={label} lap=1 hold=begin hold_s=24.0")
            for view in loop["views"]["per_stop"]:
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
# Xorg; the compute query lists nothing, as on a Vulkan-only host; pmon prints two samples of the games.
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

# stream-sample.mjs: it plays the host's part too (the NORD_GAUNTLET lines go to the host log), waits for each stop in
# the trigger file before it saves that stop's shots, samples 30 decoded frames per second, and writes sample.json and
# frames.json in the sampler's own layout: shots/<NN>-<line>-video.png and -page.png listed in sample.json, the
# requested and received size events, and frames with performance.now() times only (no wall clock).
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
trigger, host_log = Path(value("--trigger")), Path(os.environ["FAKE_HOST_LOG"])
loop = json.loads(Path(os.environ["FAKE_LOOP"]).read_text())
width, height = next(e["size"] for e in loop["sizes"].values()
                     if e["rung"] == int(value("--pin")) and (e["size"][1] > e["size"][0]) == ("--portrait" in args))
start = time.time() * 1000
samples, shots = [], []
events = [{"timeMs": start, "kind": "received", "width": width, "height": height}]

def tick(seconds):
    end = time.time() + seconds
    while time.time() < end:
        now = time.time() * 1000
        decoded = int((now - start) / 1000 * 30)
        samples.append({"timeMs": now, "framesDecoded": decoded, "framesReceived": decoded, "framesDropped": 0,
                        "bytesReceived": decoded * 20000, "freezeCount": 0, "totalFreezesDuration": 0, "totalDecodeTime": decoded * .004,
                        "jitterBufferDelay": decoded * .05, "jitterBufferEmittedCount": decoded, "packetsLost": 0, "longestFrameGapMs": 34,
                        "width": width, "height": height, "requested": f"{width}x{height}", "candidate": {"type": "host"}, "codec": "video/VP8"})
        time.sleep(.05)

def say(text):
    if value("--slot") == "NordHost":
        with host_log.open("a") as handle:
            handle.write("[2026.10.23-23.00.00:000][  0]LogQuebec: Display: " + text + "\n")

tick(.2)
order = loop["order"]
for n, label in enumerate(order):
    say(f"NORD_GAUNTLET route stop={label} x_m=0.00 y_m=0.00 along_m={n * 700:.1f} leg={label}-{order[(n + 1) % len(order)]} leg_m=700.0")
for row in Path(os.environ["FAKE_EXPECT"]).read_text().splitlines():
    if row and not row.startswith("#"):
        name, want = row.split("=", 1)
        say(f"NORD_GAUNTLET cvar name={name} expected={want} actual={want} match=1")
tick(.3)
say(f"NORD_GAUNTLET leg={order[0]}-{order[1]} lap=1 begin")
tick(.3)
for label in order[1:] + order[:1]:
    say(f"NORD_GAUNTLET stop={label} lap=1 hold=begin hold_s=4.0")
    say("NORD_STREAM_FPS frames=150 seconds=5.00 sleeping=0 streamer=NordHost")
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
if value("--slot") == "NordHost":
    native = Path(os.environ["FAKE_EXPECT"]).parent / "native"
    native.mkdir(exist_ok=True)
    rows = ["FrameTime,GameThreadTime,RenderThreadTime,RHIThreadTime,GPUTime,EVENTS"]
    for n, label in enumerate(order):
        event = f"NordGauntlet leg={label}-{order[(n + 1) % len(order)]} lap=1"
        rows += [f"{16.7 + k % 3 * .1:.3f},8.000,9.000,6.000,{12 + n:.3f},{event if k == 0 else ''}" for k in range(30)]
    rows += ["16.7,8,9,6,12,", "16.7,8,9,6,12,"]
    (native / "NordGauntlet-stream-night_rain.csv").write_text("\n".join(rows) + "\n")
tick(.4)
say("NORD_GAUNTLET summary leg=S1-S2 lap=all frames=30 p95_ms=16.900")
say("NORD_GAUNTLET result exit=0 reason=done mode=stream laps=1 max_offset_m=0.900")
tick(.4)
count = int((samples[-1]["timeMs"] - start) / 1000 * 30)
frames = [{"presentedFrames": n, "expectedDisplayTime": 1000.0 + n * 1000 / 30, "mediaTime": n / 30, "width": width, "height": height}
          for n in range(count)]
(out / "frames.json").write_text(json.dumps(frames))
(out / "sample.json").write_text(json.dumps({"slot": value("--slot"), "samples": samples, "events": events, "shots": shots,
                                             "summary": {"decodedFps": 30.0, "jitterBufferMsPerFrame": 50.0, "decodeMsPerFrame": 4.0,
                                                         "delay": {"rttMs": {"mean": 2.1, "max": 3.0}, "jitterMs": {"mean": 1.0, "max": 2.0},
                                                                   "frontend": {"events": 3, "averageE2ELatency": 38.0}},
                                                         "encoderQp": {"events": 3, "mean": 20.0, "max": 24}}}))
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
                       f"execcmds='{run}/quality.execcmds',expect='{run}/quality.expect')"], command
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
    assert T.same_cvars(expected, T.read_profile(T.PROFILES_INI.read_text())["cvars"]) and verdict["status"] == "pass", failing(verdict)
    print("readback ok: a CVar mismatch fails the run with exit 4, a hung game is killed as a timeout (exit 5), "
          "phone passes -DeviceProfile and reads the section back")


def check_reference(out):
    group, verdict = L.reference_run(SMALL, direct=True)
    result = json.loads((group / "reference.json").read_text())
    assert group.parent == out and set(result["sizes"]) == set(SMALL["size_use"]["confirm"]), result["sizes"]
    for size_key, entry in result["sizes"].items():
        assert len(entry["repeat"]) == 20 and entry["min"] == 1.0 and Path(entry["a"]["run"]).parent == group / "runs", size_key
        assert json.loads((Path(entry["b"]["run"]) / "run.json").read_text())["quality"]["path"] == str(group / "candidates/00-ceiling.execcmds")
    assert verdict["status"] == "pass" and set(gates(verdict)) == {"repeat_ssim_min:top_landscape", "repeat_ssim_min:top_portrait"}
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
    confirmation = tune["native_confirmation"]
    assert [result["id"] for result in confirmation["results"]] == ["baseline", tune["winner"]], confirmation
    assert confirmation["confirmed_native"] == tune["winner"] and all(len(result["runs"]) == 4 for result in confirmation["results"])
    assert {(run["sky"], run["size"]) for run in confirmation["results"][1]["runs"]} == {
        (sky, size) for sky in SMALL["sky_order"] for size in SMALL["size_use"]["confirm"]}
    print(f"tune ok: 6 candidates ({tune['winner']} wins), every run kept, native confirmation of the baseline and the winner")
    return group, tune


def check_tune_with_reference(out, reference):
    group, tune = L.tune_run(SMALL, reference=reference, confirm=False)
    sizes = json.loads((reference / "reference.json").read_text())["sizes"]["top_landscape"]
    ceilings = [tune["runs"][r["id"]]["look"] for r in tune["candidates"] if r["phase"] == "ceiling"]
    assert ceilings == [sizes["a"]["run"], sizes["b"]["run"]] and not any((group / "runs").glob("*ceiling*")), ceilings
    assert tune["ties"]["repeat"]["min"] == 1.0 and tune["baseline"]["look"] is not None and "native_confirmation" not in tune
    print("tune with --reference ok: the stored ceiling renders are reused, nothing is rendered twice")


def check_stream(out, state, group, winner):
    run = out / "20261023T230000Z-stream-winner"
    run.mkdir()
    quality = browser_streaming.stream_quality(f"file:{group / 'candidates' / (winner + '.execcmds')}")
    (run / "stream.expect").write_text(browser_streaming.gauntlet_expect(quality))
    host_log = out / "host-test.log"
    host_log.write_text("LogInit: Display: the native host started\n")
    host = subprocess.Popen([sys.executable, str(state.parent / "game.py"), "idle"], start_new_session=True)
    lifecycle = {"launcher_pid": 1, "phase": "running", "stream_quality": quality, "stream_settings": {},
                 "gauntlet": {"run": str(run), "host_log": str(host_log), "expect": str(run / "stream.expect"), "sky": PINNED.split()},
                 "children": [{"name": "host", "pid": host.pid, "stdout": "host.stdout.log"}]}
    L.write_json(L.LIFECYCLE, lifecycle)
    try:
        with patch.dict(os.environ, {"FAKE_HOST_LOG": str(host_log), "FAKE_EXPECT": str(run / "stream.expect")}):
            folder, verdict = L.stream_run(SMALL, run, slot="NordHost", pin=0, seconds=5)
    finally:
        host.kill()
        host.wait()
    argv = json.loads((run / "stream/sampler-argv.json").read_text())
    assert argv == ["--slot", "NordHost", "--url", "http://127.0.0.1:8100/", "--seconds", "5", "--warmup", "2", "--frames", "--latency",
                    "--pin", "0", "--trigger", str(run / "stream/trigger.txt"), "--out", str(run / "stream")], argv
    assert (run / "stream/trigger.txt").read_text().split() == SMALL["order"][1:] + SMALL["order"][:1], "one trigger line per hold"
    assert sorted(path.name for path in (run / "stream/shots").glob("*-video.png")) == sorted(
        f"{n:02d}-{s}-video.png" for n, s in enumerate(SMALL["order"][1:] + SMALL["order"][:1], 1))
    for name in ("run.json", "stream/sample.json", "stream/frames.json", "stream/events.json", "stream/gpu.json", "stream/host.log",
                 "verdict.json", "review.html"):
        assert (run / name).is_file(), name
    assert verdict["status"] == "pass", (failing(verdict), verdict.get("notes"))
    assert verdict["report_only"]["stop_frames"]["S1"] == "stream/shots/05-S1-video.png" and verdict["report_only"]["encoder_qp"]["mean"] == 20.0
    assert any("no wall clock" in note for note in verdict["notes"]), "intervals over the whole sample are named as such"
    assert gates(verdict)["size_changes"]["value"] == 0, "the received event before the lap is outside the window"
    assert verdict["report_only"]["native_frames_ms"]["frame"]["p95_ms"] == 16.9 and len(verdict["report_only"]["native_legs_by_p95"]) == 5
    assert {"decoded_fps_mean", "freezes", "decoded_over_50ms_percent", "longest_gap_ms", "jitter_buffer_ms_per_frame",
            "native_fps_min", "decoded_vs_native_fps", "size_changes", "game_exit", "cvar_mismatches"} <= set(gates(verdict))
    assert 29 <= verdict["values"]["decoded_fps"] <= 31 and gates(verdict)["longest_gap_ms"]["value"] < 40
    assert verdict["delay"]["gated"] is False and verdict["delay"]["values"]["delay"]["rttMs"]["mean"] == 2.1
    assert verdict["delay"]["label"].startswith("host-PC headless Chromium")
    # With the page's performance.timeOrigin, the decoded frames are cut to the lap.
    report = json.loads((run / "stream/sample.json").read_text())
    events = json.loads((run / "stream/events.json").read_text())
    window = L.lap_window(events)[0]
    assert window == (next(e["ms"] for e in events if "NORD_GAUNTLET leg=S1-S2 lap=1 begin" in e["line"]),
                      next(e["ms"] for e in events if "NORD_GAUNTLET done laps=1" in e["line"])), "route and summary lines are not the lap"
    origin = report["samples"][0]["timeMs"] - 1000.0
    cut = L.lap_sample(dict(report, timeOrigin=origin), run / "stream", window)
    whole = L.lap_sample(report, run / "stream", window)
    assert cut["intervals"]["frames"] < whole["intervals"]["frames"] and not cut["notes"], (cut["intervals"], whole["intervals"])
    assert not any("ms" in gate["unit"] and "rtt" in gate["name"].lower() for gate in verdict["gates"]), "no gate cites a delay"
    meta = json.loads((run / "run.json").read_text())
    assert meta["row"] == "solo" and meta["size"] == [96, 48] and meta["quality"]["name"] == "file"
    two = out / "20261023T230500Z-two-viewers"
    (two / "stream/NordFriend1").mkdir(parents=True)
    for name in ("stream/events.json", "stream/gpu.json", "stream/sample.json", "stream/frames.json"):
        (two / name).write_text((run / name).read_text())
    for name in ("sample.json", "frames.json"):
        (two / "stream/NordFriend1" / name).write_text((run / "stream" / name).read_text())
    L.write_json(two / "run.json", dict(meta, label=two.name, row="two_viewer", slots=["NordHost", "NordFriend1"]))
    paired = L.judge(two, SMALL)
    assert paired["status"] == "unverified" and paired["gates"] == [], "a two-viewer row gates nothing"
    assert 29 <= paired["values"]["two_viewer_fps"] <= 31 and set(paired["report_only"]["two_viewer"]["per_slot"]) == {"NordHost", "NordFriend1"}
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
    print("stream ok: sampler flags, a trigger line and a decoded frame per hold, the lap window, pass verdict, delay apart")


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
                                    (L, "TAIL_S", .05), (L, "LIFECYCLE", root / "BrowserStreaming/lifecycle.json"), (L, "PROFILES_INI", ini)):
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
        check_tune_with_reference(out, reference)
        check_stream(out, state, group, tune["winner"])
        check_report_and_profile(group, tune)
    print("NORD_GAUNTLET_LOOP_OK")


if __name__ == "__main__":
    main()
