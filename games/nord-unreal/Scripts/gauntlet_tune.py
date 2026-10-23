"""Tune the NORD phone-stream profile: knob ladders, candidate files, the DeviceProfiles section and the greedy search.

Data/Gauntlet/loop.json holds the knob ladders, their dependencies, the baseline (today's QUALITY in
Scripts/browser_streaming.py), the ceiling look, the feasibility margin and the search limits. A candidate is the
baseline profile with one step of each knob applied; knobs left at their baseline step keep the baseline CVars, so
the baseline candidate equals QUALITY exactly.

The search is design section 4 of openspec/changes/nord-mobile-gauntlet: a greedy climb from a feasible start. It
adapts LUT-Opt (arXiv 2604.25178: the best SSIM against a maximum-quality render within a time budget, with additive
costs) and NVIDIA's Optimal Playable Settings (scripted runs through the heaviest areas against a target frame rate).
search(loop, measure) calls measure(candidate) for every run, so the tests fake the host with known costs.

measure(candidate) returns a dict. For a perf and look candidate: frame_p95_ms and gpu_p95_ms (night-rain landscape
lap), hitches_ok, vram_ok and cvars_ok (True, False or None for unverified), look (mean SSIM of the 20 stills against
the ceiling), images ({view: SSIM}), and optional contended, readback ({cvar: value}) and error. For the ceiling
(look only): repeat_ssim ({view: SSIM} of this render against the other ceiling render) on at least one of the two.
result_from_verdict() builds that dict from Scripts/gauntlet_metrics.py output.

Run from games/nord-unreal:
  python3 Scripts/gauntlet_tune.py check          loop.json consistency, and the profile section against QUALITY
  python3 Scripts/gauntlet_tune.py files <dir>    write the baseline and ceiling ExecCmds and expected-CVar files
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
LOOP = ROOT / "Data/Gauntlet/loop.json"
PROFILES_INI = ROOT / "Config/DefaultDeviceProfiles.ini"
PROFILE = "NordPhoneStream"
# The ini layout follows Epic's Device Profiles documentation and BaseDeviceProfiles.ini, written from memory:
# unverified until the host reads every CVar back with -DeviceProfile=NordPhoneStream.
PROFILE_PLATFORM = "Linux"
CVAR_LINE = re.compile(r"^\s*[+\-.!]?CVars\s*=", re.IGNORECASE)
SECTION = re.compile(r"^\s*\[(.+?)\]\s*$")


def load_loop(path=LOOP):
    return json.loads(Path(path).read_text())


# ---------------------------------------------------------------- CVar values and ExecCmds

def typed(text):
    """75 -> 75, 0.5 -> 0.5, anything else stays text."""
    text = text.strip()
    if re.fullmatch(r"[+-]?\d+", text):
        return int(text)
    try:
        return float(text)
    except ValueError:
        return text


def format_value(value):
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def values_match(expected, actual):
    """Numbers compare by value (UE may print 75 as 75.000000), other text without case, as in QuebecGauntletModel.h."""
    want, have = typed(format_value(expected)), typed(format_value(actual))
    if isinstance(want, (int, float)) and isinstance(have, (int, float)):
        return abs(want - have) <= 1e-4 * max(1.0, abs(want), abs(have))
    return str(want).lower() == str(have).lower()


def parse_execcmds(text):
    """The effective CVar values of a comma-separated "name value" list: later entries win, first-seen order."""
    cvars = {}
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        name, _, value = part.partition(" ")
        cvars[name.strip()] = typed(value)
    return cvars


def ordered(cvars):
    """sg.* scalability groups first, then single CVars, each in their given order (design: Mobile profile output)."""
    groups = [(name, value) for name, value in cvars.items() if name.startswith("sg.")]
    return dict(groups + [(name, value) for name, value in cvars.items() if not name.startswith("sg.")])


def execcmds_text(cvars):
    return ",".join(f"{name} {format_value(value)}" for name, value in cvars.items())


def same_cvars(a, b):
    return set(a) == set(b) and all(values_match(a[name], b[name]) for name in a)


# ---------------------------------------------------------------- knobs, levels and dependencies

def enabled_knobs(loop):
    return [knob for knob in loop["knobs"] if knob.get("enabled", True)]


def baseline_levels(loop):
    """The step of each enabled knob equal to today's profile, or None when today's profile does not set it."""
    return {knob["id"]: knob["baseline_step"] for knob in enabled_knobs(loop)}


def resolve_baseline(loop, readback):
    """Steps of knobs with no baseline step whose CVars the host read back, e.g. {"shading": 1} for sg.ShadingQuality 3.
    The baseline profile still leaves those CVars unset; this only tells the tuner which step today's value is."""
    resolved = {}
    for knob in enabled_knobs(loop):
        if knob["baseline_step"] is None and readback:
            for step, values in enumerate(knob["steps"]):
                if all(name in readback and values_match(value, readback[name]) for name, value in values.items()):
                    resolved[knob["id"]] = step
    return resolved


def effective(levels, resolved, knob_id):
    level = levels.get(knob_id)
    return level if level is not None else resolved.get(knob_id)


def candidate_cvars(loop, levels):
    """The baseline CVars with the step of every knob that differs from its baseline step applied, sg.* first."""
    cvars = dict(loop["profiles"]["baseline"]["cvars"])
    base = baseline_levels(loop)
    for knob in enabled_knobs(loop):
        level = levels.get(knob["id"])
        if level is not None and level != base[knob["id"]]:
            cvars.update(knob["steps"][level])
    return ordered(cvars)


def violations(loop, levels, resolved=None):
    """Broken loop.json "requires" rules. An unknown level never triggers a rule and never satisfies one."""
    resolved = resolved or {}
    broken = []
    for rule in loop.get("requires", []):
        trigger = effective(levels, resolved, rule["knob"])
        need = effective(levels, resolved, rule["needs_knob"])
        if trigger is not None and trigger >= rule["from_step"] and (need is None or need < rule["needs_from_step"]):
            broken.append(f"{rule['knob']} step {trigger} needs {rule['needs_knob']} step {rule['needs_from_step']} or higher")
    return broken


def repair(loop, levels, resolved=None, direction=1):
    """Make levels keep every dependency: going up raises the needed knob, going down lowers the dependent knob.
    Returns None when no step can keep the rule (for example a disabled needed knob)."""
    resolved = resolved or {}
    knobs = {knob["id"]: knob for knob in enabled_knobs(loop)}
    levels = dict(levels)
    for _ in range(4 * len(loop.get("requires", [])) + 1):
        changed = False
        for rule in loop.get("requires", []):
            trigger = effective(levels, resolved, rule["knob"])
            need = effective(levels, resolved, rule["needs_knob"])
            if trigger is None or trigger < rule["from_step"] or (need is not None and need >= rule["needs_from_step"]):
                continue
            if direction > 0:
                if rule["needs_knob"] not in knobs or rule["needs_from_step"] >= len(knobs[rule["needs_knob"]]["steps"]):
                    return None
                levels[rule["needs_knob"]] = rule["needs_from_step"]
            else:
                if rule["from_step"] - 1 < 0:
                    return None
                levels[rule["knob"]] = rule["from_step"] - 1
            changed = True
        if not changed:
            return levels
    return None


def merge(a, b, direction=1):
    """Per-knob highest (direction 1) or lowest (-1) explicit step of two level sets."""
    out = dict(a)
    for knob_id, level in b.items():
        if level is None:
            continue
        mine = out.get(knob_id)
        out[knob_id] = level if mine is None else (max(mine, level) if direction > 0 else min(mine, level))
    return out


def changed_knobs(loop, levels):
    base = baseline_levels(loop)
    return {knob_id: level for knob_id, level in levels.items() if level is not None and level != base.get(knob_id)}


def levels_key(levels):
    return tuple(sorted((k, -1 if v is None else v) for k, v in levels.items()))


def describe(loop, levels):
    moved = changed_knobs(loop, levels)
    return "+".join(f"{knob_id}{level}" for knob_id, level in moved.items()) or "baseline"


# ---------------------------------------------------------------- candidate files

def make_candidate(loop, levels, phase, seq, label=None, cvars=None, look_only=False):
    cvars = ordered(dict(cvars)) if cvars is not None else candidate_cvars(loop, levels)
    return {"id": f"{seq:02d}-{label or describe(loop, levels)}", "seq": seq, "phase": phase, "look_only": look_only,
            "levels": dict(levels) if levels is not None else None,
            "changed": changed_knobs(loop, levels) if levels is not None else None,
            "cvars": cvars, "execcmds": execcmds_text(cvars)}


def expect_text(candidate):
    """The -NordGauntletExpect= file: one name=value per line, as QuebecGauntlet::ParseExpectedCVars reads it."""
    return (f"# NORD gauntlet expected CVars for candidate {candidate['id']}\n"
            + "".join(f"{name}={format_value(value)}\n" for name, value in candidate["cvars"].items()))


def write_candidate_files(directory, candidate):
    """Write <id>.execcmds (one line, no newline, read verbatim into -ExecCmds=) and <id>.expect."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    execcmds = directory / (candidate["id"] + ".execcmds")
    expect = directory / (candidate["id"] + ".expect")
    execcmds.write_text(candidate["execcmds"])
    expect.write_text(expect_text(candidate))
    return execcmds, expect


# ---------------------------------------------------------------- Config/DefaultDeviceProfiles.ini

def _sections(lines):
    """(name or None, first line, end line) for the preamble and each [section]."""
    marks = [(None, 0)] + [(m.group(1).strip(), i) for i, line in enumerate(lines) for m in [SECTION.match(line)] if m]
    return [(name, start, marks[n + 1][1] if n + 1 < len(marks) else len(lines)) for n, (name, start) in enumerate(marks)]


def read_profile(text, name=PROFILE):
    """{"cvars", "fields", "listed"} of the [<name> DeviceProfile] section, or None when it is missing."""
    lines = text.splitlines()
    sections = _sections(lines)
    found = next(((start, end) for title, start, end in sections if title == f"{name} DeviceProfile"), None)
    if found is None:
        return None
    cvars, fields = {}, {}
    for line in lines[found[0] + 1:found[1]]:
        body = line.strip()
        if not body or body[0] in ";#":
            continue
        if CVAR_LINE.match(body):
            setting = body.split("=", 1)[1]
            cvar, _, value = setting.partition("=")
            if body[0] == "-":
                cvars.pop(cvar.strip(), None)
            else:
                cvars[cvar.strip()] = typed(value)
        elif "=" in body:
            key, _, value = body.partition("=")
            fields[key.strip()] = value.strip()
    listed = any(re.match(rf"^\s*\+DeviceProfileNameAndTypes\s*=\s*{re.escape(name)}\s*,", line)
                 for title, start, end in sections if title == "DeviceProfiles" for line in lines[start:end])
    return {"cvars": cvars, "fields": fields, "listed": listed}


def write_profile(text, cvars, name=PROFILE, platform=PROFILE_PLATFORM):
    """Text with only the [<name> DeviceProfile] CVar lines replaced (sg.* first) and the profile listed under
    [DeviceProfiles]. Other sections, comments and keys stay as they are, so writing the same CVars again is a no-op."""
    lines = text.splitlines()
    cvar_lines = [f"+CVars={cvar}={format_value(value)}" for cvar, value in ordered(cvars).items()]
    sections = _sections(lines)
    found = next(((start, end) for title, start, end in sections if title == f"{name} DeviceProfile"), None)
    if found is None:
        while lines and not lines[-1].strip():
            lines.pop()
        lines += ([""] if lines else []) + [f"[{name} DeviceProfile]", f"DeviceType={platform}",
                                            f"BaseProfileName={platform}"] + cvar_lines
    else:
        start, end = found
        body = lines[start + 1:end]
        tail = []
        while body and not body[-1].strip():
            tail.insert(0, body.pop())
        kept = [line for line in body if not CVAR_LINE.match(line.strip())]
        keys = {line.split("=", 1)[0].strip() for line in kept if "=" in line and line.strip()[:1] not in ";#"}
        head = [f"{key}={platform}" for key in ("DeviceType", "BaseProfileName") if key not in keys]
        lines[start:end] = [lines[start]] + head + kept + cvar_lines + tail
    sections = _sections(lines)
    entry = f"+DeviceProfileNameAndTypes={name},{platform}"
    listing = next(((start, end) for title, start, end in sections if title == "DeviceProfiles"), None)
    pattern = re.compile(rf"^\s*\+DeviceProfileNameAndTypes\s*=\s*{re.escape(name)}\s*,")
    if listing is None:
        lines = ["[DeviceProfiles]", entry, ""] + lines
    elif not any(pattern.match(line) for line in lines[listing[0]:listing[1]]):
        at = listing[1]
        while at > listing[0] + 1 and not lines[at - 1].strip():
            at -= 1
        lines.insert(at, entry)
    return "\n".join(lines) + "\n"


def write_profile_file(cvars, path=PROFILES_INI, name=PROFILE):
    path = Path(path)
    text = path.read_text() if path.is_file() else ""
    updated = write_profile(text, cvars, name)
    if updated != text:
        path.write_text(updated)
    return path


def write_candidate_profile(tune_path, candidate_id, path=PROFILES_INI):
    """Rewrite the profile section with one candidate from tune.json. Run only after the user approves its captures."""
    tune = json.loads(Path(tune_path).read_text())
    record = next((r for r in tune["candidates"] if r["id"] == candidate_id), None)
    if record is None:
        raise KeyError(f"candidate {candidate_id} is not in {tune_path}")
    return write_profile_file(record["cvars"], path)


# ---------------------------------------------------------------- feasibility, look floor and ranking

def feasibility(loop, result):
    """(feasible, reasons): the night-rain landscape lap within the margin, and the hitch, VRAM and readback gates."""
    if result is None:
        return False, ["not measured"]
    if result.get("error"):
        return False, ["run failed: " + str(result["error"])]
    if result.get("contended"):
        return False, ["contended: a foreign GPU process ran"]
    limits = loop["budgets"]["feasible"]
    reasons = []
    for key, limit, label in (("frame_p95_ms", limits["frame_p95_max_ms"], "FrameTime p95"),
                              ("gpu_p95_ms", limits["gpu_p95_max_ms"], "GPUTime p95")):
        value = result.get(key)
        if value is None:
            reasons.append(f"{label} unverified")
        elif value > limit:
            reasons.append(f"{label} {value:.2f} ms over {limit} ms")
    for key, label in (("hitches_ok", "hitch rule"), ("vram_ok", "VRAM limit"), ("cvars_ok", "CVar readback")):
        if result.get(key) is not True:
            reasons.append(f"{label} {'failed' if result.get(key) is False else 'unverified'}")
    return not reasons, reasons


def look_check(loop, record, baseline_look):
    """Reasons a feasible candidate may not win on looks: every image at the floor, and never worse than today."""
    floor = loop["budgets"]["look"]["image_ssim_min"]
    reasons = []
    images = record.get("images")
    values = list(images.values()) if isinstance(images, dict) else list(images or [])
    if record.get("look") is None:
        reasons.append("Look unverified")
    elif baseline_look is not None and record["look"] < baseline_look - 1e-12:
        reasons.append(f"Look {record['look']:.4f} below today's {baseline_look:.4f}")
    if not values:
        reasons.append("image SSIM unverified")
    elif min(values) < floor:
        reasons.append(f"an image SSIM {min(values):.4f} under the {floor} floor")
    return reasons


def look_tie(loop, repeat_mean):
    search = loop["search"]
    if repeat_mean is None:
        return search["look_tie_min"]
    return max(search["look_tie_min"], search["look_tie_repeat_factor"] * (1 - repeat_mean))


def ms_tie(loop, first, second):
    search = loop["search"]
    if first is None or second is None:
        return search["ms_tie_min"]
    return max(search["ms_tie_min"], search["ms_tie_repeat_factor"] * abs(first - second))


def rank(entries, look_tie_value, ms_tie_value):
    """Best first. The highest Look and every Look within the tie of it form a tie group; the group goes to the lowest
    GPUTime p95, and GPU values within the ms tie of that also tie, which the higher Look, then fewer changed knobs,
    then the earlier run settle."""
    remaining = list(entries)
    out = []
    while remaining:
        best = max(entry["look"] for entry in remaining)
        group = [entry for entry in remaining if entry["look"] >= best - look_tie_value]
        cheapest = min(entry["gpu_p95_ms"] for entry in group)
        cheap = [entry for entry in group if entry["gpu_p95_ms"] <= cheapest + ms_tie_value]
        pick = max(cheap, key=lambda entry: (entry["look"], -len(entry.get("changed") or {}), -entry["seq"]))
        out.append(pick)
        remaining.remove(pick)
    return out


def result_from_verdict(verdict, look=None, images=None, readback=None):
    """A measure() result from a gauntlet_metrics.verdict(...) of the night-rain landscape perf run and the look run."""
    values = verdict.get("values", {})
    return {"frame_p95_ms": values.get("frame_p95_ms"), "gpu_p95_ms": values.get("gpu_p95_ms"),
            "hitches_ok": values.get("hitches_ok"), "vram_ok": values.get("vram_ok"), "cvars_ok": values.get("cvars_ok"),
            "contended": verdict.get("status") == "contended", "look": look, "images": images, "readback": readback}


def parse_until(text, now=None):
    """The next local time HH:MM after now, as epoch seconds (--until 06:30)."""
    hours, minutes = (int(part) for part in text.split(":"))
    now = now or datetime.now().astimezone()
    end = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    if end <= now:
        end += timedelta(days=1)
    return end.timestamp()


def iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if epoch is not None else None


def _mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def _plain(value):
    """A JSON-safe copy of a measure() result."""
    return json.loads(json.dumps(value, default=str))


# ---------------------------------------------------------------- the search

class Search:
    def __init__(self, loop, measure, until=None, clock=time.time, readback=None, log=None):
        self.loop = loop
        self.measure = measure
        self.until = until
        self.clock = clock
        self.log = log or (lambda text: None)
        self.limits = loop["search"]
        self.candidate_s = loop.get("durations", {}).get("candidate_estimate_s", 0)
        self.order = {knob["id"]: n for n, knob in enumerate(enabled_knobs(loop))}
        self.steps = {knob["id"]: len(knob["steps"]) for knob in enabled_knobs(loop)}
        self.base = baseline_levels(loop)
        self.resolved = resolve_baseline(loop, readback)
        self.records = []
        self.cache = {}
        self.measured = 0
        self.stop_reason = None
        self.look_tie = self.limits["look_tie_min"]
        self.ms_tie = self.limits["ms_tie_min"]
        self.repeat = None
        self.baseline = None
        self.sensitivity = []
        self.combine = {}
        self.notes = []
        self.started = clock()

    # -- bookkeeping

    def budget_left(self):
        if self.stop_reason:
            return False
        if self.measured >= self.limits["max_candidates"]:
            self.stop_reason = "max_candidates"
        elif self.until is not None and self.clock() + self.candidate_s > self.until:
            self.stop_reason = "window_end"
        return not self.stop_reason

    def run(self, levels, phase, label=None, cvars=None, look_only=False, fresh=False):
        """Measure one candidate, or return the cached record of the same levels. A contended run is recorded and run
        once more. Returns None when the candidate limit or the window end stops the search."""
        if levels is not None and not fresh and not look_only and levels_key(levels) in self.cache:
            return self.cache[levels_key(levels)]
        if levels is not None:
            broken = violations(self.loop, levels, self.resolved)
            assert not broken, f"the tuner built a candidate that breaks a dependency: {broken}"
        record = None
        for _ in range(2):
            if not self.budget_left():
                return None
            candidate = make_candidate(self.loop, levels, phase, self.measured, label, cvars, look_only)
            self.measured += 1
            try:
                result = self.measure(json.loads(json.dumps(candidate)))
            except Exception as error:  # A failed host run is a failed candidate; the night goes on.
                result = {"error": f"{type(error).__name__}: {error}"}
            record = dict(candidate, result=_plain(result or {}))
            record["contended"] = bool((result or {}).get("contended"))
            record["look"] = (result or {}).get("look")
            record["images"] = (result or {}).get("images")
            record["gpu_p95_ms"] = (result or {}).get("gpu_p95_ms")
            record["frame_p95_ms"] = (result or {}).get("frame_p95_ms")
            if look_only:
                record["feasible"], record["reasons"] = None, ["look only"]
            else:
                record["feasible"], record["reasons"] = feasibility(self.loop, result)
            self.records.append(record)
            self.log(f"{record['id']}: feasible={record['feasible']} look={record['look']} gpu={record['gpu_p95_ms']}")
            if not record["contended"]:
                break
            self.notes.append(f"{record['id']} was contended and is not ranked")
        if levels is not None and not look_only and not record["contended"]:
            self.cache[levels_key(levels)] = record
        return record

    def better(self, record, than):
        return bool(record and record["feasible"] and record["look"] is not None and than["look"] is not None
                    and record["look"] - than["look"] > self.look_tie)

    def level(self, levels, knob_id):
        return effective(levels, self.resolved, knob_id)

    # -- phases

    def measure_references(self):
        """Step 1: the baseline twice (the ms noise) and the ceiling look twice (the Look tie)."""
        runs = [self.run(self.base, "baseline", label=f"baseline-{tag}", fresh=True) for tag in "ab"]
        good = [r for r in runs if r and not r["contended"] and not r["result"].get("error")]
        if not good:
            self.stop_reason = self.stop_reason or "no_baseline"
            return False
        readback = next((r["result"].get("readback") for r in good if r["result"].get("readback")), None)
        if readback:
            self.resolved.update({k: v for k, v in resolve_baseline(self.loop, readback).items() if k not in self.resolved})
        images = None
        if all(isinstance(r.get("images"), dict) for r in good):
            views = set.intersection(*(set(r["images"]) for r in good))
            images = {view: _mean([r["images"][view] for r in good]) for view in sorted(views)}
        self.baseline = dict(make_candidate(self.loop, self.base, "baseline", -1), id="baseline", seq=-1,
                             aggregate_of=[r["id"] for r in good], look=_mean([r["look"] for r in good]),
                             gpu_p95_ms=_mean([r["gpu_p95_ms"] for r in good]),
                             frame_p95_ms=_mean([r["frame_p95_ms"] for r in good]), images=images, contended=False,
                             feasible=all(r["feasible"] for r in good),
                             reasons=sorted({reason for r in good for reason in r["reasons"]}))
        if len(good) == 2:
            self.ms_tie = ms_tie(self.loop, good[0]["gpu_p95_ms"], good[1]["gpu_p95_ms"])
        else:
            self.notes.append("only one baseline run counted; the ms tie is the minimum")
        self.records.append(self.baseline)
        self.cache[levels_key(self.base)] = self.baseline
        ceiling = self.loop["profiles"]["ceiling"]["cvars"]
        repeats = []
        for tag in "ab":
            record = self.run(None, "ceiling", label=f"ceiling-{tag}", cvars=ceiling, look_only=True)
            if record is None:
                return False
            if isinstance(record["result"].get("repeat_ssim"), dict) and record["result"]["repeat_ssim"]:
                repeats = list(record["result"]["repeat_ssim"].values())
        if repeats:
            self.repeat = {"mean": sum(repeats) / len(repeats), "min": min(repeats), "images": len(repeats)}
            self.look_tie = look_tie(self.loop, self.repeat["mean"])
            if self.repeat["min"] < self.loop["budgets"]["look"]["repeat_ssim_min"]:
                self.stop_reason = "reference_not_repeatable"
                return False
        else:
            self.notes.append("no ceiling repeat SSIM; the Look tie is the minimum and the round is unverified")
        return True

    def single_moves(self, levels, direction):
        """One step of each enabled knob up (or down) from levels, with its dependencies repaired."""
        moves = []
        for knob in enabled_knobs(self.loop):
            now = self.level(levels, knob["id"])
            if now is None:
                targets = range(len(knob["steps"])) if direction > 0 else []
            else:
                target = now + direction
                targets = [target] if 0 <= target < len(knob["steps"]) else []
            for target in targets:
                moved = repair(self.loop, dict(levels, **{knob["id"]: target}), self.resolved, direction)
                if moved is not None and moved != levels:
                    moves.append({"knob": knob["id"], "step": target, "levels": moved})
        return moves

    def climb_up(self):
        """Steps 2 to 6 from a feasible baseline."""
        base = self.baseline
        for move in self.single_moves(self.base, 1):
            record = self.run(move["levels"], "step")
            if record is None:
                break
            gain = None if record["look"] is None or base["look"] is None else record["look"] - base["look"]
            cost = None if record["gpu_p95_ms"] is None or base["gpu_p95_ms"] is None else record["gpu_p95_ms"] - base["gpu_p95_ms"]
            cost_used = None if cost is None else (0.0 if abs(cost) < self.ms_tie else cost)
            entry = dict(move, direction="up", id=record["id"], gain=gain, cost_ms=cost, cost_used_ms=cost_used,
                         efficiency=None if gain is None or cost_used is None else gain / max(cost_used, self.limits["efficiency_min_ms"]),
                         feasible=record["feasible"])
            entry["kept"] = bool(record["feasible"] and gain is not None and cost_used is not None and gain > self.look_tie)
            entry["why"] = "kept" if entry["kept"] else ("infeasible alone" if not record["feasible"] else "no visible Look gain")
            self.sensitivity.append(entry)
        kept = sorted((e for e in self.sensitivity if e["kept"]),
                      key=lambda e: (-e["efficiency"], -e["gain"], self.order[e["knob"]], e["step"]))
        # Step 4: add steps in efficiency order while the additive GPU prediction stays within the target.
        chosen, predicted = [], base["gpu_p95_ms"]
        for entry in kept:
            extra = max(entry["cost_used_ms"], 0.0)
            if predicted + extra > self.limits["combine_gpu_p95_max_ms"]:
                break
            chosen.append(entry)
            predicted += extra
        self.combine = {"order": [e["id"] for e in kept], "chosen": [e["id"] for e in chosen],
                        "predicted_gpu_p95_ms": predicted, "dropped": []}
        current = base
        while chosen and not self.stop_reason:
            levels = self.base
            for entry in chosen:
                levels = merge(levels, entry["levels"], 1)
            record = self.run(levels, "combine")
            if record is None:
                break
            if record["feasible"]:
                current = record
                break
            self.combine["dropped"].append(chosen.pop()["id"])
        self.combine["result"] = current["id"]
        # Step 5: each remaining kept step alone on top of the winner.
        for entry in kept:
            levels = repair(self.loop, merge(current["levels"], entry["levels"], 1), self.resolved, 1)
            if levels is None or levels_key(levels) == levels_key(current["levels"]):
                continue
            record = self.run(levels, "climb")
            if record is None:
                break
            if self.better(record, current):
                current = record
        # Then the next rung of each knob the winner raised, until no step is left that is feasible and visibly better.
        rate = {e["knob"]: e["efficiency"] for e in kept}
        progress = True
        while progress and not self.stop_reason:
            progress = False
            raised = [k for k in self.order if self.level(current["levels"], k) is not None
                      and (self.level(self.base, k) is None or self.level(current["levels"], k) > self.level(self.base, k))]
            for knob_id in sorted(raised, key=lambda k: (-rate.get(k, 0.0), self.order[k])):
                now = self.level(current["levels"], knob_id)
                if now + 1 >= self.steps[knob_id]:
                    continue
                levels = repair(self.loop, dict(current["levels"], **{knob_id: now + 1}), self.resolved, 1)
                if levels is None:
                    continue
                record = self.run(levels, "climb")
                if record is None:
                    break
                if self.better(record, current):
                    current = record
                    progress = True
        return current

    def climb_down(self):
        """Step 1 when the baseline is not feasible: the same procedure downward, one step below per knob, until a
        feasible start is measured; then each lowered knob is raised back one step while that stays feasible."""
        limits = self.loop["budgets"]["feasible"]
        reference, levels, start = self.baseline, self.base, None
        applied = []
        while start is None and not self.stop_reason:
            moves = self.single_moves(levels, -1)
            if not moves:
                break
            entries = []
            for move in moves:
                record = self.run(move["levels"], "down")
                if record is None:
                    break
                entry = dict(move, direction="down", id=record["id"], feasible=record["feasible"])
                for key, name in (("gpu_p95_ms", "saving"), ("frame_p95_ms", "frame_saving")):
                    value = None if record[key] is None or reference[key] is None else reference[key] - record[key]
                    entry[name + "_ms"] = value
                    # Savings inside the noise tie count as none.
                    entry[name + "_used_ms"] = 0.0 if value is None or abs(value) < self.ms_tie else value
                loss = None if record["look"] is None or reference["look"] is None else max(reference["look"] - record["look"], 0.0)
                entry["loss"] = loss
                entry["efficiency"] = entry["saving_used_ms"] / max(loss if loss is not None else 1.0, self.limits["look_tie_min"])
                entry["kept"] = entry["saving_used_ms"] > 0 or entry["frame_saving_used_ms"] > 0
                entries.append(entry)
                self.sensitivity.append(entry)
            ranked = sorted((e for e in entries if e["kept"]), key=lambda e: (-e["efficiency"], e["loss"] or 0.0, self.order[e["knob"]]))
            if not ranked:
                break
            chosen, gpu, frame = [], reference["gpu_p95_ms"], reference["frame_p95_ms"]
            for entry in ranked:
                chosen.append(entry)
                gpu = None if gpu is None else gpu - max(entry["saving_used_ms"], 0.0)
                frame = None if frame is None else frame - max(entry["frame_saving_used_ms"], 0.0)
                if gpu is not None and frame is not None and gpu <= limits["gpu_p95_max_ms"] and frame <= limits["frame_p95_max_ms"]:
                    break
            record = None
            while not self.stop_reason:
                combined = levels
                for entry in chosen:
                    combined = merge(combined, entry["levels"], -1)
                record = self.run(combined, "down-combine")
                if record is None or record["feasible"] or len(chosen) == len(ranked):
                    break
                chosen.append(ranked[len(chosen)])
            if record is None:
                break
            applied += chosen
            if record["feasible"]:
                start = record
            else:
                reference, levels = record, record["levels"]
        self.combine = {"direction": "down", "applied": [e["id"] for e in applied], "result": start["id"] if start else None}
        if start is None:
            if not self.stop_reason:
                self.stop_reason = "no_feasible_start"
            return None
        current = start
        for entry in sorted(applied, key=lambda e: (-(e["loss"] or 0.0), self.order[e["knob"]])):
            now = self.level(current["levels"], entry["knob"])
            if now is None or now >= (self.level(self.base, entry["knob"]) or 0):
                continue
            levels = repair(self.loop, dict(current["levels"], **{entry["knob"]: now + 1}), self.resolved, 1)
            if levels is None:
                continue
            record = self.run(levels, "climb")
            if record is None:
                break
            if self.better(record, current):
                current = record
        return current

    # -- result

    def result(self):
        base_look = self.baseline["look"] if self.baseline else None
        eligible = []
        for record in self.records:
            record["ranked"] = not record["look_only"] and record["phase"] != "baseline" or record["id"] == "baseline"
            record["look_reasons"] = look_check(self.loop, record, base_look) if record["ranked"] else []
            record["eligible"] = bool(record["ranked"] and record["feasible"] and not record["contended"]
                                      and not record["look_reasons"] and record["gpu_p95_ms"] is not None)
            if record["eligible"]:
                eligible.append(record)
        ranking = rank(eligible, self.look_tie, self.ms_tie)
        for position, record in enumerate(ranking):
            record["rank"] = position + 1
        finished = self.clock()
        return {"version": 1, "loop_version": self.loop.get("version"), "started_at": iso(self.started),
                "finished_at": iso(finished), "until": iso(self.until), "stop_reason": self.stop_reason or "converged",
                "measured": self.measured, "max_candidates": self.limits["max_candidates"],
                "baseline": {key: self.baseline.get(key) for key in ("look", "gpu_p95_ms", "frame_p95_ms", "feasible", "reasons")}
                if self.baseline else None,
                "resolved_baseline_steps": self.resolved,
                "ties": {"look": self.look_tie, "ms": self.ms_tie, "repeat": self.repeat},
                "sensitivity": self.sensitivity, "combine": self.combine, "candidates": self.records,
                "ranking": [record["id"] for record in ranking], "winner": ranking[0]["id"] if ranking else None,
                "notes": self.notes}


def search(loop, measure, until=None, clock=time.time, readback=None, log=None):
    """Run the whole greedy search and return the tune.json content. Every measured candidate is in "candidates"."""
    state = Search(loop, measure, until=until, clock=clock, readback=readback, log=log)
    if state.measure_references():
        if state.baseline["feasible"]:
            state.climb_up()
        else:
            state.notes.append("the baseline is not feasible; the search went downward first")
            state.climb_down()
    return state.result()


def confirm(tune, loop, confirm_fn):
    """Step 7: confirm the baseline, then the ranked candidates best first until one passes every gate.

    confirm_fn(record) runs the 3-lap confirmation (both skies, landscape and portrait) and the stream rows and returns
    {"passed": bool, "reasons": [...], "two_viewer_fps": float or None}. A candidate other than the baseline also
    needs the co-op guard: two-viewer decoded FPS at most two_viewer_drop_max_fps below the baseline's.
    """
    records = {record["id"]: record for record in tune["candidates"]}
    drop_max = loop["budgets"]["stream"]["two_viewer_drop_max_fps"]
    results = []
    base = dict(confirm_fn(records["baseline"]), id="baseline") if "baseline" in records else None
    if base:
        results.append(base)
    confirmed = None
    for candidate_id in tune["ranking"]:
        if candidate_id == "baseline":
            outcome = base
        else:
            outcome = dict(confirm_fn(records[candidate_id]), id=candidate_id)
            outcome["reasons"] = list(outcome.get("reasons", []))
            mine, theirs = outcome.get("two_viewer_fps"), (base or {}).get("two_viewer_fps")
            if mine is None or theirs is None:
                outcome["passed"] = False
                outcome["reasons"].append("co-op guard unverified")
            elif theirs - mine > drop_max:
                outcome["passed"] = False
                outcome["reasons"].append(f"two-viewer FPS {mine:.1f} is {theirs - mine:.1f} below the baseline's {theirs:.1f}")
            results.append(outcome)
        if outcome and outcome.get("passed"):
            confirmed = candidate_id
            break
    tune["confirmation"] = {"order": ["baseline"] + [i for i in tune["ranking"] if i != "baseline"], "results": results,
                            "confirmed": confirmed}
    return tune


def write_tune(path, tune):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(tune, indent=1) + "\n")
    return path


# ---------------------------------------------------------------- checks and command line

def check_loop(loop):
    """Problems in loop.json's knobs, baseline and ceiling, as messages (empty when consistent)."""
    problems = []
    baseline = loop["profiles"]["baseline"]
    if not same_cvars(parse_execcmds(baseline["execcmds"]), baseline["cvars"]):
        problems.append("profiles.baseline.execcmds and profiles.baseline.cvars differ")
    ids = [knob["id"] for knob in loop["knobs"]]
    if len(set(ids)) != len(ids):
        problems.append("duplicate knob ids")
    for knob in loop["knobs"]:
        for values in knob["steps"]:
            for name in values:
                if name in loop["fixed"]:
                    problems.append(f"knob {knob['id']} changes the fixed {name}")
        step = knob["baseline_step"]
        if knob.get("enabled", True) and step is not None and not all(
                name in baseline["cvars"] and values_match(value, baseline["cvars"][name]) for name, value in knob["steps"][step].items()):
            problems.append(f"knob {knob['id']} baseline step {step} is not today's profile")
    for rule in loop.get("requires", []):
        if rule["knob"] not in ids or rule["needs_knob"] not in ids:
            problems.append(f"requires names an unknown knob: {rule}")
    if violations(loop, baseline_levels(loop)):
        problems.append("the baseline breaks a dependency")
    if not values_match(loop["fixed"]["t.MaxFPS"], baseline["cvars"].get("t.MaxFPS", "")):
        problems.append("the baseline does not keep t.MaxFPS 60")
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="loop.json consistency and the profile section against QUALITY")
    files = commands.add_parser("files", help="write the baseline and ceiling ExecCmds and expected-CVar files")
    files.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
    loop = load_loop()
    if args.command == "check":
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import browser_streaming  # noqa: E402
        problems = check_loop(loop)
        if not same_cvars(parse_execcmds(browser_streaming.QUALITY), loop["profiles"]["baseline"]["cvars"]):
            problems.append("loop.json baseline differs from browser_streaming.QUALITY")
        profile = read_profile(PROFILES_INI.read_text(), PROFILE) if PROFILES_INI.is_file() else None
        state = "missing" if profile is None else (
            "equals QUALITY" if same_cvars(profile["cvars"], parse_execcmds(browser_streaming.QUALITY)) else "differs from QUALITY")
        print(json.dumps({"problems": problems, "profile_section": state}, indent=1))
        return 1 if problems else 0
    baseline = make_candidate(loop, baseline_levels(loop), "baseline", 0, "baseline")
    ceiling = make_candidate(loop, None, "ceiling", 1, "ceiling", cvars=loop["profiles"]["ceiling"]["cvars"], look_only=True)
    for candidate in (baseline, ceiling):
        print(*write_candidate_files(args.directory, candidate))
    return 0


if __name__ == "__main__":
    sys.exit(main())
