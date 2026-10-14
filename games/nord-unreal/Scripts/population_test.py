"""Focused two-player population PIE check; supports -nullrhi -unattended startup.

Run after building QuebecEditor with -ExecutePythonScript=<this absolute path>.
The ordinary smoke test remains responsible for the full driving/mission lifecycle.
"""
import configparser
import json
from pathlib import Path
import time
import traceback
import unreal as u

PYTHON = u.get_default_object(u.load_class(None, "/Script/PythonScriptPlugin.EditorPythonScriptingLibrary"))
PYTHON.call_method("SetKeepPythonScriptAlive", (True,))
LEVELS = u.get_editor_subsystem(u.LevelEditorSubsystem)
SETTINGS = u.get_default_object(u.load_class(None, "/Script/UnrealEd.LevelEditorPlaySettings"))
SYSTEM = u.get_default_object(u.load_class(None, "/Script/Engine.KismetSystemLibrary"))
GAMEPLAY = u.get_default_object(u.load_class(None, "/Script/Engine.GameplayStatics"))
ORIGINAL = {name: SETTINGS.get_editor_property(name) for name in ("PlayNumberOfClients", "RunUnderOneProcess")}
CONFIG = configparser.ConfigParser(strict=False)
CONFIG.read(Path(u.Paths.project_saved_dir()) / "Config/LinuxEditor/EditorPerProjectUserSettings.ini")
ORIGINAL_MODE = {"PIE_Standalone": 0, "PIE_ListenServer": 1, "PIE_Client": 2}[
    CONFIG.get("/Script/UnrealEd.LevelEditorPlaySettings", "PlayNetMode", fallback="PIE_Standalone")]
CLASSES = {kind: u.load_class(None, "/Script/Quebec.Quebec" + kind)
           for kind in ("Car", "ParkResident", "Controller")}
LAYOUT = json.loads((Path(u.Paths.project_dir()) / "Data/LaFontaine/layout.json").read_text())
ROAD_SEGMENTS = [(a, b) for road in LAYOUT["roads"] for a, b in zip(road, road[1:])]
PARKING_DIRECTIONS = json.loads((Path(u.Paths.project_dir()) / "Data/LaFontaine/parking.json").read_text())["directions"]
PARKING_SIDES = json.loads((Path(u.Paths.project_dir()) / "Data/LaFontaine/parking.json").read_text())["sides"]
ROAD_WIDTHS = [width for road, width in zip(LAYOUT["roads"], LAYOUT["road_widths"]) for _ in road[1:]]
PROXY_COUNTS = [u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_convex_collision_count(u.load_asset(f'/Game/ParkComic/SM_CarCollision{i}')) for i in range(3)]
assert all(2 <= count <= 8 for count in PROXY_COUNTS), PROXY_COUNTS
REPORT = {"collision_proxy_hulls": PROXY_COUNTS, "passed": False, "checks": [], "skipped": ["rendered crowd appearance", "frame-time performance"]}
STATE = {"started": time.monotonic(), "step": 0, "finished": False}
STEPS = []


def distance(a, b):
    delta = a - b
    return (delta.x ** 2 + delta.y ** 2 + delta.z ** 2) ** .5


def actors(world, kind):
    return u.GameplayStatics.get_all_actors_of_class(world, CLASSES[kind])


def road_distance(point):
    best = float("inf")
    for a, b in ROAD_SEGMENTS:
        dx, dy = b[0] - a[0], b[1] - a[1]
        along = max(0., min(1., ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / max(dx * dx + dy * dy, 1.)))
        best = min(best, ((point.x - a[0] - dx * along) ** 2 + (point.y - a[1] - dy * along) ** 2) ** .5)
    return best


def parking_road(car, world):
    point, forward = car.get_actor_location(), car.get_actor_forward_vector()
    for index, ((a, b), width) in enumerate(zip(ROAD_SEGMENTS, ROAD_WIDTHS)):
        if width < 600:
            continue
        dx, dy = b[0]-a[0], b[1]-a[1]
        length = (dx*dx+dy*dy)**.5
        dx, dy = dx/length, dy/length
        along = (point.x-a[0])*dx+(point.y-a[1])*dy
        lateral = (point.x-a[0])*-dy+(point.y-a[1])*dx
        side = 1 if lateral>0 else -1
        facing = PARKING_DIRECTIONS[index] or side
        if not PARKING_SIDES[index] & (1 if side<0 else 2): continue
        if not (1434.99 <= along <= length-1434.99 and 400 <= abs(lateral) <= width/2+1000 and
                (forward.x*dx+forward.y*dy)*facing > .978):
            continue
        gaps = []
        for offset in (-235, 0, 235):
            for gap in range(0, 81, 5):
                x, y = point.x+forward.x*offset-forward.y*side*facing*(110+gap), point.y+forward.y*offset+forward.x*side*facing*(110+gap)
                hit = u.SystemLibrary.line_trace_single(world,u.Vector(x,y,45),u.Vector(x,y,-30),
                    u.TraceTypeQuery.TRACE_TYPE_QUERY1,True,[car],u.DrawDebugTrace.NONE,True)
                if not hit: continue
                row = GAMEPLAY.call_method("BreakHitResult",(hit,))
                component = row[10]
                mesh = component.get_editor_property('static_mesh') if isinstance(component,u.StaticMeshComponent) else None
                if mesh and mesh.get_name().startswith('SM_Concrete_Collision') and row[5].z>=17:
                    gaps.append(gap); break
        if len(gaps) == 3 and min(gaps)>=5 and max(gaps)<=60 and max(gaps)-min(gaps)<=40:
            return {"road_segment":index,"curb_gaps_cm":gaps,"road_center_offset_cm":round(abs(lateral),1)}
    return None


def tagged(world, kind, tag):
    return [actor for actor in actors(world, kind) if actor.actor_has_tag(tag)]


def elapsed():
    return u.GameplayStatics.get_time_seconds(STATE["server"]) - STATE["world_start"]


def speed(car):
    return STATE.get("measured_speeds", {}).get(car.get_name(), 0.)


def traffic_blocker(car):
    point = car.get_actor_location()
    hit = u.SystemLibrary.box_trace_single_by_profile(STATE["server"], point,
        point + car.get_actor_forward_vector() * (450 + speed(car) * .8), u.Vector(220, 108, 70),
        car.get_actor_rotation(), "Pawn", False, [car], u.DrawDebugTrace.NONE, True)
    if not hit:
        return None
    broken = GAMEPLAY.call_method("BreakHitResult", (hit,))
    actor, component = broken[9], broken[10]
    if not actor:
        return None
    mesh = component.get_editor_property("static_mesh") if isinstance(component, u.StaticMeshComponent) else None
    return {"car": car.get_name(), "blocker": actor.get_name(), "label": actor.get_actor_label(),
            "class": actor.get_class().get_name(), "component": component.get_name() if component else None,
            "mesh": mesh.get_path_name() if mesh else None, "distance_cm": round(broken[3], 1),
            "car_yaw": round(car.get_actor_rotation().yaw, 1), "blocker_yaw": round(actor.get_actor_rotation().yaw, 1)}


def car_profile(car):
    cabin = next(part for part in car.get_components_by_class(u.StaticMeshComponent) if part.get_name() == "Glass")
    scale = cabin.get_editor_property("RelativeScale3D")
    assert [round(value, 3) for value in (scale.x, scale.y, scale.z)] == [1., 1., 1.], 'Period cabin must retain authored mesh dimensions'
    mesh = cabin.get_editor_property("static_mesh")
    assert mesh, 'Cabin mesh missing'
    return mesh.get_path_name()


def measure_crowd(now):
    previous = STATE.get("crowd_sample_time", now)
    if now <= previous:
        return
    for ped in STATE["crowd"]:
        name, point = ped.get_name(), ped.get_actor_location()
        sample = STATE["crowd_motion"][name]
        travelled = distance(point, sample["last"])
        pace = ped.get_editor_property("Pace")
        # Slate samples independently of resident ticks; allow one tick of quantization.
        sample_dt, tick_interval = now - previous, ped.get_actor_tick_interval()
        limit = pace * (sample_dt + tick_interval) + 2.  # cm-scale position tolerance
        diagnostic = {"name": name, "activity": ped.get_editor_property("Activity"),
                      "sample_dt_s": round(sample_dt, 6), "actor_tick_interval_s": round(tick_interval, 6),
                      "pace_cm_s": pace, "travelled_cm": round(travelled, 4),
                      "unquantized_limit_cm": round(pace * sample_dt, 4),
                      "quantized_limit_cm": round(limit, 4),
                      "excess_over_sample_time_cm": round(travelled - pace * sample_dt, 4)}
        worst = REPORT.get("crowd_continuity_max_excess")
        if worst is None or diagnostic["excess_over_sample_time_cm"] > worst["excess_over_sample_time_cm"]:
            REPORT["crowd_continuity_max_excess"] = diagnostic
        assert travelled <= limit, "Pedestrian root teleported: " + json.dumps(diagnostic)
        sample["path_cm"] += travelled
        sample["moving_samples"] += travelled / (now - previous) > 20
        sample["idle_samples"] += travelled / (now - previous) < 5
        sample["last"] = point
        if ped.get_editor_property("Activity") == 2:
            assert distance(point, STATE["initial"][name]) < 1, "A social resident drifted from its pair"
    STATE["crowd_sample_time"] = now


def measure_traffic():
    # Measure actual authority displacement; internal throttle/speed properties are intentionally unexposed.
    if "server" not in STATE:
        return
    now = u.GameplayStatics.get_time_seconds(STATE["server"])
    previous = STATE.get("speed_sample_time", now)
    if "speed_positions" not in STATE or now - previous >= .25:
        measure_crowd(now)
        positions = {car.get_name(): car.get_actor_location() for car in STATE["traffic"]}
        if "speed_positions" in STATE:
            STATE["measured_speeds"] = {name: distance(point, STATE["speed_positions"][name]) / (now - previous)
                                        for name, point in positions.items()}
        STATE.update(speed_positions=positions, speed_sample_time=now)
        reported = STATE.setdefault("reported_blocks", set())
        for car in STATE["traffic"]:
            if speed(car) < 15:
                blocker = traffic_blocker(car)
                if blocker and (car.get_name(), blocker["blocker"]) not in reported:
                    reported.add((car.get_name(), blocker["blocker"]))
                    REPORT.setdefault("traffic_blocks", []).append(blocker)
                    u.log("NORD_POPULATION_BLOCK " + json.dumps(blocker))


def begin():
    SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", 1))
    SETTINGS.set_editor_property("PlayNumberOfClients", 2)
    SETTINGS.set_editor_property("RunUnderOneProcess", True)
    LEVELS.editor_request_begin_play()


def discover():
    worlds = u.EditorLevelLibrary.get_pie_worlds(True)
    server = next((w for w in worlds if u.GameplayStatics.get_game_mode(w)), None)
    client = next((w for w in worlds if not u.GameplayStatics.get_game_mode(w)), None)
    if not server or not client:
        return False
    remote = next((pc for pc in actors(server, "Controller") if not pc.is_local_controller()), None)
    local = next((pc for pc in actors(client, "Controller") if pc.is_local_controller()), None)
    if not remote or not local or not remote.get_controlled_pawn() or not local.get_controlled_pawn():
        return False
    parked, traffic, crowd = (tagged(server, kind, tag) for kind, tag in
                              (("Car", "CityParked"), ("Car", "CityTraffic"), ("ParkResident", "CityCrowd")))
    REPORT["counts"] = {"added_parked": len(parked), "traffic": len(traffic), "added_pedestrians": len(crowd)}
    assert 19 <= len(parked) <= 32 and len(traffic) == 16 and len(crowd) == 96, REPORT["counts"]
    assert all(not car.get_controller() and not car.get_editor_property("bTraffic") for car in parked)
    assert all(not car.get_controller() and car.get_editor_property("bTraffic") for car in traffic)
    anchor = u.Vector(*LAYOUT["car"])
    starter = next(car for car in actors(server, "Car") if car.actor_has_tag("StarterCar"))
    offset = starter.get_actor_location() - anchor
    right = starter.get_actor_right_vector()
    lane_offset = offset.x * right.x + offset.y * right.y
    assert 300 < lane_offset < 2200, "Starter must park beside its actual curb"
    REPORT["starter_curb_offset_cm"] = round(lane_offset, 1)
    assert parking_road(starter,server), "Starter must have a raised curb beside its full body"
    curb_cars = [car for car in actors(server, "Car") if not car.get_editor_property("bTraffic") and
                 car != starter and not car.actor_has_tag("CampaignLoan")]
    parking = {car.get_name(): parking_road(car,server) for car in curb_cars}
    REPORT["asphalt_parking"] = parking
    REPORT["parking_poses"] = {car.get_name(): {'position': str(car.get_actor_location()), 'rotation': str(car.get_actor_rotation()), 'tags': [str(tag) for tag in car.tags], 'root': car.root_component.get_name()} for car in curb_cars}
    assert len(curb_cars) == len(parked)+8, "Expected every added car and all eight relocated saved cars"
    assert all(parking.values()), "A parked car lacks a continuous raised curb or a valid facing direction"
    assert all(distance(a.get_actor_location(), b.get_actor_location()) >= 599.9 for i,a in enumerate(curb_cars) for b in curb_cars[i+1:]), 'Parking bumper gaps overlap'
    for car in curb_cars + [starter]:
        root = car.root_component
        assert isinstance(root, u.StaticMeshComponent) and root.get_editor_property('static_mesh').get_name() == f'SM_CarCollision{car.get_editor_property("BodyProfile")}'
        assert not root.is_visible()
    styles = {ped.get_editor_property("Style") for ped in crowd}
    assert styles == set(range(3, 11)), "Crowd must use all eight supplied textured characters"
    for ped in crowd:
        body = ped.get_component_by_class(u.SkeletalMeshComponent)
        assert body.get_editor_property("bRenderCustomDepth") and body.get_editor_property("CustomDepthStencilValue") == 255
    modes = {mode: [ped for ped in crowd if ped.get_editor_property("Activity") == mode] for mode in range(3)}
    REPORT["activity_counts"] = {label: len(modes[mode]) for mode, label in enumerate(("walk", "jog", "social"))}
    assert REPORT["activity_counts"] == {"walk": 72, "jog": 16, "social": 8}, REPORT["activity_counts"]
    paces = {label: sorted({round(ped.get_editor_property("Pace"), 2) for ped in modes[mode]})
             for mode, label in enumerate(("walk", "jog"))}
    pauses = sorted({round(ped.get_editor_property("PauseSeconds"), 2) for ped in crowd})
    REPORT["pace_cm_s"], REPORT["pause_seconds"] = paces, pauses
    assert len(paces["walk"]) >= 4 and len(paces["jog"]) >= 3 and len(pauses) >= 4
    assert min(paces["jog"]) > max(paces["walk"]), "Jogging must be visibly faster than walking"
    profiles = {car.get_editor_property("BodyProfile"): car_profile(car) for car in parked + traffic}
    REPORT["vehicle_cabin_profiles"] = profiles
    assert set(profiles) == {0, 1, 2} and len(set(profiles.values())) == 3
    for car in parked + traffic:
        assert car_profile(car) == f'/Game/ParkComic/SM_Car70Cabin{car.get_editor_property("BodyProfile")}.SM_Car70Cabin{car.get_editor_property("BodyProfile")}'
    hubs = {tag: [ped for ped in crowd if ped.actor_has_tag(tag)] for tag in ("CityChalet", "CityPond", "CitySherbrooke")}
    REPORT["hub_residents"] = {tag: {"count": len(group), "styles": sorted({ped.get_editor_property("Style") for ped in group})}
                              for tag, group in hubs.items()}
    # Fresh pre-change ed452c1a replay has five chalet residents; preserve that layout.
    assert len(hubs["CityChalet"]) == 5 and len(hubs["CityPond"]) == 8
    assert len(hubs["CitySherbrooke"]) >= 4 and all(len(item["styles"]) >= (3 if tag == "CityChalet" else 4) for tag,item in REPORT["hub_residents"].items()), REPORT["hub_residents"]
    assert all(distance(ped.get_actor_location(), u.Vector(*LAYOUT["spawn"])) < 6500 for ped in hubs["CitySherbrooke"])
    REPORT["hub_endpoint_clearance"] = {}
    for tag in ("CityChalet", "CityPond", "CitySports", "CityTheatre"):
        group = [ped for ped in crowd if ped.actor_has_tag(tag) and ped.get_editor_property("Activity") != 2]
        assert len(group) >= (3 if tag == "CityChalet" else 4), "A mapped park hub lost its mobile appearances: " + tag
        endpoints = [point for ped in group for point in (ped.get_editor_property("Route")[0], ped.get_editor_property("Route")[-1])]
        separation = min(distance(a, b) for i, a in enumerate(endpoints) for b in endpoints[i + 1:])
        social = [ped for ped in modes[2] if ped.actor_has_tag(tag)]
        social_gap = min((distance(point, ped.get_actor_location()) for point in endpoints for ped in social), default=None)
        REPORT["hub_endpoint_clearance"][tag] = {"mobile": len(group), "minimum_endpoint_cm": round(separation, 2),
                                                 "minimum_social_gap_cm": round(social_gap, 2) if social_gap is not None else None}
        assert separation >= 70, "Mobile turnaround capsules overlap: " + tag
        assert social_gap is None or social_gap >= 70, "Turnaround capsule overlaps a social pair: " + tag
    for ped in modes[2]:
        partner = min((other for other in modes[2] if other != ped), key=lambda other: distance(ped.get_actor_location(), other.get_actor_location()))
        toward = partner.get_actor_location() - ped.get_actor_location()
        forward = ped.get_actor_forward_vector()
        assert 120 < distance(ped.get_actor_location(), partner.get_actor_location()) < 200
        assert (toward.x * forward.x + toward.y * forward.y) / distance(ped.get_actor_location(), partner.get_actor_location()) > .95
    STATE.update(server=server, client=client, remote=remote, local=local, parked=parked, traffic=traffic, crowd=crowd,
                 mobile=modes[0] + modes[1], social=modes[2], hubs=hubs,
                 character=remote.get_controlled_pawn(), client_character=local.get_controlled_pawn())
    STATE["population_started"] = u.GameplayStatics.get_time_seconds(server)
    STATE["initial"] = {a.get_name(): a.get_actor_location() for a in traffic + crowd}
    STATE["crowd_motion"] = {ped.get_name(): {"last": ped.get_actor_location(), "path_cm": 0., "moving_samples": 0, "idle_samples": 0} for ped in crowd}
    STATE["crowd_sample_time"] = u.GameplayStatics.get_time_seconds(server)
    return True


def moving():
    if elapsed() < 8:
        return False
    counts = {kind: sum(distance(a.get_actor_location(), STATE["initial"][a.get_name()]) > 150 for a in STATE[kind])
              for kind in ("traffic", "crowd")}
    REPORT["moved_over_150cm"] = counts
    assert counts["traffic"] >= 12, "Traffic must visibly circulate, including near the player"
    mobile_moved = sum(STATE["crowd_motion"][ped.get_name()]["path_cm"] > 150 for ped in STATE["mobile"])
    REPORT["mobile_moved_over_150cm_in_8s"] = mobile_moved
    assert mobile_moved >= 72, "Most mobile pedestrians must move even while others pause or socialize"
    return True


def lasting_circulation():
    # Check a second full movement window after the simulation has run for a minute.
    if elapsed() < 44:
        return False
    if "late_positions" not in STATE:
        STATE["late_positions"] = {car.get_name(): car.get_actor_location() for car in STATE["traffic"]}
        STATE["late_started"] = elapsed()
        u.log("NORD_POPULATION_CIRCULATION_WINDOW sampling final eight seconds")
        return False
    if elapsed() - STATE["late_started"] < 8:
        return False
    samples = [{"name": car.get_name(), "position": [round(v, 1) for v in (car.get_actor_location().x, car.get_actor_location().y, car.get_actor_location().z)],
                "displacement_cm": round(distance(car.get_actor_location(), STATE["late_positions"][car.get_name()]), 1),
                "measured_speed_cm_s": round(speed(car), 1), "yielding": car.get_editor_property("bHandbrake"),
                "road_distance_cm": round(road_distance(car.get_actor_location()), 1)} for car in STATE["traffic"]]
    moved = sum(sample["displacement_cm"] > 150 for sample in samples)
    REPORT["lasting_traffic"] = {"world_seconds": round(u.GameplayStatics.get_time_seconds(STATE["server"]) - STATE["population_started"], 1),
                                 "cars_moving_in_final_8s": moved, "samples": samples}
    assert moved >= 12, "Traffic jammed after its initial straight segment"
    assert all(sample["road_distance_cm"] < 700 for sample in samples), "Traffic wandered away from surveyed streets"
    assert all(car.get_actor_location().z >= 90 for car in STATE["traffic"]), "Traffic left the mapped ground"
    motion = {ped.get_name(): {key: round(value, 1) if isinstance(value, float) else value
                              for key, value in STATE["crowd_motion"][ped.get_name()].items() if key != "last"} for ped in STATE["crowd"]}
    REPORT["minute_pedestrian_activity"] = motion
    assert all(motion[ped.get_name()]["path_cm"] > 500 for ped in STATE["mobile"]), "A mobile resident never completed a visible walk/jog"
    assert all(motion[ped.get_name()]["idle_samples"] > 0 for ped in STATE["mobile"]), "A mobile resident never paused at a route endpoint"
    assert all(motion[ped.get_name()]["path_cm"] < 1 for ped in STATE["social"]), "Stationary social pairs moved"
    STATE["sample"] = next(ped for ped in STATE["hubs"]["CityChalet"] if ped.get_editor_property("Activity") == 1)
    STATE["character"].set_actor_location(STATE["sample"].get_actor_location() + u.Vector(0, 300, 120), False, True)
    return True


def obstruct_starter_lane():
    starter = next(car for car in actors(STATE["server"], "Car") if car.actor_has_tag("StarterCar"))
    STATE["starter_fixture"] = (starter, starter.get_actor_location(), starter.get_actor_rotation())
    target = next(car for car in STATE["traffic"] if speed(car)>300)
    starter.set_actor_tick_enabled(False)
    starter.set_actor_location_and_rotation(target.get_actor_location()+target.get_actor_forward_vector()*500,
        target.get_actor_rotation(), False, True)
    STATE["obstructed_car"] = target


def clear_starter_queue():
    starter = STATE["starter_fixture"][0]
    point = starter.get_actor_location()
    queues = [car for car in STATE["traffic"] if distance(car.get_actor_location(),point)<1500 and speed(car)<15]
    assert STATE["obstructed_car"] in queues, "Traffic did not stop for the temporary parked obstruction"
    STATE["starter_queues"] = queues
    STATE["cleared_positions"] = {car.get_name():car.get_actor_location() for car in STATE["traffic"]}
    starter.set_actor_location(point+u.Vector(0,0,10000),False,True)
    REPORT["starter_queue"] = {"waiting_cars":[car.get_name() for car in queues],"clearance_fixture":"car placed ahead of moving traffic, then raised"}


def cleared_traffic_recovers():
    if elapsed() < 8:
        return False
    displacements = {car.get_name(): round(distance(car.get_actor_location(), STATE["cleared_positions"][car.get_name()]), 1)
                     for car in STATE["traffic"]}
    REPORT["starter_queue"]["displacements_after_8s_cm"] = displacements
    assert all(displacements[car.get_name()] > 150 for car in STATE["starter_queues"]), "Starter queues failed to resume after obstruction cleared"
    assert all(displacement > 150 for displacement in displacements.values()), "Some traffic remained jammed with the starter lane clear"
    return True


def restore_starter():
    fixture = STATE.pop("starter_fixture", None)
    if fixture:
        starter, position, rotation = fixture
        starter.set_actor_location_and_rotation(position, rotation, False, True)
        starter.set_actor_tick_enabled(True)


def replicated_crowd():
    sample = STATE["sample"]
    client_crowd = actors(STATE["client"], "ParkResident")
    style, phase = sample.get_editor_property("Style"), sample.get_editor_property("Phase")
    # Dynamic actor names can be remapped between PIE worlds; replicated phase is unique per walker.
    remote = next((ped for ped in client_crowd if ped.get_editor_property("Style") == style and
                   abs(ped.get_editor_property("Phase") - phase) < .01), None)
    if not remote:
        if elapsed() > 2 and "crowd_replication_wait" not in REPORT:
            REPORT["crowd_replication_wait"] = {"expected_style": style, "expected_phase": phase,
                                               "client_residents": len(client_crowd), "client_same_style_phases": [
                round(ped.get_editor_property("Phase"), 2) for ped in client_crowd if ped.get_editor_property("Style") == style]}
            u.log("NORD_POPULATION_WAIT " + json.dumps(REPORT["crowd_replication_wait"]))
        return False
    route_a, route_b = (ped.get_editor_property("Route") for ped in (sample, remote))
    if len(route_a) != len(route_b) or len(route_a) < 2:
        return False
    assert all(distance(a, b) < 1 for a, b in zip(route_a, route_b)), "Client has a different pedestrian route"
    assert sample.get_editor_property("Style") == remote.get_editor_property("Style")
    assert abs(sample.get_editor_property("Phase") - remote.get_editor_property("Phase")) < .01
    assert distance(sample.get_actor_location(), remote.get_actor_location()) < 150, "Client pedestrian movement did not replicate"
    matched_modes = set()
    for authority in STATE["hubs"]["CityChalet"]:
        replica = next((ped for ped in client_crowd if ped.get_editor_property("Style") == authority.get_editor_property("Style") and
                        abs(ped.get_editor_property("Phase") - authority.get_editor_property("Phase")) < .01), None)
        if not replica:
            return False
        for name in ("Activity", "Pace", "PauseSeconds"):
            assert abs(replica.get_editor_property(name) - authority.get_editor_property(name)) < .01, "Client resident profile differs: " + name
        matched_modes.add(replica.get_editor_property("Activity"))
    assert matched_modes == {0, 1, 2}, "Peer did not receive all three nearby activities"
    REPORT["peer_activity_modes"] = sorted(matched_modes)
    car = next((car for car in STATE["traffic"] if speed(car) > 300), None)
    assert car, "No traffic car remained in motion for the yield test"
    STATE["yield_car"] = car
    STATE["yield_start"] = car.get_actor_location()
    STATE["character"].set_actor_location(car.get_actor_location() + car.get_actor_forward_vector() * 450 + u.Vector(0, 0, 20), False, True)
    return True


def yield_stops():
    if elapsed() < 1.2:
        return False
    car = STATE["yield_car"]
    assert speed(car) < 15 and car.get_editor_property("bHandbrake"), "Traffic failed to yield to a player"
    assert distance(car.get_actor_location(), STATE["yield_start"]) < 200, "Traffic drove into the player's stop distance"
    STATE["traffic_stop"] = car.get_actor_location()
    STATE["character"].set_actor_location(car.get_actor_location() + car.get_actor_right_vector() * 1000 + u.Vector(0, 0, 20), False, True)
    return True


def yield_resumes():
    return speed(STATE["yield_car"]) > 100


def stop_for_claim():
    car = STATE["yield_car"]
    STATE["chosen_car"] = car
    STATE["character"].set_actor_location(car.get_actor_location() + car.get_actor_forward_vector() * 380 + u.Vector(0, 0, 20), False, True)


def traffic_claim_ready():
    car = STATE["chosen_car"]
    return elapsed() > 1 and speed(car) < 15 and client_near()


def approach_parked():
    car = min(STATE["parked"], key=lambda a: distance(a.get_actor_location(), STATE["character"].get_actor_location()))
    STATE["chosen_car"] = car
    STATE["character"].set_actor_location(car.get_actor_location() + car.get_actor_right_vector() * 300 + u.Vector(0, 0, 20), False, True)


def client_near():
    return distance(STATE["local"].get_controlled_pawn().get_actor_location(), STATE["chosen_car"].get_actor_location()) < 450


def interact():
    u.SystemLibrary.set_timer_for_next_tick(STATE["local"], "Interact")


def entered():
    car = STATE["chosen_car"]
    client_car = STATE["local"].get_controlled_pawn()
    if (STATE["remote"].get_controlled_pawn() != car or not client_car or client_car.get_class() != CLASSES["Car"] or
            client_car.get_editor_property("Occupant") != STATE["client_character"]):
        return False
    assert car.get_editor_property("Occupant") == STATE["character"]
    assert not car.get_editor_property("bTraffic"), "Player possession must stop ambient driving"
    assert distance(car.get_actor_location(), client_car.get_actor_location()) < 150, "The client possessed a different car"
    assert car.get_editor_property("PaintStyle") == client_car.get_editor_property("PaintStyle"), "Parked paint did not replicate"
    assert car.get_editor_property("BodyProfile") == client_car.get_editor_property("BodyProfile"), "Vehicle silhouette did not replicate"
    assert car_profile(car) == car_profile(client_car), "Client cabin shape differs"
    return True


def exited():
    return (STATE["remote"].get_controlled_pawn() == STATE["character"] and
            STATE["local"].get_controlled_pawn() == STATE["client_character"] and
            not STATE["chosen_car"].get_editor_property("Occupant"))


STEPS.extend([
    ("bounded population, eight appearances, three activities, hub coverage and vehicle profiles", begin, discover),
    ("server traffic and pedestrians visibly move", lambda: None, moving),
    ("traffic circulates and all 88 mobile residents move and pause over a minute", lambda: None, lasting_circulation),
    ("temporary car obstructs the forward traffic lane", obstruct_starter_lane, lambda: elapsed() > 3),
    ("following starter queue and all sixteen cars recover when the obstruction clears", clear_starter_queue, cleared_traffic_recovers),
    ("nearby pedestrian appearance, activity, pace, pauses, route and movement replicate", lambda: None, replicated_crowd),
    ("traffic yields before reaching a player", lambda: None, yield_stops),
    ("traffic resumes after player clears lane", lambda: None, yield_resumes),
    ("moving traffic stops within remote player's reach", stop_for_claim, traffic_claim_ready),
    ("native remote E claims a stopped traffic car and ends ambient driving", interact, entered),
    ("native remote E exits the claimed traffic car safely", interact, exited),
    ("remote player approaches an added parked car", approach_parked, client_near),
    ("native remote E enters an added car and its paint replicates", interact, entered),
    ("native remote E exits the added car safely", interact, exited),
])


def finish(error=None):
    STATE["finished"] = True
    REPORT["passed"] = error is None
    REPORT["elapsed_seconds"] = round(time.monotonic() - STATE["started"], 2)
    if error:
        REPORT["error"] = error
        u.log_error("NORD_POPULATION_FAILED " + error)
    else:
        u.log("NORD_POPULATION_OK " + str(len(REPORT["checks"])) + " checks passed")
    try:
        restore_starter()
        LEVELS.editor_request_end_play()
        for name, value in ORIGINAL.items():
            SETTINGS.set_editor_property(name, value)
        SYSTEM.call_method("SetBytePropertyByName", (SETTINGS, "PlayNetMode", ORIGINAL_MODE))
    finally:
        path = Path(u.Paths.project_saved_dir()) / "Tests/PopulationCurbParking.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(REPORT, indent=2), encoding="utf-8")
        u.unregister_slate_post_tick_callback(STATE["callback"])
        PYTHON.call_method("SetKeepPythonScriptAlive", (False,))


def tick(delta_seconds):
    if STATE["finished"]:
        return
    try:
        assert time.monotonic() - STATE["started"] < 120, "Population test timed out: " + STEPS[STATE["step"]][0]
        measure_traffic()
        if "step_start" not in STATE:
            STATE["step_start"] = time.monotonic()
            REPORT["current_check"] = STEPS[STATE["step"]][0]
            u.log("NORD_POPULATION_STEP " + REPORT["current_check"])
            if "server" in STATE:
                STATE["world_start"] = u.GameplayStatics.get_time_seconds(STATE["server"])
            STEPS[STATE["step"]][1]()
        if time.monotonic() - STATE["step_start"] < .4 or not STEPS[STATE["step"]][2]():
            return
        REPORT["checks"].append(STEPS[STATE["step"]][0])
        u.log("NORD_POPULATION_CHECK " + REPORT["checks"][-1])
        STATE["step"] += 1
        STATE.pop("step_start")
        if STATE["step"] == len(STEPS):
            finish()
    except Exception:
        finish(traceback.format_exc())


STATE["callback"] = u.register_slate_post_tick_callback(tick)
u.log("NORD_POPULATION_START awaiting two-player PIE")
