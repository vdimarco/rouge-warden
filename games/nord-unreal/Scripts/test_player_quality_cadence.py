"""Exercise the capture's real cadence validator with sampled motion, without Unreal."""
import ast
import math
from pathlib import Path


source = Path(__file__).with_name('capture_player_quality.py')
tree = ast.parse(source.read_text())
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'locomotion_cadence')
context = {'math': math}
exec(compile(ast.Module(body=[function], type_ignores=[]), str(source), 'exec'), context)
cadence = context['locomotion_cadence']
LENGTH = .83


def samples(kind, hz, held=False):
    speed, rate = (450., 2.) if kind == 'Walk' else (800., 800 / 600)
    rows = []
    for frame in range(math.ceil(1.2 * hz) + 1):
        world_time = frame / hz
        pose_time = math.floor(world_time * 12) / 12 if held else world_time
        phase = (.72 + pose_time * rate) % LENGTH
        angle = phase * math.tau / LENGTH
        rows.append({'world_time': world_time, 'engine_frame': 100 + frame,
                     'clip_time': phase, 'speed_cm_s': speed,
                     'actor_cm': [speed * world_time, 0., 0.],
                     'left_foot_component_cm': [20 * math.sin(angle), 10 * math.cos(angle), 5.]})
    return rows


def reject(rows, reason):
    try:
        cadence('Run', rows, LENGTH)
    except AssertionError as error:
        assert reason in str(error), (reason, error)
    else:
        raise AssertionError('Invalid locomotion sample was accepted: ' + reason)


def main():
    for kind in ('Walk', 'Run'):
        for hz in (30, 60, 120):
            rows = samples(kind, hz)
            result = cadence(kind, rows, LENGTH)
            assert result['phase_advance_pairs'] == len(rows) - 1
            assert result['clip_wraps'] >= 2
            assert result['largest_phase_rate_error_seconds'] == 0.
    for hz in (30, 60, 120):
        reject(samples('Run', hz, held=True), 'held pose')
    for direction in (-1, 1):
        rows = samples('Run', 60)
        for row in rows[1:]:
            row['clip_time'] = (row['clip_time'] + direction * .2) % LENGTH
        reject(rows, 'phase jumped')
    rows = samples('Run', 60)
    for row in rows:
        row['left_foot_component_cm'] = [0., 0., 5.]
    reject(rows, 'bones held')
    reject(samples('Run', 12), 'sampling too sparse')
    rows = samples('Run', 60)
    rows[1]['engine_frame'] = rows[0]['engine_frame']
    reject(rows, 'frame observations')
    print('NORD_PLAYER_QUALITY_CADENCE_OK smooth Walk/Run at 30/60/120 world samples/s and wraps; 12-Hz holds, phase jumps, frozen bones and sparse/duplicate observations rejected')


if __name__ == '__main__':
    main()
