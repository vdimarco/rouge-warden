"""CPU-only adversarial parser/path/transport checks; never launches Unreal."""
import json
import re
from pathlib import Path
import tempfile
import subprocess
from types import SimpleNamespace
from unittest.mock import patch

import verify_district_package as qa


def reject(call, message):
    try:
        call()
    except AssertionError:
        return
    raise AssertionError('Accepted '+message)


def actor(map_name, cls, name, prop, value):
    return f"0) {cls} /Game/Maps/{map_name}.{map_name}:PersistentLevel.{name}.{prop} = {value}"


def meshes(map_name, folder, names):
    return [actor(map_name, 'StaticMeshComponent', 'StaticMeshActor_'+str(i)+'.StaticMeshComponent', 'StaticMesh',
                  f"/Script/Engine.StaticMesh'{folder}/SM_{name}.SM_{name}'") for i, name in enumerate(names)]


def state(district, *, client=False):
    name = qa.DISTRICTS[district][0]
    rows = [actor(name, 'QuebecGameState', 'QuebecGameState_0', 'MissionIndex', '0')]
    if district == 'montreal':
        rows += [actor(name, 'QuebecCampaign', 'QuebecCampaign_0', 'CompletedMissions', '0')]
        rows += [actor(name, 'QuebecParkResident', 'QuebecParkResident_'+str(i), 'Style', str(i % 11)) for i in range(20 if client else 110)]
        rows += [actor(name, 'QuebecCar', 'QuebecCar_'+str(i), 'bTraffic', str(i > 0)) for i in range(4 if client else 17)]
    else:
        rows += [actor(name, 'QuebecCar', 'QuebecCar_0', 'bTraffic', 'False')]
    return rows


def crew():
    return [f"/Game/ParkComic/Crew/Resident{i}/SK_Body.SK_Body" for i in range(3, 11)] + [
        f"/Game/ParkComic/Crew/Resident{i}/A_{clip}.A_{clip}" for i in range(3, 11) for clip in ('Idle', 'Walk', 'Run', 'Jump')]


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    data = root/'Data/CollegeBathurst'
    (data/'Geometry').mkdir(parents=True)
    (data/'SneakyDees').mkdir()
    names = {'Brick','Cream','Glass','Grass','Ground','Landmark','Marking','Path','Road','Roof','Sage','Tram'}
    facade = {'Blue','Brick','Cladding','Glazing','Gold','Ink','Red','Stone'}
    for name in names:
        (data/'Geometry'/(name+'.obj')).write_text('v 0 0 0\n')
    (data/'SneakyDees/facade.json').write_text(json.dumps({'new_collision': False, 'materials': {name:{} for name in facade}}))
    geometry = meshes('CollegeBathurst', '/Game/CollegeBathurst', sorted(names))
    detail = meshes('CollegeBathurst', '/Game/CollegeBathurst/SneakyDees', sorted(facade))
    base = state('toronto')+crew()
    good = '\n'.join(base+geometry+detail)
    result = qa.verify_inventory(good, 'toronto', root)
    assert result['district_meshes'] == 12 and result['sneaky_dees_meshes'] == 8 and result['campaigns'] == 0
    for row in geometry+detail:
        for bad in (good.replace(row, ''), good.replace(row, 'LogLinker: Warning: '+row),
                    good.replace(row, row.replace('CollegeBathurst.CollegeBathurst:', 'Other.Other:')),
                    good+'\n'+row, good+'\n'+row.replace('StaticMeshActor_', 'DuplicateActor_')):
            reject(lambda bad=bad: qa.verify_inventory(bad, 'toronto', root), 'missing/duplicate/warning/wrong-map Toronto geometry')
    for contamination in (actor('CollegeBathurst','QuebecCampaign','QuebecCampaign_0','CompletedMissions','0'),
                          actor('CollegeBathurst','QuebecParkResident','QuebecParkResident_0','Style','9'),
                          actor('CollegeBathurst','QuebecPedestrian','QuebecPedestrian_0','WalkSpeed','90'),
                          actor('CollegeBathurst','QuebecCar','QuebecCar_1','bTraffic','False')):
        reject(lambda contamination=contamination: qa.verify_inventory(good+'\n'+contamination, 'toronto', root), 'borrowed Toronto population')
    reject(lambda: qa.verify_inventory(good.replace('MissionIndex = 0', 'MissionIndex = 1'), 'toronto', root), 'Toronto mission contamination')
    reject(lambda: qa.verify_inventory(good.replace('bTraffic = False', 'bTraffic = True'), 'toronto', root), 'Toronto traffic')
    reject(lambda: qa.verify_inventory(good.replace('/A_Jump.', '/A_Missing.'), 'toronto', root), 'missing original cooked jump')

    extension = root/'Data/Plateau/EastExtension/extension.json'
    extension.parent.mkdir(parents=True)
    ext_names = ['Closure_'+str(i) for i in range(40)]
    extension.write_text(json.dumps({'road_segments':143,'materials':dict.fromkeys(ext_names,{})}))
    ext_rows = meshes('LaFontaine', '/Game/Plateau/EastExtension', ext_names)
    part_rows = [f'SM_Resident{i}{part}' for i in range(11) for part in ('Body','Head','LeftArm','RightArm','LeftLeg','RightLeg')]
    montreal = '\n'.join(state('montreal')+crew()+part_rows+ext_rows)
    # Existing strict Plateau parser is reused, not replaced or relaxed by this fixture.
    with patch.object(qa, 'verify_plateau_inventory', return_value={'old_guard':'called'}) as legacy:
        result = qa.verify_inventory(montreal, 'montreal', root)
        assert result['east_extension_meshes'] == 40 and result['plateau'] == {'old_guard':'called'}
        assert 'east_details_meshes' not in result, 'No-Details source baseline changed'
        legacy.assert_called_once_with(montreal, root)
        for bad in (montreal.replace(ext_rows[0], ''), montreal+'\n'+ext_rows[0],
                    montreal.replace(ext_rows[0], 'Warning: '+ext_rows[0]),
                    montreal.replace(ext_rows[0], ext_rows[0].replace('LaFontaine.LaFontaine:', 'CollegeBathurst.CollegeBathurst:'))):
            reject(lambda bad=bad: qa.verify_inventory(bad, 'montreal', root), 'bad east extension live inventory')
        details_path = root/'Data/Plateau/EastDetails/details.json'
        details_path.parent.mkdir()
        detail_names = ('Glass','Iron','Trim')
        packages = [f'Content/Plateau/EastDetails/SM_{name}.uasset' for name in detail_names]
        details_path.write_text(json.dumps({'native_contract':{'new_packages':packages}}))
        detail_rows = meshes('LaFontaine','/Game/Plateau/EastDetails',detail_names)
        with_details = montreal+'\n'+'\n'.join(detail_rows)
        assert qa.verify_inventory(with_details,'montreal',root)['east_details_meshes'] == 3
        for row in detail_rows:
            for bad in (with_details.replace(row,''), with_details+'\n'+row,
                        with_details+'\n'+row.replace('StaticMeshActor_','DuplicateActor_'),
                        with_details.replace(row,'LogLinker: Warning: '+row),
                        with_details.replace(row,row.replace('LaFontaine.LaFontaine:','CollegeBathurst.CollegeBathurst:'))):
                reject(lambda bad=bad:qa.verify_inventory(bad,'montreal',root),'missing/duplicate/warning/wrong-map East Details mesh')
        extra = meshes('LaFontaine','/Game/Plateau/EastDetails',['Unexpected'])[0].replace('StaticMeshActor_','UnexpectedActor_')
        reject(lambda:qa.verify_inventory(with_details+'\n'+extra,'montreal',root),'extra East Details mesh')
        for bad_packages in (packages[:-1], [packages[0],packages[0],packages[2]],
                             [packages[0].replace('/EastDetails/','/Other/'),*packages[1:]], packages+['Content/Plateau/EastDetails/SM_Unexpected.uasset']):
            details_path.write_text(json.dumps({'native_contract':{'new_packages':bad_packages}}))
            reject(lambda:qa.verify_inventory(with_details,'montreal',root),'changed East Details source contract')
        details_path.write_text(json.dumps({'native_contract':{'new_packages':packages}}))
        assert 'east_details_meshes' not in qa.verify_inventory(good,'toronto',root)
    partial = '\n'.join(state('montreal', client=True))
    qa.verify_inventory(partial, 'montreal', root, dependencies=False, authoritative=False)
    reject(lambda: qa.verify_inventory(partial, 'montreal', root, dependencies=False), 'partial authority population')

    transform = '\n'.join([actor('CollegeBathurst','StaticMeshComponent','QuebecCar_0.VehicleHull','RelativeLocation','(X=10.25,Y=-20,Z=100)'),
                            actor('CollegeBathurst','StaticMeshComponent','QuebecCar_0.VehicleHull','RelativeRotation','(Pitch=0,Yaw=15.322,Roll=0)')])
    assert qa.hull_transforms(transform, 'CollegeBathurst') == {'QuebecCar_0': ((10.25,-20.,100.),15.322)}
    reject(lambda: qa.hull_transforms(transform.replace('VehicleHull','Collision'), 'CollegeBathurst'), 'deprecated car box transforms')
    reject(lambda: qa.hull_transforms(transform.replace('CollegeBathurst.CollegeBathurst:', 'LaFontaine.LaFontaine:'), 'CollegeBathurst'), 'wrong-map hull')
    # Acceleration crosses 100 cm/s before the hull necessarily travels 10 cm.
    # Keep polling the same bounded observation until both requirements hold.
    drive_start = (2770.615, 354.556, 102.934575)
    def drive_rows(speed, point):
        rows = [actor('CollegeBathurst','StaticMeshComponent','QuebecCar_0.VehicleHull','RelativeLocation',
                      '(X=%s,Y=%s,Z=%s)' % point),
                actor('CollegeBathurst','StaticMeshComponent','QuebecCar_0.VehicleHull','RelativeRotation',
                      '(Pitch=0,Yaw=15.322,Roll=0)')]
        if speed is not None:
            rows.append(actor('CollegeBathurst','QuebecCar','QuebecCar_0','Speed',str(speed)))
        return '\n'.join(rows)
    early = (2778.183121, 356.629527, 102.934575)
    later = (2790.615, 354.556, 102.934575)
    assert qa.driving_sample(drive_rows(123.519, early), 'CollegeBathurst', 'QuebecCar_0', drive_start) is None
    assert qa.driving_sample(drive_rows(150, later), 'CollegeBathurst', 'QuebecCar_0', drive_start) == {
        'speed_cm_s': 150., 'position_cm': later}
    assert qa.driving_sample(drive_rows(0, later), 'CollegeBathurst', 'QuebecCar_0', drive_start) is None
    assert qa.driving_sample(drive_rows(150, drive_start), 'CollegeBathurst', 'QuebecCar_0', drive_start) is None
    assert qa.driving_sample(drive_rows(None, later), 'CollegeBathurst', 'QuebecCar_0', drive_start) is None
    pawn = actor('CollegeBathurst','QuebecController','QuebecController_0','Pawn', "QuebecCharacter'/Game/Maps/CollegeBathurst.CollegeBathurst:PersistentLevel.QuebecCharacter_1'")
    assert qa.local_walker(pawn,'CollegeBathurst') == 'QuebecCharacter_1'
    assert qa.controller_pawn(pawn.replace('QuebecCharacter_1','QuebecCar_0').replace("QuebecCharacter'", "QuebecCar'"),'CollegeBathurst') == 'QuebecCar_0'
    assert qa.controller_pawn('', 'CollegeBathurst') is None

    runner = root/'Builds/Fresh/Archive/Linux/Quebec.sh'
    runner.parent.mkdir(parents=True)
    runner.write_text('#!/bin/sh\n')
    out = root/'Saved/Tests/Fresh'
    assert qa.validate_paths(runner,out,root) == (runner,out)
    out.mkdir(parents=True)
    reject(lambda: qa.validate_paths(runner,out,root), 'existing output')
    reject(lambda: qa.validate_paths(runner,root/'Verification/Package',root), 'tracked output')
    live = root/'Builds/Linux/Quebec.sh'
    live.parent.mkdir(parents=True)
    live.write_text('preserve')
    reject(lambda: qa.validate_paths(live,root/'Saved/Tests/Other',root), 'legacy package as isolated archive')
    outside = root.parent/'Outside/Quebec.sh'
    reject(lambda: qa.validate_paths(outside,root/'Saved/Tests/Other',root), 'external/live runner')
    command = qa.argv(runner,'/Game/Maps/CollegeBathurst?listen',out/'User',out/'game.log',root/'Binaries/macro.txt',7795)
    assert '-NordNoCampaignSave' in command and '-NordNoCampaign' not in command
    assert '-UserDir='+str(out/'User') in command and '-nullrhi' in command
    assert not any('GraphicNovel' in item for item in command), 'Package QA silently promotes a pilot'
    rendered = qa.argv(runner,'/Game/Maps/LaFontaine',out/'User',out/'game.log',root/'Binaries/macro.txt',7795,True)
    assert '-NordCapture' in rendered and '-nullrhi' not in rendered
    assert '-vulkan' in rendered and '-graphicsadapter=0' in rendered
    assert '-ExecCmds=Scalability 3,r.ScreenPercentage 100,t.MaxFPS 60' in rendered
    assert '-ExecCmds=t.MaxFPS 60' in command and '-vulkan' not in command, 'Headless route changed quality/renderer'

    # The observation barrier follows all dumped rows. It isolates one iteration
    # even when repeated CSV macros produce another complete batch immediately.
    peer = object.__new__(qa.Peer)
    peer.sequence = 0
    peer.text = lambda: 'prior\n'
    writes = []
    peer.write = writes.append
    peer.wait = lambda predicate: predicate("prior\nnew rows\nCalled 'ClientInteractionMessage NORD_DISTRICT_QA_1'\nother iteration")
    assert peer.snapshot('getall QuebecCar Speed') == 'new rows\n'
    assert writes == ['getall QuebecCar Speed\nke QuebecController ClientInteractionMessage NORD_DISTRICT_QA_1', '']
    peer.wait = lambda predicate: (_ for _ in ()).throw(AssertionError('failed observation'))
    reject(lambda: peer.snapshot('probe'), 'failed observation')
    assert writes[-1] == '', 'Failed observation left a repeating command active'

# Cleanup may force-kill an owned process, but that must never satisfy a
# requested graceful-exit proof. No process or signal is sent by this test.
with tempfile.TemporaryDirectory() as directory:
    peer = object.__new__(qa.Peer)
    peer.out = Path(directory)
    peer.log_path = peer.out/'log'
    peer.log_path.write_text('clean test log')
    peer.text = lambda: 'clean test log'
    peer.write = lambda text: None
    peer.command = ['fake']
    peer.stdout = SimpleNamespace(close=lambda: None)
    class Process:
        pid = 123456789
        returncode = None
        def poll(self):
            return self.returncode
        def wait(self, timeout):
            if timeout == 12:
                raise subprocess.TimeoutExpired('fake', timeout)
            self.returncode = -15
            return self.returncode
    peer.process = Process()
    with patch.object(qa.os, 'killpg') as signal_owned:
        reject(lambda: peer.stop(clean=True), 'forced termination as a clean package exit')
        signal_owned.assert_called_once_with(peer.process.pid, qa.signal.SIGTERM)
    peer.process = Process()
    with patch.object(qa.os, 'killpg'):
        result = peer.stop(clean=False)
        assert result['exit_code'] == -15 and result['clean_exit_required'] is False

# Current native Montréal population relocates its tagged starter to a sampled
# curb; nearest-to-old-spawn selection and the historical145cm lane assumption
# are invalid. Validate the exact runtime search geometry, not a wider radius.
layout = json.loads((qa.ROOT/'Data/LaFontaine/layout.json').read_text())
transforms = {'QuebecCar_0':((38569.679242,-7473.428568,107.5),-102.469199),
              'QuebecCar_1':(tuple(layout['car']),layout['car_yaw'])}
tags = "0) QuebecCar /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecCar_0.Tags =\n 0: StarterCar\n"
car, evidence = qa.validate_starter('montreal',layout,transforms,tags,'NORD_POPULATION starter_curb_offset_cm=920')
assert car == 'QuebecCar_0' and evidence['source_road_index'] == 63 and evidence['native_along_offset_cm'] == 0
for bad_tags in ('',tags.replace('StarterCar','CampaignLoan'),tags+tags.replace('QuebecCar_0','QuebecCar_1')):
    reject(lambda bad_tags=bad_tags: qa.validate_starter('montreal',layout,transforms,bad_tags,'NORD_POPULATION starter_curb_offset_cm=920'), 'ambiguous/unproven starter identity')
for point,yaw,offset in (((38569.679242+5,-7473.428568,107.5),-102.469199,920),
                         ((38569.679242,-7473.428568,107.5),-82.469199,920),
                         ((38569.679242,-7473.428568,107.5),-102.469199,921)):
    corrupt=dict(transforms,QuebecCar_0=(point,yaw))
    reject(lambda: qa.validate_starter('montreal',layout,corrupt,tags,'NORD_POPULATION starter_curb_offset_cm='+str(offset)), 'changed curb formula/heading/log offset')
with tempfile.TemporaryDirectory() as directory:
    root=Path(directory)
    warning='LogStreaming: Warning: LoadPackage: SkipPackage: /Game/ParkComic/Crew/Resident9/BS_Locomotion (0x123) - missing'
    assert len(qa.missing_streaming_assets(warning,root)['missing_packages']) == 1
    reject(lambda: qa.missing_streaming_assets(warning.replace('BS_Locomotion','A_Idle'),root), 'missing required animation')
    asset=root/'Content/ParkComic/Crew/Resident9/BS_Locomotion.uasset';asset.parent.mkdir(parents=True);asset.write_bytes(b'present source')
    reject(lambda: qa.missing_streaming_assets(warning,root), 'cook omitted a present source blendspace')
    empty=qa.missing_streaming_assets('',root)
    assert empty['missing_count']==0 and empty['source_assets_absent'] is None and empty['current_production_sources_present']==1

# Actor names differ across separate processes. Pair PlayerId through the
# host's IpConnection controller, never use a client proxy name on authority.
def identity_rows(pc,pawn,state_id,player_id,player_type):
    prefix='/Game/Maps/CollegeBathurst.CollegeBathurst:PersistentLevel.'
    return [actor('CollegeBathurst','QuebecController',pc,'Player',player_type+"'/Engine/Transient.Player_0'"),
            actor('CollegeBathurst','QuebecController',pc,'Pawn',"QuebecCharacter'"+prefix+pawn+"'"),
            actor('CollegeBathurst','QuebecController',pc,'PlayerState',"PlayerState'"+prefix+state_id+"'"),
            actor('CollegeBathurst','PlayerState',state_id,'PlayerId',str(player_id))]
client_rows=identity_rows('QuebecController_900','QuebecCharacter_901','PlayerState_902',42,'LocalPlayer')
host_rows=identity_rows('QuebecController_500','QuebecCharacter_501','PlayerState_502',41,'LocalPlayer')+identity_rows('QuebecController_600','QuebecCharacter_601','PlayerState_602',42,'IpConnection')
client=qa.player_identity('\n'.join(client_rows),'CollegeBathurst')
host=qa.player_identity('\n'.join(host_rows),'CollegeBathurst',True)
assert client['player_id']==host['player_id']==42 and client['pawn']=='QuebecCharacter_901' and host['pawn']=='QuebecCharacter_601'
reject(lambda:qa.player_identity('\n'.join(host_rows).replace("IpConnection'","LocalPlayer'"),'CollegeBathurst',True),'host connection identity ambiguity')
client_cars={'QuebecCar_901':((10,20,100),15.0),'QuebecCar_902':((1000,20,100),15.0)}
assert qa.match_client_car(client_cars,{'QuebecCar_901':'False','QuebecCar_902':'False'},(10.2,20,100),15.322)=='QuebecCar_901'
reject(lambda:qa.match_client_car(client_cars,{'QuebecCar_901':'True'},(10,20,100),15),'traffic car as starter')
reject(lambda:qa.match_client_car(dict(client_cars,QuebecCar_903=((10,20,100),15)),dict.fromkeys(('QuebecCar_901','QuebecCar_903'),'False'),(10,20,100),15),'ambiguous replicated starter')


# Select only the active mesh-bound instance of each process-local possessed
# walker. Stale instances from native crew cycling cannot satisfy this proof.
def graph_rows(walker='QuebecCharacter_900',style=9,clock=.25):
    prefix='/Game/Maps/CollegeBathurst.CollegeBathurst:PersistentLevel.'
    component=walker+'.CharacterMesh0';instance=component+'.QuebecCrewAnimInstance_950'
    folder=f'/Game/ParkComic/Crew/Resident{style}'
    rows=[actor('CollegeBathurst','QuebecCharacter',walker,'CrewStyle',str(style)),
          actor('CollegeBathurst','SkeletalMeshComponent',component,'AnimScriptInstance',"/Script/Quebec.QuebecCrewAnimInstance'"+prefix+instance+"'"),
          actor('CollegeBathurst','SkeletalMeshComponent',component,'VisibilityBasedAnimTickOption','AlwaysTickPose')]
    for prop,value in [('LocomotionAsset',"/Script/Engine.BlendSpace1D'"+folder+"/BS_Locomotion.BS_Locomotion'"),
                       ('JumpAsset',"/Script/Engine.AnimSequence'"+folder+"/A_Jump.A_Jump'"),
                       ('ObservedClip',"/Script/Engine.AnimSequence'"+folder+"/A_Idle.A_Idle'"),('ObservedClipTime',str(clock))]:
        rows.append(actor('CollegeBathurst','QuebecCrewAnimInstance',instance,prop,value))
    return '\n'.join(rows)
text=graph_rows();parsed=qa.possessed_graph(text,'CollegeBathurst','QuebecCharacter_900',True)
assert parsed['crew_style']==9 and parsed['observed_clip_time']==.25 and parsed['visibility_based_anim_tick_option']=='AlwaysTickPose'
for bad in (text.replace('QuebecCrewAnimInstance\'','AnimSingleNodeInstance\''),
            text.replace('Resident9/BS_Locomotion','Resident8/BS_Locomotion'),
            text.replace('Resident9/A_Jump','Resident8/A_Jump'),
            text.replace('Resident9/A_Idle','Resident8/A_Idle'),
            text.replace('ObservedClipTime = 0.25','ObservedClipTime = nan')):
    reject(lambda bad=bad:qa.possessed_graph(bad,'CollegeBathurst','QuebecCharacter_900',True),'unbound/wrong-rig/stale/invalid production graph')
reject(lambda:qa.possessed_graph(graph_rows('QuebecCharacter_901'),'CollegeBathurst','QuebecCharacter_900'),'other process walker name')
headless=text.replace("/Script/Engine.AnimSequence'/Game/ParkComic/Crew/Resident9/A_Idle.A_Idle'",'None')
assert qa.possessed_graph(headless,'CollegeBathurst','QuebecCharacter_900')['observed_clip'] is None
reject(lambda:qa.possessed_graph(headless,'CollegeBathurst','QuebecCharacter_900',True),'unevaluated rendered animation')
class GraphPeer:
    def snapshot(self,command):
        assert command==qa.GRAPH_COMMANDS
        return graph_rows()
    def until(self,command,predicate,timeout):
        assert command==qa.GRAPH_COMMANDS and timeout==8
        assert predicate(graph_rows()) is None, 'Frozen clock accepted'
        return predicate(graph_rows(clock=.5))
proof=qa.graph_proof(GraphPeer(),'CollegeBathurst','QuebecCharacter_900',True)
assert proof['clock_advanced'] and proof['second']['observed_clip_time']==.5
assert qa.graph_proof(GraphPeer(),'CollegeBathurst','QuebecCharacter_900')['clock_advance_required'] is False

# Toronto has one currently attached body per observation. Eight sequential
# native selections, not eight simultaneous components, prove the full crew.
class CyclePeer:
    def __init__(self,defect=None):self.style=9;self.count=0;self.defect=defect
    def current(self):
        folder=f'/Game/ParkComic/Crew/Resident{self.style}'
        body=actor('CollegeBathurst','SkeletalMeshComponent','QuebecCharacter_900.CharacterMesh0','SkinnedAsset',
                   f"/Script/Engine.SkeletalMesh'{folder}/SK_Body.SK_Body'")
        pawn=actor('CollegeBathurst','QuebecController','QuebecController_0','Pawn',
                   "QuebecCharacter'/Game/Maps/CollegeBathurst.CollegeBathurst:PersistentLevel.QuebecCharacter_900'")
        clips=[actor('CollegeBathurst','AnimSequence',folder+f'/A_{kind}.A_{kind}','Skeleton',
                     f"/Script/Engine.Skeleton'{folder}/SK_Body_Skeleton.SK_Body_Skeleton'") for kind in ('Idle','Walk','Run','Jump')]
        # AnimSequence assets have package paths, not world actor paths.
        clips=[row.replace('/Game/Maps/CollegeBathurst.CollegeBathurst:PersistentLevel.','') for row in clips]
        text='\n'.join([graph_rows(style=self.style),body,pawn,*clips])
        if self.count==3:
            if self.defect=='missing_graph':text=text.replace("QuebecCrewAnimInstance'","AnimSingleNodeInstance'")
            elif self.defect=='wrong_body':text=text.replace(folder+'/SK_Body.SK_Body','/Game/ParkComic/Crew/Resident9/SK_Body.SK_Body')
            elif self.defect=='missing_clip':text=text.replace(clips[-1],'')
        return text
    def snapshot(self,commands):
        if commands.startswith('ke QuebecController NextCharacter\n'):
            self.count+=1
            if not (self.defect=='missing_selection' and self.count==3):self.style=3+(self.style-3+1)%8
            call="Called 'NextCharacter' on 1 instance(s) of class '/Script/Quebec.QuebecController' (1 succeeded)\n"
            return call*(2 if self.defect=='duplicate_call' and self.count==3 else 1)+self.current()
        if commands==qa.INVENTORY_COMMANDS:
            geometry=meshes('CollegeBathurst','/Game/CollegeBathurst',[p.stem for p in (qa.ROOT/'Data/CollegeBathurst/Geometry').glob('*.obj')])
            facade=json.loads((qa.ROOT/'Data/CollegeBathurst/SneakyDees/facade.json').read_text())
            detail=meshes('CollegeBathurst','/Game/CollegeBathurst/SneakyDees',facade['materials'])
            contamination=[actor('CollegeBathurst','QuebecCar','QuebecCar_1','bTraffic','False')] if self.defect=='final_extra_car' else []
            return '\n'.join([*state('toronto'),self.current(),*geometry,*detail,*contamination])
        assert commands.startswith(qa.GRAPH_COMMANDS)
        return self.current()
final,proof=qa.cycle(CyclePeer(),'toronto')
assert len(proof['selections'])==8 and len(proof['body_assets'])==8 and len(proof['clip_assets'])==32
assert len(set(re.findall(r'/Crew/Resident(\d+)/SK_Body\.SK_Body',final)))==1
assert qa.verify_inventory(final,'toronto',crew_evidence=proof)['crew']==8
for defect in ('missing_selection','missing_graph','wrong_body','missing_clip','duplicate_call'):
    reject(lambda defect=defect:qa.cycle(CyclePeer(defect),'toronto'),'incomplete per-selection crew proof: '+defect)
final,proof=qa.cycle(CyclePeer('final_extra_car'),'toronto')
reject(lambda:qa.verify_inventory(final,'toronto',crew_evidence=proof),'temporal crew aggregation hiding current extra car')

quality='\n'.join(f'[2026.10.14-16.00.00:000][ 30]{name} = "{3 if name in qa.SCALABILITY else 100}"      LastSetBy: Console' for name in (*qa.SCALABILITY,'r.ScreenPercentage'))
assert len(qa.rendered_quality(quality))==12
for bad in (quality.replace('sg.ShadowQuality = "3"','sg.ShadowQuality = "2"'),
            quality.replace('r.ScreenPercentage = "100"','r.ScreenPercentage = "75"'),
            quality.replace('sg.LandscapeQuality = "3"','missing = "3"'),
            quality+'\nsg.TextureQuality = "3"',quality.replace('sg.ShadingQuality = "3"','Warning: sg.ShadingQuality = "3"')):
    reject(lambda bad=bad:qa.rendered_quality(bad),'missing/non-Epic/counterfeit rendered quality readback')
with tempfile.TemporaryDirectory() as directory:
    root=Path(directory);runner=root/'Builds/Fresh/Archive/Linux/Quebec.sh'
    runner.parent.mkdir(parents=True);runner.write_text('fake')
    for style in range(3,11):
        path=f'Content/ParkComic/Crew/Resident{style}/BS_Locomotion'
        source=root/(path+'.uasset');source.parent.mkdir(parents=True);source.write_bytes(b'original saved graph')
        cooked=runner.parents[2]/'Cooked/Linux/Quebec'/path;cooked.parent.mkdir(parents=True)
        cooked.with_suffix('.uasset').write_bytes(b'\xc1\x83\x2a\x9e'+b'cooked header')
        cooked.with_suffix('.uexp').write_bytes(b'cooked exports')
    assert qa.verify_cooked_graphs(runner,root)['count']==8
    cooked.with_suffix('.uexp').unlink()
    reject(lambda:qa.verify_cooked_graphs(runner,root),'missing eighth cooked graph payload')

# Frame-zero ScreenPercentage=0 is provisional only during a bounded native query.
startup_quality=quality.replace('r.ScreenPercentage = "100"','r.ScreenPercentage = "0"')
assert startup_quality!=quality and qa.rendered_quality(startup_quality,allow_startup=True) is None
reject(lambda:qa.rendered_quality(startup_quality),'startup zero without bounded polling')
assert qa.rendered_quality(quality,allow_startup=True)['r.ScreenPercentage']==100
poller=qa.Peer.__new__(qa.Peer);poller.out=SimpleNamespace(name='quality-startup')
batches=iter((startup_quality,quality));poller.snapshot=lambda commands:next(batches)
assert poller.until(qa.QUALITY_COMMANDS,lambda text:qa.rendered_quality(text,allow_startup=True),timeout=8)['r.ScreenPercentage']==100
poller.snapshot=lambda commands:startup_quality
with patch.object(qa.time,'monotonic',side_effect=[0,1,2,3]):
    reject(lambda:poller.until(qa.QUALITY_COMMANDS,lambda text:qa.rendered_quality(text,allow_startup=True),timeout=2),'never-applied100 startup quality')

print('NORD_DISTRICT_PACKAGE_CPU_OK: strict district inventories, current hull/pawn parsing, immutable archive paths, isolated argv and bounded macro snapshots')
