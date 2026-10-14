"""Check isolated import routes without loading Unreal or touching assets."""
import ast
import hashlib
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace

SOURCE = Path(__file__).with_name('import_meshy_crew.py')
TREE = ast.parse(SOURCE.read_text())


class FixturePath(type(Path())):
    def is_file(self):
        return True


def selection(flags):
    nodes, active = [], False
    for node in TREE.body:
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id == 'styles':
            active = True
        if isinstance(node, ast.For) and isinstance(node.target, ast.Name) and node.target.id == 'name':
            break
        if active:
            nodes.append(node)
    report = next(index for index, node in enumerate(TREE.body)
                  if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name) and node.targets[0].id == 'report_path')
    nodes += TREE.body[report:report + 3]
    context = {'root': FixturePath('/import-fixture'),
               'u': SimpleNamespace(SystemLibrary=SimpleNamespace(get_command_line=lambda: flags))}
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), 'exec'), context)
    return context


for flags, folder, count in (('', 'Crew', 8), ('-NordNeutralCandidate', 'CrewNeutral', 1),
                            ('-NordGraphicNovelCandidate -nullrhi', 'CrewGraphicNovel', 1)):
    route = selection(flags)
    assert route['crew_folder'] == folder and len(route['styles']) == count
    assert route['source_root'] == route['root'] / 'Data/CharactersNeutral'
    assert not route['generated']
    if route['graphic_novel']:
        assert route['pilot_body'] == route['root'] / 'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe/body-bind-pose.fbx'
        assert route['report_path'].name == 'PilotImport.json'

route = selection('-NordGraphicNovelCandidate -NordGraphicNovelGenerated -nullrhi')
assert route['styles'] == {'generated-v1': 9}
assert route['crew_folder'] == 'CrewGraphicNovelGenerated'
assert route['source_root'] == route['root'] / 'Data/GraphicNovel/Pilot/CurlyMetalhead'
assert route['pilot_body'] == route['source_root'] / 'refined-v1/body.fbx'
assert route['report_path'].name == 'GeneratedImport.json'
high = selection('-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail -nullrhi')
assert high['styles'] == {'generated-v2-high-detail': 9}
assert high['crew_folder'] == 'CrewGraphicNovelHighDetail'
assert high['source_root'] == route['source_root']
assert high['pilot_body'] == high['source_root'] / 'generated-v2-high-detail/body.fbx'
assert high['report_path'].name == 'HighDetailImport.json'
assert not selection('-NordGraphicNovelHighDetailOther -nullrhi')['high_detail']
prefix = selection('-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetailOther -nullrhi')
assert not prefix['high_detail'] and prefix['crew_folder'] == 'CrewGraphicNovelGenerated'
for flags in ('-NordGraphicNovelHighDetail -nullrhi',
              '-NordGraphicNovelCandidate -NordGraphicNovelHighDetail -nullrhi',
              '-NordGraphicNovelGenerated -NordGraphicNovelHighDetail -nullrhi',
              '-NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail',
              '-NordNeutralCandidate -NordGraphicNovelCandidate -NordGraphicNovelGenerated -NordGraphicNovelHighDetail -nullrhi',
              '-NordGraphicNovelGenerated -nullrhi', '-NordGraphicNovelCandidate -NordGraphicNovelGenerated',
              '-NordNeutralCandidate -NordGraphicNovelCandidate -NordGraphicNovelGenerated -nullrhi'):
    try:
        selection(flags)
    except AssertionError:
        pass
    else:
        raise AssertionError('Unsafe generated import flags accepted: ' + flags)
normal_alpha = next(node.args[1] for node in ast.walk(TREE) if isinstance(node, ast.Call)
                    and isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name)
                    and node.func.value.id == 'detail' and node.func.attr == 'set_editor_property'
                    and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'const_alpha')
for generated, expected in ((False, .65), (True, 0.)):
    assert eval(compile(ast.Expression(normal_alpha), str(SOURCE), 'eval'), {'generated': generated}) == expected
uv_route = next(node for node in ast.walk(TREE) if isinstance(node, ast.If)
                and ast.unparse(node.test) == "generated and (not high_detail) and (channel == 'base_color')")
for generated, high_detail in ((False, False), (True, False), (True, True)):
    for channel in ('base_color', 'normal', 'roughness', 'metallic'):
        routed = []
        uv = SimpleNamespace(set_editor_property=lambda key, value: routed.append((key, value)))
        materials = SimpleNamespace(create_material_expression=lambda *args: uv,
                                    connect_material_expressions=lambda *args: routed.append(args) or True)
        node = object()
        exec(compile(ast.Module(body=[uv_route], type_ignores=[]), str(SOURCE), 'exec'),
             {'generated': generated, 'high_detail': high_detail, 'channel': channel,
              'materials': materials, 'material': object(),
              'node': node, 'u': SimpleNamespace(MaterialExpressionTextureCoordinate=object())})
        assert routed == ([('coordinate_index', 1), (uv, '', node, 'UVs')]
                          if generated and not high_detail and channel == 'base_color' else [])
# Validate before the first backup/asset mutation, using real temporary files.
high_guard = next(node for node in TREE.body if isinstance(node, ast.If) and ast.unparse(node.test) == 'high_detail'
                  and isinstance(node.body[0], ast.Assign) and node.body[0].targets[0].id == 'high_source')
backup_node = next(node for node in TREE.body if isinstance(node, ast.Assign) and node.targets[0].id == 'backup')
assert TREE.body.index(high_guard) < TREE.body.index(backup_node)
source_folder = SOURCE.parent.parent / 'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
real_review = json.loads((source_folder / 'source-review.json').read_text())
real_generation = json.loads((source_folder / 'generation.json').read_text())
real_files = json.loads((source_folder / 'files.json').read_text())
for defect in (None, 'review_failed', 'source_changed', 'clip_bind_failed', 'wrong_uvs', 'incomplete_generation',
               'wrong_request', 'manifest_hash', 'body_bytes', 'clip_bytes', 'map_bytes', 'reference_bytes',
               'file_size', 'missing_clip', 'duplicate_file', 'outside_folder', 'reviewed_body', 'generation_reference'):
    with tempfile.TemporaryDirectory() as directory:
        source_root = Path(directory)
        folder = source_root / 'generated-v2-high-detail'
        folder.mkdir()
        entries = []
        for index, row in enumerate(real_files):
            content = ('fixture:' + row['file'] + ':' + str(index)).encode()
            (folder / row['file']).write_bytes(content)
            entries.append({'file': row['file'], 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
        review, generation = dict(real_review), dict(real_generation)
        hashes = {row['file']: row['sha256'] for row in entries}
        review.update(body_sha256=hashes['body.fbx'], body_glb_sha256=hashes['body.glb'])
        generation['source_reference_sha256'] = hashes['reference.png']
        if defect == 'review_failed': review['passed'] = False
        elif defect == 'source_changed': review['source_unchanged'] = False
        elif defect == 'clip_bind_failed': review['own_clip_bind_checks_passed'] = False
        elif defect == 'wrong_uvs': review['uv_channels'] = 2
        elif defect == 'incomplete_generation': generation['status'] = 'submitted'
        elif defect == 'wrong_request': review['generation_request_id'] = 'another-request'
        elif defect in ('body_bytes', 'clip_bytes', 'map_bytes', 'reference_bytes'):
            name = {'body_bytes': 'body.fbx', 'clip_bytes': 'jump.fbx', 'map_bytes': 'normal.png', 'reference_bytes': 'reference.png'}[defect]
            path = folder / name
            content = path.read_bytes()
            path.write_bytes(b'X' + content[1:])  # Same byte count: hash must detect it.
        elif defect == 'file_size': entries[0]['bytes'] += 1
        elif defect == 'missing_clip': entries = [row for row in entries if row['file'] != 'walk.fbx']
        elif defect == 'duplicate_file': entries[-1] = dict(entries[0])
        elif defect == 'outside_folder':
            path = folder / 'body.fbx'
            external = source_root / 'outside.fbx'
            path.rename(external)
            path.symlink_to(external)
        elif defect == 'reviewed_body': review['body_sha256'] = '0' * 64
        elif defect == 'generation_reference': generation['source_reference_sha256'] = '0' * 64
        manifest = folder / 'files.json'
        manifest.write_text(json.dumps(entries))
        review['manifest_sha256'] = hashlib.sha256(manifest.read_bytes()).hexdigest()
        if defect == 'manifest_hash': review['manifest_sha256'] = '0' * 64
        (folder / 'source-review.json').write_text(json.dumps(review))
        (folder / 'generation.json').write_text(json.dumps(generation))
        context = {'high_detail': True, 'source_root': source_root, 'json': json, 'hashlib': hashlib}
        try:
            exec(compile(ast.Module(body=[high_guard], type_ignores=[]), str(SOURCE), 'exec'), context)
        except AssertionError:
            assert defect, 'Valid high-detail source receipt rejected'
        else:
            assert defect is None, 'Unsafe high-detail source accepted: ' + str(defect)
# Also check the current retained source receipt, with no Unreal imports/mutations.
exec(compile(ast.Module(body=[high_guard], type_ignores=[]), str(SOURCE), 'exec'),
     {'high_detail': True, 'source_root': source_folder.parent, 'json': json, 'hashlib': hashlib})

print('NORD_GRAPHIC_NOVEL_IMPORT_CPU_OK original routes preserved; generated source/destination/report isolated; unsafe flags rejected')
