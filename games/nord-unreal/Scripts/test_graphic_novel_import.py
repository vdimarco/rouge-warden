"""Check isolated import routes without loading Unreal or touching assets."""
import ast
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
    nodes += TREE.body[report:report + 2]
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
assert route['pilot_body'] == route['source_root'] / 'generated-v1/body.fbx'
assert route['report_path'].name == 'GeneratedImport.json'
for flags in ('-NordGraphicNovelGenerated -nullrhi', '-NordGraphicNovelCandidate -NordGraphicNovelGenerated',
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
print('NORD_GRAPHIC_NOVEL_IMPORT_CPU_OK original routes preserved; generated source/destination/report isolated; unsafe flags rejected')
