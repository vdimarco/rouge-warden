import bpy,json,math,hashlib,time
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'natural-study.blend'));scene=bpy.context.scene
mesh=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=mesh.find_armature();prop=bpy.data.objects['GripProxy'];cam=scene.camera
assert rig.animation_data.action.name=='CompactNaturalWholeBody'
for image in bpy.data.images:
 name=Path(image.filepath).name
 if (P/name).is_file():image.filepath=str(P/name);image.reload()
scene.frame_set(2);bpy.context.view_layer.update();base=rig.location.copy();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix;relative=hand.inverted()@prop.matrix_world
# Nonanimated parent survives the render operator's reevaluation of the source rig location curves.
root=bpy.data.objects.new('CPUPreviewActorOffset',None);scene.collection.objects.link(root);saved=rig.matrix_world.copy();rig.parent=root;rig.matrix_world=saved
scene.cycles.device='CPU';scene.cycles.samples=8;scene.render.threads_mode='FIXED';scene.render.threads=4
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
scene.render.resolution_x=640;scene.render.resolution_y=360;scene.render.resolution_percentage=100;cam.data.ortho_scale=4.0
frames=P/'MotionFrames';frames.mkdir();v0=6.;g=9.8;flight=2*v0/g;timeline=[];started=time.monotonic()
for i in [20]+[n for n in range(48) if n!=20]:
 wall=i/24-.20
 if wall<0:t=0.;z=0.;phase='neutral-hold'
 elif wall<flight:
  v=v0-g*wall;z=v0*wall-.5*g*wall*wall;t=.47-.24*max(0.,v/v0) if v>0 else .47+.26*min(1.,-v/v0);phase='ascent' if v>0 else 'descent'
 elif wall<flight+.27:t=.93+wall-flight;z=0.;phase='landing-recovery'
 else:t=1.2;z=0.;phase='neutral-hold'
 f=2+t*30;scene.frame_set(int(f),subframe=f%1)
 # Apply preview-only actor translation AFTER evaluating the static source object curve.
 root.location=Vector((0,0,z));bpy.context.view_layer.update();assert abs(rig.matrix_world.translation.z-z)<1e-6
 hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix;prop.matrix_world=hand@relative
 cam.location=Vector((-3.6,-3.6,1.1+z));cam.rotation_euler=(Vector((0,0,1.08+z))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update()
 markers=[rig.matrix_world@rig.pose.bones['Head'].head+Vector((0,0,.15))]+[rig.matrix_world@rig.pose.bones[s+'Foot'].head-Vector((0,0,.12)) for s in ('Left','Right')]
 ndc=[world_to_camera_view(scene,cam,p) for p in markers]
 assert all(.01<p.x<.99 and .01<p.y<.99 for p in ndc),('Clipped head/feet',i,[list(p) for p in ndc])
 scene.render.filepath=str(frames/f'{i:03}.png');bpy.ops.render.render(write_still=True);timeline.append({'frame':i,'preview_wall_s':i/24,'flight_s':wall,'mapped_clip_s':t,'preview_actor_z_m':z,'phase':phase,'head_foot_camera_ndc':[list(p) for p in ndc]});print('NATURAL_MOTION_FRAME',i,phase,flush=True)
root.location=Vector((0,0,0));timeline.sort(key=lambda row:row['frame'])
(P/'motion.json').write_text(json.dumps({'device':'CPU','threads':4,'samples':8,'gpu_denoising':False,'dimensions':[640,360],'frames':48,'fps':24,'timeline':timeline,'preview_actor_z_on_nonanimated_parent_preserves_static_source_object_curve':True,'head_and_feet_in_frame_all48':True,'actor_ballistic_preview_only':{'velocity_m_s':v0,'gravity_m_s2':g,'flight_seconds':flight,'max_height_m':v0*v0/(2*g)},'limits':['CPU pose study, not native gameplay.','Currentvelocitybandsdirectlymapped; actualnative0.1/0.16blend-to-ownlocomotion notsimulated.','Ballistic actorZ/camera-follow applied forpreview only; no objectactionkeyswritten.','No cloth/prop material, closedgrip, collision or fullfluidity acceptance.'],'seconds':time.monotonic()-started},indent=2)+'\n');print('NATURAL_MOTION_DONE',flush=True)
