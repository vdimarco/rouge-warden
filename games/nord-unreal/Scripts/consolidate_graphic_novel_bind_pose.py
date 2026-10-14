"""Consolidate consistent partial Blender bind poses in a new FBX; no geometry edits.

Run with Blender --background --factory-startup --python this_file.
"""
import hashlib
import json
from pathlib import Path
import struct

import bpy
from io_scene_fbx import encode_bin, parse_fbx


ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe'
SOURCE=OUT/'body.fbx'
TARGET=OUT/'body-bind-pose.fbx'
assert SOURCE.is_file() and not TARGET.exists(), 'Preserve existing exports; never overwrite a bind-pose candidate'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
tree,version=parse_fbx.parse(str(SOURCE))
objects=next(e for e in tree.elems if e.id==b'Objects')
poses=[e for e in objects.elems if e.id==b'Pose']
assert len(poses)>1
nodes={}
for pose in poses:
    assert pose.props[2]==b'BindPose'
    for node in pose.elems:
        if node.id!=b'PoseNode':continue
        key=next(e.props[0] for e in node.elems if e.id==b'Node')
        matrix=next(e.props[0] for e in node.elems if e.id==b'Matrix')
        if key in nodes:
            previous=next(e.props[0] for e in nodes[key].elems if e.id==b'Matrix')
            assert list(matrix)==list(previous), ('Conflicting bind matrices',key)
        else:nodes[key]=node
models={e.props[0] for e in objects.elems if e.id==b'Model'}
assert set(nodes)==models,('Incomplete union',len(nodes),len(models))
base=max(poses,key=lambda e:sum(n.id==b'PoseNode' for n in e.elems))
children=[]
for e in base.elems:
    if e.id==b'PoseNode':continue
    if e.id==b'NbPoseNodes':e=e._replace(props=[len(nodes)])
    children.append(e)
merged=base._replace(elems=children+list(nodes.values()))
new_objects=objects._replace(elems=[e for e in objects.elems if e.id!=b'Pose']+[merged])
tree=tree._replace(elems=[new_objects if e.id==b'Objects' else e for e in tree.elems])


def fingerprint(element):
    digest=hashlib.sha256()
    def add(value):
        digest.update(struct.pack('<Q',len(value)));digest.update(value)
    def visit(e):
        add(e.id);add(bytes(e.props_type))
        for p in e.props:
            if isinstance(p,bytes):add(p)
            elif isinstance(p,bool):add(bytes([p]))
            elif isinstance(p,int):add(struct.pack('<q',p))
            elif isinstance(p,float):add(struct.pack('<d',p))
            else:add(p.tobytes())
        for child in e.elems:visit(child)
    visit(element)
    return digest.hexdigest()


methods={ord(c):name for c,name in {
    'B':'add_bool','C':'add_char','Z':'add_int8','Y':'add_int16','I':'add_int32','L':'add_int64',
    'F':'add_float32','D':'add_float64','R':'add_bytes','S':'add_string',
    'i':'add_int32_array','l':'add_int64_array','f':'add_float32_array','d':'add_float64_array',
    'b':'add_bool_array','c':'add_byte_array'}.items()}


def encode(e):
    out=encode_bin.FBXElem(e.id)
    for kind,value in zip(e.props_type,e.props):getattr(out,methods[kind])(value)
    out.elems=[encode(child) for child in e.elems]
    return out


encoded=encode(tree)
# Definitions counts describe the new Pose records, not character data.
definitions=next(e for e in encoded.elems if e.id==b'Definitions')
for e in definitions.elems:
    if e.id==b'ObjectType' and e.props and e.props[0][4:] in (b'Pose',b'BindPose'):
        count=next(c for c in e.elems if c.id==b'Count')
        count.props[0]=struct.pack('<i',1)
        break
else:raise AssertionError('No bind-pose Definitions count')
total=next(e for e in definitions.elems if e.id==b'Count')
total.props[0]=struct.pack('<i',struct.unpack('<i',total.props[0])[0]-len(poses)+1)
encode_bin.write(str(TARGET),encoded,version)
result_tree,result_version=parse_fbx.parse(str(TARGET))
assert result_version==version
result_objects=next(e for e in result_tree.elems if e.id==b'Objects')
protected_before=[fingerprint(e) for e in objects.elems if e.id!=b'Pose']
protected_after=[fingerprint(e) for e in result_objects.elems if e.id!=b'Pose']
assert protected_before==protected_after,'Non-pose FBX objects changed'
before_connections=next(e for e in tree.elems if e.id==b'Connections')
after_connections=next(e for e in result_tree.elems if e.id==b'Connections')
assert fingerprint(before_connections)==fingerprint(after_connections),'FBX connections changed'
result_poses=[e for e in result_objects.elems if e.id==b'Pose']
assert len(result_poses)==1 and fingerprint(result_poses[0])==fingerprint(merged)


def snapshot(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(path),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
    rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
    return {'bones':{b.name:{'parent':b.parent.name if b.parent else None,'matrix':[list(r) for r in b.matrix_local]}
                     for b in rig.data.bones},
            'meshes':{o.name:{'matrix':[list(r) for r in o.matrix_world],
                             'vertices':[list(v.co) for v in o.data.vertices],
                             'faces':[list(p.vertices) for p in o.data.polygons],
                             'weights':[[(o.vertex_groups[g.group].name,g.weight) for g in v.groups] for v in o.data.vertices],
                             'shapes':{k.name:[list(v.co) for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}}
                      for o in bpy.context.scene.objects if o.type=='MESH'}}


before=snapshot(SOURCE);after=snapshot(TARGET)
assert before==after,'Blender reimport changed bind/body/morph/weight data'
assert len(after['bones'])==44 and len(after['meshes'])==45
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash,'Frozen source export changed'
report={'passed':True,'source':'body.fbx','source_sha256':source_hash,
        'output':'body-bind-pose.fbx','output_sha256':hashlib.sha256(TARGET.read_bytes()).hexdigest(),
        'method':'union of identical shared-node matrices from partial BindPose entries; exactly one complete pose',
        'source_pose_count':len(poses),'output_pose_count':1,'union_pose_nodes':len(nodes),
        'all_other_fbx_object_contents_identical':True,'connection_contents_identical':True,
        'geometry_weights_morphs_contents_identical':True,
        'blender_reimport_bind_mesh_positions_weights_and_morphs_identical':True,
        'bind_bones':44,'meshes':45,
        'other_changes':['Pose definition counts updated','Blender binary writer normalizes file timestamp/header IDs'],
        'limits':['No geometry/topology correction: the eight tiny trouser boundary edges remain.','Unreal SDK validation and native rendering still require fresh checks.']}
(OUT/'body-bind-pose.json').write_text(json.dumps(report,indent=2)+'\n')
print('NORD_GRAPHIC_NOVEL_COMPLETE_BIND_POSE_OK',json.dumps(report))
