"""Focused CPU-only replay/check receipt; writes only this Checks directory.

Does not invoke UE, Blender, services, git or mutate retained evidence/Content.
The historical Blender checker is AST-read for four pure math functions only.
"""
import ast
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
GAME = OUT.parents[2]
REPO = GAME.parents[1]
PLAN = GAME/'Saved/Tests/GraphicNovel/PrivateJumpArmPlan-20261017'
CPU = PLAN/'CPUAuthoring-20261017T142247Z'
NATIVE = OUT.parent/'Native'


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def load(path): return json.loads(Path(path).read_text())
def write(name, data):
    with (OUT/name).open('x') as stream:
        json.dump(data, stream, indent=2, allow_nan=False); stream.write('\n')
def now(): return datetime.now(timezone.utc).isoformat()

def run(name, argv):
    started = now()
    p = subprocess.run(argv, cwd=REPO, text=True, capture_output=True, timeout=60)
    (OUT/(name+'.stdout.log')).write_text(p.stdout)
    (OUT/(name+'.stderr.log')).write_text(p.stderr)
    row = {'argv': argv, 'cwd': str(REPO), 'started_utc': started, 'finished_utc': now(),
           'exit_code': p.returncode, 'stdout': name+'.stdout.log', 'stderr': name+'.stderr.log',
           'stdout_sha256': sha(OUT/(name+'.stdout.log')), 'stderr_sha256': sha(OUT/(name+'.stderr.log'))}
    assert p.returncode == 0, row
    return row

started = now()
pinned = {
    PLAN/'native_trial.py': '81110214ce1c2a14c1348bf44ef0377046651a139fde3a00bcc0959cb7110679',
    PLAN/'test_native_trial.py': 'de645cbbc2c16f677da29d775a287cd5b145b24dda9e009c1b00531a09edb910',
    CPU/'results.json': '15bf5c7fb878fcd2b792482ff24535cd684d718bb79d09ce4e35cc50d8333c8f',
    CPU/'semantic-comparison.json': '5c3616f84bd814d2fae3ec1208131383285cdccb4c70ec53866fe9cef84cf006',
    CPU/'Scripts/verify_jump_ab.py': 'c078c6d5e7ae66f1bf1955eb0f9db60753e2f285c471bfe33c32153b19de16fa',
}
assert all(sha(p) == h for p,h in pinned.items()), 'Frozen checker/evidence changed'
commands = [run('native-negative', [sys.executable, '-B', str(PLAN/'test_native_trial.py')]),
            run('prepare-check', [sys.executable, '-B', str(PLAN/'prepare.py'), '--check'])]

# AST-extract only literal constants and four pure functions. Never import bpy or
# execute the checker's FBX collection, factory-reset or report-writing code.
checker = CPU/'Scripts/verify_jump_ab.py'
tree = ast.parse(checker.read_text())
functions = {'max_error', 'rotation_error', 'require_finite', 'compare'}
kept = [node for node in tree.body if
        isinstance(node, ast.FunctionDef) and node.name in functions or
        isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in {'ARMS','TOL'} for t in node.targets)]
assert {n.name for n in kept if isinstance(n,ast.FunctionDef)} == functions
assert all(isinstance(node,ast.FunctionDef) or ast.literal_eval(node.value) is not None for node in kept)
ns = {'math': math}
exec(compile(ast.Module(body=kept,type_ignores=[]),str(checker)+':pure-math-only','exec'),ns)
semantic = load(CPU/'semantic-comparison.json')
assert semantic['passed'] and semantic['all_inputs_unchanged'] and semantic['inputs_before'] == semantic['inputs_after']
assert semantic['tolerances'] == ns['TOL']
for clip in semantic['clips'].values():
    ns['require_finite'](clip)
    assert len(clip['bones']) == 24 and len(clip['samples']) == 37
    assert clip['fps'] == 30 and clip['frame_range'] == [2.,38.]
    assert clip['sample_frames'] == list(range(2,39))
    assert clip['max_object_animation_error'] <= ns['TOL']['object_matrix_abs']
    assert clip['hips_motion']['max_perpendicular_m'] <= ns['TOL']['hips_perpendicular_world_m']
    assert clip['hips_motion']['endpoint_return_m'] <= ns['TOL']['hips_perpendicular_world_m']
    assert -ns['TOL']['hips_axial_world_m'] <= clip['hips_motion']['axial_range_m'][0]
    assert clip['hips_motion']['axial_range_m'][1] <= ns['TOL']['hips_perpendicular_world_m']
    for sample in (clip['samples'][0],clip['samples'][-1]):
        for trs in sample['bones'].values():
            assert ns['max_error'](trs['translation'],[0.,0.,0.]) <= ns['TOL']['local_translation_abs']
            assert ns['max_error'](trs['scale'],[1.,1.,1.]) <= ns['TOL']['local_scale_abs']
            assert ns['rotation_error'](trs['rotation_wxyz'],[1.,0.,0.,0.]) <= ns['TOL']['local_rotation_radians']
replay = {'retained_vs_control': ns['compare'](semantic['clips']['retained'], semantic['clips']['control']),
          'control_vs_trial': ns['compare'](semantic['clips']['control'],semantic['clips']['trial'],ns['ARMS'])}
assert all(replay[k] == semantic[k] for k in replay), 'Recorded CPU comparison differs from pure replay'
write('RecordedSemanticReplay.json', {'passed':True,'scope':'Replay of previously recorded CPU transform arrays; no fresh FBX/Blender import',
      'sample_frames_per_clip':37,'deformation_bones':24,'comparison':replay,
      'neutral_endpoints_rechecked':True,'object_and_hips_recorded_bounds_rechecked':True,
      'checker_sha256':sha(checker),'semantic_receipt_sha256':sha(CPU/'semantic-comparison.json'),
      'full_blender_checker_executed':False,'graphics_accepted':False,'adopted':False})

# Recheck bounded raw/source pins with the frozen helper's read-only CPU gate.
# This reads the 23 retained source files and small receipts, never full Content.
spec = importlib.util.spec_from_file_location('private_jump_cpu_audit', PLAN/'native_trial.py')
n = importlib.util.module_from_spec(spec); spec.loader.exec_module(n)
names, source_pins = n.cpu_gate(GAME)
trial, original, fresh, scope = (load(NATIVE/f) for f in ('trial-receipt.json','original-native.json','fresh-verify.json','Scope.json'))
assert trial['passed'] and fresh['passed'] and source_pins == trial['source_pins']
assert fresh['trial_receipt_sha256'] == sha(NATIVE/'trial-receipt.json')
assert fresh['metadata'] == trial['trial_metadata']
assert trial['baseline_metadata'] == original['metadata']
for key in ('asset','class','skeleton','seconds','frames','keys','sample_rate','flags'):
    assert original['metadata'][key] == trial['trial_metadata'][key]
assert original['metadata']['source_sha256'] == n.RAW_JUMP_SHA
assert trial['trial_metadata']['source_sha256'] == n.TRIAL_SHA
assert list(trial['changed_content_sha256']) == [n.TARGET] and trial['original_content_count'] == 6850
assert scope['native_pose_gate'] == trial['native_pose_gate'] == fresh['native_pose_gate']

# Independent quaternion-distance math against saved actual native local poses.
def rotation(a,b):
    a=[x/math.sqrt(sum(v*v for v in a)) for x in a]
    b=[x/math.sqrt(sum(v*v for v in b)) for x in b]
    d=min(math.dist(a,b),math.dist(a,[-v for v in b]))
    return 4*math.asin(min(1.,d/2))
def delta(a,b):
    return {'translation_cm':max(abs(x-y) for x,y in zip(a['translation'],b['translation'])),
            'scale':max(abs(x-y) for x,y in zip(a['scale'],b['scale'])),
            'rotation_radians':rotation(a['rotation'],b['rotation'])}
maxima={k:0. for k in n.TOL}; arms={k:0. for k in sorted(n.ARMS)}; root_max={k:0. for k in n.TOL}
before,after=original['poses'],trial['trial_poses']
expected=[*names,'Armature']
assert before['names']==after['names']==expected and len(expected)==25
for data in (before,after):
    assert len(data['samples']) == 37 and data['import_root']=='Armature' and data['cpu_names']==names
    for field in ('native_track_spellings','native_reference_spellings'):
        observed=[x.casefold() for x in data[field]]
        assert len(set(observed))==25 and set(observed)=={x.casefold() for x in expected}
    for i,sample in enumerate(data['samples']):
        assert sample['seconds']==i/30. and set(sample['bones'])==set(expected)
        for row in sample['bones'].values():
            assert all(math.isfinite(v) for values in row.values() for v in values)
        for k,v in delta(sample['bones']['Armature'],data['reference_pose']['Armature']).items():
            assert v<=n.TOL[k]; root_max[k]=max(root_max[k],v)
    for sample in (data['samples'][0],data['samples'][-1]):
        for name in expected:
            assert all(v<=n.TOL[k] for k,v in delta(sample['bones'][name],data['reference_pose'][name]).items())
for name in expected:
    assert all(v<=n.TOL[k] for k,v in delta(before['reference_pose'][name],after['reference_pose'][name]).items())
for a,b in zip(before['samples'],after['samples']):
    for name in expected:
        for k,v in delta(a['bones'][name],b['bones'][name]).items():
            if name in n.ARMS and k=='rotation_radians': arms[name]=max(arms[name],v)
            else: assert v<=n.TOL[k]; maxima[k]=max(maxima[k],v)
assert all(v>.01 for v in arms.values())
assert maxima==scope['native_pose_gate']['unchanged_field_maxima']
assert arms==scope['native_pose_gate']['allowed_arm_rotation_max_radians']
for filename in ('Author-20261017T145315Z.json','Verify-20261017T145331Z.json'):
    receipt=load(NATIVE/filename)
    assert receipt['passed'] and receipt['exit_code']==0 and receipt['native_passed']
    assert receipt['settings_restored'] and receipt['saves_unchanged'] and receipt['sources_binary_unchanged']
write('NativeScopeAudit.json', {'passed':True,'scope':'Independent CPU replay and consistency audit of saved actual native author/fresh-process receipts; no new native execution',
      'samples':37,'native_bones':25,'deformation_bones':24,'static_import_root':'Armature',
      'unchanged_field_maxima':maxima,'allowed_arm_rotation_max_radians':arms,'import_root_reference_delta_maxima':root_max,
      'neutral_endpoints_rechecked':True,'own_skeleton_duration_rate_rootflags_unchanged':True,
      'changed_content_from_native_receipts':list(trial['changed_content_sha256']),
      'content_files_from_native_receipts':trial['original_content_count'],
      'current_source_pins_rechecked':source_pins,'source_pin_count':len(source_pins),
      'native_receipt_hashes':{p.name:sha(p) for p in sorted(NATIVE.glob('*.json'))},
      'full_content_or_backup_rehashed_this_pass':False,
      'preservation_basis':'Root-owned fresh native verifier checked full sealed backup and all Content; this CPU audit checks small receipt links, current source pins and recorded poses.',
      'current_visual_review_and_restoration':'Parent-owned pending/completing; no assertion by this CPU check',
      'graphics_accepted':False,'adopted':False})

# Manual OpenSpec delta shape check, not a substitute for absent official CLI.
change=REPO/'openspec/changes/nord-city-quality'
files=['proposal.md','design.md','tasks.md','verification.md','specs/nord-unreal/spec.md']
texts={f:(change/f).read_text() for f in files}
s=texts['specs/nord-unreal/spec.md'];lines=s.splitlines()
assert s.startswith('## ADDED Requirements\n') and '\n## MODIFIED Requirements\n' in s
requirements=[];scenarios=[]
for chunk in s.split('### Requirement: ')[1:]:
    heading=chunk.splitlines()[0];body=chunk.split('#### Scenario: ')[0]
    assert 'SHALL' in body, heading
    children=chunk.split('#### Scenario: ')[1:];assert children, heading
    requirements.append(heading)
    for child in children:
        name=child.splitlines()[0]
        assert '- **WHEN** ' in child and '- **THEN** ' in child, name
        scenarios.append({'requirement':heading,'scenario':name})
assert '### Oct17 private jump arm diagnostic' in texts['design.md']
assert '- [ ] Evaluate the private higher-detail jump' in texts['tasks.md']
assert 'Restore the original private clip after the diagnostic' in texts['design.md']
assert 'adoption and default promotion require a later explicit evidence decision' in texts['design.md']
write('OpenSpecStructure.json', {'passed':True,'method':'Manual delta structure and scope review with lightweight assertions; official OpenSpec CLI not invoked',
      'cli_on_path':shutil.which('openspec'),'change':'nord-city-quality',
      'files_sha256':{f:sha(change/f) for f in files},'requirements':requirements,'scenario_count':len(scenarios),'scenarios':scenarios,
      'sections':['ADDED Requirements','MODIFIED Requirements'],
      'checks':['Every requirement uses SHALL and contains at least one #### Scenario.',
                'Every scenario contains explicit WHEN and THEN bullets.',
                'Private diagnostic is recorded in design and remains an unchecked task until rendering/restoration/review finish.',
                'Existing isolated native pilot and smooth-animation requirements cover the diagnostic; no new default behavior is specified.',
                'Restoration and separate adoption/final-art limits remain explicit.'],
      'official_cli_validation_performed':False,'files_modified':False})
assert all(sha(p)==h for p,h in pinned.items())
write('Results.json', {'passed':True,'started_utc':started,'finished_utc':now(),
      'scope':'Focused CPU-only negative/static checks and replay of retained semantic/native evidence',
      'commands':commands,'checker_source_pins':{str(p.relative_to(GAME)):sha(p) for p in [*pinned,PLAN/'prepare.py']},
      'source_pins':source_pins,
      'reports':['RecordedSemanticReplay.json','NativeScopeAudit.json','OpenSpecStructure.json'],
      'skipped':[{'checker':str(checker),'reason':'Full checker imports bpy, resets Blender scene, imports FBXs and writes a new comparison; only pinned pure math functions replayed on existing arrays.'}],
      'no_ue_blender_gpu_service_git_execution':True,'no_content_mutation':True,
      'full_content_rehash_performed':False,'graphics_accepted':False,'adopted':False,
      'runner_sha256':sha(__file__)})
print('PRIVATE_JUMP_FOCUSED_CPU_CHECKS_OK',OUT)
