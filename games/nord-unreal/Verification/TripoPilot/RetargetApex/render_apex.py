"""CPU-only six-still rig diagnostic; original provider FBX remains untouched."""
import bpy,numpy as np,math,json,hashlib,time
from pathlib import Path
from mathutils import Vector,Quaternion,Matrix
O=Path(__file__).parent;P=O.parent;started=time.monotonic();before=json.loads((P/'inputs.json').read_text());audit=json.loads((P/'Audit.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
def imported(path):
 old=set(bpy.data.objects)
 if path.suffix=='.glb':bpy.ops.import_scene.gltf(filepath=str(path))
 else:bpy.ops.import_scene.fbx(filepath=str(path),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
 objs=[o for o in bpy.data.objects if o not in old];rig=next(o for o in objs if o.type=='ARMATURE');mesh=next(o for o in objs if o.type=='MESH' and o.find_armature()==rig);rig.animation_data_clear();rig.data.pose_position='POSE'
 for b in rig.pose.bones:b.matrix_basis.identity()
 for ob in objs:
  if ob.type=='MESH' and ob!=mesh:ob.hide_render=True
 bpy.context.view_layer.update();return rig,mesh,objs
def corners(ob):
 m=ob.data;m.calc_loop_triangles();loops=np.array([q.loops[:] for q in m.loop_triangles],np.int32);uv=np.empty((len(m.loops),2),np.float64);m.uv_layers[0].data.foreach_get('uv',uv.ravel());n=np.empty((len(m.corner_normals),3),np.float64);m.corner_normals.foreach_get('vector',n.ravel());M=np.array(ob.matrix_world.inverted().transposed().to_3x3());n=n@M.T;n/=np.maximum(1e-12,np.linalg.norm(n,axis=1))[:,None];q=np.rint(uv[loops]/1e-6).astype(np.int64);order=np.lexsort((q[:,:,1],q[:,:,0]),axis=1);q=np.take_along_axis(q,order[:,:,None],axis=1);n=np.take_along_axis(n[loops],order[:,:,None],axis=1);key=np.ascontiguousarray(q.reshape(-1,6)).view(np.dtype((np.void,48))).ravel();ix=np.argsort(key);return key[ix],n[ix]
orig,om,oo=imported(P/'input/original.glb');sk,sn=corners(om);originalmat=om.data.materials[0]
ret,rm,ro=imported(P/'input/returned.fbx');dk,dn=corners(rm);assert np.array_equal(sk,dk)
angles=np.degrees(np.arccos(np.clip(np.sum(sn*dn,axis=2),-1,1)))
normal={'matched_corner_samples':int(angles.size),'max_angle_deg':float(angles.max()),'mean_angle_deg':float(angles.mean()),'p99_angle_deg':float(np.percentile(angles,99)),'over_1deg':int((angles>1).sum()),'over_10deg':int((angles>10).sum()),'method':'Normals in world/rest space, corresponding sorted quantized UV triangle corners at1e-6. Similarity orientation differs <1e-5deg; no geometry normal recompute performed.'}
# Normalize a preview-only parent, leaving all imported mesh/rig data and provider bytes unchanged.
fit=audit['comparison']['uv_correspondence_similarity_fit'];root=bpy.data.objects.new('PreviewOnlyNormalization',None);bpy.context.scene.collection.objects.link(root)
for ob in ro:
 if ob.parent not in ro:
  mat=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=mat
rot=np.array(fit['rotation_row_vector']).T;M=np.eye(4);M[:3,:3]=rot*fit['returned_to_source_scale'];M[:3,3]=fit['offset_m'];root.matrix_world=Matrix(M.tolist())
# Original GLB material object and its unchanged packed images are explicitly reused on returned UVMap.
badmat=rm.data.materials[0];rm.data.materials.clear();rm.data.materials.append(originalmat)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.world=bpy.data.worlds.new('CPUStudioWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.12,.14,.18,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001));floor=bpy.context.object;fm=bpy.data.materials.new('StudioFloor');fm.diffuse_color=(.18,.19,.21,1);floor.data.materials.append(fm)
for loc,energy,size in [((-3,-4,5),450,4),((3,-1,3),230,3),((0,3,4),350,3)]:
 ld=bpy.data.lights.new('CPUStudio','AREA');ld.energy=energy;ld.shape='DISK';ld.size=size;lo=bpy.data.objects.new('CPUStudio',ld);scene.collection.objects.link(lo);lo.location=loc;lo.rotation_euler=(Vector((0,0,1))-lo.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('CPUCamera');cam=bpy.data.objects.new('CPUCamera',cd);scene.collection.objects.link(cam);scene.camera=cam;cd.type='ORTHO'
text=bpy.data.curves.new('DiagnosticLabel','FONT');label=bpy.data.objects.new('DiagnosticLabel',text);scene.collection.objects.link(label);tm=bpy.data.materials.new('Label');tm.use_nodes=True;nt=tm.node_tree;nt.nodes.clear();emit=nt.nodes.new('ShaderNodeEmission');emit.inputs['Color'].default_value=(.85,.9,.95,1);out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(emit.outputs[0],out.inputs[0]);text.materials.append(tm)
views=[]
def reset():
 for b in ret.pose.bones:b.matrix_basis.identity()
 bpy.context.view_layer.update()
def show(original=False):
 om.hide_render=not original;rm.hide_render=original

def render(name,title,loc,target,scale,original=False,square=False):
 show(original);cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=scale;scene.render.resolution_x=720;scene.render.resolution_y=720 if square else 900
 bpy.context.view_layer.update();text.body=title+'\nCPU diagnostic - not gameplay';text.size=scale*.016;label.rotation_euler=cam.rotation_euler;label.location=cam.matrix_world@Vector((-scale*(.46 if square else .36),scale*.45,-3));scene.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True);views.append({'file':name+'.png','label':title,'camera':list(loc),'target':list(target),'ortho_scale_m':scale,'dimensions':[scene.render.resolution_x,scene.render.resolution_y],'sha256':hashlib.sha256((O/(name+'.png')).read_bytes()).hexdigest()});print('CPU_STILL_READY',name,flush=True)

# NEW one-still task: assign the actual fresh imported action/slot to own matching61-bone body.
source_clip=O/'retargeted-jump.fbx';source_report=O/'Retarget.json';retarget_report=json.loads(source_report.read_text());assert retarget_report['passed']
assert hashlib.sha256(source_clip.read_bytes()).hexdigest()==retarget_report['output']['sha256']
before_objects=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(source_clip),use_anim=True,automatic_bone_orientation=False,use_image_search=False)
new_objects=[o for o in bpy.data.objects if o not in before_objects];clip_rigs=[o for o in new_objects if o.type=='ARMATURE'];assert len(clip_rigs)==1 and not any(o.type=='MESH' for o in new_objects)
clip=clip_rigs[0];hier=lambda rig:{b.name:b.parent.name if b.parent else None for b in rig.data.bones}
assert len(ret.data.bones)==len(clip.data.bones)==61 and hier(ret)==hier(clip)==retarget_report['target_hierarchy']
rest_error=max(abs(ret.data.bones[b.name].matrix_local[i][j]-b.matrix_local[i][j]) for b in clip.data.bones for i in range(4) for j in range(4));assert rest_error<1e-5,rest_error
assert clip.animation_data and clip.animation_data.action;action=clip.animation_data.action;slot=clip.animation_data.action_slot;assert slot is not None
assert list(action.frame_range)==[2.,38.],list(action.frame_range)
scene.render.fps=30;scene.frame_set(16);bpy.context.view_layer.update();expected={b.name:b.matrix.copy() for b in clip.pose.bones}
reset();ret.animation_data_create();ret.animation_data.action=action;ret.animation_data.action_slot=slot
bpy.data.objects.remove(clip,do_unlink=True);scene.frame_set(16);bpy.context.view_layer.update()
def pose_error():return max(abs(b.matrix[i][j]-expected[b.name][i][j]) for b in ret.pose.bones for i in range(4) for j in range(4))
error_before=pose_error();assert error_before<1e-5,error_before
changed=[b.name for b in ret.pose.bones if b.rotation_quaternion.rotation_difference(Quaternion()).angle>.01];assert 'lowerarm_l' in changed and 'lowerarm_r' in changed
render('apex-threequarter','TRIPO / COMPACT JUMP / FRAME16',(-3.6,-3.6,1.1),(0,0,.93),2.12)
bpy.context.view_layer.update();error_after=pose_error();assert error_after<1e-5,error_after
readback={'scope':'One actual retargeted61-bone clip apex CPU still; no prop/grasp, motion or native acceptance','passed':True,'CPU':{'engine':'Cycles','device':scene.cycles.device,'threads':scene.render.threads,'samples':scene.cycles.samples,'gpu_denoising':False},'input_clip':{'source_path':'/tmp/nord-tripo-compact-retarget-20261017T2040Z/retargeted-jump.fbx','sha256':hashlib.sha256(source_clip.read_bytes()).hexdigest()},'source_report_sha256':hashlib.sha256(source_report.read_bytes()).hexdigest(),'body_fbx_sha256':before[next(p for p in before if p.endswith('Tripo-rig.fbx'))]['sha256'],'original_preview_recipe_sha256':hashlib.sha256((P/'Visual/preview.py').read_bytes()).hexdigest(),'own_rig_checks':{'bones':61,'hierarchy_matches':True,'bind_matrix_max_abs_error':rest_error,'actual_action_name':action.name,'actual_action_slot_identifier':slot.identifier,'actual_frame_range':list(action.frame_range),'actual_evaluated_frame':scene.frame_current,'fps':scene.render.fps,'seconds_from_first':(scene.frame_current-action.frame_range[0])/scene.render.fps,'pose_matrices_equal_imported_clip_before_render_max_error':error_before,'pose_matrices_equal_imported_clip_after_render_max_error':error_after,'materially_rotated_bones':changed},'evaluated_pose61':{b.name:{'matrix_basis':[list(row) for row in b.matrix_basis],'component_matrix':[list(row) for row in b.matrix]} for b in ret.pose.bones},'normalization_preview_only':{'matrix':[list(row) for row in root.matrix_world],'scale':fit['returned_to_source_scale']},'material_preview_only':{'exact_original_GLB_material_reused':rm.data.materials[0]==om.data.materials[0],'packed_images':audit['assets']['original.glb']['images'],'raw_provider_material_problem_preserved':True,'corner_normals_not_fixed':True},'images':views,'limits':['Static apex only; no video/locomotion/native game/collision proof.','Finger joints retain neutral bind-local parent-follow perretarget; no prop/grasp evaluation.','ProviderFBXcornershadingchangespersist; previeworiginalmapsreusedexplicitly.']}
current={p:{'bytes':Path(p).stat().st_size,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in before};assert current==before;assert hashlib.sha256(source_clip.read_bytes()).hexdigest()==retarget_report['output']['sha256'];readback['retained_source23_and_providerFBX_unchanged']=True
(O/'Readback.json').write_text(json.dumps(readback,indent=2)+'\n');print('ONE_APEX_CPU_STILL_COMPLETE',str(O/'Readback.json'),flush=True)
