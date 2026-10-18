"""Bounded byte-copy retention/audit only; never authors or evaluates new poses."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,sys,shutil,math
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal');P=Path(__file__).resolve().parent
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ready_path=R/'Saved/Tests/TripoH31RemainingFinal-20261017/ReadyForReview.json';assert H(ready_path)=='d2b1fe8d18aab14272742a2dc1e8a252c7464629423cb09497f5911fdde41845';ready=json.loads(ready_path.read_text());name=sys.argv[1];assert name in ready
row=ready[name];sp=R/row['surface_receipt']['path'];mp=R/row['motion_receipt']['path'];assert H(sp)==row['surface_receipt']['sha256'] and H(mp)==row['motion_receipt']['sha256'];s,m=json.loads(sp.read_text()),json.loads(mp.read_text());assert s['passed']and m['passed']and s['retained_inputs_unchanged']and m['retained_inputs_unchanged']
D=R/'Data/GraphicNovel/Crew'/name/'tripo-h31-rig-20261017/derived/natural-v1';V=R/'Verification/TripoCast/TripoBodies/OwnRigCPU/FundedFive'/name;assert not D.exists()and not V.exists(),'Never overwrite a derivative or proof'
roles={'body':s['output'],**s['textures'],**{k:c['output']for k,c in m['clips'].items()}};assert set(roles)=={'body','base_color','metallic_roughness','normal','idle','jump','walk','run'}
for role,item in roles.items():assert Path(item['path']).is_file()and H(Path(item['path']))==item['sha256']
assert m['own_static_body_surface']['sha256']==H(sp)
recipes={'prepare_tripo_cast_surface.py':sp.parents[2]/'executed-prepare_tripo_cast_surface.py','prepare_tripo_cast_motion.py':mp.parents[2]/'executed-prepare_tripo_cast_motion.py','prepare_meshy_jump.py':R/'Scripts/prepare_meshy_jump.py'}
assert H(recipes['prepare_tripo_cast_surface.py'])==s['recipe_sha256'];assert H(recipes['prepare_tripo_cast_motion.py'])==m['recipe_sha256'];assert H(recipes['prepare_meshy_jump.py'])==m['corrected_source_jump']['author_recipe_sha256']
if name=='RedJersey':
 recipes['capture_tripo_source_jump.py']=mp.parents[2]/'executed-capture_tripo_source_jump.py';assert H(recipes['capture_tripo_source_jump.py'])==m['corrected_source_jump']['capture_recipe_sha256']
# Protect all five original provider folders and each actually consumed motion source.
protected={str(ready_path):H(ready_path)}
for who,rr in ready.items():
 for directory in (R/'Data/GraphicNovel/Crew'/who/'tripo-h31-body-20261017',R/'Data/GraphicNovel/Crew'/who/'tripo-h31-rig-20261017'):
  for file in directory.rglob('*'):
   if file.is_file()and 'derived'not in file.relative_to(directory).parts:protected[str(file)]=H(file)
 for key in ('surface_receipt','motion_receipt'):
  file=R/rr[key]['path'];protected[str(file)]=H(file)
 doc=json.loads((R/rr['motion_receipt']['path']).read_text())
 for key,value in doc['inputs'].items():
  file=R/value['path'];assert H(file)==value['sha256'];protected[str(file)]=value['sha256']
for file in recipes.values():protected[str(file)]=H(file)
# Audit numeric gates already evaluated by the completed exact executed recipe.
assert set(m['clips'])=={'idle','jump','walk','run'}and sum(c['half_frame_samples']for c in m['clips'].values())==416
seconds={'idle':4.,'jump':1.2,'walk':31/30,'run':19/30};counts={'idle':241,'jump':73,'walk':63,'run':39};audit={}
for kind,c in m['clips'].items():
 a=c['metrics'];assert c['bones']==61 and c['fps']==30 and abs(c['seconds']-seconds[kind])<1e-12 and c['half_frame_samples']==counts[kind]
 assert c['binary_fbx']['time_mode']==6 and abs(c['binary_fbx']['declared_seconds']-seconds[kind])<1e-9 and c['binary_fbx']['curve_max_grid_error_ktime_ticks']<=1
 for field,limit in [('half_frame_pose_matrix_error',2e-5),('half_frame_pose_rotation_error_rad',1e-4),('hip_xyz_error_target_units',1e-5),('local_translation_error',1e-5),('local_scale_error',1e-5),('root_matrix_error',1e-5),('object_matrix_error',1e-7),('key_and_evaluated_quaternion_norm_error',1e-4),('loop_matrix_error',1e-5),('loop_angle_error_rad',1e-4),('gait_finger_baseline_rotation_error_rad',1e-4),('jump_inherited_lower_body_matrix_error_half_frames',1e-5),('jump_acting_in_memory_lower_body_matrix_change',1e-5)]:assert math.isfinite(a[field])and a[field]<limit,(kind,field)
 assert a['reference']['matrix']<2e-5 and a['reference']['angle_rad']<1e-4 and a['reference']['head']<1e-5 and a['reference']['scale']<2e-5
 assert len(c['finger_entry_local_deviation_deg'])==30 and min(c['finger_entry_local_deviation_deg'].values())>1
 if kind in ('idle','jump'):
  assert a['minimum_elbow_forward_delta_deg']>=14-1e-4 and a['minimum_palm_inward_dot']>=.85 and min(c['entry_palm_inward_dot'].values())>=.85
  assert a['maximum_upper_body_step_deg_per_30Hz_frame']<(3 if kind=='idle' else 20)
 else:assert a['minimum_elbow_signed_deg']>=-.5 and a['gait_mapped_component_delta_error_rad']<1e-4
 audit[kind]={'half_frame_samples':c['half_frame_samples'],'exact_output_sha256':c['output']['sha256'],'passed_recorded_gates':True,'metrics':a}
assert m['idle_jump_endpoint_matrix_error']<1e-5
log=mp.parents[2]/'motion.log';assert log.is_file()and 'TRIPO_CAST_MOTION_PASS'in log.read_text();process_file=mp.parents[2]/'Run.json'
if process_file.exists():
 original_run=json.loads(process_file.read_text());assert original_run['passed'];process=next(p for p in original_run['processes']if p['stage']=='motion');assert process['exit_code']==0;command=process['command'];process_evidence={'kind':'Original serialized runner receipt','path':str(process_file.relative_to(R)),'sha256':H(process_file)}
else:
 manifest=mp.parents[2]/'motion-inputs.json';assert H(manifest)==m['manifest_sha256'];command=['blender','-b','-t','4','--python-exit-code','1','--python','Scripts/prepare_tripo_cast_motion.py','--','--manifest',str(manifest),'--output',str(mp.parents[2]/'motion/clips'),'--report',str(mp.parent)];process_evidence={'kind':'Observed original completed exec plus retained success log; this audit did not rerun authoring','original_exec_session_id':5089 if name=='GreenCap51' else 96689,'original_process_exit_code_observed':0}
# All preflight checks passed before creating either authorized fresh destination.
D.mkdir(parents=True);V.mkdir(parents=True);(V/'Recipes').mkdir()
def copy(source,dest):
 assert source.is_file()and not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True)
 with source.open('rb')as src,dest.open('xb')as dst:shutil.copyfileobj(src,dst)
 assert H(source)==H(dest);return {'path':str(dest.relative_to(R)),'sha256':H(dest)}
outputs={}
for role,item in roles.items():
 source=Path(item['path']);target=D/(role+source.suffix);pin=copy(source,target);outputs[role]={**pin,'source_proof_output_sha256':item['sha256']}
proofs={'Surface.json':copy(sp,V/'Surface.json'),'Motion.json':copy(mp,V/'Motion.json')}
frozen={n:copy(file,V/'Recipes'/n)for n,file in recipes.items()};copy(log,V/'motion.log');copy(sp.parents[2]/'surface.log',V/'surface.log')
if process_file.exists():copy(process_file,V/'OriginalRun.json')
if name=='RedJersey':
 capture=m['corrected_source_jump'];copy(Path(capture['original_scene_samples']['path']),V/'OriginalSourceSceneSamples.json');copy(Path(capture['receipt_path']),V/'OriginalSourceAuthorReport.json');intermediate=m['source_clips']['jump']['intermediate_fbx'];assert not intermediate['reference_passed']and not intermediate['poses_consumed'];ip=copy(Path(intermediate['path']),V/'RejectedIntermediate/jump.fbx');(V/'RejectedIntermediate/Reference.json').write_text(json.dumps({'passed':False,'role':'Rejected optional original-source transport; never own target clip','retained_fbx':ip,'diagnostic':intermediate,'accepted_original_scene_transport':True},indent=2)+'\n')
unchanged=all(Path(p).is_file()and H(Path(p))==h for p,h in protected.items());assert unchanged
motion_test={'passed':True,'finished_utc':datetime.now(timezone.utc).isoformat(),'scope':'Retention audit of the existing completed CPU process, recorded416 pose gates and exact output hashes; no independent pose generation or new Blender execution','process_exit_code':0,'command':command,'original_process_evidence':process_evidence,'original_motion_log_sha256':H(log),'motion_receipt':proofs['Motion.json'],'surface_receipt':proofs['Surface.json'],'frozen_executed_recipes':frozen,'half_frame_samples':416,'audited_clips':audit,'output_roles_exactly_eight':True,'output_hashes':outputs,'protected_originals_unchanged':True,'protected_originals':{str(Path(p).relative_to(R)):h for p,h in protected.items()},'retention_recipe_sha256':H(Path(__file__)),'new_pose_generation_or_independent_reimport':False,'art_native_package_acceptance':False}
(V/'MotionTest.json').write_text(json.dumps(motion_test,indent=2)+'\n');proofs['MotionTest.json']={'path':str((V/'MotionTest.json').relative_to(R)),'sha256':H(V/'MotionTest.json')}
height=s['correspondence']['provider_bounds_m']['max'][2]-s['correspondence']['provider_bounds_m']['min'][2]
allowed=name in ('Memphis33','WhiteCap','LimeJacket')
provenance={'character':name,'source_body_provider':'Tripo H3.1','rig_provider':'Tripo v3','byte_identical_copies_of_passed_CPU_outputs':True,'outputs':outputs,'proofs':proofs,'frozen_executed_recipes':frozen,'raw_provider_fbx':s['inputs']['provider_fbx'],'original_glb':s['inputs']['source_glb'],'preview_height_m':1.82,'native_import_scale_proposal_only':1.82/height,'retained_provider_height_m':height,'rendered_continuous_review_pending':True,'native_or_final_art_accepted':False,'native_import_trial_allowed':allowed,'native_import_trial_scope':'Root authorized isolated candidate import after reviewing15 own-body stills; continuous motion/native/package/final art acceptance separate'if allowed else'Pending root own-body visual review; retention alone does not authorize native import','limits':['Original source-unit geometry, weights and binds preserved; no native import executed by retention.','Exact original GLB PBR payloads; no native shader acceptance.','Broad inherited gait/contact and physical-device/package acceptance remain separate.'],'retention_scope':'Exactly8roles copied from accepted CPU proofs; no source/provider overwrites or new authoring','protected_originals_unchanged':True}
(D/'Provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
assert len(outputs)==8 and set(p.name for p in D.iterdir())=={Path(row['path']).name for row in outputs.values()}|{'Provenance.json'}
assert all(H(R/v['path'])==v['sha256']==v['source_proof_output_sha256']for v in outputs.values())
assert all(H(Path(p))==h for p,h in protected.items())
retention={'passed':True,'character':name,'output_roles':8,'files_byte_identical':True,'outputs':outputs,'provenance':{'path':str((D/'Provenance.json').relative_to(R)),'sha256':H(D/'Provenance.json')},'proofs':proofs,'protected_originals_unchanged':True,'native_import_trial_allowed':allowed,'no_blender_unreal_gpu_api_services':True,'retention_recipe_sha256':H(Path(__file__))};(V/'Retention.json').write_text(json.dumps(retention,indent=2)+'\n');(P/(name+'.json')).write_text(json.dumps(retention,indent=2)+'\n');print('FUNDED_TRIPO_RETAINED',name,allowed,H(D/'Provenance.json'),flush=True)
