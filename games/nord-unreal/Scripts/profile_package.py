"""Measure uncapped, warmed packaged Vulkan frames in three scenes at two desktop sizes."""
import csv
import json
import math
import os
from pathlib import Path
import re
import signal
import statistics
import struct
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "Builds/Linux/Quebec.sh"
CSV_DIR = ROOT / "Builds/Linux/Quebec/Saved/Profiling/CSV"
OUT = ROOT / "Saved/Tests/Performance"
OUT.mkdir(parents=True, exist_ok=True)
layout = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())
scenes = [("Sherbrooke", layout["spawn"], 77.5), ("Pond", layout["missions"][0], 180),
          ("NorthPark", layout["missions"][2], 0)]
report = {"passed": False, "hardware": {},
          "settings": "Epic (3), 100% screen percentage, VSync off, uncapped, comic on",
          "method": "3000 CSV frames per scene; discard first 600 and final 2; screenshot before warmup ends",
          "limits": ["static camera scenes", "one GPU", "not external multiplayer performance"], "scenes": []}
csv.field_size_limit(10000000)


def percentile(values, fraction):
    return sorted(values)[math.ceil((len(values) - 1) * fraction)]


assert percentile([4, 1, 3, 2], .95) == 4
try:
    with tempfile.TemporaryDirectory(prefix="nord-Binaries-perf-") as directory:
        for width, height in ((1280, 720), (1920, 1080)):
            for name, position, yaw in scenes:
                tag = f"{name}{width}"
                screenshot = ROOT / "Preview" / ("Performance" + tag + ".png")
                screenshot.unlink(missing_ok=True)
                macro = Path(directory) / (tag + ".txt")
                macro.write_text('ke QuebecCharacter K2_SetActorLocation "(X=%s,Y=%s,Z=%s)" false () true\n'
                                 'ke QuebecController SetControlRotation "(Pitch=-12,Yaw=%s,Roll=0)"\n' % (*position, yaw))
                log_path = OUT / (tag + ".log")
                with (OUT / (tag + ".stdout.log")).open("w") as output:
                    process = subprocess.Popen(["bash", str(RUNNER), "/Game/Maps/LaFontaine", "-RenderOffscreen", "-windowed", "-ForceRes",
                        f"-ResX={width}", f"-ResY={height}", "-NordNoCampaignSave", "-unattended", "-nosound", "-csvGpuStats", "-csvCompression=0",
                        "-csvCaptureFrames=3000", "-ExitAfterCsvProfiling",
                        f"-ExecCmds=Scalability 3,t.MaxFPS 0,r.VSync 0,r.ScreenPercentage 100,r.SetRes {width}x{height}w",
                        f'-csvExecCmds=60:exec {macro},180:shot showui -nosuffix filename={screenshot}', "-abslog=" + str(log_path)],
                        stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
                    try:
                        assert process.wait(timeout=180) == 0, tag
                    finally:
                        if process.poll() is None:
                            os.killpg(process.pid, signal.SIGKILL)
                            process.wait(timeout=10)
                text = log_path.read_text(errors="replace")
                assert not re.search(r"Fatal error|Assertion failed|Bad or missing property|Can't find file", text), tag
                assert struct.unpack(">II", screenshot.read_bytes()[16:24]) == (width, height), "Actual viewport size differs: " + tag
                files = re.findall(r"Writing CSV to file : [^\r\n]*/([^/\r\n]+\.csv)", text)
                assert len(files) == 1, files
                source = CSV_DIR / files[0]
                with source.open() as stream:
                    rows = list(csv.reader(stream))
                header = rows[0]
                metadata = rows[-1]
                hardware = {key: metadata[metadata.index("[" + key + "]") + 1]
                            for key in ("platform", "cpu", "gpu", "gpudriver", "engineversion", "shaderplatform")}
                assert not report["hardware"] or report["hardware"] == hardware, "Hardware changed during profiling"
                report["hardware"] = hardware
                # CSV metadata/footer rows have no numeric FrameTime; added trailing columns do not move existing stats.
                frames = [row for row in rows[1:] if len(row) > header.index("GPUTime") and re.fullmatch(r"[\d.]+", row[header.index("FrameTime")])]
                assert len(frames) >= 2990, (tag, len(frames))
                sample = frames[600:-2]
                timings = [float(row[header.index("FrameTime")]) for row in sample]
                gpu = [float(row[header.index("GPUTime")]) for row in sample]
                assert min(timings) > 0 and statistics.median(gpu) > 0, tag
                result = {"scene": name, "resolution": [width, height], "frames": len(sample),
                          "sample_seconds": round(sum(timings) / 1000, 2),
                          "median_ms": round(statistics.median(timings), 2), "p95_ms": round(percentile(timings, .95), 2),
                          "p99_ms": round(percentile(timings, .99), 2), "average_fps": round(1000 / statistics.mean(timings), 1),
                          "over_33ms_percent": round(sum(v > 33.33 for v in timings) * 100 / len(timings), 2),
                          "median_gpu_ms": round(statistics.median(gpu), 2), "csv": source.name,
                          "screenshot": str(screenshot.relative_to(ROOT))}
                result["frame_budget_passed"] = result["p95_ms"] < 16.67
                report["scenes"].append(result)
                print("NORD_PERFORMANCE", json.dumps(result), flush=True)
    report["passed"] = len(report["scenes"]) == 6 and all(scene["frame_budget_passed"] for scene in report["scenes"])
    assert report["passed"], "Reference-scene 60 FPS frame-time budget failed; see all six measured scenes"
finally:
    (ROOT / "Verification/Performance.json").write_text(json.dumps(report, indent=2) + "\n")
