import bpy,json
from pathlib import Path
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
files={'source_body':R/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail/body.fbx','source_clip':R/'Verification/GraphicNovelNaturalMotion/Export/trial/CurlyMetalhead/jump.fbx','target':R/'Data/GraphicNovel/Pilot/CurlyMetalhead/tripo-v3-rig-20261017/rig.fbx'}
out={}
for label,p in files.items():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.fbx(filepath=str(p),use_anim=label=='source_clip',automatic_bone_orientation=False)
 rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
 if rig.animation_data and rig.animation_data.action:
  bpy.context.scene.frame_set(int(rig.animation_data.action.frame_range[0]));bpy.context.view_layer.update()
 bones={}
 for b in rig.data.bones:
  bones[b.name]={'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'bind_quaternion_wxyz':list(b.matrix_local.to_quaternion()),'pose_quaternion_wxyz':list(rig.pose.bones[b.name].matrix.to_quaternion()),'basis':list(rig.pose.bones[b.name].matrix_basis.to_quaternion())}
 out[label]={'world':[[float(x) for x in row] for row in rig.matrix_world],'count':len(bones),'bones':bones,'range':list(rig.animation_data.action.frame_range) if rig.animation_data and rig.animation_data.action else None}
Path('/tmp/nord-tripo-compact-retarget-20261017T2040Z/Inspection.json').write_text(json.dumps(out,indent=2)+'\n')
print('RETARGET_INSPECT_OK')
