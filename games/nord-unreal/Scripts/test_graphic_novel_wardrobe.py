"""FBX round-trip, body/morph identity and cloth boundary checks; run in Blender."""
import hashlib
import json
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree


ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe'
report=json.loads((OUT/'report.json').read_text())
source=ROOT/report['source']
assert hashlib.sha256(source.read_bytes()).hexdigest()==report['source_sha256']


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    return rig,[o for o in bpy.context.scene.objects if o.type=='MESH']


rig,meshes=load(source)
source_body=max(meshes,key=lambda o:len(o.data.vertices))
body_name=source_body.name
bind={b.name:(b.parent.name if b.parent else None,b.matrix_local.copy()) for b in rig.data.bones}
positions=[source_body.matrix_world@v.co for v in source_body.data.vertices]
tree=KDTree(len(positions))
for i,p in enumerate(positions):tree.insert(p,i)
tree.balance()
source_shapes={k.name:[source_body.matrix_world.to_3x3()@(p.co-source_body.data.vertices[i].co)
                      for i,p in enumerate(k.data)] for k in source_body.data.shape_keys.key_blocks} if source_body.data.shape_keys else {}

rig,meshes=load(OUT/'body.fbx')
assert set(rig.data.bones.keys())==set(bind)
for name,(parent,matrix) in bind.items():
    bone=rig.data.bones[name]
    assert (bone.parent.name if bone.parent else None)==parent
    assert max(abs(a-b) for row,other in zip(matrix,bone.matrix_local) for a,b in zip(row,other))<.0001,name
body=next(o for o in meshes if o.name==body_name)
assert set(k.name for k in body.data.shape_keys.key_blocks)==set(source_shapes)
largest_error=0.
for i,v in enumerate(body.data.vertices):
    p=body.matrix_world@v.co
    nearest,index,distance=tree.find(p)
    assert distance<.00001,('Body rest geometry changed',i,distance)
    for key in body.data.shape_keys.key_blocks:
        delta=body.matrix_world.to_3x3()@(key.data[i].co-v.co)
        error=(delta-source_shapes[key.name][index]).length
        largest_error=max(largest_error,error)
        assert error<.00001,('Morph changed',key.name,i,error)
for obj in meshes:
    assert obj.find_armature()==rig,obj.name
    for vertex in obj.data.vertices:
        assert .98<sum(g.weight for g in vertex.groups)<1.02,(obj.name,vertex.index)

trousers=next(o for o in meshes if o.name=='GN_Trousers')
bm=bmesh.new();bm.from_mesh(trousers.data)
for v in bm.verts:v.co=trousers.matrix_world@v.co
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
unintended=[e for e in bm.edges if e.is_boundary and not
            (all(v.co.z<.201 for v in e.verts) or all(v.co.z>1.0 for v in e.verts))]
nonmanifold=[e for e in bm.edges if len(e.link_faces)>2 or not e.link_faces]
degenerate=[f for f in bm.faces if f.calc_area()<1e-12]
rig.data.pose_position='REST';bpy.context.view_layer.update()
depsgraph=bpy.context.evaluated_depsgraph_get()
# These rays cover the actual outer-ankle notch visible in the retained side view.
ankle_probes=[]
for z in (.182,.187,.192,.197,.202,.207):
    for y in (.085,.09,.095,.10,.105,.11):
        hit,point,normal,index,obj,matrix=bpy.context.scene.ray_cast(depsgraph,Vector((3,y,z)),Vector((-1,0,0)))
        ankle_probes.append({'y':y,'z':z,'object':obj.name if hit else None})
assert all(p['object']=='GN_Trousers' for p in ankle_probes),('Ankle trim still protrudes through cloth',ankle_probes)
result={'passed':not unintended and not nonmanifold and not degenerate,'mode':'fresh FBX reimport in Blender CPU',
        'bind_bones':len(bind),'meshes':len(meshes),'morphs':list(source_shapes),
        'original_body_rest_positions_preserved':True,'weight_sums_normalized':True,
        'max_original_body_morph_error_metres':largest_error,
        'unintended_trouser_boundary_edges':len(unintended),
        'nonmanifold_trouser_edges':len(nonmanifold),'degenerate_trouser_faces':len(degenerate),
        'outer_ankle_notch_sightlines_covered_by_trousers':len(ankle_probes),
        'boundary_edge_world_metres':[[list(v.co) for v in e.verts] for e in unintended],
        'body_fbx_sha256':hashlib.sha256((OUT/'body.fbx').read_bytes()).hexdigest()}
(OUT/'roundtrip.json').write_text(json.dumps(result,indent=2)+'\n')
assert not unintended,('Unintended cloth boundary edges',len(unintended),
                       [[list(v.co) for v in e.verts] for e in unintended])
assert not nonmanifold,('Non-manifold cloth edges',len(nonmanifold))
assert not degenerate,('Degenerate cloth faces',len(degenerate))
bm.free()
print('NORD_GRAPHIC_NOVEL_WARDROBE_ROUNDTRIP_OK',json.dumps(result))
