#!/usr/bin/env python3
"""Run NORD's temporary two-player Pixel Streaming host; Ctrl-C stops owned children."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit


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
    "r.Shadow.Virtual.Enable 0,r.ScreenPercentage 75,t.MaxFPS 60")
# The mobile gauntlet (Scripts/gauntlet_loop.py) writes here; NORD_STREAM_QUALITY=file: and NORD_STREAM_GAUNTLET
# accept paths in this folder only. The phone profile is opt-in until the user approves paired captures.
GAUNTLET = PROJECT / "Saved/Gauntlet"
PHONE_PROFILE = "NordPhoneStream"
# A candidate file holds only "cvar number" pairs with dotted CVar names, so it cannot run a console command.
CANDIDATE_PAIR = re.compile(r"[A-Za-z]\w*(?:\.\w+)+ [+-]?\d+(?:\.\d+)?")


# The public host runs the live sky. A QA lifecycle may pin it, for example
# NORD_SKY_ARGS="-NordFixedSky" (the authored afternoon) or
# NORD_SKY_ARGS="-NordHour=15 -NordWeather=Clear -NordFreezeTime -NordFreezeWeather".
# Only these host flags are accepted; the friend shows the host's replicated sky.
SKY_ARGUMENT = re.compile(r"-Nord(?:FixedSky|DynamicSky|FreezeTime|FreezeWeather|Hour=\d{1,2}(?:\.\d+)?|DayMinutes=\d{1,3}(?:\.\d+)?"
                          r"|SkySeed=\d{1,10}|Weather=(?:Clear|Breezy|Overcast|Fog|Drizzle|Rain))", re.IGNORECASE)


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


def load_ice_config():
    configured = os.environ.get("NORD_ICE_CONFIG")
    if configured is None:
        return {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
    require(bool(configured), "NORD_ICE_CONFIG must name a readable JSON file.")
    try:
        options = json.loads(Path(configured).expanduser().read_text())
    except (OSError, ValueError) as error:
        raise RuntimeError("NORD_ICE_CONFIG must name a readable JSON file.") from error
    require(isinstance(options, dict) and isinstance(options.get("iceServers"), list) and options["iceServers"],
            "NORD_ICE_CONFIG must contain an object with nonempty iceServers.")
    require(options.get("iceTransportPolicy", "all") in ("all", "relay"),
            "NORD_ICE_CONFIG iceTransportPolicy must be all or relay.")
    for server in options["iceServers"]:
        require(isinstance(server, dict), "NORD_ICE_CONFIG iceServers entries must be objects.")
        urls = server.get("urls")
        urls = [urls] if isinstance(urls, str) else urls
        require(isinstance(urls, list) and urls, "NORD_ICE_CONFIG servers need nonempty urls.")
        for url in urls:
            require(isinstance(url, str) and not any(character.isspace() for character in url),
                    "NORD_ICE_CONFIG urls must be valid STUN or TURN addresses.")
            try:
                parsed = urlsplit(url)
                address = urlsplit("//" + parsed.path)
                port = address.port
            except ValueError as error:
                raise RuntimeError("NORD_ICE_CONFIG urls must be valid STUN or TURN addresses.") from error
            turn = parsed.scheme in ("turn", "turns")
            require(parsed.scheme in ("stun", "stuns", "turn", "turns") and address.hostname
                    and not parsed.netloc and not parsed.fragment and not address.path
                    and address.username is None and address.password is None and port != 0
                    and parsed.query in (("", "transport=udp", "transport=tcp") if turn else ("",)),
                    "NORD_ICE_CONFIG urls must be valid STUN or TURN addresses.")
            if turn:
                require(all(isinstance(server.get(key), str) and server[key].strip()
                            for key in ("username", "credential")) and server.get("credentialType", "password") == "password",
                        "NORD_ICE_CONFIG TURN servers need a username and password credential.")
    return options


def preflight():
    ice_config = load_ice_config()
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
    return ice_config


def sky_arguments():
    arguments = os.environ.get("NORD_SKY_ARGS", "-NordHour=15 -NordFreezeTime").split()
    for argument in arguments:
        require(SKY_ARGUMENT.fullmatch(argument), "NORD_SKY_ARGS accepts only -NordFixedSky, -NordDynamicSky, -NordFreezeTime, "
                "-NordFreezeWeather, -NordHour=, -NordDayMinutes=, -NordSkySeed= and -NordWeather=; rejected " + repr(argument))
    return arguments


def stream_settings():
    flags = os.environ.get("NORD_STREAM_FLAGS", "idle").split()
    require(len(flags) == len(set(flags)) and set(flags) <= {"idle", "windowed"},
            "NORD_STREAM_FLAGS accepts idle and windowed, separated by spaces.")
    bitrate = os.environ.get("NORD_STREAM_BITRATE", "2000000,100000,12000000")
    require(re.fullmatch(r"[0-9]+,[0-9]+,[0-9]+", bitrate) is not None,
            "NORD_STREAM_BITRATE must be start,min,max in bit/s.")
    start, minimum, maximum = map(int, bitrate.split(","))
    require(100000 <= minimum <= start <= maximum <= 12000000,
            "NORD_STREAM_BITRATE requires 100000 <= min <= start <= max <= 12000000.")
    scheduling = os.environ.get("NORD_STREAM_SCHEDULING", "0")
    require(scheduling in ("0", "1"), "NORD_STREAM_SCHEDULING must be 0 or 1.")
    return {"flags": flags, "start_bitrate": start, "min_bitrate": minimum, "max_bitrate": maximum,
            "scheduling": int(scheduling)}


def stream_quality(value=None):
    """NORD_STREAM_QUALITY for both players: current (QUALITY, the default), phone (the NordPhoneStream device profile
    in Config/DefaultDeviceProfiles.ini) or file:<path> (a gauntlet candidate .execcmds file under Saved/Gauntlet)."""
    value = os.environ.get("NORD_STREAM_QUALITY", "current") if value is None else value
    if value == "current":
        return {"name": "current", "execcmds": QUALITY}
    if value == "phone":
        # -DeviceProfile= is written from memory of the engine: unverified until the host reads every CVar back.
        quality_cvars({"device_profile": PHONE_PROFILE})
        return {"name": "phone", "device_profile": PHONE_PROFILE}
    path = Path(value[5:]).expanduser().resolve() if value.startswith("file:") and value[5:].strip() else None
    require(path is not None and path.suffix == ".execcmds" and GAUNTLET.resolve() in path.parents and path.is_file(),
            "NORD_STREAM_QUALITY accepts current, phone or file:<path> naming a candidate .execcmds file under "
            "Saved/Gauntlet; rejected " + repr(value))
    text = path.read_text().strip()
    pairs = text.split(",")
    require(all(CANDIDATE_PAIR.fullmatch(pair) for pair in pairs) and dict(pair.split(" ") for pair in pairs).get("t.MaxFPS") == "60",
            "NORD_STREAM_QUALITY file: must hold comma-separated 'cvar number' pairs that keep t.MaxFPS 60.")
    return {"name": "file", "path": str(path), "execcmds": text}


def quality_cvars(quality):
    """The CVars a stream quality sets (later entries win), which a gauntlet run reads back."""
    import gauntlet_tune
    if "device_profile" in quality:
        ini = gauntlet_tune.PROFILES_INI
        profile = gauntlet_tune.read_profile(ini.read_text(), quality["device_profile"]) if ini.is_file() else None
        require(profile is not None and profile["listed"] and profile["cvars"],
                f"NORD_STREAM_QUALITY=phone needs a listed [{quality['device_profile']} DeviceProfile] in Config/DefaultDeviceProfiles.ini.")
        return profile["cvars"]
    return gauntlet_tune.parse_execcmds(quality["execcmds"])


def gauntlet_expect(quality):
    """The -NordGauntletExpect= file text for a stream quality: one name=value line per CVar."""
    import gauntlet_tune
    return gauntlet_tune.expect_text({"id": "stream-" + quality["name"], "cvars": quality_cvars(quality)})


def gauntlet_run():
    """NORD_STREAM_GAUNTLET=<run dir>: NordHost drives the gauntlet loop in stream mode and writes into that folder under
    Saved/Gauntlet. A comparable run needs the sky pinned, so -NordHour= and -NordWeather= must be in NORD_SKY_ARGS. It
    also needs NordFriend1 asleep, so NORD_STREAM_FLAGS must keep idle (-NordIdleThrottle): without it NordFriend1 never
    sleeps, and every gauntlet row with one viewer would read contended."""
    value = os.environ.get("NORD_STREAM_GAUNTLET")
    if value is None:
        return None
    run = Path(value).expanduser().resolve()
    require(bool(value.strip()) and GAUNTLET.resolve() in run.parents, "NORD_STREAM_GAUNTLET must name a run folder under Saved/Gauntlet.")
    sky = [argument.lower() for argument in sky_arguments()]
    require(any(argument.startswith("-nordhour=") for argument in sky) and any(argument.startswith("-nordweather=") for argument in sky),
            "NORD_STREAM_GAUNTLET needs a pinned sky: put -NordHour= and -NordWeather= in NORD_SKY_ARGS.")
    require("idle" in stream_settings()["flags"],
            "NORD_STREAM_GAUNTLET needs NordFriend1 asleep: keep idle in NORD_STREAM_FLAGS, or leave it unset.")
    return run


def gauntlet_flags(run):
    """NordHost's gauntlet flags and world flags from Data/Gauntlet/loop.json, plus the CSV profiler's GPU stats."""
    loop = json.loads((PROJECT / "Data/Gauntlet/loop.json").read_text())
    flag = loop["gauntlet_flags"]
    return [flag["enable"], flag["mode"] + "stream", flag["run"] + str(run), flag["expect"] + str(run / "stream.expect"),
            "-csvGpuStats", "-csvCompression=0", *loop["world_flags"]["all"]]


def game_command(friend, log):
    settings = stream_settings()
    quality = stream_quality()
    # shortcut: VP8 avoids this PC's stalled H264 capture; retest hardware encoding after UE/driver upgrades.
    arguments = [str(BINARY), "Quebec", "127.0.0.1:7791" if friend else "/Game/Maps/LaFontaine?listen",
                 "-RenderOffscreen", "-ForceRes", "-ResX=1280", "-ResY=720", "-AudioMixer", "-Unattended", "-NoDebugExecBindings",
                 "-PixelStreamingConnectionURL=ws://127.0.0.1:8888", "-PixelStreamingEncoderCodec=VP8",
                 "-PixelStreamingWebRTCFps=60", f"-PixelStreamingWebRTCMaxBitrate={settings['max_bitrate']}",
                 f"-PixelStreamingWebRTCMinBitrate={settings['min_bitrate']}",
                 f"-PixelStreamingWebRTCStartBitrate={settings['start_bitrate']}", "-PixelStreamingKeyFilter=Tilde", "-PixelStreamingID=" + ("NordFriend1" if friend else "NordHost"),
                 *(["-DeviceProfile=" + quality["device_profile"]] if "device_profile" in quality else []),
                 "-ExecCmds=" + (quality["execcmds"] + "," if "execcmds" in quality else "")
                 + f"MediaIO.EnableExperimentalScheduling {settings['scheduling']}", "-abslog=" + str(log)]
    arguments += ["-NordStreamFps", "-NordTouchControls"] + [{"idle": "-NordIdleThrottle", "windowed": "-windowed"}[flag] for flag in settings["flags"]]
    arguments += ["-NordNoCampaignSave", "-saveddirsuffix=BrowserGuest"] if friend else ["-port=7791", *sky_arguments()]
    gauntlet = None if friend else gauntlet_run()
    return arguments + (gauntlet_flags(gauntlet) if gauntlet else [])


def run():
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / ".lifecycle.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError("Another browser streaming lifecycle is already running.") from error
        settings = stream_settings()
        quality, gauntlet = stream_quality(), gauntlet_run()
        ice_config = preflight()
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime()) + f"-{os.getpid()}"
        ice = OUT / ("ice-" + stamp + ".json")
        with os.fdopen(os.open(ice, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as handle:
            json.dump(ice_config, handle)
        host_log = OUT / ("host-" + stamp + ".log")
        if gauntlet:
            gauntlet.mkdir(parents=True, exist_ok=True)
            (gauntlet / "stream.expect").write_text(gauntlet_expect(quality))
        children = []
        logs = []
        state = {"launcher_pid": os.getpid(), "phase": "starting", "infrastructure_sha": INFRA_SHA,
                 "stream_settings": settings, "stream_quality": quality,
                 "gauntlet": None if gauntlet is None else {"run": str(gauntlet), "host_log": str(host_log),
                                                            "expect": str(gauntlet / "stream.expect"), "sky": sky_arguments()},
                 "children": []}
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
    from tempfile import TemporaryDirectory
    from unittest.mock import patch

    with patch.dict(os.environ, {}, clear=True):
        assert load_ice_config() == {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
    with TemporaryDirectory() as directory:
        path = Path(directory) / "ice.json"
        valid = {"iceServers": [{"urls": ["stun:stun.example:3478", "stuns:stun.example:5349"]},
                                {"urls": "turns:relay.example:8443?transport=tcp", "username": "test-user",
                                 "credential": "test-password"}], "iceTransportPolicy": "relay"}
        with patch.dict(os.environ, {"NORD_ICE_CONFIG": str(path)}):
            path.write_text(json.dumps(valid))
            assert load_ice_config() == valid
            invalid = [None, "{", "[]", '{}', '{"iceServers": []}',
                       json.dumps({"iceServers": [{"urls": "https://relay.example"}]}),
                       json.dumps({"iceServers": [{"urls": "turns:relay.example:8443?transport=tcp"}]}),
                       json.dumps({"iceServers": [{"urls": "stun:relay.example:99999"}]}),
                       json.dumps({"iceServers": [{"urls": [42]}]}),
                       json.dumps({**valid, "iceTransportPolicy": "invalid"})]
            for contents in invalid:
                if contents is None:
                    path.unlink()
                else:
                    path.write_text(contents)
                try:
                    load_ice_config()
                except RuntimeError as error:
                    assert "NORD_ICE_CONFIG" in str(error) and "test-password" not in str(error)
                else:
                    raise AssertionError("Invalid ICE configuration must prevent launch")
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
    with patch.dict(os.environ, {}, clear=True):
        assert [argument for argument in game_command(False, Path("host.log")) if argument.lower().startswith("-nord")] == ["-NordStreamFps", "-NordTouchControls", "-NordIdleThrottle", "-NordHour=15", "-NordFreezeTime"]
        assert stream_settings() == {"flags": ["idle"], "start_bitrate": 2000000, "min_bitrate": 100000,
                                     "max_bitrate": 12000000, "scheduling": 0}
    with patch.dict(os.environ, {"NORD_STREAM_BITRATE": "1000000,300000,4000000", "NORD_STREAM_SCHEDULING": "1"}):
        for friend_slot in (False, True):
            command = game_command(friend_slot, Path("test.log"))
            assert "-PixelStreamingWebRTCStartBitrate=1000000" in command
            assert "-PixelStreamingWebRTCMinBitrate=300000" in command
            assert "-PixelStreamingWebRTCMaxBitrate=4000000" in command
            assert any(argument.endswith("MediaIO.EnableExperimentalScheduling 1") for argument in command)
    for variable, values in {
        "NORD_STREAM_FLAGS": ("idle idle", "budget", "idle;quit"),
        "NORD_STREAM_BITRATE": ("", "1,2", "a,b,c", "300000,1000000,4000000", "1000000,300000,13000000", "1000000,99999,4000000", "1e6,300000,4000000", "1000000,300000,4000000;quit"),
        "NORD_STREAM_SCHEDULING": ("", "2", "0,quit")
    }.items():
        for value in values:
            with patch.dict(os.environ, {variable: value}):
                try:
                    stream_settings()
                except RuntimeError as error:
                    assert variable in str(error)
                else:
                    raise AssertionError("Invalid stream option must prevent launch: " + variable)
    for flags in ("", "idle", "windowed", "idle windowed", "windowed idle"):
        with patch.dict(os.environ, {"NORD_STREAM_FLAGS": flags}):
            for friend_slot in (False, True):
                command = game_command(friend_slot, Path("test.log"))
                assert ("-NordIdleThrottle" in command) == ("idle" in flags)
                assert ("-windowed" in command) == ("windowed" in flags)
    pinned = "-NordHour=15 -NordWeather=Clear -NordFreezeTime -NordFreezeWeather"
    with patch.dict(os.environ, {"NORD_SKY_ARGS": pinned}):
        assert game_command(False, Path("host.log"))[-4:] == pinned.split()
        assert not set(pinned.split()) & set(game_command(True, Path("friend.log")))
    for rejected in ("-NordHour=15 -ExecCmds=quit", "-NordWeather=Hail", "-NordHour=15;quit", "NordFixedSky", "-NordCapture"):
        with patch.dict(os.environ, {"NORD_SKY_ARGS": rejected}):
            try:
                game_command(False, Path("host.log"))
            except RuntimeError as error:
                assert "NORD_SKY_ARGS" in str(error)
            else:
                raise AssertionError("Unsupported sky arguments must prevent launch: " + rejected)
    # Without NORD_STREAM_QUALITY (or with current) both players keep today's launch line byte for byte.
    today_quality = ("sg.ViewDistanceQuality 2,sg.AntiAliasingQuality 2,sg.ShadowQuality 2,sg.GlobalIlluminationQuality 2,"
                     "sg.ReflectionQuality 2,sg.PostProcessQuality 2,sg.TextureQuality 2,sg.EffectsQuality 2,sg.FoliageQuality 2,"
                     "sg.GlobalIlluminationQuality 1,sg.ReflectionQuality 1,sg.ShadowQuality 1,r.Shadow.Virtual.Enable 0,"
                     "r.ScreenPercentage 75,t.MaxFPS 60,MediaIO.EnableExperimentalScheduling 0")
    common = ["-RenderOffscreen", "-ForceRes", "-ResX=1280", "-ResY=720", "-AudioMixer", "-Unattended", "-NoDebugExecBindings",
              "-PixelStreamingConnectionURL=ws://127.0.0.1:8888", "-PixelStreamingEncoderCodec=VP8", "-PixelStreamingWebRTCFps=60",
              "-PixelStreamingWebRTCMaxBitrate=12000000", "-PixelStreamingWebRTCMinBitrate=100000",
              "-PixelStreamingWebRTCStartBitrate=2000000", "-PixelStreamingKeyFilter=Tilde"]
    today = {False: [str(BINARY), "Quebec", "/Game/Maps/LaFontaine?listen", *common, "-PixelStreamingID=NordHost",
                     "-ExecCmds=" + today_quality, "-abslog=host.log", "-NordStreamFps", "-NordTouchControls", "-NordIdleThrottle",
                     "-port=7791", "-NordHour=15", "-NordFreezeTime"],
             True: [str(BINARY), "Quebec", "127.0.0.1:7791", *common, "-PixelStreamingID=NordFriend1", "-ExecCmds=" + today_quality,
                    "-abslog=friend.log", "-NordStreamFps", "-NordTouchControls", "-NordIdleThrottle", "-NordNoCampaignSave",
                    "-saveddirsuffix=BrowserGuest"]}
    for environment in ({}, {"NORD_STREAM_QUALITY": "current"}):
        with patch.dict(os.environ, environment, clear=True):
            for friend_slot, line in today.items():
                assert game_command(friend_slot, Path("friend.log" if friend_slot else "host.log")) == line, environment
    assert "t.MaxFPS=60\n" in gauntlet_expect(stream_quality("current"))

    def refused(variable, environment):
        with patch.dict(os.environ, environment, clear=True):
            try:
                game_command(False, Path("host.log"))
            except RuntimeError as error:
                assert variable in str(error), error
            else:
                raise AssertionError(f"{variable} must prevent launch: {environment}")

    with TemporaryDirectory() as directory, patch.object(sys.modules[__name__], "GAUNTLET", Path(directory) / "Saved/Gauntlet"):
        gauntlet = Path(directory) / "Saved/Gauntlet"
        candidate = gauntlet / "20261023T220000Z-tune/candidates/05-gi1.execcmds"
        candidate.parent.mkdir(parents=True)
        candidate.write_text("sg.GlobalIlluminationQuality 2,r.ScreenPercentage 85,t.MaxFPS 60")
        with patch.dict(os.environ, {"NORD_STREAM_QUALITY": f"file:{candidate}"}, clear=True):
            for friend_slot in (False, True):
                command = game_command(friend_slot, Path("test.log"))
                assert ("-ExecCmds=sg.GlobalIlluminationQuality 2,r.ScreenPercentage 85,t.MaxFPS 60,"
                        "MediaIO.EnableExperimentalScheduling 0") in command
                assert not any(argument.startswith("-DeviceProfile=") for argument in command)
        with patch.dict(os.environ, {"NORD_STREAM_QUALITY": "phone"}, clear=True):
            for friend_slot in (False, True):
                command = game_command(friend_slot, Path("test.log"))
                assert "-DeviceProfile=NordPhoneStream" in command and "-ExecCmds=MediaIO.EnableExperimentalScheduling 0" in command
            assert quality_cvars(stream_quality())["t.MaxFPS"] == 60
        outside = Path(directory) / "elsewhere.execcmds"
        outside.write_text("t.MaxFPS 60")
        renamed = candidate.with_suffix(".txt")
        renamed.write_text("t.MaxFPS 60")
        for value in ("", "Current", "low", "phone;quit", "file:", f"file:{outside}", f"file:{renamed}",
                      f"file:{candidate.with_name('missing.execcmds')}"):
            refused("NORD_STREAM_QUALITY", {"NORD_STREAM_QUALITY": value})
        for contents in ("t.MaxFPS 60,quit", "exec evil.txt,t.MaxFPS 60", "open 127.0.0.1,t.MaxFPS 60", "sg.ShadowQuality 2",
                         "t.MaxFPS 30", "t.MaxFPS 60;quit", "r.ScreenPercentage high,t.MaxFPS 60", ""):
            candidate.write_text(contents)
            refused("NORD_STREAM_QUALITY", {"NORD_STREAM_QUALITY": f"file:{candidate}"})
        # NORD_STREAM_GAUNTLET adds the gauntlet flags to NordHost only, after its pinned sky.
        run_folder = gauntlet / "20261023T220000Z-stream"
        pinned = "-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather"
        flags = ["-NordGauntlet", "-NordGauntletMode=stream", f"-NordGauntletRun={run_folder}",
                 f"-NordGauntletExpect={run_folder / 'stream.expect'}", "-csvGpuStats", "-csvCompression=0",
                 "-NordNoPolice", "-NordNoCampaign", "-NordNoSideJobs", "-NordNoCampaignSave"]
        with patch.dict(os.environ, {"NORD_STREAM_GAUNTLET": str(run_folder), "NORD_SKY_ARGS": pinned}, clear=True):
            host = game_command(False, Path("host.log"))
            assert host[-len(flags):] == flags and host[-len(flags) - 4:-len(flags)] == pinned.split()
            assert host[:-len(flags) - 4] == today[False][:-2]
            assert game_command(True, Path("friend.log")) == today[True]
        for environment in ({"NORD_STREAM_GAUNTLET": str(run_folder)},
                            {"NORD_STREAM_GAUNTLET": str(run_folder), "NORD_SKY_ARGS": "-NordWeather=Rain -NordFreezeWeather"},
                            {"NORD_STREAM_GAUNTLET": str(run_folder), "NORD_SKY_ARGS": "-NordHour=22 -NordFreezeTime"},
                            {"NORD_STREAM_GAUNTLET": str(Path(directory) / "elsewhere"), "NORD_SKY_ARGS": pinned},
                            {"NORD_STREAM_GAUNTLET": "", "NORD_SKY_ARGS": pinned},
                            # Without idle, NordFriend1 never sleeps, so every row with one viewer would read contended.
                            {"NORD_STREAM_GAUNTLET": str(run_folder), "NORD_SKY_ARGS": pinned, "NORD_STREAM_FLAGS": ""},
                            {"NORD_STREAM_GAUNTLET": str(run_folder), "NORD_SKY_ARGS": pinned, "NORD_STREAM_FLAGS": "windowed"}):
            refused("NORD_STREAM_GAUNTLET", environment)
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
    print("Self-check passed: ICE configuration validation, rendered job/GPU memory guards, separate players/save ownership, "
          "validated bitrate/scheduling/idle options, optional pinned host sky, occupied-port rejection, "
          "unchanged default launch line, phone and candidate quality options, gauntlet host flags, sky and idle refusals.")


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
