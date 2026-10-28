"""Import one reviewed own Tripo cast candidate in a fresh NullRHI editor.

NORD_TRIPO_CAST_CHARACTER selects an existing approved derivative; no paid jobs.
The merged Resident9 pilot and the rejected Resident10 bag are never overwritten.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from import_tripo_pilot import import_assets

STYLES = {'GreenCap51': 3, 'Memphis33': 4, 'BlackCap': 5,
          'WhiteCap': 6, 'RedJersey': 7, 'LimeJacket': 8}


def source_plan(root, character):
    root = Path(root).resolve()
    assert character in STYLES, 'Only reviewed new cast folders; preserve the pilot and rejected bag'
    base = root / 'Data/GraphicNovel/Crew' / character
    data = base / 'tripo-h31-rig-20261017/derived/natural-v1'
    provenance = json.loads((data / 'Provenance.json').read_text())
    assert provenance['character'] == character and provenance.get('native_import_trial_allowed') is True
    assert provenance['byte_identical_copies_of_passed_CPU_outputs']

    def pinned(row, area):
        path = root / row['path']
        assert path.resolve().is_relative_to(root / area) and path.is_file() and not path.is_symlink(), path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == row['sha256'], ('Unverified source', path)
        return path

    proofs = {name: json.loads(pinned(row, 'Verification').read_text())
              for name, row in provenance['proofs'].items()}
    surface, motion, test = (proofs[k] for k in ('Surface.json', 'Motion.json', 'MotionTest.json'))
    assert all(r['passed'] for r in (surface, motion, test))
    assert test['motion_receipt']['sha256'] == provenance['proofs']['Motion.json']['sha256']
    assert surface['retained_inputs_unchanged'] and motion['retained_inputs_unchanged']
    assert surface['rig']['armature_object'] == 'Armature' and surface['rig']['bones'] == 61
    assert motion['own_static_body_surface']['sha256'] == provenance['proofs']['Surface.json']['sha256']
    for role, name in [('source_glb', 'original_glb'), ('provider_fbx', 'raw_provider_fbx')]:
        row = provenance[name]
        expected = base / ('tripo-h31-body-20261017/body.glb' if role == 'source_glb' else 'tripo-h31-rig-20261017/rig.fbx')
        assert row['path'] == str(expected.relative_to(root)), 'Source must belong to this character'
        pinned(row, 'Data')
        assert surface['inputs'][role] == row
        if role == 'provider_fbx':
            assert motion['inputs'][role] == row
    assert motion['own_static_body_surface']['source_glb'] == provenance['original_glb']

    roles = {'Body': 'body', 'Idle': 'idle', 'Walk': 'walk', 'Run': 'run', 'Jump': 'jump',
             'base_color': 'base_color', 'normal': 'normal', 'metallic_roughness': 'metallic_roughness'}
    assert set(provenance['outputs']) == set(roles.values())
    paths, hashes = {}, {}
    for kind, role in roles.items():
        row = provenance['outputs'][role]
        assert Path(row['path']).parent == data.relative_to(root), 'Derivative must belong to this character'
        paths[kind], hashes[kind] = pinned(row, 'Data'), row['sha256']
        expected = surface['output'] if role == 'body' else surface['textures'][role] if kind == role else motion['clips'][role]['output']
        assert hashes[kind] == expected['sha256'] == row['source_proof_output_sha256']
    for kind, seconds in [('idle', 4.), ('walk', 31/30), ('run', 19/30), ('jump', 1.2)]:
        clip = motion['clips'][kind]
        assert clip['bones'] == 61 and clip['fps'] == 30 and abs(clip['seconds'] - seconds) < 1e-7
    bounds = surface['correspondence']['provider_bounds_m']
    height = bounds['max'][2] - bounds['min'][2]
    assert math.isfinite(height) and .5 < height < 2.5 and abs(bounds['min'][2]) < 1e-5
    scale = 1.82 / height
    assert abs(motion['scaling']['provider_height_m'] - height) < 1e-5
    return paths, hashes, scale


def main():
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    assert '-nullrhi' in set(u.SystemLibrary.get_command_line().lower().split())
    assert not u.EditorLevelLibrary.get_pie_worlds(False)
    character = os.environ['NORD_TRIPO_CAST_CHARACTER']
    paths, hashes, scale = source_plan(root, character)
    output = root / 'Saved/Tests/TripoCastNative' / character / 'Import.json'
    folder = '/Game/ParkComic/CrewGraphicNovelTripo/Resident' + str(STYLES[character])
    prop = '/Game/ParkComic/Crew/SM_PVCTube' if character == 'LimeJacket' else '/Game/ParkComic/Crew/SM_Plunger'
    report = import_assets(u, root, paths, hashes, folder, scale, output, prop)
    assert abs(report['height_cm'] - 182.) < .1
    u.SystemLibrary.quit_editor()


if __name__ == '__main__':
    main()
