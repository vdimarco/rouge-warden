import bpy,json,math,hashlib,time
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
P=Path(__file__).resolve().parent
before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in P.glob('*.fbx')}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(P/'body.fbx'),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE');basis={b.name:b.matrix_basis.copy() for b in rig.pose.bones};world=rig.matrix_world
front=(world@(rig.data.bones['headfront'].head_local-rig.data.bones['Head'].head_local));front.z=0;front.normalize()
side=(world@(rig.data.bones['LeftUpLeg'].head_local-rig.data.bones['RightUpLeg'].head_local));side.z=0;side.normalize()
def vectors(r):
 out={}
 for s in ('Left','Right'):
  shoulder=r.matrix_world@r.pose.bones[s+'Arm'].head;elbow=r.matrix_world@r.pose.bones[s+'ForeArm'].head;wrist=r.matrix_world@r.pose.bones[s+'Hand'].head;u=(elbow-shoulder).normalized();v=(wrist-elbow).normalized()
  out[s]={'upper_arm_world':list(u),'forearm_world':list(v),'elbow_forward_from_shoulder_cm':(elbow-shoulder).dot(front)*100,'wrist_forward_from_elbow_cm':(wrist-elbow).dot(front)*100,'bend_signed_degrees_about_lateral':math.degrees(math.atan2(side.dot(u.cross(v)),u.dot(v))),'wrist_world_m':list(wrist)}
 return out
bpy.context.view_layer.update();rest=vectors(rig);own={}
for clipname in ('idle','walk','run','jump'):
 previous=set(bpy.data.objects);bpy.ops.import_scene.fbx(filepath=str(P/(clipname+'.fbx')),use_anim=True,automatic_bone_orientation=False,use_image_search=False);c=next(o for o in bpy.data.objects if o not in previous and o.type=='ARMATURE');rig.animation_data_create();rig.animation_data.action=c.animation_data.action;rig.animation_data.action_slot=c.animation_data.action_slot;first,last=c.animation_data.action.frame_range
 rows=[]
 for i in range(9):
  f=first+(last-first)*i/8;bpy.context.scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();rows.append({'fraction':i/8,'seconds':(f-first)/30,'vectors':vectors(rig)})
 own[clipname]={'range':[first,last],'samples':rows}
# Isolate only one forearm at a time from neutral; measure +35/-35 rather than infer bilateral signs.
rig.animation_data_clear();hinge={}
for s in ('Left','Right'):
 for deg in (0,35,-35):
  for b in rig.pose.bones:b.matrix_basis=basis[b.name]
  axis=(rig.data.bones[s+'ForeArm'].matrix_local.to_3x3().inverted()@(rig.matrix_world.inverted().to_3x3()@side)).normalized();b=rig.pose.bones[s+'ForeArm'];b.rotation_mode='QUATERNION';b.rotation_quaternion=basis[b.name].to_quaternion()@Quaternion(axis,math.radians(deg));bpy.context.view_layer.update();hinge[s+str(deg)]=vectors(rig)[s]
(P/'axis-audit.json').write_text(json.dumps({'front_world':list(front),'lateral_world':list(side),'rest':rest,'isolated_forearm35deg':hinge,'own_clips':own,'source_copy_hashes':before},indent=2)+'\n')
# Matched cached CPU studio. Retain previous action, reverse ONLY the measured incorrect forearm signs.
bpy.ops.wm.open_mainfile(filepath=str(P/'study.blend'));scene=bpy.context.scene;mesh=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=mesh.find_armature();prop=bpy.data.objects['GripProxy'];cam=scene.camera
for image in bpy.data.images:
 name=Path(image.filepath).name
 if (P/name).is_file():image.filepath=str(P/name);image.reload()
old=bpy.data.actions['PrivateNaturalAirPose'];new=old.copy();new.name='AnatomicalElbowFlex'
keys=json.loads((P/'previous-preview.json').read_text())['pose_keys'];keys={n:[(t,-v) for t,v in rows] for n,rows in keys.items() if 'ForeArm' in n}
rig.animation_data.action=old;scene.frame_set(2);neutral={n:rig.pose.bones[n].matrix_basis.copy() for n in keys};side_local=(rig.data.bones['LeftUpLeg'].head_local-rig.data.bones['RightUpLeg'].head_local).normalized();axes={n:(rig.data.bones[n].matrix_local.to_3x3().inverted()@side_local).normalized() for n in keys}
def val(rows,t):
 a,b=next((a,b) for a,b in zip(rows,rows[1:]) if a[0]<=t<=b[0]);f=(t-a[0])/(b[0]-a[0]);f=f*f*(3-2*f);return a[1]+(b[1]-a[1])*f
rig.animation_data.action=new
for i in range(37):
 scene.frame_set(2+i)
 for n,rows in keys.items():
  b=rig.pose.bones[n];b.rotation_mode='QUATERNION';b.rotation_quaternion=neutral[n].to_quaternion()@Quaternion(axes[n],math.radians(val(rows,i/30)));b.keyframe_insert('rotation_quaternion',frame=2+i)
# Reference-calibrated wrist/z−20cm; source front is−Y and actor right−X.
scene.frame_set(2);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix;q=Vector((0,0,1)).rotation_difference(Vector((-.55,.2,-.8)).normalized());desired=q.to_matrix().to_4x4();desired.translation=hand.translation-q@Vector((0,0,-.2*.6));desired=desired@Matrix.Diagonal((.6,.6,.6,1));relative=hand.inverted()@desired
assert scene.cycles.device=='CPU';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=4
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
views={'front':(0,-5,1.1),'side':(-5,0,1.1)};rows=[]
def render(mode,action,t,label,selected):
 rig.animation_data.action=action;f=2+t*30;scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();prop.matrix_world=(rig.matrix_world@rig.pose.bones['RightHand'].matrix)@relative;rows.append({'mode':mode,'time':t,'label':label,'vectors':vectors(rig)})
 for view in selected:
  cam.location=views[view];cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(P/(mode+'-'+label+'-'+view+'.png'));bpy.ops.render.render(write_still=True);print('ARM_HINGE_VIEW',mode,label,view,flush=True)
render('rejected',old,.43254,'apex',views)
render('corrected',new,.43254,'apex',views)
for t,label in [(.23,'liftoff'),(.73,'descent'),(.93,'landing')]:render('corrected',new,t,label,['side'])
assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in P.glob('*.fbx')}
(P/'render-audit.json').write_text(json.dumps({'device':'CPU','threads':4,'samples':16,'denoising_gpu':False,'changed':'OnlyLeft/RightForeArm signs in copied prior trial; upperarms/wholebody unchanged for isolation','corrected_keys':keys,'source_copies_unchanged':True,'pose_vectors':rows,'limits':'Elbow diagnostic only; no natural whole-body or grasp acceptance; actualOBJ whitegeometryproxy,neutralreferencecalibration'},indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(P/'hinge-study.blend'));print('ARM_HINGE_DONE',flush=True)
