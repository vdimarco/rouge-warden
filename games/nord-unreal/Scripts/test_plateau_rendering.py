"""Check which trees the saved map's QuebecVegetation stand-in holds, and that dogs can find the street trees.

Before apply_plateau_replica.py runs, the saved map (and any restored backup) holds the 4,571 OSM tree nodes that
upgrade_plateau.py placed through plateau_rendering.apply. This test runs that apply step and verify_plateau's
vegetation check on a small fake unreal module. It also checks the C++ that lets dogs sniff the species street trees.
"""
import ast
import math
from pathlib import Path
import re
import sys
import tempfile
from types import SimpleNamespace
import xml.etree.ElementTree as ET

import plateau_rendering
from prepare_lafontaine import ROOT, inside, tags, xy

OSM_TREES = 4571    # natural=tree nodes inside prepare_lafontaine.BOUNDS: what the saved map holds before the apply step
STREET_TREE_TAG = 'NordStreetTree'


def osm_nodes():
    """The OSM natural=tree nodes inside the district, read straight from the file."""
    nodes = []
    for e in ET.parse(ROOT / 'Data/LaFontaine/osm.xml').getroot().findall('node'):
        lat, lon = float(e.get('lat')), float(e.get('lon'))
        if tags(e).get('natural') == 'tree' and inside((lat, lon)):
            nodes.append((*xy(lat, lon), int(e.get('id'))))
    return nodes


class Vector:
    def __init__(self, x=0., y=0., z=0.): self.x, self.y, self.z = x, y, z


class Transform:
    def __init__(self, translation, rotation, scale): self.translation, self.rotation, self.scale3d = translation, rotation, scale


class Trees:
    """QuebecVegetation's Trees component: a hierarchical instanced static mesh."""
    def __init__(self, mesh=None, points=()):
        self.static_mesh = mesh
        self.transforms = [Transform(Vector(x, y, 0.), None, None) for x, y, *_ in points]
    def set_static_mesh(self, mesh): self.static_mesh = mesh; return True
    def add_instances(self, transforms, *flags): self.transforms.extend(transforms); return list(range(len(transforms)))
    def get_instance_count(self): return len(self.transforms)
    def get_instance_transform(self, index, world): return self.transforms[index]
    def get_collision_enabled(self): return 0


class Actor:
    def __init__(self, label, cls='StaticMeshActor', trees=None):
        self.label, self.cls, self.trees, self.folder = label, cls, trees, None
    def get_actor_label(self): return self.label
    def set_actor_label(self, label): self.label = label
    def set_folder_path(self, path): self.folder = path
    def get_class(self): return SimpleNamespace(get_name=lambda: self.cls)
    def get_editor_property(self, name):
        assert name == 'trees', name
        return self.trees


class Settings:
    def set_editor_property(self, name, value): setattr(self, name, value)


class Mesh:
    """tree_small_02: 455 cm tall, no material slots (so no usage edits to fake)."""
    def __init__(self): self.nanite_settings = Settings()
    def get_editor_property(self, name): return [] if name == 'static_materials' else getattr(self, name)
    def get_bounds(self): return SimpleNamespace(box_extent=Vector(150., 150., 227.5))
    def get_path_name(self): return '/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02.tree_small_02'


class Editor:
    def __init__(self, actors): self.actors = list(actors)
    def get_all_level_actors(self): return list(self.actors)
    def destroy_actor(self, actor): self.actors.remove(actor)
    def spawn_actor_from_class(self, cls, location):
        actor = Actor('', 'QuebecVegetation', Trees())
        self.actors.append(actor)
        return actor


def fake_unreal(editor, mesh):
    class StaticMeshActor: pass
    meshes = SimpleNamespace(set_nanite_settings=lambda *args: None)
    fake = SimpleNamespace(
        EditorActorSubsystem=object(), StaticMeshEditorSubsystem=object(), StaticMeshActor=StaticMeshActor,
        EditorAssetLibrary=SimpleNamespace(load_asset=lambda path: mesh, save_loaded_asset=lambda asset: True),
        MaterialEditingLibrary=SimpleNamespace(), MaterialInstanceConstant=type('MaterialInstanceConstant', (), {}),
        MaterialUsage=SimpleNamespace(MATUSAGE_NANITE=0, MATUSAGE_INSTANCED_STATIC_MESHES=1),
        NaniteFallbackTarget=SimpleNamespace(PERCENT_TRIANGLES=1), CollisionEnabled=SimpleNamespace(NO_COLLISION=0),
        load_class=lambda outer, path: path, Vector=Vector, Transform=Transform,
        Rotator=lambda yaw=0.: SimpleNamespace(yaw=yaw))
    fake.get_editor_subsystem = lambda cls: editor if cls is fake.EditorActorSubsystem else meshes
    return fake


def run_apply(actors):
    """plateau_rendering.apply on a fake level holding actors; returns the vegetation actor and the report."""
    editor, mesh = Editor(actors), Mesh()
    u = fake_unreal(editor, mesh)
    root, refine = plateau_rendering.ROOT, sys.modules.get('refine_plateau_trees')
    with tempfile.TemporaryDirectory() as temporary:
        plateau_rendering.ROOT = Path(temporary)          # its report goes to <ROOT>/Saved/Tests
        sys.modules['refine_plateau_trees'] = SimpleNamespace(apply=lambda unreal: {'refined': 'stub'})
        try:
            report = plateau_rendering.apply(u)
        finally:
            plateau_rendering.ROOT = root
            if refine is None: sys.modules.pop('refine_plateau_trees')
            else: sys.modules['refine_plateau_trees'] = refine
    vegetation = [a for a in editor.actors if a.get_actor_label() == 'Plateau mapped vegetation']
    assert len(vegetation) == 1 and vegetation[0].folder == 'Plateau/Trees'
    return vegetation[0], editor.actors, mesh, u, report


def verify_function(u):
    """verify_plateau.verify_vegetation, run on the fake module (verify_plateau imports unreal at load)."""
    syntax = ast.parse((ROOT / 'Scripts/verify_plateau.py').read_text())
    function = next(node for node in syntax.body if isinstance(node, ast.FunctionDef) and node.name == 'verify_vegetation')
    report = {'checks': []}
    scope = {'u': u, 'REPORT': report, 'math': math}
    exec(compile(ast.Module(body=[function], type_ignores=[]), 'verify_vegetation', 'exec'), scope)
    return scope['verify_vegetation'], report


def rejects(verify, actors, mesh, why):
    try:
        verify(actors, {a.get_actor_label(): a for a in actors}, mesh)
    except AssertionError:
        return
    raise AssertionError('verify_plateau accepted ' + why)


def check_osm_reader():
    """osm_tree_positions() is the OSM tree nodes; tree_positions() is still street_trees.json."""
    nodes = osm_nodes()
    assert len(nodes) == OSM_TREES and len({n[2] for n in nodes}) == OSM_TREES
    assert plateau_rendering.osm_tree_positions() == nodes
    rows = plateau_rendering.street_trees()
    assert len(rows) > OSM_TREES and plateau_rendering.tree_positions() == [
        (float(r['x_cm']), float(r['y_cm']), plateau_rendering.tree_seed(r['id'])) for r in rows]
    species = Actor(plateau_rendering.REPLICA_STREET_TREES + 'norway_maple', 'QuebecReplicaInstances')
    assert plateau_rendering.planned_vegetation([]) == OSM_TREES
    assert plateau_rendering.planned_vegetation([species]) == 0
    return nodes, rows


def check_stand_in(nodes, rows):
    """Before the apply step, plateau_rendering.apply puts the old summer tree on every OSM tree node, and
    verify_plateau accepts that and nothing else; once the species street trees stand, it places none."""
    vegetation, actors, mesh, u, report = run_apply([Actor('OSM Grass')])
    placed = [(t.translation.x, t.translation.y) for t in vegetation.trees.transforms]
    assert placed == [(x, y) for x, y, _ in nodes], f'{len(placed)} stand-in trees, not the {OSM_TREES} OSM nodes'
    assert all(abs(t.rotation.yaw - seed % 360) < 1e-9 for t, (_, _, seed) in zip(vegetation.trees.transforms, nodes))
    assert report['mapped_tree_instances'] == OSM_TREES and report['tree_appearance'] == {'refined': 'stub'}
    verify, proof = verify_function(u)
    labels = {a.get_actor_label(): a for a in actors}
    assert verify(actors, labels, mesh) == OSM_TREES and proof['tree_layer'] == {'mapped_tree_instances': OSM_TREES}
    # The fourth pass's stand-in (one tree per street_trees.json row) is not what the saved map holds.
    vegetation.trees = Trees(mesh, plateau_rendering.tree_positions())
    rejects(verify, actors, mesh, 'the street_trees.json rows as the saved stand-in')
    vegetation.trees = Trees(mesh, plateau_rendering.tree_positions()[:OSM_TREES])
    rejects(verify, actors, mesh, f'{OSM_TREES} trees at the street_trees.json positions')
    vegetation.trees = Trees(Mesh(), nodes)
    rejects(verify, actors, mesh, 'the stand-in on another mesh')
    # After the apply step: the species street trees stand and the vegetation is empty.
    species = Actor(plateau_rendering.REPLICA_STREET_TREES + 'elm', 'QuebecReplicaInstances')
    vegetation, actors, mesh, u, report = run_apply([species])
    assert vegetation.trees.get_instance_count() == 0 and report['mapped_tree_instances'] == 0
    verify, proof = verify_function(u)
    assert verify(actors, {a.get_actor_label(): a for a in actors}, mesh) == 0
    vegetation.trees = Trees(mesh, nodes)
    rejects(verify, actors, mesh, 'old summer trees beside the species street trees')
    return len(placed)


def function_body(source, name):
    """The body of a C++ member function, matched by its braces."""
    start = source.index(name)
    open_at = source.index('{', start)
    depth = 0
    for i in range(open_at, len(source)):
        depth += {'{': 1, '}': -1}.get(source[i], 0)
        if depth == 0:
            return source[open_at:i + 1]
    raise AssertionError('unbalanced ' + name)


def check_dog_sniffs_street_trees():
    """The apply step clears the old summer trees. Dogs then find the species street trees through the actor tag
    NordStreetTree: FindSniffSpot reads the instanced mesh components of the tagged actors, the apply step tags its
    street-tree actors, and the README host checks name the tag."""
    body = function_body((ROOT / 'Source/Quebec/QuebecLife.cpp').read_text(), 'UQuebecCompanionRig::FindSniffSpot(')
    assert 'TActorIterator<AQuebecVegetation>' in body, 'FindSniffSpot no longer reads QuebecVegetation'
    assert re.search(r'ActorHasTag\(TEXT\("' + STREET_TREE_TAG + r'"\)\)', body), \
        'FindSniffSpot does not read the street-tree actors tagged ' + STREET_TREE_TAG
    assert 'UInstancedStaticMeshComponent' in body and 'GetInstancesOverlappingSphere' in body, \
        'FindSniffSpot does not read the tagged actors\' instanced trees'
    apply_source = (ROOT / 'Scripts/apply_plateau_replica.py').read_text()
    assert STREET_TREE_TAG in apply_source, 'apply_plateau_replica.py does not tag the street-tree actors'
    readme = (ROOT / 'Data/Plateau/ReplicaGeometry/README.md').read_text()
    owed = readme.split('### Host checks still owed', 1)[1].split('\n## ', 1)[0]
    assert STREET_TREE_TAG in owed and 'FindSniffSpot' in owed, 'the README host checks do not name the sniff tag'


def main():
    nodes, rows = check_osm_reader()
    placed = check_stand_in(nodes, rows)
    check_dog_sniffs_street_trees()
    print(f'Plateau rendering checks passed: {placed:,} stand-in trees on the OSM nodes before the apply step, none '
          f'after it, {len(rows):,} street_trees.json rows for the previews and Plex; dogs sniff the {STREET_TREE_TAG} actors')


if __name__ == '__main__':
    main()
