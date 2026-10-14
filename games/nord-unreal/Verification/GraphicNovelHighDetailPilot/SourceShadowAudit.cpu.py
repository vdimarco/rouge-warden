"""Read-only, CPU-only source topology/skin audit. No renders or asset writes."""
import bpy, bmesh, numpy as np
import hashlib, json, math
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[4]
SRC=ROOT/'Data/GraphicNovel/Pilot/CurlyMetalhead/generated-v2-high-detail'
OUT=Path(__file__).with_name('SourceShadowAudit.json')
assert not OUT.exists(), 'Do not overwrite prior audit'
def hashes():
 return {str(p.relative_to(SRC)):{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(SRC.rglob('*')) if p.is_file()}
BEFORE=hashes()
R={'scope':'CPU-only immutable source topology/skin and own-clip geometric screening, not native shadow diagnosis','created_utc':datetime.now(timezone.utc).isoformat(),'blender':bpy.app.version_string,'threads':4,'render_performed':False,'source':str(SRC.relative_to(ROOT)),'source_before':BEFORE,'assets':{},'clips':{},'thresholds':{'position_weld_m':1e-6,'degenerate_triangle_area_m2':1e-12,'weight_sum_tolerance':.02,'extreme_edge_min_length_m':.15,'extreme_edge_stretch_ratio':8,'split_vertex_gap_screen_m':.001},'limitations':['Topology weld is performed only on a disposable in-memory BMesh; source geometry remains split at UV/normal seams.','Open boundaries and coincident/non-manifold faces are source-quality observations, not proof of native shadow artifacts.','Own clips are sampled at every imported integer frame; Unreal blends, actor motion, attached props, lighting, shadow maps and renderer are not reproduced.','No renderer setting or production asset is changed.']}
def fresh(): bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(name,anim=False):
 before=set(bpy.data.objects)
 bpy.ops.import_scene.fbx(filepath=str(SRC/name),use_anim=anim,automatic_bone_orientation=False,use_image_search=False)
 objs=[o for o in bpy.data.objects if o not in before]
 return [o for o in objs if o.type=='MESH'],[o for o in objs if o.type=='ARMATURE']
def coords(o,evaluated=False):
 m=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data if evaluated else o.data
 a=np.empty((len(m.vertices),3),np.float64);m.vertices.foreach_get('co',a.ravel())
 M=np.array(o.matrix_world);return a@M[:3,:3].T+M[:3,3]
def bounds(a):return [a.min(axis=0).tolist(),a.max(axis=0).tolist()]
def tris(o):
 o.data.calc_loop_triangles();a=np.empty((len(o.data.loop_triangles),3),np.int32);o.data.loop_triangles.foreach_get('vertices',a.ravel());return a
def weights(o,rig):
 names=[b.name for b in rig.data.bones];ix={n:i for i,n in enumerate(names)};groups={g.index:g.name for g in o.vertex_groups}
 a=np.zeros((len(o.data.vertices),len(names)),np.float64);invalid=[]
 for v in o.data.vertices:
  for g in v.groups:
   if groups.get(g.group) in ix:a[v.index,ix[groups[g.group]]]+=g.weight
   elif g.weight>1e-8:invalid.append([v.index,groups.get(g.group),g.weight])
 sums=a.sum(axis=1)
 return a,{'bone_count':len(names),'bone_names':names,'weighted_bones':int((a.sum(axis=0)>0).sum()),'weight_sum_min':float(sums.min()),'weight_sum_max':float(sums.max()),'unweighted_vertices':int((sums<1e-6).sum()),'weight_sums_outside_tolerance':int((np.abs(sums-1)>.02).sum()),'negative_weights':int((a<0).sum()),'nonfinite_weights':int((~np.isfinite(a)).sum()),'max_influences':int((a>1e-8).sum(axis=1).max()),'nonbone_weight_assignments':invalid[:20],'nonbone_weight_assignment_count':len(invalid)}
def audit(o,rig):
 a=coords(o);t=tris(o);w,ws=weights(o,rig)
 bm=bmesh.new();bm.from_mesh(o.data);bm.transform(o.matrix_world)
 raw={'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_excluding_boundary':sum(not e.is_manifold and not e.is_boundary for e in bm.edges),'loose_vertices':sum(not v.link_faces for v in bm.verts),'wire_edges':sum(e.is_wire for e in bm.edges),'degenerate_faces':sum(f.calc_area()<1e-12 for f in bm.faces)}
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);bm.verts.ensure_lookup_table();bm.edges.ensure_lookup_table();bm.faces.ensure_lookup_table();bm.verts.index_update();bm.faces.index_update()
 kd=KDTree(len(bm.verts))
 for v in bm.verts:kd.insert(v.co,v.index)
 kd.balance();mapping=np.array([kd.find(Vector(p))[1] for p in a],np.int32)
 reps=np.full(len(bm.verts),-1,np.int32)
 for i,j in enumerate(mapping):
  if reps[j]<0:reps[j]=i
 representative=reps[mapping]
 wd=np.abs(w-w[representative]).sum(axis=1)
 # Edge-connected face components are sensitive to detached triangle islands.
 unseen=set(range(len(bm.faces)));components=[]
 while unseen:
  seed=unseen.pop();stack=[seed];faces=[]
  while stack:
   i=stack.pop();faces.append(i)
   for e in bm.faces[i].edges:
    for f in e.link_faces:
     if f.index in unseen:unseen.remove(f.index);stack.append(f.index)
  vi=sorted({v.index for i in faces for v in bm.faces[i].verts});p=np.array([bm.verts[i].co[:] for i in vi]);area=sum(bm.faces[i].calc_area() for i in faces)
  components.append({'face_indices':faces,'vertex_indices':vi,'vertices':len(vi),'faces':len(faces),'area_m2':area,'bounds_world_m':bounds(p),'boundary_edges':len({e for i in faces for e in bm.faces[i].edges if e.is_boundary})})
 components.sort(key=lambda c:c['area_m2'],reverse=True)
 main=components[0];main_v=[v.co.copy() for v in bm.verts];main_poly=[[v.index for v in bm.faces[i].verts] for i in main['face_indices']];bv=BVHTree.FromPolygons(main_v,main_poly,all_triangles=False)
 for c in components:
  c['dominant_weighted_bones']=sorted([(ws['bone_names'][i],float(x)) for i,x in enumerate(w[reps[c['vertex_indices']]].mean(axis=0)) if x>.01],key=lambda x:x[1],reverse=True)
  if c is not main:
   distances=[bv.find_nearest(bm.verts[i].co)[3] for i in c['vertex_indices']]
   c['nearest_main_distance_min_m']=min(distances);c['nearest_main_distance_max_m']=max(distances)
 duplicate_faces={};dupes=0
 for f in bm.faces:
  k=tuple(sorted(v.index for v in f.verts));dupes+=k in duplicate_faces;duplicate_faces[k]=True
 topo={'vertices':len(bm.verts),'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_excluding_boundary':sum(not e.is_manifold and not e.is_boundary for e in bm.edges),'loose_vertices':sum(not v.link_faces for v in bm.verts),'wire_edges':sum(e.is_wire for e in bm.edges),'degenerate_faces':sum(f.calc_area()<1e-12 for f in bm.faces),'duplicate_face_vertex_sets':dupes,'edge_connected_face_components':len(components)}
 clean=[]
 for c in components:
  clean.append({k:v for k,v in c.items() if k not in ('face_indices','vertex_indices')})
 edge=np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]);length=np.linalg.norm(a[edge[:,0]]-a[edge[:,1]],axis=1)
 data={'mesh':o.name,'vertices':len(a),'triangles':len(t),'bounds_world_m':bounds(a),'materials':[m.name if m else None for m in o.data.materials],'modifiers':[{'type':m.type,'object':getattr(getattr(m,'object',None),'name',None)} for m in o.modifiers],'morphs':len(o.data.shape_keys.key_blocks)-1 if o.data.shape_keys else 0,'uv_layers':[u.name for u in o.data.uv_layers],'weights':ws,'raw_topology':raw,'position_weld_copy_topology':topo,'components':clean,'coincident_split_weight_max_L1_difference':float(wd.max()),'coincident_split_weight_difference_over_005_count':int((wd>.05).sum()),'max_rest_triangle_edge_m':float(length.max())}
 bm.free();return data,{'positions':a,'triangles':t,'weights':w,'representative':representative,'edges':edge,'edge_lengths':length,'components':clean}
try:
 fresh();meshes,rigs=imp('body.fbx');assert len(meshes)==len(rigs)==1
 rig=rigs[0];rig.data.pose_position='REST';bpy.context.view_layer.update()
 R['assets']['body_fbx'],ref=audit(meshes[0],rig);bind={b.name:[row[:] for row in b.matrix_local] for b in rig.data.bones};hierarchy={b.name:b.parent.name if b.parent else None for b in rig.data.bones}
 fresh();bpy.ops.import_scene.gltf(filepath=str(SRC/'body.glb'));meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 R['glb_object_inventory']=[{'name':o.name,'type':o.type,'hide_render':o.hide_render,'vertices':len(o.data.vertices) if o.type=='MESH' else None,'armature_modifier':any(m.type=='ARMATURE' for m in o.modifiers) if o.type=='MESH' else False} for o in bpy.context.scene.objects]
 assert len(rigs)==1
 skin=[o for o in meshes if any(m.type=='ARMATURE' and m.object==rigs[0] for m in o.modifiers)];assert len(skin)==1
 rigs[0].data.pose_position='REST';bpy.context.view_layer.update();R['assets']['body_glb'],_=audit(skin[0],rigs[0])
 for name in ('idle','walk','run','jump'):
  fresh();meshes,rigs=imp(name+'.fbx',True);active=[r for r in rigs if r.animation_data and r.animation_data.action];assert len(active)==1
  rig=active[0];action=rig.animation_data.action
  if not meshes:
   clip=rig;slot=rig.animation_data.action_slot;meshes,rigs=imp('body.fbx');rig=rigs[0];rig.animation_data_create();rig.animation_data.action=action
   if slot:rig.animation_data.action_slot=slot
   bpy.data.objects.remove(clip,do_unlink=True)
  assert len(meshes)==1
  o=meshes[0];hier={b.name:b.parent.name if b.parent else None for b in rig.data.bones};assert hier==hierarchy
  binderror=max(abs(b.matrix_local[i][j]-bind[b.name][i][j]) for b in rig.data.bones for i in range(4) for j in range(4));assert binderror<1e-4
  rest=coords(o);assert rest.shape==ref['positions'].shape
  resterror=float(np.abs(rest-ref['positions']).max());assert resterror<1e-5
  tw=tris(o);assert np.array_equal(tw,ref['triangles']);w,ws=weights(o,rig);assert np.max(np.abs(w-ref['weights']))<1e-6
  first,last=action.frame_range;frames=list(range(math.ceil(first),math.floor(last)+1));samples=[];worst_gap=0.;worst_stretch=0.;extreme=0
  for frame in frames:
   bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();a=coords(o,True);assert np.isfinite(a).all()
   lengths=np.linalg.norm(a[ref['edges'][:,0]]-a[ref['edges'][:,1]],axis=1);ratios=lengths/np.maximum(ref['edge_lengths'],1e-8);flags=(lengths>.15)&(ratios>8);n=int(flags.sum());extreme+=n
   gap=np.linalg.norm(a-a[ref['representative']],axis=1);maxgap=float(gap.max());worst_gap=max(worst_gap,maxgap);worst_stretch=max(worst_stretch,float(ratios.max()))
   samples.append({'frame':frame,'bounds_world_m':bounds(a),'max_coincident_split_separation_m':maxgap,'split_separations_over_1mm':int((gap>.001).sum()),'max_triangle_edge_m':float(lengths.max()),'extreme_edge_count':n,'max_edge_stretch_ratio':float(ratios.max())})
  R['clips'][name]={'frame_range':[float(first),float(last)],'sample_count':len(samples),'sample_mode':'all imported integer frames, no render','bind_max_abs_error':binderror,'rest_max_position_error_m':resterror,'rest_triangle_indices_match_body':True,'weights_match_body':True,'max_coincident_split_separation_m':worst_gap,'max_edge_stretch_ratio':worst_stretch,'extreme_edge_observations':extreme,'samples':samples}
 R['source_after']=hashes();R['source_unchanged']=BEFORE==R['source_after'];assert R['source_unchanged']
 R['script_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();R['status']='SOURCE_SCREEN_COMPLETED_REVIEW_REQUIRED'
except Exception as e:
 R['status']='FAILED';R['error']=repr(e);R['source_after']=hashes();R['source_unchanged']=BEFORE==R['source_after'];OUT.write_text(json.dumps(R,indent=2)+'\n');raise
OUT.write_text(json.dumps(R,indent=2)+'\n');print('SOURCE_SHADOW_AUDIT',OUT)
