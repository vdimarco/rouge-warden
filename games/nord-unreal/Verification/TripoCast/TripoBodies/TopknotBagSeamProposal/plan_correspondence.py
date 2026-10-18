"""Read-only correspondence and array-only connectivity PROPOSAL. Never author/export a mesh."""
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import hashlib,json,shutil
import bpy
import numpy as np
from io_scene_fbx import parse_fbx
O=Path(__file__).resolve().parent
ROOT=O.parents[2]
sys.path.insert(0,str(ROOT/'Scripts'))
import prepare_tripo_cast_surface as surface
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert bpy.app.background and bpy.context.scene.render.threads==4
assert not (O/'ConnectivityPlan.json').exists()
ownership=json.loads((O/'Ownership.json').read_text())
a=np.load(O/'OwnershipArrays.npz')
assert sha(O/'OwnershipArrays.npz')==ownership['arrays_sha256']
old_inputs=json.loads((ROOT/'Saved/Tests/TripoTopknotBagRepair-v1/Inputs.json').read_text())
rows={k:dict(old_inputs[k]) for k in ('body','base_color','normal','metallic_roughness','provider','original','Surface.json','Motion.json','idle','walk','run','jump')}
(O/'plan-input').mkdir()
for name,row in rows.items():
    assert sha(row['path'])==row['sha256']
    copy=O/'plan-input'/(name if name.endswith('.json') else name+Path(row['path']).suffix)
    shutil.copyfile(row['path'],copy);assert sha(copy)==row['sha256']
    row['copy']=str(copy)
expected_pins={'body':'5f5335fa0ec1e6df7ce39262894fef2c1f4a5c6704f0ed25fe33fa3783a040fa',
 'provider':'9cfeefead9c03472bb8f718fe96e403e79f5eab07ea3f10a2ee07488fa41fb21',
 'original':'621c65ce305a29d27b7ee974ee928011c3a0d78a979bf9cc3b73ecb13d54fae2',
 'Surface.json':'6748ebbff2e64f684bd2b74b14d8fc9a73304ab03da206131220b7f0be475689',
 'Motion.json':'88a8178eaf59bf03866b5ee40d6875bbba350e5890b439b96affcba160b7e4db',
 'idle':'be74b1503f902c8b8555ff93e2ff956e581256599fb91cc8ecf20e5fb2e8b8d2',
 'walk':'6ae8236f44e4d5476531b5f72e0622506b546bfe72ef530edaea0db9f8526c6b',
 'run':'3589bd91d495f03262e15bd1fab851560c53abaf07a867790b82551c6b9a8bd6',
 'jump':'4ab6b0bd4dd7f6d1ebd0b39214b502f27f3333261e850426efc71c4cafa34260'}
assert all(rows[k]['sha256']==v for k,v in expected_pins.items())
assert json.loads(Path(rows['Surface.json']['copy']).read_text())['passed']
assert json.loads(Path(rows['Motion.json']['copy']).read_text())['passed']
rawrig,rawob=surface.load_mesh(Path(rows['provider']['copy']))
raw=surface.snapshot_mesh(rawrig,rawob)
rawfaces=np.array([tuple(p.vertices) for p in rawob.data.polygons],np.int32)
rawpoints=np.array([tuple(rawob.matrix_world@v.co) for v in rawob.data.vertices])
assert np.array_equal(rawfaces,a['faces']) and np.array_equal(rawpoints,a['points'])
rig,ob=surface.load_mesh(Path(rows['body']['copy']))
base=surface.snapshot_mesh(rig,ob)
aligned,bridge=surface.align_surface(raw,base,scale=1.,residual_limit_m=2e-6)
assert bridge['geometry_mapping_unique'] and not bridge['rotation_fit']
base_to_raw=np.full(len(base['weights']),-1,np.int32)
for t,s in zip(base['vertices'].ravel(),aligned['vertices'].ravel()):
    assert base_to_raw[t] in (-1,s)
    base_to_raw[t]=s
assert np.array_equal(np.sort(base_to_raw),np.arange(len(raw['weights'])))
assert np.array_equal(base['weights'],raw['weights'][base_to_raw])
raw_to_base=np.argsort(base_to_raw)
mesh=ob.data
basefaces=np.array([tuple(p.vertices) for p in mesh.polygons],np.int32)
lookup={tuple(sorted(f)):i for i,f in enumerate(rawfaces)}
assert len(lookup)==len(rawfaces)
base_face_to_raw=np.array([lookup[tuple(sorted(f))] for f in base_to_raw[basefaces]],np.int32)
assert np.array_equal(np.sort(base_face_to_raw),np.arange(len(rawfaces)))
for f,rid in zip(base_to_raw[basefaces],base_face_to_raw):
    r=tuple(rawfaces[rid]);assert tuple(f) in (r,r[1:]+r[:1],r[2:]+r[:2]),'Winding must match'
raw_face_to_base=np.argsort(base_face_to_raw)
roles=a['ownership'][base_face_to_raw]
proposed=basefaces.copy()
new_to_old=list(range(len(base_to_raw)))
duplicates=[]
for row in ownership['planned_raw_seam_duplicates']:
    rv=row['raw_vertex_id'];bv=int(raw_to_base[rv])
    # Duplicate each disconnected bag-side fan separately. Never bridge fixed/unresolved faces.
    remaining=set(map(int,raw_face_to_base[row['bag_face_ids']]))
    while remaining:
        seed=min(remaining);stack=[seed];fan=[]
        while stack:
            fid=stack.pop()
            if fid not in remaining:continue
            remaining.remove(fid);fan.append(fid)
            neighbors=set(basefaces[fid])-{bv}
            stack.extend(j for j in remaining if neighbors & (set(basefaces[j])-{bv}))
        new_id=len(new_to_old);new_to_old.append(bv)
        for fid in fan:
            assert roles[fid] in (1,2,3)
            proposed[fid][proposed[fid]==bv]=new_id
        duplicates.append({'proposed_new_vertex_id':new_id,'old_derived_vertex_id':bv,
            'raw_vertex_id':rv,'derived_face_ids':sorted(fan),'raw_face_ids':sorted(map(int,base_face_to_raw[fan]))})
new_to_old=np.array(new_to_old,np.int32)
assert np.array_equal(new_to_old[proposed],basefaces)
assert np.array_equal(proposed[np.isin(roles,[0,4,5])],basefaces[np.isin(roles,[0,4,5])])
uv=np.array([tuple(v.uv) for v in mesh.uv_layers.active.data])
normal_matrix=ob.matrix_world.to_3x3().inverted().transposed()
normals=np.array([tuple((normal_matrix@n.vector).normalized()) for n in mesh.corner_normals])
worldpoints=np.array([tuple(ob.matrix_world@v.co) for v in mesh.vertices])
planned_points=worldpoints[new_to_old]
planned_weights=base['weights'][new_to_old]
assert np.array_equal(planned_points[proposed],worldpoints[basefaces])
assert np.array_equal(planned_weights[proposed],base['weights'][basefaces])
assert np.array_equal(planned_weights[:len(base_to_raw)],base['weights'])
def connectivity(f):
    e=np.sort(np.concatenate((f[:,[0,1]],f[:,[1,2]],f[:,[2,0]])),axis=1)
    edges,count=np.unique(e,axis=0,return_counts=True)
    return {'edges':len(edges),'boundary_edges':int((count==1).sum()),'nonmanifold_edges':int((count>2).sum())}
attributes=[{'name':v.name,'domain':v.domain,'data_type':v.data_type,'elements':len(v.data)} for v in mesh.attributes]
tree,version=parse_fbx.parse(rows['body']['copy'])
objects=next(v for v in tree.elems if v.id==b'Objects')
geometries=[v for v in objects.elems if v.id==b'Geometry']
assert len(geometries)==1
layers=[]
known={'LayerElementNormal','LayerElementUV','LayerElementMaterial','LayerElementSmoothing'}
for layer in geometries[0].elems:
    name=layer.id.decode()
    if not name.startswith('LayerElement'):continue
    modes={v.id.decode():[x.decode(errors='replace') if isinstance(x,bytes) else x for x in v.props]
        for v in layer.elems if v.id in (b'MappingInformationType',b'ReferenceInformationType')}
    layers.append({'kind':name,'modes':modes,'recognized_for_future_plan':name in known})
materials=[]
for mat in mesh.materials:
    materials.append({'name':mat.name,'links':sorted((l.from_node.type,l.from_socket.name,l.to_node.type,l.to_socket.name) for l in mat.node_tree.links),
        'images':[{'sha256':sha(Path(bpy.path.abspath(n.image.filepath)).resolve()),'colorspace':n.image.colorspace_settings.name}
            for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]})
unsupported=[v for v in layers if not v['recognized_for_future_plan']]
np.savez_compressed(O/'ConnectivityPlanArrays.npz',derived_to_raw=base_to_raw,derived_face_to_raw=base_face_to_raw,
    original_triangles=basefaces,proposed_triangles=proposed,proposed_new_to_old_vertex=new_to_old,
    original_corner_uv=uv,original_corner_normals=normals,original_face_material=np.array([p.material_index for p in mesh.polygons]),
    original_world_points=worldpoints,proposed_world_points=planned_points,
    original_weights=base['weights'],proposed_initial_weights=planned_weights,bones=np.array(base['bones']))
document={'proposal_only':True,'authored_or_exported_mesh':False,'deformation_performed':False,'ready_for_authoring':False,
 'inputs':rows,'ownership_sha256':sha(O/'Ownership.json'),'bridge':bridge,'unique_vertex_and_face_bijections':True,
 'candidate_duplicates':duplicates,'counts':{'original_vertices':len(base_to_raw),'proposed_vertices':len(new_to_old),
     'candidate_duplicate_fans':len(duplicates),'candidate_original_vertices':len(ownership['planned_raw_seam_duplicates']),
     'faces_original_and_proposed':len(basefaces),'blocked_interface_vertices':len(ownership['blocked_raw_interface_vertices'])},
 'original_connectivity':connectivity(basefaces),'proposed_connectivity':connectivity(proposed),
 'array_plan_reconstruction':{'all_original_loops_winding_exact_via_new_to_old':True,'all_corner_positions_exact':True,
     'corner_uv_normals_material_arrays_retained_exact':True,'all_initial_corner_weights_exact':True,'all_original_vertex_weights_exact':True,
     'no_added_removed_faces_caps_or_backing':True},
 'inventory':{'fbx_version':version,'serialized_geometry_fields':[v.id.decode() for v in geometries[0].elems],
     'serialized_layers':layers,'unsupported_serialized_layers':unsupported,'imported_attributes':attributes,
     'uv_layers':[v.name for v in mesh.uv_layers],'color_attributes':[v.name for v in mesh.color_attributes],
     'shape_keys':bool(mesh.shape_keys),'modifiers':[{'name':m.name,'type':m.type} for m in ob.modifiers]},
 'binds':{'bone_names':base['bones'],'parents':base['parents'],'matrices':{n:base['bind'][n].tolist() for n in base['bones']},
     'rig_matrix':base['rig_matrix'].tolist(),'mesh_matrix':base['mesh_matrix'].tolist()},'PBR':materials,
 'limits':['This is an array-only candidate plan, not an authored topology variant or an accepted semantic mask.',
     'A, D and hidden hand/forearm/backing ownership unresolved; open interface chains prevent coherent whole-bag separation.',
     'Only B local fan ownership is confirmed. Every other candidate duplicate awaits visual review.',
     'Original serialized corner layers, edge/smoothing graph, skin/bind and PBR must be proven after any future actual topology writer.',
     'A future authorized topology-only variant must pass fresh 416 all-corner old-clip equality samples before any weight pilot. This has not been run.'],
 'future_animation_gate':{'performed':False,'old_clips_unchanged':True,'idle':241,'walk':63,'run':39,'jump':73,'total':416},
 'arrays_sha256':sha(O/'ConnectivityPlanArrays.npz'),'recipe_sha256':sha(__file__)}
(O/'ConnectivityPlan.json').write_text(json.dumps(document,indent=2)+'\n')
fresh=surface.snapshot_mesh(rig,ob)
for key in ('points','uv','normals','weights','vertices','loops','rig_matrix','mesh_matrix'):
    assert np.array_equal(fresh[key],base[key]),('Read-only proposal changed source mesh',key)
assert all(np.array_equal(fresh['bind'][n],base['bind'][n]) for n in base['bones'])
assert all(sha(v['path'])==sha(v['copy'])==v['sha256'] for v in rows.values())
print('TOPOLOGY_ARRAY_PLAN_ONLY',document['counts'],flush=True)
