"""Run with UnrealEditor -ExecutePythonScript=Scripts/smoke_test.py, including -nullrhi -unattended."""
import configparser
import json
import math
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
          "skipped": ["external internet connectivity", "physical keyboard and mouse input"]}
STATE = {"started": time.monotonic(), "step": -1, "finished": False}
STEPS = []


def distance(first, second):
    delta = first - second
    return (delta.x ** 2 + delta.y ** 2 + delta.z ** 2) ** 0.5


def elapsed():
    world = STATE.get("step_world")
    if world and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)):
        return u.GameplayStatics.get_time_seconds(world) - STATE["step_world_started"]
    return time.monotonic() - STATE["step_started"]


def start_step(now):
    STATE["step_started"] = now
    world = STATE.get("client")
    STATE["step_world"] = world if world and any(world is live for live in u.EditorLevelLibrary.get_pie_worlds(True)) else None
    if STATE["step_world"]:
        STATE["step_world_started"] = u.GameplayStatics.get_time_seconds(world)
    STEPS[STATE["step"]][1]()


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
    if "-NordRenderChecks" in u.SystemLibrary.get_command_line():
        # Render one peer, as in story inspection, to avoid duplicate GPU buffers.
        if server:
            u.GameplayStatics.set_enable_world_rendering(server, False)
        if client:
            u.GameplayStatics.set_enable_world_rendering(client, True)
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
    starters = [car for car in actors(server, "Car") if car.actor_has_tag("StarterCar")]
    assert len(starters) == 1, "Expected the native curb-parked starter"
    server_car = starters[0]
    client_car = next((car for car in actors(client, "Car") if car.get_name() == server_car.get_name()), None)
    if not client_car:
        return False
    STATE.update(server=server, client=client, server_pc=remote, client_pc=local,
                 host_pc=host, host_char=host.get_controlled_pawn(),
                 server_char=remote.get_controlled_pawn(), client_char=local.get_controlled_pawn(),
                 server_car=server_car, client_car=client_car)
    assert not STATE["server_car"].get_controller(), "Parked car must not have an automatic AI driver"
    assert mission(server) == mission(client) == 0, "Fresh PIE must start at mission zero"
    if "-NordLag" in u.SystemLibrary.get_command_line():
        for world, pc in ((server, host), (client, local)):
            u.SystemLibrary.execute_console_command(world, "NetEmulation.PktLag 100", pc)
            u.SystemLibrary.execute_console_command(world, "NetEmulation.PktLoss 2", pc)
        REPORT["network_emulation"] = {"outgoing_lag_ms": 100, "packet_loss_percent": 2, "both_peers": True}
    return True


def far_rejected():
    assert STATE["server_pc"].get_controlled_pawn() == STATE["server_char"], "Far E entered a car"
    assert mission(STATE["server"]) == mission(STATE["client"]) == 0, "Far E advanced a mission"
    return True


def prepare_far_interaction():
    # Curb parking can put cars beside either the spawn or the walking endpoint; inspect nearby road-oriented ground.
    world, character = STATE["server"], STATE["server_char"]
    yaw = math.radians(LAYOUT["car_yaw"])
    forward, right = u.Vector(math.cos(yaw), math.sin(yaw), 0), u.Vector(-math.sin(yaw), math.cos(yaw), 0)
    gameplay = u.get_default_object(u.load_class(None, "/Script/Engine.GameplayStatics"))
    for along in (0, 1000, -1000, 2000, -2000, 3000, -3000):
        for across in (0, 400, -400, 800, -800):
            point = WALK_START + forward * along + right * across
            nearest = min(distance(point, car.get_actor_location()) for car in actors(world, "Car"))
            if nearest <= 650 or min(distance(point, target) for target in TARGETS) <= 600:
                continue
            hit = u.SystemLibrary.line_trace_single(world, point + u.Vector(0, 0, 200), point + u.Vector(0, 0, -300),
                u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [character], u.DrawDebugTrace.NONE, True)
            if not hit:
                continue
            ground = gameplay.call_method("BreakHitResult", (hit,))
            if ground[7].z < .7 or not -200 < ground[5].z < 50:
                continue
            point = ground[5] + u.Vector(0, 0, 100)
            if u.SystemLibrary.capsule_trace_single_by_profile(world, point, point + u.Vector(0, 0, .1),
                    42, 88, "Pawn", False, [character], u.DrawDebugTrace.NONE, True):
                continue
            nearest = min(distance(point, car.get_actor_location()) for car in actors(world, "Car"))
            if nearest <= 650 or min(distance(point, target) for target in TARGETS) <= 600:
                continue
            STATE["far_point"] = point
            REPORT["far_interaction_fixture"] = {"position_cm": [point.x, point.y, point.z], "nearest_car_cm": round(nearest, 1),
                                                  "ground_z_cm": ground[5].z, "capsule_clear": True}
            teleport(point)
            return
    raise AssertionError("No clear grounded road fixture is outside every car and objective interaction radius")


def far_interact():
    for side in ("server", "client"):
        point = STATE[side + "_char"].get_actor_location()
        nearest = min(distance(point, car.get_actor_location()) for car in actors(STATE[side], "Car"))
        assert nearest > 450, (side, "Far E fixture moved into a car's interaction radius", nearest)
    interact()


def entered():
    if STATE["server_pc"].get_controlled_pawn() != STATE["server_car"] or STATE["client_pc"].get_controlled_pawn() != STATE["client_car"]:
        if elapsed() > 2 and "interaction_state" not in REPORT:
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


def check_starter_parking():
    car = STATE["server_car"]
    offset, right = car.get_actor_location() - u.Vector(*LAYOUT["car"]), car.get_actor_right_vector()
    curb_offset = offset.x * right.x + offset.y * right.y
    assert car.actor_has_tag("StarterCar") and 300 < curb_offset < 2200, "Starter must park beside its actual curb"
    root = car.root_component
    assert isinstance(root, u.StaticMeshComponent) and root.get_editor_property("static_mesh").get_name() == f'SM_CarCollision{car.get_editor_property("BodyProfile")}'
    assert not root.is_visible(), "The fitted car collider must remain hidden"
    STATE["starter_position"] = car.get_actor_location()
    REPORT["driving_fixture"] = {"starter_curb_offset_cm": round(curb_offset, 1), "production_spawn_verified": True,
                                 "ambient_traffic_enabled": True, "full_curb_clearance_covered_by": "population_test.py"}


def prepare_driving_lane():
    world, car = STATE["server"], STATE["server_car"]
    ignored = [car, STATE["server_char"]]
    gameplay = u.get_default_object(u.load_class(None, "/Script/Engine.GameplayStatics"))
    before = car.get_actor_location()
    hit = u.SystemLibrary.box_trace_single_by_profile(world, before, before + car.get_actor_forward_vector() * 2000,
        u.Vector(235, 110, 80), car.get_actor_rotation(), "Pawn", False, ignored, u.DrawDebugTrace.NONE, True)
    if hit:
        obstruction = gameplay.call_method("BreakHitResult", (hit,))
        REPORT["driving_fixture"]["parked_forward_obstruction"] = {
            "actor": obstruction[9].get_name() if obstruction[9] else None, "distance_cm": round(obstruction[3], 1)}
    yaw = math.radians(LAYOUT["car_yaw"])
    forward, right = u.Vector(math.cos(yaw), math.sin(yaw), 0), u.Vector(-math.sin(yaw), math.cos(yaw), 0)
    rotation = u.Rotator(yaw=LAYOUT["car_yaw"])
    for along in (0, -500, -1000, -1500):
        point = u.Vector(*LAYOUT["car"]) + right * 145 + forward * along
        hit = u.SystemLibrary.line_trace_single(world, point + u.Vector(0, 0, 200), point + u.Vector(0, 0, -300),
            u.TraceTypeQuery.TRACE_TYPE_QUERY1, True, ignored, u.DrawDebugTrace.NONE, True)
        if not hit:
            continue
        ground = gameplay.call_method("BreakHitResult", (hit,))
        if ground[7].z < .7 or not -200 < ground[5].z < 50:
            continue
        point = ground[5] + u.Vector(0, 0, 102)
        if u.SystemLibrary.box_trace_single_by_profile(world, point, point + forward * 2000,
                u.Vector(235, 110, 80), rotation, "Pawn", False, ignored, u.DrawDebugTrace.NONE, True):
            continue
        car.set_actor_location_and_rotation(point, rotation, False, True)
        STATE["drive_lane"] = point
        REPORT["driving_fixture"].update({"from_cm": [before.x, before.y, before.z], "to_cm": [point.x, point.y, point.z],
            "forward_sweep_clear_cm": 2000, "right_lane_offset_cm": 145,
            "scope": "PIE-only occupied car relocation after native curb spawn, entry and occupancy checks"})
        return
    raise AssertionError("No clear grounded mapped lane for native drive/brake/steering checks")


def approach_target_car(character=None):
    car = STATE["server_car"]
    character = character or STATE["server_char"]
    right, forward = car.get_actor_right_vector(), car.get_actor_forward_vector()
    for offset in (right * 185, right * -185, forward * 300, forward * -300):
        point = car.get_actor_location() + offset
        if any(other != car and not other.get_controller() and not other.get_editor_property("Occupant") and
               distance(other.get_actor_location(), point) <= 450
               for other in actors(STATE["server"], "Car")):
            continue
        if u.SystemLibrary.capsule_trace_single_by_profile(STATE["server"], point, point + u.Vector(0, 0, .1),
                42, 88, "Pawn", False, [character], u.DrawDebugTrace.NONE, True):
            continue
        character.set_actor_location(point, False, True)
        STATE["car_approach"] = point
        return
    raise AssertionError("No clear standing position isolates the target car's interaction range")


def drive():
    if elapsed() < 1.2:
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
    limit = 150 + (2400 * .25 if "network_emulation" in REPORT else 0)
    assert delta < limit, "Client car did not follow replicated server movement"
    REPORT["replicated_car_error_limit_cm"] = round(limit, 1)
    REPORT["replicated_car_error_cm"] = round(delta, 1)
    return True


def brake_arrived():
    if elapsed() < 1:
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


def start_steering():
    STATE["steering_yaw"] = STATE["server_car"].get_actor_rotation().yaw
    start_drive()
    STATE["client_car"].call_method("MoveRight", (.4,))


def steering_replicated():
    if elapsed() < 1:
        return False
    changes = [abs((STATE[side + "_car"].get_actor_rotation().yaw - STATE["steering_yaw"] + 180) % 360 - 180)
               for side in ("server", "client")]
    assert min(changes) > 5, "Native client steering did not turn both authority and replicated car"
    REPORT["steering_yaw_change_degrees"] = [round(value, 1) for value in changes]
    STATE["client_car"].call_method("MoveRight", (0.,))
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
    assert not STATE["client_pc"].get_editor_property("ResidentCaption"), "Successful exit retained stale interaction feedback"
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


def host_drive_hides_crew():
    # The client drops the host's parked character after about 5 s; the replicated worn crew still hides that resident.
    if elapsed() < 6:
        return False
    worn = {STATE[side + "_char"].get_editor_property("CrewStyle") for side in ("host", "client")}
    for resident in actors(STATE["client"], "ParkResident"):
        if not resident.actor_has_tag("CityCrowd"):
            assert resident.get_editor_property("hidden") == (resident.get_editor_property("Style") in worn), \
                "Client shows a resident wearing a player's crew member"
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
    if "-NordRenderChecks" in u.SystemLibrary.get_command_line():
        LEVELS.editor_set_viewport_realtime(False)
        STATE["viewport_realtime_override"] = True
    SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", 1))
    SETTINGS.set_editor_property("PlayNumberOfClients", 2)
    SETTINGS.set_editor_property("RunUnderOneProcess", True)
    LEVELS.editor_request_begin_play()



def barrier(position, size):
    # PIE-only geometry exercises native visibility and capsule queries; never save these actors.
    gameplay = u.get_default_object(u.load_class(None, "/Script/Engine.GameplayStatics"))
    transform = u.Transform(position, u.Rotator(), u.Vector(*(value / 100 for value in size)))
    actor = gameplay.call_method("BeginDeferredActorSpawnFromClass", (
        STATE["server"], u.StaticMeshActor, transform, u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN,
        None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
    assert actor, "Could not create interaction barrier"
    component = actor.static_mesh_component
    component.set_mobility(u.ComponentMobility.MOVABLE)
    assert component.set_static_mesh(u.load_asset("/Engine/BasicShapes/Cube.Cube"))
    component.set_collision_profile_name("BlockAll")
    gameplay.call_method("FinishSpawningActor", (actor, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
    return actor



def speed_equal(value):
    return all(abs(STATE[side + "_char"].get_component_by_class(u.CharacterMovementComponent).get_editor_property("max_walk_speed") - value) < 1 for side in ("server", "client"))


def comic_weights(client_weight, host_weight):
    for pc, expected in ((STATE["client_pc"], client_weight), (STATE["host_pc"], host_weight)):
        camera = pc.get_controlled_pawn().get_component_by_class(u.CameraComponent)
        entries = camera.get_editor_property("post_process_settings").get_editor_property("weighted_blendables").get_editor_property("array")
        comic = [entry for entry in entries if entry.get_editor_property("object").get_path_name() == "/Game/Art/Comic/M_ComicInk.M_ComicInk"]
        if len(comic) != 1 or abs(comic[0].get_editor_property("weight") - expected) > .01:
            return False
    for side in ("client", "server"):
        assert STATE[side + "_char"].get_component_by_class(u.SkeletalMeshComponent).get_component_tick_interval() == 0
    return True


def jump_visible():
    return all(STATE[side + "_char"].get_actor_location().z > STATE["jump_z"] + 50 for side in ("server", "client"))


def begin_jump():
    STATE["jump_z"] = STATE["server_char"].get_actor_location().z
    u.SystemLibrary.set_timer_for_next_tick(STATE["client_char"], "Jump")


def begin_foot_move(axis):
    STATE["foot_axis"] = axis
    STATE["foot_start"] = STATE["server_char"].get_actor_location()
    # Both axes use an unobstructed stretch along the road, away from the parked car.
    STATE["client_pc"].set_control_rotation(u.Rotator(yaw=LAYOUT["car_yaw"] - (90 if axis == "MoveRight" else 0)))


def foot_move_replicated():
    if elapsed() < 1:
        return False
    axis = STATE.pop("foot_axis")
    changes = [distance(STATE[side + "_char"].get_actor_location(), STATE["foot_start"]) for side in ("server", "client")]
    assert min(changes) > (350 if axis == "MoveRight" else 200), f"Native {axis} input failed to move both peers: {changes}"
    REPORT.setdefault("foot_displacement_cm", {})[axis] = [round(value, 1) for value in changes]
    return True


def block_car_view():
    car = STATE["server_car"]
    delta = STATE["server_char"].get_actor_location() - car.get_actor_location()
    wall = barrier(car.get_actor_location() + delta * .5 + u.Vector(0, 0, 100), (600, 30, 600))
    wall.set_actor_rotation(u.Rotator(yaw=math.degrees(math.atan2(delta.y, delta.x)) + 90), False)
    STATE["barriers"] = [wall]
    interact()


def blocked_entry():
    assert STATE["server_pc"].get_controlled_pawn() == STATE["server_char"], "Entered through a wall"
    assert not STATE["server_car"].get_editor_property("Occupant")
    assert missions_equal(0)
    return True


def remove_barriers():
    for actor in STATE.pop("barriers", []):
        actor.destroy_actor()


def occupied_attempt():
    approach_target_car(STATE["host_char"])
    host_interact()


def occupied_rejected():
    assert STATE["host_pc"].get_controlled_pawn() == STATE["host_char"], "Host stole an occupied car"
    assert STATE["server_car"].get_editor_property("Occupant") == STATE["server_char"]
    return entered()


def block_car_exits():
    stop_drive()
    car = STATE["server_car"]
    STATE["barriers"] = [barrier(car.get_actor_location() + offset, (120, 120, 1000)) for offset in (
        car.get_actor_right_vector() * 210, car.get_actor_right_vector() * -210,
        car.get_actor_forward_vector() * -350)]
    interact()


def settle_before_barriers():
    if elapsed() < 1.2:
        return False
    if "barrier_settle_position" not in STATE:
        STATE["barrier_settle_position"] = STATE["server_car"].get_actor_location()
        STATE["barrier_settle_time"] = elapsed()
        return False
    if elapsed() - STATE["barrier_settle_time"] < .3:
        return False
    assert distance(STATE["server_car"].get_actor_location(), STATE["barrier_settle_position"]) < 5, "Exit fixtures require a stationary car"
    return True


def blocked_exit():
    assert STATE["server_pc"].get_controlled_pawn() == STATE["server_car"], "Blocked exit lost its driver"
    assert STATE["server_car"].get_editor_property("Occupant") == STATE["server_char"]
    assert STATE["server_char"].get_editor_property("bHidden")
    assert not STATE["server_char"].get_actor_enable_collision()
    assert "DOORS BLOCKED" in STATE["client_pc"].get_editor_property("ResidentCaption"), "Blocked exit has no visible feedback"
    assert not STATE["host_pc"].get_editor_property("ResidentCaption"), "Blocked exit feedback leaked to host"
    return True


def place_car_at_objective():
    car = STATE["server_car"]
    STATE["priority_car_transform"] = car.get_actor_transform()
    STATE["priority_character_position"] = STATE["server_char"].get_actor_location()
    car.set_actor_location(TARGETS[0] + u.Vector(0, 300, 0), False, True)
    teleport(TARGETS[0])


def restore_priority_fixture():
    STATE["server_car"].set_actor_transform(STATE.pop("priority_car_transform"), False, True)
    teleport(STATE.pop("priority_character_position"))


def next_character():
    u.SystemLibrary.set_timer_for_next_tick(STATE["client_pc"], "NextCharacter")


def crew_ready(style):
    for side in ("server", "client"):
        character = STATE[side + "_char"]
        if character.get_editor_property("CrewStyle") != style:
            return False
        mesh = character.get_component_by_class(u.SkeletalMeshComponent).get_editor_property("skinned_asset")
        if not mesh or f"/Crew/Resident{style}/SK_Body" not in mesh.get_path_name():
            return False
    assert STATE["host_char"].get_editor_property("CrewStyle") == 9, "Client changed host appearance"
    assert missions_equal(0), "Appearance switching changed missions"
    return True


step("two connected players in server and client worlds", begin, discover)
step("both players start in standard view with full-rate animation", lambda: None, lambda: comic_weights(0, 0))
# Establish the comic baseline used by the existing toggle and capture checks.
step("both players enable comic view independently",
     lambda: [u.SystemLibrary.set_timer_for_next_tick(STATE[side + "_pc"], "ToggleComicStyle") for side in ("host", "client")],
     lambda: comic_weights(1, 1))
WALK_START = u.Vector(*LAYOUT["car"]) + u.Vector(math.cos(math.radians(LAYOUT["car_yaw"])), math.sin(math.radians(LAYOUT["car_yaw"])), 0) * 1000
step("client joins as a crew member the host is not playing", lambda: None, lambda: crew_ready(10))
# C cycles the other seven styles and skips 9, which the host wears.
for crew_style in (3, 4, 5, 6, 7, 8, 10):
    step(f"client selects supplied crew {crew_style}; appearance replicates independently", next_character, lambda style=crew_style: crew_ready(style))
step("walking fixture reaches owning client", lambda: teleport(WALK_START), lambda: teleported(WALK_START))
step("native client forward walking reaches authority", lambda: begin_foot_move("MoveForward"), foot_move_replicated)
step("client sprint predicts locally and reaches authority", lambda: u.SystemLibrary.set_timer_for_next_tick(STATE["client_char"], "StartSprint"), lambda: speed_equal(800))
step("native client strafing while sprinting reaches authority", lambda: begin_foot_move("MoveRight"), foot_move_replicated)
step("sprint release restores walking speed on both peers", lambda: u.SystemLibrary.set_timer_for_next_tick(STATE["client_char"], "StopSprint"), lambda: speed_equal(450))
step("client jump moves both authority and owning client", begin_jump, jump_visible)
step("jump lands on saved-map ground", lambda: u.SystemLibrary.set_timer_for_next_tick(STATE["client_char"], "StopJumping"), lambda: all(not STATE[side + "_char"].get_component_by_class(u.CharacterMovementComponent).is_falling() for side in ("server", "client")))
step("client disables comic view without affecting host", lambda: u.SystemLibrary.set_timer_for_next_tick(STATE["client_pc"], "ToggleComicStyle"), lambda: comic_weights(0, 1))
step("restore far-interaction fixture", prepare_far_interaction, lambda: teleported(STATE["far_point"]))
step("out-of-range client interaction rejected", far_interact, far_rejected)
step("starter spawns beside its mapped raised curb", check_starter_parking,
     lambda: distance(STATE["client_car"].get_actor_location(), STATE["starter_position"]) < 120)
step("authority teleport replicated to owning client", approach_target_car,
     lambda: teleported(STATE["car_approach"]) and distance(STATE["client_char"].get_actor_location(), STATE["client_car"].get_actor_location()) < 450)
step("wall between player and car rejects entry", block_car_view, blocked_entry)
step("remove entry barrier", remove_barriers, lambda: True)
step("client RPC enters car; occupant, visibility and collision replicate", interact, entered)
step("host cannot steal an occupied car", occupied_attempt, occupied_rejected)
step("car camera preserves client standard view and host comic view", lambda: None, lambda: comic_weights(0, 1))
step("client switches avatar while driving and retains occupancy", next_character, lambda: crew_ready(3) and entered())
step("place occupied car in a clear mapped driving lane", prepare_driving_lane,
     lambda: entered() and distance(STATE["server_car"].get_actor_location(), STATE["drive_lane"]) < 5 and
     distance(STATE["client_car"].get_actor_location(), STATE["drive_lane"]) < 120)
step("client drive RPC moves authority car", start_drive, drive)

def begin_input_dropout():
    u.SystemLibrary.execute_console_command(STATE["client"], "NetEmulation.PktLoss 100", STATE["client_pc"])
    stop_drive()


def wait_for_stale_input():
    if elapsed() < 5:
        return False
    STATE["dropout_position"] = STATE["server_car"].get_actor_location()
    return True


def stale_input_stopped():
    if elapsed() < .6:
        return False
    drift = distance(STATE["server_car"].get_actor_location(), STATE["dropout_position"])
    REPORT["input_dropout_drift_cm"] = round(drift, 1)
    assert drift < 10, "Server kept driving on stale input after the client stopped sending"
    u.SystemLibrary.execute_console_command(STATE["client"], "NetEmulation.Off", STATE["client_pc"])
    stop_drive()
    return True


if "-NordDropout" in u.SystemLibrary.get_command_line():
    step("stop sending client packets while driving", begin_input_dropout, wait_for_stale_input)
    step("authority stops accepting stale drive input", lambda: None, stale_input_stopped)
step("car movement replicates to client", stop_drive, movement_replicated)
step("client handbrake reaches server and stops car", lambda: STATE["client_car"].call_method("ApplyHandbrake"), brake_arrived)
step("handbrake holds against throttle", lambda: None, brake_holds)
step("releasing handbrake restores acceleration", lambda: STATE["client_car"].call_method("ReleaseHandbrake"), brake_released)
step("native client steering turns the authority and replicated car", start_steering, steering_replicated)
step("stop car before placing blocked-exit fixtures", lambda: STATE["client_car"].call_method("ApplyHandbrake"), settle_before_barriers)
step("all blocked car exits preserve driver safely", block_car_exits, blocked_exit)
step("remove exit barriers", remove_barriers, lambda: True)
step("client RPC exits car and restores character on both peers", interact, exited)
step("client restores comic view after exiting", lambda: u.SystemLibrary.set_timer_for_next_tick(STATE["client_pc"], "ToggleComicStyle"), lambda: comic_weights(1, 1))
step("place available car beside the current objective", place_car_at_objective,
     lambda: teleported(TARGETS[0]) and distance(STATE["client_char"].get_actor_location(), STATE["client_car"].get_actor_location()) < 450)
step("car interaction takes priority without completing the nearby objective", interact, lambda: entered() and missions_equal(0))
step("priority-test driver exits with objective progress preserved", interact, lambda: exited() and missions_equal(0))
step("restore parked car after interaction priority check", restore_priority_fixture, lambda: True)
step("listen host approaches the empty car",
     lambda: approach_target_car(STATE["host_char"]),
     lambda: distance(STATE["host_char"].get_actor_location(), STATE["server_car"].get_actor_location()) < 450)
step("listen host interaction enters car", host_interact, host_entered)
step("client keeps the driving host's crew member off the residents", lambda: None, host_drive_hides_crew)
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
    saved=[a for a in server if not a.actor_has_tag('CityCrowd')]
    ambient=[a for a in server if a.actor_has_tag('CityCrowd')]
    assert len(saved)==14 and len(ambient)==96, {'saved_residents':len(saved),'ambient_residents':len(ambient)}
    assert all(a.get_actor_tick_interval() == 0 for a in server + client), 'Saved or ambient resident still throttles pose evaluation'
    saved_names={a.get_name() for a in saved}
    client_saved=[a for a in client if a.get_name() in saved_names]
    if len(client_saved)!=14:return False
    assert {a.get_editor_property('Style') for a in client_saved}==set(range(11))
    assert {a.get_editor_property('Style') for a in ambient}==set(range(3,11))
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
    if STATE.get('resident_client_world')!=STATE['client']:
        worn={STATE[side+'_char'].get_editor_property('CrewStyle') for side in ('host','client')}
        # A resident wearing a player's crew style is hidden and cannot be talked to.
        for a in saved+ambient:
            assert a.get_editor_property('hidden')==(a.get_editor_property('Style') in worn),'Player crew must not also walk as a resident'
        crew=[a for a in saved if a.get_editor_property('Style')>=3 and a.get_editor_property('Style') not in worn]
        STATE['resident']=max(crew,key=lambda a:min(distance(a.get_actor_location(),b.get_actor_location()) for b in server if b!=a))
        STATE['resident_client_world']=STATE['client']
        # Distance culling deliberately skips remote poses; approach before recording a foot pose.
        teleport(STATE['resident'].get_actor_location()+STATE['resident'].get_actor_right_vector()*150+u.Vector(0,0,100))
        return False
    STATE['resident_client']=next((a for a in client_saved if a.get_name()==STATE['resident'].get_name()),None)
    if not STATE['resident_client'] or not resident_near():return False
    if distance(STATE['resident'].get_actor_location(),STATE['resident_client'].get_actor_location())>60:return False
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

step('fourteen saved residents plus ninety-six ambient walkers and supplied crew styles',lambda:None,residents_ready)
step('resident route movement replicates',lambda:None,resident_moved)
step('client approaches cottage crew member',approach_resident,resident_near)
step('client E talks to crew without changing completed missions or host dialogue',interact,resident_talked)




def start_packaged_peer():
    import subprocess
    assert STATE["host_char"].get_editor_property("CrewStyle") == 9
    # Give the late peer two distinct native player selections to verify.
    u.SystemLibrary.set_timer_for_next_tick(STATE["host_pc"], "NextCharacter")
    root = Path(u.Paths.project_dir()).resolve()
    runner = root / "Builds/Linux/Quebec.sh"
    assert runner.is_file(), "Build the Linux package before -NordPackagedPeer"
    log = root / "Saved/Tests/PackagedLateJoin.log"
    log.unlink(missing_ok=True)
    output = (root / "Saved/Tests/PackagedLateJoin.stdout.log").open("w")
    process = subprocess.Popen(["bash", str(runner), "127.0.0.1:17777", "-nullrhi", "-unattended", "-nosound",
        "-ExecCmds=t.MaxFPS 60", "-csvCaptureFrames=1800",
        "-csvExecCmds=" + ",".join("r180:" + command for command in ("getall QuebecGameState MissionIndex", "getall QuebecParkResident Style", "getall SkeletalMeshComponent SkinnedAsset", "getall QuebecCharacter CrewStyle")),
        "-abslog=" + str(log)], stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    STATE.update(packaged_peer=process, packaged_output=output, packaged_log=log)


def packaged_peer_joined():
    import re
    process = STATE["packaged_peer"]
    assert process.poll() is None, "Packaged late-join client exited"
    text = STATE["packaged_log"].read_text(errors="replace") if STATE["packaged_log"].exists() else ""
    if "Welcomed by server" not in text or len(actors(STATE["server"], "Controller")) != 3:
        return False
    if not re.search(r"MissionIndex = 3", text):
        return False
    styles = set(re.findall(r"(?<!Crew)Style = (\d+)", text))
    bodies = set(re.findall(r"/Game/ParkComic/Crew/Resident(\d+)/SK_Body", text))
    if styles != set(map(str, range(11))) or bodies != set(map(str, range(3, 11))):
        return False
    if "CrewStyle = 10" not in text or "CrewStyle = 9" not in text:
        return False
    REPORT["packaged_late_join"] = {"mission_index": 3, "resident_styles": 11, "skeletal_crew": 8, "server_players": 3}
    return True


def stop_packaged_peer():
    import os
    import signal
    process = STATE.pop("packaged_peer", None)
    if process and process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=5)
        except Exception:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=5)
    output = STATE.pop("packaged_output", None)
    if output:
        output.close()


if "-NordPackagedPeer" in u.SystemLibrary.get_command_line():
    step("separate packaged peer late-joins completed session and loads crew", start_packaged_peer, packaged_peer_joined)
    step("separate peer departure restores two-player session", stop_packaged_peer,
         lambda: len(actors(STATE["server"], "Controller")) == 2 and missions_equal(3))


def disconnect_driver():
    STATE["departing_character"] = STATE["server_char"]
    u.SystemLibrary.execute_console_command(STATE["client"], "disconnect", STATE["client_pc"])


def driver_cleaned_up():
    pcs = actors(STATE["server"], "Controller")
    if len(pcs) != 1:
        return False
    car = STATE["server_car"]
    assert not car.get_editor_property("Occupant") and not car.get_controller(), "Disconnected driver stranded car occupancy"
    assert not car.get_editor_property("bHandbrake"), "Disconnected driver stranded handbrake"
    assert not any(actor is STATE["departing_character"] for actor in actors(STATE["server"], "Character")), "Hidden walking pawn leaked after disconnect"
    assert len(actors(STATE["server"], "Character")) == 1
    assert mission(STATE["server"]) == 3
    return True


def reconnect():
    clients = [world for world in u.EditorLevelLibrary.get_pie_worlds(True) if world != STATE["server"]]
    assert len(clients) == 1, "Disconnected client world is unavailable"
    pc = u.GameplayStatics.get_player_controller(clients[0], 0)
    assert pc, "Disconnected client has no local controller"
    u.SystemLibrary.execute_console_command(clients[0], "open 127.0.0.1:17777", pc)


def rejoined():
    server = STATE["server"]
    remote = next((pc for pc in actors(server, "Controller") if not pc.is_local_controller()), None)
    clients = [world for world in u.EditorLevelLibrary.get_pie_worlds(True) if world != server and not u.GameplayStatics.get_game_mode(world)]
    if not remote or not remote.get_controlled_pawn() or not clients:
        return False
    client = clients[0]
    local = u.GameplayStatics.get_player_controller(client, 0)
    if not local or not local.get_controlled_pawn() or mission(client) != 3:
        return False
    if len(u.GameplayStatics.get_game_state(client).get_editor_property("PlayerArray")) != 2:
        return False
    client_car = next((car for car in actors(client, "Car") if car.get_name() == STATE["server_car"].get_name()), None)
    if not client_car:
        return False
    STATE.update(client=client, client_pc=local, server_pc=remote,
                 server_char=remote.get_controlled_pawn(), client_char=local.get_controlled_pawn(),
                 client_car=client_car)
    assert not STATE["client_char"].get_editor_property("bHidden")
    return residents_ready()

step("client approaches car before disconnect test", approach_target_car,
     lambda: teleported(STATE["car_approach"]) and distance(STATE["client_char"].get_actor_location(), STATE["client_car"].get_actor_location()) < 450)
step("client enters car before disconnect", interact, entered)
step("disconnecting driver releases car and destroys hidden pawn", disconnect_driver, driver_cleaned_up)
step("reconnecting client receives completed missions and all residents", reconnect, rejoined)
step("rejoined player approaches abandoned car", approach_target_car,
     lambda: teleported(STATE["car_approach"]) and distance(STATE["client_char"].get_actor_location(), STATE["client_car"].get_actor_location()) < 450)
step("rejoined client can take the released car", interact, entered)
step("rejoined client exits with completed missions preserved", interact, lambda: exited() and missions_equal(3))



def capture_check(name):
    if "-NordRenderChecks" not in u.SystemLibrary.get_command_line():
        return
    shots = {"client disables comic view without affecting host": "StandardFoot",
        "authority teleport replicated to owning client": "CarPrompt",
        "car camera preserves client standard view and host comic view": "StandardCar",
        "place available car beside the current objective": "InteractionPriority",
        "all blocked car exits preserve driver safely": "BlockedExit",
        "mission 1 advances and replicates": "MissionComplete",
        "client E talks to crew without changing completed missions or host dialogue": "CrewDialogue"}
    if name.startswith("client selects supplied crew "):
        style = STATE["client_char"].get_editor_property("CrewStyle")
        shots[name] = "PlayableCrew" + str(style)
        yaw = STATE["client_char"].get_actor_rotation().yaw + 180
        STATE["client_pc"].set_control_rotation(u.Rotator(pitch=-8, yaw=yaw))
    if name not in shots:
        return
    assert u.GameplayStatics.get_enable_world_rendering(STATE["client"]), "Inspection client must render"
    assert not u.GameplayStatics.get_enable_world_rendering(STATE["server"]), "Inspection host rendering must be disabled"
    import re
    commandline = u.SystemLibrary.get_command_line()
    match = re.search(r"-NordCaptureWidth=(1280|1920)(?: |$)", commandline)
    width = int(match.group(1)) if match else 1280
    height = width * 9 // 16
    path = Path(u.Paths.project_dir()).resolve() / "Preview" / ("Quality" + str(width) + "_" + shots[name] + ".png")
    path.parent.mkdir(exist_ok=True)
    path.unlink(missing_ok=True)
    u.SystemLibrary.execute_console_command(STATE["client"], 'HighResShot ' + str(width) + 'x' + str(height) + ' filename="' + str(path) + '"', STATE["client_pc"])
    REPORT.setdefault("render_captures", []).append({"path": str(path.relative_to(Path(u.Paths.project_dir()).resolve())), "width": width, "height": height})
    STATE["capture_path"] = path
    return True


def finish(error=None):
    STATE["finished"] = True
    if error is None:
        import struct
        for capture in REPORT.get("render_captures", []):
            data = (Path(u.Paths.project_dir()) / capture["path"]).read_bytes()
            assert data[:8] == b"\x89PNG\r\n\x1a\n" and struct.unpack(">II", data[16:24]) == (capture["width"], capture["height"]), capture
    REPORT["passed"] = error is None
    REPORT["elapsed_seconds"] = round(time.monotonic() - STATE["started"], 2)
    if error:
        REPORT["error"] = error
        u.log_error("NORD_SMOKE_FAILED " + error)
    else:
        u.log("NORD_SMOKE_OK " + str(len(REPORT["checks"])) + " checks passed")
    try:
        stop_packaged_peer()
        remove_barriers()
        LEVELS.editor_request_end_play()
        for name, value in ORIGINAL.items():
            SETTINGS.set_editor_property(name, value)
        SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", ORIGINAL_MODE))
    finally:
        if STATE.pop("viewport_realtime_override", False):
            LEVELS.editor_set_viewport_realtime(True)
            REPORT["editor_viewport_realtime_override_released"] = True
        commandline = u.SystemLibrary.get_command_line()
        name = "SmokePackagedPeer" if "-NordPackagedPeer" in commandline else "SmokeDropout" if "-NordDropout" in commandline else "SmokeLag" if "-NordLag" in commandline else "SmokeRender" + str(REPORT["render_captures"][0]["width"]) if REPORT.get("render_captures") else "Smoke"
        path = Path(u.Paths.project_saved_dir()) / "Tests" / (name + ".json")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
        u.unregister_slate_post_tick_callback(STATE["callback"])
        u.get_default_object(u.load_class(None, "/Script/PythonScriptPlugin.EditorPythonScriptingLibrary")).call_method(
            "SetKeepPythonScriptAlive", (False,))


def tick(delta_seconds):
    if STATE["finished"] or STATE.get("ticking"):
        return
    # HighResShot can pump Slate recursively while this callback is executing.
    STATE["ticking"] = True
    try:
        now = time.monotonic()
        assert now - STATE["started"] < 120, "Timeout while testing: " + STEPS[max(STATE["step"], 0)][0]
        if now < STATE.get("capture_until", 0) or (STATE.get("capture_path") and not STATE["capture_path"].exists()):
            return
        if STATE["step"] == -1:
            if now - STATE["started"] < 1:
                return
            STATE["step"] = 0
            start_step(now)
        name, action, ready = STEPS[STATE["step"]]
        if STATE.get("foot_axis"):
            STATE["client_char"].call_method(STATE["foot_axis"], (1.,))
        if elapsed() < 0.45 or not ready():
            return
        if STATE.get("captured_step") != STATE["step"] and capture_check(name):
            # Screenshot requests are global and complete asynchronously in both PIE viewports.
            STATE.update(captured_step=STATE["step"], capture_until=time.monotonic() + 2)
            return
        REPORT["checks"].append(name)
        u.log("NORD_SMOKE_CHECK " + name)
        STATE["step"] += 1
        if STATE["step"] == len(STEPS):
            finish()
            return
        start_step(now)
    except Exception:
        finish(traceback.format_exc())
    finally:
        STATE["ticking"] = False


STATE["callback"] = u.register_slate_post_tick_callback(tick)
u.log("NORD_SMOKE_START awaiting two-player PIE")
