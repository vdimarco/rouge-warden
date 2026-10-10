"""Exercise native controls, late join, abrupt loss and repeated joins in the Linux package.

Uses Unreal's Development-build console/CSV frame commands; no test hooks are added to the game.
"""
import argparse
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "Builds/Linux/Quebec.sh"
OUT = ROOT / "Saved/Tests/PackagedGameplay"
LAYOUT = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--soak-seconds", type=int, default=0)
args = parser.parse_args()
assert 0 <= args.soak_seconds <= 2400
assert RUNNER.is_file(), "Build the Linux Development package first"
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {"passed": False, "mode": "separate Linux Development processes, native console input handlers",
          "checks": [], "soak_cycles": 0, "skipped": ["external internet", "physical input devices", "other platforms"]}
PEERS = []
started = time.monotonic()


def log(peer):
    return peer["log"].read_text(errors="replace") if peer["log"].exists() else ""


def write_commands(peer, commands):
    temporary = peer["commands"].with_suffix(".part")
    temporary.write_text(commands + "\n")
    temporary.replace(peer["commands"])


def wait_for(predicate, timeout=15):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        assert all(peer["process"].poll() is None for peer in PEERS if not peer.get("stopped")), "A packaged peer exited unexpectedly"
        value = predicate()
        if value:
            return value
        time.sleep(.02)
    raise AssertionError("Timed out awaiting packaged state")


def launch(name, address, commands_dir):
    path = OUT / (name + ".log")
    path.unlink(missing_ok=True)
    peer = {"log": path, "commands": commands_dir / (name + ".txt"), "sequence": 0}
    write_commands(peer, "")
    peer["stdout"] = (OUT / (name + ".stdout.log")).open("w")
    # Separate profiler paths avoid same-second filename collisions between concurrent peers.
    peer["process"] = subprocess.Popen(["bash", str(RUNNER), address, "-port=7793", "-nullrhi", "-unattended", "-nosound",
        "-saveddirsuffix=NativeQA_" + name,
        "-ExecCmds=t.MaxFPS 60", "-csvCaptureFrames=180000",
        "-csvExecCmds=r30:exec " + str(peer["commands"]), "-abslog=" + str(path)],
        stdout=peer["stdout"], stderr=subprocess.STDOUT, start_new_session=True)
    PEERS.append(peer)
    return peer


def stop(peer, abrupt=False):
    if peer.get("stopped"):
        return
    peer["stopped"] = True
    process = peer["process"]
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGKILL if abrupt else signal.SIGTERM)
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    peer["stdout"].close()


def send(peer, commands):
    # A unique existing caption RPC acknowledges the loaded macro before it can repeat.
    peer["sequence"] += 1
    marker = "NORD_QA_" + str(peer["sequence"])
    offset = len(log(peer))
    write_commands(peer, "ke QuebecController ClientInteractionMessage " + marker + "\n" + commands)
    try:
        wait_for(lambda: "Called 'ClientInteractionMessage " + marker + "'" in log(peer)[offset:])
    finally:
        write_commands(peer, "")


def observe(peer, commands, predicate, timeout=15):
    offset = len(log(peer))
    write_commands(peer, commands)
    try:
        return wait_for(lambda: predicate(log(peer)[offset:]), timeout)
    finally:
        write_commands(peer, "")


def scalar(text, actor, property_name):
    values = re.findall(r"\." + re.escape(actor) + r"\." + re.escape(property_name) + r" = ([-\d.]+)", text)
    return float(values[-1]) if values else None


def car_speed(text):
    return scalar(text, "QuebecCar_0", "Speed")


def occupied(text):
    values = re.findall(r"\.QuebecCar_0\.Occupant = ([^\r\n]+)", text)
    return values[-1] if values else None


def teleport_command(position):
    return 'ke QuebecCharacter K2_SetActorLocation "(X=%s,Y=%s,Z=%s)" false () true' % tuple(position)


def checked(name):
    REPORT["checks"].append(name)
    print("NORD_PACKAGED_CHECK", name, flush=True)


def connected(peer):
    wait_for(lambda: "Welcomed by server" in log(peer))
    observe(peer, "getall QuebecGameState MissionIndex\ngetall QuebecParkResident Style\ngetall SkeletalMeshComponent SkinnedAsset",
        lambda text: "MissionIndex = 3" in text and len(re.findall(r"Style = (\d+)", text.rsplit("CsvExecCommand", 1)[-1])) == 14
        and set(re.findall(r"Style = (\d+)", text)) == set(map(str, range(11)))
        and set(re.findall(r"/Game/ParkComic/Crew/Resident(\d+)/SK_Body\.SK_Body", text)) == set(map(str, range(3, 11))))


def only_host_remains(host):
    def cleaned(text):
        batch = text.rsplit("CsvExecCommand", 1)[-1]
        return all(len(re.findall(r"\d+\) " + name + " ", batch)) == 1
                   for name in ("QuebecController", "QuebecCharacter")) and "MissionIndex = 3" in batch
    observe(host, "getall QuebecController\ngetall QuebecCharacter\ngetall QuebecGameState MissionIndex", cleaned)


def approach_car(host):
    text = observe(host, "getall BoxComponent RelativeLocation",
        lambda text: re.findall(r"\.QuebecCar_0\.Collision.RelativeLocation = \(X=([-\d.]+),Y=([-\d.]+),Z=([-\d.]+)\)", text))
    position = list(map(float, text[-1]))
    position[1] += 260
    send(host, teleport_command(position))


def enter(client, host):
    approach_car(host)
    send(client, "ke QuebecController Interact")
    observe(host, "getall QuebecCar Occupant", lambda text: occupied(text) and occupied(text) != "None")


def rss_mb(peer):
    total = 0
    pending = [peer["process"].pid]
    while pending:
        pid = pending.pop()
        try:
            pending.extend(map(int, Path(f"/proc/{pid}/task/{pid}/children").read_text().split()))
            values = re.findall(r"^VmRSS:\s+(\d+) kB", Path(f"/proc/{pid}/status").read_text(), re.M)
            if values:
                total += int(values[0]) / 1024
        except FileNotFoundError:
            pass
    return round(total, 1)


try:
    # ExecMacro requires the literal Binaries in an absolute path, otherwise Unreal prepends its own directory.
    with tempfile.TemporaryDirectory(prefix="nord-Binaries-") as directory:
        commands_dir = Path(directory)
        host = launch("Host", "/Game/Maps/LaFontaine?listen", commands_dir)
        wait_for(lambda: "listening on port 7793" in log(host), 30)
        for index, target in enumerate(LAYOUT["missions"], 1):
            send(host, teleport_command(target) + "\nke QuebecController Interact")
            observe(host, "getall QuebecGameState MissionIndex", lambda text, index=index: f"MissionIndex = {index}" in text)
        checked("native host E completes the three ordered shared objectives")
        client = launch("Client", "127.0.0.1:7793", commands_dir)
        connected(client)
        checked("late-joining package receives completed progress, eleven resident styles and eight runtime bodies")
        enter(client, host)
        checked("native client E RPC occupies the available car on the host")
        send(host, teleport_command(LAYOUT["spawn"]))
        send(client, "ke QuebecCar DisableInput None\nke QuebecCar MoveForward 1.0")
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) is not None and car_speed(text) > 1000)
        checked("native client throttle drives the authority car")
        observe(client, "getall CameraComponent FieldOfView", lambda text: any(float(v) > 85.5 for v in re.findall(r"FieldOfView = ([-\d.]+)", text)))
        checked("packaged driving camera widens with speed")
        send(client, "ke QuebecCar ApplyHandbrake")
        observe(host, "getall QuebecCar Speed\ngetall QuebecCar bHandbrake", lambda text: car_speed(text) == 0 and ".QuebecCar_0.bHandbrake = True" in text)
        time.sleep(1)
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) == 0)
        checked("native handbrake stops and holds against throttle")
        send(client, "ke QuebecCar ReleaseHandbrake")
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) is not None and car_speed(text) > 1000)
        checked("native handbrake release restores acceleration")
        stop(client, abrupt=True)
        time.sleep(5)
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) == 0)
        checked("abrupt client process loss clears stale driving input")
        observe(host, "getall QuebecCar Occupant", lambda text: occupied(text) == "None", timeout=90)
        checked("network timeout releases the crashed driver's occupancy")
        client = launch("Rejoined", "127.0.0.1:7793", commands_dir)
        connected(client)
        enter(client, host)
        send(client, "ke QuebecController Interact")
        observe(host, "getall QuebecCar Occupant", lambda text: occupied(text) == "None")
        checked("rejoined package can enter and exit the released car")
        stop(client)
        only_host_remains(host)
        checked("clean departure removes the remote controller")
        soak_start = time.monotonic()
        baseline = rss_mb(host)
        peak = baseline
        while time.monotonic() - soak_start < args.soak_seconds:
            cycle_start = time.monotonic()
            number = REPORT["soak_cycles"] + 1
            client = launch("Soak" + str(number), "127.0.0.1:7793", commands_dir)
            connected(client)
            enter(client, host)
            send(client, "ke QuebecController Interact")
            observe(host, "getall QuebecCar Occupant", lambda text: occupied(text) == "None")
            stop(client)
            only_host_remains(host)
            REPORT["soak_cycles"] = number
            peak = max(peak, rss_mb(host))
            print("NORD_PACKAGED_SOAK", json.dumps({"cycle": number, "elapsed_seconds": round(time.monotonic() - soak_start), "host_rss_mb": rss_mb(host)}), flush=True)
            while time.monotonic() - cycle_start < 30 and time.monotonic() - soak_start < args.soak_seconds:
                wait_for(lambda: host["process"].poll() is None, 1)
                time.sleep(.5)
        REPORT["soak"] = {"requested_seconds": args.soak_seconds, "elapsed_seconds": round(time.monotonic() - soak_start, 1),
                          "host_rss_baseline_mb": baseline, "host_rss_peak_mb": peak, "host_rss_final_mb": rss_mb(host)}
        for peer in PEERS:
            assert not re.search(r"Fatal error|Assertion failed|Bad or missing property|Can't find file|Failed to load.*ParkComic", log(peer)), peer["log"]
        REPORT["passed"] = True
except Exception as exc:
    REPORT["error"] = repr(exc)
    raise
finally:
    for peer in PEERS:
        stop(peer)
    REPORT["elapsed_seconds"] = round(time.monotonic() - started, 1)
    (ROOT / "Verification/PackagedGameplay.json").write_text(json.dumps(REPORT, indent=2) + "\n")
    print("NORD_PACKAGED_GAMEPLAY", json.dumps(REPORT), flush=True)
