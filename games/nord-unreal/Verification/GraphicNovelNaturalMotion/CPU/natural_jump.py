import bpy,json,math,hashlib,time
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
P=Path(__file__).resolve().parent
pins={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in P.iterdir() if p.suffix in ('.fbx','.png')}
bpy.ops.wm.open_mainfile(filepath=str(P/'study.blend'));scene=bpy.context.scene
mesh=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=mesh.find_armature();prop=bpy.data.objects['GripProxy'];cam=scene.camera
for image in bpy.data.images:
 name=Path(image.filepath).name
 if (P/name).is_file():image.filepath=str(P/name);image.reload()
original=next(a for a in bpy.data.actions if a.name!='PrivateNaturalAirPose');rig.animation_data.action=original;scene.frame_set(2);bpy.context.view_layer.update()
neutral={b.name:b.matrix_basis.copy() for b in rig.pose.bones};side=(rig.data.bones['LeftUpLeg'].head_local-rig.data.bones['RightUpLeg'].head_local).normalized();axes={n:(rig.data.bones[n].matrix_local.to_3x3().inverted()@side).normalized() for n in neutral}
# Original smoothstep sampling and all untouched source channels remain. No live author script is imported.
times=[0,.10,.23,.47,.73,.93,1.2]
angles={
 'LeftArm':[0,15,-15,-20,-10,-15,0], 'RightArm':[0,10,5,-5,0,-5,0],
 'LeftForeArm':[0,-30,-35,-50,-40,-45,0], 'RightForeArm':[0,-25,-25,-35,-25,-30,0],
 'LeftUpLeg':[0,-25,-5,-25,-12,-28,0], 'RightUpLeg':[0,-25,-3,-12,-8,-26,0],
 'LeftLeg':[0,55,12,55,28,60,0], 'RightLeg':[0,55,8,35,23,56,0],
 'LeftFoot':[0,-25,-7,-15,-14,-28,0], 'RightFoot':[0,-25,-5,-10,-10,-28,0],
 'Spine01':[0,12,4,6,8,12,0], 'neck':[0,-8,-2.8,-4.2,-5.6,-8.4,0]}
def value(v,t):
 i=next(i for i in range(len(times)-1) if times[i]<=t<=times[i+1]);f=(t-times[i])/(times[i+1]-times[i]);f=f*f*(3-2*f);return v[i]+(v[i+1]-v[i])*f
new=original.copy();new.name='CompactNaturalWholeBody';rig.animation_data.action=new
for i in range(37):
 scene.frame_set(2+i)
 for name,values in angles.items():
  b=rig.pose.bones[name];b.rotation_mode='QUATERNION';b.rotation_quaternion=neutral[name].to_quaternion()@Quaternion(axes[name],math.radians(value(values,i/30)));b.keyframe_insert('rotation_quaternion',frame=2+i)
# Actual source geometry proxy. Neutral calibration fixed once; live hand anchors only.
scene.frame_set(2);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix
axis=Vector((-.55,.2,-.8)).normalized();q=Vector((0,0,1)).rotation_difference(axis);desired=q.to_matrix().to_4x4();desired.translation=hand.translation-q@Vector((0,0,-.2*.6));desired=desired@Matrix.Diagonal((.6,.6,.6,1));relative=hand.inverted()@desired
scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=4
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
scene.render.resolution_x=720;scene.render.resolution_y=920;scene.render.resolution_percentage=100
base_rig=rig.location.copy();base_mesh=mesh.matrix_world.copy();groups={g.index:g.name for g in mesh.vertex_groups};footids=[v.index for v in mesh.data.vertices if any(groups[g.group] in ('LeftFoot','RightFoot','LeftToeBase','RightToeBase') and g.weight>.2 for g in v.groups)]
views={'front':(0,-5,1.1),'side':(-5,0,1.1),'threequarter':(-3.6,-3.6,1.1)};measurements=[]
def pose(t,z=0.):
 rig.location=base_rig+Vector((0,0,z));f=2+t*30;scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update();prop.matrix_world=(rig.matrix_world@rig.pose.bones['RightHand'].matrix)@relative

def measure(label,t):
 ev=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());positions=[ev.matrix_world@ev.data.vertices[i].co for i in footids];out={'phase':label,'clip_s':t,'minimum_shoe_z_m':min(v.z for v in positions),'maximum_shoe_z_m':max(v.z for v in positions),'arms':{}}
 front=Vector((0,-1,0));lateral=Vector((1,0,0))
 for side in ('Left','Right'):
  s=rig.matrix_world@rig.pose.bones[side+'Arm'].head;e=rig.matrix_world@rig.pose.bones[side+'ForeArm'].head;w=rig.matrix_world@rig.pose.bones[side+'Hand'].head;u=(e-s).normalized();v=(w-e).normalized();out['arms'][side]={'signed_bend_degrees':math.degrees(math.atan2(lateral.dot(u.cross(v)),u.dot(v))),'wrist_ahead_of_elbow_cm':(w-e).dot(front)*100}
 measurements.append(out)

started=time.monotonic()
for label,t,selected in [('liftoff',.23,['side']),('apex',.47,['front','side','threequarter']),('descent',.73,['side']),('landing',.93,['side'])]:
 pose(t);measure(label,t)
 for view in selected:
  cam.data.ortho_scale=2.35;cam.location=views[view];cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(P/(label+'-'+view+'.png'));bpy.ops.render.render(write_still=True);print('NATURAL_STILL_READY',label,view,flush=True)
(P/'stills.json').write_text(json.dumps({'device':'CPU','threads':4,'samples':16,'angles_degrees':angles,'key_seconds':times,'pelvis_roll_yaw_changed':False,'clavicle_changed':False,'original_hips_translation_unchanged':True,'measurements':measurements,'scope':'Onecompactwholebodycandidate; sourcegeometryproxy andstaticopenfingers; notnative/artacceptance','stills_seconds':time.monotonic()-started},indent=2)+'\n')
# Save neutral-root authorable working action BEFORE the preview-only ballistic rig offset.
pose(0);bpy.ops.wm.save_as_mainfile(filepath=str(P/'natural-study.blend'));print('NATURAL_STILLS_COMPLETE',flush=True)
# Exactly48CPUframes at24fps. Phase mapping follows current velocity evaluator; no ground anticipation invented.
frames=P/'MotionFrames';frames.mkdir();scene.render.resolution_x=640;scene.render.resolution_y=360;scene.cycles.samples=8;scene.camera.data.ortho_scale=4.0
velocity=6.;gravity=9.8;flight=2*velocity/gravity;timeline=[]
for i in range(48):
 wall=i/24-.20
 if wall<0:t=0.;z=0.;phase='neutral-hold'
 elif wall<flight:
  v=velocity-gravity*wall;z=velocity*wall-.5*gravity*wall*wall;t=.47-(.24*max(0.,v/velocity)) if v>0 else .47+.26*min(1.,-v/velocity);phase='ascent' if v>0 else 'descent'
 elif wall<flight+.27:t=.93+(wall-flight);z=0.;phase='landing-recovery'
 else:t=1.2;z=0.;phase='neutral-hold'
 pose(t,z);cam.location=Vector((-3.6,-3.6,1.1+z));cam.rotation_euler=(Vector((0,0,1.08+z))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(frames/f'{i:03}.png');bpy.ops.render.render(write_still=True);timeline.append({'frame':i,'preview_wall_s':i/24,'flight_s':wall,'mapped_clip_s':t,'preview_actor_z_m':z,'phase':phase});print('NATURAL_MOTION_FRAME',i,phase,flush=True)
rig.location=base_rig;assert pins=={name:hashlib.sha256((P/name).read_bytes()).hexdigest() for name in pins}
(P/'motion.json').write_text(json.dumps({'device':'CPU','threads':4,'samples':8,'dimensions':[640,360],'frames':48,'fps':24,'timeline':timeline,'actor_ballistic_preview_only':{'velocity_m_s':velocity,'gravity_m_s2':gravity,'flight_seconds':flight,'max_height_m':velocity*velocity/(2*gravity)},'limitations':['CPU authored pose preview, not gameplay/nativecapture.','Directcurrentvelocitybands; actualnative0.1/0.16blend-to-ownlocomotion notsimulated.','ActorZ and camera-follow are preview only; authorable action/root is savedbeforeballistic offsets.','No nativeclothing/prop material/collision/grasp or continuousfluidity acceptance.'],'copied_inputs_unchanged':True,'total_seconds':time.monotonic()-started},indent=2)+'\n');print('NATURAL_MOTION_COMPLETE',flush=True)
