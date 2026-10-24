"""Nanite city surfaces and surveyed instanced trees without kilometre-wide shadow batches.

The game's street and park trees are the rows of Data/Plateau/ReplicaGeometry/Streets/street_trees.json
(Scripts/plateau_replica.py: every tree of the Ville de Montreal inventory over the district, CC BY 4.0, then the
OpenStreetMap trees it lacks), one row each, at the position the Streets layer gives it (in its sidewalk pit).
tree_positions() reads them for the Plex yard trees' clearance and the previews. Scripts/apply_plateau_replica.py
draws them on their species meshes.

Until that step runs, the saved map's QuebecVegetation holds the old summer tree on the 4,571 OSM tree nodes
(osm_tree_positions(), as upgrade_plateau.py placed them through apply() below), and the committed park's fallen
leaves follow those nodes too. So the park build, this stand-in and verify_plateau's check before the apply step read
osm_tree_positions(). Once the replica street trees exist, the stand-in holds none.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'Scripts'))
from prepare_lafontaine import inside, tags, xy
STREET_TREES = ROOT/'Data/Plateau/ReplicaGeometry/Streets/street_trees.json'
OSM = ROOT/'Data/LaFontaine/osm.xml'
REPLICA_STREET_TREES = 'Plateau replica Street trees '   # apply_plateau_replica.py's street-tree actors


def tree_seed(tree_id):
    """A stable integer seed per tree: an OSM tree's node id (as before), else 48 bits of SHA-256 of the inventory id
    (inv:<borough>-<EMP_NO>)."""
    source, _, rest = tree_id.partition(':')
    if source == 'osm':
        return int(rest)
    return int.from_bytes(hashlib.sha256(tree_id.encode()).digest()[:6], 'big')


def street_trees(path=STREET_TREES):
    """The rows of Streets/street_trees.json, in file order."""
    return json.loads(Path(path).read_text())['trees']


def tree_positions(path=STREET_TREES):
    """Every street and park tree the game shows as (x, y, seed): map frame, cm, in street_trees.json order."""
    return [(float(r['x_cm']), float(r['y_cm']), tree_seed(r['id'])) for r in street_trees(path)]


def osm_tree_positions(path=OSM):
    """The OSM natural=tree nodes inside the district as (x, y, node id): map frame, cm, in file order. The saved
    map's QuebecVegetation stand-in and the committed park leaves stand on these 4,571 nodes."""
    trees = []
    for e in ET.parse(path).getroot().findall('node'):
        lat, lon = float(e.get('lat')), float(e.get('lon'))
        if tags(e).get('natural') == 'tree' and inside((lat, lon)):
            trees.append((*xy(lat, lon), int(e.get('id'))))
    return trees


def species_street_trees(actors):
    """The replica street-tree actors (apply_plateau_replica.py) already in the level."""
    return [a for a in actors if a.get_actor_label().startswith(REPLICA_STREET_TREES)]


def planned_vegetation(actors):
    """How many old summer trees QuebecVegetation holds: one per OSM tree node, none once the species street trees
    stand (apply_plateau_replica.py clears them and this pass places none after it)."""
    return 0 if species_street_trees(actors) else len(osm_tree_positions())


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
        # The stand-in stands on the OSM tree nodes, as the saved map and its backups hold it. Once
        # apply_plateau_replica.py has put the street trees on their species meshes, the old summer tree has no place:
        # the actor stays (upgrade_plateau and verify_plateau expect one), empty.
        if not species_street_trees(actors):
            for x,y,seed in osm_tree_positions():
                scale = (650+seed%500)/height
                transforms.append(u.Transform(u.Vector(x,y,0),u.Rotator(yaw=seed%360),u.Vector(scale,scale,scale)))
            component.add_instances(transforms,False,False,False)
        assert component.get_instance_count() == len(transforms) == planned_vegetation(actors)
        mapped_tree_instances = len(transforms)
        warden_tree_instances = 0
    report = {'nanite_city_batches':len(enabled),'mapped_tree_instances':mapped_tree_instances,
              'warden_tree_instances':warden_tree_instances,'tree_mesh':tree.get_path_name()}
    if not preserve_warden_trees:
        from refine_plateau_trees import apply as refine_trees
        report['tree_appearance'] = refine_trees(u)
    output = ROOT/'Saved/Tests/PlateauRendering.json'; output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2))
    return report


if __name__ == '__main__':
    if '--self-check' in sys.argv:
        points = tree_positions()
        assert len(points) == len(street_trees()) >= 4571 and len({p[2] for p in points}) == len(points)
        assert all(math.isfinite(v) for p in points for v in p)
        print('PLATEAU_VEGETATION_SOURCE_OK',len(points))
    else:
        import unreal as u
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).get_current_level().get_outer().get_name() == 'LaFontaine'
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        report = apply(u)
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        u.log('PLATEAU_RENDERING_OK '+json.dumps(report))
