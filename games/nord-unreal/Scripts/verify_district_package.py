"""Bounded two-district Linux Development package QA; no editor or live-package promotion.

Run explicitly against a fresh archive under this checkout's Builds. The default
proof uses separate NullRHI standalone/listen/client processes. Optional rendered
startup adds the existing seven native NordCapture screenshots per district.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time

from package_inventory import ROW, verify_plateau_inventory
from render_log_guard import assert_render_log_clean

ROOT = Path(__file__).resolve().parents[1]
DISTRICTS = {'montreal': ('LaFontaine', 'Data/LaFontaine/layout.json'),
             'toronto': ('CollegeBathurst', 'Data/CollegeBathurst/layout.json')}
SHOTS = ('NordComic_East', 'NordComic_North', 'NordComic_West', 'NordRealistic_East',
         'NordRealistic_North', 'NordComic_Jump', 'NordComic_Car')
BAD_COMMAND = re.compile(r'Bad or missing property|Failed to find function|Failed to find an object named|Unrecognized command', re.I)
INVENTORY_COMMANDS = '\n'.join(('getall StaticMeshComponent StaticMesh',
    'getall SkeletalMeshComponent SkinnedAsset', 'getall AnimSequence Skeleton',
    'getall QuebecPedestrian WalkSpeed', 'getall QuebecVegetation Trees',
    'getall QuebecParkResident Style', 'getall QuebecCampaign CompletedMissions',
    'getall QuebecGameState MissionIndex', 'getall QuebecCharacter CrewStyle',
    'getall QuebecCar bTraffic'))
TRANSFORMS = 'getall StaticMeshComponent RelativeLocation\ngetall StaticMeshComponent RelativeRotation'
SCALABILITY = tuple('sg.'+name+'Quality' for name in ('ViewDistance','AntiAliasing','Shadow','GlobalIllumination',
    'Reflection','PostProcess','Texture','Effects','Foliage','Shading','Landscape'))
QUALITY_COMMANDS = '\n'.join((*SCALABILITY,'r.ScreenPercentage'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def level(map_name):
    return rf'/Game/Maps/{re.escape(map_name)}\.{re.escape(map_name)}:PersistentLevel'


def mesh_inventory(text, map_name, asset_folder, expected):
    """Require one exact live component per expected asset, scoped to its map."""
    rows = re.findall(ROW + rf'StaticMeshComponent\s+({level(map_name)}\.[^\s=]+)\.StaticMesh\s*=\s*'
        rf"/Script/Engine\.StaticMesh'{re.escape(asset_folder)}/SM_([A-Za-z0-9_]+)\.SM_\2'\s*$", text)
    assert len(rows) == len({component for component, _ in rows}), 'Conflicting live mesh component rows'
    names = [name for _, name in rows]
    assert len(names) == len(set(names)), 'Duplicate live district mesh assets'
    assert set(names) == set(expected), ('District loaded meshes differ', map_name, asset_folder,
                                         sorted(set(expected)-set(names)), sorted(set(names)-set(expected)))
    return len(names)


def actor_values(text, map_name, actor_class, prop):
    return dict(re.findall(ROW + rf'{re.escape(actor_class)}\s+({level(map_name)}\.[^\s=]+)'
                           rf'\.{re.escape(prop)}\s*=\s*([^\r\n]+)', text))


def verify_inventory(text, district, root=ROOT, *, dependencies=True, authoritative=True, crew_evidence=None):
    map_name, relative = DISTRICTS[district]
    mission = actor_values(text, map_name, 'QuebecGameState', 'MissionIndex')
    assert len(mission) == 1 and set(mission.values()) == {'0'}, 'Fresh district mission state is not zero'
    campaigns = actor_values(text, map_name, 'QuebecCampaign', 'CompletedMissions')
    residents = actor_values(text, map_name, 'QuebecParkResident', 'Style')
    cars = actor_values(text, map_name, 'QuebecCar', 'bTraffic')
    assert cars, 'No actual district cars dumped'
    if district == 'montreal':
        assert len(campaigns) == 1 and set(campaigns.values()) == {'0'}, 'Fresh Montréal campaign missing/nonzero'
        traffic = sum(v == 'True' for v in cars.values())
        assert (len(residents) == 110 if authoritative else 0 < len(residents) <= 110), ('Montréal relevant resident population', len(residents))
        assert (traffic == 16 if authoritative else traffic <= 16), 'Montréal traffic regression'
        result = {'campaigns': 1, 'residents': len(residents), 'cars': len(cars), 'traffic': traffic,
                  'population_scope': 'authority complete' if authoritative else 'client network-relevant subset'}
        if dependencies:
            result['plateau'] = verify_plateau_inventory(text, root)
            extension = json.loads((root/'Data/Plateau/EastExtension/extension.json').read_text())
            assert extension['road_segments'] == 143 and len(extension['materials']) == 40
            result['east_extension_meshes'] = mesh_inventory(text, map_name, '/Game/Plateau/EastExtension', extension['materials'])
            parts = set(re.findall(r'SM_Resident(\d+)(Body|Head|LeftArm|RightArm|LeftLeg|RightLeg)', text))
            assert len(parts) == 66, ('Cooked resident parts', len(parts))
    else:
        assert not campaigns and not residents and not re.search(ROW+r'(?:QuebecCampaign|QuebecParkResident)\s+', text), 'Toronto loaded a Montréal campaign/crowd'
        assert len(cars) == 1 and set(cars.values()) == {'False'}, 'Toronto must have only the manual starter'
        assert not actor_values(text, map_name, 'QuebecPedestrian', 'WalkSpeed'), 'Toronto borrowed Plateau pedestrians'
        result = {'campaigns': 0, 'residents': 0, 'cars': 1, 'traffic': 0}
        if dependencies:
            expected = {p.stem for p in (root/'Data/CollegeBathurst/Geometry').glob('*.obj')}
            assert len(expected) == 12, 'Toronto source mesh inventory changed'
            result['district_meshes'] = mesh_inventory(text, map_name, '/Game/CollegeBathurst', expected)
            facade = json.loads((root/'Data/CollegeBathurst/SneakyDees/facade.json').read_text())
            assert facade['new_collision'] is False and len(facade['materials']) == 8
            result['sneaky_dees_meshes'] = mesh_inventory(text, map_name, '/Game/CollegeBathurst/SneakyDees', facade['materials'])
    if dependencies:
        if crew_evidence is None:
            crew = set(re.findall(r'/Game/ParkComic/Crew/Resident(\d+)/SK_Body\.SK_Body', text))
            clips = set(re.findall(r'/Game/ParkComic/Crew/Resident(\d+)/(A_Walk|A_Idle|A_Run|A_Jump)', text))
            assert crew == set(map(str, range(3, 11))), ('Cooked original crew', crew)
            assert len(clips) == 32, ('Cooked original clips', len(clips))
        else:
            assert len(crew_evidence['selections']) == 8 and {row['crew_style'] for row in crew_evidence['selections']} == set(range(3, 11)), 'Every actual production selection is required'
            assert set(crew_evidence['body_assets']) == {f'/Game/ParkComic/Crew/Resident{style}/SK_Body.SK_Body' for style in range(3, 11)}
            assert set(crew_evidence['clip_assets']) == {f'/Game/ParkComic/Crew/Resident{style}/A_{kind}.A_{kind}' for style in range(3, 11) for kind in ('Idle','Walk','Run','Jump')}
        result.update(crew=8, original_clips=32)
    return result


def hull_transforms(text, map_name):
    prefix = ROW + rf'StaticMeshComponent\s+{level(map_name)}\.(QuebecCar_\d+)\.VehicleHull\.'
    positions = dict((name, tuple(map(float, xyz))) for name, *xyz in re.findall(
        prefix + r'RelativeLocation\s*=\s*\(X=([-\d.]+),Y=([-\d.]+),Z=([-\d.]+)\)', text))
    rotations = dict((name, float(yaw)) for name, yaw in re.findall(
        prefix + r'RelativeRotation\s*=\s*\(Pitch=[-\d.]+,Yaw=([-\d.]+),Roll=[-\d.]+\)', text))
    assert positions and positions.keys() == rotations.keys(), 'Missing current VehicleHull transforms'
    assert all(math.isfinite(v) for xyz in positions.values() for v in xyz)
    return {name: (point, rotations[name]) for name, point in positions.items()}


def tagged_cars(text, map_name, tag):
    found, current = set(), None
    for line in text.splitlines():
        header = re.search(rf'QuebecCar\s+{level(map_name)}\.(QuebecCar_\d+)\.Tags =', line)
        if header:
            current = header[1]
        elif current and re.search(r'\b\d+:\s*'+re.escape(tag)+r'\b', line):
            found.add(current)
        elif current and re.search(r'\d+\) [A-Za-z]', line):
            current = None
    return found


def validate_starter(district, layout, transforms, tags, log):
    if district == 'toronto':
        assert len(transforms) == 1, 'Toronto starter selection requires its sole manual car'
        car = next(iter(transforms))
        point, yaw = transforms[car]
        assert math.dist(point[:2], layout['car'][:2]) < 2, ('Toronto starter moved from authored position', point, layout['car'])
        assert abs((yaw-layout['car_yaw']+180)%360-180) < .05, 'Toronto authored starter heading differs'
        return car, {'selection': 'sole Toronto manual car at authored spawn'}
    tagged = tagged_cars(tags, 'LaFontaine', 'StarterCar')
    assert len(tagged) == 1 and tagged <= transforms.keys(), ('Expected unique native StarterCar tag', sorted(tagged))
    car = next(iter(tagged)); point, yaw = transforms[car]
    original = layout['car'][:2]
    nearest = None
    for index, road in enumerate(layout['roads']):
        for a, b in zip(road, road[1:]):
            length = math.dist(a,b)
            if length <= 1800:
                continue
            direction = [(b[i]-a[i])/length for i in (0,1)]
            along = max(0,min(length,sum((original[i]-a[i])*direction[i] for i in (0,1))))
            distance = math.dist(original,[a[i]+along*direction[i] for i in (0,1)])
            if nearest is None or distance < nearest[0]:
                nearest = (distance,index,a,b,direction,layout['road_widths'][index])
    assert nearest is not None, 'No native eligible source road for starter'
    _, index, a, b, direction, width = nearest
    right = (-direction[1],direction[0]); facing=(math.cos(math.radians(yaw)),math.sin(math.radians(yaw)))
    sign = 1 if sum(facing[i]*direction[i] for i in (0,1)) >= 0 else -1
    parking = [v*sign for v in facing]; curb_right=(-parking[1],parking[0])
    deviation = abs(math.atan2(direction[0]*parking[1]-direction[1]*parking[0],sum(direction[i]*parking[i] for i in (0,1))))
    assert deviation <= math.atan2(100,470)+.00001, 'Starter heading exceeds native curb slope bound'
    matches=[]
    for offset in (0,600,-600,1200,-1200):
        center=[original[i]+direction[i]*offset for i in (0,1)]
        along=sum((center[i]-a[i])*direction[i] for i in (0,1))
        if not 1470 <= along <= math.dist(a,b)-1470:
            continue
        for side in (-1,1):
            delta=[point[i]-center[i]+curb_right[i]*side*140 for i in (0,1)]
            edge=sum(delta[i]*right[i] for i in (0,1))*side
            error=abs(sum(delta[i]*direction[i] for i in (0,1)))
            grid=(edge-(width*.5-100))/20
            if error < .2 and 540-.2 <= edge <= width*.5+1000+.2 and abs(grid-round(grid))*20 < .2:
                matches.append({'source_road_index':index,'native_along_offset_cm':offset,'curb_side':side,
                                'sampled_curb_edge_cm':edge,'source_width_cm':width,'formula_error_cm':error})
    assert len(matches)==1, ('Starter does not match exact native curb-search geometry', car, point, yaw, matches)
    offsets=re.findall(r'NORD_POPULATION starter_curb_offset_cm=([0-9.]+)',log)
    distance=math.dist(original,point[:2])
    assert len(offsets)==1 and abs(distance-float(offsets[0])) <= .51, ('Starter runtime offset log differs',distance,offsets)
    return car, {'selection':'unique native StarterCar tag and exact source curb-search formula',
                 'native_logged_offset_cm':float(offsets[0]),**matches[0]}


def missing_streaming_assets(text, root=ROOT):
    paths=set(re.findall(r'LogStreaming: Warning: LoadPackage: SkipPackage: (/Game/[^ ]+)',text))
    optional={f'/Game/ParkComic/Crew/Resident{i}/BS_Locomotion' for i in range(3,11)}
    assert paths <= optional, ('Unexpected streaming missing packages',sorted(paths-optional))
    assert all(not (root/('Content/'+path.removeprefix('/Game/')+'.uasset')).exists() for path in paths), 'Package omitted a present source asset'
    present=sum((root/f'Content/ParkComic/Crew/Resident{style}/BS_Locomotion.uasset').is_file() for style in range(3,11))
    return {'missing_packages':sorted(paths),'missing_count':len(paths),'source_assets_absent':True if paths else None,
            'current_production_sources_present':present,
            'explanation':'Historical source-absent BlendSpace warnings remain labelled; current QA requires all eight new source/cooked graphs before launch, so any missing production BS now fails.'}


def scalar(text, actor, prop):
    values = re.findall(r'\.'+re.escape(actor)+r'\.'+re.escape(prop)+r' = ([-\d.]+)', text)
    return float(values[-1]) if values else None


def occupant(text, car):
    values = re.findall(r'\.'+re.escape(car)+r'\.Occupant = ([^\r\n]+)', text)
    return values[-1] if values else None


def controller_pawn(text, map_name):
    rows = re.findall(ROW + rf'QuebecController\s+{level(map_name)}\.QuebecController_\d+\.Pawn\s*=\s*'
                      rf"(?:/Script/Quebec\.)?Quebec(?:Character|Car)'{level(map_name)}\.(Quebec(?:Character|Car)_\d+)'", text)
    assert len(rows) <= 1, ('Expected one local packaged controller', rows)
    return rows[0] if rows else None


def local_walker(text, map_name):
    pawn = controller_pawn(text, map_name)
    assert pawn and pawn.startswith('QuebecCharacter_'), 'Local packaged walker missing'
    return pawn


IDENTITY_COMMANDS='getall QuebecController Player\ngetall QuebecController Pawn\ngetall QuebecController PlayerState\ngetall PlayerState PlayerId'


def player_identity(text,map_name,remote=False):
    players=actor_values(text,map_name,'QuebecController','Player')
    pawns=actor_values(text,map_name,'QuebecController','Pawn')
    states=actor_values(text,map_name,'QuebecController','PlayerState')
    ids=actor_values(text,map_name,'PlayerState','PlayerId')
    candidates=[path for path,value in players.items() if re.search(r"(?:Ip|Net)Connection'" if remote else r"LocalPlayer'",value)]
    assert len(candidates)==1, ('Expected one remote/local connection controller',remote,players)
    pc=candidates[0]
    assert pc in pawns and pc in states, 'Controller pawn/player state readback missing'
    state=re.search(r"'([^']+)'$",states[pc]);pawn=re.search(r"\.(Quebec(?:Character|Car)_\d+)'$",pawns[pc])
    assert state and pawn and state[1] in ids, ('Replicated player identity missing',states,pawns,ids)
    return {'controller_path':pc,'player':players[pc],'pawn':pawn[1],
            'player_state_path':state[1],'player_id':int(ids[state[1]])}


def match_client_car(transforms,traffic,host_point,host_yaw):
    candidates=[name for name,(point,yaw) in transforms.items() if traffic.get(name)=='False' and
                math.dist(point,host_point)<3 and abs((yaw-host_yaw+180)%360-180)<180/256+.02]
    assert len(candidates)==1, ('Ambiguous/missing replicated starter pose',candidates,host_point,host_yaw)
    return candidates[0]


GRAPH_COMMANDS='\n'.join(('getall QuebecController Pawn','getall QuebecCharacter CrewStyle',
    'getall SkeletalMeshComponent AnimScriptInstance','getall SkeletalMeshComponent VisibilityBasedAnimTickOption',
    'getall QuebecCrewAnimInstance LocomotionAsset','getall QuebecCrewAnimInstance JumpAsset',
    'getall QuebecCrewAnimInstance ObservedClip','getall QuebecCrewAnimInstance ObservedClipTime'))


def possessed_graph(text,map_name,walker,require_observed=False):
    owner=level(map_name)+r'\.'+re.escape(walker)
    styles=actor_values(text,map_name,'QuebecCharacter','CrewStyle')
    path=f'/Game/Maps/{map_name}.{map_name}:PersistentLevel.{walker}'
    assert path in styles and 3<=int(styles[path])<=10, ('Own production crew style missing',walker,styles)
    style=int(styles[path]);folder=f'/Game/ParkComic/Crew/Resident{style}'
    bindings=re.findall(ROW+rf'SkeletalMeshComponent\s+({owner}\.[^.\s=]+)\.AnimScriptInstance\s*=\s*'
                        r"(?:/Script/Quebec\.)?QuebecCrewAnimInstance'([^']+)'",text)
    assert len(bindings)==1, ('Possessed walker does not bind exactly one native blended instance',walker,bindings)
    component,instance=bindings[0]
    assert instance.startswith(component+'.'), 'Animation instance is not owned by the current mesh'
    def prop(name):
        rows=re.findall(ROW+r'QuebecCrewAnimInstance\s+'+re.escape(instance)+r'\.'+name+r'\s*=\s*([^\r\n]+)',text)
        assert len(rows)==1, ('Active native animation property missing/duplicated',name,instance)
        return rows[0]
    def asset(name,expected):
        value=prop(name);match=re.search(r"'([^']+)'$",value)
        assert match and match[1]==expected, ('Active graph has wrong own asset',name,value,expected)
        return match[1]
    graph=asset('LocomotionAsset',folder+'/BS_Locomotion.BS_Locomotion')
    jump=asset('JumpAsset',folder+'/A_Jump.A_Jump')
    clip_value=prop('ObservedClip');clip=re.search(r"'([^']+)'$",clip_value)
    assert (clip is None and clip_value=='None' and not require_observed) or (clip and clip[1] in {folder+'/A_'+kind+'.A_'+kind for kind in ('Idle','Walk','Run','Jump')}), ('Observed clip is not this body own clip',clip_value)
    clock=float(prop('ObservedClipTime'));assert math.isfinite(clock) and clock>=0
    policy=re.findall(ROW+r'SkeletalMeshComponent\s+'+re.escape(component)+r'\.VisibilityBasedAnimTickOption\s*=\s*([^\r\n]+)',text)
    assert len(policy)==1, 'Missing actual animation visibility policy readback'
    return {'walker':walker,'crew_style':style,'mesh_component':component,'instance':instance,'locomotion_asset':graph,
            'jump_asset':jump,'observed_clip':clip[1] if clip else None,'observed_clip_time':clock,'visibility_based_anim_tick_option':policy[0],
            'scope':'Active mesh-bound native graph selection; no animation policy/velocity/state writes'}


def graph_proof(peer,map_name,walker,rendered=False):
    first=possessed_graph(peer.snapshot(GRAPH_COMMANDS),map_name,walker,rendered)
    result={'first':first,'clock_advance_required':rendered,'clock_scope':'Rendered native startup only' if rendered else 'NullRHI asset selection only; no pose/clock acceptance'}
    if rendered:
        def advanced(text):
            sample=possessed_graph(text,map_name,walker,True)
            return sample if sample['instance']==first['instance'] and sample['observed_clip']==first['observed_clip'] and abs(sample['observed_clip_time']-first['observed_clip_time'])>1e-4 else None
        second=peer.until(GRAPH_COMMANDS,advanced,timeout=8)
        result.update(second=second,clock_advanced=True)
    return result


def verify_cooked_graphs(runner,root=ROOT):
    cooker=runner.parents[2]/'Cooked/Linux/Quebec'
    rows={}
    for style in range(3,11):
        relative=f'Content/ParkComic/Crew/Resident{style}/BS_Locomotion'
        source=root/(relative+'.uasset');header=cooker/(relative+'.uasset');exports=cooker/(relative+'.uexp')
        assert source.is_file(), ('Missing newly authored source graph',style,source)
        assert header.is_file() and header.read_bytes()[:4]==b'\xc1\x83\x2a\x9e', ('Missing/invalid isolated cooked graph header',style,header)
        assert exports.is_file() and exports.stat().st_size>0, ('Missing isolated cooked graph exports',style,exports)
        rows[str(style)]={'source_sha256':sha(source),'cooked_header_sha256':sha(header),'cooked_export_sha256':sha(exports),
                          'header':str(header),'exports':str(exports)}
    return {'count':8,'graphs':rows,'scope':'Eight fresh isolated cooker outputs; not an independent IoStore archive listing. Actual selected archived graph is separately proved by each packaged peer.'}


def validate_paths(runner, output, root=ROOT):
    root, runner, output = root.resolve(), runner.resolve(), output.resolve()
    assert runner.is_file() and runner.name == 'Quebec.sh' and runner.is_relative_to(root/'Builds') and runner.parent.name == 'Linux' and runner.parent.parent.name == 'Archive', 'Use an explicit fresh Archive/Linux/Quebec.sh under this checkout Builds'
    assert not output.exists() and output.is_relative_to(root/'Saved/Tests'), 'Use a fresh output directory under Saved/Tests'
    return runner, output


def rendered_quality(text, allow_startup=False):
    # ConsoleManager.cpp emits CVar = "value" [LastSetBy: ...]; exclude warning/config echoes.
    lines=[re.sub(r'^(?:\[[^\]\r\n]*\]){0,2}\s*','',line) for line in text.splitlines()]
    values={}
    for name in (*SCALABILITY,'r.ScreenPercentage'):
        matches=[match[1] for line in lines if (match:=re.fullmatch(re.escape(name)+r'\s*=\s*"([-+\d.eE]+)"(?:\s+LastSetBy:\s*\S+)?\s*',line))]
        assert len(matches)==1, ('Missing/duplicate native rendered CVar readback',name,matches)
        values[name]=float(matches[0]);assert math.isfinite(values[name])
    assert all(values[name]==3 for name in SCALABILITY), ('Rendered package requires all eleven Epic groups',values)
    # The initial console batch can precede ExecCmds at engine frame zero.
    if allow_startup and values['r.ScreenPercentage']==0:
        return None
    assert abs(values['r.ScreenPercentage']-100)<.01, ('Rendered package requires actual screen percentage100',values)
    return values


def argv(runner, address, userdir, log, macro, port, rendered=False):
    settings='Scalability 3,r.ScreenPercentage 100,t.MaxFPS 60' if rendered else 't.MaxFPS 60'
    result = ['bash', str(runner), address, '-port='+str(port), '-unattended', '-nosound', '-NordNoCampaignSave',
              '-UserDir='+str(userdir), '-abslog='+str(log), '-ExecCmds='+settings,
              '-csvCaptureFrames=180000', '-csvExecCmds=r30:exec '+str(macro)]
    if rendered:
        result += ['-vulkan','-graphicsadapter=0','-RenderOffscreen', '-ForceRes', '-windowed', '-ResX=1280', '-ResY=720', '-NordCapture']
    else:
        result += ['-nullrhi']
    return result


class Peer:
    def __init__(self, runner, out, name, address, macro_dir, port, rendered=False):
        self.out = out/name
        self.out.mkdir()
        self.log_path, self.macro = self.out/'game.log', macro_dir/(name+'.txt')
        self.write('')
        self.sequence = 0
        self.stdout = (self.out/'stdout.log').open('w')
        self.command = argv(runner, address, self.out/'User', self.log_path, self.macro, port, rendered)
        self.process = subprocess.Popen(self.command, stdout=self.stdout, stderr=subprocess.STDOUT, start_new_session=True)

    def text(self):
        return self.log_path.read_text(errors='replace') if self.log_path.exists() else ''

    def write(self, text):
        part = self.macro.with_suffix('.part')
        part.write_text(text+'\n')
        part.replace(self.macro)

    def wait(self, predicate, timeout=30):
        end = time.monotonic()+timeout
        while time.monotonic() < end:
            text = self.text()
            assert_render_log_clean(text)
            missing_streaming_assets(text)
            assert not BAD_COMMAND.search(text), 'Native packaged console command failed'
            value = predicate(text)
            if value:
                return value
            assert self.process.poll() is None, ('Packaged peer exited early', self.process.returncode)
            time.sleep(.05)
        raise AssertionError('Timed out awaiting '+self.out.name)

    def snapshot(self, commands):
        self.sequence += 1
        marker = 'NORD_DISTRICT_QA_'+str(self.sequence)
        offset = len(self.text())
        self.write(commands+'\nke QuebecController ClientInteractionMessage '+marker)
        needle = "Called 'ClientInteractionMessage "+marker+"'"
        try:
            batch = self.wait(lambda text: text[offset:].split(needle, 1)[0] if needle in text[offset:] else None)
            return batch
        finally:
            self.write('')

    def until(self, commands, predicate, timeout=30):
        end = time.monotonic()+timeout
        while time.monotonic() < end:
            text = self.snapshot(commands)
            result = predicate(text)
            if result:
                return result
        raise AssertionError('Timed out observing '+self.out.name)

    def stop(self, clean=True):
        required_clean, graceful_timeout = clean, False
        if self.process.poll() is None and clean:
            self.write('quit')
            try:
                self.process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                graceful_timeout = True
        if self.process.poll() is None:
            os.killpg(self.process.pid, signal.SIGTERM)
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(self.process.pid, signal.SIGKILL)
                self.process.wait(timeout=5)
        self.stdout.close()
        assert_render_log_clean(self.text())
        if required_clean:
            assert not graceful_timeout, 'Packaged peer did not quit cleanly before its deadline: '+self.out.name
            assert self.process.returncode == 0, (self.out.name, self.process.returncode)
        return {'exit_code': self.process.returncode, 'clean_exit_required': required_clean, 'graceful_quit_timed_out': graceful_timeout, 'argv': self.command,
                'log': str(self.log_path), 'log_sha256': sha(self.log_path)}


def selected_crew(text,map_name,walker):
    graph=possessed_graph(text,map_name,walker)
    folder=f"/Game/ParkComic/Crew/Resident{graph['crew_style']}"
    bodies=re.findall(ROW+r'SkeletalMeshComponent\s+'+re.escape(graph['mesh_component'])+r'\.SkinnedAsset\s*=\s*'
                      r"(?:/Script/Engine\.)?SkeletalMesh'([^']+)'\s*$",text)
    assert bodies == [folder+'/SK_Body.SK_Body'], ('Current possessed mesh does not match its selected style',bodies,graph)
    clips=re.findall(ROW+rf'AnimSequence\s+({re.escape(folder)}/A_(Idle|Walk|Run|Jump)\.A_\2)\.Skeleton\s*=\s*'
                     rf"(?:/Script/Engine\.)?Skeleton'{re.escape(folder)}/SK_Body_Skeleton\.SK_Body_Skeleton'\s*$",text)
    assert len(clips)==4 and {kind for path,kind in clips}=={'Idle','Walk','Run','Jump'}, ('Selected body lacks four actual own-rig clips',graph['crew_style'],clips)
    return {**graph,'body_asset':bodies[0],'own_clip_assets':sorted(path for path,kind in clips)}


def cycle(peer,district):
    map_name=DISTRICTS[district][0]
    commands=GRAPH_COMMANDS+'\ngetall SkeletalMeshComponent SkinnedAsset\ngetall AnimSequence Skeleton'
    initial=peer.snapshot(commands);walker=local_walker(initial,map_name)
    previous=selected_crew(initial,map_name,walker)['crew_style'];start=previous
    selections=[]
    for index in range(8):
        batch=peer.snapshot('ke QuebecController NextCharacter\n'+commands)
        calls=re.findall(r"Called 'NextCharacter' on (\d+) instance\(s\) of class '/Script/Quebec.QuebecController' \((\d+) succeeded\)",batch)
        assert calls == [('1','1')], ('One successful native selection is required per observation',index,calls)
        assert local_walker(batch,map_name)==walker, 'Crew selection replaced the possessed walker'
        selection=selected_crew(batch,map_name,walker)
        expected=3+(previous-3+1)%8
        assert selection['crew_style']==expected, ('Native crew selection did not advance',index,previous,selection['crew_style'])
        selections.append({'step':index+1,**selection});previous=selection['crew_style']
    assert previous==start and {row['crew_style'] for row in selections}==set(range(3,11)), 'Native cycle did not visit all eight styles and restore its starting style'
    proof={'selections':selections,'body_assets':sorted({row['body_asset'] for row in selections}),
           'clip_assets':sorted({path for row in selections for path in row['own_clip_assets']}),
           'scope':'Eight separate native selections, each with its currently possessed body, own four clips and active mesh-bound graph. World/population inventory is a separate fresh final snapshot.'}
    # Never combine temporal world inventories: duplicate actors or Toronto contamination must still fail.
    return peer.snapshot(INVENTORY_COMMANDS),proof


def run_district(args, district, runner, output, macros, peers):
    map_name, source = DISTRICTS[district]
    layout = json.loads((ROOT/source).read_text())
    result = {'map': '/Game/Maps/'+map_name, 'layout': source, 'layout_sha256': sha(ROOT/source),
              'source_spawn_cm': layout['spawn'], 'source_starter_cm': layout['car'], 'source_starter_yaw': layout['car_yaw']}
    solo = Peer(runner, output, district+'-standalone', result['map'], macros, args.port, args.rendered_startup)
    peers.append(solo)
    solo.wait(lambda text: 'Bringing World' in text and map_name in text)
    if args.rendered_startup:
        # Start the query batch after the last ordered startup command; setter echoes are not query results.
        solo.wait(lambda text:'CSVEvent "Cmd: t.MaxFPS 60"' in text,timeout=8)
        result['renderer_settings_before_cycle']=solo.until(QUALITY_COMMANDS,lambda text:rendered_quality(text,allow_startup=True),timeout=8)
    inventory,crew_cycle=cycle(solo,district)
    result['standalone_crew_cycle']=crew_cycle
    result['standalone_inventory'] = verify_inventory(inventory, district, crew_evidence=crew_cycle)
    solo_identity=player_identity(solo.snapshot(IDENTITY_COMMANDS),map_name)
    result['standalone_graph']=graph_proof(solo,map_name,solo_identity['pawn'],args.rendered_startup)
    if args.rendered_startup:
        result['renderer_settings_after_cycle']=solo.until(QUALITY_COMMANDS,lambda text:rendered_quality(text,allow_startup=True),timeout=8)
        solo.process.wait(timeout=90)
        assert solo.process.returncode == 0
        paths = sorted((solo.out/'User').rglob('Nord*.png'))
        import struct
        assert {p.stem for p in paths} == set(SHOTS), ('Seven native screenshots missing', paths)
        assert all(p.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', p.read_bytes()[16:24]) == (1280, 720) for p in paths)
        result['screenshots'] = {str(p): sha(p) for p in paths}
    result['standalone'] = solo.stop()
    host = Peer(runner, output, district+'-host', result['map']+'?listen', macros, args.port)
    peers.append(host)
    host.wait(lambda text: 'listening on port '+str(args.port) in text)
    inventory,crew_cycle=cycle(host,district)
    result['host_crew_cycle']=crew_cycle
    result['host_inventory'] = verify_inventory(inventory, district, crew_evidence=crew_cycle)
    before = hull_transforms(host.snapshot(TRANSFORMS), map_name)
    car, selection = validate_starter(district, layout, before, host.snapshot('getall QuebecCar Tags'), host.text())
    position, yaw = before[car]
    result['starter_readback'] = {'actor': car, 'component': 'VehicleHull', 'position_cm': position, 'yaw_degrees': yaw,
                                  'source_offset_cm': math.dist(position[:2], layout['car'][:2]), 'teleported_car': False, **selection}
    client = Peer(runner, output, district+'-client', '127.0.0.1:'+str(args.port), macros, args.port)
    peers.append(client)
    client.wait(lambda text: 'Welcomed by server' in text)
    host.wait(lambda text: 'Join succeeded' in text)
    client.until('getall QuebecGameState MissionIndex\ngetall QuebecCampaign CompletedMissions\ngetall QuebecController Pawn',
        lambda text: controller_pawn(text, map_name) and len(actor_values(text, map_name, 'QuebecGameState', 'MissionIndex')) == 1 and
        (district == 'toronto' or len(actor_values(text, map_name, 'QuebecCampaign', 'CompletedMissions')) == 1))
    result['client_state'] = verify_inventory(client.snapshot(INVENTORY_COMMANDS), district, dependencies=False, authoritative=False)
    client_identity=player_identity(client.snapshot(IDENTITY_COMMANDS),map_name)
    host_identity=player_identity(host.snapshot(IDENTITY_COMMANDS),map_name,remote=True)
    assert client_identity['player_id']==host_identity['player_id'], ('Cross-process player IDs differ',client_identity,host_identity)
    walker=client_identity['pawn'];authority_walker=host_identity['pawn']
    assert walker.startswith('QuebecCharacter_') and authority_walker.startswith('QuebecCharacter_')
    result['paired_player_identity']={'client':client_identity,'authority_remote':host_identity}
    host_local=player_identity(host.snapshot(IDENTITY_COMMANDS),map_name)
    result['joined_native_graphs']={'host_local':graph_proof(host,map_name,host_local['pawn']),
                                  'host_remote':graph_proof(host,map_name,authority_walker),
                                  'client_local':graph_proof(client,map_name,walker)}
    client_hulls=hull_transforms(client.snapshot(TRANSFORMS),map_name)
    client_traffic={path.rsplit('.',1)[-1]:value for path,value in actor_values(client.snapshot('getall QuebecCar bTraffic'),map_name,'QuebecCar','bTraffic').items()}
    client_car=match_client_car(client_hulls,client_traffic,position,yaw)
    result['replicated_starter']={'host_actor':car,'client_actor':client_car,'client_pose':client_hulls[client_car], 'identity':'unique nontraffic authority pose match, then replicated occupant and local possession'}
    cars = hull_transforms(host.snapshot(TRANSFORMS), map_name)
    angle = math.radians(yaw)
    # Choose an actual clear side of the starter without moving another player or car.
    target = None
    for lateral in (185, -185, 240, -240):
        candidate = (position[0]-math.sin(angle)*lateral, position[1]+math.cos(angle)*lateral, position[2]+20)
        if all(name == car or math.dist(candidate[:2], point[:2]) > abs(lateral)+100 for name, (point, _) in cars.items()):
            target = candidate
            break
    assert target, 'No clear side of the actual starter'
    result['entry_fixture'] = {'authority_teleported_remote_walker_only': authority_walker, 'target_cm': target, 'native_interact': True}
    command = 'ke '+authority_walker+' K2_SetActorLocation "(X=%s,Y=%s,Z=%s)" false () true' % target
    host.snapshot(command)
    client.snapshot('ke QuebecController Interact')
    host.until('getall QuebecCar Occupant', lambda text: occupant(text, car) not in (None, 'None'))
    client.until('getall QuebecCar Occupant', lambda text: occupant(text, client_car) not in (None, 'None'))
    client.until('getall QuebecController Pawn', lambda text: controller_pawn(text, map_name) == client_car)
    client.snapshot('ke '+client_car+' DisableInput None\nke '+client_car+' ReleaseHandbrake\nke '+client_car+' MoveForward 1.0')
    driving = host.until('getall QuebecCar Speed\n'+TRANSFORMS,
        lambda text: {'speed_cm_s': scalar(text, car, 'Speed'), 'position_cm': hull_transforms(text, map_name)[car][0]}
        if scalar(text, car, 'Speed') is not None and scalar(text, car, 'Speed') > 100 else None, timeout=12)
    assert math.dist(driving['position_cm'][:2], position[:2]) > 10, 'Speed changed without actual hull movement'
    result['native_drive'] = driving
    client.snapshot('ke '+client_car+' ApplyHandbrake')
    braked = host.until('getall QuebecCar Speed\ngetall QuebecCar bHandbrake\n'+TRANSFORMS,
        lambda text: hull_transforms(text, map_name)[car][0] if scalar(text, car, 'Speed') == 0 and
        '.'+car+'.bHandbrake = True' in text else None, timeout=12)
    time.sleep(.5)
    held = hull_transforms(host.snapshot(TRANSFORMS), map_name)[car][0]
    assert math.dist(braked, held) < 2, 'Native handbrake failed to hold actual hull'
    result['native_brake'] = {'stopped_cm': braked, 'held_cm': held, 'hold_seconds': .5}
    client.snapshot('ke QuebecController Interact')
    host.until('getall QuebecCar Occupant', lambda text: occupant(text, car) == 'None')
    client.until('getall QuebecController Pawn', lambda text: controller_pawn(text, map_name) == walker)
    result['client_final_state'] = verify_inventory(client.snapshot(INVENTORY_COMMANDS), district, dependencies=False, authoritative=False)
    result['client'] = client.stop()
    host.until('getall QuebecController Pawn', lambda text: len(re.findall(ROW+'QuebecController ', text)) == 1)
    result['host_final_state'] = verify_inventory(host.snapshot(INVENTORY_COMMANDS), district, dependencies=False)
    result['host'] = host.stop()
    assert not list(output.rglob('*.sav')), 'Package QA wrote a campaign save despite its explicit sandbox/save guard'
    result['checks'] = ['standalone exact district and original crew/clips load', 'separate listen/client join',
                        'current VehicleHull source fixture readback', 'authority-only remote walker arrangement',
                        'native client enter/drive/brake/exit replication', 'mesh-bound own production graph/clip selection per process', 'clean peer departure',
                        'district-correct progression and population isolation', 'clean logs/exits and isolated save paths']
    result['passed'] = True
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runner', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--district', choices=(*DISTRICTS, 'both'), default='both')
    parser.add_argument('--port', type=int, default=7795)
    parser.add_argument('--rendered-startup', action='store_true')
    args = parser.parse_args()
    assert 1024 <= args.port <= 65535
    runner, output = validate_paths(args.runner, args.output)
    output.mkdir(parents=True)
    report = {'passed': False, 'package': 'Linux Development', 'runner': str(runner), 'runner_sha256': sha(runner),
              'default_player_route': True, 'rendered_startup': args.rendered_startup, 'districts': {},
              'limits': ['Loopback native console handlers; no physical input, internet or continuous video acceptance.',
                         'No packaged frame-rate target, long soak, full campaign or save persistence claim.',
                         'Mesh inventory proves loaded assets; fresh editor collision/visual audits remain separate.'], 'peers': []}
    package_before = {str(p.relative_to(runner.parent)): sha(p) for p in runner.parent.rglob('*') if p.is_file()}
    report['package_files_sha256_before'] = package_before
    report['fixture_source_sha256'] = {str(p.relative_to(ROOT)): sha(p) for p in
        [Path(__file__), ROOT/'Scripts/package_inventory.py', ROOT/'Scripts/render_log_guard.py',
         ROOT/'Data/Plateau/EastExtension/extension.json', ROOT/'Data/CollegeBathurst/SneakyDees/facade.json']}
    peers, started = [], time.monotonic()
    try:
        report['cooked_production_graphs']=verify_cooked_graphs(runner)
        with tempfile.TemporaryDirectory(prefix='nord-district-Binaries-') as directory:
            macros = Path(directory)
            for district in DISTRICTS if args.district == 'both' else (args.district,):
                report['districts'][district] = run_district(args, district, runner, output, macros, peers)
            report['passed'] = True
    except Exception as error:
        report['error'] = type(error).__name__+': '+str(error)
        raise
    finally:
        for peer in peers:
            if peer.process.poll() is None:
                try:
                    peer.stop(clean=False)
                except Exception as error:
                    report.setdefault('cleanup_errors', []).append(str(error))
            try:
                warnings = missing_streaming_assets(peer.text())
            except AssertionError as error:
                warnings = {'unexpected_missing_package_error': str(error)}
                report['passed'] = False
                report.setdefault('error', 'Unexpected streaming warning: '+str(error))
            report['peers'].append({'streaming_warnings': warnings, 'name': peer.out.name, 'argv': peer.command, 'exit_code': peer.process.poll(),
                                    'log': str(peer.log_path), 'log_sha256': sha(peer.log_path) if peer.log_path.exists() else None})
        package_after = {str(p.relative_to(runner.parent)): sha(p) for p in runner.parent.rglob('*') if p.is_file()}
        report['package_files_sha256_after'] = package_after
        report['archive_preserved'] = package_after == package_before
        if not report['archive_preserved']:
            report['passed'] = False
            report.setdefault('error', 'Package files changed despite external per-peer UserDir')
        report['elapsed_seconds'] = round(time.monotonic()-started, 3)
        (output/'report.json').write_text(json.dumps(report, indent=2)+'\n')
        print('NORD_DISTRICT_PACKAGE', json.dumps(report))
        assert report['archive_preserved'], 'Package archive changed; inspect retained evidence'


if __name__ == '__main__':
    main()
