"""Read-only-on-source CPU component diagnosis; only imported scratch meshes are welded."""
from pathlib import Path
from datetime import datetime,timezone
import bpy,bmesh,numpy as np,json,hashlib,shutil
O=Path(__file__).resolve().parent
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
source=R/'Data/GraphicNovel/Crew/BlackCap/generated-v1-high-detail/body.glb'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='310b173814108907c7041dbfc51bb0f5228a9b94a7a3323ac7b87243f6fe5a6c'
assert sha(source)==expected
copy=O/'body.glb';assert not copy.exists();shutil.copyfile(source,copy)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(copy))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data_clear();rig.data.pose_position='REST'
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.find_armature()==rig)
bpy.context.view_layer.update()
evaluated=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
points=np.array([evaluated.matrix_world@v.co for v in evaluated.data.vertices],np.float64)
evaluated.data.calc_loop_triangles();tris=np.array([t.vertices[:] for t in evaluated.data.loop_triangles],np.int32)
base_points=np.array([mesh.matrix_world@v.co for v in mesh.data.vertices],np.float64)
base_error=float(np.linalg.norm(points-base_points,axis=1).max());assert base_error<1e-6
print('BASE_EVALUATED_MAX_ERROR_M',base_error)
geometry_sha=hashlib.sha256(points.tobytes()+tris.tobytes()).hexdigest()
assert geometry_sha==json.loads((R/'Verification/TripoCast/BodyReview/BlackCap/Review.json').read_text())['body']['evaluated_geometry_sha256']
head=rig.matrix_world@rig.data.bones['Head'].head_local
roi_min=np.array(head)+[-.16,-.25,-.03];roi_max=np.array(head)+[.16,.08,.35]
report={'created_utc':datetime.now(timezone.utc).isoformat(),'scope':'CPU component/bounds analysis of actual original BlackCap GLB; copied input only; no source repair', 'source':str(source),'source_sha256':expected,'evaluated_geometry_sha256':geometry_sha,'base_to_evaluated_max_error_m':base_error,'head_world_m':list(head),'head_ROI_minmax_m':[roi_min.tolist(),roi_max.tolist()],'measurements':{}}
for distance in [0,1e-6,1e-5]:
 bm=bmesh.new();bm.from_mesh(mesh.data);layer=bm.faces.layers.int.new('original_polygon')
 for i,f in enumerate(bm.faces):f[layer]=i
 bm.transform(mesh.matrix_world)
 if distance:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=distance)
 bm.verts.ensure_lookup_table();bm.verts.index_update();seen=set();groups=[]
 for initial in bm.verts:
  if initial.index in seen:continue
  todo=[initial];seen.add(initial.index);vertices=[];faces=set()
  while todo:
   v=todo.pop();vertices.append(v);faces.update(v.link_faces)
   for e in v.link_edges:
    n=e.other_vert(v)
    if n.index not in seen:seen.add(n.index);todo.append(n)
  xyz=np.array([v.co[:] for v in vertices]);face_ids=[f[layer] for f in faces]
  face_roi=[f for f in faces if all(a<=x<=b for a,x,b in zip(roi_min,f.calc_center_median(),roi_max))]
  groups.append({'vertices':len(vertices),'faces':len(faces),'area_m2':sum(f.calc_area() for f in faces),'boundary_edges':len({e for f in faces for e in f.edges if e.is_boundary}),'bounds_min_m':xyz.min(axis=0).tolist(),'bounds_max_m':xyz.max(axis=0).tolist(),'face_ROI_triangles':len(face_roi),'original_polygon_ids':sorted(face_ids)})
 groups.sort(key=lambda c:(-c['faces'],-c['vertices']))
 labels=np.full(len(mesh.data.polygons),-1,np.int32)
 for i,g in enumerate(groups):
  g['component_id']=i;labels[g['original_polygon_ids']]=i
  del g['original_polygon_ids']
 report['measurements'][str(distance)]={'components':len(groups),'vertices_after':len(bm.verts),'faces_after':len(bm.faces),'head_components':[g for g in groups if g['face_ROI_triangles']>0],'largest_components':groups[:10],'removed_degenerate_polygons':int((labels<0).sum())}
 np.save(O/f'polygon-components-{distance}.npy',labels);bm.free()
np.savez_compressed(O/'geometry.npz',points=points,triangles=tris)
assert sha(source)==sha(copy)==expected
report['original_unchanged']=True
(O/'Topology.json').write_text(json.dumps(report,indent=2)+'\n')
for k,v in report['measurements'].items():
 print('WELD',k,'components',v['components'],'headparts',len(v['head_components']))
 for c in v['head_components']:print(c)
