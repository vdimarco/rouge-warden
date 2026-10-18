"""One authorized Saved-only interior bag leg-weight transfer; no source/helper writes."""
import sys
sys.dont_write_bytecode=True
import hashlib,json
from pathlib import Path
import shutil
from datetime import datetime,timezone
import bpy
import numpy as np

O=Path(__file__).resolve().parent
ROOT=O.parents[2]
sys.path.insert(0,str(ROOT/'Scripts'))
import prepare_tripo_cast_surface as surface
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert bpy.app.background and bpy.context.scene.render.threads==4
assert not (O/'body.fbx').exists() and not (O/'Repair.json').exists(), 'Never overwrite an authored pilot'
recipe_pin=sha(__file__)
helper_pin=sha(ROOT/'Scripts/prepare_tripo_cast_surface.py')
maskdir=ROOT/'Saved/Tests/TripoTopknotBagMask-v1/Refinement-02'
candidate=maskdir/'Candidate.json';arrays=maskdir/'SelectionArrays.npz'
assert sha(candidate)=='2998199eb8699289930220578f83fe3dcf468574476e3031725e4a5141cf1dc0'
assert sha(arrays)=='feb6c1816306bac1fe079747673ab168edf414accfc5755731ea0d02a22bb13a'
mask=json.loads(candidate.read_text());a=np.load(arrays)
provenance=ROOT/'Data/GraphicNovel/Crew/Topknot/tripo-h31-rig-20261017/derived/bag-rejected-v1/Provenance.json'
retained=json.loads(provenance.read_text())
assert sha(provenance)=='096f820af4d434299fb0ff0b3c9265bc7d7762e076c446196114d8508c0fb64e'
assert retained['outputs']['body']['sha256']=='5f5335fa0ec1e6df7ce39262894fef2c1f4a5c6704f0ed25fe33fa3783a040fa'
assert retained['proofs']['Surface.json']['sha256']=='6748ebbff2e64f684bd2b74b14d8fc9a73304ab03da206131220b7f0be475689'
assert retained['proofs']['Motion.json']['sha256']=='88a8178eaf59bf03866b5ee40d6875bbba350e5890b439b96affcba160b7e4db'
rows={k:dict(v) for k,v in retained['outputs'].items()}
rows.update({k:dict(v) for k,v in retained['proofs'].items()})
rows['provider']=dict(mask['source']['provider'])
rows['original']=dict(mask['source']['source'])
rows['provenance']={'path':str(provenance),'sha256':sha(provenance)}
rows['candidate']={'path':str(candidate),'sha256':sha(candidate)}
rows['mask_arrays']={'path':str(arrays),'sha256':sha(arrays)}
(O/'input').mkdir(exist_ok=True)
for name,row in rows.items():
    path=Path(row['path']);path=path if path.is_absolute() else ROOT/path
    assert path.is_file() and not path.is_symlink() and sha(path)==row['sha256'],name
    copy=O/'input'/(name if name in retained['proofs'] else name+path.suffix)
    if not copy.exists():shutil.copyfile(path,copy)
    assert sha(copy)==row['sha256']
    row.update(path=str(path),copy=str(copy))
(O/'Inputs.json').write_text(json.dumps(rows,indent=2)+'\n')
oldsurface=json.loads(Path(rows['Surface.json']['copy']).read_text())
oldmotion=json.loads(Path(rows['Motion.json']['copy']).read_text())
assert oldsurface['passed'] and oldmotion['passed']
assert oldsurface['output']['sha256']==rows['body']['sha256']
assert oldsurface['inputs']['provider_fbx']['sha256']==rows['provider']['sha256']
assert oldsurface['inputs']['source_glb']['sha256']==rows['original']['sha256']
assert all(oldmotion['clips'][k]['output']['sha256']==rows[k]['sha256'] for k in ('idle','walk','run','jump'))

def interior(faces,labels,uncertain,n):
    incident=[set() for _ in range(n)]
    forbidden=np.zeros(n,bool)
    for i,f in enumerate(faces):
        for v in f:
            incident[v].add(int(labels[i]))
            if uncertain[i]:forbidden[v]=True
    return np.array([not forbidden[i] and tags in ({1},{2}) for i,tags in enumerate(incident)])

# A shared/uncertain/strap vertex never enters the editable set.
f=np.array([[0,1,2],[2,3,4],[4,5,6]])
assert np.array_equal(interior(f,np.array([1,2,3]),np.array([False,True,False]),7),[True,True,False,False,False,False,False])
rawallowed=interior(a['faces'],a['labels'],a['uncertain'],len(a['points']))
for name in mask['regions']:
    rawallowed[mask['regions'][name]['boundary_vertex_ids']]=False
rawallowed[mask['uncertain_vertex_ids']]=False
strap=set(mask['regions']['upper_strap']['incident_vertex_ids'])|set(mask['regions']['lower_strap_transition']['incident_vertex_ids'])
assert not any(rawallowed[v] for v in strap)
assert rawallowed.sum()>0

rawrig,rawob=surface.load_mesh(Path(rows['provider']['copy']))
raw=surface.snapshot_mesh(rawrig,rawob)
rawpoints=np.array([tuple(rawob.matrix_world@v.co) for v in rawob.data.vertices])
rawfaces=np.array([tuple(p.vertices) for p in rawob.data.polygons])
assert np.array_equal(rawfaces,a['faces']) and np.max(np.abs(rawpoints-a['points']))<1e-10
rig,ob=surface.load_mesh(Path(rows['body']['copy']))
base=surface.snapshot_mesh(rig,ob)
def material_readback(mesh):
    assert len(mesh.data.materials)==1
    mat=mesh.data.materials[0]
    images=[]
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE':
            image=node.image;assert image
            path=Path(bpy.path.abspath(image.filepath)).resolve()
            assert path.is_file(), ('Missing passed PBR payload',str(path))
            images.append({'sha256':sha(path),'colorspace':image.colorspace_settings.name})
    expected_images={rows[n]['sha256'] for n in ('base_color','normal','metallic_roughness')}
    assert images and all(v['sha256'] in expected_images for v in images)
    assert {rows[n]['sha256'] for n in ('base_color','normal')}<={v['sha256'] for v in images}
    return {'image_payloads':sorted(images,key=lambda v:(v['sha256'],v['colorspace'])),
        'links':sorted((v.from_node.type,v.from_socket.name,v.to_node.type,v.to_socket.name) for v in mat.node_tree.links)}
material_before=material_readback(ob)
aligned_raw,bridge=surface.align_surface(raw,base,scale=1.,residual_limit_m=2e-6)
assert bridge['geometry_mapping_unique'] and not bridge['rotation_fit']
assert base['bones']==raw['bones'] and base['parents']==raw['parents'] and len(base['bones'])==61

def vertex_map(source_aligned,target):
    targets=target['vertices'].ravel();sources=source_aligned['vertices'].ravel()
    result=np.full(len(target['weights']),-1,np.int32)
    for t,s in zip(targets,sources):
        assert result[t] in (-1,s), ('Ambiguous corner-to-vertex mapping',int(t),int(result[t]),int(s))
        result[t]=s
    assert np.all(result>=0), 'Every actual vertex must have an unambiguous mapped corner'
    return result

base_to_raw=vertex_map(aligned_raw,base)
assert np.array_equal(np.sort(base_to_raw),np.arange(len(raw['weights']))), 'Complete provider/derived vertex bijection required'
assert np.array_equal(base['weights'],raw['weights'][base_to_raw]), 'Passed base changed raw-provider weights'
allowed=rawallowed[base_to_raw]
allowedids=np.flatnonzero(allowed)
assert len(allowedids)>0
mapping={'passed':True,'raw_allowed_vertices':np.flatnonzero(rawallowed).tolist(),
 'derived_allowed_vertices':allowedids.tolist(),'derived_to_raw_vertex':base_to_raw.tolist(),
 'raw_to_derived_bijection':len(np.unique(base_to_raw))==len(base_to_raw)==len(raw['weights']),
 'derived_vertices':len(base_to_raw),'source_provider_vertices':len(raw['weights']),
 'base_weights_match_raw_bitwise':True,'bridge':bridge,
 'policy':'All incident faces exclusively one primary bag/contents label; no uncertain, boundary, shared, unselected or strap vertex'}
(O/'Mapping.json').write_text(json.dumps(mapping,indent=2)+'\n')
print('TOPKNOT_REPAIR_MAPPING_PROVEN',len(allowedids),'vertices',flush=True)

bones=base['bones'];pelvis=bones.index('pelvis')
legnames=[n for n in bones if n.startswith(('thigh_','calf_','foot_','ball_'))]
legcolumns=[bones.index(n) for n in legnames]
assert len(legnames)==12 and 'thigh_twist_01_l' in legnames and 'calf_twist_01_r' in legnames
expected=base['weights'].copy()
removed=expected[allowed][:,legcolumns].sum(axis=1,dtype=np.float64)
changedids=allowedids[removed>0]
assert len(changedids)>0
for vertex,total in zip(allowedids,removed):
    expected[vertex,pelvis]=np.float32(float(expected[vertex,pelvis])+float(total))
    expected[vertex,legcolumns]=0
groups={g.name:g for g in ob.vertex_groups}
assert 'pelvis' in groups
assert all(name in groups for name in legnames if np.any(base['weights'][:,bones.index(name)]>0))
for vertex in changedids:
    for name in legnames:
        if base['weights'][vertex,bones.index(name)]>0:groups[name].remove([int(vertex)])
    groups['pelvis'].add([int(vertex)],float(expected[vertex,pelvis]),'REPLACE')
edited=surface.snapshot_mesh(rig,ob)
assert np.array_equal(edited['weights'],expected)
assert np.array_equal(edited['weights'][~allowed],base['weights'][~allowed])
other=[i for i,n in enumerate(bones) if n!='pelvis' and n not in legnames]
assert np.array_equal(edited['weights'][:,other],base['weights'][:,other])
assert np.isfinite(expected).all() and (expected>=0).all() and (expected>1e-8).sum(axis=1).max()<=4
assert np.max(np.abs(expected.sum(axis=1)-base['weights'].sum(axis=1)))<2e-7
for key in ('keys','uv','points','normals','rig_matrix','mesh_matrix'):
    assert np.array_equal(edited[key],base[key]), ('In-memory non-weight mutation',key)
assert all(np.array_equal(edited['bind'][n],base['bind'][n]) for n in bones)
assert edited['parents']==base['parents']

# Narrower export writes only allowed typed skin arrays, preserving all other FBX values.
sys.path.insert(0,str(O))
import cluster_patch
patch_pin=sha(O/'cluster_patch.py')
output=O/'body.fbx'
for name in ('base_color','normal','metallic_roughness'):
    source=Path(rows[name]['copy']);target=O/source.name
    assert not target.exists();shutil.copyfile(source,target)
    assert sha(target)==rows[name]['sha256']
binary_proof=cluster_patch.write_weight_delta(Path(rows['body']['copy']),output,ob,base,expected,allowed,bones)
(O/'BinaryProof.json').write_text(json.dumps(binary_proof,indent=2)+'\n')

freshrig,freshob=surface.load_mesh(output)
fresh0=surface.snapshot_mesh(freshrig,freshob)
material_fresh=material_readback(freshob)
assert material_fresh==material_before, 'Export/reimport changed passed PBR links or payloads'
fresh,freshbridge=surface.align_surface(fresh0,base,scale=1.,residual_limit_m=2e-6)
assert freshrig.name=='Armature' and fresh['bones']==bones and fresh['parents']==base['parents']
# Maps are rebuilt from actual UV/geometry correspondence, never vertex order.
base_to_fresh=vertex_map(fresh,base)
assert np.array_equal(np.sort(base_to_fresh),np.arange(len(fresh0['weights']))), 'Every fresh vertex must be mapped exactly once'
mappedweights=fresh0['weights'][base_to_fresh]
assert np.array_equal(mappedweights,expected), ('Export/reimport changed expected weights',float(np.max(np.abs(mappedweights-expected))))
assert np.array_equal(mappedweights[~allowed],base['weights'][~allowed])
assert np.array_equal(mappedweights[:,other],base['weights'][:,other])
assert np.max(np.abs(fresh['uv']-base['uv']))<1e-6
geom=float(np.linalg.norm(fresh['points']-base['points'],axis=2).max())
assert geom<2e-6
bind=surface.bind_round_trip(base['bind'],fresh['bind'],True)
assert bind['passed']
assert max(np.max(np.abs(fresh['rig_matrix']-base['rig_matrix'])),np.max(np.abs(fresh['mesh_matrix']-base['mesh_matrix'])),abs(fresh['height']-base['height']))<1e-5
normal_vector=float(np.max(np.abs(fresh['normals']-base['normals'])))
assert np.array_equal(fresh['normals'],base['normals']), ('Corner normals changed',normal_vector)
assert all(np.array_equal(fresh['bind'][n],base['bind'][n]) for n in bones)
assert sha(O/'cluster_patch.py')==patch_pin

# Keep original GLB-normal gates intact; the original Surface receipt is immutable.
orig_rig,orig_ob=surface.load_mesh(Path(rows['original']['copy']),allow_static=True)
original=surface.snapshot_mesh(None,orig_ob,Path(rows['original']['copy']))
aligned_original,original_bridge=surface.align_surface(original,base,allow_translation=True)
angle=np.degrees(np.arccos(np.clip(np.sum(aligned_original['normals']*fresh['normals'],axis=2),-1,1)))
normal_metrics={'mean_deg':float(angle.mean()),'p99_deg':float(np.percentile(angle,99)),'max_deg':float(angle.max())}
assert all(normal_metrics[k]<v for k,v in surface.NORMAL_LIMITS.items())
assert all(sha(row['path'])==sha(row['copy'])==row['sha256'] for row in rows.values())
assert sha(__file__)==recipe_pin and sha(ROOT/'Scripts/prepare_tripo_cast_surface.py')==helper_pin
np.savez_compressed(O/'WeightProofArrays.npz',base_to_raw=base_to_raw,base_to_fresh=base_to_fresh,raw_allowed=rawallowed,
    allowed=allowed,base_weights=base['weights'],expected_weights=expected,fresh_mapped_weights=mappedweights,bones=np.array(bones),
    raw_triangles=a['faces'],labels=a['labels'],uncertain=a['uncertain'])
report={'passed':True,'partial_pilot_only':True,'native_or_art_accepted':False,'at_utc':datetime.now(timezone.utc).isoformat(),
 'inputs':rows,'output':{'path':str(output),'sha256':sha(output),'bytes':output.stat().st_size},
 'editable_derived_vertices':len(allowedids),'actually_changed_vertices':len(changedids),'changed_derived_vertex_ids':changedids.tolist(),
 'changed_raw_vertex_ids':sorted(set(map(int,base_to_raw[changedids]))),'leg_bones_transferred':legnames,
 'removed_weight_sum':float(removed.sum()),'max_removed_per_vertex':float(removed.max()),
 'policy':'Only approved conservative interior bag/contents; leg weights transferred to pelvis, every other weight and every outside vertex bitwise preserved',
 'zero_strap_or_uncertain_or_boundary_vertices_edited':True,'in_memory_geometry_uv_normals_binds_matrices_bitwise_unchanged':True,
 'fresh_all_expected_weights_bitwise':True,'fresh_outside_weights_bitwise':True,'fresh_other_channels_bitwise':True,
 'fresh_geometry_residual_max_m':geom,'fresh_uv_max_abs_error':float(np.max(np.abs(fresh['uv']-base['uv']))),
 'fresh_bind_round_trip':bind,'fresh_corner_normal_vector_max_abs_error':normal_vector,'fresh_corner_normals_bitwise_unchanged':True,
 'binary_skin_only_proof':binary_proof,'binary_patch_recipe_sha256':patch_pin,
 'original_normal_metrics':normal_metrics,'original_normal_limits':surface.NORMAL_LIMITS,
 'fresh_correspondence':freshbridge,'inputs_unchanged':True,'source_surface_receipt_unchanged':True,
 'existing_clips_unchanged':True,'recipe_sha256':recipe_pin,'shared_surface_helper_sha256':helper_pin,
 'fresh_material_links_and_image_payloads_unchanged':True,'material_readback':material_fresh,
 'arrays_sha256':sha(O/'WeightProofArrays.npz'),
 'limits':['No strap/boundary/shared/uncertain weights changed','No full accessory-mask, native or final-art acceptance','Existing four own clips retained without reauthoring']}
(O/'Repair.json').write_text(json.dumps(report,indent=2)+'\n')
print('TOPKNOT_INTERIOR_BAG_REPAIR_PROVEN',len(changedids),str(output),flush=True)
