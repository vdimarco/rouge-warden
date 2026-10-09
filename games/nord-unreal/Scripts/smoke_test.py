"""Run with UnrealEditor -ExecutePythonScript=Scripts/smoke_test.py, including -nullrhi -unattended."""
import configparser
import json
from pathlib import Path
import time
import traceback
import unreal as u


u.get_default_object(u.load_class(None, "/Script/PythonScriptPlugin.EditorPythonScriptingLibrary")).call_method(
    "SetKeepPythonScriptAlive", (True,))
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, "/Script/UnrealEd.LevelEditorPlaySettings"))
ORIGINAL = {name: SETTINGS.get_editor_property(name) for name in
            ("PlayNumberOfClients", "RunUnderOneProcess")}
# EPlayNetMode has no Python wrapper; preserve its startup config and set its byte through reflection.
PLAY_CONFIG = configparser.ConfigParser(strict=False)
PLAY_CONFIG.read(Path(u.Paths.project_saved_dir()) / "Config/LinuxEditor/EditorPerProjectUserSettings.ini")
ORIGINAL_MODE = {"PIE_Standalone": 0, "PIE_ListenServer": 1, "PIE_Client": 2}[
    PLAY_CONFIG.get("/Script/UnrealEd.LevelEditorPlaySettings", "PlayNetMode", fallback="PIE_Standalone")]
SYSTEM = u.get_default_object(u.load_class(None, "/Script/Engine.KismetSystemLibrary"))
CLASSES = {name: u.load_class(None, "/Script/Quebec.Quebec" + name)
           for name in ("Controller", "Character", "Car", "ParkResident")}
LAYOUT = json.loads((Path(u.Paths.project_dir()) / "Data/LaFontaine/layout.json").read_text())
TARGETS = [u.Vector(*p) for p in LAYOUT["missions"]]
REPORT = {"passed": False, "mode": "two-player in-process listen-server PIE", "checks": [],
          "skipped": ["late join", "disconnect/reconnect", "external internet connectivity"]}
STATE = {"started": time.monotonic(), "step": -1, "finished": False}
STEPS = []


def distance(first, second):
    delta = first - second
    return (delta.x ** 2 + delta.y ** 2 + delta.z ** 2) ** 0.5


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def mission(world):
    return u.GameplayStatics.get_game_state(world).get_editor_property("MissionIndex")


def interact():
    # Python forces local RPC execution; a native timer invokes the real input path after its guard exits.
    u.SystemLibrary.set_timer_for_next_tick(STATE["client_pc"], "Interact")


def teleported(target):
    return distance(STATE["client_pc"].get_controlled_pawn().get_actor_location(), target) < 120


def teleport(target):
    STATE["server_pc"].get_controlled_pawn().set_actor_location(target, False, True)


def step(name, action, ready):
    STEPS.append((name, action, ready))


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    server = next((world for world in worlds if u.GameplayStatics.get_game_mode(world)), None)
    client = next((world for world in worlds if not u.GameplayStatics.get_game_mode(world)), None)
    if not server or not client:
        return False
    server_pcs, client_pcs = actors(server, "Controller"), actors(client, "Controller")
    host = next((pc for pc in server_pcs if pc.is_local_controller()), None)
    remote = next((pc for pc in server_pcs if not pc.is_local_controller()), None)
    local = next((pc for pc in client_pcs if pc.is_local_controller()), None)
    if not host or not remote or not local or not host.get_controlled_pawn() or not remote.get_controlled_pawn() or not local.get_controlled_pawn():
        return False
    if any(len(u.GameplayStatics.get_game_state(world).get_editor_property("PlayerArray")) < 2
           for world in (server, client)):
        return False
    STATE.update(server=server, client=client, server_pc=remote, client_pc=local,
                 host_pc=host, host_char=host.get_controlled_pawn(),
                 server_char=remote.get_controlled_pawn(), client_char=local.get_controlled_pawn(),
                 server_car=actors(server, "Car")[0], client_car=actors(client, "Car")[0])
    assert not STATE["server_car"].get_controller(), "Parked car must not have an automatic AI driver"
    assert mission(server) == mission(client) == 0, "Fresh PIE must start at mission zero"
    return True


def far_rejected():
    assert STATE["server_pc"].get_controlled_pawn() == STATE["server_char"], "Far E entered a car"
    assert mission(STATE["server"]) == mission(STATE["client"]) == 0, "Far E advanced a mission"
    return True


def entered():
    if STATE["server_pc"].get_controlled_pawn() != STATE["server_car"] or STATE["client_pc"].get_controlled_pawn() != STATE["client_car"]:
        if time.monotonic() - STATE["step_started"] > 2 and "interaction_state" not in REPORT:
            REPORT["interaction_state"] = {side: {
                "pawn": STATE[side + "_pc"].get_controlled_pawn().get_name(),
                "character_position": str(STATE[side + "_char"].get_actor_location()),
                "car_position": str(STATE[side + "_car"].get_actor_location()),
                "occupant": str(STATE[side + "_car"].get_editor_property("Occupant")),
            } for side in ("server", "client")}
            u.log("NORD_SMOKE_WAIT " + json.dumps(REPORT["interaction_state"]))
        return False
    for side in ("server", "client"):
        car, character = STATE[side + "_car"], STATE[side + "_char"]
        if car.get_editor_property("Occupant") != character or not character.get_editor_property("bInVehicle"):
            return False
        assert character.get_editor_property("bHidden"), "Occupied character remained visible"
        assert not character.get_actor_enable_collision(), "Occupied character retained collision"
    STATE["drive_start"] = STATE["server_car"].get_actor_location()
    return True


def start_drive():
    STATE["client_pc"].set_control_rotation(u.Rotator(pitch=0, yaw=90, roll=0))
    STATE["client_car"].disable_input(STATE["client_pc"])
    STATE["client_car"].call_method("MoveForward", (1.0,))


def stop_drive():
    STATE["client_car"].call_method("MoveForward", (0.0,))
    STATE["client_car"].enable_input(STATE["client_pc"])


def drive():
    if time.monotonic() - STATE["step_started"] < 1.2:
        return False
    displacement = distance(STATE["server_car"].get_actor_location(), STATE["drive_start"])
    assert displacement > 50, "Client drive RPC did not move the authority car"
    REPORT["drive_displacement_cm"] = round(displacement, 1)
    yaw = STATE["client_pc"].get_control_rotation().yaw - STATE["client_car"].get_actor_rotation().yaw
    assert abs((yaw + 180) % 360 - 180) < 25, "Driving camera did not follow the car"
    assert STATE["client_car"].get_component_by_class(u.CameraComponent).get_editor_property("field_of_view") > 85, "Speed camera FOV did not widen"
    return True


def movement_replicated():
    delta = distance(STATE["server_car"].get_actor_location(), STATE["client_car"].get_actor_location())
    assert delta < 150, "Client car did not follow replicated server movement"
    REPORT["replicated_car_error_cm"] = round(delta, 1)
    return True


def brake_arrived():
    if time.monotonic() - STATE["step_started"] < 1:
        return False
    assert STATE["server_car"].get_editor_property("bHandbrake"), "Client handbrake did not reach server"
    STATE["brake_position"] = STATE["server_car"].get_actor_location()
    STATE["client_car"].disable_input(STATE["client_pc"])
    STATE["client_car"].call_method("MoveForward", (1.0,))
    return True


def brake_holds():
    assert distance(STATE["server_car"].get_actor_location(), STATE["brake_position"]) < 5, "Handbrake failed to hold against throttle"
    return True


def brake_released():
    if STATE["server_car"].get_editor_property("bHandbrake"):
        return False
    if distance(STATE["server_car"].get_actor_location(), STATE["brake_position"]) < 30:
        return False
    stop_drive()
    return True


def exited():
    if any(STATE[side + "_pc"].get_controlled_pawn() != STATE[side + "_char"] for side in ("server", "client")):
        return False
    for side in ("server", "client"):
        car, character = STATE[side + "_car"], STATE[side + "_char"]
        if car.get_editor_property("Occupant") or character.get_editor_property("bInVehicle"):
            return False
        assert not character.get_editor_property("bHidden"), "Exited character remained hidden"
        assert character.get_actor_enable_collision(), "Exited character did not regain collision"
    return True


def host_interact():
    u.SystemLibrary.set_timer_for_next_tick(STATE["host_pc"], "Interact")


def host_entered():
    return (STATE["host_pc"].get_controlled_pawn() == STATE["server_car"] and
            STATE["server_car"].get_editor_property("Occupant") == STATE["host_char"])


def host_exited():
    if STATE["host_pc"].get_controlled_pawn() != STATE["host_char"]:
        return False
    if any(STATE[side + "_car"].get_editor_property("Occupant") for side in ("server", "client")):
        return False
    assert not STATE["host_char"].get_editor_property("bHidden"), "Exited host character remained hidden"
    assert STATE["host_char"].get_actor_enable_collision(), "Exited host character did not regain collision"
    return True


def missions_equal(index):
    return mission(STATE["server"]) == mission(STATE["client"]) == index


def reject_wrong_mission():
    assert missions_equal(0), "A later objective incorrectly skipped the current mission"
    return True


def completed():
    assert missions_equal(3), "Completed campaign advanced beyond the final mission"
    return True


def begin():
    SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", 1))
    SETTINGS.set_editor_property("PlayNumberOfClients", 2)
    SETTINGS.set_editor_property("RunUnderOneProcess", True)
    LEVELS.editor_request_begin_play()


step("two connected players in server and client worlds", begin, discover)
step("out-of-range client interaction rejected", interact, far_rejected)
step("authority teleport replicated to owning client", lambda: teleport(STATE["server_car"].get_actor_location() + u.Vector(0, 260, 0)),
     lambda: distance(STATE["client_pc"].get_controlled_pawn().get_actor_location(), STATE["client_car"].get_actor_location()) < 450)
step("client RPC enters car; occupant, visibility and collision replicate", interact, entered)
step("client drive RPC moves authority car", start_drive, drive)
step("car movement replicates to client", stop_drive, movement_replicated)
step("client handbrake reaches server and stops car", lambda: STATE["client_car"].call_method("ApplyHandbrake"), brake_arrived)
step("handbrake holds against throttle", lambda: None, brake_holds)
step("releasing handbrake restores acceleration", lambda: STATE["client_car"].call_method("ReleaseHandbrake"), brake_released)
step("client RPC exits car and restores character on both peers", interact, exited)
step("listen host approaches the empty car",
     lambda: STATE["host_char"].set_actor_location(STATE["server_car"].get_actor_location() + u.Vector(0, -260, 0), False, True),
     lambda: distance(STATE["host_char"].get_actor_location(), STATE["server_car"].get_actor_location()) < 450)
step("listen host interaction enters car", host_interact, host_entered)
step("listen host interaction exits and restores character", host_interact, host_exited)
step("teleport to a future objective", lambda: teleport(TARGETS[1]), lambda: teleported(TARGETS[1]))
step("future mission interaction rejected", interact, reject_wrong_mission)
for index, target in enumerate(TARGETS):
    step("teleport to objective " + str(index + 1), lambda target=target: teleport(target), lambda target=target: teleported(target))
    step("mission " + str(index + 1) + " advances and replicates", interact, lambda index=index: missions_equal(index + 1))
step("completed missions remain complete", interact, completed)
step("fall reset returns both peers to Sherbrooke spawn", lambda: teleport(u.Vector(1000, -3200, -1700)),
     lambda: all(distance(STATE[side + "_pc"].get_controlled_pawn().get_actor_location(), u.Vector(*LAYOUT["spawn"])) < 250
                 for side in ("server", "client")))



def residents_ready():
    server=actors(STATE['server'],'ParkResident');client=actors(STATE['client'],'ParkResident')
    if len(server)!=14 or len(client)!=14:return False
    assert {a.get_editor_property('Style') for a in client}==set(range(11))
    for a in client:
        style=a.get_editor_property('Style')
        if style>=3:
            body=a.get_component_by_class(u.SkeletalMeshComponent)
            assert body and body.get_editor_property('skeletal_mesh_asset') and body.is_visible()
            assert body.get_editor_property('skeletal_mesh_asset').get_editor_property('skeleton')
            props=[c for c in a.get_components_by_class(u.StaticMeshComponent) if c.is_visible() and c.static_mesh is not None]
            assert len(props)==1 and distance(props[0].get_world_location(),body.get_socket_location('RightHand'))<3
        else:
            assert sum(c.static_mesh is not None for c in a.get_components_by_class(u.StaticMeshComponent))==6
    crew=[a for a in server if a.get_editor_property('Style')>=3]
    STATE['resident']=max(crew,key=lambda a:min(distance(a.get_actor_location(),b.get_actor_location()) for b in server if b!=a))
    style=STATE['resident'].get_editor_property('Style')
    STATE['resident_client']=next(a for a in client if a.get_editor_property('Style')==style)
    STATE['resident_start']=STATE['resident'].get_actor_location()
    STATE['resident_foot']=STATE['resident_client'].get_component_by_class(u.SkeletalMeshComponent).get_socket_transform('RightFoot',u.RelativeTransformSpace.RTS_COMPONENT).translation
    return True


def resident_moved():
    a=STATE['resident'];b=STATE['resident_client']
    foot=b.get_component_by_class(u.SkeletalMeshComponent).get_socket_transform('RightFoot',u.RelativeTransformSpace.RTS_COMPONENT).translation
    return distance(a.get_actor_location(),STATE['resident_start'])>65 and distance(a.get_actor_location(),b.get_actor_location())<60 and distance(foot,STATE['resident_foot'])>2


def approach_resident():
    a=STATE['resident'];teleport(a.get_actor_location()+a.get_actor_right_vector()*150+u.Vector(0,0,100))


def resident_near():
    return distance(STATE['client_char'].get_actor_location(),STATE['resident_client'].get_actor_location())<350


def resident_talked():
    caption=STATE['client_pc'].get_editor_property('ResidentCaption')
    if not caption:return False
    names={3:'GREEN CAP 51',4:'MEMPHIS 33',5:'BLACK CAP',6:'WHITE CAP',7:'RED JERSEY',8:'LIME JACKET',9:'SKULL SHIRT',10:'TOPKNOT PLUNGER'}
    assert names[STATE['resident'].get_editor_property('Style')] in caption,caption
    assert not STATE['host_pc'].get_editor_property('ResidentCaption'),'Dialogue leaked to another player'
    assert missions_equal(3)
    return True

step('fourteen residents and all eight cottage crew styles replicate',lambda:None,residents_ready)
step('resident route movement replicates',lambda:None,resident_moved)
step('client approaches cottage crew member',approach_resident,resident_near)
step('client E talks to crew without changing completed missions or host dialogue',interact,resident_talked)


def finish(error=None):
    STATE["finished"] = True
    REPORT["passed"] = error is None
    REPORT["elapsed_seconds"] = round(time.monotonic() - STATE["started"], 2)
    if error:
        REPORT["error"] = error
        u.log_error("NORD_SMOKE_FAILED " + error)
    else:
        u.log("NORD_SMOKE_OK " + str(len(REPORT["checks"])) + " checks passed")
    try:
        LEVELS.editor_request_end_play()
        for name, value in ORIGINAL.items():
            SETTINGS.set_editor_property(name, value)
        SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", ORIGINAL_MODE))
    finally:
        path = Path(u.Paths.project_saved_dir()) / "Tests" / "Smoke.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
        u.unregister_slate_post_tick_callback(STATE["callback"])
        u.get_default_object(u.load_class(None, "/Script/PythonScriptPlugin.EditorPythonScriptingLibrary")).call_method(
            "SetKeepPythonScriptAlive", (False,))


def tick(delta_seconds):
    if STATE["finished"]:
        return
    try:
        now = time.monotonic()
        assert now - STATE["started"] < 110, "Timeout while testing: " + STEPS[max(STATE["step"], 0)][0]
        if STATE["step"] == -1:
            if now - STATE["started"] < 1:
                return
            STATE.update(step=0, step_started=now)
            STEPS[0][1]()
        name, action, ready = STEPS[STATE["step"]]
        if now - STATE["step_started"] < 0.45 or not ready():
            return
        REPORT["checks"].append(name)
        u.log("NORD_SMOKE_CHECK " + name)
        STATE["step"] += 1
        if STATE["step"] == len(STEPS):
            finish()
            return
        STATE["step_started"] = now
        STEPS[STATE["step"]][1]()
    except Exception:
        finish(traceback.format_exc())


STATE["callback"] = u.register_slate_post_tick_callback(tick)
u.log("NORD_SMOKE_START awaiting two-player PIE")
