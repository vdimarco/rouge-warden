"""Nanite city surfaces and surveyed instanced trees without kilometre-wide shadow batches."""
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
from prepare_lafontaine import inside, xy, tags


def tree_positions():
    return [(*xy(float(e.get('lat')),float(e.get('lon'))),int(e.get('id')))
            for e in ET.parse(ROOT/'Data/LaFontaine/osm.xml').getroot().findall('node')
            if tags(e).get('natural') == 'tree' and inside((float(e.get('lat')),float(e.get('lon'))))]


def warden_tree_inventory(actors):
    """Find Warden's saved tree layer so the Plateau pass does not duplicate it."""
    return next((actor for actor in actors
                 if actor.get_actor_label() == 'Comic park inventory trunks'), None)


def nanite(u, mesh, materials):
    library = u.MaterialEditingLibrary
    for mat in materials:
        if isinstance(mat,u.MaterialInstanceConstant):
            library.set_material_usage_override(mat,u.MaterialUsage.MATUSAGE_NANITE,True,True)
        else: library.set_base_material_usage(mat,u.MaterialUsage.MATUSAGE_NANITE,True)
        assert library.has_material_usage(mat,u.MaterialUsage.MATUSAGE_NANITE)
        u.EditorAssetLibrary.save_loaded_asset(mat)
    settings = mesh.get_editor_property('nanite_settings')
    settings.set_editor_property('enabled',True)
    # Exact fallback triangles preserve complex collision on stairs and surveyed walls.
    settings.set_editor_property('fallback_target',u.NaniteFallbackTarget.PERCENT_TRIANGLES)
    settings.set_editor_property('fallback_percent_triangles',1.)
    settings.set_editor_property('fallback_relative_error',0.)
    u.get_editor_subsystem(u.StaticMeshEditorSubsystem).set_nanite_settings(mesh,settings,True)
    u.EditorAssetLibrary.save_loaded_asset(mesh)


def apply(u, preserve_warden_trees=False):
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    assets = u.EditorAssetLibrary
    actors = editor.get_all_level_actors()
    warden_trees = warden_tree_inventory(actors) if preserve_warden_trees else None
    if preserve_warden_trees:
        assert warden_trees, 'Warden tree inventory is missing; refusing to replace it with duplicate Plateau trees'
    tree = assets.load_asset('/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02')
    assert tree
    tree_materials = [s.material_interface for s in tree.get_editor_property('static_materials')]
    for mat in tree_materials:
        usage = u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES
        if isinstance(mat,u.MaterialInstanceConstant): u.MaterialEditingLibrary.set_material_usage_override(mat,usage,True,True)
        else: u.MaterialEditingLibrary.set_base_material_usage(mat,usage,True)
    nanite(u,tree,tree_materials)
    enabled = []
    for actor in actors:
        label = actor.get_actor_label()
        if label.startswith('Detailed tree ') or label == 'Plateau mapped vegetation':
            editor.destroy_actor(actor)
            continue
        if not isinstance(actor,u.StaticMeshActor): continue
        component = actor.static_mesh_component
        if label in ('OSM Wood','OSM HiddenTrunks','OSM Canopy','OSM CanopyGold','OSM CanopyRust'):
            component.set_visibility(False)
            actor.set_actor_hidden_in_game(True)
            continue
        if label in ('OSM Road','OSM Marking','OSM Path','OSM Grass','OSM Water','OSM Glass') or label.startswith('District '):
            component.set_cast_shadow(False)
            continue
        if label.startswith('Plateau background '):
            assert component.static_mesh.get_editor_property('nanite_settings').get_editor_property('enabled')
            enabled.append(label)
            continue
        if label in ('OSM Brick','OSM Cream','OSM Sage','OSM Roof') or label.startswith('Plateau detail '):
            if 'sign ' in label or 'street tree ' in label: continue
            if label.startswith('Plateau detail White_'):
                component.set_cast_shadow(False)
            mesh = component.static_mesh
            if not mesh: continue
            nanite(u,mesh,list(component.get_materials()))
            if component.is_visible(): enabled.append(label)
    if preserve_warden_trees:
        component = warden_trees.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
        assert component and component.get_instance_count() > 0
        mapped_tree_instances = 0
        warden_tree_instances = component.get_instance_count()
    else:
        vegetation = editor.spawn_actor_from_class(u.load_class(None,'/Script/Quebec.QuebecVegetation'),u.Vector())
        vegetation.set_actor_label('Plateau mapped vegetation'); vegetation.set_folder_path('Plateau/Trees')
        component = vegetation.get_editor_property('trees'); assert component.set_static_mesh(tree)
        height = tree.get_bounds().box_extent.z*2
        transforms = []
        for x,y,seed in tree_positions():
            scale = (650+seed%500)/height
            transforms.append(u.Transform(u.Vector(x,y,0),u.Rotator(yaw=seed%360),u.Vector(scale,scale,scale)))
        component.add_instances(transforms,False,False,False)
        assert component.get_instance_count() == len(transforms) == 4571
        mapped_tree_instances = len(transforms)
        warden_tree_instances = 0
    report = {'nanite_city_batches':len(enabled),'mapped_tree_instances':mapped_tree_instances,
              'warden_tree_instances':warden_tree_instances,'tree_mesh':tree.get_path_name()}
    output = ROOT/'Saved/Tests/PlateauRendering.json'; output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2))
    return report


if __name__ == '__main__':
    if '--self-check' in sys.argv:
        points = tree_positions()
        assert len(points) == 4571 and len({p[2] for p in points}) == len(points)
        assert all(math.isfinite(v) for p in points for v in p)
        print('PLATEAU_VEGETATION_SOURCE_OK',len(points))
    else:
        import unreal as u
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).get_current_level().get_outer().get_name() == 'LaFontaine'
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        report = apply(u)
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        u.log('PLATEAU_RENDERING_OK '+json.dumps(report))
