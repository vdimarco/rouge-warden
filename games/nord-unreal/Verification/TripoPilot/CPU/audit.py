"""Disposable CPU-only Tripo return comparison; no rendering/export/source writes."""
import bpy,bmesh,numpy as np,json,hashlib,math,traceback
from pathlib import Path
from mathutils import Vector,Quaternion
from datetime import datetime,timezone
O=Path(__file__).parent
R={'scope':'read-only CPU measurements on temporary copies; no render/native acceptance','created_utc':datetime.now(timezone.utc).isoformat(),'blender':bpy.app.version_string,'threads':4,'render_performed':False,'assets':{},'comparison':{}}
def world_points(ob,evaluated=False):
 if evaluated:ob=ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
 a=np.empty((len(ob.data.vertices),3),np.float64);ob.data.vertices.foreach_get('co',a.ravel());m=np.array(ob.matrix_world);return a@m[:3,:3].T+m[:3,3]
def clean():bpy.ops.wm.read_factory_settings(use_empty=True)
def load(name):
 clean()
 if name.endswith('glb'):bpy.ops.import_scene.gltf(filepath=str(O/'input'/name))
 else:bpy.ops.import_scene.fbx(filepath=str(O/'input'/name),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
 rigs=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'];assert len(rigs)==1
 rig=rigs[0];rig.animation_data_clear();rig.data.pose_position='REST'
 for b in rig.pose.bones:b.matrix_basis.identity()
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)];assert len(meshes)==1
 bpy.context.view_layer.update();return rig,meshes[0]
def topo(ob):
 bm=bmesh.new();bm.from_mesh(ob.data);bm.transform(ob.matrix_world)
 def metrics():return {'vertices':len(bm.verts),'edges':len(bm.edges),'faces':len(bm.faces),'boundary_edges':sum(e.is_boundary for e in bm.edges),'nonmanifold_excluding_boundary':sum(not e.is_manifold and not e.is_boundary for e in bm.edges),'wire_edges':sum(e.is_wire for e in bm.edges),'loose_vertices':sum(not v.link_faces for v in bm.verts),'degenerate_faces':sum(f.calc_area()<1e-12 for f in bm.faces)}
 raw=metrics();bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);weld=metrics();bm.free();return {'raw':raw,'position_weld_1um_copy':weld}
def material(ob):
 out=[];images={}
 for m in ob.data.materials:
  nodes=[]
  if m and m.use_nodes:
   for n in m.node_tree.nodes:
    d={'name':n.name,'type':n.type}
    if n.type=='TEX_IMAGE' and n.image:
     i=n.image;d.update(image=i.name,color_space=i.colorspace_settings.name)
     if i.name not in images:
      a=np.empty(len(i.pixels),np.float32);i.pixels.foreach_get(a);packed=i.packed_file.data if i.packed_file else None
      images[i.name]={'size':list(i.size),'channels':i.channels,'color_space':i.colorspace_settings.name,'packed_bytes':len(packed) if packed else None,'packed_sha256':hashlib.sha256(packed).hexdigest() if packed else None,'pixel_sha256_float32':hashlib.sha256(a.tobytes()).hexdigest(),'pixel_sha256_8bit':hashlib.sha256(np.rint(np.clip(a,0,1)*255).astype(np.uint8).tobytes()).hexdigest(),'pixel_min':float(a.min()),'pixel_max':float(a.max())}
    if n.type=='BSDF_PRINCIPLED':
     d['input_defaults']={s.name:list(s.default_value) if hasattr(s.default_value,'__len__') else s.default_value for s in n.inputs if hasattr(s,'default_value')}
    if n.type=='NORMAL_MAP':d['strength']=n.inputs['Strength'].default_value
    nodes.append(d)
   links=[{'from_node':l.from_node.name,'from_socket':l.from_socket.name,'to_node':l.to_node.name,'to_socket':l.to_socket.name} for l in m.node_tree.links]
  else:links=[]
  out.append({'name':m.name if m else None,'backface_culling':m.use_backface_culling if m else None,'nodes':nodes,'links':links})
 return out,images
A={}
for name in ['original.glb','returned.fbx']:
 rig,ob=load(name);p=world_points(ob);ob.data.calc_loop_triangles();t=np.array([q.vertices[:] for q in ob.data.loop_triangles],np.int32);loops=np.array([q.loops[:] for q in ob.data.loop_triangles],np.int32)
 uv=np.empty((len(ob.data.loops),2),np.float64);ob.data.uv_layers[0].data.foreach_get('uv',uv.ravel());tuv=uv[loops]
 names=[b.name for b in rig.data.bones];ix={n:i for i,n in enumerate(names)};gn={g.index:g.name for g in ob.vertex_groups};w=np.zeros((len(p),len(names)),np.float64);invalid=[]
 for v in ob.data.vertices:
  for g in v.groups:
   if gn.get(g.group) in ix:w[v.index,ix[gn[g.group]]]+=g.weight
   elif g.weight>1e-8:invalid.append([v.index,gn.get(g.group),g.weight])
 sums=w.sum(axis=1);mat,images=material(ob)
 bone_info=[]
 for b in rig.data.bones:
  a=w[:,ix[b.name]];bone_info.append({'name':b.name,'parent':b.parent.name if b.parent else None,'deform':b.use_deform,'head_world_m':list(rig.matrix_world@b.head_local),'tail_world_m':list(rig.matrix_world@b.tail_local),'matrix_local':[list(row) for row in b.matrix_local],'positive_weight_vertices':int((a>1e-8).sum()),'weight_sum':float(a.sum()),'max_weight':float(a.max()),'dominant_vertices':int((np.argmax(w,axis=1)==ix[b.name]).sum()) if a.max()>0 else 0})
 info={'mesh':ob.name,'vertices':len(p),'triangles':len(t),'uv_layers':[u.name for u in ob.data.uv_layers],'uv_bounds':[uv.min(axis=0).tolist(),uv.max(axis=0).tolist()],'bounds_world_m':[p.min(axis=0).tolist(),p.max(axis=0).tolist()],'height_m':float(np.ptp(p[:,2])),'mesh_matrix_world':[list(row) for row in ob.matrix_world],'rig_matrix_world':[list(row) for row in rig.matrix_world],'finite_geometry':bool(np.isfinite(p).all()),'bone_count':len(names),'bones':bone_info,'morph_targets':len(ob.data.shape_keys.key_blocks)-1 if ob.data.shape_keys else 0,'weights':{'weighted_bones':int((w.sum(axis=0)>0).sum()),'weight_sum_min':float(sums.min()),'weight_sum_max':float(sums.max()),'unweighted_vertices':int((sums<1e-6).sum()),'weight_sum_abs_error_max':float(np.abs(sums-1).max()),'weight_sums_outside_1e_4':int((np.abs(sums-1)>1e-4).sum()),'negative':int((w<0).sum()),'nonfinite':int((~np.isfinite(w)).sum()),'max_influences':int((w>1e-8).sum(axis=1).max()),'invalid_group_assignments':invalid},'topology':topo(ob),'materials':mat,'images':images}
 A[name]={'positions':p,'triangles':t,'tuv':tuv}
 R['assets'][name]=info
 (O/'audit.partial.json').write_text(json.dumps(R,indent=2)+'\n')
 if name=='returned.fbx':
  # Anatomical forward derives from both ankle->toe directions, projected off up/side.
  bp=rig.data.bones;up=(bp['head'].head_local-bp['pelvis'].head_local).normalized();side=(bp['thigh_l'].head_local-bp['thigh_r'].head_local).normalized();forward=(bp['ball_l'].head_local-bp['foot_l'].head_local+bp['ball_r'].head_local-bp['foot_r'].head_local)
  forward=(forward-up*forward.dot(up)-side*forward.dot(side)).normalized()
  R['anatomical_axes']={'rig_space_up':list(up),'rig_space_left':list(side),'rig_space_forward':list(forward),'derivation':'forward: mean foot-to-ball vector projected off pelvis-to-head up and right-to-left thigh side; no old bone names/axes reused'}
  rig.data.pose_position='POSE';rig.animation_data_clear();bpy.context.view_layer.update();tests=[]
  for suffix in ['l','r']:
   upper=rig.pose.bones['upperarm_'+suffix];lower=rig.pose.bones['lowerarm_'+suffix];hand=rig.pose.bones['hand_'+suffix]
   neutral_lower=(hand.head-lower.head).normalized();neutral_upper=(lower.head-upper.head).normalized()
   axis=neutral_lower.cross(forward).normalized();local=(lower.bone.matrix_local.to_3x3().inverted()@axis).normalized();neutral_proj=(hand.head-lower.head).dot(forward)
   samples=[]
   for angle in [0,35,-35,70]:
    for b in rig.pose.bones:b.matrix_basis.identity()
    lower.rotation_mode='QUATERNION';lower.rotation_quaternion=Quaternion(local,math.radians(angle));bpy.context.view_layer.update()
    lo=(hand.head-lower.head).normalized();u=(lower.head-upper.head).normalized();delta=math.degrees(math.atan2(axis.dot(neutral_lower.cross(lo)),neutral_lower.dot(lo)))
    pm=world_points(ob,True);samples.append({'angle_deg_about_derived_forward_axis':angle,'signed_lowerarm_delta_deg':delta,'wrist_forward_from_elbow_rig_units':(hand.head-lower.head).dot(forward),'forward_projection_gain_rig_units':(hand.head-lower.head).dot(forward)-neutral_proj,'elbow_world_m':list(rig.matrix_world@lower.head),'wrist_world_m':list(rig.matrix_world@hand.head),'finite_skinned_geometry':bool(np.isfinite(pm).all()),'max_vertex_displacement_m':float(np.linalg.norm(pm-p,axis=1).max())})
   for b in rig.pose.bones:b.matrix_basis.identity()
   bpy.context.view_layer.update();tests.append({'side':suffix,'local_hinge_axis':list(local),'rig_space_hinge_axis':list(axis),'samples':samples,'positive35_moves_wrist_forward':samples[1]['forward_projection_gain_rig_units']>0,'negative_control35_moves_wrist_backward':samples[2]['forward_projection_gain_rig_units']<0})
  R['isolated_elbows']=tests
  # Finger controllers need meaningful skin influence, not merely named bones.
  finger=[]
  for b in bone_info:
   if any(b['name'].startswith(s+'_') for s in ['thumb','index','middle','ring','pinky']):finger.append({k:b[k] for k in ['name','parent','positive_weight_vertices','dominant_vertices','weight_sum','max_weight']})
  R['finger_chain_weights']=finger
  R['finger_chain_summary']={'named_finger_bones':len(finger),'weighted_finger_bones':sum(b['positive_weight_vertices']>0 for b in finger),'all_10_three_joint_chains_parented_to_own_hand':all(bp[f'{digit}_01_{s}'].parent.name=='hand_'+s and bp[f'{digit}_02_{s}'].parent.name==f'{digit}_01_{s}' and bp[f'{digit}_03_{s}'].parent.name==f'{digit}_02_{s}' for digit in ['thumb','index','middle','ring','pinky'] for s in ['l','r'])}
# UV triangle multiset comparison independent of split vertex reindexing.
def uv_keys(a,precision=1e-5):
 q=np.rint(a/precision).astype(np.int64);order=np.lexsort((q[:,:,1],q[:,:,0]),axis=1);q=np.take_along_axis(q,order[:,:,None],axis=1);porder=order
 flat=np.ascontiguousarray(q.reshape(-1,6));view=flat.view(np.dtype((np.void,flat.dtype.itemsize*6))).ravel();idx=np.argsort(view);return flat,view,idx,porder
s=A['original.glb'];d=A['returned.fbx'];c=R['comparison']
c['same_triangle_count']=len(s['triangles'])==len(d['triangles']);c['triangle_uv_multisets']={}
for eps in [1e-5,1e-6,1e-4]:
 sf,sv,si,so=uv_keys(s['tuv'],eps);df,dv,di,do=uv_keys(d['tuv'],eps)
 c['triangle_uv_multisets'][str(eps)]={'equal':bool(np.array_equal(sv[si],dv[di])),'source_unique_keys':len(np.unique(sv)),'returned_unique_keys':len(np.unique(dv)),'shared_unique_keys':len(np.intersect1d(sv,dv))}
 if eps==1e-5:
  keys,sc=np.unique(sv,return_counts=True);dk,dc=np.unique(dv,return_counts=True);unique=np.intersect1d(keys[sc==1],dk[dc==1]);isrc=np.searchsorted(sv[si],unique);iret=np.searchsorted(dv[di],unique)
  sp=np.take_along_axis(s['positions'][s['triangles']],so[:,:,None],axis=1)[si[isrc]].reshape(-1,3);dp=np.take_along_axis(d['positions'][d['triangles']],do[:,:,None],axis=1)[di[iret]].reshape(-1,3)
  sm=sp.mean(axis=0);dm=dp.mean(axis=0);X=dp-dm;Y=sp-sm;u,ss,vt=np.linalg.svd(X.T@Y);rot=u@vt
  if np.linalg.det(rot)<0:u[:,-1]*=-1;rot=u@vt
  scale=float(np.sum((X@rot)*Y)/np.sum(X*X));offset=sm-dm@rot*scale;fit=dp@rot*scale+offset;err=np.linalg.norm(fit-sp,axis=1)
  c['uv_correspondence_similarity_fit']={'unique_corresponding_triangles':len(unique),'corner_samples':len(err),'returned_to_source_scale':scale,'rotation_row_vector':[list(row) for row in rot],'offset_m':offset.tolist(),'residual_max_m':float(err.max()),'residual_mean_m':float(err.mean()),'residual_p99_m':float(np.percentile(err,99)),'residual_over_1mm':int((err>.001).sum()),'scale_normalized_rig_changes_are_not_topology_changes':True}
  np.savez_compressed(O/'uv-correspondence.npz',source=sp,returned=dp,source_fit=fit,residual=err)
# Image matching only of actual decoded data; shader connections separately retained.
c['image_payload_matches']=[]
for sn,im in R['assets']['original.glb']['images'].items():
 matches=[]
 for dn,di in R['assets']['returned.fbx']['images'].items():
  matches.append({'returned_image':dn,'packed_bytes_identical':im['packed_sha256']==di['packed_sha256'],'decoded_float_pixels_identical':im['pixel_sha256_float32']==di['pixel_sha256_float32'],'decoded_8bit_pixels_identical':im['pixel_sha256_8bit']==di['pixel_sha256_8bit']})
 c['image_payload_matches'].append({'source_image':sn,'matches':matches})
inputs=json.loads((O/'inputs.json').read_text());after={p:{'bytes':Path(p).stat().st_size,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in inputs};R['retained_inputs_unchanged']=after==inputs;assert R['retained_inputs_unchanged']
R['limitations']=['No image or motion render; anatomical elbow math is not visual shoulder/hand acceptance.','A new rig and reference hierarchy require new retargeting/mapping; existing24-bone clips/BlendSpaces cannot be assigned unchanged.','Equal UV triangle sets and similar geometry do not prove preserved custom normals/tangents or native shading.','Material transfer/image loss is reported as returned-FBX state; no textures or materials are reconstructed.','Forward reference uses foot-to-ball anatomical direction in this returned rig, not arbitrary shared local Euler signs.']
(O/'Audit.json').write_text(json.dumps(R,indent=2)+'\n');print('AUDIT_READY',str(O/'Audit.json'))
