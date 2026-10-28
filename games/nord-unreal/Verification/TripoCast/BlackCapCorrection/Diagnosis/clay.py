"""Two diagnostic clay stills of unchanged actual source geometry; scratch shader only."""
from pathlib import Path
import bpy,json,hashlib,numpy as np
from mathutils import Vector
O=Path(__file__).resolve().parent
R=Path('/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal')
review=json.loads((R/'Verification/TripoCast/BodyReview/BlackCap/Review.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(O/'body.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data_clear();rig.data.pose_position='REST'
for b in rig.pose.bones:b.matrix_basis.identity()
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.find_armature()==rig)
for o in bpy.data.objects:
 if o.type=='MESH' and o!=mesh:o.hide_render=True
bpy.context.view_layer.update()
def geom():
 ob=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get());p=np.array([ob.matrix_world@v.co for v in ob.data.vertices],np.float64);ob.data.calc_loop_triangles();t=np.array([f.vertices[:] for f in ob.data.loop_triangles],np.int32);return hashlib.sha256(p.tobytes()+t.tobytes()).hexdigest()
assert geom()==review['body']['evaluated_geometry_sha256']
clay=bpy.data.materials.new('DiagnosticOnlyClay');clay.use_nodes=True;shader=clay.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.45,.45,.45,1);shader.inputs['Roughness'].default_value=.7;mesh.data.materials.clear();mesh.data.materials.append(clay)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=False
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('DiagnosticWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.08,.08,.08,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
for loc,energy,size in [((-2,-3,3),180,2),((2,-1,2),90,1),((0,2,3),100,1)]:
 light=bpy.data.lights.new('CPUStudio','AREA');light.energy=energy;light.size=size;obj=bpy.data.objects.new('CPUStudio',light);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((0,0,1.65))-obj.location).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('CPUCamera',bpy.data.cameras.new('CPUCamera'));scene.collection.objects.link(cam);scene.camera=cam;cam.data.type='ORTHO';views=[]
for v in review['views']:
 if v['file'] not in ['face-front.png','face-threequarter.png']:continue
 cam.location=v['camera'];cam.rotation_euler=(Vector(v['target'])-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=v['ortho_scale_m'];bpy.context.view_layer.update();file='clay-'+v['file'];scene.render.filepath=str(O/file);bpy.ops.render.render(write_still=True);assert geom()==review['body']['evaluated_geometry_sha256'];views.append({'file':file,'sha256':hashlib.sha256((O/file).read_bytes()).hexdigest(),'camera':v['camera'],'target':v['target'],'scale':v['ortho_scale_m']})
assert hashlib.sha256((O/'body.glb').read_bytes()).hexdigest()==review['source']['sha256']
(O/'Clay.json').write_text(json.dumps({'passed':True,'scope':'Diagnostic gray shader on unchanged source geometry; not original material or art acceptance','device':'CPU','threads':4,'samples':16,'denoising':False,'dimensions':[512,640],'geometry_sha256':geom(),'views':views},indent=2)+'\n')
