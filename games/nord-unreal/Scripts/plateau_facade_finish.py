"""Close unsupported metal cornices and the exact QA-visible blue-card planes."""
import copy
import hashlib
import json
import math
from pathlib import Path

from plateau_batches import spatial_batches
from plateau_facades import _author_facades
from plateau_mesh import Mesh
from prepare_plateau import geography

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'Data/Plateau/FacadeFinishGeometry'
EDGE_SCOPE = (('356350796', 1, 'Avenue du Parc-La Fontaine', 'Perimeter2 corner'),
              ('356350796', 2, 'Avenue du Parc-La Fontaine', 'Perimeter2 corner'),
              ('356350765', 2, 'Avenue du Parc-La Fontaine', 'Perimeter2 alley'),
              ('345835052', 4, 'Rue Sherbrooke Est', 'Perimeter4 right neighbor'))


def build():
    existing = json.loads((ROOT / 'Data/Plateau/layout.json').read_text())['facades']['fronts']
    perimeter = json.loads((ROOT / 'Data/Plateau/PerimeterGeometry/perimeter.json').read_text())['fronts']
    fronts = existing + perimeter + [r for f in existing for r in f.get('corner_returns', [])]
    mesh, caps = Mesh(), []
    for front in fronts:
        if front['cornice'] != 'metal' or front['kind'] != 'front' or front['width'] < 150:
            continue
        a, b, width, height = front['a'], front['b'], front['width'], front['height']
        tangent = [(b[i]-a[i])/width for i in (0, 1)]
        normal = front['normal']
        scale = min(1, max(.43, front['setback']/70))

        def p(x, depth, z):
            return tuple(a[i]+tangent[i]*x+normal[i]*depth*scale for i in (0, 1))+(z,)

        # Match the existing rake exactly; these five faces close its underside.
        mesh.face('Trim', [p(0,95,height-30),p(width,95,height-30),p(width,95,height+15),p(0,95,height+15)])
        mesh.face('Trim', [p(width,10,height-30),p(0,10,height-30),p(0,10,height+65),p(width,10,height+65)])
        mesh.face('Trim', [p(0,10,height-30),p(width,10,height-30),p(width,95,height-30),p(0,95,height-30)])
        end = [p(0,10,height-30),p(0,95,height-30),p(0,95,height+15),p(0,10,height+65)]
        mesh.face('Trim', end)
        mesh.face('Trim', [p(width,10,height-30),p(width,10,height+65),p(width,95,height+15),p(width,95,height-30)])
        caps.append({'id':front['id'],'a':a,'b':b,'height_cm':height,'depth_scale':scale})
    buildings = {building['id']: building for building in geography()[0]}
    corner = []
    for osm_id, index, street, view in EDGE_SCOPE:
        building = buildings[osm_id]
        a, b = building['points'][index], building['points'][index+1]
        width = math.dist(a,b)
        corner.append({'id':building['id'],'a':a,'b':b,'width':width,'height':building['height'],
                       'normal':[(b[1]-a[1])/width,-(b[0]-a[0])/width],
                       'setback':200,'street':street,'distance':0,'edge_index':index,'qa_view':view,
                       'kind':'side','gallery_depth':0,'alternates':[], 'return':True,
                       'perimeter':True,'masonry':'BrickBrown','tags':copy.deepcopy(building['tags'])})
    details = _author_facades(mesh,corner,storefronts=False)
    stripped = Mesh()
    for name, faces in mesh.groups.items():
        stripped.groups.setdefault(name.removesuffix('_Collision'),[]).extend(faces)
    mesh, batches, size = spatial_batches(stripped,20000,48)
    for name, metadata in batches.items():
        metadata['bounds_cm'] = [[round(op(p[i] for face in mesh.groups[name] for p in face),3)
                                  for i in range(3)] for op in (min,max)]
        assert metadata['collision'] is False
    triangles = sum(record['triangles'] for record in batches.values())
    assert triangles < 15000 and len(corner)==4
    assert not details['counts']['exterior_stairs'] and not details['counts']['storefronts']
    return mesh, {'materials':batches,'triangles':triangles,'metal_cornices':caps,
                  'corner_osm_id':'356350796','corner_edges':details['fronts'],
                  'tile_size_cm':size,'new_collision':False,
                  'limits':'Existing estimated facade heights/footprint edges retained. Five-face trim closes existing metal rake gaps. Only four exact QA-visible edges on three parcels receive an illustrative masonry/tall-window skin; finish/window rhythm remain estimates.'}


def prepare():
    mesh, manifest = build()
    DIRECTORY.mkdir(parents=True,exist_ok=True)
    mesh.write(DIRECTORY)
    manifest['source_sha256'] = {name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in
                                ('Data/LaFontaine/osm.xml','Data/Plateau/layout.json','Data/Plateau/PerimeterGeometry/perimeter.json')}
    manifest['geometry_sha256'] = {name:hashlib.sha256((DIRECTORY/(name+'.obj')).read_bytes()).hexdigest()
                                   for name in manifest['materials']}
    (DIRECTORY/'finish.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return manifest


def inputs(manifest):
    for path,expected in manifest['source_sha256'].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected,path
    for name,expected in manifest['geometry_sha256'].items():
        assert hashlib.sha256((DIRECTORY/(name+'.obj')).read_bytes()).hexdigest()==expected,name


def apply(u,import_mesh,nanite):
    manifest=json.loads((DIRECTORY/'finish.json').read_text()); inputs(manifest)
    editor=u.get_editor_subsystem(u.EditorActorSubsystem)
    old={a.get_actor_label():a for a in editor.get_all_level_actors() if a.get_actor_label().startswith('Plateau facade finish ')}
    subsystem=u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    for name,metadata in manifest['materials'].items():
        mesh=import_mesh(DIRECTORY/(name+'.obj'),'/Game/Plateau/Perimeter','SM_FacadeFinish_'+name,False)
        material=u.EditorAssetLibrary.load_asset('/Game/Plateau/Materials/M_'+metadata['material'])
        assert material
        settings=subsystem.get_lod_build_settings(mesh,0)
        settings.set_editor_property('max_lumen_mesh_cards',64)
        settings.set_editor_property('generate_distance_field_as_if_two_sided',True)
        subsystem.set_lod_build_settings(mesh,0,settings)
        nanite(u,mesh,[material])
        assert mesh.get_num_triangles(0)==metadata['triangles']
        label='Plateau facade finish '+name
        actor=editor.spawn_actor_from_class(u.StaticMeshActor,u.Vector())
        actor.set_actor_label(label); actor.set_folder_path('Plateau/Facade finishing')
        component=actor.static_mesh_component
        component.set_static_mesh(mesh); component.set_material(0,material)
        component.set_collision_profile_name('NoCollision')
        if label in old: editor.destroy_actor(old.pop(label))
    for actor in old.values(): editor.destroy_actor(actor)
    return {'passed':True,'batches':len(manifest['materials']),'triangles':manifest['triangles'],'new_collision':False}


def verify(u):
    manifest=json.loads((DIRECTORY/'finish.json').read_text()); inputs(manifest)
    actors={a.get_actor_label():a for a in u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
            if a.get_actor_label().startswith('Plateau facade finish ')}
    assert len(actors)==len(manifest['materials'])
    for name,metadata in manifest['materials'].items():
        actor=actors['Plateau facade finish '+name]; component=actor.static_mesh_component; mesh=component.static_mesh
        assert mesh.get_path_name()=='/Game/Plateau/Perimeter/SM_FacadeFinish_'+name+'.SM_FacadeFinish_'+name
        assert mesh.get_num_triangles(0)==metadata['triangles'] and mesh.get_editor_property('nanite_settings').enabled
        settings=u.get_editor_subsystem(u.StaticMeshEditorSubsystem).get_lod_build_settings(mesh,0)
        assert settings.max_lumen_mesh_cards==64 and settings.generate_distance_field_as_if_two_sided
        assert component.get_material(0).get_path_name()=='/Game/Plateau/Materials/M_'+metadata['material']+'.M_'+metadata['material']
        assert component.get_collision_enabled()==u.CollisionEnabled.NO_COLLISION
        assert str(component.get_collision_profile_name())=='NoCollision'
        assert component.is_visible() and not actor.get_editor_property('hidden')
        assert actor.get_actor_location().length()<.1
        rotation,scale=actor.get_actor_rotation(),actor.get_actor_scale3d()
        assert max(abs(v) for v in (rotation.roll,rotation.pitch,rotation.yaw))<.001
        assert max(abs(v-1) for v in (scale.x,scale.y,scale.z))<.001
        bounds=mesh.get_bounds()
        actual=[[bounds.origin.x+s*bounds.box_extent.x,bounds.origin.y+s*bounds.box_extent.y,bounds.origin.z+s*bounds.box_extent.z] for s in (-1,1)]
        assert all(abs(actual[e][i]-metadata['bounds_cm'][e][i])<.2 for e in (0,1) for i in range(3))
    return {'passed':True,'batches':len(actors),'triangles':manifest['triangles'],'new_collision':False}


if __name__=='__main__':
    print(json.dumps(prepare(),ensure_ascii=False,indent=2))
