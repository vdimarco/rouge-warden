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
 text.body=title+'\nCPU diagnostic - not gameplay';text.size=scale*.016;label.rotation_euler=cam.rotation_euler;label.location=cam.matrix_world@Vector((-scale*(.46 if square else .36),scale*.45,-3));scene.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True);views.append({'file':name+'.png','label':title,'camera':list(loc),'target':list(target),'ortho_scale_m':scale,'dimensions':[scene.render.resolution_x,scene.render.resolution_y],'sha256':hashlib.sha256((O/(name+'.png')).read_bytes()).hexdigest()});print('CPU_STILL_READY',name,flush=True)
render('01-original-neutral-threequarter','ORIGINAL / retained GLB material',(-3.6,-3.6,1.1),(0,0,.93),2.12,True)
render('02-tripo-neutral-threequarter','TRIPO / original material / 1.82m preview',(-3.6,-3.6,1.1),(0,0,.93),2.12)
# Each hinge uses its own anatomical axis already verified by opposite-sign control.
for side,number,loc in [('l','03',(3.5,-3.5,1.25)),('r','04',(-3.5,-3.5,1.25))]:
 reset();case=next(c for c in audit['isolated_elbows'] if c['side']==side);b=ret.pose.bones['lowerarm_'+side];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion(Vector(case['local_hinge_axis']),math.radians(65));bpy.context.view_layer.update();render(number+'-elbow-'+side+'-forward','TRIPO / '+side.upper()+' elbow +65deg anatomical flex',loc,(0,-.08,1.25),1.28)
reset();hand=ret.pose.bones['hand_l'];center=ret.matrix_world@((hand.head+ret.pose.bones['middle_03_l'].tail)*.5);loc=center+Vector((1.4,-1.9,.35));render('05-hand-left-neutral','TRIPO / LEFT HAND / NEUTRAL',loc,center,.34,square=True)
def posed():
 ev=rm.evaluated_get(bpy.context.evaluated_depsgraph_get());return np.array([ev.matrix_world@v.co for v in ev.data.vertices])
neutral=posed();bp=ret.data.bones
# Palm normal: across index->pinky x along wrist->middle; pick direction toward medial body.
across=bp['pinky_01_l'].head_local-bp['index_01_l'].head_local;along=bp['middle_01_l'].head_local-bp['hand_l'].head_local;palm=across.cross(along).normalized()
if palm.dot(Vector((-1,0,0)))<0:palm=-palm
finger_recipe=[]
for digit in ['index','middle','ring','pinky','thumb']:
 for i in [1,2,3]:
  name=f'{digit}_{i:02}_l';b=ret.pose.bones[name];v=(b.bone.tail_local-b.bone.head_local).normalized();axis=v.cross(palm).normalized();local=(b.bone.matrix_local.to_3x3().inverted()@axis).normalized();degrees=([25,35,20] if digit!='thumb' else [10,15,10])[i-1];b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion(local,math.radians(degrees));finger_recipe.append({'bone':name,'angle_deg':degrees,'local_axis':list(local)})
bpy.context.view_layer.update();flexed=posed();delta=np.linalg.norm(flexed-neutral,axis=1);render('06-hand-left-flex','TRIPO / LEFT FINGERS / MODEST FLEX',loc,center,.34,square=True)
current={p:{'bytes':Path(p).stat().st_size,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()} for p in before};assert current==before
R={'device':'CPU','threads':4,'samples':16,'gpu_denoising':False,'renders':views,'duration_s':time.monotonic()-started,'input_sources_unchanged':True,'normalization_preview_only':{'matrix':[list(row) for row in root.matrix_world],'scale':fit['returned_to_source_scale'],'returned_original_height_m':audit['assets']['returned.fbx']['height_m'],'target_original_height_m':audit['assets']['original.glb']['height_m'],'not_exported':True},'material_diagnostic':{'returned_bad_material_observation':str(P/'FBX-payloads.json'),'returned_albedo_wired_to_normal_confirmed':True,'preview_uses_exact_original_GLB_material_object':rm.data.materials[0]==om.data.materials[0],'original_packed_images':audit['assets']['original.glb']['images'],'no_source_bitmap_changed':True,'provider_FBX_not_rewritten':True},'corner_normals_comparison':normal,'finger_recipe':finger_recipe,'finger_flex_measurements':{'finite':bool(np.isfinite(flexed).all()),'vertices_moved_over_0_1mm':int((delta>.0001).sum()),'max_vertex_displacement_m':float(delta.max()),'p99_vertex_displacement_m':float(np.percentile(delta,99))},'limitations':['Preview material intentionally restores missing original GLB normal and metallic/roughness maps; raw FBX is materially incorrect.','Images are isolated static deformation diagnostics, not original/current locomotion or runtime acceptance.','No prop, grasp fit, collision or native import evaluated.','Original geometry including collar/sleeve source defects remains unchanged.','Finger axis approximation is a modest diagnostic flex; not an authored production hand pose.']}
(O/'Visual.json').write_text(json.dumps(R,indent=2)+'\n');print('SIX_CPU_VIEWS_COMPLETE',flush=True)
