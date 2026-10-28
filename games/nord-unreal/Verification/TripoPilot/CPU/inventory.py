import bpy,json
from pathlib import Path
O=Path(__file__).parent
R={}
for name in ['original.glb','returned.fbx']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 if name.endswith('glb'):bpy.ops.import_scene.gltf(filepath=str(O/'input'/name))
 else:bpy.ops.import_scene.fbx(filepath=str(O/'input'/name),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
 R[name]={'objects':[], 'images':[]}
 for ob in bpy.context.scene.objects:
  r={'name':ob.name,'type':ob.type,'matrix_world':[list(x) for x in ob.matrix_world]}
  if ob.type=='ARMATURE':
   ob.animation_data_clear();ob.data.pose_position='REST'
   r['bones']=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local),'deform':b.use_deform} for b in ob.data.bones]
  if ob.type=='MESH':
   ob.data.calc_loop_triangles();r.update(vertices=len(ob.data.vertices),triangles=len(ob.data.loop_triangles),polygons=len(ob.data.polygons),uv=[u.name for u in ob.data.uv_layers],materials=[m.name if m else None for m in ob.data.materials],groups=[g.name for g in ob.vertex_groups],modifiers=[m.type for m in ob.modifiers])
  R[name]['objects'].append(r)
 for i in bpy.data.images:R[name]['images'].append({'name':i.name,'size':list(i.size),'path':i.filepath,'packed':bool(i.packed_file)})
(O/'inventory.json').write_text(json.dumps(R,indent=2)+'\n')
print('INVENTORY_READY',str(O/'inventory.json'))
