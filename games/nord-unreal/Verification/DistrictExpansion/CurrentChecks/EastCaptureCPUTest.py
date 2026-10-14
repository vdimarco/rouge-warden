"""CPU-only frozen-transform checks; never import Unreal or run the factory."""
import ast
import json
import math
from types import SimpleNamespace as NS
from unittest.mock import patch

import prepare_east_capture as factory


def reject(call):
    try: call()
    except AssertionError: return
    raise AssertionError('Unsafe fixture input was accepted')


original, code, metadata = factory.build()
compile(code, 'east-capture', 'exec')
nodes = lambda text: {n.name:ast.get_source_segment(text, n) for n in ast.parse(text).body if isinstance(n, ast.FunctionDef)}
before, after = nodes(original), nodes(code)
for name in ('fixture_points', 'closest', 'vec', 'png_info', 'save_inventory', 'viewport_rectangle',
             'calibrate_viewport', 'render_guard', 'comic_weight', 'arrange', 'finish'):
    assert before[name] == after[name], ('Reusable native lifecycle changed', name)
assert before['tick'].replace("STATE['shot']==12", "STATE['shot']==6") == after['tick']
assert before['cleanup'].replace('Toronto', 'Montréal').replace('NORD_COLLEGE_CAPTURE_', 'NORD_EAST_CAPTURE_').replace("len(REPORT['captures'])==12", "len(REPORT['captures'])==6") == after['cleanup']
assert 'source/map drift' in code and factory.SOURCE_SHA in code
assert "WIDTH==1920" in code and "'-nordeastrenderchecks'" in code and "'-nordnoambient'" in code
assert "'-nordnocampaignsave' in FLAGS" in code and "owned_pie_stopped=True" in code
assert "'/Game/Maps/LaFontaine.'" in code and 'UEDPIE_\\d+_LaFontaine' in code
assert metadata['capture_count'] == 6 and metadata['resolution'] == [1920,1080]
assert metadata['visual_review_pending'] and metadata['cpu_only_preparation']
assert [v['name'] for v in metadata['fixtures']] == ['Panet', 'Visitation', 'FormerEdge']
extension = json.loads((factory.ROOT/'Data/Plateau/EastExtension/extension.json').read_text())
old_x = extension['original_bounds_xy'][2]
for view in metadata['fixtures']:
    assert all(math.isfinite(x) for key in ('point_cm', 'target_cm') for x in view[key])
    assert view['context_footprint_sample_clearance_cm'] > 96
    assert view['point_cm'][0] < old_x < view['target_cm'][0] if view['name'] == 'FormerEdge' else view['point_cm'][0] > old_x
    if view['name'] != 'FormerEdge':
        row = next(r for r in extension['roads'] if r['source'] == view['source'] and r['node_ids'] == view['node_ids'])
        assert view['point_cm'] == [(a+b)/2 for a,b in zip(*row['centerline_xy'])]
        assert view['target_cm'] in row['centerline_xy']
reject(lambda:factory.replace_once('changed source', 'required token', 'unsafe'))
reject(lambda:factory.replace_once('twice twice', 'twice', 'unsafe'))
with patch.object(factory, 'SOURCE_SHA', 'wrong'): reject(factory.build)
with patch.object(factory, 'EXTENSION_SHA', 'wrong'): reject(factory.build)

# Execute only the transformed census function against tiny native API doubles.
class Actor:
    def __init__(self, name, **properties): self.name, self.properties = name, properties
    def get_path_name(self): return self.name
    def get_editor_property(self, key): return self.properties[key]
    def get_actor_enable_collision(self): return self.properties.get('collision', True)
    def is_actor_tick_enabled(self): return self.properties.get('tick', True)

world = object(); campaign = Actor('Campaign', Phase='Encounter', CompletedMissions=0)
resident = [Actor('Resident'+str(i)) for i in range(110)]
cars = [Actor('Car'+str(i), bTraffic=i<16) for i in range(45)]
inventory = {'Campaign':[campaign], 'ParkResident':resident, 'Car':cars}
game_state = Actor('State', MissionIndex=0)
api = NS(get_all_actors_of_class=lambda world, kind:inventory[kind], get_game_state=lambda world:game_state)
context = {'u':NS(GameplayStatics=api, EditorLevelLibrary=NS(get_pie_worlds=lambda include:[world])),
           'owned_world':lambda worlds:world, 'STATE':{'world':world}, 'REPORT':{}, 'CLASSES':dict((x,x) for x in inventory)}
exec(compile(after['isolation'], 'isolated-census-only', 'exec'), context)
check = context['isolation']; check(); check()
assert context['REPORT']['population_before'] == context['REPORT']['population_last_checked']
campaign.properties['CompletedMissions'] = 1; reject(check); campaign.properties['CompletedMissions'] = 0
cars[0].properties['collision'] = False; reject(check); cars[0].properties['collision'] = True
cars[0].properties['tick'] = False; reject(check); cars[0].properties['tick'] = True
resident[0].name = 'ReplacedResident'; reject(check); resident[0].name = 'Resident0'
inventory['Campaign'] = []; reject(check); inventory['Campaign'] = [campaign]
inventory['ParkResident'] = resident[:-1]; reject(check)
print('NORD_EAST_CAPTURE_CPU_OK: frozen source/input hashes, 3 surveyed views, 6x1920 stills, unchanged native lifecycle, strict active campaign/population/save scope')
