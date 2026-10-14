"""Headless PIE regression: UnrealEditor -nullrhi -unattended -ExecutePythonScript=Scripts/car_collision_test.py."""
import configparser
import json
from pathlib import Path
import time
import traceback
import unreal as u


SCRIPTING = u.get_default_object(u.load_class(None, "/Script/PythonScriptPlugin.EditorPythonScriptingLibrary"))
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, "/Script/UnrealEd.LevelEditorPlaySettings"))
SYSTEM = u.get_default_object(u.load_class(None, "/Script/Engine.KismetSystemLibrary"))
GAMEPLAY = u.get_default_object(u.load_class(None, "/Script/Engine.GameplayStatics"))
ORIGINAL = {name: SETTINGS.get_editor_property(name) for name in ("PlayNumberOfClients", "RunUnderOneProcess")}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / "Config/LinuxEditor/EditorPerProjectUserSettings.ini")
ORIGINAL_MODE = {"PIE_Standalone": 0, "PIE_ListenServer": 1, "PIE_Client": 2}[
    CONFIG.get("/Script/UnrealEd.LevelEditorPlaySettings", "PlayNetMode", fallback="PIE_Standalone")]
CAR_CLASS = u.load_class(None, "/Script/Quebec.QuebecCar")
PC_CLASS = u.load_class(None, "/Script/Quebec.QuebecController")
CUBE = u.load_asset("/Engine/BasicShapes/Cube.Cube")
REPORT = {"passed": False, "checks": [], "cases": {}, "mode": "standalone authoritative PIE",
          "skipped": ["remote-client driving", "network latency", "Chaos suspension"]}
STATE = {"started": time.monotonic(), "step": -1, "finished": False, "fixtures": []}
STEPS = []
LANE_Y = -100000.0


def step(name, action, ready):
    STEPS.append((name, action, ready))


def begin():
    world = u.EditorLevelLibrary.get_editor_world()
    assert world.get_path_name().startswith("/Game/Maps/LaFontaine."), "Open LaFontaine before running"
    surfaces = {"OSM Road", "OSM Path", "OSM Marking"}
    found = set()
    for actor in u.GameplayStatics.get_all_actors_of_class(world, u.StaticMeshActor):
        if actor.get_actor_label() in surfaces:
            found.add(actor.get_actor_label())
            assert actor.static_mesh_component.get_collision_enabled() == u.CollisionEnabled.NO_COLLISION
    assert found == surfaces, "Missing imported road surfaces"
    REPORT["checks"].append("saved-map road surfaces and markings do not collide")
    SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", 0))
    SETTINGS.set_editor_property("PlayNumberOfClients", 1)
    SETTINGS.set_editor_property("RunUnderOneProcess", True)
    LEVELS.editor_request_begin_play()


def fixture(position, size):
    transform = u.Transform(u.Vector(*position), u.Rotator(), u.Vector(*(value / 100 for value in size)))
    actor = GAMEPLAY.call_method("BeginDeferredActorSpawnFromClass", (
        STATE["world"], u.StaticMeshActor, transform, u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN,
        None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
    assert actor, "Could not spawn PIE-only fixture"
    STATE["fixtures"].append(actor)
    component = actor.static_mesh_component
    component.set_mobility(u.ComponentMobility.MOVABLE)
    assert component.set_static_mesh(CUBE), "Fixture mesh was not assigned"
    component.set_collision_profile_name("BlockAll")
    component.set_collision_enabled(u.CollisionEnabled.QUERY_AND_PHYSICS)
    GAMEPLAY.call_method("FinishSpawningActor", (actor, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
    assert actor in u.GameplayStatics.get_all_actors_of_class(STATE["world"], u.StaticMeshActor), "Fixture escaped the PIE world"
    return actor


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    world = next((world for world in worlds if u.GameplayStatics.get_game_mode(world)), None)
    if not world:
        return False
    pcs = u.GameplayStatics.get_all_actors_of_class(world, PC_CLASS)
    cars = u.GameplayStatics.get_all_actors_of_class(world, CAR_CLASS)
    pc = next((pc for pc in pcs if pc.is_local_controller() and pc.get_controlled_pawn()), None)
    if not pc or not cars:
        return False
    STATE.update(world=world, pc=pc, car=cars[0], character=pc.get_controlled_pawn())
    fixture((0, LANE_Y, -50), (10000, 3000, 100))
    STATE["character"].set_actor_location(cars[0].get_actor_location() + u.Vector(0, 260, 0), False, True)
    u.SystemLibrary.set_timer_for_next_tick(pc, "Interact")
    return True


def entered():
    car, pc = STATE["car"], STATE["pc"]
    if pc.get_controlled_pawn() != car:
        return False
    assert car.get_editor_property("Occupant") == STATE["character"], "Car has no real occupant"
    car.disable_input(pc)
    return True


def prepare(name, start, height, width, direction, target):
    if STATE.get("obstacle"):
        STATE["obstacle"].destroy_actor()
    STATE["obstacle"] = fixture((width / 2, LANE_Y, height / 2), (width, 1000, height))
    STATE["car"].call_method("MoveForward", (0.0,))
    STATE.update(case=name, direction=direction, target=target, start_x=start, max_z=0.0, reset=False)


def prepare_marking():
    car = STATE["car"]
    car.call_method("MoveForward", (0.0,))
    layout = json.loads((Path(u.Paths.project_dir()) / "Data/LaFontaine/layout.json").read_text())
    car.set_actor_location_and_rotation(u.Vector(*layout["car"]), u.Rotator(yaw=layout["car_yaw"]), False, True)
    STATE.update(case="saved_street_marking", direction=1.0, target=layout["car"][0]+160,
                 start_x=layout["car"][0], max_z=0.0)


def marking_settled():
    return time.monotonic() - STATE["step_started"] > 0.7


def settled():
    elapsed = time.monotonic() - STATE["step_started"]
    # Coasting from the 2400cm/s speed cap takes at most 3s at 800cm/s²; do not modify hidden car state.
    if elapsed < 3.2:
        return False
    if not STATE["reset"]:
        STATE["car"].set_actor_location_and_rotation(u.Vector(STATE["start_x"], LANE_Y, 140), u.Rotator(), False, True)
        STATE["reset"] = True
        STATE["reset_at"] = time.monotonic()
        return False
    if time.monotonic() - STATE["reset_at"] < 0.7:
        return False
    location = STATE["car"].get_actor_location()
    assert abs(location.z - 100) < 2, "Car did not settle on the fixture floor: " + str(location)
    return True


def drive():
    STATE["car"].call_method("MoveForward", (STATE["direction"],))


def crossed():
    location = STATE["car"].get_actor_location()
    STATE["max_z"] = max(STATE["max_z"], location.z)
    progress = (location.x - STATE["target"]) * STATE["direction"]
    elapsed = time.monotonic() - STATE["step_started"]
    assert elapsed < 6, STATE["case"] + " blocked the car at " + str(location)
    if progress < 0:
        return False
    if STATE["case"].startswith("18cm_curb"):
        assert abs(location.z - 118) < 3, "Full car did not land on the 18cm platform: " + str(location)
    assert STATE["max_z"] < 145, "Car climbed higher than the fixture"
    REPORT["cases"][STATE["case"]] = {"x_cm": round(location.x, 2), "z_cm": round(location.z, 2),
                                         "max_z_cm": round(STATE["max_z"], 2)}
    STATE["car"].call_method("MoveForward", (0.0,))
    return True


def blocked():
    if time.monotonic() - STATE["step_started"] < 3:
        return False
    location = STATE["car"].get_actor_location()
    # Wall begins at x=0; the fitted front bumper extends 233cm.
    assert -240 < location.x < -225, "Tall wall was crossed, or car never reached it: " + str(location)
    assert abs(location.z - 100) < 3, "Car climbed the tall wall"
    REPORT["cases"]["600cm_wall"] = {"x_cm": round(location.x, 2), "z_cm": round(location.z, 2)}
    STATE["car"].call_method("MoveForward", (0.0,))
    return True


step("authoritative PIE world and isolated collision floor", begin, discover)
step("host enters the actual car through native interaction", lambda: None, entered)
step("settle on saved-map avenue", prepare_marking, marking_settled)
step("drive fully across an existing decorative street marking", drive, crossed)
for name, start, height, width, direction, target in (
        ("2cm_strip", -1200, 2, 80, 1.0, 400),
        ("18cm_curb_forward", -1200, 18, 1400, 1.0, 700),
        ("18cm_curb_reverse", 2600, 18, 1400, -1.0, 700)):
    step("settle before " + name,
         lambda args=(name, start, height, width, direction, target): prepare(*args), settled)
    step("drive across " + name, drive, crossed)
step("settle before tall wall", lambda: prepare("600cm_wall", -1200, 600, 80, 1.0, 0), settled)
step("tall wall still blocks the car", drive, blocked)


def finish(error=None):
    STATE["finished"] = True
    REPORT["passed"] = error is None
    REPORT["elapsed_seconds"] = round(time.monotonic() - STATE["started"], 2)
    if error:
        REPORT["error"] = error
        u.log_error("NORD_CAR_COLLISION_FAILED " + error)
    else:
        u.log("NORD_CAR_COLLISION_OK " + str(len(REPORT["checks"])) + " checks passed")
    try:
        if STATE.get("car") and STATE["pc"].get_controlled_pawn() == STATE["car"]:
            STATE["car"].call_method("MoveForward", (0.0,))
            STATE["car"].enable_input(STATE["pc"])
        LEVELS.editor_request_end_play()
        for name, value in ORIGINAL.items():
            SETTINGS.set_editor_property(name, value)
        SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", ORIGINAL_MODE))
    except Exception:
        REPORT["passed"] = False
        REPORT["cleanup_error"] = traceback.format_exc()
    finally:
        try:
            path = Path(u.Paths.project_saved_dir()) / "Tests/CarCollisionCurbParking.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
        finally:
            u.unregister_slate_post_tick_callback(STATE["callback"])
            SCRIPTING.call_method("SetKeepPythonScriptAlive", (False,))


def tick(delta_seconds):
    if STATE["finished"]:
        return
    try:
        now = time.monotonic()
        assert now - STATE["started"] < 55, "Timeout while testing " + STEPS[max(STATE["step"], 0)][0]
        if STATE["step"] == -1:
            if now - STATE["started"] < 1:
                return
            STATE.update(step=0, step_started=now)
            STEPS[0][1]()
        name, action, ready = STEPS[STATE["step"]]
        if now - STATE["step_started"] < 0.15 or not ready():
            return
        REPORT["checks"].append(name)
        u.log("NORD_CAR_COLLISION_CHECK " + name)
        STATE["step"] += 1
        if STATE["step"] == len(STEPS):
            finish()
            return
        STATE["step_started"] = now
        STEPS[STATE["step"]][1]()
    except Exception:
        finish(traceback.format_exc())


SCRIPTING.call_method("SetKeepPythonScriptAlive", (True,))
STATE["callback"] = u.register_slate_post_tick_callback(tick)
u.log("NORD_CAR_COLLISION_START awaiting authoritative PIE")
