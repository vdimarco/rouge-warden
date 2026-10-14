"""Prepare an ignored frozen Montréal still fixture; never launch Unreal/services."""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT/'Scripts/capture_college_bathurst.py'
SOURCE_SHA = '285bc8d2f9fa7af4eb97de325759ef43c9e2327b392d3cf859fa47d3f5db6fa8'
EXTENSION_SHA = 'c19300127f80c9ebd4483610544acab9162a05280ab5a2717376c88c6770dcbf'
sys.path.insert(0, str(ROOT/'Scripts'))
from plateau_streets import _distance, _inside

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def replace_once(code, old, new):
    assert code.count(old) == 1, ('Frozen fixture marker changed', old)
    return code.replace(old, new, 1)

def fixtures():
    extension = json.loads((ROOT/'Data/Plateau/EastExtension/extension.json').read_text())
    assert sha(ROOT/'Data/Plateau/EastExtension/extension.json') == EXTENSION_SHA
    assert all(sha(ROOT/path) == digest for path, digest in extension['source_hashes'].items())
    context = json.loads((ROOT/'Data/Plateau/ContextGeometry/context.json').read_text())
    edges = json.loads((ROOT/'Data/Plateau/EdgesGeometry/edges.json').read_text())
    layout = json.loads((ROOT/'Data/LaFontaine/layout.json').read_text()); views = []
    for label, street in (('Panet', 'Rue Panet'), ('Visitation', 'Rue de la Visitation')):
        road = max((r for r in extension['roads'] if r['name'] == street), key=lambda r: math.dist(*r['centerline_xy']))
        a, b = road['centerline_xy']; point = [(x+y)/2 for x, y in zip(a, b)]
        views.append(dict(name=label, point_cm=point, target_cm=max((a, b), key=lambda p: p[0]), source=road['source'], node_ids=road['node_ids'], derivation='longest retained street segment midpoint', road_width_cm=road['width_cm']))
    old = next(r for r in edges['closures'] if r['street'] == 'Rue Panet')
    point = old['interior_reference_xy']
    assert min(_distance(point, a, b) for road in layout['roads'] for a, b in zip(road, road[1:])) < .01
    views.append(dict(name='FormerEdge', point_cm=point, target_cm=[old['mapped_exit_xy'][i]+4000*old['outward_direction'][i] for i in (0, 1)], source=old['source'], former_exit_cm=old['mapped_exit_xy'], derivation='original Panet source node looking through former boundary'))
    for view in views:
        delta = [view['target_cm'][i]-view['point_cm'][i] for i in (0, 1)]; length = math.hypot(*delta)
        view.update(pitch=-12, yaw=math.degrees(math.atan2(delta[1], delta[0])))
        samples = [[view['point_cm'][i]-delta[i]/length*s for i in (0, 1)] for s in (0, 105, 210, 315, 420)]
        b = extension['expanded_bounds_xy']; assert all(b[0]+42 < p[0] < b[2]-42 and b[1]+42 < p[1] < b[3]-42 for p in samples)
        clearance = min(0 if _inside(p, r['footprint_xy']) else min(_distance(p, a, b) for a, b in zip(r['footprint_xy'], r['footprint_xy'][1:]+r['footprint_xy'][:1])) for r in context['buildings'] for p in samples)
        assert clearance > 96, 'Retained context footprint intersects the pawn/camera samples'
        view['context_footprint_sample_clearance_cm'] = clearance
    return views, extension['source_hashes']

ISOLATION = '''def isolation():
    assert owned_world(list(u.EditorLevelLibrary.get_pie_worlds(True))) is STATE['world']
    actors=lambda kind:list(u.GameplayStatics.get_all_actors_of_class(STATE['world'],CLASSES[kind]))
    campaigns,residents,cars=actors('Campaign'),actors('ParkResident'),actors('Car')
    assert len(campaigns)==1 and len(residents)==110 and sum(car.get_editor_property('bTraffic') for car in cars)==16,'Full Montréal campaign/population is required'
    campaign=campaigns[0]
    current={'campaign':campaign.get_path_name(),'phase':str(campaign.get_editor_property('Phase')),'completed':campaign.get_editor_property('CompletedMissions'),
             'mission_index':u.GameplayStatics.get_game_state(STATE['world']).get_editor_property('MissionIndex'),
             'residents':sorted(actor.get_path_name() for actor in residents),'cars':sorted(actor.get_path_name() for actor in cars)}
    assert all(car.get_actor_enable_collision() and car.is_actor_tick_enabled() for car in cars if car.get_editor_property('bTraffic')),'Ambient traffic was disabled'
    if 'population_before' not in STATE: STATE['population_before']=current;REPORT['population_before']=current
    assert current==STATE['population_before'],'Montréal progression or actor inventory changed'
    REPORT['population_last_checked']=current
'''

def build():
    assert sha(SOURCE) == SOURCE_SHA, 'Review current Toronto fixture before transforming'
    original = SOURCE.read_text(); code = original; views, inputs = fixtures()
    start = code.index('def isolation():'); end = code.index('\ndef render_guard():', start)
    code = replace_once(code, code[start:end], ISOLATION+'\n')
    code = replace_once(code, "LAYOUT=json.loads((ROOT/'Data/CollegeBathurst/layout.json').read_text());FACADE=json.loads((ROOT/'Data/CollegeBathurst/SneakyDees/facade.json').read_text())\nFIXTURES=fixture_points(LAYOUT,FACADE);", 'FIXTURES='+repr(views)+';')
    code = replace_once(code, "assert not {'-nordnocampaign','-nordnocampaignsave'}.intersection({arg.split('=',1)[0] for arg in FLAGS})", "assert '-nordnocampaignsave' in FLAGS and not {'-nordnocampaign','-nordnoambient'}.intersection({arg.split('=',1)[0] for arg in FLAGS}), 'Require active Montréal with disk save loading/writing suppressed'")
    for old, new in (("'-norddistrictrenderchecks'", "'-nordeastrenderchecks'"), ('assert WIDTH in (1280,1920)', 'assert WIDTH==1920'), ("len(REPORT['captures'])==12", "len(REPORT['captures'])==6"), ("STATE['shot']==12", "STATE['shot']==6"), ("'SingleRender'", "'MontrealEastRender'")):
        code = replace_once(code, old, new)
    old_paths = "ROOT/'Data/CollegeBathurst/layout.json',ROOT/'Data/CollegeBathurst/SneakyDees/facade.json',ROOT/'Content/Maps/CollegeBathurst.umap'"
    paths = [*inputs, 'Data/Plateau/EastExtension/extension.json', 'Scripts/capture_college_bathurst.py', 'Scripts/plateau_streets.py', 'Scripts/plateau_ground.py', 'Source/Quebec/QuebecCampaign.cpp', 'Source/Quebec/QuebecGameplay.cpp', 'Content/Maps/LaFontaine.umap']
    code = replace_once(code, old_paths, ','.join('ROOT/'+repr(path) for path in paths))
    hashes = {path:sha(ROOT/path) for path in paths}
    code = replace_once(code, 'ROOT=Path(u.Paths.project_dir()).resolve();ARGS=', "ROOT=Path(u.Paths.project_dir()).resolve();\nassert "+repr(hashes)+"=={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in "+repr(paths)+"}, 'Frozen east capture source/map drift'\nARGS=")
    for old, new, count in (('CollegeBathurst', 'LaFontaine', 4), ('Toronto', 'Montréal', 2), ('NORD_COLLEGE_CAPTURE_', 'NORD_EAST_CAPTURE_', 3)):
        assert code.count(old) == count, ('Frozen identity count changed', old)
        code = code.replace(old, new)
    code = replace_once(code, 'Use one standalone startup player. No campaign/save suppression flags or asset authoring.', 'Use one standalone startup player and -NordNoCampaignSave; no save loading/writing or persistence claim. No asset authoring.')
    code = replace_once(code, '-NordDistrictRenderChecks', '-NordEastRenderChecks -NordNoCampaignSave')
    code = replace_once(code, '-NordCaptureWidth=1280|1920', '-NordCaptureWidth=1920')
    code = replace_once(code, "'no motion/FPS/audio/package acceptance'", "'no motion/FPS/audio/package acceptance','NoCampaignSave suppresses disk loading and writing; no persistence acceptance','source road-center fixtures, not a naturally navigated sidewalk trip','CPU footprint samples do not prove native camera clearance'")
    assert 'CollegeBathurst' not in code and '==12' not in code
    compile(code, 'east-capture', 'exec')
    return original, code, {'source_sha256': SOURCE_SHA, 'inputs_sha256': hashes, 'fixtures': views, 'capture_count': 6, 'resolution': [1920,1080], 'visual_review_pending': True, 'cpu_only_preparation': True}

def main():
    original, code, metadata = build()
    out = ROOT/'Saved/Tests/DistrictRuntime'/('EastCapturePrepared-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')); out.mkdir()
    (out/'source_fixture.py').write_text(original); (out/'capture.py').write_text(code)
    assert sha(out/'source_fixture.py') == SOURCE_SHA
    metadata.update(factory_sha256=sha(Path(__file__)), capture_sha256=sha(out/'capture.py'), frozen_source_sha256=sha(out/'source_fixture.py'))
    (out/'provenance.json').write_text(json.dumps(metadata, indent=2)+'\n'); print(out)

if __name__ == '__main__': main()
