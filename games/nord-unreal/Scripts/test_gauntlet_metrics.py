"""Offline checks for Scripts/gauntlet_metrics.py (no Unreal, no GPU).

Run from games/nord-unreal:  python3 Scripts/test_gauntlet_metrics.py
Checks the shared frame-time fixture (Data/Gauntlet/fixtures/frametimes.csv and its expected JSON), an Unreal-style
CSV profiler file built from it (warm-up and tail discard, leg events, two laps, memory and missing columns), the hitch
rule, every gate with pass, fail, unverified and contended verdicts, the stream and process parsers, SSIM (identity,
a known blur, a brute-force reference and the constant-image closed form), the optional FLIP call and review.html.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys
import tempfile
import types

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gauntlet_metrics as M  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "Data/Gauntlet/fixtures/frametimes.csv"
EXPECTED = json.loads((ROOT / "Data/Gauntlet/fixtures/frametimes_expected.json").read_text())
LOOP = M.load_loop()
LEGS = M.leg_names(LOOP)
HEADER = ["FrameTime", "GameThreadTime", "RenderThreadTime", "RHIThreadTime", "GPUTime", "PhysicalUsedMB", "EVENTS"]


def same_stats(got, want, label):
    assert got is not None, label
    for key, value in want.items():
        tolerance = 1e-6 if key == "seconds" else 0
        assert abs(got[key] - value) <= tolerance, (label, key, got[key], value)


def profiler_csv(laps, columns=HEADER, warm=30, tail=(999.0, 998.0), events=True):
    """An Unreal CSV profiler file: warm-up rows, then each lap's rows with a leg event at each leg start, two tail rows,
    the repeated header row and the metadata row (the layout profile_package.py reads)."""
    lines = [",".join(columns)]

    def row(ms, event=""):
        values = {"FrameTime": ms, "GameThreadTime": ms * .5, "RenderThreadTime": ms * .6, "RHIThreadTime": ms * .4,
                  "GPUTime": ms * .8, "PhysicalUsedMB": 4000 + ms, "EVENTS": event}
        lines.append(",".join(f"{values[name]:.3f}" if isinstance(values[name], float) else values[name] for name in columns))

    for index in range(warm):
        row(45.0, "NordGauntlet/warm lap" if index == 0 else "")
    for lap, samples in enumerate(laps, 1):
        previous = None
        for sample in samples:
            event = ""
            if events and sample["leg"] != previous:
                event = f"NordGauntlet/leg={sample['leg']} lap={lap}"
                if sample["leg"] == "S3-S4" and lap == 1:
                    event += ";Exec stat unit"  # an engine event in the same cell; ignored
            previous = sample["leg"]
            row(sample["FrameTime"], event)
    for ms in tail:
        row(ms)
    lines.append(",".join(columns))
    lines.append("[platform],Linux,[gpu],NVIDIA GeForce RTX 4090,[engineversion],5.8.3,[HasHeaderRowAtEnd],1")
    return "\n".join(lines) + "\n"


def write(directory, name, text):
    path = Path(directory) / name
    path.write_text(text)
    return path


def check_fixture():
    samples = M.read_fixture(FIXTURE)
    analysis = M.analyze_samples(samples, LOOP)
    assert list(EXPECTED["legs"]) == LEGS, "the fixture legs follow loop.json drive order"
    same_stats(analysis["all"]["frame"], EXPECTED["lap"], "lap")
    for leg, want in EXPECTED["legs"].items():
        same_stats(analysis["legs"][leg]["frame"], want, leg)
    assert len(analysis["laps"]) == 1 and analysis["laps"][0]["legs"]["S2-S3"]["frame"] == analysis["legs"]["S2-S3"]["frame"]
    assert [row["leg"] for row in M.legs_ranked(analysis)] == ["S1-S2", "S5-S1", "S4-S5", "S2-S3", "S3-S4"]
    assert M.percentile([4, 1, 3, 2], .95) == 4 and M.percentile([5.0], .99) == 5.0
    print("fixture ok:", EXPECTED["lap"]["frames"], "frames, p95", analysis["all"]["frame"]["p95_ms"])


def check_profiler_csv():
    samples = M.read_fixture(FIXTURE)
    with tempfile.TemporaryDirectory() as tmp:
        analysis = M.analyze_csv(write(tmp, "one.csv", profiler_csv([samples])), LOOP)
        assert analysis["missing_columns"] == [] and analysis["columns_found"] == list(M.FIELDS.values())
        assert analysis["discarded"] == {"head": 0, "tail": 2, "hold": 0, "warm": 30, "end": 0}, analysis["discarded"]
        assert analysis["leg_order_ok"] and analysis["frames"] == 1000 and analysis["rows"] == 1032
        assert any("1 CSV events were not gauntlet events" in note for note in analysis["notes"]), analysis["notes"]
        same_stats(analysis["all"]["frame"], EXPECTED["lap"], "csv lap")
        for leg, want in EXPECTED["legs"].items():
            same_stats(analysis["legs"][leg]["frame"], want, "csv " + leg)
        assert abs(analysis["all"]["gpu"]["p95_ms"] - EXPECTED["lap"]["p95_ms"] * .8) < 2e-3
        assert analysis["metadata"]["platform"] == "Linux" and analysis["metadata"]["engineversion"] == "5.8.3"
        assert abs(analysis["memory"]["PhysicalUsedMB"]["max"] - (4000 + EXPECTED["lap"]["max_ms"])) < 1e-6
        # Two measured laps: p95 gates use the median of the per-lap values; counts pool over every frame.
        faster = [dict(s, FrameTime=round(s["FrameTime"] * .9, 3)) for s in samples]
        slower = [dict(s, FrameTime=round(s["FrameTime"] * 1.1, 3)) for s in samples]
        three = M.analyze_csv(write(tmp, "three.csv", profiler_csv([faster, samples, slower])), LOOP)
        assert [lap["lap"] for lap in three["laps"]] == [1, 2, 3] and three["frames"] == 3000
        assert M.lap_median(three, "frame", "p95_ms") == EXPECTED["lap"]["p95_ms"]
        assert M.lap_median(three, "frame", "p95_ms", "S3-S4") == EXPECTED["legs"]["S3-S4"]["p95_ms"]
        gates = {g["name"]: g for g in M.native_gates(three, LOOP)}
        assert gates["frame_p95"]["value"] == EXPECTED["lap"]["p95_ms"] and gates["frame_p95"]["note"] == "median of the per-lap values"
        # Out-of-order legs are noted; a hold leaves the lap until the next leg starts.
        shuffled = profiler_csv([samples]).replace("leg=S2-S3", "leg=S4-S5", 1)
        assert not M.analyze_csv(write(tmp, "order.csv", shuffled), LOOP)["leg_order_ok"]
        held = profiler_csv([samples]).replace("NordGauntlet/leg=S2-S3 lap=1", "NordGauntlet/hold S2", 1)
        holding = M.analyze_csv(write(tmp, "hold.csv", held), LOOP)
        assert holding["discarded"]["hold"] == EXPECTED["legs"]["S2-S3"]["frames"] and "S2-S3" not in holding["legs"]
        assert {g["name"]: g for g in M.native_gates(holding, LOOP)}["frame_p95:S2-S3"]["result"] == "unverified"
    for text, kind in (("NordGauntlet/leg=S1-S2 lap=1", ("leg", "S1-S2")), ("S5-S1", ("leg", "S5-S1")),
                       ("NordGauntlet/Hold S2", ("hold",)), ("NordGauntlet/WarmBegin", ("warm",)), ("NordGauntlet/done", ("end",)),
                       ("NordGauntlet/leg=S2-S9", None), ("Exec stat unit", None)):
        assert M.classify_event(text, LEGS) == kind, (text, M.classify_event(text, LEGS))
    print("profiler csv ok: warm-up, tail, legs, laps, holds")


def check_missing_columns():
    samples = M.read_fixture(FIXTURE)
    columns = ["FrameTime", "GameThreadTime", "RenderThreadTime", "EVENTS"]
    with tempfile.TemporaryDirectory() as tmp:
        analysis = M.analyze_csv(write(tmp, "nogpu.csv", profiler_csv([samples], columns=columns)), LOOP)
        assert analysis["missing_columns"] == ["RHIThreadTime", "GPUTime"], analysis["missing_columns"]
        assert analysis["all"]["gpu"] is None and analysis["all"]["rhi"] is None and analysis["all"]["frame"]["frames"] == 1000
        gates = M.native_gates(analysis, LOOP)
        values = M.native_values(analysis, gates)
        assert values["gpu_p95_ms"] is None and values["frame_p95_ms"] == EXPECTED["lap"]["p95_ms"]
        result = M.verdict(gates, values=values, missing_columns=analysis["missing_columns"])
        assert result["missing_columns"] == ["RHIThreadTime", "GPUTime"] and "gpu" not in M.native_report(analysis)
        # No EVENTS column: profile_package.py's fixed discard, and no per-leg values.
        plain = M.analyze_csv(write(tmp, "noevents.csv", profiler_csv([samples * 2], events=False, warm=0)), LOOP)
        assert plain["discarded"]["head"] == 600 and plain["frames"] == 2000 - 600 and plain["legs"] == {}
        assert any("no leg events" in note for note in plain["notes"])
        legs = [g for g in M.native_gates(plain, LOOP) if g["name"].startswith("frame_p95:")]
        assert len(legs) == 5 and all(g["result"] == "unverified" for g in legs)
        # No FrameTime column at all: nothing is measured, every frame gate is unverified.
        none = M.analyze_csv(write(tmp, "noframe.csv", "GPUTime,EVENTS\n1.0,\n"), LOOP)
        assert "FrameTime" in none["missing_columns"] and none["frames"] == 0
        assert all(g["result"] == "unverified" for g in M.native_gates(none, LOOP) if g["name"].startswith("frame_"))
    print("missing columns ok")


def check_hitch_rule():
    analysis = M.analyze_samples(M.read_fixture(FIXTURE), LOOP)
    rate, long_frames, passed = M.hitch_rule(analysis["all"]["frame"], LOOP)
    assert abs(rate - 6 * 30 / EXPECTED["lap"]["seconds"]) < 1e-9 and long_frames == 2 and passed is False
    # S5-S1 has a frame of exactly 66.7 ms, which is not a hitch.
    assert M.hitch_rule(analysis["legs"]["S5-S1"]["frame"], LOOP) == (0.0, 0, True)
    smooth = [20.0] * 1500
    assert M.hitch_rule(M.frame_stats(smooth + [70.0], LOOP), LOOP)[2] is True, "one hitch in 30 s is allowed"
    assert M.hitch_rule(M.frame_stats(smooth + [70.0, 70.0], LOOP), LOOP)[2] is False
    assert M.hitch_rule(M.frame_stats(smooth * 2 + [70.0, 70.0], LOOP), LOOP)[2] is True, "two in 60 s are allowed"
    assert M.hitch_rule(M.frame_stats(smooth * 4 + [251.0], LOOP), LOOP)[2] is False, "no frame over 250 ms"
    assert M.hitch_rule(M.frame_stats(smooth * 4 + [250.0], LOOP), LOOP)[2] is True
    assert M.hitch_rule(None, LOOP) == (None, None, None)
    print("hitch rule ok")


def smooth_run():
    """Five legs of 25 ms frames with a 30 ms tail: every native frame gate passes."""
    samples = [{"lap": 1, "leg": leg, "FrameTime": 25.0 if i % 20 else 30.0, "GPUTime": 14.0} for leg in LEGS for i in range(400)]
    return M.analyze_samples(samples, LOOP)


def check_gates():
    analysis = smooth_run()
    p95 = analysis["all"]["frame"]["p95_ms"]
    log = ("LogInit: Display: Engine is initialized.\n"
           f"LogTemp: Display: NORD_GAUNTLET summary leg=S1-S2 frames=400 p95_ms={p95:.3f}\n"
           f"LogTemp: Display: NORD_GAUNTLET summary frames=2000 seconds=51.000 p50_ms=25.000 p95_ms={p95 + .4:.3f}\n")
    args = dict(vram_mib={4242: 5100}, log_text=log, cvar_mismatches=[], readback={"t.MaxFPS": "60.000000"})
    gates = M.native_gates(analysis, LOOP, **args)
    assert [g["name"] for g in gates] == (["frame_p95"] + [f"frame_p95:{leg}" for leg in LEGS] +
                                          ["frame_p99", "slow_frames_percent", "hitches_per_30s", "long_frames", "vram_peak_mib",
                                           "render_log_errors", "cvar_mismatches", "fps_cap", "summary_p95_diff"])
    assert all(g["result"] == "pass" for g in gates), [g for g in gates if g["result"] != "pass"]
    values = M.native_values(analysis, gates)
    assert values == {"frame_p95_ms": 30.0, "gpu_p95_ms": 14.0, "hitches_ok": True, "vram_ok": True, "cvars_ok": True}, values
    passed = M.verdict(gates, values=values, report_only=M.native_report(analysis))
    assert passed["status"] == "pass" and passed["counts"] == {"pass": 15, "fail": 0, "unverified": 0}
    assert passed["report_only"]["gpu"]["p95_ms"] == 14.0 and "summary" not in passed
    by_name = lambda rows: {g["name"]: g for g in rows}
    # Fail: VRAM over 6,000 MiB, an error in the log, a CVar mismatch, a 30 FPS cap and a summary that disagrees.
    failing = by_name(M.native_gates(analysis, LOOP, vram_mib={1: 4000, 2: 6100},
                                     log_text=log.replace(f"{p95 + .4:.3f}", f"{p95 + 1.5:.3f}") + "LogWindows: Error: Fatal error!\n",
                                     cvar_mismatches=[{"name": "sg.ShadowQuality", "expected": "1", "actual": "3"}],
                                     readback={"t.MaxFPS": "30"}))
    for name, value in (("vram_peak_mib", 6100), ("render_log_errors", 1), ("cvar_mismatches", 1), ("fps_cap", 30.0)):
        assert failing[name]["result"] == "fail" and failing[name]["value"] == value, failing[name]
    assert failing["cvar_mismatches"]["note"] == "sg.ShadowQuality=3 (want 1)"
    assert failing["summary_p95_diff"]["result"] == "fail" and abs(failing["summary_p95_diff"]["value"] - 1.5) < 1e-6
    assert M.verdict(list(failing.values()))["status"] == "fail"
    # A frame budget failure: the fixture misses p95, p99, slow frames and the hitch rule.
    fixture = by_name(M.native_gates(M.analyze_samples(M.read_fixture(FIXTURE), LOOP), LOOP, **args))
    assert [n for n, g in fixture.items() if g["result"] == "fail"] == [
        "frame_p95", "frame_p95:S1-S2", "frame_p99", "slow_frames_percent", "hitches_per_30s", "long_frames", "summary_p95_diff"]
    assert fixture["frame_p95:S2-S3"]["result"] == "pass" and fixture["slow_frames_percent"]["value"] == 1.1
    # Unverified: a value the host did not give is never a pass.
    missing = M.native_gates(analysis, LOOP, log_text=log, readback={"t.MaxFPS": "60"})
    unverified = M.verdict(missing)
    assert unverified["status"] == "unverified" and unverified["summary"] == "unverified, not pass"
    assert {g["name"] for g in missing if g["result"] == "unverified"} == {"vram_peak_mib", "cvar_mismatches"}
    nothing = M.verdict(M.native_gates(None, LOOP))
    assert nothing["status"] == "unverified" and nothing["counts"]["pass"] == 0 and M.verdict([])["status"] == "unverified"
    # Contended: a foreign GPU process labels the run, whatever its gates say.
    foreign = M.foreign_processes([M.parse_gpu_processes("4242, /home/nord/Builds/Browser/Linux/Quebec/Binaries/Linux/Quebec, 5100\n"
                                                         "1234, /usr/lib/xorg/Xorg, 40\n7777, dota2, 3000\n")], {4242})
    assert [p["name"] for p in foreign] == ["dota2"]
    contended = M.verdict(gates, foreign=foreign)
    assert contended["status"] == "contended" and contended["contended_by"][0]["pid"] == 7777
    assert M.verdict(list(failing.values()), foreign=foreign)["status"] == "contended"
    assert M.parse_summaries(log)[1]["frames"] == 2000.0 and M.run_summary(M.parse_summaries(log))["frames"] == 2000.0
    print("gates ok: pass, fail, unverified, contended")


def check_stream_and_processes():
    log = "\n".join(f"LogTemp: Display: NORD_STREAM_FPS frames={frames} seconds=5.000 sleeping={asleep} streamer=NordHost"
                    for frames, asleep in ((300, 0), (296, 0), (151, 0), (12, 1)))
    windows = M.parse_stream_fps(log)
    assert [w["frames"] for w in windows] == [300, 296, 151] and len(M.parse_stream_fps(log, sleeping=True)) == 4
    assert windows[0]["streamer"] == "NordHost" and abs(windows[2]["fps"] - 30.2) < 1e-9
    # 60 FPS decoded frames with one 120 ms gap and one callback that missed a frame (two frames in 33.3 ms).
    frames, t = [], 0.0
    for presented in range(1, 601):
        if presented == 300:
            t += 120.0
        elif presented == 400:
            continue
        else:
            t += 1000 / 60
        frames.append({"presentedFrames": presented, "expectedDisplayTime": t})
    intervals = M.decoded_intervals(frames)
    assert intervals["frames"] == 599 and abs(intervals["longest_gap_ms"] - 120.0) < 1e-9
    assert abs(intervals["over_50ms_percent"] - 100 / 599) < 1e-9 and abs(intervals["p50_ms"] - 1000 / 60) < 1e-9
    summary = {"decodedFps": 59.4, "freezes": 0, "jitterBufferMsPerFrame": 43.1, "longestFrameGapMs": 90.0}
    good = M.stream_gates(LOOP, summary, intervals, windows[:2])
    assert all(g["result"] == "pass" for g in good), good
    bad = {g["name"]: g for g in M.stream_gates(LOOP, dict(summary, decodedFps=28.0, freezes=1, jitterBufferMsPerFrame=150.0),
                                                None, windows)}
    assert [n for n, g in bad.items() if g["result"] == "fail"] == ["decoded_fps_mean", "freezes", "jitter_buffer_ms_per_frame",
                                                                   "decoded_vs_native_fps"], bad
    assert bad["decoded_over_50ms_percent"]["result"] == "unverified" and bad["longest_gap_ms"]["value"] == 90.0
    assert bad["native_fps_min"]["result"] == "pass" and abs(bad["native_fps_min"]["value"] - 30.2) < 1e-9
    assert all(g["result"] == "unverified" for g in M.stream_gates(LOOP))
    # Delay stays apart and is never gated.
    delay = M.delay_section({"rttMs": 4.2, "averageJitterBufferDelayMs": 43.0})
    assert delay == {"label": M.DELAY_LABEL, "gated": False, "values": {"rttMs": 4.2, "averageJitterBufferDelayMs": 43.0}}
    # nvidia-smi: the compute query and the process table; the peak per game process.
    table = ("|    0   N/A  N/A      4242      G   ...Builds/Browser/Linux/Quebec/Binaries/Linux/Quebec     5312MiB |\n"
             "|    0   N/A  N/A      1201      G   /usr/lib/xorg/Xorg                                        212MiB |\n")
    rows = M.parse_gpu_processes(table)
    assert [(r["pid"], r["used_mib"], r["type"]) for r in rows] == [(4242, 5312, "G"), (1201, 212, "G")]
    assert M.peak_vram([rows, M.parse_gpu_processes("4242, Quebec, 5600\n")], {4242}) == {4242: 5600}
    assert M.peak_vram([rows], {99}) is None and M.foreign_processes([rows], {4242}) == []
    print("stream and processes ok")


def brute_ssim(x, y, size=11, sigma=1.5, k1=.01, k2=.03, data_range=255.0):
    """Wang et al. 2004 window by window with the 2-D Gaussian, for comparison with the separable version."""
    g = np.exp(-((np.arange(size) - (size - 1) / 2) ** 2) / (2 * sigma * sigma))
    w = np.outer(g, g)
    w /= w.sum()
    c1, c2 = (k1 * data_range) ** 2, (k2 * data_range) ** 2
    values = []
    for i in range(x.shape[0] - size + 1):
        for j in range(x.shape[1] - size + 1):
            a, b = x[i:i + size, j:j + size], y[i:i + size, j:j + size]
            ma, mb = (w * a).sum(), (w * b).sum()
            va, vb = (w * (a - ma) ** 2).sum(), (w * (b - mb) ** 2).sum()
            cov = (w * (a - ma) * (b - mb)).sum()
            values.append(((2 * ma * mb + c1) * (2 * cov + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2)))
    return float(np.mean(values))


def box_blur(image):
    padded = np.pad(image.astype(np.float64), 1, mode="edge")
    return sum(padded[i:i + image.shape[0], j:j + image.shape[1]] for i in range(3) for j in range(3)) / 9


def check_ssim():
    settings = LOOP["budgets"]["look"]["ssim"]
    assert (settings["window"], settings["sigma"], settings["k1"], settings["k2"], settings["channel"]) == (11, 1.5, .01, .03, "luma")
    rng = np.random.default_rng(7)
    yy, xx = np.mgrid[0:96, 0:128]
    image = np.clip(128 + 60 * np.sin(xx / 7.0) * np.cos(yy / 11.0) + rng.normal(0, 12, (96, 128)), 0, 255)
    assert M.ssim(image, image) == 1.0, "identical images give exactly 1"
    blurred = M.ssim(image, box_blur(image))
    assert 0.3 < blurred < 0.95, blurred
    assert M.ssim(image, np.clip(image + rng.normal(0, 3, image.shape), 0, 255)) > blurred, "slight noise beats a blur"
    assert abs(M.ssim(image, box_blur(image)) - M.ssim(box_blur(image), image)) < 1e-12, "SSIM is symmetric"
    small, other = image[:24, :31], box_blur(image)[:24, :31]
    assert abs(M.ssim(small, other) - brute_ssim(small, other)) < 1e-10, (M.ssim(small, other), brute_ssim(small, other))
    value, index = M.ssim(small, other, full=True)
    assert index.shape == (24 - 10, 31 - 10) and abs(value - index.mean()) < 1e-15
    # Two flat images: the structure terms are 1, so SSIM is (2ab + C1) / (a^2 + b^2 + C1).
    a, b, c1 = 100.0, 120.0, (0.01 * 255) ** 2
    flat = M.ssim(np.full((20, 20), a), np.full((20, 20), b))
    assert abs(flat - (2 * a * b + c1) / (a * a + b * b + c1)) < 1e-9, flat
    try:
        M.ssim(image, image[:, :-1])
        raise AssertionError("different sizes must be refused")
    except ValueError:
        pass
    assert abs(M.luma(np.array([[[255, 0, 0]]], dtype=np.uint8))[0, 0] - 76.245) < 1e-9
    with tempfile.TemporaryDirectory() as tmp:
        rgb = np.stack([image, image * .9, image * .7], axis=-1).astype(np.uint8)
        Image.fromarray(rgb).save(Path(tmp) / "a.png")
        Image.fromarray(rgb).save(Path(tmp) / "b.png")
        Image.fromarray(np.clip(box_blur(rgb[..., 0])[..., None].repeat(3, -1), 0, 255).astype(np.uint8)).save(Path(tmp) / "c.png")
        assert M.image_ssim(Path(tmp) / "a.png", Path(tmp) / "b.png", LOOP) == 1.0
        assert M.image_ssim(Path(tmp) / "a.png", Path(tmp) / "c.png", LOOP) < 1.0
    print(f"ssim ok: identity 1.0, 3x3 box blur {blurred:.4f}")


def check_flip():
    if importlib.util.find_spec("flip_evaluator") is None:
        assert M.flip_error(FIXTURE, FIXTURE) is None, "without flip-evaluator FLIP is skipped"
    calls = []
    fake = types.ModuleType("flip_evaluator")

    def evaluate(reference, test, dynamic_range, parameters):
        calls.append((reference.shape, reference.dtype, float(reference.max()), test.shape, dynamic_range, parameters))
        return np.full(reference.shape, .25, dtype=np.float32), 0.125, dict(parameters)

    fake.evaluate = evaluate
    real = sys.modules.get("flip_evaluator")
    sys.modules["flip_evaluator"] = fake
    try:
        with tempfile.TemporaryDirectory() as tmp:
            Image.fromarray(np.full((16, 20, 3), 255, dtype=np.uint8)).save(Path(tmp) / "a.png")
            Image.fromarray(np.full((16, 20, 3), 200, dtype=np.uint8)).save(Path(tmp) / "b.png")
            result = M.flip_error(Path(tmp) / "a.png", Path(tmp) / "b.png", 40, Path(tmp) / "map.png")
            assert result == {"mean": 0.125, "ppd": 40.0}
            assert calls == [((16, 20, 3), np.float32, 1.0, (16, 20, 3), "LDR", {"ppd": 40.0})], calls
            with Image.open(Path(tmp) / "map.png") as saved:
                assert saved.size == (20, 16) and saved.getpixel((0, 0)) == (64, 64, 64)
    finally:
        if real is None:
            sys.modules.pop("flip_evaluator", None)
        else:
            sys.modules["flip_evaluator"] = real
    print("flip ok: report-only call shape (LDR, 40 ppd)")


def check_review():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        rng = np.random.default_rng(3)
        rows = []
        for view in ("S1-eye", "S1-chase", "S2-eye"):
            base = np.clip(100 + rng.normal(0, 20, (40, 48, 3)), 0, 255).astype(np.uint8)
            paths = {}
            for kind, pixels in (("ceiling", base), ("baseline", base), ("candidate", np.clip(base.astype(int) + 10, 0, 255).astype(np.uint8)),
                                 ("stream", np.clip(base.astype(int) - 5, 0, 255).astype(np.uint8))):
                folder = tmp / "look" / kind
                folder.mkdir(parents=True, exist_ok=True)
                paths[kind] = folder / f"{view}-48x40.png"
                Image.fromarray(pixels).save(paths[kind])
            row = {"view": view, **{k: v for k, v in paths.items()}}
            if view != "S1-eye":
                row.pop("stream")
            if view == "S2-eye":
                row.pop("candidate")
            if view == "S1-eye":
                row["ceiling_repeat"] = 0.991
            rows.append(row)
        native = M.native_gates(smooth_run(), LOOP)
        verdict = M.verdict(native, report_only={"two_viewers": {"decodedFps": 17.2}}, delay=M.delay_section({"rttMs": 3.9}))
        page, scored = M.write_review(tmp / "run", rows, LOOP, verdict_data=verdict)
        text = page.read_text()
        assert text.count('<section class="row"') == 3
        for view in ("S1-eye", "S1-chase", "S2-eye"):
            assert f'data-view="{view}"' in text
        tiles = {row["view"]: row["tiles"] for row in scored}
        assert tiles["S1-eye"]["baseline"]["ssim"] == 1.0 and 0 < tiles["S1-eye"]["candidate"]["ssim"] < 1
        assert tiles["S1-eye"]["ceiling"]["ssim"] == 0.991 and "run-to-run SSIM 0.9910" in text
        assert "Baseline: SSIM 1.0000" in text and f"Candidate: SSIM {tiles['S1-eye']['candidate']['ssim']:.4f}" in text
        assert f"Decoded stream: SSIM {tiles['S1-eye']['stream']['ssim']:.4f}" in text
        assert text.count("Decoded stream: not captured") == 2 and "Candidate: not captured" in text
        # The A/B flip appears where both baseline and candidate exist, with links relative to review.html.
        assert text.count('class="flip"') == 2 and "A/B: needs baseline and candidate" in text
        assert 'data-a="../look/baseline/S1-eye-48x40.png" data-b="../look/candidate/S1-eye-48x40.png"' in text
        assert str(tmp) not in text, "links are relative"
        # The difference map is 4x the absolute luma difference: +10 on every channel shows as 40.
        diff = Path(tiles["S1-eye"]["candidate"]["diff"])
        assert diff.is_file() and diff.parent == tmp / "run" / "review" and f'src="review/{diff.name}"' in text
        with Image.open(diff) as image:
            pixels = np.asarray(image)
        assert pixels.ndim == 2 and int(np.median(pixels)) == 40, np.median(pixels)
        # No VRAM, log or readback was given, so the gate table shows the run as unverified.
        assert verdict["status"] == "unverified" and 'Gates: <span class="unverified">unverified</span>' in text
        assert "Report-only" in text and M.DELAY_LABEL in text and "never change the gate result" in text
        assert text.startswith("<!doctype html>") and "img.flip" in text and text.count("<script>") == 1
    print("review ok: 3 rows, SSIM per tile, 4x diff maps, A/B flip, delay section")


def main():
    check_fixture()
    check_profiler_csv()
    check_missing_columns()
    check_hitch_rule()
    check_gates()
    check_stream_and_processes()
    check_ssim()
    check_flip()
    check_review()
    print("NORD_GAUNTLET_METRICS_OK")


if __name__ == "__main__":
    main()
