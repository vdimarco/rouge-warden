"""One CPU-only compact-jump retarget. No render, mesh export, provider or native actions."""
import bpy, json, hashlib, math, traceback
from pathlib import Path
from datetime import datetime, timezone
from mathutils import Quaternion, Vector, Matrix
P=Path(__file__).resolve().parent
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
FILES={'source_body':R/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.fbx','source_glb':R/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.glb','compact_jump':R/'Verification/GraphicNovelNaturalMotion/Export/trial/CurlyMetalhead/jump.fbx','compact_receipt':R/'Verification/GraphicNovelNaturalMotion/Export/trial/CurlyMetalhead/jump.json','target':R/'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/rig.fbx','audit':Path('/tmp/nord-tripo-rig-audit-20261017T201543Z/Audit.json')}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
BEFORE={k:sha(v) for k,v in FILES.items()}
assert BEFORE['target']=='baaeb99a7e86fadadd4f64f6de6ea7e648777b33bcadd2ecb72347c4afe3dcc2'
assert BEFORE['compact_jump']=='71277e693654e02d365d22d7d34cf534045a4aa9ed77b4c19d4744a0839680ac'
receipt=json.loads(FILES['compact_receipt'].read_text());assert receipt['jump_sha256']==BEFORE['compact_jump'] and receipt['head_and_neck_unchanged'] is False
assert bpy.app.background and bpy.context.scene.render.threads==4
M={'Hips':'pelvis','Spine02':'spine_01','Spine01':'spine_02','Spine':'spine_03','neck':'neck_01','Head':'head'}
for a,b in [('Left','l'),('Right','r')]:
 for x,y in [('Shoulder','clavicle'),('Arm','upperarm'),('ForeArm','lowerarm'),('Hand','hand'),('UpLeg','thigh'),('Leg','calf'),('Foot','foot'),('ToeBase','ball')]:M[a+x]=y+'_'+b
INV={v:k for k,v in M.items()};assert len(M)==22
REPORT={'passed':False,'started_utc':datetime.now(timezone.utc).isoformat(),'scope':'One animation-only component-delta retarget proof; no material, mesh, native, rendering, motion or adoption acceptance','inputs':{k:{'path':str(v),'sha256':BEFORE[k]} for k,v in FILES.items()},'source_to_target_bones':M,'unmapped_policy':'Target bind local rotation/translation/scale; parent follow only','errors':[]}

def qerr(a,b):
 a=a.normalized();b=b.normalized();d=a.rotation_difference(b);return 2*math.atan2(Vector((d.x,d.y,d.z)).length,abs(d.w))
def validq(q):return all(math.isfinite(v) for v in q) and abs(q.magnitude-1)<1e-5
def import_rig(path,anim):
 before=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(path),use_anim=anim,automatic_bone_orientation=False)
 return next(o for o in bpy.data.objects if o not in before and o.type=='ARMATURE')
def bindloc(rig):return {b.name:(b.parent.matrix_local.inverted()@b.matrix_local if b.parent else b.matrix_local.copy()) for b in rig.data.bones}
def elbow(rig,side,rest,forward):
 bs=rig.pose.bones;u=bs['lowerarm_'+side].head-bs['upperarm_'+side].head;l=bs['hand_'+side].head-bs['lowerarm_'+side].head
 u.normalize();l.normalize();lower0=rest['hand_'+side].translation-rest['lowerarm_'+side].translation;lower0.normalize();hinge=lower0.cross(forward).normalized()
 q=bs['lowerarm_'+side].matrix.to_quaternion()@rest['lowerarm_'+side].to_quaternion().inverted();axis=q@hinge
 return math.atan2(axis.dot(u.cross(l)),u.dot(l))
try:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 scene=bpy.context.scene;scene.render.fps=30;scene.render.threads_mode='FIXED';scene.render.threads=4
 body=import_rig(FILES['source_body'],False);source=import_rig(FILES['compact_jump'],True);target=import_rig(FILES['target'],False)
 assert len(source.data.bones)==24 and len(target.data.bones)==61
 assert set(M)<=set(source.data.bones.keys()) and set(INV)<=set(target.data.bones.keys())
 assert set(source.data.bones.keys())==set(body.data.bones.keys())
 for b in source.data.bones:
  bb=body.data.bones[b.name];assert (b.parent.name if b.parent else None)==(bb.parent.name if bb.parent else None)
  assert qerr(b.matrix_local.to_quaternion(),bb.matrix_local.to_quaternion())<1e-4
  assert (source.matrix_world@b.head_local-body.matrix_world@bb.head_local).length<1e-5
 action=source.animation_data.action;first,last=action.frame_range;assert abs(last-first-36)<1e-5
 audit=json.loads(FILES['audit'].read_text());ratio=audit['comparison']['uv_correspondence_similarity_fit']['returned_to_source_scale'];assert abs(ratio-1.82)<1e-4
 ss=source.matrix_world.to_scale();ts=target.matrix_world.to_scale();assert max(ss)-min(ss)<1e-6 and max(ts)-min(ts)<1e-6
 assert qerr(source.matrix_world.to_quaternion(),target.matrix_world.to_quaternion())<1e-5
 vertical_factor=ss.z/(ratio*ts.z)
 sb={b.name:b.matrix_local.copy() for b in source.data.bones};tb={b.name:b.matrix_local.copy() for b in target.data.bones};tl=bindloc(target)
 hierarchy={b.name:b.parent.name if b.parent else None for b in target.data.bones};target_world=target.matrix_world.copy();source_world=source.matrix_world.copy()
 target.animation_data_clear();scene.frame_start=1;scene.frame_end=37
 up=(tb['head'].translation-tb['pelvis'].translation).normalized();side=(tb['thigh_l'].translation-tb['thigh_r'].translation).normalized();forward=sum((tb['ball_'+s].translation-tb['foot_'+s].translation for s in ('l','r')),Vector());forward-=up*forward.dot(up);forward-=side*forward.dot(side);forward.normalize()
 assert forward.length>.99
 scene.frame_set(int(first));bpy.context.view_layer.update();neutral={s:elbow(target,s,tb,forward) for s in ('l','r')}
 expected=[];prev={};inmem={'component_rotation_error_rad':0.,'local_translation_error_target_units':0.,'local_scale_error':0.,'unmapped_local_rotation_error_rad':0.}
 for i in range(37):
  scene.frame_set(int(first+i));bpy.context.view_layer.update();deltas={t:(source.pose.bones[s].matrix.to_quaternion().normalized()@sb[s].to_quaternion().normalized().inverted()).normalized() for s,t in M.items()}
  z=(source.pose.bones['Hips'].matrix.translation.z-sb['Hips'].translation.z)*vertical_factor
  desired={}
  for b in target.data.bones:
   parent=hierarchy[b.name]
   desired[b.name]=(deltas[b.name]@tb[b.name].to_quaternion()).normalized() if b.name in INV else ((desired[parent]@tl[b.name].to_quaternion()).normalized() if parent else tb[b.name].to_quaternion().normalized())
  row={'frame':i+1,'source_frame':float(first+i),'hip_vertical_target_units':z,'component_quaternions_wxyz':{n:list(q) for n,q in desired.items()}}
  scene.frame_set(i+1)
  for b in target.pose.bones:
   parent=hierarchy[b.name];local=(desired[parent].inverted()@desired[b.name]).normalized() if parent else desired[b.name]
   q=(tl[b.name].to_quaternion().inverted()@local).normalized()
   if b.name in prev and q.dot(prev[b.name])<0:q.negate()
   assert validq(q);prev[b.name]=q.copy();b.rotation_mode='QUATERNION';b.location=(0,0,0);b.scale=(1,1,1);b.rotation_quaternion=q
   if b.name=='pelvis':b.location=tb['pelvis'].to_3x3().inverted()@Vector((0,0,z))
   for key in ('rotation_quaternion','location','scale'):b.keyframe_insert(key,frame=i+1)
  bpy.context.view_layer.update()
  for b in target.pose.bones:
   assert validq(b.rotation_quaternion) and all(math.isfinite(v) for rowm in b.matrix for v in rowm)
   inmem['component_rotation_error_rad']=max(inmem['component_rotation_error_rad'],qerr(b.matrix.to_quaternion(),desired[b.name]))
  expected.append(row)
 assert inmem['component_rotation_error_rad']<1e-4,inmem
 scene.frame_set(1);bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
 output=P/'retargeted-jump.fbx';assert not output.exists()
 bpy.ops.export_scene.fbx(filepath=str(output),use_selection=True,object_types={'ARMATURE'},add_leaf_bones=False,bake_anim=True,bake_anim_use_all_bones=True,bake_anim_use_nla_strips=False,bake_anim_use_all_actions=False,bake_anim_simplify_factor=0,axis_forward='-Z',axis_up='Y')
 assert output.stat().st_size>10000
 # Fresh scene and fresh importer: no dependency on cached authoring objects.
 bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=30;scene.render.threads_mode='FIXED';scene.render.threads=4
 check=import_rig(output,True);assert len(check.data.bones)==61 and set(check.data.bones.keys())==set(tb)
 assert hierarchy=={b.name:b.parent.name if b.parent else None for b in check.data.bones}
 assert max(abs(v) for b in check.data.bones for r in b.matrix_local-tb[b.name] for v in r)<1e-5
 ca=check.animation_data.action;cf,cl=ca.frame_range;assert abs(cl-cf-36)<1e-5
 maxima={'component_rotation_error_rad':0.,'mapped_component_delta_error_rad':0.,'local_translation_error_target_units':0.,'local_scale_error':0.,'unmapped_local_rotation_error_rad':0.,'root_matrix_error':0.,'object_matrix_error':0.,'pelvis_horizontal_drift_target_units':0.,'hip_vertical_error_target_units':0.,'neutral_endpoint_rotation_error_rad':0.}
 samples=[]
 for i,row in enumerate(expected):
  scene.frame_set(int(cf+i));bpy.context.view_layer.update();elbows={s:elbow(check,s,tb,forward) for s in ('l','r')}
  for b in check.pose.bones:
   q=b.matrix.to_quaternion().normalized();desired=Quaternion(row['component_quaternions_wxyz'][b.name]);assert validq(q)
   maxima['component_rotation_error_rad']=max(maxima['component_rotation_error_rad'],qerr(q,desired))
   if b.name in INV:maxima['mapped_component_delta_error_rad']=max(maxima['mapped_component_delta_error_rad'],qerr(q@tb[b.name].to_quaternion().inverted(),desired@tb[b.name].to_quaternion().inverted()))
   local=b.parent.matrix.inverted()@b.matrix if b.parent else b.matrix.copy();loc,rot,scale=local.decompose();rloc,rrot,rscale=tl[b.name].decompose()
   if b.name!='pelvis':maxima['local_translation_error_target_units']=max(maxima['local_translation_error_target_units'],(loc-rloc).length)
   maxima['local_scale_error']=max(maxima['local_scale_error'],max(abs(a-bb) for a,bb in zip(scale,rscale)))
   if b.name not in INV:maxima['unmapped_local_rotation_error_rad']=max(maxima['unmapped_local_rotation_error_rad'],qerr(rot,rrot))
   if i in (0,36):maxima['neutral_endpoint_rotation_error_rad']=max(maxima['neutral_endpoint_rotation_error_rad'],qerr(q,tb[b.name].to_quaternion()))
  delta=check.pose.bones['pelvis'].matrix.translation-tb['pelvis'].translation
  maxima['pelvis_horizontal_drift_target_units']=max(maxima['pelvis_horizontal_drift_target_units'],math.hypot(delta.x,delta.y))
  maxima['hip_vertical_error_target_units']=max(maxima['hip_vertical_error_target_units'],abs(delta.z-row['hip_vertical_target_units']))
  maxima['root_matrix_error']=max(maxima['root_matrix_error'],max(abs(v) for r in check.pose.bones['root'].matrix-tb['root'] for v in r))
  # Compare object to its first saved readback; export may convert constant coordinate basis.
  if i==0:obj0=check.matrix_world.copy()
  maxima['object_matrix_error']=max(maxima['object_matrix_error'],max(abs(v) for r in check.matrix_world-obj0 for v in r))
  samples.append({'time_s':i/30,'elbow_signed_degrees':{s:math.degrees(v) for s,v in elbows.items()},'elbow_flex_from_bind_degrees':{s:math.degrees(elbows[s]-neutral[s]) for s in elbows},'pelvis_component_delta':list(delta)})
 REPORT.update({'mapped_bones':len(M),'target_bones':61,'samples':37,'seconds':(cl-cf)/30,'fps':30,'source_height_over_target_height':ratio,'source_vertical_to_target_units_factor':vertical_factor,'unmapped_bones':sorted(set(tb)-set(INV)),'fresh_reimport_maxima':maxima,'in_memory_maxima':inmem,'samples_readback':samples,'output':{'file':output.name,'bytes':output.stat().st_size,'sha256':sha(output)},'target_hierarchy':hierarchy,'fresh_action_frame_range':[cf,cl]})
 assert maxima['component_rotation_error_rad']<1e-4 and maxima['mapped_component_delta_error_rad']<1e-4,maxima
 assert maxima['local_translation_error_target_units']<1e-5 and maxima['local_scale_error']<1e-5,maxima
 assert maxima['unmapped_local_rotation_error_rad']<1e-4 and maxima['neutral_endpoint_rotation_error_rad']<1e-4,maxima
 assert maxima['root_matrix_error']<1e-5 and maxima['object_matrix_error']<1e-7 and maxima['pelvis_horizontal_drift_target_units']<1e-5 and maxima['hip_vertical_error_target_units']<1e-5,maxima
 assert all(samples[14]['elbow_flex_from_bind_degrees'][s]>20 for s in ('l','r')),samples[14]
 assert min(v for row in samples for v in row['elbow_flex_from_bind_degrees'].values())>-.1
 REPORT['passed']=True
except Exception:
 REPORT['errors'].append(traceback.format_exc());raise
finally:
 REPORT['retained_inputs_unchanged']=BEFORE=={k:sha(v) for k,v in FILES.items()};REPORT['finished_utc']=datetime.now(timezone.utc).isoformat()
 (P/'Retarget.json').write_text(json.dumps(REPORT,indent=2)+'\n')
 assert REPORT['retained_inputs_unchanged'],'Retained source changed'
print('NORD_TRIPO_COMPACT_RETARGET_OK',json.dumps(REPORT['fresh_reimport_maxima']))
