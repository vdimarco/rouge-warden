import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector
P=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(P/'body.fbx'),use_anim=False,automatic_bone_orientation=False,use_image_search=False)
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
mesh=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
rest=[mesh.matrix_world@v.co for v in mesh.data.vertices]
bones={b.name:{'head_m':list(rig.matrix_world@b.head_local),'tail_m':list(rig.matrix_world@b.tail_local),'parent':b.parent.name if b.parent else None} for b in rig.data.bones}
groups={g.index:g.name for g in mesh.vertex_groups}
weights=[{groups[g.group]:g.weight for g in v.groups} for v in mesh.data.vertices]
image=bpy.data.images.load(str(P/'base_color.png'),check_existing=False)
image.colorspace_settings.name='Non-Color'
w,h=image.size;pix=list(image.pixels);uv=mesh.data.uv_layers[0].data
colors={}
for poly in mesh.data.polygons:
 for li in poly.loop_indices:
  vi=mesh.data.loops[li].vertex_index
  if vi not in colors:
   u,v=uv[li].uv;x=min(w-1,max(0,int(u*w)));y=min(h-1,max(0,int(v*h)));k=(y*w+x)*4;colors[vi]=pix[k:k+3]
regions={};regionids={}
for side in ['Left','Right']:
 S=Vector(bones[side+'Arm']['head_m']);F=Vector(bones[side+'ForeArm']['head_m']);axis=(F-S).normalized();ids=[]
 for i,v in enumerate(rest):
  d=v-S;t=d.dot(axis);rad=(d-axis*t).length
  if -.04<t<.12 and rad<.09:ids.append(i)
 regionids[side]=set(ids);out={}
 for label,selected in [('all',ids),('dark_garment',[i for i in ids if max(colors[i])<.22]),('skin_colored',[i for i in ids if colors[i][0]>.25 and colors[i][0]>colors[i][1]*1.12])]:
  avg={name:sum(weights[i].get(name,0) for i in selected)/max(1,len(selected)) for name in groups.values()}
  out[label]={'vertices':len(selected),'mean_weights':sorted(avg.items(),key=lambda x:-x[1])[:8],'sum_weight_max_error':max([abs(sum(weights[i].values())-1) for i in selected] or [0]),'forearm_weight_over_0_1':sum(weights[i].get(side+'ForeArm',0)>.1 for i in selected),'hand_weight_over_0_05':sum(weights[i].get(side+'Hand',0)>.05 for i in selected),'clavicle_zero':sum(weights[i].get(side+'Shoulder',0)<.0001 for i in selected)}
 regions[side]=out
existing=set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(P/'jump.fbx'),use_anim=True,automatic_bone_orientation=False,use_image_search=False)
clip=next(o for o in bpy.data.objects if o not in existing and o.type=='ARMATURE')
rig.animation_data_create();rig.animation_data.action=clip.animation_data.action
rig.animation_data.action_slot=clip.animation_data.action_slot
first,last=clip.animation_data.action.frame_range;frame=first+.43254*30
bpy.context.scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(deps);posed=[ev.matrix_world@v.co for v in ev.data.vertices]
assert len(posed)==len(rest)
for side,ids in regionids.items():
 edges=[]
 for edge in mesh.data.edges:
  a,b=edge.vertices
  if a in ids and b in ids:
   old=(rest[a]-rest[b]).length;new=(posed[a]-posed[b]).length
   if old>.002:edges.append({'v':[a,b],'rest_m':old,'posed_m':new,'ratio':new/old,'a_weights':weights[a],'b_weights':weights[b],'a_color':colors[a],'b_color':colors[b]})
 edges.sort(key=lambda e:e['ratio']);regions[side]['edge_deformation']={'sample_edges_over_2mm':len(edges),'ratio_p50':edges[len(edges)//2]['ratio'],'ratio_p95':edges[int(len(edges)*.95)]['ratio'],'max_stretch':edges[-1],'worst10':edges[-10:]}
regions['pose']={'clip_seconds':.43254,'source_frame':frame,'imported_frame_range':[first,last],'bone_world_heads_m':{n:list(rig.matrix_world@rig.pose.bones[n].head) for n in ['LeftShoulder','LeftArm','LeftForeArm','LeftHand','RightShoulder','RightArm','RightForeArm','RightHand']}}

from mathutils import Quaternion,Matrix
import math,time
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.cycles.use_denoising=True
if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False
scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.resolution_x=720;scene.render.resolution_y=920;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
# Actual raw atlas material; no filter or geometry changes.
mat=bpy.data.materials.new('RawPilotPBR');mat.use_nodes=True;n=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=n.get('Principled BSDF')
for filename,target in [('base_color.png','Base Color'),('roughness.png','Roughness'),('metallic.png','Metallic')]:
 tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(P/filename),check_existing=False);tex.image.colorspace_settings.name='sRGB' if filename=='base_color.png' else 'Non-Color';links.new(tex.outputs['Color'],bsdf.inputs[target])
tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(P/'normal.png'),check_existing=False);tex.image.colorspace_settings.name='Non-Color';normal=n.new('ShaderNodeNormalMap');links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
mesh.data.materials.clear();mesh.data.materials.append(mat)
# Retained OBJ geometry in metres, with its original material-group boundaries.
verts=[];faces=[];material_names=[];face_mats=[];current=''
for line in (P/'Plunger.obj').read_text().splitlines():
 parts=line.split()
 if not parts:continue
 if parts[0]=='v':verts.append(tuple(float(x)*.01 for x in parts[1:4]))
 elif parts[0]=='usemtl':
  current=parts[1]
  if current not in material_names:material_names.append(current)
 elif parts[0]=='f':faces.append(tuple(int(x.split('/')[0])-1 for x in parts[1:]));face_mats.append(current)
pm=bpy.data.meshes.new('RetainedProp');pm.from_pydata(verts,[],faces);pm.update();prop=bpy.data.objects.new('GripProxy',pm);scene.collection.objects.link(prop)
for name in material_names:
 m=bpy.data.materials.new(name);m.diffuse_color=(.28,.025,.035,1) if 'red' in name.lower() or 'rubber' in name.lower() else (.16,.085,.03,1);pm.materials.append(m)
for poly,name in zip(pm.polygons,face_mats):poly.material_index=material_names.index(name)
original=rig.animation_data.action
# Preserve all source channels; replace only asymmetric upper-arm/elbow rotations.
trial=original.copy();trial.name='PrivateNaturalAirPose'
keys={'RightArm':[(0,0),(.1,10),(.23,-30),(.47,-22),(.73,-15),(.93,-8),(1.2,0)],'RightForeArm':[(0,0),(.1,20),(.23,25),(.47,35),(.73,25),(.93,18),(1.2,0)],'LeftArm':[(0,0),(.1,20),(.23,-50),(.47,-45),(.73,-30),(.93,-15),(1.2,0)],'LeftForeArm':[(0,0),(.1,35),(.23,60),(.47,75),(.73,40),(.93,30),(1.2,0)]}
def value(rows,t):
 a,b=next((a,b) for a,b in zip(rows,rows[1:]) if a[0]<=t<=b[0]);f=(t-a[0])/(b[0]-a[0]);f=f*f*(3-2*f);return a[1]+(b[1]-a[1])*f
rig.animation_data.action=original;bpy.context.scene.frame_set(int(first));neutral={name:rig.pose.bones[name].matrix_basis.copy() for name in keys}
side=(rig.data.bones['LeftUpLeg'].head_local-rig.data.bones['RightUpLeg'].head_local).normalized();axes={name:(rig.data.bones[name].matrix_local.to_3x3().inverted()@side).normalized() for name in keys}
rig.animation_data.action=trial
for i in range(37):
 scene.frame_set(int(first)+i)
 for name,rows in keys.items():
  bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION';bone.rotation_quaternion=neutral[name].to_quaternion()@Quaternion(axes[name],math.radians(value(rows,i/30)));bone.keyframe_insert('rotation_quaternion',frame=int(first)+i)
# Calibrate once in neutral pose; then freeze a hand-relative transform.
scene.frame_set(int(first));bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix
head=rig.matrix_world@rig.pose.bones['RightHand'].head;tail=rig.matrix_world@rig.pose.bones['RightHand'].tail;palm=head+(tail-head).normalized()*.045
axis=Vector((-.55,.2,-.8)).normalized();q=Vector((0,0,1)).rotation_difference(axis);desired=q.to_matrix().to_4x4();desired.translation=palm-q@Vector((0,0,-.28*.6));desired=desired@Matrix.Diagonal((.6,.6,.6,1));relative=hand.inverted()@desired
# Studio, identical cameras and light for each A/B.
scene.world=bpy.data.worlds.new('NeutralCPUWorld')
scene.world.color=(.13,.13,.13)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object;fm=bpy.data.materials.new('NeutralFloor');fm.diffuse_color=(.19,.20,.22,1);floor.data.materials.append(fm)
for loc,energy,size in [((-3,-4,5),550,3),((3,-1,3),260,3),((0,3,4),380,2)]:
 data=bpy.data.lights.new('Studio','AREA');data.energy=energy;data.shape='DISK';data.size=size;obj=bpy.data.objects.new('Studio',data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
cam_data=bpy.data.cameras.new('MatchedCamera');cam=bpy.data.objects.new('MatchedCamera',cam_data);scene.collection.objects.link(cam);scene.camera=cam;cam_data.type='ORTHO';cam_data.ortho_scale=2.35
views={'front':(0,-5,1.1),'side':(-5,0,1.1),'threequarter':(-3.6,-3.6,1.1)}
metrics={};started=time.monotonic()
for mode,action in [('baseline',original),('trial',trial)]:
 rig.animation_data.action=action;scene.frame_set(math.floor(frame),subframe=frame%1);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix
 prop.matrix_world=Matrix.Translation(hand.translation) if mode=='baseline' else hand@relative
 deps=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(deps);posed=[ev.matrix_world@v.co for v in ev.data.vertices];m={}
 for side,ids in regionids.items():
  ratios=[]
  for e in mesh.data.edges:
   a,b=e.vertices;old=(rest[a]-rest[b]).length
   if a in ids and b in ids and old>.002:ratios.append((posed[a]-posed[b]).length/old)
  ratios.sort();m[side]={'edge_ratio_p95':ratios[int(len(ratios)*.95)],'edge_ratio_max':ratios[-1]}
 m['prop_world_matrix']=[[float(x) for x in row] for row in prop.matrix_world];metrics[mode]=m
 for label,loc in views.items():
  cam.location=loc;cam.rotation_euler=(Vector((0,0,1.08))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(P/(mode+'-'+label+'.png'));bpy.ops.render.render(write_still=True);print('NORD_POSE_VIEW_READY',mode,label,flush=True)
(P/'preview.json').write_text(json.dumps({'scope':'CPU16sample raw-map pose+prop study only; no export/native/acceptance','weights_modified':False,'pose_keys':keys,'prop_scale':.6,'hand_relative_matrix':[[float(x) for x in row] for row in relative],'metrics':metrics,'seconds':time.monotonic()-started},indent=2)+'\n')
# Retain working copy for a later reviewed export; original inputs remain untouched.
bpy.ops.wm.save_as_mainfile(filepath=str(P/'study.blend'))
print('NORD_POSE_STUDY_OK',P,flush=True)
