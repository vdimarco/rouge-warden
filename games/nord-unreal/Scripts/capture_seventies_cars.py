"""Rendered car-profile acceptance in temporary PIE; never save the source map."""
import configparser
import json
import math
import struct
import time
from pathlib import Path

import unreal as u

ROOT = Path(u.Paths.project_dir()).resolve()
OUT = ROOT/'Saved/CurbParking-20261013/ArtViews'
OUT.mkdir(parents=True, exist_ok=True)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
settings = u.get_default_object(u.load_class(None, '/Script/UnrealEd.LevelEditorPlaySettings'))
script = u.get_default_object(u.load_class(None, '/Script/PythonScriptPlugin.EditorPythonScriptingLibrary'))
system = u.get_default_object(u.load_class(None, '/Script/Engine.KismetSystemLibrary'))
gameplay = u.get_default_object(u.load_class(None, '/Script/Engine.GameplayStatics'))
old_clients = settings.get_editor_property('PlayNumberOfClients')
config = configparser.ConfigParser(strict=False)
config.read(Path(u.Paths.project_saved_dir())/'Config/LinuxEditor/EditorPerProjectUserSettings.ini')
old_mode = {'PIE_Standalone': 0, 'PIE_ListenServer': 1, 'PIE_Client': 2}[
    config.get('/Script/UnrealEd.LevelEditorPlaySettings', 'PlayNetMode', fallback='PIE_Standalone')]
settings.set_editor_property('PlayNumberOfClients', 1)
system.call_method('SetBytePropertyByName', (settings, 'PlayNetMode', 0))
script.call_method('SetKeepPythonScriptAlive', (True,))
state = {'phase': 0, 'start': time.monotonic(), 'shot': 0, 'finished': False}
report = {'passed': False, 'views': [], 'profiles': [], 'settings_restored': False}
shots = [(profile, view, width) for width in (1280,) for profile in range(3)
         for view in ('front', 'rear', 'side')] + [(0, 'parking-row', 1280), (0, 'curb', 1280)]


def vec(p):
    return [round(p.x, 4), round(p.y, 4), round(p.z, 4)]


def finish(error=None):
    if state['finished']: return
    state['finished'] = True
    if error: report['error'] = error
    levels.editor_request_end_play()
    settings.set_editor_property('PlayNumberOfClients', old_clients)
    system.call_method('SetBytePropertyByName', (settings, 'PlayNetMode', old_mode))
    report['settings_restored'] = True
    report['passed'] = not error and len(report['views']) == len(shots)+1 and report.get('native_entry_exit') is True
    (ROOT/'Saved/CurbParking-20261013/ArtRender.json').write_text(json.dumps(report, indent=2)+'\n')
    u.unregister_slate_post_tick_callback(state['callback'])
    script.call_method('SetKeepPythonScriptAlive', (False,))


def profile_parts(car, profile):
    car.set_editor_property('BodyProfile', profile)
    car.set_editor_property('PaintStyle', profile)
    car.call_method('ApplyPaint')
    parts = {}
    for comp in car.get_components_by_class(u.StaticMeshComponent):
        if not comp.is_visible(): continue
        mesh = comp.get_editor_property('static_mesh')
        assert mesh and mesh.get_name().startswith('SM_Car70'), comp.get_name()
        assert comp.get_collision_profile_name() == 'NoCollision', comp.get_name()
        parts[comp.get_name()] = {'mesh': mesh.get_name(), 'location': vec(comp.get_editor_property('relative_location')),
            'scale': vec(comp.get_editor_property('relative_scale3d')),
            'materials': [comp.get_material(i).get_name() for i in range(comp.get_num_materials())]}
    assert len(parts) == 11, parts
    assert parts['Body']['mesh'] == f'SM_Car70Body{profile}'
    assert parts['Glass']['mesh'] == f'SM_Car70Cabin{profile}'
    assert parts['Roof']['mesh'] == f'SM_Car70Roof{profile}'
    collision = car.root_component
    assert isinstance(collision, u.StaticMeshComponent)
    assert collision.get_editor_property('static_mesh').get_name() == f'SM_CarCollision{profile}'
    assert not collision.is_visible()
    return {'profile': profile, 'collision_mesh': collision.get_editor_property('static_mesh').get_name(), 'parts': parts}


def tick(dt):
    try:
        now = time.monotonic()
        assert now-state['start'] < 230, 'Car capture timed out'
        if state['phase'] == 0 and now-state['start'] > 2:
            levels.editor_request_begin_play(); state['phase'] = 1
        elif state['phase'] == 1:
            worlds = u.EditorLevelLibrary.get_pie_worlds(True)
            if not worlds: return
            world = worlds[0]; pc = u.GameplayStatics.get_player_controller(world, 0)
            if not pc or not pc.get_controlled_pawn(): return
            cars = u.GameplayStatics.get_all_actors_of_class(world, u.load_class(None, '/Script/Quebec.QuebecCar'))
            car = next(c for c in cars if not c.get_editor_property('bTraffic') and not c.actor_has_tag('CityParked'))
            report['fleet_profiles'] = [0, 0, 0]
            report['traffic_cars'] = 0
            for member in cars:
                profile = member.get_editor_property('BodyProfile')
                body_mesh = next(comp for comp in member.get_components_by_class(u.StaticMeshComponent) if comp.get_name() == 'Body').get_editor_property('static_mesh')
                assert body_mesh.get_name() == f'SM_Car70Body{profile}', member.get_name()
                report['fleet_profiles'][profile] += 1
                report['traffic_cars'] += int(member.get_editor_property('bTraffic'))
            transform = u.Transform(car.get_actor_location()+u.Vector(0, 0, 500))
            camera = gameplay.call_method('BeginDeferredActorSpawnFromClass', (world, u.CameraActor.static_class(), transform,
                u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN, None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            gameplay.call_method('FinishSpawningActor', (camera, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
            camera.get_component_by_class(u.CameraComponent).set_editor_property('field_of_view', 50.)
            pc.set_view_target_with_blend(camera, 0)
            u.SystemLibrary.execute_console_command(world, 'showhud', pc)
            report['fleet_cars'] = len(cars)
            report['profiles'] = [profile_parts(car, p) for p in range(3)]
            state.update(world=world, pc=pc, car=car, camera=camera, phase=2, ready=now)
        elif state['phase'] == 2:
            profile, view, width = shots[state['shot']]
            car = state['car']
            if view == 'parking-row':
                cars = u.GameplayStatics.get_all_actors_of_class(state['world'], u.load_class(None, '/Script/Quebec.QuebecCar'))
                car = min((c for c in cars if c.actor_has_tag('CityParked')), key=lambda c: (c.get_actor_location()-state['car'].get_actor_location()).length())
            else:
                profile_parts(car, profile)
            if view == 'curb' and not state.get('curb'):
                point = car.get_actor_location()+car.get_actor_forward_vector()*1000.
                point.z = car.get_actor_location().z-100.5+9.
                transform = u.Transform(point, u.Rotator(yaw=car.get_actor_rotation().yaw), u.Vector(20., 2.3, .18))
                slab = gameplay.call_method('BeginDeferredActorSpawnFromClass', (state['world'], u.StaticMeshActor, transform,
                    u.SpawnActorCollisionHandlingMethod.ALWAYS_SPAWN, None, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
                comp = slab.static_mesh_component
                comp.set_mobility(u.ComponentMobility.MOVABLE)
                comp.set_static_mesh(u.load_asset('/Engine/BasicShapes/Cube.Cube'))
                comp.set_collision_profile_name('BlockAll')
                comp.set_collision_object_type(u.CollisionChannel.ECC_WORLD_STATIC)
                gameplay.call_method('FinishSpawningActor', (slab, transform, u.SpawnActorScaleMethod.OVERRIDE_ROOT_SCALE))
                car.set_actor_location(car.get_actor_location()+u.Vector(0,0,2), False, True)
                state['curb'] = slab
                state['ready'] = now
            c = car.get_actor_location(); f = car.get_actor_forward_vector(); r = car.get_actor_right_vector()
            p = c + (f*-1100+r*850 if view == 'parking-row' else f*580+r*430 if view == 'front' else f*-580+r*430 if view == 'rear' else r*730) + u.Vector(0, 0, 190)
            target = c+(f*300 if view == 'parking-row' else u.Vector())+u.Vector(0, 0, -9)
            delta = target-p
            state['camera'].set_actor_location_and_rotation(p, u.Rotator(
                pitch=math.degrees(math.atan2(delta.z, math.hypot(delta.x, delta.y))),
                yaw=math.degrees(math.atan2(delta.y, delta.x))), False, True)
            if now-state['ready'] > (18 if state['shot'] == 0 else 3):
                path = OUT/f'{profile}-{view}-{width}.png'; path.unlink(missing_ok=True)
                u.SystemLibrary.execute_console_command(state['world'], f'HighResShot {width}x{width*9//16} filename="{path}"', state['pc'])
                if view == 'curb':
                    assert 2. < car.get_actor_rotation().pitch < 6., 'Front wheel curb articulation failed'
                    report['curb_pose'] = {'position': vec(car.get_actor_location()), 'rotation': str(car.get_actor_rotation())}
                state.update(phase=3, ready=now, path=path)
        elif state['phase'] == 3 and now-state['ready'] > 1:
            path = state['path']
            if not path.exists(): return
            png = path.read_bytes()
            if not png.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'): return
            profile, view, width = shots[state['shot']]
            assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (width, width*9//16)
            report['views'].append({'profile': profile, 'view': view, 'resolution': [width, width*9//16],
                'file': str(path.relative_to(ROOT)), 'bytes': len(png)})
            state['shot'] += 1
            if state['shot'] == len(shots):
                if state.get('curb'): state['curb'].destroy_actor()
                state['car'].set_actor_location(state['car'].get_actor_location()+u.Vector(0,0,2), False, True)
                avatar = state['pc'].get_controlled_pawn()
                profile_parts(state['car'], 0)
                avatar.set_actor_location(state['car'].get_actor_location()+state['car'].get_actor_right_vector()*250., False, True)
                state['pc'].call_method('ServerInteract')
                assert state['pc'].get_controlled_pawn() == state['car'], 'Native car entry failed'
                state['pc'].set_view_target_with_blend(state['car'], 0)
                state['pc'].set_control_rotation(u.Rotator(pitch=-12., yaw=state['car'].get_actor_rotation().yaw))
                u.SystemLibrary.execute_console_command(state['world'], 'showhud', state['pc'])
                state.update(phase=4, ready=now, avatar=avatar)
            else: state.update(phase=2, ready=now)
        elif state['phase'] == 4 and now-state['ready'] > 3:
            path = OUT/'possessed-1280.png'; path.unlink(missing_ok=True)
            u.SystemLibrary.execute_console_command(state['world'], f'HighResShot 1280x720 filename="{path}"', state['pc'])
            state.update(phase=5, ready=now, path=path)
        elif state['phase'] == 5 and now-state['ready'] > 1:
            path = state['path']
            if not path.exists(): return
            png = path.read_bytes()
            if not png.endswith(b'\x00\x00\x00\x00IEND\xaeB\x60\x82'): return
            assert struct.unpack('>II', png[16:24]) == (1280, 720)
            report['views'].append({'view': 'possessed', 'resolution': [1280, 720], 'file': str(path.relative_to(ROOT)), 'bytes': len(png)})
            state['pc'].call_method('ServerInteract')
            assert state['pc'].get_controlled_pawn() == state['avatar'], 'Native car exit failed'
            report['native_entry_exit'] = True
            finish()
    except Exception as exc:
        u.log_error('NORD_CAR70_CAPTURE_FAILED '+repr(exc)); finish(repr(exc))


state['callback'] = u.register_slate_post_tick_callback(tick)
