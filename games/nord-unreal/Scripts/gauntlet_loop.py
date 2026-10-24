"""Run the NORD mobile gauntlet loop on the host PC: native runs, stream samples, references, the tune, the round report
and the approved profile write.

Data/Gauntlet/loop.json holds every setting and limit. Scripts/gauntlet_metrics.py judges and Scripts/gauntlet_tune.py
searches; the game only reports (Source/Quebec/QuebecGauntlet.cpp). The host steps are in
openspec/changes/nord-mobile-gauntlet/notes-host.md.

A run folder is Saved/Gauntlet/<UTC>-<label>/ (git-ignored): run.json (commit, build, hardware, command line, CVar
readback, sky, size, quality), native/ (game.log, the CSV profiler file, legs.json, route.json, gpu.json),
look/<sky>/<stop>-<view>-<WxH>.png, stream/ (sample.json, frames.json, shots/, events.json, host.log, friend-events.json,
friend.log, gpu.json), verdict.json and review.html. A reference or a tune keeps its runs in runs/ and its candidate files
in candidates/.

A native run starts the Browser package through RunUAT RunUnreal and the NordMobileLoop test node
(Build/Scripts/NordMobileLoop.cs), or with --direct starts Builds/Browser/Linux/Quebec.sh as Scripts/profile_package.py
does. A stream run samples a lifecycle that Scripts/browser_streaming.py started with NORD_STREAM_GAUNTLET=<run dir>,
through Browser/stream-sample.mjs. Each second nvidia-smi gives the GPU processes and their VRAM, and /proc gives the
CPU use of the game processes; any other GPU process (desktop servers aside) marks the run contended. Every run needs a
pinned sky.

The game log lines this runner reads (Source/Quebec/QuebecGauntlet.cpp writes them):
  NORD_GAUNTLET cvar name=t.MaxFPS expected=60 actual=60.000000 match=1   one readback line per expected CVar
  NORD_GAUNTLET leg=S1-S2 lap=1 begin           a leg starts; the first one opens the stream lap window
  NORD_GAUNTLET stop=S2 lap=1 pass|hold=begin   a stop in drive order; at a hold the stream sampler saves the frame
  NORD_GAUNTLET done laps=1 | fail exit=2 ...   the drive ends; this closes the stream lap window
  NORD_GAUNTLET summary leg=all lap=all ...     whole-run frame statistics (gauntlet_metrics.run_summary)
  NORD_GAUNTLET result exit=0 reason=done ...   the game's exit code, logged last

Run from games/nord-unreal:
  python3 Scripts/gauntlet_loop.py self-check
  python3 Scripts/gauntlet_loop.py route [<run dir>]
  python3 Scripts/gauntlet_loop.py native [--direct] [--quality current|phone|file:<path>] --mode perf --size 1412x652
                                          --sky night-rain [--laps 1] [--label smoke] [--ceiling <look run dir>]
  python3 Scripts/gauntlet_loop.py stream --run <dir> --slot NordHost --pin 0 [--portrait] [--relay | --two-viewers | --look]
  python3 Scripts/gauntlet_loop.py reference [--direct]
  python3 Scripts/gauntlet_loop.py tune [--direct] [--until 06:30] [--reference <dir>] [--no-confirm]
  python3 Scripts/gauntlet_loop.py confirm <tune dir> [--candidate <id>] [--until 06:30] [--direct]
  python3 Scripts/gauntlet_loop.py report <run, reference or tune dir>
  python3 Scripts/gauntlet_loop.py write-profile <tune dir> --candidate <id> --approved
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import signal
import struct
import subprocess
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_streaming  # noqa: E402
import gauntlet_metrics as M  # noqa: E402
import gauntlet_tune as T  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = browser_streaming.GAUNTLET
PACKAGE = browser_streaming.PACKAGE
LIFECYCLE = browser_streaming.OUT / "lifecycle.json"
PROFILES_INI = T.PROFILES_INI
UPROJECT = ROOT / "Quebec.uproject"
# The owner's engine, as in notes-host.md and Scripts/launch.sh; NORD_UE_ROOT points elsewhere.
UAT = Path(os.environ.get("NORD_UE_ROOT", "/home/von/.local/share/Epic/UE_5.8.3")) / "Engine/Build/BatchFiles/RunUAT.sh"
TEST_NODE = "NordMobileLoop"
BROWSER = ROOT / "Browser"
SAMPLER = ["node", "stream-sample.mjs"]  # runs in Browser/, as its relative Playwright path expects
SMI = ["nvidia-smi"]
SAMPLE_S = 1.0
TAIL_S = .25
LOAD_S = 180  # Map load and shader warm-up before a run's delay, as profile_package.py allows 180 s per run.
UAT_S = 300   # RunUAT start-up (script build, Gauntlet set-up) on top of a run's limit; an estimate (unverified).
RESULT_GRACE_S = 15  # The host's log flush after its CSV wait, before its result line reaches the log; an estimate (unverified).
COVER_GRACE_MS = 1500  # A per-second sample and the log follower's delay may end this much before the lap.
LABEL = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]{0,159}")
FOLLOWED = re.compile(r"NORD_GAUNTLET\b|NORD_STREAM_FPS\b")
# The key must follow NORD_GAUNTLET directly: "route stop=", "still stop=" and "summary leg=" lines are not events.
LEG_START = re.compile(r"NORD_GAUNTLET leg=S\d+-S\d+")
HOLD_BEGIN = re.compile(r"NORD_GAUNTLET stop=(\w+)\b.*\bhold=begin")
STOP_LINE = re.compile(r"NORD_GAUNTLET stop=(\w+)")
LAP_END = re.compile(r"NORD_GAUNTLET (?:done|fail|result)\b")
RESULT = re.compile(r"NORD_GAUNTLET result\b")
RUN_END = re.compile(r"NORD_GAUNTLET\b.*\bexit=(\w+)")
READBACK = re.compile(r"NORD_GAUNTLET cvar (.*)")
CSV_WRITTEN = re.compile(r"Writing CSV to file : ([^\r\n]+\.csv)|NORD_GAUNTLET csv=(/[^\s]+\.csv)\b")
DELAY_KEY = re.compile(r"rtt|roundtrip|jitter|processing|latency|e2e|delay|decodems", re.IGNORECASE)
# The gates of a native run that also apply to a look run, which holds and switches skies instead of being timed.
LOOK_GATES = {"vram_peak_mib", "render_log_errors", "cvar_mismatches", "fps_cap"}
# A confirmation the window cut, or one a foreign GPU process shared twice, is missing evidence, not a failure:
# confirm runs it again.
CONFIRM_CUT = "the window ended before every confirmation run"
CONFIRM_CONTENDED = "a foreign GPU process shared a confirmation run twice"
CLOCK_TICKS = os.sysconf("SC_CLK_TCK")
require = browser_streaming.require


# ---------------------------------------------------------------- small helpers

def iso_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_json(path, default=None):
    path = Path(path)
    return json.loads(path.read_text()) if path.is_file() else default


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(data, indent=1, default=str) + "\n")
    temporary.replace(path)
    return path


def new_run_dir(label, parent=None):
    """An empty Saved/Gauntlet/<UTC>-<label>/ (or one under parent); a second run in the same second gets -2, -3."""
    require(LABEL.fullmatch(label or ""), "A label is 1 to 160 letters, digits, '.', '_', '+' or '-'; rejected " + repr(label))
    parent = Path(parent or OUT)
    parent.mkdir(parents=True, exist_ok=True)
    stem = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + "-" + label
    for number in range(1, 100):
        path = parent / (stem if number == 1 else f"{stem}-{number}")
        try:
            path.mkdir()
            return path
        except FileExistsError:
            continue
    raise RuntimeError("Too many runs named " + stem)


def size_entry(loop, text):
    """(key, entry) of a loop.json size, named by its key (top_landscape) or as WxH (1412x652)."""
    for key, entry in loop["sizes"].items():
        if text in (key, "{}x{}".format(*entry["size"])):
            return key, entry
    raise RuntimeError("--size must be one of " + ", ".join("{}x{}".format(*e["size"]) for e in loop["sizes"].values()))


def require_pinned(arguments):
    """Refuse a run without -NordHour= and -NordWeather=: the game would leave the sky live (QuebecSky.cpp's no-sky
    trap), and the gauntlet subsystem exits with code 3 instead."""
    lower = [argument.lower() for argument in arguments]
    require(any(a.startswith("-nordhour=") for a in lower) and any(a.startswith("-nordweather=") for a in lower),
            "A gauntlet run needs a pinned sky with -NordHour= and -NordWeather=; refused " + repr(" ".join(arguments)))


def sky_entry(loop, text):
    """(key, args) of a pinned loop.json sky; night-rain and night_rain both name night_rain."""
    key = (text or "").replace("-", "_")
    require(key in loop["skies"], "--sky must be one of " + ", ".join(k.replace("_", "-") for k in loop["skies"]))
    arguments = list(loop["skies"][key]["args"])
    require_pinned(arguments)
    return key, arguments


def still_names(loop, mode, sky, size):
    """The stills a run writes, relative to its folder: every stop and view, for each sky it takes."""
    skies = loop["sky_order"] if loop["modes"][mode]["sky_switch"] else [sky]
    return [loop["names"]["still"].format(sky=s, label=label, view=view, width=size[0], height=size[1])
            for s in skies for label in loop["order"] for view in loop["views"]["per_stop"]]


def view_key(name):
    """look/day/S1-eye-1412x652.png -> day/S1-eye-1412x652, the image key in verdicts and tune.json."""
    return name[len("look/"):-len(".png")] if name.startswith("look/") and name.endswith(".png") else name


def png_size(path):
    data = Path(path).read_bytes()[:24]
    return struct.unpack(">II", data[16:24]) if len(data) == 24 and data[:8] == b"\x89PNG\r\n\x1a\n" else None


def run_timeout(loop, mode, laps):
    """Seconds the game of a native run may take before it reports: the load, the mode's delay and ready grace, every
    warm and measured lap at the lap limit, every hold (a look hold may last until its stills time out) and the wait for
    the CSV file. The NordMobileLoop node gets the same number as maxduration, so Gauntlet never stops the game first."""
    settings, limits = loop["modes"][mode], loop["run_limits"]
    hold = max(settings["hold_s"], limits["stills_timeout_s"]) if mode == "look" else settings["hold_s"]
    return (LOAD_S + settings["delay_s"] + limits["ready_grace_s"] + (settings["warm_laps"] + laps) * loop["drive"]["max_lap_s"]
            + len(loop["order"]) * hold + limits["csv_wait_s"])


def expected_from_file(path):
    """{name: value} of a -NordGauntletExpect= file (name=value lines; # comments)."""
    out = {}
    for line in (Path(path).read_text().splitlines() if Path(path).is_file() else []):
        if line.strip() and not line.lstrip().startswith(("#", ";")) and "=" in line:
            name, _, value = line.partition("=")
            out[name.strip()] = value.strip()
    return out


def git_state():
    try:
        commit = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL)
        dirty = subprocess.check_output(["git", "-C", str(ROOT), "status", "--porcelain", "--untracked-files=no"], text=True,
                                        stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return {"commit": None, "dirty": None}
    return {"commit": commit.strip(), "dirty": bool(dirty.strip())}


def build_state():
    binary = PACKAGE / "Quebec/Binaries/Linux/Quebec"
    if not binary.is_file():
        return {"package": str(PACKAGE), "binary": None}
    status = binary.stat()
    return {"package": str(PACKAGE), "binary": str(binary), "bytes": status.st_size,
            "modified": datetime.fromtimestamp(status.st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}


# ---------------------------------------------------------------- nvidia-smi and /proc

def smi(arguments, timeout=10):
    return subprocess.run(SMI + list(arguments), capture_output=True, text=True, timeout=timeout, check=True).stdout


def gpu_processes():
    """GPU processes from the plain nvidia-smi table and the compute-apps query, merged by pid, and any errors. The
    table also lists Vulkan (G) processes, which the compute query can miss."""
    rows, errors = {}, []
    for arguments in ([], ["--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader,nounits"]):
        try:
            found = M.parse_gpu_processes(smi(arguments))
        except (OSError, subprocess.SubprocessError) as error:
            errors.append(f"nvidia-smi {' '.join(arguments[:1]) or 'table'}: {type(error).__name__}")
            continue
        for row in found:
            if row["pid"] not in rows or row["used_mib"] > rows[row["pid"]]["used_mib"]:
                rows[row["pid"]] = row
    return sorted(rows.values(), key=lambda row: row["pid"]), errors


def gpu_use():
    """GPU 0 use and memory from --query-gpu, or None."""
    try:
        line = smi(["--id=0", "--query-gpu=utilization.gpu,memory.used,memory.total,memory.free",
                    "--format=csv,noheader,nounits"]).strip().splitlines()[0]
        util, used, total, free = (float(value) for value in line.split(","))
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None
    return {"util_percent": util, "used_mib": used, "total_mib": total, "free_mib": free}


def gpu_identity():
    try:
        name, driver, total = (value.strip() for value in smi(
            ["--id=0", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader,nounits"]).strip().splitlines()[0].split(","))
        return {"name": name, "driver": driver, "memory_total_mib": float(total)}
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def parse_pmon(text):
    """Per-process GPU use from nvidia-smi pmon -s um: {pid: {"name", "sm": [%], "fb_mib": [MiB]}}. Columns are read by
    the names on its '# gpu ... pid ...' header line, which differ between drivers (from memory; unverified)."""
    columns, out = None, {}
    for line in text.splitlines():
        if line.startswith("#"):
            names = line.lstrip("#").split()
            if columns is None and "pid" in names:
                columns = names
            continue
        parts = line.split()
        if not columns or len(parts) < len(columns):
            continue
        row = dict(zip(columns[:-1], parts[:len(columns) - 1]))
        try:
            pid = int(row["pid"])
        except (KeyError, ValueError):
            continue
        entry = out.setdefault(pid, {"name": " ".join(parts[len(columns) - 1:]), "sm": [], "fb_mib": []})
        for key, target in (("sm", "sm"), ("fb", "fb_mib")):
            try:
                entry[target].append(float(row[key]))
            except (KeyError, ValueError):
                continue
    return out


class GpuWatch:
    """GPU processes, GPU use and the own processes' CPU use every SAMPLE_S seconds in a thread, a snapshot before the
    launch and after the run, and per-process GPU use from a background nvidia-smi pmon. Own processes are those in one
    of the sessions, or whose command line holds the marker (the run folder)."""

    def __init__(self, sessions=(), marker=None, pmon_path=None):
        self.sessions = set(sessions)
        self.marker = marker
        self.pmon_path = pmon_path
        self.before = self.after = None
        self.samples, self.own, self.errors, self.ticks = [], set(), set(), {}
        self.stopping = threading.Event()
        self.thread = self.pmon = self.pmon_output = None

    def own_pids(self):
        pids = set()
        for entry in Path("/proc").iterdir():
            if not entry.name.isdigit():
                continue
            try:
                stat = (entry / "stat").read_text()
                session = int(stat[stat.rindex(")") + 2:].split()[3])
                if session in self.sessions or (self.marker and self.marker in (entry / "cmdline").read_bytes().decode(errors="replace")):
                    pids.add(int(entry.name))
            except (OSError, ValueError, IndexError):
                continue
        return pids

    def cpu_percent(self, pids):
        """CPU use per pid since the previous sample from /proc/<pid>/stat utime + stime (VP8 encodes on the CPU)."""
        now, out = time.monotonic(), {}
        for pid in pids:
            try:
                stat = Path(f"/proc/{pid}/stat").read_text()
                fields = stat[stat.rindex(")") + 2:].split()
                ticks = int(fields[11]) + int(fields[12])
            except (OSError, ValueError, IndexError):
                continue
            if pid in self.ticks and now > self.ticks[pid][0]:
                out[pid] = round((ticks - self.ticks[pid][1]) / CLOCK_TICKS / (now - self.ticks[pid][0]) * 100, 1)
            self.ticks[pid] = (now, ticks)
        return out

    def snapshot(self):
        processes, errors = gpu_processes()
        self.errors.update(errors)
        return {"time": time.time(), "processes": processes, "gpu": gpu_use()}

    def sample(self):
        own = self.own_pids()
        self.own |= own
        snapshot = self.snapshot()
        snapshot.update(own=sorted(own), cpu_percent=self.cpu_percent(own))
        self.samples.append(snapshot)

    def follow(self):
        while not self.stopping.is_set():
            self.sample()
            self.stopping.wait(SAMPLE_S)

    def start(self):
        self.before = self.snapshot()
        if self.pmon_path:
            try:
                self.pmon_output = Path(self.pmon_path).open("w")
                # pmon -s um (SM and memory use) -d 1 (each second) prints until stopped; flags from memory (unverified).
                self.pmon = subprocess.Popen(SMI + ["pmon", "-s", "um", "-d", "1"], stdin=subprocess.DEVNULL, stdout=self.pmon_output,
                                             stderr=subprocess.STDOUT, start_new_session=True)
            except OSError as error:
                self.errors.add(f"nvidia-smi pmon: {type(error).__name__}")
        self.thread = threading.Thread(target=self.follow, daemon=True)
        self.thread.start()

    def stop(self):
        self.stopping.set()
        if self.thread:
            self.thread.join(timeout=30)
        if self.pmon and self.pmon.poll() is None:
            self.pmon.terminate()
            try:
                self.pmon.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.pmon.kill()
        if self.pmon_output:
            self.pmon_output.close()
        self.after = self.snapshot()

    def report(self):
        pmon = Path(self.pmon_path).read_text(errors="replace") if self.pmon_path and Path(self.pmon_path).is_file() else ""
        return {"interval_s": SAMPLE_S, "own": sorted(self.own), "sessions": sorted(self.sessions), "before": self.before,
                "after": self.after, "samples": self.samples, "errors": sorted(self.errors), "pmon": parse_pmon(pmon)}


def gpu_findings(gpu):
    """(peak VRAM per own pid, foreign GPU processes, report-only rows, notes, process-sample gate) of a GpuWatch report.

    Desktop servers are left out of the foreign list (gauntlet_metrics.DESKTOP_PROCESSES) and listed apart. Without any
    process listing, VRAM and contention are unverified, so the gate keeps such a run from passing."""
    samples = (gpu or {}).get("samples") or []
    own = set((gpu or {}).get("own") or [])
    every = [snapshot["processes"] for snapshot in [(gpu or {}).get("before"), *samples, (gpu or {}).get("after")] if snapshot]
    listed = sum(bool(rows) for rows in every)
    gate = M.gate("gpu_process_samples", listed or None, 1, op=">=", unit="listings",
                  note="nvidia-smi process listings before, during and after; without them VRAM and contention are unverified")
    notes = [] if listed else ["nvidia-smi listed no GPU process: VRAM and contention are unverified"]
    if (gpu or {}).get("errors"):
        notes.append("nvidia-smi errors: " + "; ".join(gpu["errors"][:4]))
    vram = M.peak_vram([snapshot["processes"] for snapshot in samples], own)
    foreign = M.foreign_processes(every, own)
    cpu = {}
    for snapshot in samples:
        for pid, value in (snapshot.get("cpu_percent") or {}).items():
            cpu.setdefault(str(pid), []).append(value)
    util = [snapshot["gpu"]["util_percent"] for snapshot in samples if snapshot.get("gpu")]
    pmon = {str(pid): entry for pid, entry in ((gpu or {}).get("pmon") or {}).items() if int(pid) in own and entry["sm"]}
    spread = lambda values: {"mean": round(sum(values) / len(values), 1), "max": max(values)}
    report = {"vram_peak_mib": {str(pid): mib for pid, mib in (vram or {}).items()},
              "cpu_percent": {pid: spread(values) for pid, values in cpu.items() if values},
              "gpu_util_percent": spread(util) if util else None,
              "gpu_sm_percent": {pid: spread(entry["sm"]) for pid, entry in pmon.items()},
              "ignored_desktop_processes": sorted({row["name"] for rows in every for row in rows if row["pid"] not in own
                                                   and os.path.basename(row["name"]) in M.DESKTOP_PROCESSES})}
    return vram, foreign, report, notes, gate


# ---------------------------------------------------------------- the game log

def parse_readback(log_text):
    """{cvar: value read back} from the NORD_GAUNTLET cvar lines (name= and actual=); the last line for a CVar wins."""
    out = {}
    for match in READBACK.finditer(log_text or ""):
        pairs = dict(re.findall(r"(\w+)=(\S*)", match.group(1)))
        if pairs.get("name") and ("actual" in pairs or "value" in pairs):
            out[pairs["name"]] = pairs.get("actual", pairs.get("value"))
    return out


def cvar_mismatches(expected, readback):
    """The mismatch list for gauntlet_metrics.native_gates, or None (unverified) when the log has no readback line."""
    if not readback:
        return None
    return [{"name": name, "expected": value, "actual": readback.get(name, "missing")} for name, value in expected.items()
            if name not in readback or not T.values_match(value, readback[name])]


def game_exit(loop, log_text, code, timed_out, launch):
    """The game's exit as {code, name, source}. The log's exit line wins. A direct launch falls back to the process
    code; RunUAT's own code is not the game's, so without the line the exit is unverified."""
    codes = loop["exit_codes"]
    names = {value: key for key, value in codes.items()}
    found = RUN_END.findall(log_text or "")
    if found:
        number = int(found[-1]) if found[-1].isdigit() else codes.get(found[-1].lower())
        return {"code": number, "name": names.get(number, found[-1]), "source": "log"}
    if timed_out:
        return {"code": codes["timeout"], "name": "timeout", "source": "runner"}
    if launch == "direct" and code is not None:
        return {"code": code, "name": names.get(code, "unknown"), "source": "process"}
    return {"code": None, "name": None, "source": "missing"}


def run_error(meta):
    """A failed run's reason for the tuner, or None. An exit the log never reported is unverified, not an error."""
    code = (meta.get("exit") or {}).get("code")
    return None if code in (None, 0) else f"game exit {code} ({meta['exit'].get('name')})"


def look_error(loop, verdict, scored=True):
    """Why a look run cannot give a Look, or None. Its stills and game_exit gates must pass, and a scored run needs an
    SSIM for each of the budgets.look.images stills. A partial set would rank a candidate on its easy views."""
    rows = {gate["name"]: gate for gate in verdict["gates"]}
    reasons = [f"{name} {(rows.get(name) or {}).get('result', 'missing')}" for name in ("stills", "game_exit")
               if (rows.get(name) or {}).get("result") != "pass"]
    count, need = len((verdict.get("values") or {}).get("images") or {}), loop["budgets"]["look"]["images"]
    if scored and count != need:
        reasons.append(f"{count} of {need} stills scored")
    return "look run: " + ", ".join(reasons) if reasons else None


def collect_csv(run, log_text):
    """The CSV profiler files in native/. The test node copies them there; otherwise the file the log names is copied
    from the package's Quebec/Saved/Profiling/CSV, by analogy with profile_package.py's Builds/Linux (unverified)."""
    native = run / "native"
    if not any(native.glob("*.csv")):
        for written in (first or second for first, second in CSV_WRITTEN.findall(log_text or "")):
            path = Path(written.strip())
            for source in ([path] if path.is_absolute() else []) + [PACKAGE / "Quebec/Saved/Profiling/CSV" / path.name]:
                if source.is_file():
                    shutil.copy2(source, native / source.name)
                    break
    return sorted(native.glob("*.csv"))


# ---------------------------------------------------------------- native runs

def preflight_native(loop, direct):
    """The browser_streaming.py guards that apply to one native run: the Linux Browser package, RunUAT (unless
    --direct), no other rendered Unreal job and room for one game on GPU 0. Another GPU process does not stop the run;
    it marks the run contended."""
    require(sys.platform.startswith("linux"), "The gauntlet runs the Linux Browser package.")
    require((PACKAGE / "Quebec.sh").is_file(), "Package the Browser build at Builds/Browser/Linux first (notes-host.md step 1).")
    require(direct or os.access(UAT, os.X_OK), f"RunUAT.sh is not at {UAT}; set NORD_UE_ROOT, or use --direct.")
    require(shutil.which(SMI[0]), "This PC host requires the calibrated NVIDIA GPU and nvidia-smi.")
    jobs = browser_streaming.rendered_jobs()
    require(not jobs, "Rendered Unreal jobs are already running: " + ", ".join(jobs) + ". Stop the demo first (notes-host.md step 0).")
    need = loop["budgets"]["native"]["vram_max_mib"]
    use = gpu_use()
    require(use is not None and use["free_mib"] >= need,
            f"One gauntlet run needs {need} MiB free on GPU 0; nvidia-smi reports {use and use['free_mib']}. No process was launched.")


def native_flags(loop, mode, run, laps):
    flag = loop["gauntlet_flags"]
    world = loop["world_flags"]["all"] + ([] if loop["modes"][mode]["ambient"] else loop["world_flags"]["look"])
    return [flag["enable"], flag["mode"] + mode, flag["run"] + str(run), flag["laps"] + str(laps),
            flag["expect"] + str(run / "quality.expect"), *world]


def direct_command(loop, plan):
    """The packaged game started as Scripts/profile_package.py:49-56 does, with the gauntlet flags instead of a fixed
    CSV frame count: the subsystem starts and stops the CSV capture and quits by itself. The -DeviceProfile= override
    of the phone quality is written from memory of the engine (unverified until the host reads every CVar back)."""
    width, height = plan["size"]
    quality = plan["quality"]
    return (["bash", str(PACKAGE / "Quebec.sh"), loop["map"], "-RenderOffscreen", "-windowed", "-ForceRes", f"-ResX={width}",
             f"-ResY={height}", "-unattended", "-nosound", "-csvGpuStats", "-csvCompression=0"]
            + (["-DeviceProfile=" + quality["device_profile"]] if "device_profile" in quality else ["-ExecCmds=" + quality["execcmds"]])
            + native_flags(loop, plan["mode"], plan["run"], plan["laps"]) + plan["sky_args"]
            + ["-abslog=" + str(plan["run"] / "native/game.log")])


def rununreal_command(loop, plan):
    """RunUAT RunUnreal with the NordMobileLoop node (notes-host.md step 3). The node turns these params into the
    flags of direct_command. The -build= path form and -ScriptsForProject= are unverified until the host runs it."""
    run = str(plan["run"])
    require(not set(run) & set("'\",() \t"), "RunUnreal params cannot carry this run path: " + run)
    quality = plan["quality"]
    params = [f"mode={plan['mode']}", "size={}x{}".format(*plan["size"]), "sky=" + plan["sky"].replace("_", "-"),
              f"laps={plan['laps']}", f"run='{run}'"]
    params += ([f"deviceprofile={quality['device_profile']}"] if "device_profile" in quality else [f"execcmds='{run}/quality.execcmds'"])
    params += [f"expect='{run}/quality.expect'", f"maxduration={plan['max_s']}"]
    return [str(UAT), "RunUnreal", f"-project={UPROJECT}", f"-ScriptsForProject={UPROJECT}", "-platform=Linux",
            "-configuration=Development", f"-build={PACKAGE}", f"-test={TEST_NODE}({','.join(params)})"]


def launch(command, stdout_path, timeout, watch):
    """Run one game or RunUAT process in its own session; returns (exit code or None, timed out). The session is added
    to the watch so every child counts as the run's own."""
    with Path(stdout_path).open("w") as output:
        process = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                                   start_new_session=True)
        watch.sessions.add(process.pid)
        try:
            return process.wait(timeout=timeout), False
        except subprocess.TimeoutExpired:
            return None, True
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)


def native_run(loop, mode, size, sky, laps=None, quality="current", label=None, direct=False, parent=None, ceiling=None,
               timeout=None):
    """One native perf or look run: launch, sample the GPU, collect the files and judge. Returns (folder, verdict)."""
    require(mode in ("perf", "look"), "--mode must be perf or look; stream runs start through browser_streaming.py")
    size_key, size_info = size_entry(loop, size)
    sky_key, sky_args = sky_entry(loop, sky)
    laps = loop["modes"][mode]["laps"] if laps is None else laps
    require(isinstance(laps, int) and 1 <= laps <= 10, "--laps must be 1 to 10")
    chosen = browser_streaming.stream_quality(quality)
    cvars = browser_streaming.quality_cvars(chosen)
    ceiling = Path(ceiling).resolve() if ceiling else None
    require(ceiling is None or (read_json(ceiling / "run.json") or {}).get("mode") == "look", "--ceiling must name a look run folder")
    preflight_native(loop, direct)
    run = new_run_dir(label or f"{mode}-{sky_key}-{size_key}", parent)
    (run / "native").mkdir()
    expected = T.expected_cvars({"cvars": cvars}, loop["fixed"])
    (run / "quality.expect").write_text(T.expect_text({"id": chosen["name"], "cvars": cvars}, loop["fixed"]))
    if "execcmds" in chosen:
        (run / "quality.execcmds").write_text(chosen["execcmds"])
    plan = {"run": run, "mode": mode, "size": size_info["size"], "sky": sky_key, "sky_args": sky_args, "laps": laps, "quality": chosen,
            "max_s": timeout or run_timeout(loop, mode, laps)}
    command = direct_command(loop, plan) if direct else rununreal_command(loop, plan)
    require_pinned(command if direct else sky_args)
    limit = plan["max_s"] + (0 if direct else UAT_S)
    meta = {"version": 1, "kind": "native", "label": run.name, "mode": mode, "size": size_info["size"], "size_key": size_key,
            "rung": size_info["rung"], "sky": sky_key, "sky_args": sky_args, "laps": laps, "warm_laps": loop["modes"][mode]["warm_laps"],
            "quality": dict(chosen, expected={name: T.format_value(value) for name, value in expected.items()}),
            "world_flags": native_flags(loop, mode, run, laps)[5:], "launch": "direct" if direct else "rununreal",
            "command": command, "timeout_s": limit, "ceiling": str(ceiling) if ceiling else None, "commit": git_state(),
            "build": build_state(), "gpu": gpu_identity(), "started_at": iso_now(), "finished_at": None, "exit": None,
            "readback": None}
    write_json(run / "run.json", meta)
    # The run folder marks the game in any launch: the NordMobileLoop node quotes it, the direct launch does not.
    watch = GpuWatch(marker=str(run), pmon_path=run / "native/pmon.log")
    watch.start()
    code = timed_out = None
    try:
        code, timed_out = launch(command, run / "native/stdout.log", limit, watch)
    finally:
        watch.stop()
        write_json(run / "native/gpu.json", watch.report())
        log_path = run / "native/game.log"
        log_text = log_path.read_text(errors="replace") if log_path.is_file() else ""
        collect_csv(run, log_text)
        meta.update(finished_at=iso_now(), readback=parse_readback(log_text),
                    exit=dict(game_exit(loop, log_text, code, timed_out, meta["launch"]), process=code, timed_out=timed_out))
        write_json(run / "run.json", meta)
    return run, judge(run, loop)


def look_scores(loop, run, ceiling, names):
    """{view: SSIM of run's still against ceiling's} for every still both folders hold at the same size."""
    images = {}
    for name in names:
        mine, reference = Path(run) / name, Path(ceiling) / name
        if mine.is_file() and reference.is_file():
            try:
                images[view_key(name)] = M.image_ssim(reference, mine, loop)
            except ValueError:
                continue
    return images


def judge_native(run, loop, meta):
    native = run / "native"
    log_path = native / "game.log"
    log_text = log_path.read_text(errors="replace") if log_path.is_file() else None
    readback = meta.get("readback") if meta.get("readback") is not None else parse_readback(log_text)
    mismatches = cvar_mismatches(meta["quality"]["expected"], readback)
    vram, foreign, report_only, notes, samples_gate = gpu_findings(read_json(native / "gpu.json"))
    exit_info = meta.get("exit") or {}
    gates = [M.gate("game_exit", exit_info.get("code"), loop["exit_codes"]["done"], op="==", unit="code",
                    note=f"{exit_info.get('name')} (from the {exit_info.get('source')})"), samples_gate]
    values, analysis, rows = {}, None, []
    if meta["mode"] == "perf":
        csvs = sorted(native.glob("*.csv"))
        if not csvs:
            notes.append("no CSV profiler file: every frame gate is unverified")
        elif len(csvs) > 1:
            notes.append(f"{len(csvs)} CSV files; the last by name was judged")
        analysis = M.analyze_csv(csvs[-1], loop) if csvs else None
        gates += M.native_gates(analysis, loop, vram_mib=vram, log_text=log_text, cvar_mismatches=mismatches, readback=readback)
        values = M.native_values(analysis, gates)
        legs = M.legs_ranked(analysis) if analysis else []
        write_json(native / "legs.json", {"ranked_by_p95": legs, "per_lap": (analysis or {}).get("laps"),
                                          "leg_order_ok": (analysis or {}).get("leg_order_ok")})
        report_only.update(threads_ms=M.native_report(analysis), heaviest_leg=legs[0]["leg"] if legs else None)
        notes += (analysis or {}).get("notes", [])
        metadata = (analysis or {}).get("metadata") or {}
        meta["hardware"] = {key: metadata.get(key) for key in ("platform", "cpu", "gpu", "gpudriver", "engineversion", "shaderplatform")}
        write_json(run / "run.json", meta)
    else:
        gates += [g for g in M.native_gates(None, loop, vram_mib=vram, log_text=log_text, cvar_mismatches=mismatches, readback=readback)
                  if g["name"] in LOOK_GATES]
        names = still_names(loop, "look", meta["sky"], meta["size"])
        good = [name for name in names if (run / name).is_file() and png_size(run / name) == tuple(meta["size"])]
        missing = [view_key(name) for name in names if name not in good]
        gates.append(M.gate("stills", len(good), len(names), op="==", unit="stills",
                            note=("missing or wrong size: " + ", ".join(missing[:6])) if missing else "{}x{}".format(*meta["size"])))
        ceiling = Path(meta["ceiling"]) if meta.get("ceiling") else None
        if ceiling:
            images = look_scores(loop, run, ceiling, names)
            gates += [g for g in M.look_gates(loop, images) if g["name"] == "image_ssim_min"]
            values = {"look": sum(images.values()) / len(images) if images else None, "images": images or None}
            rows = [{"view": view_key(name), "ceiling": ceiling / name, "candidate": run / name} for name in names]
    verdict = M.verdict(gates, foreign=foreign, report_only=report_only, values=values, notes=notes,
                        missing_columns=(analysis or {}).get("missing_columns"))
    write_json(run / "verdict.json", verdict)
    M.write_review(run, rows, loop, title="NORD mobile gauntlet: " + run.name, verdict_data=verdict)
    return verdict


# ---------------------------------------------------------------- stream runs

class LogTail:
    """Follows the host log in a thread. It keeps NORD_GAUNTLET and NORD_STREAM_FPS lines with the wall time they were
    read (lines already in the log at the start are marked late), and appends the stop label to each trigger file when
    a hold begins, so the sampler saves that decoded frame. When the drive ends (done, fail or result) it appends END
    once, so a sampler that reads END stops before the host quits. It sets result at the host's result line."""

    def __init__(self, path, triggers):
        self.path, self.triggers = Path(path), [Path(trigger) for trigger in triggers]
        self.events, self.position, self.partial, self.ended = [], 0, "", False
        self.stopping, self.result = threading.Event(), threading.Event()
        self.thread = threading.Thread(target=self.follow, daemon=True)

    def read(self, late=False):
        try:
            with self.path.open("rb") as handle:
                handle.seek(self.position)
                chunk = handle.read()
        except FileNotFoundError:
            return
        self.position += len(chunk)
        lines = (self.partial + chunk.decode(errors="replace")).split("\n")
        self.partial = lines.pop()
        now = time.time() * 1000
        for line in lines:
            if not FOLLOWED.search(line):
                continue
            self.events.append({"ms": now, "late": late, "line": line.strip()})
            if RESULT.search(line):
                self.result.set()
            hold = HOLD_BEGIN.search(line)
            end = not late and not self.ended and LAP_END.search(line)
            self.ended = self.ended or bool(end)
            if (hold and not late) or end:
                for trigger in self.triggers:
                    with trigger.open("a") as handle:
                        handle.write((hold.group(1) if hold else "END") + "\n")

    def follow(self):
        self.read(late=True)
        while not self.stopping.wait(TAIL_S):
            self.read()

    def start(self):
        self.thread.start()

    def stop(self):
        self.stopping.set()
        self.thread.join(timeout=10)
        self.read()


def follow_to_result(tail, state, seconds):
    """Wait until the tail has read the host's result line, the lifecycle's NordHost process has quit, or seconds have
    passed; True when the result line came. After the done line the host waits for its CSV file (csv_wait_s at most),
    then writes native/route.json and the result line (QuebecGauntlet.cpp Complete). The launcher reaps a host that
    quits, so its /proc entry goes; without a host child in the lifecycle the wait takes all the seconds."""
    pid = next((child.get("pid") for child in state.get("children") or [] if child.get("name") == "host"), None)
    deadline = time.monotonic() + seconds
    while not tail.result.is_set() and (pid is None or Path(f"/proc/{pid}").exists()) and time.monotonic() < deadline:
        tail.result.wait(TAIL_S)
    return tail.result.is_set()


def lap_window(events):
    """((start ms, end ms), notes) of the stream lap in the followed log: the first leg start to the end of the drive."""
    start = next((n for n, event in enumerate(events) if LEG_START.search(event["line"])), None)
    end = next((n for n, event in enumerate(events) if start is not None and n > start and LAP_END.search(event["line"])), None)
    if start is None or end is None:
        return None, ["the host log has no lap start (leg=) or no end (done, fail or result) line: the stream gates are unverified"]
    if events[start]["late"]:
        return None, ["the lap started before the runner followed the host log: the stream gates are unverified"]
    return (events[start]["ms"], events[end]["ms"]), []


def window_summary(samples, events=None):
    """stream-sample.mjs summarize() over the per-second samples and the --latency events inside the lap, with the
    same counters and formulas, delay and encoder QP included. So the verdict does not need the sampler's own summary,
    which covers its whole sample, the warm lap too. When the host quit first, that summary ends at the stream end
    (streamEndedTimeMs). The sampler's longestFrameGapMs is left out: it is a running maximum since the sample started,
    and only the decoded intervals give the lap's own longest gap."""
    if len(samples) < 2:
        return None
    first, last = samples[0], samples[-1]
    seconds = (last["timeMs"] - first["timeMs"]) / 1000
    get = lambda sample, key: sample.get(key) or 0
    decoded = get(last, "framesDecoded") - get(first, "framesDecoded")
    if seconds <= 0 or decoded < 0:
        return None
    emitted = get(last, "jitterBufferEmittedCount") - get(first, "jitterBufferEmittedCount")
    out = {"seconds": seconds, "decodedFps": decoded / seconds,
           "receivedMbps": (get(last, "bytesReceived") - get(first, "bytesReceived")) * 8 / seconds / 1e6,
           "framesDropped": get(last, "framesDropped") - get(first, "framesDropped"),
           "freezes": get(last, "freezeCount") - get(first, "freezeCount"),
           "freezeSeconds": get(last, "totalFreezesDuration") - get(first, "totalFreezesDuration"),
           "width": last.get("width"), "height": last.get("height"), "candidate": last.get("candidate"), "codec": last.get("codec")}
    if decoded > 0:
        out.update(decodeMsPerFrame=(get(last, "totalDecodeTime") - get(first, "totalDecodeTime")) * 1000 / decoded,
                   jitterBufferMsPerFrame=(get(last, "jitterBufferDelay") - get(first, "jitterBufferDelay")) * 1000 / emitted if emitted > 0 else None,
                   packetsLost=get(last, "packetsLost") - get(first, "packetsLost"),
                   framesReceived=get(last, "framesReceived") - get(first, "framesReceived"))
    if events is not None or "totalProcessingDelay" in last:
        # Round-trip time and jitter are per-second gauges in seconds; the other two are counters, per frame.
        def gauge(key):
            values = [sample[key] * 1000 for sample in samples if isinstance(sample.get(key), (int, float))]
            return {"mean": sum(values) / len(values), "max": max(values)} if values else None

        def per_frame(key, count):
            after, before = last.get(key), first.get(key)
            numbers = isinstance(after, (int, float)) and isinstance(before, (int, float))
            return (after - before) * 1000 / count if count > 0 and numbers else None

        out["delay"] = {"rttMs": gauge("roundTripTime"), "jitterMs": gauge("jitter"),
                        "processingMsPerFrame": per_frame("totalProcessingDelay", decoded),
                        "jitterBufferTargetMsPerFrame": per_frame("jitterBufferTargetDelay", emitted)}
    if events is not None:
        latency = [event for event in events if event.get("kind") == "latency"]
        frontend = {"events": len(latency)}
        for key in sorted({key for event in latency for key in event} - {"timeMs", "kind"}):
            values = [event[key] for event in latency if isinstance(event.get(key), (int, float))]
            if values:
                frontend[key] = sum(values) / len(values)
        out["delay"]["frontend"] = frontend
        # The frontend reports 0 when a stream closes and -1 before the first value; neither is an encoder QP.
        qp = [event["avgQP"] for event in events if event.get("kind") == "qp" and isinstance(event.get("avgQP"), (int, float))
              and event["avgQP"] > 0]
        out["encoderQp"] = {"events": len(qp), "mean": sum(qp) / len(qp) if qp else None, "max": max(qp) if qp else None}
    return out


def load_frames(report, out):
    """requestVideoFrameCallback entries from frames.json (a list, or an object with frames) or sample.json frames."""
    data = read_json(Path(out) / "frames.json")
    frames = data if isinstance(data, list) else (data or {}).get("frames") or (report or {}).get("frames") or []
    return [frame for frame in frames if isinstance(frame, dict)]


def frame_clock(report):
    """Wall-clock ms of a frame entry, or None when the sample has no clock. stream-sample.mjs stores the page's
    performance.timeOrigin (ms since the Unix epoch) as sample.json timeOrigin, and each frame keeps its
    performance.now() time t (expectedDisplayTime), so the frame was shown at timeOrigin + t, as the host log window."""
    origin = (report or {}).get("timeOrigin")
    if not isinstance(origin, (int, float)) or isinstance(origin, bool):
        return None
    return lambda frame: origin + frame["expectedDisplayTime"] if isinstance(frame.get("expectedDisplayTime"), (int, float)) else None


def lap_sample(report, out, window):
    """The lap part of one sampler report: summary (with delay), decoded intervals, size changes, received size and
    notes. Without the page clock the decoded intervals cover the whole sample: they are kept as whole_intervals,
    report-only, and the interval gates are unverified."""
    result = {"summary": None, "intervals": None, "whole_intervals": None, "size_changes": None, "received_size": None,
              "notes": [], "report": report or {}}
    if not report:
        result["notes"].append(f"no sample.json in {out}: the stream gates are unverified")
        return result
    samples = [sample for sample in report.get("samples", []) if isinstance(sample.get("timeMs"), (int, float))]
    if window is None:
        return result
    start, end = window
    if not samples or samples[0]["timeMs"] > start or samples[-1]["timeMs"] < end - COVER_GRACE_MS:
        result["notes"].append(f"the sample in {out} does not cover the whole lap: the stream gates are unverified")
        return result
    lap = [sample for sample in samples if start <= sample["timeMs"] <= end]
    events = report.get("events")
    result["summary"] = window_summary(lap, None if events is None else
                                       [event for event in events if start <= (event.get("timeMs") or -1) <= end])
    frames = load_frames(report, out)
    clock = frame_clock(report)
    if clock:
        frames = [frame for frame in frames if (moment := clock(frame)) is not None and start <= moment <= end]
        result["intervals"] = M.decoded_intervals(frames) if frames else None
    elif frames:
        result["whole_intervals"] = M.decoded_intervals(frames)
        result["notes"].append(f"sample.json in {out} has no timeOrigin, so its decoded frames cannot be cut to the lap: "
                               "the interval gates are unverified and the whole-sample intervals are report-only")
    if lap:
        # The sampler's requested and received events (--latency) catch every change; without them, the per-second sizes.
        events = [event for event in report.get("events") or [] if event.get("kind") in ("requested", "received")]
        result["size_changes"] = (sum(start <= event.get("timeMs", -1) <= end for event in events) if events else
                                  len({(sample.get("requested"), sample.get("width"), sample.get("height")) for sample in lap}) - 1)
        result["received_size"] = [lap[-1].get("width"), lap[-1].get("height")]
    return result


def stream_seconds(loop):
    """The default sampler seconds: the latest the gated lap can end after the sampler starts measuring, which is after
    the host's BeginPlay (the sampler waits for the first world). The host waits the delay and up to the ready grace,
    drives the warm laps and the gated laps at the lap limit with a hold at each stop of a gated lap, then quits soon
    after its done line. So a sampler that ran on to this bound would outlive the host: LogTail writes END when the
    drive ends, so that the sampler can stop first, and the verdict reads only the samples inside the lap."""
    mode = loop["modes"]["stream"]
    return min(3600, mode["delay_s"] + loop["run_limits"]["ready_grace_s"] + (mode["warm_laps"] + mode["laps"]) * loop["drive"]["max_lap_s"]
               + mode["laps"] * len(loop["order"]) * mode["hold_s"] + 30)


def friend_log(gauntlet):
    """NordFriend1's log: the lifecycle's friend_log, or the host log's sibling, as browser_streaming.py names both
    (host-<stamp>.log and friend-<stamp>.log in Saved/BrowserStreaming). None when neither applies."""
    if gauntlet.get("friend_log"):
        return Path(gauntlet["friend_log"])
    host = Path(gauntlet["host_log"])
    return host.with_name("friend-" + host.name[len("host-"):]) if host.name.startswith("host-") else None


def host_command(state, gauntlet):
    """NordHost's command line: the lifecycle's record, else /proc/<pid>/cmdline of its host child, else None."""
    if gauntlet.get("command"):
        return list(gauntlet["command"])
    for child in state.get("children") or []:
        if child.get("name") == "host":
            try:
                return [part.decode(errors="replace") for part in Path(f"/proc/{int(child['pid'])}/cmdline").read_bytes().split(b"\0") if part]
            except (OSError, KeyError, TypeError, ValueError):
                return None
    return None


def stream_run(loop, run, slot="NordHost", pin=0, portrait=False, relay=False, two_viewers=False,
               url="http://127.0.0.1:8100/", seconds=None, look=False):
    """Sample one stream-mode lap of a running gauntlet lifecycle and judge it. With look, the sampler drags on the
    stream all along (its --look sweep), and the input row checks that the car kept its path. Returns (folder, verdict)."""
    run = Path(run).resolve()
    state = read_json(LIFECYCLE)
    require(state is not None, f"No lifecycle at {LIFECYCLE}; start browser_streaming.py run with NORD_STREAM_GAUNTLET first.")
    gauntlet = state.get("gauntlet") or {}
    require(state.get("phase") in ("starting", "running") and gauntlet.get("run") and Path(gauntlet["run"]).resolve() == run,
            "The running lifecycle is not a gauntlet lifecycle for this run; start it with NORD_STREAM_GAUNTLET=" + str(run))
    require_pinned(gauntlet.get("sky") or [])
    require(slot in ("NordHost", "NordFriend1") and pin in range(4), "--slot must be NordHost or NordFriend1 and --pin 0 to 3")
    require(not two_viewers or slot == "NordHost", "--two-viewers samples both slots itself; leave --slot NordHost")
    require(not look or not (relay or two_viewers), "--look is its own row; leave out --relay and --two-viewers")
    stream = run / "stream"
    require(not (stream / "sample.json").exists(), "This run already has a stream sample; each sample needs a fresh lifecycle.")
    stream.mkdir(parents=True, exist_ok=True)
    sizes = [entry["size"] for entry in loop["sizes"].values() if entry["rung"] == pin and (entry["size"][1] > entry["size"][0]) == portrait]
    # The warm lap drives first; the gated lap starts at its first leg line (lap_window).
    seconds = seconds or stream_seconds(loop)
    slots = [("NordHost", stream), ("NordFriend1", stream / "NordFriend1")] if two_viewers else [(slot, stream)]
    commands = []
    for name, out in slots:
        out.mkdir(parents=True, exist_ok=True)
        (out / "trigger.txt").write_text("")
        commands.append(SAMPLER + ["--slot", name, "--url", url, "--seconds", str(seconds), "--warmup", "2", "--frames", "--latency",
                                   "--pin", str(pin), "--trigger", str(out / "trigger.txt"), "--out", str(out)]
                        + (["--portrait"] if portrait else []) + (["--relay"] if relay else []) + (["--look"] if look else []))
    # The host's world flags, as a native run records the ones it passes, and later its CVar readback.
    host_line = host_command(state, gauntlet)
    world = loop["world_flags"]["all"] + loop["world_flags"]["look"]
    friend = friend_log(gauntlet)
    meta = dict(read_json(run / "run.json", {}), version=1, kind="stream", label=run.name,
                row="two_viewer" if two_viewers else "relay" if relay else "input" if look else "solo", slot=slot,
                slots=[name for name, _ in slots], pin=pin, portrait=portrait, relay=relay, look=look, size=sizes[0] if sizes else None,
                sky_args=gauntlet["sky"], quality=state.get("stream_quality"),
                expected=expected_from_file(gauntlet.get("expect") or run / "stream.expect"),
                lifecycle={key: state.get(key) for key in ("launcher_pid", "infrastructure_sha", "stream_settings", "children")},
                host_command=host_line, world_flags=None if host_line is None else [flag for flag in host_line if flag in world],
                friend_log=str(friend) if friend else None, commands=commands, seconds=seconds, commit=git_state(),
                build=build_state(), gpu=gpu_identity(), started_at=iso_now(), finished_at=None, readback=None)
    write_json(run / "run.json", meta)
    watch = GpuWatch(sessions=[child["pid"] for child in state.get("children", [])], pmon_path=stream / "pmon.log")
    tail = LogTail(gauntlet["host_log"], [out / "trigger.txt" for _, out in slots])
    # NordFriend1's NORD_STREAM_FPS windows show whether it slept through the lap (judge_stream's friend_awake_windows).
    friend_tail = LogTail(friend, []) if friend else None
    processes, handles, codes = [], [], []
    watch.start()
    tail.start()
    if friend_tail:
        friend_tail.start()
    try:
        for command, (_, out) in zip(commands, slots):
            handles.append((out / "sampler.log").open("w"))
            processes.append(subprocess.Popen(command, cwd=BROWSER, stdin=subprocess.DEVNULL, stdout=handles[-1],
                                              stderr=subprocess.STDOUT, start_new_session=True))
        deadline = time.monotonic() + seconds + 240  # connection, first world and warm-up come before the timed sample
        for process in processes:
            try:
                codes.append(process.wait(timeout=max(1.0, deadline - time.monotonic())))
            except subprocess.TimeoutExpired:
                codes.append(None)
        # The sampler stops at END, the done line. The exit code and native/route.json come later, so follow the host
        # log on to its result line before the verdict reads them.
        follow_to_result(tail, state, loop["run_limits"]["csv_wait_s"] + RESULT_GRACE_S)
    finally:
        for process in processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=10)
        for handle in handles:
            handle.close()
        tail.stop()
        watch.stop()
        write_json(stream / "events.json", tail.events)
        write_json(stream / "gpu.json", watch.report())
        if friend_tail:
            friend_tail.stop()
            write_json(stream / "friend-events.json", friend_tail.events)
            if friend.is_file():
                shutil.copy2(friend, stream / "friend.log")
        if Path(gauntlet["host_log"]).is_file():
            shutil.copy2(gauntlet["host_log"], stream / "host.log")
        meta.update(finished_at=iso_now(), sampler_exit=codes,
                    readback=parse_readback((stream / "host.log").read_text(errors="replace")) if (stream / "host.log").is_file() else None)
        write_json(run / "run.json", meta)
    return run, judge(run, loop)


def delay_values(sample):
    """Delay figures: the lap's own (window_summary), and those of the sampler's whole-sample summary when it wrote one.
    Never gated and never cited by a frame-rate result."""
    summary = (sample["report"] or {}).get("summary") or {}
    values = {key: value for key, value in summary.items() if DELAY_KEY.search(key)}
    if sample["summary"]:
        values.update({"lap_" + key: sample["summary"].get(key) for key in ("jitterBufferMsPerFrame", "decodeMsPerFrame", "delay")})
    return values


def stream_shot(run, label):
    """A stream run's decoded frame at one stop: the video shot sample.json lists for that trigger line (the sampler
    names it shots/<NN>-<line>-video.png, beside a full-page shot), or None."""
    report = read_json(Path(run) / "stream/sample.json") if run else None
    for shot in (report or {}).get("shots") or []:
        if str(shot.get("line", "")).strip() == label and shot.get("video") and (Path(run) / "stream" / shot["video"]).is_file():
            return Path(run) / "stream" / shot["video"]
    return None


def judge_stream(run, loop, meta):
    stream = run / "stream"
    events = read_json(stream / "events.json", [])
    window, notes = lap_window(events)
    slots = {}
    for number, name in enumerate(meta["slots"]):
        out = stream if number == 0 else stream / name
        slots[name] = lap_sample(read_json(out / "sample.json"), out, window)
    primary = slots[meta["slots"][0]]
    text = "\n".join(event["line"] for event in events)
    native = M.parse_stream_fps("\n".join(event["line"] for event in events if window and window[0] <= event["ms"] <= window[1]))
    vram, foreign, report_only, gpu_notes, samples_gate = gpu_findings(read_json(stream / "gpu.json"))
    exit_info = game_exit(loop, text, None, False, "lifecycle")
    mismatches = cvar_mismatches(meta.get("expected") or {}, parse_readback(text))
    gates = M.stream_gates(loop, primary["summary"], primary["intervals"], native or None)
    received, expected = primary["received_size"], meta.get("size")
    size_text = lambda size: "{}x{}".format(*size) if size and all(size) else None
    gates += [M.gate("size_changes", primary["size_changes"], 0, unit="changes",
                     note="requested and received size inside the lap; a pinned rung keeps one size"),
              M.gate("received_size", size_text(received) if size_text(expected) else None, size_text(expected), op="==", unit="px",
                     note="the last received size inside the lap against the pinned rung's size in this orientation"),
              M.gate("game_exit", exit_info["code"], loop["exit_codes"]["done"], op="==", unit="code", note=exit_info["name"]),
              M.gate("cvar_mismatches", None if mismatches is None else len(mismatches), 0, unit="cvars",
                     note=", ".join(f"{m['name']}={m['actual']} (want {m['expected']})" for m in mismatches or []) or None),
              samples_gate]
    if meta["row"] != "two_viewer":
        # A solo lap needs NordFriend1 asleep (only NordHost renders); its 5 s windows say so as they are logged.
        friend = M.parse_stream_fps("\n".join(event["line"] for event in read_json(stream / "friend-events.json", []) or []
                                              if window and window[0] <= event["ms"] <= window[1]), sleeping=True)
        gates.append(M.gate("friend_awake_windows", sum(not row["sleeping"] for row in friend) if friend else None, 0,
                            unit="windows", note="NordFriend1's NORD_STREAM_FPS windows inside the lap that were awake"))
    shots = {label: stream_shot(run, label) for label in loop["order"]}
    report_only.update(received_size=received, expected_size=expected,
                       stop_frames={label: shot and str(shot.relative_to(run)) for label, shot in shots.items()},
                       native_fps_windows=native, candidate=(primary["summary"] or {}).get("candidate"),
                       encoder_qp=(primary["summary"] or {}).get("encoderQp")
                       or ((primary["report"] or {}).get("summary") or {}).get("encoderQp"))
    if primary["whole_intervals"]:
        report_only["whole_sample_intervals"] = primary["whole_intervals"]
    if not all(shots.values()):
        notes.append("no decoded frame for " + ", ".join(label for label, shot in shots.items() if not shot))
    csvs = sorted((run / "native").glob("*.csv"))
    if csvs:
        # The host's CSV profiler file of the stream lap: native frame times next to the decoded ones, report-only.
        analysis = M.analyze_csv(csvs[-1], loop)
        report_only.update(native_frames_ms=M.native_report(analysis), native_legs_by_p95=M.legs_ranked(analysis))
    values = {"decoded_fps": (primary["summary"] or {}).get("decodedFps")}
    notes += [note for sample in slots.values() for note in sample["notes"]] + gpu_notes
    if meta["row"] == "two_viewer":
        fps = [sample["summary"]["decodedFps"] for sample in slots.values() if sample["summary"]]
        values["two_viewer_fps"] = sum(fps) / len(fps) if len(fps) == len(slots) else None
        report_only["two_viewer"] = {"mean_decoded_fps": values["two_viewer_fps"], "gates_of_NordHost": gates,
                                     "per_slot": {name: (sample["summary"] or {}).get("decodedFps") for name, sample in slots.items()}}
        gates = []
        notes.append("two-viewer row: report-only, so nothing is gated; report compares it with the baseline's (the co-op guard)")
    elif meta["row"] == "relay":
        report_only["relay"] = {"gates": gates}
        gates = []
        notes.append("relay row: report-only, so nothing is gated")
    elif meta["row"] == "input":
        # The viewer's drags must not steer the car: the frame figures are report-only, the path is gated.
        report_only["input"] = {"gates": gates}
        gates = [M.gate("max_lateral_m", route_lateral(read_json(run / "native/route.json") or {}),
                        loop["drive"]["max_lateral_error_m"], unit="m", note="native/route.json, with the sampler's --look sweep"),
                 next(gate for gate in gates if gate["name"] == "game_exit")]
        notes.append("input row: the stream figures are report-only; the lateral error and the exit are gated")
    verdict = M.verdict(gates, foreign=foreign, report_only=report_only, delay=M.delay_section(delay_values(primary)),
                        values=values, notes=notes)
    write_json(run / "verdict.json", verdict)
    rows = [{"view": label, "stream": shot} for label, shot in shots.items()]
    M.write_review(run, rows, loop, title="NORD mobile gauntlet stream: " + run.name, verdict_data=verdict)
    return verdict


def judge(run, loop):
    """Judge a native or stream run again from its saved files; writes verdict.json and review.html."""
    meta = read_json(Path(run) / "run.json")
    require(meta is not None, f"{run} has no run.json")
    return (judge_native if meta["kind"] == "native" else judge_stream)(Path(run), loop, meta)


# ---------------------------------------------------------------- reference, tune and the round report

def reference_run(loop, direct=False):
    """The ceiling look rendered twice at the confirm sizes (both skies in each look run), then judged."""
    group = new_run_dir("reference")
    ceiling = T.make_candidate(loop, None, "ceiling", 0, "ceiling", cvars=loop["profiles"]["ceiling"]["cvars"], look_only=True)
    execcmds, _ = T.write_candidate_files(group / "candidates", ceiling)
    result = {"version": 1, "kind": "reference", "started_at": iso_now(), "commit": git_state(), "build": build_state(),
              "cvars": ceiling["cvars"], "sizes": {}}
    for size_key in loop["size_use"]["confirm"]:
        runs = {}
        for tag in "ab":
            run, verdict = native_run(loop, "look", size_key, loop["sky_order"][0], quality=f"file:{execcmds}",
                                      label=f"ceiling-{tag}-{size_key}", direct=direct, parent=group / "runs")
            runs[tag] = {"run": str(run), "status": verdict["status"]}
        result["sizes"][size_key] = runs
        write_json(group / "reference.json", result)
    result["finished_at"] = iso_now()
    write_json(group / "reference.json", result)
    return group, judge_reference(group, loop)


def judge_reference(group, loop):
    result = read_json(group / "reference.json")
    gates, foreign, rows = [], [], []
    for size_key, entry in result["sizes"].items():
        first, second = Path(entry["a"]["run"]), Path(entry["b"]["run"])
        meta = read_json(first / "run.json")
        names = still_names(loop, "look", meta["sky"], meta["size"])
        entry["repeat"] = look_scores(loop, second, first, names)
        entry["min"] = min(entry["repeat"].values()) if entry["repeat"] else None
        gates.append(M.gate("repeat_ssim_min:" + size_key, entry["min"], loop["budgets"]["look"]["repeat_ssim_min"], op=">=",
                            unit="SSIM", note=f"{len(entry['repeat'])} of {len(names)} stills; ceiling run A against run B, "
                                              "below the limit the round is invalid"))
        # Each candidate is scored on every still against ceiling A, so a reference with fewer stills fails.
        gates.append(M.gate("repeat_stills:" + size_key, len(entry["repeat"]), len(names), op="==", unit="stills",
                            note="stills that both ceiling runs hold at the run's size"))
        for folder in (first, second):
            foreign += (read_json(folder / "verdict.json", {}) or {}).get("contended_by") or []
        rows += [{"view": view_key(name), "ceiling": first / name, "candidate": second / name} for name in names]
    verdict = M.verdict(gates, foreign=foreign or None, notes=["the candidate tile is the second ceiling render"])
    write_json(group / "reference.json", result)
    write_json(group / "verdict.json", verdict)
    M.write_review(group, rows, loop, title="NORD mobile gauntlet reference: " + group.name, verdict_data=verdict)
    return verdict


def tune_run(loop, direct=False, until=None, reference=None, confirm=True):
    """The overnight tune: gauntlet_tune.search with native runs as its measure, then the native confirmation. Every
    candidate is kept in tune.json, which is saved after each one. Returns (folder, tune)."""
    size_key = loop["size_use"]["tune"][0]
    feasible = loop["budgets"]["feasible"]
    first_sky = loop["sky_order"][0]
    stored = read_json(Path(reference) / "reference.json") if reference else None
    require(reference is None or (stored and (stored.get("sizes") or {}).get(size_key, {}).get("repeat")),
            "--reference must name a judged reference folder that holds the tune size")
    if stored:
        # The ceiling stills must come from the same build as the candidates, or every Look compares two builds.
        here, there = (git_state()["commit"], build_state()), ((stored.get("commit") or {}).get("commit"), stored.get("build"))
        require(here == there, f"--reference was rendered at commit {there[0]} with build {there[1]}, but this package is commit "
                               f"{here[0]} with build {here[1]}; render a new reference. No run was started.")
        # Every candidate is scored on all its stills against ceiling A, so each stored ceiling run needs every still, a
        # clean exit and no foreign GPU process, as render_ceiling requires of a new one.
        for tag in "ab":
            folder = Path(stored["sizes"][size_key][tag]["run"])
            verdict = read_json(folder / "verdict.json") or {"gates": []}
            error = look_error(loop, verdict, scored=False)
            require(error is None and verdict.get("status") != "contended", f"--reference ceiling run {tag} ({folder}): "
                    f"{error or 'contended by a foreign GPU process'}; render a new reference. No run was started.")
    group = new_run_dir("tune")
    candidates, runs, tune_path = group / "candidates", group / "runs", group / "tune.json"
    ceiling = T.make_candidate(loop, None, "ceiling", 0, "ceiling", cvars=loop["profiles"]["ceiling"]["cvars"], look_only=True)
    ceiling_file, _ = T.write_candidate_files(candidates, ceiling)
    names = still_names(loop, "look", first_sky, loop["sizes"][size_key]["size"])
    # The search measures the baseline before the ceiling, but a Look needs the ceiling stills. So ceiling A is rendered
    # (or taken from --reference) before the first scored candidate, and the search's first ceiling record claims it.
    index, looked, early = {}, [], {"result": None, "claimed": False, "repeat": False}
    ceilings = [Path(stored["sizes"][size_key][tag]["run"]) for tag in "ab"] if stored else []

    def render_ceiling(label):
        run, verdict = native_run(loop, "look", size_key, first_sky, quality=f"file:{ceiling_file}", label=label, direct=direct,
                                  parent=runs)
        result = {"contended": verdict["status"] == "contended", "run": str(run),
                  "error": run_error(read_json(run / "run.json")) or look_error(loop, verdict, scored=False)}
        if not result["contended"] and not result["error"]:
            ceilings.append(run)
        return result

    def measure(candidate):
        execcmds, _ = T.write_candidate_files(candidates, candidate)
        quality, entry = f"file:{execcmds}", index.setdefault(candidate["id"], {})
        if candidate["look_only"]:
            looked.append(candidate["id"])
            if stored:
                entry.update(look=str(ceilings[min(len(looked), 2) - 1]), reference=str(reference))
                return {"repeat_ssim": stored["sizes"][size_key]["repeat"]} if len(looked) == 2 else {}
            if early["result"] and not early["claimed"]:
                early["claimed"] = True
                result = dict(early["result"])
            else:
                result = render_ceiling(candidate["id"] + "-look")
            entry["look"] = result.pop("run")
            if len(ceilings) == 2 and not early["repeat"]:
                early["repeat"] = True
                result["repeat_ssim"] = look_scores(loop, ceilings[1], ceilings[0], names)
            return result
        if not ceilings:
            early["result"] = render_ceiling("ceiling-first-look")
            if early["result"]["contended"] or early["result"]["error"]:
                return dict(early["result"])
        run, verdict = native_run(loop, "perf", feasible["size"], feasible["sky"], quality=quality, label=candidate["id"] + "-perf",
                                  direct=direct, parent=runs)
        entry["perf"] = str(run)
        meta = read_json(run / "run.json")
        result = dict(T.result_from_verdict(verdict, readback=meta.get("readback") or None), error=run_error(meta))
        if not result["contended"] and not result["error"]:
            look, look_verdict = native_run(loop, "look", size_key, first_sky, quality=quality, label=candidate["id"] + "-look",
                                            direct=direct, parent=runs, ceiling=ceilings[0] if ceilings else None)
            entry["look"] = str(look)
            images = (look_verdict.get("values") or {}).get("images")
            error = run_error(read_json(look / "run.json")) or look_error(loop, look_verdict)
            result.update(images=None if error else images, look=None if error else sum(images.values()) / len(images),
                          error=error, contended=look_verdict["status"] == "contended")
        return result

    extra = {"runs": index, "reference": str(reference) if reference else None, "folder": str(group)}
    tune = dict(T.search(loop, measure, until=until, log=lambda text: print(text, flush=True),
                         save=lambda partial: T.write_tune(tune_path, dict(partial, **extra)),
                         first_s=first_candidate_s(loop, reference)), **extra)
    if confirm:
        tune["native_confirmation"] = confirm_native(loop, tune, group, direct, until)
    T.write_tune(tune_path, tune)
    return group, tune


def first_candidate_s(loop, reference):
    """The planned time of the tune's first candidate: its perf and look runs, and without --reference the ceiling look
    run that measure() renders before them."""
    return T.candidate_estimate_s(loop) + (0 if reference else T.run_estimate_s(loop, "look"))


def confirm_plan(loop, tune):
    """The confirmation's first plan per run: gauntlet_tune.run_estimate_s, made longer by as much as the search found
    this host slower than its own plan (tune.json planned_candidate_s against first_candidate_s)."""
    slower = (tune.get("planned_candidate_s") or 0) / first_candidate_s(loop, tune.get("reference"))
    return {"run_s": T.run_estimate_s(loop, "perf", loop["confirm_laps"]) * max(1.0, slower)}


def confirm_native(loop, tune, group, direct=False, until=None):
    """Step 7, native part: the baseline, then the ranked candidates best first, each for confirm_laps measured laps in
    both skies, landscape and portrait, until one passes every native gate. It stops at the first result the window
    cut (stop_reason window_end), or that a foreign GPU process shared twice (stop_reason contended). The stream rows
    and the co-op guard come from the stream runs; report adds them through gauntlet_tune.confirm."""
    records = {record["id"]: record for record in tune["candidates"]}
    results, confirmed = {}, None
    plan = confirm_plan(loop, tune)
    one = lambda candidate_id: confirm_candidate(loop, records[candidate_id], group, direct, until, plan)
    finished = lambda: all(confirmation_finished(loop, result) for result in results.values())
    if "baseline" in records:
        results["baseline"] = one("baseline")
    for candidate_id in tune["ranking"]:
        if not finished():
            break
        results[candidate_id] = results.get(candidate_id) or one(candidate_id)
        if results[candidate_id]["passed"]:
            confirmed = candidate_id
            break
    cut = any(CONFIRM_CUT in result["reasons"] for result in results.values())
    return {"results": list(results.values()), "confirmed_native": confirmed,
            "stop_reason": None if finished() else "window_end" if cut else "contended",
            "note": "native gates only; report adds the stream rows and the co-op guard"}


def confirmation_finished(loop, result):
    """True when a native confirmation ran in every sky at every confirm size without a foreign GPU process. A result
    the window cut, or that a foreign GPU process shared twice, is not finished, so confirm runs that candidate again."""
    clean = [run for run in result["runs"] if run["status"] != "contended"]
    return len(clean) == len(loop["sky_order"]) * len(loop["size_use"]["confirm"])


def confirm_candidate(loop, record, group, direct=False, until=None, plan=None):
    """One candidate's native confirmation: confirm_laps measured laps in each sky at each confirm size. A run starts
    only when its planned time ends before until, so the live demo starts on time. The plan is
    gauntlet_tune.run_estimate_s, raised to the longest run so far; the caller's plan dict keeps it across candidates.
    A contended run is run once more, as in the search; a second contended run stops the confirmation as missing
    evidence, not as a failure."""
    candidate_id = record["id"]
    execcmds, _ = T.write_candidate_files(group / "candidates", record)
    outcome = {"id": candidate_id, "runs": [], "reasons": [], "passed": False}
    plan = {} if plan is None else plan
    plan.setdefault("run_s", T.run_estimate_s(loop, "perf", loop["confirm_laps"]))
    for sky in loop["sky_order"]:
        for size_key in loop["size_use"]["confirm"]:
            for _ in range(2):
                if until is not None and time.time() + plan["run_s"] > until:
                    outcome["reasons"].append(CONFIRM_CUT)
                    return outcome
                started = time.time()
                run, verdict = native_run(loop, "perf", size_key, sky, laps=loop["confirm_laps"], quality=f"file:{execcmds}",
                                          label=f"confirm-{candidate_id}-{sky}-{size_key}", direct=direct, parent=group / "runs")
                # As in the search: a host slower than the estimate does not overrun the window.
                plan["run_s"] = max(plan["run_s"], time.time() - started)
                outcome["runs"].append({"run": str(run), "sky": sky, "size": size_key, "status": verdict["status"]})
                if verdict["status"] != "contended":
                    break
            if verdict["status"] == "contended":
                outcome["reasons"].append(f"{CONFIRM_CONTENDED}: {sky} {size_key}")
                return outcome
            if verdict["status"] != "pass":
                failing = [gate["name"] for gate in verdict["gates"] if gate["result"] != "pass"]
                outcome["reasons"].append(f"{sky} {size_key}: {verdict['status']} ({', '.join(failing[:6])})")
    outcome["passed"] = not outcome["reasons"]
    return outcome


def confirm_next(loop, group, candidate_id=None, direct=False, until=None):
    """Step 7 again, after a stream row or the co-op guard dropped a candidate, or after the window cut a confirmation:
    the native confirmation of the best ranked candidate without a finished one (or of candidate_id), added to
    tune.json, with the baseline first if it has none. A result the window cut, or that a foreign GPU process shared
    twice, is run again and replaced. It writes no profile; only write-profile with --approved does. Returns the last
    outcome; when the window cuts the baseline, that is the baseline's, and the candidate does not run."""
    group = Path(group)
    tune = read_json(group / "tune.json")
    require(tune is not None, f"{group} has no tune.json")
    native = tune.setdefault("native_confirmation", {"results": [], "confirmed_native": None, "stop_reason": None,
                                                     "note": "native gates only; report adds the stream rows and the co-op guard"})
    done = {result["id"] for result in native["results"] if confirmation_finished(loop, result)}
    candidate_id = candidate_id or next((ranked for ranked in tune["ranking"] if ranked not in done), None)
    require(candidate_id is not None, "Every ranked candidate already has a native confirmation; nothing was run.")
    require(candidate_id in tune["ranking"], f"candidate {candidate_id} is not ranked in {group / 'tune.json'}; nothing was run.")
    require(candidate_id not in done, f"candidate {candidate_id} already has a native confirmation; nothing was run.")
    records = {record["id"]: record for record in tune["candidates"]}
    outcome, plan = None, confirm_plan(loop, tune)
    # The baseline runs first, and once only when it is the ranked candidate itself.
    first = ["baseline"] if "baseline" in records and "baseline" not in done and candidate_id != "baseline" else []
    for wanted in first + [candidate_id]:
        outcome = dict(confirm_candidate(loop, records[wanted], group, direct, until, plan), added_at=iso_now())
        native["results"] = [result for result in native["results"] if result["id"] != wanted] + [outcome]
        if outcome["passed"] and wanted != "baseline" and not native.get("confirmed_native"):
            native["confirmed_native"] = wanted
        T.write_tune(group / "tune.json", tune)
        if not confirmation_finished(loop, outcome):
            break
    return outcome


def stream_evidence(group, tune):
    """Stream runs made after the tune started, by candidate, oldest first (run.json started_at, then the folder): a
    file: quality from the tune's candidates folder names its candidate, and current names the baseline."""
    evidence = {}
    for path in sorted(OUT.glob("*/run.json")):
        meta = read_json(path)
        if not meta or meta.get("kind") != "stream" or (meta.get("started_at") or "") < (tune.get("started_at") or ""):
            continue
        quality = meta.get("quality") or {}
        if quality.get("name") == "current":
            candidate_id = "baseline"
        elif quality.get("name") == "file" and Path(quality.get("path", "")).parent == group / "candidates":
            candidate_id = Path(quality["path"]).stem
        else:
            continue
        verdict = read_json(path.parent / "verdict.json", {}) or {}
        evidence.setdefault(candidate_id, []).append(
            {"run": str(path.parent), "label": meta["label"], "row": meta.get("row"), "pin": meta.get("pin"),
             "portrait": meta.get("portrait"), "status": verdict.get("status"), "started_at": meta.get("started_at"),
             "two_viewer_fps": (verdict.get("values") or {}).get("two_viewer_fps")})
    # The user names a stream run's folder, so the folder name alone does not give the order.
    for rows in evidence.values():
        rows.sort(key=lambda row: (row["started_at"] or "", row["run"]))
    return evidence


def round_report(group, loop):
    """Confirm the round with gauntlet_tune.confirm from the recorded evidence (native confirmation and stream runs),
    then write report.json, verdict.json and review.html. Nothing is launched."""
    tune = read_json(group / "tune.json")
    native = {result["id"]: result for result in (tune.get("native_confirmation") or {}).get("results", [])}
    streams = stream_evidence(group, tune)
    needed = {(loop["sizes"][key]["rung"], loop["sizes"][key]["size"][1] > loop["sizes"][key]["size"][0])
              for key in loop["size_use"]["stream"]}
    missing_evidence = ("native confirmation not run", CONFIRM_CUT, CONFIRM_CONTENDED, "stream rows missing",
                        "stream row unverified", "co-op guard unverified")

    def confirm_fn(record):
        rows = streams.get(record["id"], [])
        outcome = native.get(record["id"])
        reasons = ["native confirmation not run"] if outcome is None else list(outcome["reasons"])
        # The newest solo row per rung and orientation: a row sampled again replaces the older one.
        solo = list({(row["pin"], row["portrait"]): row for row in rows if row["row"] == "solo"}.values())
        missing = needed - {(row["pin"], row["portrait"]) for row in solo}
        if missing:
            reasons.append("stream rows missing: " + ", ".join(f"rung {pin} {'portrait' if tall else 'landscape'}"
                                                               for pin, tall in sorted(missing)))
        # Only a failed row fails; a contended or unverified row is missing evidence until that rung is sampled again.
        reasons += [f"stream {row['label']}: fail" if row["status"] == "fail" else
                    f"stream row unverified: {row['label']} ({row['status'] or 'no verdict'})" for row in solo if row["status"] != "pass"]
        # A two-viewer row that a foreign GPU process shared measures that process too, so the co-op guard skips it.
        two = [row["two_viewer_fps"] for row in rows if row["row"] == "two_viewer" and row["two_viewer_fps"] is not None
               and row["status"] != "contended"]
        return {"passed": not reasons, "reasons": reasons, "two_viewer_fps": two[-1] if two else None}

    tune = T.confirm(tune, loop, confirm_fn)
    tune["stream_evidence"] = streams
    T.write_tune(group / "tune.json", tune)
    confirmed = tune["confirmation"]["confirmed"]
    chosen = confirmed or tune.get("winner")
    records = {record["id"]: record for record in tune["candidates"]}
    index = tune.get("runs") or {}
    first = lambda phase: next((index.get(r["id"], {}).get("look") for r in tune["candidates"]
                                if r["phase"] == phase and index.get(r["id"], {}).get("look")), None)
    ceiling, baseline = first("ceiling"), first("baseline")
    candidate = baseline if chosen == "baseline" else (index.get(chosen) or {}).get("look")
    solo = [row for row in streams.get(chosen, []) if row["row"] == "solo" and row["pin"] == 0 and not row["portrait"]]
    stream = solo[-1]["run"] if solo else None
    size = loop["sizes"][loop["size_use"]["tune"][0]]["size"]
    rows = [{"view": view_key(name), "ceiling": Path(ceiling) / name if ceiling else None,
             "baseline": Path(baseline) / name if baseline else None, "candidate": Path(candidate) / name if candidate else None,
             "stream": stream_shot(stream, name.split("/")[-1].split("-")[0])}
            for name in still_names(loop, "look", loop["sky_order"][0], size)]
    record = records.get(chosen) or {}
    repeat = (tune.get("ties") or {}).get("repeat") or {}
    gates = M.look_gates(loop, record.get("images"), baseline_mean=(tune.get("baseline") or {}).get("look"),
                         repeat_min=repeat.get("min"))
    results = tune["confirmation"]["results"]
    # Unverified while a ranked candidate has only missing evidence, which confirm and the stream rows can still give.
    still_open = any(all(reason.startswith(missing_evidence) for reason in result.get("reasons", []))
                     for result in results if result["id"] in tune["ranking"])
    gates.append(M.gate("confirmed", 1 if confirmed else (None if still_open else 0), 1, op="==", unit="candidate",
                        note=confirmed or "; ".join(f"{r['id']}: {', '.join(r.get('reasons', [])[:3])}" for r in results[:4]) or None))
    report = {"version": 1, "tune": str(group / "tune.json"), "winner": tune.get("winner"), "confirmed": confirmed, "shown": chosen,
              "stop_reason": tune.get("stop_reason"), "measured": tune.get("measured"), "ranking": tune.get("ranking"),
              "confirmation": tune["confirmation"], "stream_evidence": streams, "made_at": iso_now()}
    verdict = M.verdict(gates, values={"look": record.get("look"), "baseline_look": (tune.get("baseline") or {}).get("look")},
                        notes=[f"tiles show {chosen or 'no candidate'}; the user's verdict on the look is final"])
    write_json(group / "report.json", report)
    write_json(group / "verdict.json", verdict)
    M.write_review(group, rows, loop, title="NORD mobile gauntlet round: " + group.name, verdict_data=verdict)
    return verdict


# ---------------------------------------------------------------- route, profile write and the self-check

def route_lateral(data):
    """The largest lateral error of a route.json in metres: max_offset_m, else the largest sample offset_m, or None."""
    lateral = data.get("max_offset_m")
    offsets = [abs(sample.get("offset_m") or 0) for sample in data.get("samples") or [] if isinstance(sample.get("x_m"), (int, float))]
    return max(offsets) if lateral is None and offsets else lateral


def route_report(loop, run=None):
    """The stops in drive order, the generated header check, and when a run is given its native/route.json checks:
    loop length, lateral error (max_offset_m over every lap), the end within reach of S1, and the stop lines in drive
    order. The keys are those QuebecGauntlet.cpp WriteRoute writes."""
    import make_gauntlet_route
    manifest = json.loads((ROOT / loop["camera_manifest"]).read_text())
    check = subprocess.run([sys.executable, str(ROOT / "Scripts/make_gauntlet_route.py"), "--check"], capture_output=True, text=True)
    out = {"stops": [{"label": label, "name": name, "camera": camera, "eye_cm": eye, "target_cm": target}
                     for label, name, camera, eye, target in make_gauntlet_route.stops(loop, manifest)],
           "legs": M.leg_names(loop), "header_current": check.returncode == 0, "header_check": (check.stdout + check.stderr).strip()}
    if run is None:
        return out, out["header_current"]
    data = read_json(Path(run) / "native/route.json") or {}
    # A native run's game log, or the host log a stream run copied.
    log_path = next((path for path in (Path(run) / "native/game.log", Path(run) / "stream/host.log") if path.is_file()), None)
    stops = []
    for label in STOP_LINE.findall(log_path.read_text(errors="replace") if log_path else ""):
        if not stops or stops[-1] != label:
            stops.append(label)
    samples = [sample for sample in data.get("samples") or [] if isinstance(sample.get("x_m"), (int, float))]
    lateral = route_lateral(data)
    first = next((stop for stop in data.get("stops") or [] if stop.get("label") == loop["order"][0]), None)
    end = (((samples[-1]["x_m"] - first["x_m"]) ** 2 + (samples[-1]["y_m"] - first["y_m"]) ** 2) ** .5
           if samples and first and data.get("exit") == loop["exit_codes"]["done"] else None)
    order = loop["order"]
    # Each stop line names the next stop of the loop (a lap starts at S1 without a line).
    in_order = None
    if stops:
        in_order = set(stops) == set(order) and all(order[(order.index(a) + 1) % len(order)] == b for a, b in zip(stops, stops[1:]))
    route, drive = loop["route"], loop["drive"]
    gates = [M.gate("length_min_m", data.get("loop_length_m"), route["length_min_m"], op=">=", unit="m"),
             M.gate("length_max_m", data.get("loop_length_m"), route["length_max_m"], unit="m"),
             M.gate("end_m", end, route["end_within_m"], unit="m", note="the last pose of a finished run against the S1 stop point"),
             M.gate("max_lateral_m", lateral, drive["max_lateral_error_m"], unit="m"),
             M.gate("stop_order", in_order, True, op="==", unit="", note=" ".join(stops) or None)]
    out["run"] = {"folder": str(run), "gates": gates, "route_json": bool(data)}
    return out, out["header_current"] and all(gate["result"] == "pass" for gate in gates)


def write_profile(group, candidate_id, approved, path=None):
    """Rewrite [NordPhoneStream DeviceProfile] with one tune candidate, only with the user's approval of its paired
    captures. The stream default stays current; flipping it to phone is a separate change."""
    require(approved, "write-profile changes the phone profile. Run it only after the user approves the candidate's paired "
                      "captures, with --approved; nothing was written.")
    group = Path(group)
    tune = read_json(group / "tune.json")
    require(tune is not None, f"{group} has no tune.json")
    record = next((record for record in tune["candidates"] if record["id"] == candidate_id), None)
    require(record is not None, f"candidate {candidate_id} is not in {group / 'tune.json'}")
    require(not record.get("look_only") and record.get("feasible"),
            f"candidate {candidate_id} never met the frame budget (look-only or infeasible); it cannot become the phone profile")
    written = T.write_candidate_profile(group / "tune.json", candidate_id, path or PROFILES_INI)
    confirmed = (tune.get("confirmation") or {}).get("confirmed")
    approval = {"candidate": candidate_id, "approved_at": iso_now(), "profile": str(written), "cvars": record["cvars"],
                "confirmed": confirmed, "note": None if confirmed == candidate_id else "this candidate is not the confirmed one"}
    write_json(group / "approval.json", approval)
    return approval


def self_check():
    """Offline checks: loop.json and the profile section, every command line, the refusals and the log and stream
    parsers. Nothing is launched and nothing is written."""
    loop = M.load_loop()
    assert not T.check_loop(loop), T.check_loop(loop)
    assert T.same_cvars(T.parse_execcmds(browser_streaming.QUALITY), loop["profiles"]["baseline"]["cvars"])
    profile = T.read_profile(PROFILES_INI.read_text()) if PROFILES_INI.is_file() else None
    assert profile and profile["listed"] and profile["cvars"].get("t.MaxFPS") == 60, "the listed NordPhoneStream section keeps t.MaxFPS 60"
    run = OUT / "20261023T220000Z-self-check"
    plan = {"run": run, "mode": "perf", "size": [1412, 652], "sky": "night_rain", "sky_args": sky_entry(loop, "night-rain")[1],
            "laps": 1, "quality": browser_streaming.stream_quality("current"), "max_s": run_timeout(loop, "perf", 1)}
    # The game's own limits: load 180 + delay 10 + ready 60 + warm and measured laps 2 x 360 + CSV 30, and a look run's
    # five holds at the 90 s stills timeout.
    assert plan["max_s"] == 1000 and run_timeout(loop, "look", 1) == 1090, (plan["max_s"], run_timeout(loop, "look", 1))
    direct = direct_command(loop, plan)
    assert direct[:3] == ["bash", str(PACKAGE / "Quebec.sh"), "/Game/Maps/LaFontaine"] and direct[-1] == f"-abslog={run}/native/game.log"
    for flag in ("-RenderOffscreen", "-ForceRes", "-ResX=1412", "-ResY=652", "-unattended", "-nosound", "-csvGpuStats",
                 "-NordGauntlet", "-NordGauntletMode=perf", f"-NordGauntletRun={run}", "-NordGauntletLaps=1",
                 f"-NordGauntletExpect={run}/quality.expect", "-NordHour=22", "-NordWeather=Rain", "-NordFreezeTime",
                 "-NordFreezeWeather", "-NordNoPolice", "-NordNoCampaign", "-NordNoSideJobs", "-NordNoCampaignSave",
                 "-ExecCmds=" + browser_streaming.QUALITY):
        assert flag in direct, flag
    assert "-NordNoAmbient" not in direct and "-NordNoAmbient" in direct_command(loop, dict(plan, mode="look"))
    phone = direct_command(loop, dict(plan, quality={"name": "phone", "device_profile": "NordPhoneStream"}))
    assert "-DeviceProfile=NordPhoneStream" in phone and not any(argument.startswith("-ExecCmds=") for argument in phone)
    uat = rununreal_command(loop, plan)
    assert uat[:2] == [str(UAT), "RunUnreal"] and f"-build={PACKAGE}" in uat and "-platform=Linux" in uat
    assert uat[-1] == (f"-test=NordMobileLoop(mode=perf,size=1412x652,sky=night-rain,laps=1,run='{run}',"
                       f"execcmds='{run}/quality.execcmds',expect='{run}/quality.expect',maxduration=1000)"), uat[-1]

    def refused(function, *arguments):
        try:
            function(*arguments)
        except RuntimeError:
            return
        raise AssertionError(f"{function.__name__}{arguments} must be refused")

    for arguments in (["-NordHour=15", "-NordFreezeTime"], ["-NordWeather=Rain"], []):
        refused(require_pinned, arguments)
    unpinned = json.loads(json.dumps(loop))
    unpinned["skies"]["day"]["args"] = ["-NordHour=15", "-NordFreezeTime"]
    refused(sky_entry, unpinned, "day")
    refused(sky_entry, loop, "dusk")
    refused(size_entry, loop, "1280x720")
    refused(rununreal_command, loop, dict(plan, run=Path("/tmp/with space")))
    refused(browser_streaming.stream_quality, "file:/etc/passwd")
    refused(write_profile, run, "01-gi1", False)
    assert size_entry(loop, "652x1412")[0] == "top_portrait" and sky_entry(loop, "day")[0] == "day"
    assert still_names(loop, "look", "day", [1412, 652])[:2] == ["look/day/S1-eye-1412x652.png", "look/day/S1-chase-1412x652.png"]
    assert len(still_names(loop, "look", "day", [1412, 652])) == loop["budgets"]["look"]["images"]
    log = ("NORD_GAUNTLET cvar name=t.MaxFPS expected=60 actual=60.000000 match=1\nNORD_GAUNTLET cvars checked=1 mismatches=0\n"
           "NORD_GAUNTLET cvar name=sg.ShadingQuality expected=3 actual=3 match=1\nNORD_GAUNTLET route stop=S1 leg=S1-S2 leg_m=513.0\n"
           "NORD_GAUNTLET leg=S1-S2 lap=1 begin\nNORD_GAUNTLET fail exit=4 reason=cvar_mismatch\n"
           "NORD_GAUNTLET result exit=4 reason=cvar_mismatch mode=perf laps=1 max_offset_m=0.000\n")
    assert parse_readback(log) == {"t.MaxFPS": "60.000000", "sg.ShadingQuality": "3"}
    assert cvar_mismatches({"t.MaxFPS": "60"}, parse_readback(log)) == [] and cvar_mismatches({"t.MaxFPS": "60"}, {}) is None
    assert cvar_mismatches({"r.ScreenPercentage": "75"}, {"t.MaxFPS": "60"}) == [{"name": "r.ScreenPercentage", "expected": "75", "actual": "missing"}]
    assert game_exit(loop, log, None, False, "rununreal") == {"code": 4, "name": "cvar_mismatch", "source": "log"}
    assert game_exit(loop, "", None, True, "direct")["code"] == loop["exit_codes"]["timeout"]
    assert game_exit(loop, "", 0, False, "rununreal")["code"] is None and game_exit(loop, "", 2, False, "direct")["name"] == "stuck"
    no_run = "NORD_GAUNTLET error=no_run exit=6 reason=setup (the client command line needs -NordGauntlet)"
    assert game_exit(loop, no_run, None, False, "rununreal") == {"code": 6, "name": "setup", "source": "log"}
    events = [{"ms": 500.0, "late": True, "line": "NORD_GAUNTLET route stop=S1 x_m=360.00 y_m=62.00 along_m=0.0 leg=S1-S2 leg_m=513.0"},
              {"ms": 700.0, "late": False, "line": "NORD_GAUNTLET lap=0 warm=begin"},
              {"ms": 1000.0, "late": False, "line": "NORD_GAUNTLET leg=S1-S2 lap=1 begin"},
              {"ms": 9000.0, "late": False, "line": "NORD_GAUNTLET done laps=1"},
              {"ms": 9500.0, "late": False, "line": "NORD_GAUNTLET result exit=0 reason=done mode=stream laps=1 max_offset_m=0.800"}]
    assert lap_window(events) == ((1000.0, 9000.0), []) and lap_window([events[0], dict(events[2], late=True), events[3]])[0] is None
    assert lap_window(events[3:])[0] is None
    counters = {"framesDecoded": 0, "bytesReceived": 0, "jitterBufferDelay": 0, "jitterBufferEmittedCount": 0, "totalDecodeTime": 0}
    summary = window_summary([dict(counters, timeMs=0), dict(counters, timeMs=2000, framesDecoded=60, jitterBufferDelay=3.0,
                                                               jitterBufferEmittedCount=60, totalDecodeTime=.3)])
    assert summary["decodedFps"] == 30 and abs(summary["jitterBufferMsPerFrame"] - 50) < 1e-9 and abs(summary["decodeMsPerFrame"] - 5) < 1e-9
    assert "longestFrameGapMs" not in summary and "delay" not in summary
    timed = window_summary([dict(counters, timeMs=0, roundTripTime=.002, totalProcessingDelay=0),
                            dict(counters, timeMs=2000, framesDecoded=60, roundTripTime=.004, totalProcessingDelay=1.2)],
                           [{"timeMs": 900, "kind": "qp", "avgQP": 22}, {"timeMs": 950, "kind": "qp", "avgQP": 0}])
    assert timed["delay"]["rttMs"] == {"mean": 3.0, "max": 4.0} and abs(timed["delay"]["processingMsPerFrame"] - 20) < 1e-9
    assert timed["encoderQp"] == {"events": 1, "mean": 22, "max": 22} and timed["delay"]["frontend"] == {"events": 0}
    # stream-sample.mjs timeOrigin (ms since the epoch) plus a frame's performance.now() time is its wall time.
    assert frame_clock({"timeOrigin": 1.7e12})({"expectedDisplayTime": 250.5}) == 1.7e12 + 250.5 and frame_clock({}) is None
    # The sampler's default: delay 95 + ready grace 60 + warm and gated lap 2 x 360 + five 4 s holds + 30.
    assert stream_seconds(loop) == 925, stream_seconds(loop)
    whole = {"gates": [M.gate("stills", 20, 20, op="=="), M.gate("game_exit", 0, 0, op="==")],
             "values": {"images": {f"view{n}": .9 for n in range(20)}}}
    partial = dict(whole, values={"images": {"day/S1-eye": .97, "day/S1-chase": .97}})
    assert look_error(loop, whole) is None and look_error(loop, partial) == "look run: 2 of 20 stills scored"
    assert look_error(loop, dict(whole, gates=[M.gate("stills", 2, 20, op="==")]), scored=False) == "look run: stills fail, game_exit missing"
    assert friend_log({"host_log": "/x/host-20261023-1.log"}) == Path("/x/friend-20261023-1.log")
    assert route_lateral({"samples": [{"x_m": 0, "offset_m": -1.5}, {"x_m": 1, "offset_m": .4}]}) == 1.5
    pmon = ("# gpu         pid   type     sm    mem    enc    dec     fb   command\n"
            "# Idx           #    C/G      %      %      %      %     MB   name\n"
            "    0       1234     G     45     20      -      -   3900   Quebec\n    0       1234     G     55     20      -      -   3950   Quebec\n")
    assert parse_pmon(pmon) == {1234: {"name": "Quebec", "sm": [45.0, 55.0], "fb_mib": [3900.0, 3950.0]}}
    gpu = {"own": [1234], "before": {"processes": [{"pid": 99, "name": "/usr/lib/xorg/Xorg", "used_mib": 4}]},
           "samples": [{"processes": [{"pid": 1234, "name": "Quebec", "used_mib": 4100}, {"pid": 777, "name": "dota2", "used_mib": 3000}],
                        "cpu_percent": {"1234": 180.0}, "gpu": {"util_percent": 90.0}}], "after": {"processes": []}}
    vram, foreign, report, notes, gate = gpu_findings(gpu)
    assert vram == {1234: 4100} and [row["pid"] for row in foreign] == [777] and gate["result"] == "pass" and not notes
    assert report["ignored_desktop_processes"] == ["/usr/lib/xorg/Xorg"] and report["cpu_percent"]["1234"]["max"] == 180.0
    assert gpu_findings({})[4]["result"] == "unverified"
    print("Self-check passed: loop.json and the NordPhoneStream section, direct and RunUnreal command lines, look-only "
          "world flag, phone profile flag, pinned-sky, size, path, quality and approval refusals, game-log, stream-window, "
          "lap delay, page clock, look-result, pmon and GPU-process parsers. Nothing was launched.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("self-check", help="offline checks; launches nothing")
    route = commands.add_parser("route", help="stops, legs and the header check; with a run, its route.json checks")
    route.add_argument("run", nargs="?", type=Path)
    native = commands.add_parser("native", help="one perf or look run of the Browser package")
    native.add_argument("--mode", choices=("perf", "look"), default="perf")
    native.add_argument("--size", default="1412x652")
    native.add_argument("--sky", default="night-rain")
    native.add_argument("--laps", type=int)
    native.add_argument("--quality", default="current", help="current, phone, or file:<candidate .execcmds under Saved/Gauntlet>")
    native.add_argument("--label")
    native.add_argument("--direct", action="store_true", help="start Builds/Browser/Linux/Quebec.sh instead of RunUAT RunUnreal")
    native.add_argument("--ceiling", type=Path, help="score this look run's stills against a ceiling look run")
    native.add_argument("--timeout", type=int, help="seconds the game may run before it is stopped (default from loop.json); "
                                                     "RunUnreal adds its start-up time")
    stream = commands.add_parser("stream", help="sample the stream lap of a lifecycle started with NORD_STREAM_GAUNTLET")
    stream.add_argument("--run", type=Path, required=True)
    stream.add_argument("--slot", choices=("NordHost", "NordFriend1"), default="NordHost")
    stream.add_argument("--pin", type=int, choices=range(4), default=0, help="the pinned phone rung: 0 is the 1280 edge, 1 the 960 edge")
    stream.add_argument("--portrait", action="store_true")
    stream.add_argument("--relay", action="store_true", help="force the TURN relay (a report-only row)")
    stream.add_argument("--two-viewers", action="store_true", help="sample NordHost and NordFriend1 together (a report-only row)")
    stream.add_argument("--look", action="store_true",
                        help="drag on the stream all along (the input row: stream figures report-only, the car's lateral error gated)")
    stream.add_argument("--url", default="http://127.0.0.1:8100/")
    stream.add_argument("--seconds", type=int, help="sampler seconds (default: the delay, the ready grace, the warm and gated laps at "
                                                     "the lap limit and the holds; the sampler stops at END when the lap ends)")
    reference = commands.add_parser("reference", help="render the ceiling look twice and check that it repeats")
    reference.add_argument("--direct", action="store_true")
    tune = commands.add_parser("tune", help="the greedy search and the native confirmation")
    tune.add_argument("--direct", action="store_true")
    tune.add_argument("--until", help="local HH:MM when the GPU window ends")
    tune.add_argument("--reference", type=Path, help="reuse a judged reference folder instead of rendering the ceiling")
    tune.add_argument("--no-confirm", action="store_true", help="stop after the search")
    confirm = commands.add_parser("confirm", help="the native confirmation of the next ranked candidate, after a stream row "
                                                  "or the co-op guard dropped one; writes no profile")
    confirm.add_argument("folder", type=Path)
    confirm.add_argument("--candidate", help="a ranked candidate (default: the best ranked one without a finished native "
                                             "confirmation; one the window cut, or a foreign GPU process shared twice, "
                                             "is run again)")
    confirm.add_argument("--until", help="local HH:MM when the GPU window ends")
    confirm.add_argument("--direct", action="store_true")
    report = commands.add_parser("report", help="judge a run, reference or tune folder again from its files")
    report.add_argument("folder", type=Path)
    write = commands.add_parser("write-profile", help="write one tune candidate to the phone profile after approval")
    write.add_argument("folder", type=Path)
    write.add_argument("--candidate", required=True)
    write.add_argument("--approved", action="store_true", help="the user approved this candidate's paired captures")
    args = parser.parse_args(argv)
    try:
        if args.command == "self-check":
            self_check()
            return 0
        if args.command == "write-profile":
            if not args.approved:
                parser.exit(2, "NORD gauntlet: write-profile changes the phone profile. Run it only after the user approves "
                               "the candidate's paired captures, with --approved; nothing was written.\n")
            print(json.dumps(write_profile(args.folder, args.candidate, args.approved), indent=1))
            return 0
        loop = M.load_loop()
        if args.command == "route":
            out, passed = route_report(loop, args.run)
            print(json.dumps(out, indent=1))
            return 0 if passed else 1
        if args.command == "tune":
            group, result = tune_run(loop, args.direct, T.parse_until(args.until) if args.until else None, args.reference,
                                     not args.no_confirm)
            print(json.dumps({"folder": str(group), "winner": result["winner"], "stop_reason": result["stop_reason"],
                              "confirmed_native": (result.get("native_confirmation") or {}).get("confirmed_native")}))
            return 0 if result["winner"] else 1
        if args.command == "confirm":
            outcome = confirm_next(loop, args.folder, args.candidate, args.direct, T.parse_until(args.until) if args.until else None)
            print(json.dumps({"folder": str(args.folder), "candidate": outcome["id"], "passed": outcome["passed"],
                              "reasons": outcome["reasons"]}))
            return 0 if outcome["passed"] else 1
        if args.command == "native":
            folder, verdict = native_run(loop, args.mode, args.size, args.sky, args.laps, args.quality, args.label, args.direct,
                                         ceiling=args.ceiling, timeout=args.timeout)
        elif args.command == "stream":
            folder, verdict = stream_run(loop, args.run, args.slot, args.pin, args.portrait, args.relay, args.two_viewers,
                                         args.url, args.seconds, args.look)
        elif args.command == "reference":
            folder, verdict = reference_run(loop, args.direct)
        else:
            folder = args.folder.resolve()
            verdict = (round_report(folder, loop) if (folder / "tune.json").is_file() else
                       judge_reference(folder, loop) if (folder / "reference.json").is_file() else judge(folder, loop))
        print(json.dumps({"folder": str(folder), "status": verdict["status"], "counts": verdict["counts"]}))
        return 0 if verdict["status"] == "pass" else 1
    except (RuntimeError, OSError, subprocess.SubprocessError, ValueError, KeyError) as error:
        parser.exit(1, f"NORD gauntlet: {error}\n")


if __name__ == "__main__":
    sys.exit(main())
