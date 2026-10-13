"""Rendered camera bounds/HUD checks using the existing isolated two-peer fixture."""
from pathlib import Path
import unreal as u

root = Path(u.Paths.project_dir()).resolve()
command = u.SystemLibrary.get_command_line()
assert '-NordStoryRenderChecks' in command and '-NordTouchControls' in command, 'Use rendered touch HUD verification flags'
fixture = root / 'Scripts/test_story_slice.py'
legacy_report = root / 'Saved/Tests/StorySliceRender1280.json'
legacy_bytes = legacy_report.read_bytes() if legacy_report.exists() else None
qa = {'__name__': '__camera_touch_qa__', '__file__': str(fixture)}
exec(compile(fixture.read_text(), str(fixture), 'exec'), qa)
u.unregister_slate_post_tick_callback(qa['STATE']['callback'])
qa['OUT'] = root / 'Saved/Tests' / ('CameraTouch-' + qa['time'].strftime('%Y%m%d-%H%M%S'))
qa['OUT'].mkdir(parents=True, exist_ok=True)
qa['STEPS'] = [qa['STEPS'][0]]
qa['REPORT']['mode'] += '; camera bounds and touch HUD'
qa['REPORT']['not_checked'] = ['physical phone/sensors', 'audio', 'driving feel', 'full campaign']


def look(pitch):
    pc = qa['STATE']['client_pc']
    pc.set_control_rotation(u.Rotator(pitch=pitch, yaw=65))


def bounded():
    pc = qa['STATE']['client_pc']
    pawn = pc.get_controlled_pawn()
    arm = pawn.get_component_by_class(u.SpringArmComponent)
    camera = pawn.get_component_by_class(u.CameraComponent)
    pitch = pc.get_control_rotation().pitch
    floor = arm.get_world_location().z + arm.get_editor_property('socket_offset').z
    height = camera.get_world_location().z
    assert pitch <= 30.01, f'Unclamped pitch {pitch}'
    assert height >= floor - .1, f'Camera below back height: {height} < {floor}'
    qa['REPORT'].setdefault('camera_probes', []).append({'pawn': pawn.get_class().get_name(),
        'pitch': pitch, 'height_cm': height, 'floor_cm': floor})
    return True


step = qa['step']
step('walking default view', lambda: look(-6), bounded, 'WalkingDefault', delay=2)
step('walking maximum upward view', lambda: look(89), bounded, 'WalkingUpward', delay=1)
step('walking downward view', lambda: look(-60), bounded, 'WalkingDownward', delay=1)
step('place car beside player', qa['priority_fixture'], qa['foot_arrived'])
step('enter car through native interact', qa['interact'], qa['car_entered'])
step('driving maximum upward view', lambda: look(89), bounded, 'DrivingUpward', delay=1)
step('driving default view', lambda: look(-12), bounded, 'DrivingDefault', delay=1)
step('exit car through native interact', qa['interact'], qa['car_exited'])
step('restore car fixture', qa['restore_priority_car'], qa['car_stopped'])
step('approach worklight', qa['worklight_fixture'], qa['foot_arrived'])
step('native worklight acquisition', qa['interact'], qa['aiming'])
step('worklight remains achievable within camera bounds', qa['align_worklight'], lambda: qa['state_equal'](1, 0), 'WorklightAligned')
original_write = qa['write_report']


def write_report():
    original_write()
    (qa['OUT'] / 'report.json').write_text(qa['json'].dumps(qa['REPORT'], indent=2))
    if legacy_bytes is None:
        legacy_report.unlink(missing_ok=True)
    else:
        legacy_report.write_bytes(legacy_bytes)
    u.SystemLibrary.quit_editor()


qa['write_report'] = write_report
qa['STATE']['callback'] = u.register_slate_post_tick_callback(qa['tick'])
