"""Exercise native controls, late join, abrupt loss and repeated joins in the Linux package.

Uses Unreal's Development-build console/CSV frame commands; no test hooks are added to the game.
"""
import argparse
import json
import math
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
SAVED_RESIDENT_NAMES = set()
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


def car_transforms(text):
    positions = dict((name, tuple(map(float, xyz))) for name, *xyz in re.findall(
        r"\.(QuebecCar_\d+)\.Collision.RelativeLocation = \(X=([-\d.]+),Y=([-\d.]+),Z=([-\d.]+)\)", text))
    rotations = dict((name, float(yaw)) for name, yaw in re.findall(
        r"\.(QuebecCar_\d+)\.Collision.RelativeRotation = \(Pitch=[-\d.]+,Yaw=([-\d.]+),Roll=[-\d.]+\)", text))
    if "QuebecCar_0" not in positions or positions.keys() != rotations.keys():
        return None
    return {name: (position, math.radians(rotations[name])) for name, position in positions.items()}


def send_car(peer, commands):
    # HandleKismetEventCommand accepts an object name; a class name broadcasts
    # to every matching actor and would also teleport/modify ambient traffic.
    offset = len(log(peer))
    send(peer, "\n".join("ke QuebecCar_0 " + command for command in commands.splitlines()))
    for command in commands.splitlines():
        pattern = r"Called '" + re.escape(command) + r"' on instance '[^']*\.QuebecCar_0' \(call succeeded\)"
        wait_for(lambda pattern=pattern: re.search(pattern, log(peer)[offset:]))


def reset_driving_fixture(host, client, label):
    fixture = REPORT["driving_fixture"]
    position, yaw = fixture["original_position_cm"], fixture["original_yaw_degrees"]
    occupant = observe(host, "getall QuebecCar Occupant", lambda text: occupied(text) if occupied(text) != "None" else None)
    client_occupant = observe(client, "getall QuebecCar Occupant", lambda text: occupied(text) if occupied(text) != "None" else None)
    send_car(client, "ApplyHandbrake")
    observe(host, "getall QuebecCar Speed\ngetall QuebecCar bHandbrake",
            lambda text: car_speed(text) == 0 and ".QuebecCar_0.bHandbrake = True" in text)
    command = ('K2_SetActorLocationAndRotation "(X=%s,Y=%s,Z=%s)" '
               '"(Pitch=0,Yaw=%s,Roll=0)" false () true') % (*position, yaw)
    send_car(host, command)

    def reset_state(text, authority=False):
        transforms = car_transforms(text)
        if not transforms or occupied(text) != (occupant if authority else client_occupant):
            return None
        actual, angle = transforms["QuebecCar_0"]
        error = math.dist(actual, position)
        yaw_error = abs((math.degrees(angle) - yaw + 180) % 360 - 180)
        # RepMovement defaults to 8-bit rotation: client yaw rounds within 180/256 degrees.
        yaw_tolerance = .05 if authority else 180 / 256 + .01
        if error > 2 or yaw_error > yaw_tolerance:
            return None
        if authority and not (car_speed(text) == 0 and ".QuebecCar_0.bHandbrake = True" in text and
                              ".QuebecCar_0.bActorEnableCollision = True" in text and
                              sum(value == "True" for value in dict(re.findall(
                                  r"\.(QuebecCar_\d+)\.bTraffic = (True|False)", text)).values()) == 16):
            return None
        return {"position_cm": actual, "position_error_cm": round(error, 6),
                "yaw_degrees": math.degrees(angle), "yaw_error_degrees": round(yaw_error, 6)}

    transforms_command = "getall BoxComponent RelativeLocation\ngetall BoxComponent RelativeRotation\ngetall QuebecCar Occupant"
    server_state = observe(host, transforms_command + "\ngetall QuebecCar Speed\ngetall QuebecCar bHandbrake\ngetall QuebecCar bActorEnableCollision\ngetall QuebecCar bTraffic",
                           lambda text: reset_state(text, True))
    client_state = observe(client, transforms_command, reset_state)
    fixture.setdefault("resets", []).append({"window": label, "host": server_state, "client": client_state,
                                             "occupant": occupant, "stopped_with_native_handbrake": True,
                                             "collision_enabled": True, "ambient_traffic_enabled": True})


def teleport_command(position):
    return 'ke QuebecCharacter K2_SetActorLocation "(X=%s,Y=%s,Z=%s)" false () true' % tuple(position)


def checked(name):
    REPORT["checks"].append(name)
    print("NORD_PACKAGED_CHECK", name, flush=True)


def resident_tags(text):
    # GETALL exports array elements on separate numbered lines (CoreUObject/Obj.cpp).
    tags, current = {}, None
    for line in text.splitlines():
        header = re.search(r"\.(QuebecParkResident_\d+)\.Tags =", line)
        if header:
            current = header[1]
            tags[current] = False
        elif current and re.search(r"\b\d+:\s*CityCrowd\b", line):
            tags[current] = True
    return tags


def resident_population(text):
    tags = resident_tags(text)
    return {"saved": sum(not ambient for ambient in tags.values()), "ambient": sum(tags.values())}


def resident_styles(text):
    return {name: int(style) for name, style in re.findall(r"\.(QuebecParkResident_\d+)\.Style = (\d+)", text)}


def connected(peer):
    wait_for(lambda: "Welcomed by server" in log(peer))
    def ready(text):
        styles = resident_styles(text)
        if ("MissionIndex = 3" not in text or not SAVED_RESIDENT_NAMES.issubset(styles) or
                len(styles) <= 14 or {styles[name] for name in SAVED_RESIDENT_NAMES} != set(range(11))):
            return False
        # Runtime Actor Tags are authority-only. Saved map names are stable across
        # peers; require each original skeletal resident's own mesh as well.
        return all(re.search(r"\." + re.escape(name) + r"\.GeneratedBody\.SkinnedAsset = [^\r\n]*/Game/ParkComic/Crew/Resident" +
                   str(styles[name]) + r"/SK_Body\.SK_Body", text)
                   for name in SAVED_RESIDENT_NAMES if styles[name] >= 3)
    observe(peer, "getall QuebecGameState MissionIndex\ngetall QuebecParkResident Style\ngetall SkeletalMeshComponent SkinnedAsset", ready)
    styles = resident_styles(log(peer))
    REPORT.setdefault("resident_population", {})[peer["log"].stem] = {
        "saved": len(SAVED_RESIDENT_NAMES & styles.keys()), "ambient": len(styles.keys() - SAVED_RESIDENT_NAMES)}


def only_host_remains(host):
    def cleaned(text):
        batch = text.rsplit("CsvExecCommand", 1)[-1]
        return all(len(re.findall(r"\d+\) " + name + " ", batch)) == 1
                   for name in ("QuebecController", "QuebecCharacter")) and "MissionIndex = 3" in batch
    observe(host, "getall QuebecController\ngetall QuebecCharacter\ngetall QuebecGameState MissionIndex", cleaned)


def approach_car(host):
    cars = observe(host, "getall BoxComponent RelativeLocation\ngetall BoxComponent RelativeRotation", car_transforms)
    position, yaw = cars["QuebecCar_0"]
    if "driving_fixture" not in REPORT:
        expected = (LAYOUT["car"][0] - math.sin(yaw) * 145, LAYOUT["car"][1] + math.cos(yaw) * 145)
        assert math.dist(position[:2], expected) < 3, "Starter is outside its verified forward driving lane"
        assert abs((math.degrees(yaw) - LAYOUT["car_yaw"] + 180) % 360 - 180) < .05
        REPORT["driving_fixture"] = {"actor": "QuebecCar_0", "original_position_cm": position,
                                     "original_yaw_degrees": math.degrees(yaw),
                                     "forward_lane_offset_cm": 145, "reset_method": "native actor teleport while occupied and handbraked"}
    # Use the actual car orientation, and keep the standing capsule clear of
    # every vehicle while ensuring native E still selects this car as nearest.
    for lateral in (185, -185):
        target = (position[0] - math.sin(yaw) * lateral, position[1] + math.cos(yaw) * lateral, position[2])
        clear = True
        for name, (other, angle) in cars.items():
            dx, dy = target[0]-other[0], target[1]-other[1]
            along, across = dx*math.cos(angle)+dy*math.sin(angle), -dx*math.sin(angle)+dy*math.cos(angle)
            if ((abs(along) < 264 and abs(across) < 152 and abs(target[2]-other[2]) < 190) or
                    (name != "QuebecCar_0" and math.hypot(dx,dy) < abs(lateral)+100)):
                clear = False
                break
        if clear:
            send(host, teleport_command(target))
            observe(host, "getall CapsuleComponent RelativeLocation", lambda text: (points := re.findall(
                r"\.QuebecCharacter_\d+\.CollisionCylinder.RelativeLocation = \(X=([-\d.]+),Y=([-\d.]+),Z=([-\d.]+)\)", text))
                and all(math.dist(tuple(map(float, point)), target) < 120 for point in points))
            return
    raise AssertionError("No clear side position selects the native target car as nearest")


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
        observe(host, "getall QuebecParkResident Tags",
            lambda text: resident_population(text) == {"saved": 14, "ambient": 96})
        SAVED_RESIDENT_NAMES.update(name for name, ambient in resident_tags(log(host)).items() if not ambient)
        assert len(SAVED_RESIDENT_NAMES) == 14
        REPORT.setdefault("resident_population", {})["Host"] = {"saved": 14, "ambient": 96}
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
        send_car(client, "DisableInput None")
        reset_driving_fixture(host, client, "initial throttle")
        send_car(client, "ReleaseHandbrake\nMoveForward 1.0")
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) is not None and car_speed(text) > 1000)
        checked("native client throttle drives the authority car")
        observe(client, "getall CameraComponent FieldOfView", lambda text: any(float(v) > 85.5 for v in re.findall(r"FieldOfView = ([-\d.]+)", text)))
        checked("packaged driving camera widens with speed")
        send_car(client, "ApplyHandbrake")
        observe(host, "getall QuebecCar Speed\ngetall QuebecCar bHandbrake", lambda text: car_speed(text) == 0 and ".QuebecCar_0.bHandbrake = True" in text)
        time.sleep(1)
        observe(host, "getall QuebecCar Speed", lambda text: car_speed(text) == 0)
        checked("native handbrake stops and holds against throttle")
        reset_driving_fixture(host, client, "handbrake release acceleration")
        send_car(client, "ReleaseHandbrake")
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
