"""Derive one local wardrobe without changing the source rig/body vertices or morphs.

blender --background --factory-startup --python Scripts/prepare_graphic_novel_wardrobe.py -- --source Data/GraphicNovel/Pilot/CurlyMetalhead/rigged/body.fbx
Uses Blender's nearest-face vertex-group transfer for new shoe/detail surfaces.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
from datetime import datetime, timezone

import bpy
import bmesh
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / 'Data/CharactersNeutral/CurlyMetalhead'
OUT = ROOT / 'Data/GraphicNovel/Pilot/CurlyMetalhead/wardrobe'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ORIGINAL / 'body.fbx')
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
source = (ROOT / args.source).resolve()
assert source.is_file() and source.suffix == '.fbx', source
OUT.mkdir(parents=True, exist_ok=True)
if any((OUT / name).exists() for name in ('body.fbx', 'pilot.blend', 'report.json')):
    backup = OUT / 'revisions' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
    backup.mkdir(parents=True)
    for path in list(OUT.iterdir()):
        if path.is_file():
            shutil.copy2(path, backup / path.name)


def hashes(folder):
    return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in folder.rglob('*') if p.is_file()}


protected = hashes(ORIGINAL)
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source), use_anim=False, automatic_bone_orientation=False, use_image_search=False)
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = max((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: len(o.data.vertices))
rig.animation_data_clear()
rig.data.pose_position = 'REST'
bind = {b.name: (b.parent.name if b.parent else None, b.matrix_local.copy()) for b in rig.data.bones}
original_vertices = [v.co.copy() for v in body.data.vertices]
shapes = {k.name: [v.co.copy() for v in k.data] for k in body.data.shape_keys.key_blocks} if body.data.shape_keys else {}
points = [body.matrix_world @ v.co for v in body.data.vertices]
world_inverse = body.matrix_world.inverted()
assert .0 <= min(p.z for p in points) + 1e-6 < .02 and 1.80 < max(p.z for p in points) < 1.84
weights = [{body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in body.data.vertices]


def material(name, rgb, roughness=.8):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


mats = {'Trousers': material('Trousers', (.018, .073, .087)),
        'TrousersSeam': material('TrousersSeam', (.009, .028, .033)),
        'Canvas': material('Canvas', (.025, .026, .029)),
        'Sole': material('Sole', (.66, .63, .53), .65),
        'RubberStripe': material('RubberStripe', (.07, .075, .075), .6),
        'Laces': material('Laces', (.78, .75, .66), .85),
        'Eyelets': material('Eyelets', (.16, .16, .15), .3)}
for mat in body.data.materials:
    if mat and mat.use_nodes:
        nodes = mat.node_tree.nodes
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(ORIGINAL / 'base_color.png'), check_existing=True)
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
            bsdf.inputs['Roughness'].default_value = .8


def mesh_object(name, vertices, faces, mat, source_indices=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats[mat])
    for group in body.vertex_groups:
        obj.vertex_groups.new(name=group.name)
    if source_indices is not None:
        for i, old in enumerate(source_indices):
            for name, weight in weights[old].items():
                obj.vertex_groups[name].add([i], weight, 'REPLACE')
    else:
        bpy.context.view_layer.objects.active = obj
        transfer = obj.modifiers.new('SourceSkin', 'DATA_TRANSFER')
        transfer.object = body
        transfer.use_vert_data = True
        transfer.data_types_verts = {'VGROUP_WEIGHTS'}
        transfer.vert_mapping = 'POLYINTERP_NEAREST'
        transfer.layers_vgroup_select_src = 'ALL'
        transfer.layers_vgroup_select_dst = 'NAME'
        bpy.ops.object.modifier_apply(modifier=transfer.name)
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    modifier = obj.modifiers.new('OriginalArmature', 'ARMATURE')
    modifier.object = rig
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def mix(a, b, t):
    return a + (b - a) * max(0., min(1., t))


def axis_center(side, z):
    names = ('Right' if side < 0 else 'Left')
    knee = rig.matrix_world @ rig.data.bones[names + 'Leg'].head_local
    hip = rig.matrix_world @ rig.data.bones[names + 'UpLeg'].head_local
    ankle = rig.matrix_world @ rig.data.bones[names + 'Foot'].head_local
    a, b = (ankle, knee) if z <= knee.z else (knee, hip)
    return a.lerp(b, max(0., min(1., (z - a.z) / (b.z - a.z))))


# Reuse the source silhouette, topology and exact original skin weights, then
# soften the shorts flare into a continuous tapered trouser silhouette.
faces = [list(p.vertices) for p in body.data.polygons
         if .17 < sum(points[i].z for i in p.vertices) / len(p.vertices) < 1.035
         and all(abs(points[i].x) < .32 for i in p.vertices)]
ids = sorted({i for f in faces for i in f})
indices = {old: new for new, old in enumerate(ids)}
trouser_points = []
for i in ids:
    p = points[i].copy()
    if p.z < .82:
        c = axis_center(1 if p.x >= 0 else -1, p.z)
        d = p - c
        angle = math.atan2(d.y, d.x)
        thigh = max(0., min(1., (p.z - .52) / .25))
        rx, ry = mix(.060, .098, thigh), mix(.066, .107, thigh)
        fold = .0025 * math.sin(p.z * 110 + angle * 3) * math.sin(p.z * 23 + angle)
        target = Vector((c.x + (rx + fold) * math.cos(angle), c.y + (ry + fold) * math.sin(angle), p.z))
        p = target.lerp(p, max(0., min(1., (p.z - .76) / .06)))
    else:
        p.x *= 1.025
        p.y += .004 * (1 if p.y > .025 else -1)
    trouser_points.append(tuple(p))
trousers = mesh_object('GN_Trousers', trouser_points, [[indices[i] for i in f] for f in faces], 'Trousers', ids)
# UV-split source triangles and the old shorts hem need a welded, relaxed cloth
# surface; clip the ankle boundary exactly rather than selecting whole triangles.
bm=bmesh.new();bm.from_mesh(trousers.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00008)
bmesh.ops.subdivide_edges(bm,edges=list(bm.edges),cuts=1,use_grid_fill=True)
for _ in range(8):
    movable=[v for v in bm.verts if .23<v.co.z<.99]
    bmesh.ops.smooth_vert(bm,verts=movable,factor=.45,use_axis_x=True,use_axis_y=True,use_axis_z=True)
# Replace the actual old shorts hem and sparse bare-leg topology with cloth
# rings attached to the source's precise thigh cross-section.
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,
                       plane_co=Vector((0,0,.765)),plane_no=Vector((0,0,1)),clear_inner=True)
for side in (-1,1):
    center=axis_center(side,.765)
    ring=sorted([v for v in bm.verts if abs(v.co.z-.765)<.00001 and v.co.x*side>0],
                key=lambda v:math.atan2(v.co.y-center.y,v.co.x-center.x))
    assert len(ring)>20,('Missing thigh cross-section',side,len(ring))
    top=[v.co.copy() for v in ring]
    angles=[math.atan2(p.y-center.y,p.x-center.x) for p in top]
    for z in (.735,.70,.665,.63,.595,.56,.525,.49,.455,.42,.385,.35,.315,.28,.245,.21,.18):
        c=axis_center(side,z)
        thigh=max(0.,min(1.,(z-.52)/.245))
        rx,ry=mix(.061,.098,thigh),mix(.066,.107,thigh)
        next_ring=[]
        for a,p in zip(angles,top):
            fold=.003*math.sin(z*85+a*3)*math.sin(z*20+a)
            q=Vector((c.x+(rx+fold)*math.cos(a),c.y+(ry+fold)*math.sin(a),z))
            blend=max(0.,min(1.,(z-.70)/.065))
            original=Vector((p.x,p.y,z))
            next_ring.append(bm.verts.new(q.lerp(original,blend)))
        for i in range(len(ring)):
            face=bm.faces.new((ring[i],next_ring[i],next_ring[(i+1)%len(ring)],ring[(i+1)%len(ring)]))
            face.smooth=True
        ring=next_ring
for v in bm.verts:
    if v.is_boundary and v.co.z<.25:v.co.z=.18
bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,
                       plane_co=Vector((0,0,1.015)),plane_no=Vector((0,0,1)),clear_outer=True)
for v in bm.verts:
    if v.is_boundary and v.co.z>.99:v.co.z=1.015
# Keep only the intended waist and ankle openings; generated source seams can
# leave small open islands after welding/clipping.
remaining={e for e in bm.edges if e.is_boundary}
filled_boundaries=0
while remaining:
    seed=remaining.pop();component={seed};frontier=[seed]
    while frontier:
        edge=frontier.pop()
        for vertex in edge.verts:
            for other in vertex.link_edges:
                if other in remaining:
                    remaining.remove(other);component.add(other);frontier.append(other)
    zs=[v.co.z for e in component for v in e.verts]
    if min(zs)<1.0 and max(zs)>.20:
        bmesh.ops.holes_fill(bm,edges=list(component),sides=0)
        filled_boundaries+=1
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bm.to_mesh(trousers.data);bm.free();trousers.data.update()
bpy.context.view_layer.objects.active=trousers
transfer=trousers.modifiers.new('ClothSkin','DATA_TRANSFER');transfer.object=body
transfer.use_vert_data=True;transfer.data_types_verts={'VGROUP_WEIGHTS'}
transfer.vert_mapping='POLYINTERP_NEAREST';transfer.layers_vgroup_select_src='ALL';transfer.layers_vgroup_select_dst='NAME'
bpy.ops.object.modifier_apply(modifier=transfer.name)
trouser_surface=BVHTree.FromPolygons([tuple(v.co) for v in trousers.data.vertices],
                                    [tuple(p.vertices) for p in trousers.data.polygons])


def hull(points2):
    pts = sorted(set(points2))
    def cross(a, b, c):
        return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])
    halves = []
    for seq in (pts, list(reversed(pts))):
        part = []
        for p in seq:
            while len(part) >= 2 and cross(part[-2], part[-1], p) <= 0:
                part.pop()
            part.append(p)
        halves += part[:-1]
    return halves


def resample_loop(loop, count=48):
    distances = [math.dist(a, b) for a, b in zip(loop, loop[1:] + loop[:1])]
    total = sum(distances)
    result = []
    for k in range(count):
        remaining = total * k / count
        for i, length in enumerate(distances):
            if remaining <= length:
                a, b = Vector(loop[i]), Vector(loop[(i + 1) % len(loop)])
                result.append(a.lerp(b, remaining / length))
                break
            remaining -= length
    return result


def loft(name, rings, mat, caps=False):
    n = len(rings[0])
    vertices = [tuple(v) for ring in rings for v in ring]
    faces = [(j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i)
             for j in range(len(rings)-1) for i in range(n)]
    if caps:
        faces += [tuple(reversed(range(n))), tuple((len(rings)-1)*n+i for i in range(n))]
    return mesh_object(name, vertices, faces, mat)


def cord(name, points3, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points3)-1)
    for p, co in zip(spline.points, points3):
        p.co = (*co, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    mesh = bpy.context.object.data
    result = mesh_object(name + '_Skin', [tuple(v.co) for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons], mat)
    bpy.data.objects.remove(obj, do_unlink=True)
    return result


waist_outline=resample_loop(hull([(v.co.x,v.co.y) for v in trousers.data.vertices if v.co.z>1.005]))
loft('GN_Waistband',[[Vector((p.x*1.005,p.y, z)) for p in waist_outline] for z in (1.002,1.021)],'Trousers')


for side, label in ((-1, 'R'), (1, 'L')):
    foot = [p for p in points if p.x * side > .1 and p.z < .055]
    outline = resample_loop(hull([(p.x, p.y) for p in foot]))
    center = Vector((sum(p.x for p in outline)/len(outline), sum(p.y for p in outline)/len(outline)))
    outline = [center + (p-center)*1.07 for p in outline]
    def sole_ring(z, scale=1.):
        return [Vector((center.x+(p.x-center.x)*scale, center.y+(p.y-center.y)*scale, z)) for p in outline]
    loft('GN_Sole_'+label, [sole_ring(.002, .96), sole_ring(.008), sole_ring(.031), sole_ring(.037, .98)], 'Sole', True)
    loft('GN_SoleStripe_'+label, [sole_ring(.026, 1.004), sole_ring(.029, 1.004)], 'RubberStripe')
    ankle = axis_center(side, .16)
    def upper_ring(height, blend):
        result = []
        for p in outline:
            angle = math.atan2(p.y-center.y, p.x-center.x)
            target = Vector((ankle.x+.055*math.cos(angle), ankle.y+.059*math.sin(angle)))
            q = p.lerp(target, blend)
            result.append(Vector((q.x, q.y, height)))
        return result
    canvas=loft('GN_Canvas_'+label, [upper_ring(.036, .03), upper_ring(.065, .07), upper_ring(.09, .35),
                                  upper_ring(.145, .85), upper_ring(.197, 1.)], 'Canvas')
    surface=BVHTree.FromPolygons([tuple(v.co) for v in canvas.data.vertices],
                                [tuple(p.vertices) for p in canvas.data.polygons])
    def front(x,z):
        hit,normal,index,distance=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
        assert hit is not None,('Lace missed canvas',x,z)
        return (x,hit.y-.0018,z)
    loft('GN_AnklePiping_'+label, [upper_ring(.193, 1.01), upper_ring(.199, 1.01)], 'RubberStripe')
    # A raised tongue, crossed laces and eyelet tabs distinguish canvas sneakers
    # from boots without replacing the source ankle/foot proportions.
    tongue=[]
    for z in (.083,.105,.13,.155,.175,.194):
        tongue.extend((front(ankle.x-.025,z),front(ankle.x+.025,z)))
    mesh_object('GN_Tongue_'+label,tongue,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(5)],'Canvas')
    for row in range(5):
        z = .088 + row*.020
        def lace_point(x,height):
            p=Vector(front(x,height));p.y-=.002;return tuple(p)
        cord('GN_Lace_'+label+str(row),[lace_point(ankle.x-.026,z),lace_point(ankle.x,z+.005),lace_point(ankle.x+.026,z+.010)],.0015,'Laces')
        cord('GN_LaceCross_'+label+str(row),[lace_point(ankle.x+.026,z),lace_point(ankle.x,z+.005),lace_point(ankle.x-.026,z+.010)],.0015,'Laces')
    # Off-white toe reinforcement follows only the rounded front of the shoe.
    front_ids=[i for i,p in enumerate(outline) if p.y<center.y-.055]
    cap_vertices=[];cap_faces=[]
    for i in front_ids:
        p=outline[i]
        cap_vertices += [(p.x,p.y-.001,.036),(mix(p.x,center.x,.035),p.y+.004,.066)]
    for j in range(len(front_ids)-1):
        if (front_ids[j+1]-front_ids[j])%len(outline)==1:
            cap_faces.append((j*2,j*2+1,j*2+3,j*2+2))
    mesh_object('GN_ToeCap_'+label,cap_vertices,cap_faces,'Sole')
    for seam_side in (-1, 1):
        cord('GN_CanvasSeam_'+label+str(seam_side), [(ankle.x+seam_side*.042,ankle.y-.05,.07),
             (ankle.x+seam_side*.038,ankle.y-.052,.12), (ankle.x+seam_side*.038,ankle.y-.052,.19)], .0008, 'Sole')
    # Slightly rounded side pocket surface, sitting on the existing upper thigh.
    pocket = []
    for z, spread in ((.79, .042), (.775, .047), (.67, .044), (.655, .034)):
        c = axis_center(side, z)
        for y in (-spread, spread):
            pocket.append((c.x+side*.105, c.y+y, z))
    mesh_object('GN_CargoPocket_'+label, pocket, [(0,1,3,2),(2,3,5,4),(4,5,7,6)], 'Trousers')
    cord('GN_PocketFlap_'+label, [pocket[0],pocket[1],pocket[3],pocket[2],pocket[0]], .001, 'TrousersSeam')
    seam=[]
    for z in (.22,.3,.4,.5,.6,.65):
        c=axis_center(side,z)
        hit,normal,index,distance=trouser_surface.ray_cast(Vector((side,c.y,z)),Vector((-side,0,0)))
        assert hit is not None,('Side seam missed trousers',side,z)
        seam.append((hit.x+side*.0015,c.y,z))
    cord('GN_TrouserSideSeam_'+label,seam,.0008,'TrousersSeam')

# Delete only covered polygons. Keeping every original vertex and shape-key
# point avoids changing the torso/head identity or the added facial controls.
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
removed=0
for polygon in body.data.polygons:
    ps=[points[i] for i in polygon.vertices]
    if sum(p.z for p in ps)/len(ps)<1.022 and all(abs(p.x)<.32 for p in ps):
        polygon.select=True
        removed+=1
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='ONLY_FACE')
bpy.ops.object.mode_set(mode='OBJECT')
assert len(body.data.vertices)==len(original_vertices)
assert all((v.co-original_vertices[i]).length<1e-6 for i,v in enumerate(body.data.vertices))
for name, coords in shapes.items():
    assert all((p.co-coords[i]).length<1e-6 for i,p in enumerate(body.data.shape_keys.key_blocks[name].data))
assert removed>4000 and len(faces)>2000, (removed,len(faces))

meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for obj in meshes:
    assert obj.find_armature()==rig, obj.name
    for vertex in obj.data.vertices:
        if obj!=body:
            assert .98<sum(g.weight for g in vertex.groups)<1.02, (obj.name,vertex.index)
for name,(parent,matrix) in bind.items():
    bone=rig.data.bones[name]
    assert (bone.parent.name if bone.parent else None)==parent
    assert max(abs(a-b) for row,other in zip(matrix,bone.matrix_local) for a,b in zip(row,other))<1e-6
assert hashes(ORIGINAL)==protected
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
bpy.ops.object.select_all(action='DESELECT')
for obj in [rig,*meshes]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.fbx(filepath=str(OUT/'body.fbx'),use_selection=True,object_types={'ARMATURE','MESH'},
                         add_leaf_bones=False,bake_anim=False,use_mesh_modifiers=False,
                         axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'pilot.blend'))


def render(name, position, target, scale):
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
    scene.render.resolution_x=scene.render.resolution_y=900
    scene.render.resolution_percentage=100
    scene.world=scene.world or bpy.data.worlds.new('WardrobeWorld')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.13,.13,.13,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5
    camera=bpy.data.objects.new('WardrobeCamera',bpy.data.cameras.new('WardrobeCamera'))
    scene.collection.objects.link(camera)
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=scale;scene.camera=camera
    lights=[]
    for location,power,size in (((-1,-2,3),180,2),((1,-.5,1.5),70,1)):
        light=bpy.data.objects.new('WardrobeLight',bpy.data.lights.new('WardrobeLight','AREA'))
        scene.collection.objects.link(light);light.location=location
        light.rotation_euler=(Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()
        light.data.energy=power;light.data.size=size;lights.append(light)
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(name+'.png'))
    bpy.ops.render.render(write_still=True)
    for obj in [camera,*lights]:bpy.data.objects.remove(obj,do_unlink=True)


if not args.no_render:
    rig.data.pose_position='POSE'
    render('front',(0,-3,.95),(0,0,.95),2.0)
    render('lower-front',(0,-3,.55),(0,0,.55),1.2)
    render('lower-side',(3,0,.55),(0,0,.55),1.2)
    side=(rig.data.bones['LeftUpLeg'].head_local-rig.data.bones['RightUpLeg'].head_local).normalized()
    for name,angle in (('LeftUpLeg',-40),('LeftLeg',85),('LeftFoot',-35)):
        bone=rig.pose.bones[name];bone.rotation_mode='QUATERNION'
        local=bone.bone.matrix_local.to_3x3().inverted()@side
        bone.rotation_quaternion=Quaternion(local,math.radians(angle))
    bpy.context.view_layer.update()
    render('bent-knee',(2,-3,.60),(0,0,.60),1.4)
    for bone in rig.pose.bones:bone.rotation_quaternion=Quaternion()
    rig.data.pose_position='REST'

report={'passed':True,'source':str(source.relative_to(ROOT)),'source_sha256':source_hash,
        'original_sources_unchanged':hashes(ORIGINAL)==protected,'source_bind_bones_preserved':len(bind),
        'original_vertex_count_preserved':len(original_vertices),'source_shape_keys_preserved':list(shapes),
        'covered_body_faces_removed':removed,'trouser_faces':len(faces),
        'unintended_cloth_boundaries_filled':filled_boundaries,
        'meshes':[{'name':o.name,'vertices':len(o.data.vertices),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),
                   'materials':[m.name for m in o.data.materials]} for o in meshes],
        'technique_sources':['https://docs.blender.org/manual/en/3.0/modeling/modifiers/modify/data_transfer.html'],
        'method':'source lower-body topology and original weights; tapered trouser silhouette; source-foot convex footprint with authored canvas/sole/laces; nearest-face interpolated source weights on new detail surfaces; original body vertices/morphs retained and only covered faces removed',
        'export':{'body.fbx':hashlib.sha256((OUT/'body.fbx').read_bytes()).hexdigest(),
                  'pilot.blend':hashlib.sha256((OUT/'pilot.blend').read_bytes()).hexdigest()},
        'cpu_rendered':not args.no_render,'visual_acceptance':'pending direct image inspection',
        'limits':['local wardrobe derived from retained body, not a new generated character','no cloth simulation','actual engine appearance and motion require fresh native review']}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print('NORD_GRAPHIC_NOVEL_WARDROBE_OK',json.dumps({'bones':len(bind),'meshes':len(meshes),'covered_faces':removed,'shape_keys':list(shapes)}))
