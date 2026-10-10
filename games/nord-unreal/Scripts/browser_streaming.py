#!/usr/bin/env python3
"""Run NORD's temporary two-player Pixel Streaming host; Ctrl-C stops owned children."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time


PROJECT = Path(__file__).resolve().parents[1]
PACKAGE = PROJECT / "Builds/Browser/Linux"
BINARY = PACKAGE / "Quebec/Binaries/Linux/Quebec"
INFRA = PROJECT / "Saved/PixelStreamingInfrastructure"
INFRA_SHA = "e5e243ed038313d3dad4e3fb9087d4393a5df192"
SERVER = INFRA / "SignallingWebServer/dist/index.js"
OUT = PROJECT / "Saved/BrowserStreaming"
QUALITY = ",".join("sg." + name + "Quality 2" for name in (
    "ViewDistance", "AntiAliasing", "Shadow", "GlobalIllumination", "Reflection",
    "PostProcess", "Texture", "Effects", "Foliage")) + (
    ",sg.GlobalIlluminationQuality 1,sg.ReflectionQuality 1,sg.ShadowQuality 1,"
    "r.Shadow.Virtual.Enable 0,r.ScreenPercentage 75,t.MaxFPS 30,MediaIO.EnableExperimentalScheduling 0")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def is_rendered_unreal(comm, arguments):
    return (comm.startswith("UnrealEditor") or comm == "Quebec") and not any(
        argument.lower() == "-nullrhi" for argument in arguments)


def rendered_jobs():
    jobs = []
    for process in Path("/proc").iterdir():
        if not process.name.isdigit():
            continue
        comm = ""
        try:
            comm = (process / "comm").read_text().strip()
            arguments = (process / "cmdline").read_bytes().decode(errors="replace").split("\0")
        except (FileNotFoundError, ProcessLookupError):
            continue
        except PermissionError:
            require(not comm.startswith("UnrealEditor") and comm != "Quebec",
                    "Cannot inspect a running Unreal process; stop it before streaming.")
            continue
        if is_rendered_unreal(comm, arguments):
            jobs.append(f"{process.name}: {comm}")
    return jobs


def free_port(port, kind):
    with socket.socket(socket.AF_INET, kind) as probe:
        if kind == socket.SOCK_STREAM:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("0.0.0.0", port))
        except OSError as error:
            protocol = "TCP" if kind == socket.SOCK_STREAM else "UDP"
            raise RuntimeError(f"{protocol} port {port} is occupied or unavailable; preserve its existing service.") from error


def check_gpu_memory():
    require(shutil.which("nvidia-smi"), "This PC host requires the calibrated NVIDIA GPU and nvidia-smi.")
    free_mib = int(subprocess.check_output([
        "nvidia-smi", "--id=0", "--query-gpu=memory.free", "--format=csv,noheader,nounits"], text=True).strip())
    # shortcut: 12 GB reserves room for this two-process build; recalibrate after asset/hardware changes.
    require(free_mib >= 12000,
            f"Two browser players need at least 12000 MiB free GPU memory; only {free_mib} MiB is free. "
            "Close other GPU games/jobs before starting; no processes were launched.")


def preflight():
    require(sys.platform.startswith("linux"), "This helper targets the existing Linux package.")
    require(shutil.which("node") and shutil.which("git"), "Node.js and Git must be installed.")
    require((PACKAGE / "Quebec.sh").is_file() and BINARY.is_file() and os.access(BINARY, os.X_OK),
            "Build the executable Linux streaming package at Builds/Browser/Linux first.")
    require((PACKAGE / "Quebec/Content/Paks/Quebec-Linux.utoc").is_file(), "The streaming package is incomplete.")
    plugins = json.loads((PROJECT / "Quebec.uproject").read_text())["Plugins"]
    require(any(plugin["Name"] == "PixelStreaming2" and plugin.get("Enabled") for plugin in plugins),
            "Enable PixelStreaming2 and rebuild the package first.")
    require(SERVER.is_file(), "Prepare the pinned official signalling infrastructure; see Browser/HOSTING.md.")
    revision = subprocess.check_output(["git", "-C", str(INFRA), "rev-parse", "HEAD"], text=True).strip()
    require(revision == INFRA_SHA, f"Signalling checkout must be pinned to {INFRA_SHA}.")
    dirty = subprocess.check_output(["git", "-C", str(INFRA), "status", "--porcelain", "--untracked-files=no"], text=True)
    require(not dirty.strip(), "Signalling checkout has tracked modifications; preserve them and use the pinned clean checkout.")
    jobs = rendered_jobs()
    require(not jobs, "Rendered Unreal jobs are already running: " + ", ".join(jobs))
    check_gpu_memory()
    for port, kind in ((8888, socket.SOCK_STREAM), (9010, socket.SOCK_STREAM), (8889, socket.SOCK_STREAM), (7791, socket.SOCK_DGRAM)):
        free_port(port, kind)


def game_command(friend, log):
    # shortcut: VP8 avoids this PC's stalled H264 capture; retest hardware encoding after UE/driver upgrades.
    arguments = [str(BINARY), "Quebec", "127.0.0.1:7791" if friend else "/Game/Maps/LaFontaine?listen",
                 "-RenderOffscreen", "-ForceRes", "-ResX=1280", "-ResY=720", "-AudioMixer", "-Unattended", "-NoDebugExecBindings",
                 "-PixelStreamingConnectionURL=ws://127.0.0.1:8888", "-PixelStreamingEncoderCodec=VP8",
                 "-PixelStreamingWebRTCFps=30", "-PixelStreamingWebRTCMaxBitrate=12000000",
                 "-PixelStreamingWebRTCStartBitrate=8000000", "-PixelStreamingKeyFilter=Tilde", "-PixelStreamingID=" + ("NordFriend1" if friend else "NordHost"),
                 "-ExecCmds=" + QUALITY, "-abslog=" + str(log)]
    arguments += ["-NordNoCampaignSave", "-saveddirsuffix=BrowserGuest"] if friend else ["-port=7791"]
    return arguments


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / ".lifecycle.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("Another browser streaming lifecycle is already running.") from error
        preflight()
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime()) + f"-{os.getpid()}"
        ice = OUT / ("ice-" + stamp + ".json")
        ice.write_text(json.dumps({"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}))
        children = []
        logs = []
        state = {"launcher_pid": os.getpid(), "phase": "starting", "infrastructure_sha": INFRA_SHA, "children": []}
        state_path = OUT / "lifecycle.json"

        def record():
            temporary = state_path.with_suffix(".tmp")
            temporary.write_text(json.dumps(state, indent=2) + "\n")
            temporary.replace(state_path)

        def launch(name, command):
            stdout = OUT / (name + "-" + stamp + ".stdout.log")
            handle = stdout.open("w")
            logs.append(handle)
            child = subprocess.Popen(command, cwd=PROJECT, stdin=subprocess.DEVNULL, stdout=handle,
                                     stderr=subprocess.STDOUT, start_new_session=True)
            children.append(child)
            state["children"].append({"name": name, "pid": child.pid, "stdout": str(stdout)})
            record()

        def healthy():
            for child, entry in zip(children, state["children"]):
                require(child.poll() is None, f"{entry['name']} exited; inspect {entry['stdout']}.")

        def wait_for(predicate, description):
            deadline = time.monotonic() + 120
            while time.monotonic() < deadline:
                healthy()
                if predicate():
                    return
                time.sleep(.5)
            raise RuntimeError("Timed out waiting for " + description + "; inspect " + str(OUT))

        def signalling_ready():
            try:
                with socket.create_connection(("127.0.0.1", 9010), timeout=.5):
                    return True
            except OSError:
                return False

        def log_contains(path, text):
            return path.exists() and text in path.read_text(errors="replace")

        def interrupted(signum, frame):
            raise KeyboardInterrupt

        previous_handler = signal.signal(signal.SIGTERM, interrupted)
        try:
            launch("signalling", [shutil.which("node"), str(SERVER), "--no_config", "--streamer_port", "8888",
                   "--player_port", "9010", "--max_players", "1", "--peer_options_file", str(ice),
                   "--player_keepalive_timeout", "30000", "--log_level_console", "info", "--log_folder", str(OUT / "server-logs")])
            wait_for(signalling_ready, "signalling")
            host_log = OUT / ("host-" + stamp + ".log")
            launch("host", game_command(False, host_log))
            wait_for(lambda: log_contains(host_log, "IpNetDriver listening on port 7791"), "the native host")
            friend_log = OUT / ("friend-" + stamp + ".log")
            launch("friend", game_command(True, friend_log))
            wait_for(lambda: log_contains(friend_log, "Welcomed by server"), "the native friend connection")
            state["phase"] = "running"
            record()
            print("NORD host and friend are connected. Signalling: ws://127.0.0.1:9010", flush=True)
            print("Open the browser player to verify video and controls. Ctrl-C stops these three owned processes.", flush=True)
            while True:
                healthy()
                time.sleep(1)
        except KeyboardInterrupt:
            print("Stopping the owned NORD streaming processes…", flush=True)
        finally:
            previous_interrupt = signal.signal(signal.SIGINT, signal.SIG_IGN)
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            for child in reversed(children):
                if child.poll() is None:
                    try:
                        os.killpg(child.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        continue
                    try:
                        child.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait(timeout=5)
            for handle in logs:
                handle.close()
            state["phase"] = "stopped"
            record()
            signal.signal(signal.SIGTERM, previous_handler)
            signal.signal(signal.SIGINT, previous_interrupt)


def self_check():
    from unittest.mock import patch

    assert is_rendered_unreal("Quebec", ["Quebec", "-RenderOffscreen"])
    assert is_rendered_unreal("UnrealEditor-Cm", ["UnrealEditor-Cmd", "-RenderOffscreen"])
    assert not is_rendered_unreal("Quebec", ["Quebec", "-NuLlRhI"])
    assert not is_rendered_unreal("bash", ["bash", "UnrealEditor"])
    host, friend = game_command(False, Path("host.log")), game_command(True, Path("friend.log"))
    assert "/Game/Maps/LaFontaine?listen" in host and "-port=7791" in host
    assert "127.0.0.1:7791" in friend and "-NordNoCampaignSave" in friend
    assert "-NordNoCampaignSave" not in host and "-saveddirsuffix=BrowserGuest" in friend
    assert all("-NoDebugExecBindings" in command for command in (host, friend))
    assert all("-PixelStreamingKeyFilter=Tilde" in command for command in (host, friend))
    with patch("shutil.which", return_value="/usr/bin/nvidia-smi"):
        with patch("subprocess.check_output", return_value="13000\n"):
            check_gpu_memory()
        with patch("subprocess.check_output", return_value="9500\n"):
            try:
                check_gpu_memory()
            except RuntimeError as error:
                assert "only 9500 MiB" in str(error)
            else:
                raise AssertionError("Insufficient GPU memory must prevent launch")
    for kind in (socket.SOCK_STREAM, socket.SOCK_DGRAM):
        with socket.socket(socket.AF_INET, kind) as occupied:
            occupied.bind(("127.0.0.1", 0))
            try:
                free_port(occupied.getsockname()[1], kind)
            except RuntimeError:
                pass
            else:
                raise AssertionError("Occupied ports must be rejected")
    print("Self-check passed: rendered job/GPU memory guards, separate players/save ownership, occupied-port rejection.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("run", "check", "self-check"))
    args = parser.parse_args()
    try:
        if args.command == "self-check":
            self_check()
        elif args.command == "check":
            preflight()
            print("Preflight passed; no processes launched.")
        else:
            run()
    except (RuntimeError, OSError, subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f"NORD streaming: {error}\n")
