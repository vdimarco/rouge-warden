"""Offline checks for Scripts/gauntlet_tune.py with a fake host (no Unreal, no GPU).

Run from games/nord-unreal:  python3 Scripts/test_gauntlet_tune.py
A fake measure function with known additive GPU costs and Look gains per knob step checks the search order, the
combination and its fallback, the climb, the stop rule (candidate limit and window end), the downward search, tie and
noise handling, contended runs, dependency safety and the confirmation order. The DeviceProfiles writer must round-trip,
and the first profile it writes must equal today's QUALITY in Scripts/browser_streaming.py.
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

# Cumulative GPU ms and Look per step index, relative to the baseline profile (22 ms, Look 0.900).
COST = {"shadows": [0, .8, 3.0, 5.0], "gi": [0, 2.0, 4.5], "reflections": [0, 1.0, 2.5],
        "screen_percentage": [-3.0, -1.5, 0, 2.5, 5.5], "view_distance": [0, .3], "foliage": [0, 1.2], "effects": [0, .2],
        "post_process": [0, .4], "shading": [-.5, 0], "anti_aliasing": [0, .5], "textures": [0, .1]}
GAIN = {"shadows": [0, .004, .03, .04], "gi": [0, .02, .03], "reflections": [0, .014, .024],
        "screen_percentage": [-.04, -.02, 0, .025, .035], "view_distance": [0, .01], "foliage": [0, .006], "effects": [0, .001],
        "post_process": [0, .003], "shading": [-.01, 0], "anti_aliasing": [0, .009], "textures": [0, .002]}


class FakeHost:
    """measure(candidate) with additive costs. The host reads sg.ShadingQuality back as 3 (step 1 of its ladder)."""

    def __init__(self, base_gpu=22.0, noise=0.0, contended=(), errors=(), clock=None):
        self.base_gpu, self.noise = base_gpu, noise
        self.contended, self.errors = set(contended), set(errors)
        self.reported = set()
        self.calls = []
        self.clock = clock

    def __call__(self, candidate):
        self.calls.append(candidate)
        if self.clock:
            self.clock.now += LOOP["durations"]["candidate_estimate_s"]
        assert candidate["execcmds"] == T.execcmds_text(candidate["cvars"])
        if candidate["look_only"]:
            assert candidate["phase"] == "ceiling"
            return {"repeat_ssim": {f"view{i}": REPEAT for i in range(20)}}
        levels = dict(candidate["levels"])
        assert not T.violations(LOOP, levels, {"shading": 1}), (candidate["id"], levels)
        if levels["shading"] is None:
            levels["shading"] = 1
        name = T.describe(LOOP, candidate["levels"])
        if name in self.errors:
            raise RuntimeError("RunUnreal exited with code 2")
        gpu = self.base_gpu + sum(COST[k][v] for k, v in levels.items())
        # The second baseline run reads noise ms slower: the ms tie is max(0.5, 2 * noise).
        if candidate["id"].endswith("baseline-b"):
            gpu += self.noise
        look = .9 + sum(GAIN[k][v] for k, v in levels.items())
        # A contended name is contended on its first run only.
        contended = name in self.contended and name not in self.reported
        self.reported.add(name)
        return {"frame_p95_ms": max(16.7, gpu + 2.0), "gpu_p95_ms": gpu, "hitches_ok": True, "vram_ok": True, "cvars_ok": True,
                "look": look, "images": {f"view{i}": look - .01 * (i % 2) for i in range(20)}, "contended": contended,
                "readback": {"sg.ShadingQuality": "3"}}


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
        candidate = T.make_candidate(LOOP, dict(base, shadows=2, screen_percentage=4), "step", 7)
        assert candidate["id"] == "07-shadows2+screen_percentage4"
        execcmds, expect = T.write_candidate_files(tmp, candidate)
        line = execcmds.read_text()
        assert "\n" not in line and line.endswith("t.MaxFPS 60"), line
        assert "sg.ShadowQuality 2" in line and "r.Shadow.Virtual.Enable 1" in line and "r.ScreenPercentage 100" in line
        pairs = [row.split("=", 1) for row in expect.read_text().splitlines() if row and not row.startswith("#")]
        assert len(pairs) == len({name for name, _ in pairs}) == len(candidate["cvars"]), "each CVar once"
        assert dict(pairs)["sg.ShadowQuality"] == "2" and dict(pairs)["r.ScreenPercentage"] == "100"

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
        T.write_profile_file(cvars, path)
        tune_path = T.write_tune(Path(tmp) / "tune.json", {"candidates": [dict(T.make_candidate(LOOP, dict(base, gi=2), "step", 3))]})
        T.write_candidate_profile(tune_path, "03-gi2", path)
        assert T.read_profile(path.read_text())["cvars"]["sg.GlobalIlluminationQuality"] == 3
    # The checked-in profile, once Config/DefaultDeviceProfiles.ini exists, must still equal QUALITY.
    if T.PROFILES_INI.is_file():
        checked_in = T.read_profile(T.PROFILES_INI.read_text())
        assert checked_in and T.same_cvars(checked_in["cvars"], quality), "the NordPhoneStream section differs from QUALITY"
    print("profile ok: first profile equals QUALITY;", "checked-in ini compared" if T.PROFILES_INI.is_file() else "no checked-in ini yet")


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
    tune = T.search(LOOP, host)
    json.dumps(tune)
    measured = [r for r in tune["candidates"] if r["id"] != "baseline"]
    assert tune["measured"] == len(host.calls) == len(measured) == 18, tune["measured"]
    # Order: baseline twice, ceiling twice, then one step up per knob in loop.json order.
    expected = ["00-baseline-a", "01-baseline-b", "02-ceiling-a", "03-ceiling-b", "04-shadows1", "05-gi1",
                "06-gi1+reflections1", "07-screen_percentage3", "08-view_distance1", "09-foliage1", "10-effects1",
                "11-post_process1", "12-anti_aliasing1", "13-textures1"]
    assert [c["id"] for c in host.calls][:14] == expected, [c["id"] for c in host.calls]
    assert tune["resolved_baseline_steps"] == {"shading": 1}, "sg.ShadingQuality 3 read back is the top of its ladder"
    assert tune["ties"]["ms"] == .5 and abs(tune["ties"]["look"] - .008) < 1e-12
    # Sensitivity: steps without a visible gain are dropped; efficiency is gain / max(ms, 0.25).
    by_id = {e["id"]: e for e in tune["sensitivity"]}
    assert not by_id["04-shadows1"]["kept"] and by_id["04-shadows1"]["why"] == "no visible Look gain"
    assert by_id["08-view_distance1"]["cost_used_ms"] == 0.0, "0.3 ms is inside the 0.5 ms noise tie"
    assert abs(by_id["08-view_distance1"]["efficiency"] - .04) < 1e-9
    assert tune["combine"]["order"] == ["08-view_distance1", "12-anti_aliasing1", "06-gi1+reflections1", "07-screen_percentage3",
                                        "05-gi1"]
    # Combine: gi1 is inside the reflections bundle, so it adds nothing; the prediction is 22 + 0.5 + 3 + 2.5 = 28 ms.
    assert tune["combine"]["chosen"] == ["08-view_distance1", "12-anti_aliasing1", "06-gi1+reflections1", "07-screen_percentage3"]
    assert abs(tune["combine"]["predicted_gpu_p95_ms"] - 28.0) < 1e-9
    # Fallback: the measured combination is 28.3 ms (view distance was a noise-tied 0.3 ms), so the last step is dropped.
    assert ids(tune, "combine") == ["14-gi1+reflections1+screen_percentage3+view_distance1+anti_aliasing1",
                                    "15-gi1+reflections1+view_distance1+anti_aliasing1"]
    records = {r["id"]: r for r in tune["candidates"]}
    assert not records[ids(tune, "combine")[0]]["feasible"] and records[ids(tune, "combine")[1]]["feasible"]
    assert tune["combine"]["dropped"] == ["07-screen_percentage3"]
    # Climb: screen 85 on top is the cached infeasible combination (not measured again); then the next rung of each
    # raised knob: reflections 2 is feasible and visibly better, gi 2 is over budget.
    assert ids(tune, "climb") == ["16-gi1+reflections2+view_distance1+anti_aliasing1", "17-gi2+reflections2+view_distance1+anti_aliasing1"]
    assert tune["stop_reason"] == "converged"
    assert tune["winner"] == "16-gi1+reflections2+view_distance1+anti_aliasing1", tune["winner"]
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
    assert ids(tune, "step") == ["04-shadows1", "05-gi1", "06-gi1+reflections1", "07-screen_percentage3"]
    assert tune["winner"] == "06-gi1+reflections1", "the best measured feasible candidate still wins"
    # Window end: each candidate takes 600 s; a window of 6 candidates and one second measures 6.
    clock = FakeClock()
    host = FakeHost(clock=clock)
    tune = T.search(LOOP, host, until=clock.now + 6 * 600 + 1, clock=clock)
    assert tune["stop_reason"] == "window_end" and tune["measured"] == 6, (tune["stop_reason"], tune["measured"])
    assert tune["until"] == T.iso(1_000_000.0 + 3601)
    now = datetime(2026, 10, 23, 23, 15, tzinfo=timezone.utc)
    assert T.parse_until("06:30", now) == datetime(2026, 10, 24, 6, 30, tzinfo=timezone.utc).timestamp()
    assert T.parse_until("23:45", now) == datetime(2026, 10, 23, 23, 45, tzinfo=timezone.utc).timestamp()
    print("stop rule ok: 8-candidate limit and window end")


def check_noise_and_contention():
    # The second baseline reads 0.4 ms slower: the ms tie becomes 0.8, so anti-aliasing's 0.5 ms counts as free.
    host = FakeHost(noise=.4, contended={"textures1"}, errors={"effects1"})
    tune = T.search(LOOP, host)
    assert abs(tune["ties"]["ms"] - .8) < 1e-9, tune["ties"]
    entry = next(e for e in tune["sensitivity"] if e["knob"] == "anti_aliasing")
    assert entry["cost_used_ms"] == 0.0 and abs(entry["efficiency"] - (.009 / .25)) < 1e-9, entry
    # A contended run is recorded, measured once more, and never ranked.
    textures = [r for r in tune["candidates"] if r["changed"] == {"textures": 1}]
    assert [r["contended"] for r in textures] == [True, False], textures
    assert not textures[0]["eligible"] and textures[0]["reasons"] == ["contended: a foreign GPU process ran"]
    # A run that fails on the host is a recorded, infeasible candidate.
    failed = next(r for r in tune["candidates"] if r["changed"] == {"effects": 1})
    assert not failed["feasible"] and failed["reasons"][0].startswith("run failed: RuntimeError")
    assert tune["measured"] == len(host.calls)
    print("noise and contention ok: ms tie", round(tune["ties"]["ms"], 3))


def check_downward():
    # 29 ms on the GPU misses the 28 ms target: only screen percentage and shading can step down.
    host = FakeHost(base_gpu=29.0)
    tune = T.search(LOOP, host)
    records = {r["id"]: r for r in tune["candidates"]}
    assert not records["baseline"]["feasible"] and tune["notes"][0].startswith("the baseline is not feasible")
    assert ids(tune, "down") == ["04-screen_percentage1", "05-shading0"], ids(tune, "down")
    down = {e["id"]: e for e in tune["sensitivity"]}
    assert abs(down["04-screen_percentage1"]["efficiency"] - 1.5 / .02) < 1e-6
    # screen 67 alone is predicted (and measured) feasible, so it is the start; raising it back is today's profile.
    assert tune["combine"]["result"] == "04-screen_percentage1" and tune["winner"] == "04-screen_percentage1"
    assert ids(tune, "climb") == [] and tune["stop_reason"] == "converged"
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
    check_result_from_verdict()
    print("NORD_GAUNTLET_TUNE_OK")


if __name__ == "__main__":
    main()
