"""Offline checks for Scripts/gauntlet_tune.py with a fake host (no Unreal, no GPU).

Run from games/nord-unreal:  python3 Scripts/test_gauntlet_tune.py
A fake measure function with known additive GPU costs and Look gains per CVar value checks the search order, the
combination and its fallback, the climb, the stop rule (candidate limit, and a window end planned with the longest
candidate), the downward search, tie and noise handling, contended runs, dependency safety and the confirmation order.
The DeviceProfiles writer must round-trip, and the first profile it writes must equal today's QUALITY in
Scripts/browser_streaming.py. The checked-in section equals QUALITY, or the candidate in the approval record that
write-profile writes next to it.
"""
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import browser_streaming  # noqa: E402
import gauntlet_tune as T  # noqa: E402

LOOP = T.load_loop()
REPEAT = .996  # Ceiling run-to-run SSIM: the Look tie is max(0.005, 2 * (1 - 0.996)) = 0.008.

# GPU ms and Look per CVar value, relative to the baseline profile (22 ms, Look 0.900). A candidate adds up its CVars,
# so the fake host fits any ladder. The baseline leaves sg.ShadingQuality unset, and the host default is 3.
COST = {"sg.ShadowQuality": {0: -1.5, 1: 0, 2: .8, 3: 2.8}, "r.Shadow.Virtual.Enable": {0: 0, 1: 2.2},
        "sg.GlobalIlluminationQuality": {1: 0, 2: 2.0, 3: 4.5}, "sg.ReflectionQuality": {1: 0, 2: 1.0, 3: 2.5},
        "r.ScreenPercentage": {50: -5.0, 60: -3.0, 67: -1.5, 75: 0, 85: 2.5, 100: 5.5},
        "sg.ViewDistanceQuality": {1: -.6, 2: 0, 3: .3}, "sg.FoliageQuality": {1: -1.0, 2: 0, 3: 1.2},
        "sg.EffectsQuality": {1: -.8, 2: 0, 3: .2}, "sg.PostProcessQuality": {1: -.5, 2: 0, 3: .4},
        "sg.ShadingQuality": {2: -.5, 3: 0}, "sg.AntiAliasingQuality": {2: 0, 3: .5}, "sg.TextureQuality": {2: 0, 3: .1}}
GAIN = {"sg.ShadowQuality": {0: -.015, 1: 0, 2: .004, 3: .014}, "r.Shadow.Virtual.Enable": {0: 0, 1: .026},
        "sg.GlobalIlluminationQuality": {1: 0, 2: .02, 3: .03}, "sg.ReflectionQuality": {1: 0, 2: .014, 3: .024},
        "r.ScreenPercentage": {50: -.07, 60: -.04, 67: -.02, 75: 0, 85: .025, 100: .035},
        "sg.ViewDistanceQuality": {1: -.006, 2: 0, 3: .01}, "sg.FoliageQuality": {1: -.008, 2: 0, 3: .006},
        "sg.EffectsQuality": {1: -.002, 2: 0, 3: .001}, "sg.PostProcessQuality": {1: -.004, 2: 0, 3: .003},
        "sg.ShadingQuality": {2: -.01, 3: 0}, "sg.AntiAliasingQuality": {2: 0, 3: .009}, "sg.TextureQuality": {2: 0, 3: .002}}


class FakeHost:
    """measure(candidate) with additive costs. The host reads sg.ShadingQuality back as 3 (step 1 of its ladder).
    With a clock, each candidate takes seconds (default: the loop.json estimate of a perf and a look run)."""

    def __init__(self, base_gpu=22.0, noise=0.0, contended=(), errors=(), clock=None, readback=True, repeat=REPEAT, loop=LOOP,
                 seconds=None):
        self.base_gpu, self.noise, self.readback, self.repeat, self.loop = base_gpu, noise, readback, repeat, loop
        self.contended, self.errors = set(contended), set(errors)
        self.reported = set()
        self.calls = []
        self.clock = clock
        self.seconds = T.candidate_estimate_s(loop) if seconds is None else seconds

    def __call__(self, candidate):
        self.calls.append(candidate)
        if self.clock:
            self.clock.now += self.seconds
        assert candidate["execcmds"] == T.execcmds_text(candidate["cvars"])
        if candidate["look_only"]:
            assert candidate["phase"] == "ceiling"
            return {"repeat_ssim": {f"view{i}": self.repeat for i in range(20)}}
        assert not T.violations(self.loop, candidate["levels"], {"shading": 1}), (candidate["id"], candidate["levels"])
        name = T.describe(self.loop, candidate["levels"])
        if name in self.errors:
            raise RuntimeError("RunUnreal exited with code 2")
        cvars = {k: v for k, v in candidate["cvars"].items() if k in COST}
        gpu = self.base_gpu + sum(COST[k][v] for k, v in cvars.items())
        # The second baseline run reads noise ms slower: the ms tie is max(0.5, 2 * noise).
        if candidate["id"].endswith("baseline-b"):
            gpu += self.noise
        look = .9 + sum(GAIN[k][v] for k, v in cvars.items())
        # A contended name is contended on its first run only.
        contended = name in self.contended and name not in self.reported
        self.reported.add(name)
        return {"frame_p95_ms": max(16.7, gpu + 2.0), "gpu_p95_ms": gpu, "hitches_ok": True, "vram_ok": True, "cvars_ok": True,
                "look": look, "images": {f"view{i}": look - .01 * (i % 2) for i in range(20)}, "contended": contended,
                "readback": {"sg.ShadingQuality": "3"} if self.readback else None}


class FakeClock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


def ids(tune, phase=None):
    return [r["id"] for r in tune["candidates"] if phase is None or r["phase"] == phase]


def check_files_and_profile():
    base = T.baseline_levels(LOOP)
    quality = T.parse_execcmds(browser_streaming.QUALITY)
    assert T.check_loop(LOOP) == [], T.check_loop(LOOP)
    # Fixed settings are CVar names, so a knob step that changes TSR is refused.
    tsr = copy.deepcopy(LOOP)
    tsr["knobs"][0]["steps"][-1]["r.AntiAliasingMethod"] = 2
    assert "knob shadows changes the fixed r.AntiAliasingMethod" in T.check_loop(tsr), T.check_loop(tsr)
    # A knob at the bottom of its ladder must say why it has no lower step, or the downward search could not use it.
    floorless = copy.deepcopy(LOOP)
    floorless["knobs"][1].pop("floor")
    assert "knob gi has no step below today's and no floor reason" in T.check_loop(floorless), T.check_loop(floorless)
    # The baseline candidate is today's QUALITY, CVar for CVar, with t.MaxFPS 60 kept.
    cvars = T.candidate_cvars(LOOP, base)
    assert T.same_cvars(cvars, quality), (cvars, quality)
    assert list(cvars)[:9] == [name for name in quality if name.startswith("sg.")], "sg.* groups come first"
    assert T.same_cvars(T.parse_execcmds(LOOP["profiles"]["baseline"]["execcmds"]), quality)
    for knob in T.enabled_knobs(LOOP):
        for step in range(len(knob["steps"])):
            assert T.candidate_cvars(LOOP, dict(base, **{knob["id"]: step}))["t.MaxFPS"] == 60
    # Candidate files: one ExecCmds line with no newline, and one name=value per CVar for -NordGauntletExpect=.
    with tempfile.TemporaryDirectory() as tmp:
        candidate = T.make_candidate(LOOP, dict(base, shadows=3, screen_percentage=5), "step", 7)
        assert candidate["id"] == "07-shadows3+screen_percentage5"
        execcmds, expect = T.write_candidate_files(tmp, candidate)
        line = execcmds.read_text()
        assert "\n" not in line and line.endswith("t.MaxFPS 60"), line
        assert "sg.ShadowQuality 2" in line and "r.Shadow.Virtual.Enable 1" in line and "r.ScreenPercentage 100" in line
        pairs = [row.split("=", 1) for row in expect.read_text().splitlines() if row and not row.startswith("#")]
        assert len(pairs) == len({name for name, _ in pairs}), "each CVar once"
        assert dict(pairs)["sg.ShadowQuality"] == "2" and dict(pairs)["r.ScreenPercentage"] == "100"
        # The readback also checks the fixed CVars the candidate does not set, so a profile that turns TSR off fails.
        assert set(dict(pairs)) == set(candidate["cvars"]) | set(LOOP["fixed"]) and "r.AntiAliasingMethod" not in candidate["cvars"]
        assert all(T.values_match(value, dict(pairs)[name]) for name, value in LOOP["fixed"].items()), pairs

    # DeviceProfiles: the first written profile equals QUALITY, the writer round-trips and leaves other text alone.
    other = ("; Project device profiles.\n[DeviceProfiles]\n+DeviceProfileNameAndTypes=Linux,Linux\n\n"
             "[Linux DeviceProfile]\n+CVars=r.Example=1\n")
    written = T.write_profile(other, cvars)
    profile = T.read_profile(written)
    assert profile["listed"] and profile["fields"] == {"DeviceType": "Linux", "BaseProfileName": "Linux"}
    assert T.same_cvars(profile["cvars"], quality), profile
    assert written.startswith("; Project device profiles.\n[DeviceProfiles]\n+DeviceProfileNameAndTypes=Linux,Linux\n"
                              "+DeviceProfileNameAndTypes=NordPhoneStream,Linux\n\n[Linux DeviceProfile]\n+CVars=r.Example=1\n\n"
                              "[NordPhoneStream DeviceProfile]\nDeviceType=Linux\nBaseProfileName=Linux\n"
                              "+CVars=sg.ViewDistanceQuality=2\n"), written
    lines = [row for row in written.splitlines() if row.startswith("+CVars=") and "Example" not in row]
    assert [row.split("=")[1] for row in lines] == list(T.ordered(quality)), "sg.* first, then single CVars"
    assert T.write_profile(written, profile["cvars"]) == written, "writing the same profile again changes nothing"
    tuned = dict(quality, **{"sg.ShadowQuality": 3, "r.Shadow.Virtual.Enable": 1, "sg.ShadingQuality": 3})
    rewritten = T.write_profile(written, tuned)
    assert T.same_cvars(T.read_profile(rewritten)["cvars"], tuned)
    assert rewritten.count("[NordPhoneStream DeviceProfile]") == 1 and rewritten.count("NordPhoneStream,Linux") == 1
    assert rewritten.split("[NordPhoneStream DeviceProfile]")[0] == written.split("[NordPhoneStream DeviceProfile]")[0]
    assert T.write_profile(T.write_profile(rewritten, quality), quality) == T.write_profile(rewritten, quality)
    assert T.read_profile(other) is None
    # From an empty file, and with a comment kept inside the section.
    empty = T.write_profile("", cvars)
    assert empty.startswith("[DeviceProfiles]\n+DeviceProfileNameAndTypes=NordPhoneStream,Linux\n\n[NordPhoneStream DeviceProfile]\n")
    commented = empty.replace("BaseProfileName=Linux\n", "BaseProfileName=Linux\n; Equal to QUALITY until the user approves.\n")
    assert "; Equal to QUALITY" in T.write_profile(commented, tuned)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "DefaultDeviceProfiles.ini"
        assert T.profile_state(path, quality) == "missing"
        T.write_profile_file(cvars, path)
        assert T.profile_state(path, quality) == "equals QUALITY"
        tune_path = T.write_tune(Path(tmp) / "tune.json", {"candidates": [dict(T.make_candidate(LOOP, dict(base, gi=2), "step", 3))]})
        T.write_candidate_profile(tune_path, "03-gi2", path)
        assert T.read_profile(path.read_text())["cvars"]["sg.GlobalIlluminationQuality"] == 3
        # write-profile records the approval next to the ini, so the approved profile is not a broken one.
        approval = json.loads(T.approval_path(path).read_text())
        assert approval["candidate"] == "03-gi2" and approval["cvars"]["sg.GlobalIlluminationQuality"] == 3, approval
        assert T.profile_state(path, quality) == "approved 03-gi2"
        # A hand edit after the approval matches neither QUALITY nor the approved candidate.
        path.write_text(path.read_text().replace("+CVars=sg.GlobalIlluminationQuality=3", "+CVars=sg.GlobalIlluminationQuality=2"))
        assert T.profile_state(path, quality) == "differs"
    # The checked-in profile equals QUALITY until the user approves a candidate, then that candidate.
    state = T.profile_state(T.PROFILES_INI, quality)
    assert state in ("missing", "equals QUALITY") or state.startswith("approved "), f"the NordPhoneStream section {state}"
    print("profile ok: first profile equals QUALITY; checked-in ini", state)


def check_dependencies():
    base = T.baseline_levels(LOOP)
    assert T.violations(LOOP, dict(base, reflections=1)) != []
    assert T.repair(LOOP, dict(base, reflections=1), direction=1) == dict(base, reflections=1, gi=1)
    assert T.repair(LOOP, dict(base, reflections=2, gi=0), direction=-1) == dict(base, reflections=0, gi=0)
    assert T.violations(LOOP, dict(base, reflections=1, gi=1)) == []
    broken = copy.deepcopy(LOOP)
    broken["requires"].append({"knob": "gi", "from_step": 1, "needs_knob": "nanite_edge", "needs_from_step": 1})
    assert T.repair(broken, dict(base, gi=1), direction=1) is None, "a disabled needed knob cannot be raised"
    assert T.merge({"a": 1, "b": None}, {"a": 2, "b": 0}) == {"a": 2, "b": 0}
    assert T.merge({"a": 1, "b": 3}, {"a": 2, "b": 0}, -1) == {"a": 1, "b": 0}


def check_ties():
    entry = lambda seq, look, gpu, changed=1: {"id": str(seq), "seq": seq, "look": look, "gpu_p95_ms": gpu,
                                               "changed": {f"k{i}": 1 for i in range(changed)}}
    a, b, c = entry(1, .950, 26.0), entry(2, .955, 27.5), entry(3, .965, 27.9)
    # C beats B by 0.010 > 0.008; A and B tie on Look and A has the lower GPU p95.
    assert [e["id"] for e in T.rank([a, b, c], .008, .5)] == ["3", "1", "2"]
    # Within the ms tie the GPU values tie too, so the higher Look wins.
    d, e = entry(4, .960, 27.0), entry(5, .963, 27.3)
    assert [x["id"] for x in T.rank([d, e], .008, .5)] == ["5", "4"]
    assert [x["id"] for x in T.rank([d, e], .008, .2)] == ["4", "5"]
    # Equal Look and GPU: fewer changed knobs, then the earlier run.
    f, g, h = entry(6, .95, 25.0, 2), entry(7, .95, 25.0, 1), entry(8, .95, 25.0, 1)
    assert [x["id"] for x in T.rank([f, g, h], .008, .5)] == ["7", "8", "6"]
    assert abs(T.look_tie(LOOP, .996) - .008) < 1e-12 and T.look_tie(LOOP, .999) == .005 and T.look_tie(LOOP, None) == .005
    assert T.ms_tie(LOOP, 22.0, 22.1) == .5 and abs(T.ms_tie(LOOP, 22.0, 22.4) - .8) < 1e-12


def check_search():
    host = FakeHost()
    saved = []
    tune = T.search(LOOP, host, save=lambda partial: saved.append(json.loads(json.dumps(partial))))
    # tune.json is saved after every measured candidate, then once at the end.
    assert len(saved) == len(host.calls) + 1 and saved[0]["stop_reason"] == "running" and saved[-1] == json.loads(json.dumps(tune))
    assert [len([r for r in s["candidates"] if r["id"] != "baseline"]) for s in saved[:-1]] == list(range(1, len(host.calls) + 1))
    measured = [r for r in tune["candidates"] if r["id"] != "baseline"]
    assert tune["measured"] == len(host.calls) == len(measured) == 18, tune["measured"]
    # Order: baseline twice, ceiling twice, then one step up per knob in loop.json order.
    expected = ["00-baseline-a", "01-baseline-b", "02-ceiling-a", "03-ceiling-b", "04-shadows2", "05-gi1",
                "06-gi1+reflections1", "07-screen_percentage4", "08-view_distance2", "09-foliage2", "10-effects2",
                "11-post_process2", "12-anti_aliasing1", "13-textures1"]
    assert [c["id"] for c in host.calls][:14] == expected, [c["id"] for c in host.calls]
    assert tune["resolved_baseline_steps"] == {"shading": 1}, "sg.ShadingQuality 3 read back is the top of its ladder"
    assert tune["ties"]["ms"] == .5 and abs(tune["ties"]["look"] - .008) < 1e-12
    # Sensitivity: steps without a visible gain are dropped; efficiency is gain / max(ms, 0.25).
    by_id = {e["id"]: e for e in tune["sensitivity"]}
    assert not by_id["04-shadows2"]["kept"] and by_id["04-shadows2"]["why"] == "no visible Look gain"
    assert by_id["08-view_distance2"]["cost_used_ms"] == 0.0, "0.3 ms is inside the 0.5 ms noise tie"
    assert abs(by_id["08-view_distance2"]["efficiency"] - .04) < 1e-9
    assert tune["combine"]["order"] == ["08-view_distance2", "12-anti_aliasing1", "06-gi1+reflections1", "07-screen_percentage4",
                                        "05-gi1"]
    # Combine: gi1 is inside the reflections bundle, so it adds nothing; the prediction is 22 + 0.5 + 3 + 2.5 = 28 ms.
    assert tune["combine"]["chosen"] == ["08-view_distance2", "12-anti_aliasing1", "06-gi1+reflections1", "07-screen_percentage4"]
    assert abs(tune["combine"]["predicted_gpu_p95_ms"] - 28.0) < 1e-9
    # Fallback: the measured combination is 28.3 ms (view distance was a noise-tied 0.3 ms), so the last step is dropped.
    assert ids(tune, "combine") == ["14-gi1+reflections1+screen_percentage4+view_distance2+anti_aliasing1",
                                    "15-gi1+reflections1+view_distance2+anti_aliasing1"]
    records = {r["id"]: r for r in tune["candidates"]}
    assert not records[ids(tune, "combine")[0]]["feasible"] and records[ids(tune, "combine")[1]]["feasible"]
    assert tune["combine"]["dropped"] == ["07-screen_percentage4"]
    # Climb: screen 85 on top is the cached infeasible combination (not measured again); then the next rung of each
    # raised knob: reflections 2 is feasible and visibly better, gi 2 is over budget.
    assert ids(tune, "climb") == ["16-gi1+reflections2+view_distance2+anti_aliasing1", "17-gi2+reflections2+view_distance2+anti_aliasing1"]
    assert tune["stop_reason"] == "converged"
    assert tune["winner"] == "16-gi1+reflections2+view_distance2+anti_aliasing1", tune["winner"]
    winner = records[tune["winner"]]
    assert winner["feasible"] and winner["frame_p95_ms"] <= 30.0 and winner["gpu_p95_ms"] <= 28.0
    # Spec "Search": no measured feasible candidate beats the winner's Look by more than the tie.
    eligible = [r for r in tune["candidates"] if r["eligible"]]
    assert all(r["look"] - winner["look"] <= tune["ties"]["look"] for r in eligible)
    assert winner["look"] >= records["baseline"]["look"] and min(winner["images"].values()) >= .85
    # Dependency safety: every candidate keeps every rule, and fixed settings never change.
    for record in tune["candidates"]:
        if record["levels"] is not None:
            assert not T.violations(LOOP, record["levels"], tune["resolved_baseline_steps"]), record["id"]
        assert record["cvars"]["t.MaxFPS"] == 60
    assert records["06-gi1+reflections1"]["levels"]["gi"] == 1, "the reflections step brings the GI step it needs"
    # The ceiling is look only and never ranked; the baseline aggregate is ranked once.
    assert not records["02-ceiling-a"]["ranked"] and records["baseline"]["ranked"] and not records["00-baseline-a"]["ranked"]
    assert tune["ranking"][0] == tune["winner"] and "baseline" in tune["ranking"]
    print("search ok:", tune["measured"], "candidates, winner", tune["winner"])
    return tune


def check_stop_rule():
    limited = copy.deepcopy(LOOP)
    limited["search"]["max_candidates"] = 8
    host = FakeHost()
    tune = T.search(limited, host)
    assert tune["stop_reason"] == "max_candidates" and tune["measured"] == len(host.calls) == 8
    assert ids(tune, "step") == ["04-shadows2", "05-gi1", "06-gi1+reflections1", "07-screen_percentage4"]
    assert tune["winner"] == "06-gi1+reflections1", "the best measured feasible candidate still wins"
    # Without the host readback, today's sg.ShadingQuality is unknown, so each of its steps is measured once.
    tune = T.search(limited, FakeHost(readback=False))
    assert tune["resolved_baseline_steps"] == {}
    tune = T.search(LOOP, FakeHost(readback=False))
    assert [r["id"] for r in tune["candidates"] if r["changed"] and set(r["changed"]) == {"shading"}] == ["12-shading0", "13-shading1"]
    # A ceiling whose two renders differ (images under 0.98) makes the round invalid: no winner.
    tune = T.search(LOOP, FakeHost(repeat=.975))
    assert tune["stop_reason"] == "reference_not_repeatable" and tune["measured"] == 4 and tune["winner"] is None
    assert tune["ties"]["repeat"]["min"] == .975 and tune["ranking"] == []
    # Window end: a candidate is a perf and a look run, from the loop.json lap and start-up estimates (1190 s, the
    # modelled laps in Scripts/gauntlet_model_test.cpp). A window of 6 candidates and one second measures 6.
    estimate = T.candidate_estimate_s(LOOP)
    assert estimate == T.run_estimate_s(LOOP, "perf") + T.run_estimate_s(LOOP, "look") == 1190, estimate
    assert T.run_estimate_s(LOOP, "perf", LOOP["confirm_laps"]) == 1310, "a confirmation run: 1 warm and 3 measured laps"
    clock = FakeClock()
    host = FakeHost(clock=clock)
    tune = T.search(LOOP, host, until=clock.now + 6 * estimate + 1, clock=clock)
    assert tune["stop_reason"] == "window_end" and tune["measured"] == 6, (tune["stop_reason"], tune["measured"])
    assert tune["until"] == T.iso(1_000_000.0 + 6 * estimate + 1) and clock.now <= 1_000_000.0 + 6 * estimate + 1
    # A host 1.5 times slower than the estimate: after the first candidate the search plans with the longest one
    # measured, so it does not start a candidate that would end after the window.
    clock = FakeClock()
    until = clock.now + 2.6 * estimate
    tune = T.search(LOOP, FakeHost(clock=clock, seconds=1.5 * estimate), until=until, clock=clock)
    assert tune["stop_reason"] == "window_end" and tune["measured"] == 1 and clock.now <= until, (tune["measured"], clock.now - until)
    assert tune["planned_candidate_s"] == 1.5 * estimate
    now = datetime(2026, 10, 23, 23, 15, tzinfo=timezone.utc)
    assert T.parse_until("06:30", now) == datetime(2026, 10, 24, 6, 30, tzinfo=timezone.utc).timestamp()
    assert T.parse_until("23:45", now) == datetime(2026, 10, 23, 23, 45, tzinfo=timezone.utc).timestamp()
    print("stop rule ok: 8-candidate limit and window end")


def check_noise_and_contention():
    # The second baseline reads 0.4 ms slower: the ms tie becomes 0.8, so anti-aliasing's 0.5 ms counts as free.
    host = FakeHost(noise=.4, contended={"textures1"}, errors={"effects2"})
    tune = T.search(LOOP, host)
    assert abs(tune["ties"]["ms"] - .8) < 1e-9, tune["ties"]
    entry = next(e for e in tune["sensitivity"] if e["knob"] == "anti_aliasing")
    assert entry["cost_used_ms"] == 0.0 and abs(entry["efficiency"] - (.009 / .25)) < 1e-9, entry
    # A contended run is recorded, measured once more, and never ranked.
    textures = [r for r in tune["candidates"] if r["changed"] == {"textures": 1}]
    assert [r["contended"] for r in textures] == [True, False], textures
    assert not textures[0]["eligible"] and textures[0]["reasons"] == ["contended: a foreign GPU process ran"]
    # A run that fails on the host is a recorded, infeasible candidate.
    failed = next(r for r in tune["candidates"] if r["changed"] == {"effects": 2})
    assert not failed["feasible"] and failed["reasons"][0].startswith("run failed: RuntimeError")
    assert tune["measured"] == len(host.calls)
    print("noise and contention ok: ms tie", round(tune["ties"]["ms"], 3))


def check_downward():
    # 29 ms on the GPU misses the 28 ms target. Every knob with a step below today's steps down once, not only
    # screen percentage and shading.
    host = FakeHost(base_gpu=29.0)
    tune = T.search(LOOP, host)
    records = {r["id"]: r for r in tune["candidates"]}
    assert not records["baseline"]["feasible"] and tune["notes"][0].startswith("the baseline is not feasible")
    assert ids(tune, "down") == ["04-shadows0", "05-screen_percentage2", "06-view_distance0", "07-foliage0", "08-effects0",
                                 "09-post_process0", "10-shading0"], ids(tune, "down")
    down = {e["id"]: e for e in tune["sensitivity"]}
    assert abs(down["05-screen_percentage2"]["efficiency"] - 1.5 / .02) < 1e-6
    # Effects (0.8 ms for a 0.002 loss) and foliage are the most efficient, and together they are the start. Raising
    # either back is a measured single step that does not look visibly better.
    assert tune["combine"]["applied"] == ["08-effects0", "07-foliage0"], tune["combine"]
    assert tune["combine"]["result"] == "11-foliage0+effects0" == tune["winner"]
    assert ids(tune, "climb") == [] and tune["stop_reason"] == "converged"
    # The review's probe: a 32 ms baseline. Screen percentage 67 and shading alone save 2 ms and the old ladders stopped
    # with no feasible start; the cheap knobs now reach 27.6 ms.
    tune = T.search(LOOP, FakeHost(base_gpu=32.0))
    records = {r["id"]: r for r in tune["candidates"]}
    assert tune["stop_reason"] == "converged" and tune["winner"] == "11-shadows0+view_distance0+foliage0+effects0+post_process0", (
        tune["stop_reason"], tune["winner"])
    winner = records[tune["winner"]]
    assert winner["feasible"] and winner["gpu_p95_ms"] <= 28.0 and min(winner["images"].values()) >= .85, winner
    # Nothing can step down far enough: no feasible start.
    host = FakeHost(base_gpu=40.0)
    tune = T.search(LOOP, host)
    assert tune["stop_reason"] == "no_feasible_start" and tune["winner"] is None, tune["stop_reason"]
    assert ids(tune, "down-combine"), "the combined down steps were measured"
    print("downward ok")


def check_confirmation(tune):
    calls = []

    def confirm(record):
        calls.append(record["id"])
        if record["id"] == tune["ranking"][0]:
            return {"passed": False, "reasons": ["portrait day lap p95 34.1 ms over 33.3 ms"], "two_viewer_fps": 17.0}
        return {"passed": True, "reasons": [], "two_viewer_fps": 17.5 if record["id"] == "baseline" else 16.0}

    confirmed = T.confirm(copy.deepcopy(tune), LOOP, confirm)
    second = tune["ranking"][1]
    assert calls[:3] == ["baseline", tune["ranking"][0], second], calls
    assert confirmed["confirmation"]["confirmed"] == second
    first = confirmed["confirmation"]["results"][1]
    assert not first["passed"] and "34.1" in first["reasons"][0]
    # The co-op guard: a candidate more than 2 FPS below the baseline with two viewers falls back too.
    calls.clear()
    guard = T.confirm(copy.deepcopy(tune), LOOP, lambda r: {"passed": True, "reasons": [],
                                                            "two_viewer_fps": 18.0 if r["id"] == "baseline" else 15.5})
    assert guard["confirmation"]["confirmed"] == "baseline", guard["confirmation"]
    assert all("two-viewer FPS 15.5" in r["reasons"][-1] for r in guard["confirmation"]["results"][1:])
    print("confirmation ok: fell back to", second)


def check_partial_stills():
    """A look run that kept 2 of its 20 stills has a high mean on the views it kept. It must not rank or win."""
    class PartialHost(FakeHost):
        def __call__(self, candidate):
            result = super().__call__(candidate)
            if candidate["id"].split("-", 1)[1] == "foliage2":
                result.update(look=.97, images={"day/S1-eye": .97, "day/S1-chase": .97})
            return result

    tune = T.search(LOOP, PartialHost())
    partial = next(r for r in tune["candidates"] if r["id"].endswith("-foliage2"))
    assert partial["feasible"] and "2 of 20 stills" in partial["look_reasons"] and not partial["eligible"], partial["look_reasons"]
    assert tune["winner"] != partial["id"] and partial["id"] not in tune["ranking"], tune["winner"]
    print("partial stills ok:", partial["id"], "with 2 of 20 stills is not ranked; the winner is", tune["winner"])


def check_result_from_verdict():
    verdict = {"status": "pass", "values": {"frame_p95_ms": 24.0, "gpu_p95_ms": 21.0, "hitches_ok": True, "vram_ok": True,
                                            "cvars_ok": None}}
    result = T.result_from_verdict(verdict, look=.93, images={"S1-eye": .93})
    feasible, reasons = T.feasibility(LOOP, result)
    assert not feasible and reasons == ["CVar readback unverified"], reasons
    verdict["values"]["cvars_ok"] = True
    assert T.feasibility(LOOP, T.result_from_verdict(verdict, .93))[0]
    verdict["status"] = "contended"
    assert T.feasibility(LOOP, T.result_from_verdict(verdict, .93)) == (False, ["contended: a foreign GPU process ran"])
    over = {"frame_p95_ms": 30.2, "gpu_p95_ms": 28.0, "hitches_ok": True, "vram_ok": False, "cvars_ok": True}
    assert T.feasibility(LOOP, over) == (False, ["FrameTime p95 30.20 ms over 30.0 ms", "VRAM limit failed"])


def main():
    check_files_and_profile()
    check_dependencies()
    check_ties()
    tune = check_search()
    check_stop_rule()
    check_noise_and_contention()
    check_downward()
    check_confirmation(tune)
    check_partial_stills()
    check_result_from_verdict()
    print("NORD_GAUNTLET_TUNE_OK")


if __name__ == "__main__":
    main()
