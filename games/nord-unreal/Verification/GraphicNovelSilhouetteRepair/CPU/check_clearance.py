import bpy,json,math,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
P=Path(__file__).resolve().parent;OUT=P/'prop-clearance.json';assert not OUT.exists()
bpy.ops.wm.open_mainfile(filepath=str(P/'study.blend'))
scene=bpy.context.scene;mesh=max((o for o in scene.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));rig=mesh.find_armature();prop=bpy.data.objects['GripProxy'];rig.animation_data.action=bpy.data.actions['PrivateNaturalAirPose']
scene.frame_set(2);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix
axis=Vector((-.55,.2,-.8)).normalized();q=Vector((0,0,1)).rotation_difference(axis);desired=q.to_matrix().to_4x4();desired.translation=hand.translation-q@Vector((0,0,-.2*.6));desired=desired@Matrix.Diagonal((.6,.6,.6,1));relative=hand.inverted()@desired
polys=[tuple(p.vertices) for p in mesh.data.polygons];proppolys=[tuple(p.vertices) for p in prop.data.polygons];groups={g.index:g.name for g in mesh.vertex_groups};headids={v.index for v in mesh.data.vertices if any(groups[g.group] in ('Head','neck') and g.weight>.2 for g in v.groups)}
# Shaft grip is expected to contact an open hand; no other contact is silently ignored.
rows=[]
for i in range(37):
 scene.frame_set(2+i);bpy.context.view_layer.update();hand=rig.matrix_world@rig.pose.bones['RightHand'].matrix;prop.matrix_world=hand@relative
 dg=bpy.context.evaluated_depsgraph_get();ev=mesh.evaluated_get(dg);verts=[ev.matrix_world@v.co for v in ev.data.vertices];pv=[prop.matrix_world@v.co for v in prop.data.vertices]
 bvh=BVHTree.FromPolygons(verts,polys,all_triangles=True);pbvh=BVHTree.FromPolygons(pv,proppolys,all_triangles=False);overlap=bvh.overlap(pbvh)
 bodyfaces=set(a for a,b in overlap);neargrip=[];outside=[]
 for pi in bodyfaces:
  center=sum((verts[v] for v in polys[pi]),Vector())/len(polys[pi]);d=(center-hand.translation).length
  (neargrip if d<=.10 else outside).append({'face':pi,'center_m':list(center),'wrist_distance_m':d})
 headmin=min(verts[v].z for v in headids);pmax=max(v.z for v in pv)
 rows.append({'frame':2+i,'seconds':i/30,'proxy_floor_min_z_m':min(v.z for v in pv),'head_region_min_z_m':headmin,'proxy_max_z_m':pmax,'vertical_head_gap_m':headmin-pmax,'overlap_body_polygons':len(bodyfaces),'overlap_polygon_pairs':len(overlap),'near_wrist_10cm_overlap_faces':len(neargrip),'outside_wrist_overlap_faces':len(outside),'outside_wrist_examples':outside[:12]})
 print('CLEARANCE_SAMPLE',i,rows[-1]['outside_wrist_overlap_faces'],flush=True)
report={'scope':'CPU sampled actual-source prop/body triangle overlap plus vertical head/floor bounds;37integer poses only, not swept/native/camera/capsule proof','calibration':'native-equivalent .6uniform,source+Zaxis cup,localshaftz−20cm pinned at RightHand wrist,neutral axis(−.55,+.2,−.8),fixedhandrelative','weights_modified':False,'samples':rows,'min_vertical_head_gap_m':min(r['vertical_head_gap_m'] for r in rows),'min_proxy_floor_z_m':min(r['proxy_floor_min_z_m'] for r in rows),'outside_wrist_contact_frames':[r['frame'] for r in rows if r['outside_wrist_overlap_faces']],'limitations':['Triangle overlap is intersection-only, not signed penetration distance or containment; no cloth thickness.','10cm wrist contact region is explicitly counted; fingers are open/static and no closed grasp is claimed.','Body authored Hips crouch sampled with static actor root; native capsule trajectory/prop collisions remain unchecked.','Native mesh bounds/axes and camera may differ; require engine readback and side/three-quarter jump review.']}
report['sampled_proxy_head_and_floor_separated']=report['min_vertical_head_gap_m']>0 and report['min_proxy_floor_z_m']>=0
OUT.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n');print('CLEARANCE_DONE',OUT,flush=True)
