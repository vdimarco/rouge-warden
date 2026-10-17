import bpy,json,hashlib,math
from pathlib import Path
from mathutils import Vector
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
report={}
for kind in ('walk','run'):
 bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=30;s.render.threads_mode='FIXED';s.render.threads=4
 p=R/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'/f'{kind}.fbx'
 bpy.ops.import_scene.fbx(filepath=str(p),use_anim=True,automatic_bone_orientation=False,use_image_search=False)
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');a=rig.animation_data.action;first,last=a.frame_range
 snapshots=[]
 for i in range(int(last-first)+1):
  s.frame_set(int(first+i));bpy.context.view_layer.update()
  snapshots.append({b.name:{'location':list(b.location),'q':list(b.matrix.to_quaternion()),'scale':list(b.scale),'head':list(b.head)} for b in rig.pose.bones})
 names=('Hips','LeftHand','RightHand','LeftFoot','RightFoot','LeftForeArm','RightForeArm')
 report[kind]={'file':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frames':[first,last],'fps':s.render.fps,'bones':len(rig.data.bones),'object_matrix':[list(r) for r in rig.matrix_world],'root_names':[b.name for b in rig.data.bones if b.parent is None],'samples':len(snapshots),'ranges':{n:{'translation_delta_component_max':max((Vector(row[n]['head'])-Vector(snapshots[0][n]['head'])).length for row in snapshots),'local_location_min':[min(row[n]['location'][j] for row in snapshots) for j in range(3)],'local_location_max':[max(row[n]['location'][j] for row in snapshots) for j in range(3)],'endpoint_component_matrix_translation_gap':(Vector(snapshots[0][n]['head'])-Vector(snapshots[-1][n]['head'])).length} for n in names},'endpoint_quat_error_rad':{n:rig.data.bones[n].matrix_local.to_quaternion().rotation_difference(rig.data.bones[n].matrix_local.to_quaternion()).angle for n in []},'first':snapshots[0],'last':snapshots[-1]}
Path('/tmp/nord-tripo-locomotion-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
print('LOCOMOTION_INVENTORY',json.dumps({k:{x:v[x] for x in ('frames','samples','fps','bones','root_names','ranges')}for k,v in report.items()}))
