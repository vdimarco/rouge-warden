"""Judge a NORD mobile gauntlet run: frame times, legs, hitches, gate verdicts, still SSIM and the review page.

Data/Gauntlet/loop.json holds every limit. The game only reports (Source/Quebec/QuebecGauntletModel.h); this module
judges. A gate is pass, fail or unverified (no host value), and a run with a foreign GPU process is contended.

The percentile and the CSV frame-row rule are copied from Scripts/profile_package.py (lines 30-34 and 76-79), not
imported, because importing profile_package.py starts the desktop profile. Data/Gauntlet/fixtures/frametimes.csv
and frametimes_expected.json pin the statistics for this module and for the C++ model.

SSIM follows Wang, Bovik, Sheikh and Simoncelli, "Image Quality Assessment: From Error Visibility to Structural
Similarity" (IEEE TIP, 2004): luma, an 11x11 Gaussian window with sigma 1.5, K1 0.01, K2 0.03, the mean over the
valid window positions and no automatic downsampling. It is numpy only, because skimage is not installed here. A
one-off check in a scratch venv agreed with skimage 0.26 structural_similarity(gaussian_weights=True, sigma=1.5,
use_sample_covariance=False, data_range=255) to 1e-15, on random images and a 1280x720 still.
NVIDIA FLIP (Andersson et al. 2020, pip flip-evaluator) is report-only and used only when it imports.

Run from games/nord-unreal:
  python3 Scripts/gauntlet_metrics.py csv <profiler.csv>     frame statistics per lap and leg, as JSON
  python3 Scripts/gauntlet_metrics.py ssim <a.png> <b.png>   luma SSIM of two stills
"""
import argparse
import csv
import html
import io
import json
import math
import os
from pathlib import Path
import re
import statistics
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render_log_guard  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
LOOP = ROOT / "Data/Gauntlet/loop.json"
csv.field_size_limit(10000000)

# Columns read by name. GPUTime needs -csvGpuStats. The names are unverified until the host CSV shows them.
FIELDS = {"frame": "FrameTime", "game": "GameThreadTime", "render": "RenderThreadTime", "rhi": "RHIThreadTime",
          "gpu": "GPUTime"}
# The CSV profiler writes events in this column, several in one cell separated by ';' (from memory; unverified).
EVENTS_COLUMN = "EVENTS"
# profile_package.py keeps frames[600:-2]: 600 warm-up frames and the final 2, which can belong to the shutdown.
PROFILE_HEAD = 600
PROFILE_TAIL = 2
DELAY_LABEL = "host-PC headless Chromium with --disable-gpu, not a phone, not off-LAN"
# Display servers and shells hold GPU memory on every desktop; they are not a competing workload (unverified list).
DESKTOP_PROCESSES = {"Xorg", "Xwayland", "gnome-shell", "kwin_x11", "kwin_wayland", "plasmashell", "mutter", "sway",
                     "Hyprland", "gamescope"}


def load_loop(path=LOOP):
    return json.loads(Path(path).read_text())


def percentile(values, fraction):
    return sorted(values)[math.ceil((len(values) - 1) * fraction)]


assert percentile([4, 1, 3, 2], .95) == 4


def leg_names(loop):
    """Leg names in drive order, like "S1-S2"; the last leg returns to the first stop."""
    order = loop["order"]
    return [loop["names"]["leg"].format(**{"from": order[i], "to": order[(i + 1) % len(order)]}) for i in range(len(order))]


def most_in_window(values, limit, window_ms):
    """The most frames over limit that end less than window_ms apart, with frames in order and their times summed."""
    ends, clock = [], 0.0
    for value in values:
        clock += value
        if value > limit:
            ends.append(clock)
    most, first = 0, 0
    for last, end in enumerate(ends):
        while end - ends[first] >= window_ms:
            first += 1
        most = max(most, last - first + 1)
    return most


def frame_stats(values, loop):
    """The statistics of Data/Gauntlet/fixtures/frametimes_expected.json. Frames count when strictly over a limit.
    hitches_in_window is the most hitches in any hitch_window_s of frame time."""
    if not values:
        return None
    native = loop["budgets"]["native"]
    return {"frames": len(values), "seconds": round(sum(values) / 1000, 6),
            "p50_ms": percentile(values, .5), "p95_ms": percentile(values, .95), "p99_ms": percentile(values, .99),
            "max_ms": max(values),
            "over_33_3ms": sum(v > native["frame_budget_ms"] for v in values),
            "over_50ms": sum(v > native["slow_frame_ms"] for v in values),
            "over_66_7ms": sum(v > native["hitch_ms"] for v in values),
            "over_250ms": sum(v > native["long_frame_ms"] for v in values),
            "hitches_in_window": most_in_window(values, native["hitch_ms"], native["hitch_window_s"] * 1000)}


# ---------------------------------------------------------------- CSV frames, laps and legs

def read_fixture(path):
    """The shared fixture: columns frame_ms and leg, one measured lap, rows in frame order."""
    with Path(path).open() as stream:
        return [{"lap": 1, "leg": row["leg"], "FrameTime": float(row["frame_ms"])} for row in csv.DictReader(stream)]


def classify_event(text, legs):
    """('leg', name), ('hold',), ('warm',), ('end',) or None for an event cell entry.

    The subsystem chooses the text (Source/Quebec/QuebecGauntlet.cpp). Any of "S1-S2", "leg=S1-S2 lap=1" or
    "NordGauntlet/Leg S1-S2" marks a leg start; a "Category/" prefix is ignored. Other engine events are ignored.
    """
    body = text.rsplit("/", 1)[-1].strip()
    lower = body.lower()
    if re.search(r"\bhold", lower):
        return ("hold",)
    if re.search(r"\bwarm", lower):
        return ("warm",)
    if re.search(r"\b(?:done|fail|failed|end)\b", lower):
        return ("end",)
    for name in re.findall(r"S\d+-S\d+", body):
        if name in legs:
            return ("leg", name)
    return None


def read_profiler_csv(source):
    """Rows of an Unreal CSV profiler file: header, numeric frame rows, events per frame and the metadata row."""
    text = source if isinstance(source, str) and "\n" in source else Path(source).read_text(errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    header = rows[0] if rows else []
    index = {}
    for position, name in enumerate(header):
        index.setdefault(name.strip(), position)
    metadata = {}
    for row in reversed(rows[1:]):
        if any(cell.startswith("[") and cell.endswith("]") for cell in row):
            metadata = {row[i][1:-1]: row[i + 1] for i in range(len(row) - 1) if row[i].startswith("[") and row[i].endswith("]")}
            break
    found = [name for name in FIELDS.values() if name in index]
    missing = [name for name in FIELDS.values() if name not in index]
    events_at = next((position for name, position in index.items() if name.upper() == EVENTS_COLUMN), None)
    # Memory stats such as PhysicalUsedMB or MemoryFreeMB: names from memory (unverified), so match them loosely.
    memory = [name for name in index if name not in FIELDS.values() and (name.endswith("MB") or "memory" in name.lower())]
    frames = []
    if "FrameTime" in index:
        at = index["FrameTime"]
        # profile_package.py:76: metadata and footer rows have no numeric FrameTime; trailing columns do not matter.
        for row in rows[1:]:
            if len(row) > at and re.fullmatch(r"[\d.]+", row[at]):
                frame = {}
                for name in found + memory:
                    cell = row[index[name]] if len(row) > index[name] else ""
                    try:
                        frame[name] = float(cell)
                    except ValueError:
                        frame[name] = None
                cell = row[events_at] if events_at is not None and len(row) > events_at else ""
                frame["events"] = [part.strip() for part in cell.split(";") if part.strip()]
                frames.append(frame)
    return {"header": header, "found": found, "missing": missing, "memory": memory, "events_column": events_at is not None,
            "metadata": metadata, "frames": frames}


def assign_legs(frames, loop):
    """Give each frame its lap and leg from the leg-start events. Returns (samples, discarded counts, notes, legs in
    drive order).

    Frames before the first leg event are the warm-up (the capture should start after the warm lap). Frames after a
    hold, warm or end event and before the next leg event leave the lap. The final PROFILE_TAIL frames are dropped as
    profile_package.py does. Without any leg event, profile_package.py's fixed discard applies and legs stay empty.
    """
    legs = leg_names(loop)
    discarded = {"head": 0, "tail": 0, "hold": 0, "warm": 0, "end": 0}
    notes = []
    kept = frames[:-PROFILE_TAIL] if len(frames) > PROFILE_TAIL else []
    discarded["tail"] = len(frames) - len(kept)
    states = []
    state, lap, last, ignored, order_ok, saw_leg = "head", 0, None, 0, True, False
    for frame in kept:
        for text in frame.get("events", []):
            kind = classify_event(text, legs)
            if kind is None:
                ignored += 1
            elif kind[0] == "leg":
                name = kind[1]
                if name == legs[0] or lap == 0:
                    lap += 1
                expected = legs[0] if last is None else legs[(legs.index(last) + 1) % len(legs)]
                order_ok = order_ok and name == expected
                state, last, saw_leg = name, name, True
            else:
                state = kind[0]
        states.append((state, lap))
    if ignored:
        notes.append(f"{ignored} CSV events were not gauntlet events and were ignored")
    if not saw_leg:
        notes.append("no leg events in the CSV: profile_package.py discard (first 600, last 2), no per-leg values")
        sample = frames[PROFILE_HEAD:-PROFILE_TAIL] if len(frames) > PROFILE_HEAD + PROFILE_TAIL else []
        discarded = {"head": min(len(frames), PROFILE_HEAD), "tail": len(frames) - len(sample) - min(len(frames), PROFILE_HEAD),
                     "hold": 0, "warm": 0, "end": 0}
        return [dict(frame, lap=1, leg=None) for frame in sample], discarded, notes, True
    samples = []
    for frame, (where, number) in zip(kept, states):
        if where in discarded:
            discarded[where] += 1
        else:
            samples.append(dict(frame, lap=number, leg=where))
    if not order_ok:
        notes.append("leg events were out of drive order")
    return samples, discarded, notes, order_ok


def analyze_samples(samples, loop, missing=()):
    """Statistics for all measured frames, each lap, each leg pooled over laps, and each leg within each lap."""
    legs = leg_names(loop)

    def block(chosen):
        out = {}
        for short, name in FIELDS.items():
            values = [s[name] for s in chosen if s.get(name) is not None]
            out[short] = frame_stats(values, loop) if name not in missing else None
        return out

    laps = sorted({s["lap"] for s in samples})
    analysis = {"frames": len(samples), "missing_columns": list(missing), "all": block(samples), "laps": [], "legs": {}}
    for lap in laps:
        chosen = [s for s in samples if s["lap"] == lap]
        entry = {"lap": lap, **block(chosen), "legs": {}}
        for leg in legs:
            in_leg = [s for s in chosen if s.get("leg") == leg]
            if in_leg:
                entry["legs"][leg] = block(in_leg)
        analysis["laps"].append(entry)
    for leg in legs:
        in_leg = [s for s in samples if s.get("leg") == leg]
        if in_leg:
            analysis["legs"][leg] = block(in_leg)
    return analysis


def analyze_csv(source, loop):
    """read_profiler_csv, assign_legs and analyze_samples in one call, with the parse notes and memory peaks."""
    parsed = read_profiler_csv(source)
    samples, discarded, notes, order_ok = assign_legs(parsed["frames"], loop)
    analysis = analyze_samples(samples, loop, parsed["missing"])
    analysis.update({"source": str(source) if not (isinstance(source, str) and "\n" in source) else "<text>",
                     "rows": len(parsed["frames"]), "columns_found": parsed["found"], "events_column": parsed["events_column"],
                     "discarded": discarded, "leg_order_ok": order_ok, "notes": notes, "metadata": parsed["metadata"],
                     "memory": {name: {"max": max(values), "last": values[-1]} for name in parsed["memory"]
                                for values in [[s[name] for s in samples if s.get(name) is not None]] if values},
                     "method": "frames after the first leg event, final 2 dropped (profile_package.py); "
                               "percentile sorted(v)[ceil((n-1)*f)]"})
    if not parsed["events_column"]:
        analysis["notes"].append("the CSV has no EVENTS column")
    return analysis


def legs_ranked(analysis):
    """Legs by FrameTime p95, heaviest first, for native/legs.json and the round 1 ranking."""
    rows = [{"leg": leg, **values["frame"]} for leg, values in analysis.get("legs", {}).items() if values.get("frame")]
    return sorted(rows, key=lambda row: (-row["p95_ms"], row["leg"]))


def lap_median(analysis, field, key, leg=None):
    """The median over laps of one statistic, the confirmation rule (3 laps, median of the per-lap p95)."""
    values = []
    for lap in (analysis or {}).get("laps", []):
        holder = lap["legs"].get(leg) if leg else lap
        if holder and holder.get(field):
            values.append(holder[field][key])
    return statistics.median(values) if values else None


# ---------------------------------------------------------------- log lines and process samples

def parse_summaries(log_text):
    """Every NORD_GAUNTLET summary line as a dict of its key=value pairs (numbers as floats)."""
    rows = []
    for line in log_text.splitlines():
        found = re.search(r"NORD_GAUNTLET summary\b(.*)", line)
        if not found:
            continue
        row = {}
        for key, value in re.findall(r"(\w+)=(\S+)", found.group(1)):
            try:
                row[key] = float(value)
            except ValueError:
                row[key] = value
        rows.append(row)
    return rows


def run_summary(summaries):
    """The whole-run summary: the first line whose leg and lap keys are absent or "all"."""
    for row in summaries:
        if str(row.get("leg", "all")).lower() == "all" and str(row.get("lap", "all")).lower() == "all":
            return row
    return None


def parse_stream_fps(log_text, sleeping=False):
    """NORD_STREAM_FPS windows (Source/Quebec/QuebecStreamIdle.cpp) as dicts; awake windows only unless sleeping."""
    rows = []
    for frames, seconds, asleep, streamer in re.findall(
            r"NORD_STREAM_FPS frames=(\d+) seconds=([\d.]+) sleeping=(\d)(?: streamer=(\S+))?", log_text):
        row = {"frames": int(frames), "seconds": float(seconds), "sleeping": asleep == "1", "streamer": streamer or None}
        row["fps"] = row["frames"] / row["seconds"] if row["seconds"] > 0 else 0.0
        if sleeping or not row["sleeping"]:
            rows.append(row)
    return rows


def parse_gpu_processes(text):
    """GPU processes as {pid, name, used_mib} from nvidia-smi output.

    Takes --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits lines, and the process table
    of plain nvidia-smi ("|  0  N/A  N/A  1234  G  /path/Quebec  5678MiB |"). The compute query may list only compute
    contexts and miss Vulkan games; the table lists both (from memory; unverified until the host shows it).
    """
    rows = []
    for line in text.splitlines():
        table = re.match(r"^\|\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(C\+G|C|G)\s+(.+?)\s+(\d+)MiB\s*\|\s*$", line)
        query = re.match(r"^\s*(\d+)\s*,\s*(.+?)\s*,\s*(\d+)\s*$", line)
        if table:
            rows.append({"pid": int(table.group(1)), "name": table.group(3), "used_mib": int(table.group(4)), "type": table.group(2)})
        elif query:
            rows.append({"pid": int(query.group(1)), "name": query.group(2), "used_mib": int(query.group(3))})
    return rows


def peak_vram(samples, pids):
    """The peak used MiB per game process over a list of parse_gpu_processes results; None when never seen."""
    peaks = {}
    for sample in samples:
        for row in sample:
            if row["pid"] in pids:
                peaks[row["pid"]] = max(peaks.get(row["pid"], 0), row["used_mib"])
    return peaks or None


def foreign_processes(samples, own_pids, ignore=DESKTOP_PROCESSES):
    """GPU processes that are neither the run's own nor a desktop server, over every sample before and after."""
    seen = {}
    for sample in samples:
        for row in sample:
            if row["pid"] not in own_pids and os.path.basename(row["name"]) not in ignore:
                seen.setdefault(row["pid"], row)
    return sorted(seen.values(), key=lambda row: row["pid"])


def decoded_intervals(frames):
    """Decoded frame intervals in ms from requestVideoFrameCallback entries (presentedFrames, expectedDisplayTime).

    When presentedFrames advances by n between two callbacks, the time between them is split into n equal intervals.
    The longest gap is the largest time between callbacks, which never hides a stall.
    """
    ordered = [f for f in frames if f.get("presentedFrames") is not None and f.get("expectedDisplayTime") is not None]
    intervals, longest = [], 0.0
    for before, after in zip(ordered, ordered[1:]):
        count = after["presentedFrames"] - before["presentedFrames"]
        gap = after["expectedDisplayTime"] - before["expectedDisplayTime"]
        if count <= 0 or gap < 0:
            continue
        intervals += [gap / count] * count
        longest = max(longest, gap)
    if not intervals:
        return None
    seconds = (ordered[-1]["expectedDisplayTime"] - ordered[0]["expectedDisplayTime"]) / 1000
    return {"frames": len(intervals), "fps": len(intervals) / seconds if seconds > 0 else 0.0,
            "p50_ms": percentile(intervals, .5), "p95_ms": percentile(intervals, .95), "p99_ms": percentile(intervals, .99),
            "over_33_3ms_percent": sum(v > 33.3 for v in intervals) * 100 / len(intervals),
            "over_50ms_percent": sum(v > 50.0 for v in intervals) * 100 / len(intervals), "longest_gap_ms": longest}


# ---------------------------------------------------------------- gates and the verdict

def gate(name, value, limit, op="<=", unit="ms", note=None):
    """One gate row. A missing value is unverified, never pass."""
    if value is None:
        result = "unverified"
    elif op == "<=":
        result = "pass" if value <= limit else "fail"
    elif op == ">=":
        result = "pass" if value >= limit else "fail"
    else:
        result = "pass" if value == limit else "fail"
    row = {"name": name, "value": value, "limit": limit, "op": op, "unit": unit, "result": result}
    if note:
        row["note"] = note
    return row


def hitch_rule(stats, loop):
    """(most hitches in any 30 s, frames over 250 ms, passed) for frame statistics; passed is None without data. A
    sliding window, not the lap average, so a burst of hitches fails."""
    if not stats or stats["seconds"] <= 0:
        return None, None, None
    native = loop["budgets"]["native"]
    most = stats["hitches_in_window"]
    return most, stats["over_250ms"], most <= native["hitches_per_30s_max"] and stats["over_250ms"] <= native["long_frames_max"]


def native_gates(analysis, loop, vram_mib=None, log_text=None, cvar_mismatches=None, readback=None):
    """The native budget gate (design section 2) after the warm-up lap, for the run and for each leg.

    analysis is analyze_csv output or None (no host run). vram_mib maps pid to peak MiB. log_text is the game log,
    scanned with render_log_guard.py and for the summary line. cvar_mismatches is the readback mismatch list (empty
    when every CVar matched). readback maps CVar names to the values read back.
    """
    native = loop["budgets"]["native"]
    a = analysis or {}
    whole = (a.get("all") or {}).get("frame")
    p95 = lap_median(a, "frame", "p95_ms")
    p99 = lap_median(a, "frame", "p99_ms")
    many = len(a.get("laps", [])) > 1
    note = "median of the per-lap values" if many else None
    gates = [gate("frame_p95", p95, native["p95_max_ms"], note=note)]
    for leg in leg_names(loop):
        gates.append(gate("frame_p95:" + leg, lap_median(a, "frame", "p95_ms", leg), native["p95_max_ms"], note=note))
    gates.append(gate("frame_p99", p99, native["p99_max_ms"], note=note))
    slow = whole["over_50ms"] * 100 / whole["frames"] if whole else None
    gates.append(gate("slow_frames_percent", slow, native["slow_max_percent"], unit="%"))
    rate, long_frames, _ = hitch_rule(whole, loop)
    gates.append(gate("hitches_per_30s", rate, native["hitches_per_30s_max"], unit="per 30 s",
                      note=f"most frames over {native['hitch_ms']} ms in any {native['hitch_window_s']} s; "
                           f"{whole['over_66_7ms']} in {whole['seconds']} s" if whole else None))
    gates.append(gate("long_frames", long_frames, native["long_frames_max"], unit="frames",
                      note=f"frames over {native['long_frame_ms']} ms"))
    gates.append(gate("vram_peak_mib", max(vram_mib.values()) if vram_mib else None, native["vram_max_mib"], unit="MiB"))
    # render_log_guard.py's pattern, counted per line instead of asserted.
    clean = None if log_text is None else sum(bool(render_log_guard.ERROR.search(line)) for line in log_text.splitlines())
    gates.append(gate("render_log_errors", clean, 0, unit="lines"))
    gates.append(gate("cvar_mismatches", None if cvar_mismatches is None else len(cvar_mismatches), 0, unit="cvars",
                      note=", ".join(f"{m.get('name')}={m.get('actual')} (want {m.get('expected')})" for m in cvar_mismatches or [])
                      or None))
    cap = None
    if readback is not None and "t.MaxFPS" in readback:
        try:
            cap = float(readback["t.MaxFPS"])
        except ValueError:
            cap = -1.0
    gates.append(gate("fps_cap", cap, float(loop["fixed"]["t.MaxFPS"]), op="==", unit="fps"))
    summary = run_summary(parse_summaries(log_text)) if log_text else None
    diff = abs(summary["p95_ms"] - whole["p95_ms"]) if summary and whole and isinstance(summary.get("p95_ms"), float) else None
    gates.append(gate("summary_p95_diff", diff, native["summary_p95_max_diff_ms"],
                      note="NORD_GAUNTLET summary against the CSV, all measured frames"))
    return gates


def native_values(analysis, gates):
    """The values the tuner needs: FrameTime and GPUTime p95 and the hitch, VRAM and readback results."""
    by_name = {g["name"]: g for g in gates}
    hitch = [by_name["hitches_per_30s"]["result"], by_name["long_frames"]["result"]]
    as_bool = lambda results: None if "unverified" in results else all(r == "pass" for r in results)
    return {"frame_p95_ms": by_name["frame_p95"]["value"], "gpu_p95_ms": lap_median(analysis or {}, "gpu", "p95_ms"),
            "hitches_ok": as_bool(hitch), "vram_ok": as_bool([by_name["vram_peak_mib"]["result"]]),
            "cvars_ok": as_bool([by_name["cvar_mismatches"]["result"]])}


def native_report(analysis):
    """Report-only rows: GPU and thread p95 next to FrameTime, so the headroom under the 16.7 ms floor shows."""
    rows = {}
    for short in FIELDS:
        stats = ((analysis or {}).get("all") or {}).get(short)
        if stats:
            rows[short] = {key: stats[key] for key in ("p50_ms", "p95_ms", "p99_ms", "max_ms")}
    return rows


def stream_gates(loop, summary=None, intervals=None, native_windows=None):
    """The stream gate for one solo sample: summary is stream-sample.mjs summarize(), intervals is decoded_intervals()
    and native_windows is parse_stream_fps() over the lap."""
    stream = loop["budgets"]["stream"]
    s = summary or {}
    decoded = s.get("decodedFps") if s.get("decodedFps") is not None else (intervals or {}).get("fps")
    gap = intervals["longest_gap_ms"] if intervals else s.get("longestFrameGapMs")
    native_min = min(w["fps"] for w in native_windows) if native_windows else None
    native_mean = (sum(w["frames"] for w in native_windows) / sum(w["seconds"] for w in native_windows)) if native_windows else None
    return [gate("decoded_fps_mean", decoded, stream["decoded_fps_min"], op=">=", unit="fps"),
            gate("freezes", s.get("freezes"), stream["freezes_max"], unit="freezes"),
            gate("decoded_over_50ms_percent", intervals["over_50ms_percent"] if intervals else None,
                 stream["over_50ms_max_percent"], unit="%"),
            gate("longest_gap_ms", gap, stream["longest_gap_max_ms"]),
            gate("jitter_buffer_ms_per_frame", s.get("jitterBufferMsPerFrame"), stream["jitter_buffer_max_ms"]),
            gate("native_fps_min", native_min, stream["native_fps_min"], op=">=", unit="fps",
                 note=f"lowest {stream['native_window_s']} s NORD_STREAM_FPS window"),
            gate("decoded_vs_native_fps", abs(decoded - native_mean) if decoded is not None and native_mean else None,
                 stream["decoded_vs_native_max_fps"], unit="fps")]


def look_gates(loop, images, baseline_mean=None, repeat_min=None):
    """The visual check: every one of the budgets.look.images stills scored, every image SSIM against the ceiling, the
    mean against the production profile, and the run-to-run SSIM of the two ceiling renders. images maps view names to
    SSIM; repeat_min is the lowest SSIM of ceiling run A against run B. A partial still set fails the count gate, so
    its mean never passes for the whole set. Without the second ceiling render the repeat gate is unverified, so the
    round cannot pass."""
    look = loop["budgets"]["look"]
    values = list((images or {}).values())
    mean = sum(values) / len(values) if values else None
    return [gate("image_count", len(values) or None, look["images"], op="==", unit="stills",
                 note="stills scored against the ceiling"),
            gate("image_ssim_min", min(values) if values else None, look["image_ssim_min"], op=">=", unit="SSIM"),
            gate("look_vs_baseline", None if mean is None or baseline_mean is None else mean - baseline_mean, 0.0, op=">=",
                 unit="SSIM", note="candidate mean minus the production profile mean"),
            gate("repeat_ssim_min", repeat_min, look["repeat_ssim_min"], op=">=",
                 unit="SSIM", note="ceiling run A against run B; below the limit the round is invalid")]


def two_viewer_row(loop, candidate_fps, baseline_fps):
    """The co-op guard, report-only in verdict.json: two-viewer mean decoded FPS against the baseline's in the same
    window. The tuner's confirmation uses the same limit to fall back to the next candidate."""
    drop = None if candidate_fps is None or baseline_fps is None else baseline_fps - candidate_fps
    return gate("two_viewer_drop_fps", drop, loop["budgets"]["stream"]["two_viewer_drop_max_fps"], unit="fps",
                note="report-only; baseline minus candidate, both with two viewers")


def delay_section(latency):
    """Delay, reported apart from frame rate and never gated."""
    return {"label": DELAY_LABEL, "gated": False, "values": dict(latency or {})}


def verdict(gates, foreign=None, report_only=None, delay=None, values=None, notes=None, missing_columns=None):
    """verdict.json: every gate with value, limit and result. Status is contended when a foreign GPU process ran, else
    fail when any gate failed, else unverified when any gate has no value (or there are none), else pass."""
    results = [g["result"] for g in gates]
    status = ("contended" if foreign else "fail" if "fail" in results else
              "unverified" if "unverified" in results or not gates else "pass")
    out = {"status": status, "gates": gates,
           "counts": {key: results.count(key) for key in ("pass", "fail", "unverified")}}
    if foreign:
        out["contended_by"] = foreign
    if missing_columns:
        out["missing_columns"] = list(missing_columns)
    if values is not None:
        out["values"] = values
    out["report_only"] = report_only or {}
    if delay is not None:
        out["delay"] = delay
    if notes:
        out["notes"] = list(notes)
    if status == "unverified":
        out["summary"] = "unverified, not pass"
    return out


# ---------------------------------------------------------------- SSIM and FLIP

def luma(rgb):
    """Rec. 601 luma (0.299, 0.587, 0.114) in 0..255, as rgb2gray in Wang's reference code."""
    import numpy as np
    pixels = np.asarray(rgb, dtype=np.float64)
    if pixels.ndim == 2:
        return pixels
    return pixels[..., 0] * 0.299 + pixels[..., 1] * 0.587 + pixels[..., 2] * 0.114


def load_rgb(path):
    from PIL import Image
    import numpy as np
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB"))


def gaussian_window(size=11, sigma=1.5):
    """The normalised 1-D Gaussian; its outer product is fspecial('gaussian', size, sigma)."""
    import numpy as np
    offsets = np.arange(size, dtype=np.float64) - (size - 1) / 2
    weights = np.exp(-(offsets * offsets) / (2 * sigma * sigma))
    return weights / weights.sum()


def _blur_valid(image, weights):
    """Separable Gaussian filter over the valid positions only (filter2(..., 'valid'))."""
    size = weights.size
    height, width = image.shape
    rows = sum(weights[k] * image[:, k:width - size + 1 + k] for k in range(size))
    return sum(weights[k] * rows[k:height - size + 1 + k, :] for k in range(size))


def ssim(reference, test, k1=0.01, k2=0.03, window=11, sigma=1.5, data_range=255.0, full=False):
    """Mean SSIM of two 2-D luma arrays (Wang et al. 2004). full=True also returns the SSIM map."""
    import numpy as np
    x = np.asarray(reference, dtype=np.float64)
    y = np.asarray(test, dtype=np.float64)
    if x.shape != y.shape or x.ndim != 2 or min(x.shape) < window:
        raise ValueError(f"SSIM needs two same-size 2-D images of at least {window}x{window}: {x.shape} and {y.shape}")
    weights = gaussian_window(window, sigma)
    mu_x, mu_y = _blur_valid(x, weights), _blur_valid(y, weights)
    sigma_x = _blur_valid(x * x, weights) - mu_x * mu_x
    sigma_y = _blur_valid(y * y, weights) - mu_y * mu_y
    sigma_xy = _blur_valid(x * y, weights) - mu_x * mu_y
    c1, c2 = (k1 * data_range) ** 2, (k2 * data_range) ** 2
    index = ((2 * mu_x * mu_y + c1) * (2 * sigma_xy + c2)) / ((mu_x * mu_x + mu_y * mu_y + c1) * (sigma_x + sigma_y + c2))
    mean = float(index.mean())
    return (mean, index) if full else mean


def image_ssim(reference_path, test_path, loop=None):
    """Luma SSIM of two stills with the loop.json settings (the defaults when loop is None)."""
    settings = (loop or {}).get("budgets", {}).get("look", {}).get("ssim", {})
    return ssim(luma(load_rgb(reference_path)), luma(load_rgb(test_path)), k1=settings.get("k1", 0.01),
                k2=settings.get("k2", 0.03), window=settings.get("window", 11), sigma=settings.get("sigma", 1.5))


def write_diff(reference_path, test_path, out_path, gain=4):
    """A grey map of 4x the absolute luma difference, clipped to 255."""
    from PIL import Image
    import numpy as np
    difference = np.abs(luma(load_rgb(test_path)) - luma(load_rgb(reference_path))) * gain
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(difference + .5, 0, 255).astype(np.uint8)).save(out_path)
    return out_path


def flip_error(reference_path, test_path, ppd=40, out_path=None):
    """Mean NVIDIA FLIP error (LDR) at a fixed pixels-per-degree, or None when flip-evaluator is not installed.

    flip_evaluator.evaluate(reference, test, "LDR", parameters={"ppd": ...}) returns (error map, mean error,
    parameters); inputs are HxWxC arrays in 0..1. Checked against flip_python_api.py of NVlabs/flip (2024); the map's
    value range with the default magma colouring is unverified, so it is clipped to 0..1 before saving.
    """
    try:
        import flip_evaluator
    except ImportError:
        return None
    import numpy as np
    reference = load_rgb(reference_path).astype(np.float32) / 255
    test = load_rgb(test_path).astype(np.float32) / 255
    error_map, mean, _ = flip_evaluator.evaluate(reference, test, "LDR", parameters={"ppd": float(ppd)})
    if out_path is not None:
        from PIL import Image
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        colours = np.clip(np.asarray(error_map, dtype=np.float64), 0, 1)
        Image.fromarray((colours * 255 + .5).astype(np.uint8)).save(out_path)
    return {"mean": float(mean), "ppd": float(ppd)}


# ---------------------------------------------------------------- review.html

REVIEW_STYLE = """
:root { --bg: #f6f5f2; --fg: #1d1d1f; --muted: #5f6368; --line: #d7d4cc; --pass: #1e7a3c; --fail: #b3261e; --warn: #8a5a00; }
@media (prefers-color-scheme: dark) { :root { --bg: #141416; --fg: #ececec; --muted: #a0a3a8; --line: #34343a;
  --pass: #6fd08c; --fail: #ff8a80; --warn: #f2c14e; } }
body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 16px; margin: 24px 0 8px; }
p.note { color: var(--muted); margin: 4px 0 12px; }
table.gates { border-collapse: collapse; } table.gates td, table.gates th { border-bottom: 1px solid var(--line);
  padding: 3px 10px 3px 0; text-align: left; font-variant-numeric: tabular-nums; }
.pass { color: var(--pass); } .fail { color: var(--fail); } .unverified, .contended { color: var(--warn); }
.row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 0 0 16px;
  border-top: 1px solid var(--line); padding-top: 8px; }
.row h3 { grid-column: 1 / -1; font-size: 14px; margin: 0; }
figure { margin: 0; min-width: 0; } figure img { width: 100%; height: auto; display: block; border: 1px solid var(--line); }
figcaption { color: var(--muted); font-size: 12px; margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
img.flip { cursor: pointer; }
@media (max-width: 720px) { .row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
"""

REVIEW_SCRIPT = """
for (const image of document.querySelectorAll('img.flip')) {
  image.addEventListener('click', () => {
    const showB = image.dataset.showing !== 'b';
    image.src = showB ? image.dataset.b : image.dataset.a;
    image.dataset.showing = showB ? 'b' : 'a';
    image.closest('figure').querySelector('.which').textContent = showB ? 'B: candidate' : 'A: baseline';
  });
}
"""


def review_rows(rows, out_dir, loop=None):
    """SSIM against the ceiling and a difference map for each tile. rows: dicts with view and the paths ceiling,
    baseline, candidate and optional stream. Missing or unreadable images give None, never a guessed value."""
    out = []
    for row in rows:
        entry = {"view": row["view"], "tiles": {}}
        for kind in ("ceiling", "baseline", "candidate", "stream"):
            path = row.get(kind)
            tile = {"path": str(path) if path else None, "ssim": None, "diff": None, "flip": None, "flip_map": None}
            if path and Path(path).is_file() and kind != "ceiling" and row.get("ceiling") and Path(row["ceiling"]).is_file():
                try:
                    tile["ssim"] = image_ssim(row["ceiling"], path, loop)
                    stem = re.sub(r"[^A-Za-z0-9_.-]", "_", f"{row['view']}-{kind}")
                    tile["diff"] = str(write_diff(row["ceiling"], path, Path(out_dir) / "review" / f"{stem}-diff.png"))
                    flip_map = Path(out_dir) / "review" / f"{stem}-flip.png"
                    tile["flip"] = flip_error(row["ceiling"], path, (loop or {}).get("budgets", {}).get("look", {}).get(
                        "flip_pixels_per_degree", 40), flip_map)
                    tile["flip_map"] = str(flip_map) if tile["flip"] else None
                except ValueError as error:
                    tile["error"] = str(error)
            entry["tiles"][kind] = tile
        if row.get("ceiling_repeat") is not None:
            entry["tiles"]["ceiling"]["ssim"] = row["ceiling_repeat"]
        out.append(entry)
    return out


def write_review(out_dir, rows, loop=None, title="NORD mobile gauntlet review", verdict_data=None):
    """Write review.html: one row per view with the ceiling, baseline, candidate and decoded stream frame, the SSIM of
    each against the ceiling, a 4x difference map (or the FLIP map) and a click-to-flip A/B of baseline and candidate.
    Returns (path, rows with their SSIM)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    page = out_dir / "review.html"
    scored = review_rows(rows, out_dir, loop)
    link = lambda path: html.escape(os.path.relpath(path, out_dir).replace(os.sep, "/"), quote=True)
    number = lambda value: "n/a" if value is None else f"{value:.4f}"
    parts = ["<!doctype html>", '<html lang="en"><head><meta charset="utf-8">',
             '<meta name="viewport" content="width=device-width, initial-scale=1">',
             f"<title>{html.escape(title)}</title><style>{REVIEW_STYLE}</style></head><body>",
             f"<h1>{html.escape(title)}</h1>",
             '<p class="note">SSIM is luma SSIM against the ceiling (Wang et al. 2004). The map under each tile is 4x the '
             'absolute difference, or the FLIP map when flip-evaluator is installed. Click the A/B tile to flip between '
             'baseline and candidate. The user\'s verdict is final.</p>']
    if verdict_data:
        parts.append(f'<h2>Gates: <span class="{html.escape(verdict_data["status"])}">{html.escape(verdict_data["status"])}'
                     "</span></h2><table class=\"gates\"><tr><th>Gate</th><th>Value</th><th>Limit</th><th>Result</th></tr>")
        for row in verdict_data.get("gates", []):
            value = row["value"] if not isinstance(row["value"], float) else round(row["value"], 4)
            parts.append(f"<tr><td>{html.escape(row['name'])}</td><td>{html.escape(str(value))}</td>"
                         f"<td>{html.escape(row['op'] + ' ' + str(row['limit']))} {html.escape(row['unit'])}</td>"
                         f"<td class=\"{row['result']}\">{row['result']}</td></tr>")
        parts.append("</table>")
        if verdict_data.get("report_only"):
            parts.append('<h2>Report-only</h2><p class="note">These rows never change the gate result.</p>'
                         f"<pre>{html.escape(json.dumps(verdict_data['report_only'], indent=1))}</pre>")
        if verdict_data.get("delay"):
            parts.append(f"<h2>Delay</h2><p class=\"note\">{html.escape(verdict_data['delay']['label'])}. Not gated.</p>"
                         f"<pre>{html.escape(json.dumps(verdict_data['delay']['values'], indent=1))}</pre>")
    parts.append("<h2>Views</h2>")
    for row in scored:
        parts.append(f'<section class="row" data-view="{html.escape(row["view"], quote=True)}"><h3>{html.escape(row["view"])}</h3>')
        for kind, label in (("ceiling", "Ceiling"), ("baseline", "Baseline"), ("candidate", "Candidate"), ("stream", "Decoded stream")):
            tile = row["tiles"][kind]
            parts.append(f'<figure class="tile {kind}">')
            if tile["path"]:
                caption = ("reference" if tile["ssim"] is None else f"run-to-run SSIM {number(tile['ssim'])}") \
                    if kind == "ceiling" else f"SSIM {number(tile['ssim'])}"
                if tile.get("flip"):
                    caption += f" | FLIP {tile['flip']['mean']:.4f} at {tile['flip']['ppd']:g} ppd"
                parts.append(f'<img src="{link(tile["path"])}" alt="{html.escape(label)} {html.escape(row["view"])}" loading="lazy">'
                             f"<figcaption>{label}: {caption}</figcaption>")
                shown = tile.get("flip_map") or tile.get("diff")
                if shown:
                    parts.append(f'<img src="{link(shown)}" alt="difference {html.escape(label)}" loading="lazy">')
            else:
                parts.append(f"<figcaption>{label}: not captured</figcaption>")
            parts.append("</figure>")
        base, cand = row["tiles"]["baseline"]["path"], row["tiles"]["candidate"]["path"]
        if base and cand:
            parts.append(f'<figure class="tile ab"><img class="flip" src="{link(base)}" data-a="{link(base)}" '
                         f'data-b="{link(cand)}" data-showing="a" alt="A/B {html.escape(row["view"])}">'
                         '<figcaption>A/B (click): <span class="which">A: baseline</span></figcaption></figure>')
        else:
            parts.append('<figure class="tile ab"><figcaption>A/B: needs baseline and candidate</figcaption></figure>')
        parts.append("</section>")
    parts.append(f"<script>{REVIEW_SCRIPT}</script></body></html>")
    page.write_text("\n".join(parts) + "\n")
    return page, scored


# ---------------------------------------------------------------- command line

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    one = commands.add_parser("csv", help="frame statistics of a CSV profiler file")
    one.add_argument("csv", type=Path)
    two = commands.add_parser("ssim", help="luma SSIM of two stills")
    two.add_argument("reference", type=Path)
    two.add_argument("test", type=Path)
    args = parser.parse_args(argv)
    loop = load_loop()
    if args.command == "csv":
        analysis = analyze_csv(args.csv, loop)
        gates = native_gates(analysis, loop)
        print(json.dumps({"analysis": analysis, "legs": legs_ranked(analysis),
                          "verdict": verdict(gates, values=native_values(analysis, gates), report_only=native_report(analysis),
                                             missing_columns=analysis["missing_columns"], notes=analysis["notes"])}, indent=1))
    else:
        print(json.dumps({"ssim": image_ssim(args.reference, args.test, loop)}))


if __name__ == "__main__":
    sys.exit(main())
