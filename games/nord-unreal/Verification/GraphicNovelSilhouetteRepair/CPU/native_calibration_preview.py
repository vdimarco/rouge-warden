import bpy,json,math,time
from pathlib import Path
from mathutils import Vector,Matrix
P=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(P/'study.blend'))
scene=bpy.context.scene
mesh=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=mesh.find_armature();prop=bpy.data.objects['GripProxy'];cam=scene.camera
rig.animation_data.action=bpy.data.actions['PrivateNaturalAirPose']
scene.frame_set(2);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix
axis=Vector((-.55,.2,-.8)).normalized();q=Vector((0,0,1)).rotation_difference(axis);desired=q.to_matrix().to_4x4();desired.translation=hand.translation-q@Vector((0,0,-.2*.6));desired=desired@Matrix.Diagonal((.6,.6,.6,1));relative=hand.inverted()@desired
frame=2+.43254*30;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();prop.matrix_world=(rig.matrix_world@rig.pose.bones['RightHand'].matrix)@relative
assert scene.cycles.device=='CPU' and scene.render.threads==4
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
views={'front':(0,-5,1.1),'side':(-5,0,1.1),'threequarter':(-3.6,-3.6,1.1)}
for label,loc in views.items():
 out=P/('trial-native-grip-'+label+'.png');assert not out.exists();cam.location=loc;cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out);bpy.ops.render.render(write_still=True);print('NATIVE_GRIP_CPU_READY',label,flush=True)
(P/'native-grip-preview.json').write_text(json.dumps({'scope':'CPU geometry proxy, no native material/closed-grasp or full-motion acceptance','scale':.6,'calibration_frame':2,'shaft_grip_local_z_m':-.2,'attach':'RightHand matrix translation wrist, no palm offset','neutral_cup_axis_source_world':list(axis),'hand_relative_matrix':[[float(x) for x in row] for row in relative],'clip_time_s':.43254,'scene':'same cached raw-map studio and pose as initial trial','device':'CPU','threads':4,'samples':16},indent=2)+'\n')
print('NATIVE_GRIP_CPU_DONE',flush=True)
