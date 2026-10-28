"""Bounded VibeUE API/trace smoke check in the isolated NullRHI host."""
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import unreal


host = Path.home() / ".local/share/nord-tools/vibeue-pilot/HostProject"
project = Path(unreal.Paths.project_dir()).resolve()
assert project == host.resolve(), f"Refusing a smoke check in {project}; expected {host}"

report = {
    "passed": False,
    "scope": "Isolated NullRHI API/trace lifecycle; no rendered performance or MCP endpoint acceptance",
    "upstreamCommit": "dc051be7c49b08e613ca7a2196fe9f39c9b52119",
}
stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
output = host / "Saved/Tests/VibeUE" / f"smoke-{stamp}.json"
trace_owned = False
try:
    environment = report["environment"] = json.loads(unreal.WorkflowService.get_environment())
    assert Path(environment["projectFile"]).resolve() == host / "HostProject.uproject"
    assert environment["engineVersion"].startswith("5.8.3")
    assert any(plugin["name"] == "VibeUE" for plugin in environment["enabledPlugins"])

    timing = report["frameTiming"] = json.loads(unreal.PerformanceService.frame_timing(60.0))
    assert timing["success"] is True
    assert timing["gpu_ms"] == 0, "This smoke check must run with -NullRHI"
    assert timing["pie_running"] is False
    assert timing["budget"]["target_fps"] == 60.0
    state = unreal.TransactionService.get_state()
    report["transactions"] = {"undoCount": state.undo_count, "redoCount": state.redo_count}
    assert state.undo_count >= 0 and state.redo_count >= 0

    trace = report["traceBefore"] = json.loads(unreal.PerformanceService.get_trace_status())
    assert trace["success"] is True and trace["tracing"] is False
    start = report["traceStart"] = json.loads(unreal.PerformanceService.start_trace(f"smoke-{stamp}", "frame,cpu,log,bookmark"))
    trace_owned = start["success"] is True
    assert trace_owned
    report["bookmark"] = json.loads(unreal.PerformanceService.bookmark("isolated-nullrhi-smoke"))
    report["syntheticChecksum"] = sum(i * i for i in range(100000))
    trace_path = Path(start["trace_file"])
    deadline = time.monotonic() + 5.0
    # StopTrace immediately checks file size; allow the trace writer to create it first.
    while not trace_path.exists() or trace_path.stat().st_size == 0:
        assert time.monotonic() < deadline, "Trace writer did not create a nonempty file"
        time.sleep(0.05)
    stopped = report["traceStop"] = json.loads(unreal.PerformanceService.stop_trace())
    trace_owned = False
    assert stopped["success"] is True
    assert Path(stopped["trace_file"]).stat().st_size > 0
    time.sleep(0.2)
    analysis = report["traceAnalysis"] = json.loads(unreal.PerformanceService.analyse("trace", stopped["trace_file"]))
    assert analysis["success"] is True
    after = report["traceAfter"] = json.loads(unreal.PerformanceService.get_trace_status())
    assert after["tracing"] is False
    report["passed"] = True
except Exception as error:
    report["error"] = repr(error)
    raise
finally:
    if trace_owned:
        report["traceCleanup"] = json.loads(unreal.PerformanceService.stop_trace())
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    unreal.log(f"NORD_VIBEUE_SMOKE_{'PASSED' if report['passed'] else 'FAILED'} {output}")
