"""Read-only inventory checks for the cooked unified Plateau map console dump."""
import json
import re
from pathlib import Path

LEVEL = r'/Game/Maps/(?:UEDPIE_\d+_)?LaFontaine\.(?:UEDPIE_\d+_)?LaFontaine:PersistentLevel'
ROW = r'(?m)^(?:\[[^\]\r\n]*\][ \t]*)*\d+\)[ \t]+'


def loaded_mesh_names(log, folder):
    """Count only live LaFontaine component rows, never warnings mentioning asset paths."""
    rows = re.findall(
        ROW + rf"StaticMeshComponent[ \t]+({LEVEL}\.[^\s=]+)\.StaticMesh[ \t]*=[ \t]*"
        rf"/Script/Engine\.StaticMesh'/Game/Plateau/{re.escape(folder)}/SM_([A-Za-z0-9_]+)\.SM_\2'[ \t]*\r?$",
        log)
    names = [name for _, name in rows]
    assert len(names) == len(set(names)), f'Duplicate cooked Plateau {folder} mesh components'
    assert len(rows) == len({component for component, _ in rows}), f'Conflicting cooked Plateau {folder} component rows'
    return set(names)


def dumped_actors(log, actor_class, property_name):
    """Read actors dumped by a native `getall Class Property` command."""
    return set(re.findall(
        ROW + rf"{re.escape(actor_class)}[ \t]+"
        rf"({LEVEL}\.[^\s=]+?)"
        rf"\.{re.escape(property_name)}[ \t]*=", log))


def verify_plateau_inventory(log, root):
    root = Path(root)
    manifests = {
        'Meshes': ('Data/Plateau/layout.json', 'materials'),
        'Context': ('Data/Plateau/ContextGeometry/context.json', 'materials'),
        'Background': ('Data/Plateau/BackgroundGeometry/layout.json', 'batches'),
        'Landmarks': ('Data/Plateau/LandmarkGeometry/landmarks.json', 'materials'),
        'Park': ('Data/Plateau/ParkGeometry/park.json', 'materials'),
        'Edges': ('Data/Plateau/EdgesGeometry/edges.json', 'materials'),
        'Wayfinding': ('Data/Plateau/Wayfinding/Geometry/wayfinding.json', 'batches'),
    }
    meshes = {}
    for folder, (manifest, key) in manifests.items():
        expected = set(json.loads((root / manifest).read_text())[key])
        loaded = loaded_mesh_names(log, folder)
        missing, extra = expected - loaded, loaded - expected
        assert not missing and not extra, (
            f'Cooked Plateau {folder} meshes differ from saved map manifest',
            len(loaded), len(expected), sorted(missing)[:8], sorted(extra)[:8])
        meshes[folder] = len(loaded)

    pedestrians = dumped_actors(log, 'QuebecPedestrian', 'WalkSpeed')
    assert len(pedestrians) == 12, ('Cooked Plateau pedestrian actors', len(pedestrians))
    vegetation = dumped_actors(log, 'QuebecVegetation', 'Trees')
    assert len(vegetation) == 1, ('Cooked Plateau vegetation actors', len(vegetation))
    tree_component = re.findall(
        r"HierarchicalInstancedStaticMeshComponent\s+"
        r"/Game/Maps/LaFontaine\.LaFontaine:PersistentLevel\.QuebecVegetation_[^\s.]+\.Trees\.StaticMesh"
        r"\s*=\s*/Script/Engine\.StaticMesh'"
        r"(/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02\.tree_small_02)'", log)
    assert len(tree_component) == 1, 'Cooked Plateau mapped-tree HISM mesh is missing'

    expected_rigs = {p.parent.name for p in (root / 'Content/Plateau/Life/Civilians').glob('*/SK_*.uasset')
                     if p.stem == 'SK_' + p.parent.name}
    rig_rows = re.findall(
        ROW + rf"SkeletalMeshComponent[ \t]+({LEVEL}\.QuebecPedestrian_[^\.\s=]+)"
        r"\.ResidentMesh\.SkinnedAsset[ \t]*=[ \t]*"
        r"/Script/Engine\.SkeletalMesh'/Game/Plateau/Life/Civilians/([A-Za-z0-9_]+)/SK_\2\.SK_\2'[ \t]*\r?$",
        log)
    assert len(rig_rows) == len(pedestrians) and {actor for actor, _ in rig_rows} == pedestrians, (
        'Cooked Plateau pedestrian mesh components', len(rig_rows), len(pedestrians))
    loaded_rigs = {rig for _, rig in rig_rows}
    assert len(expected_rigs) == 6 and loaded_rigs == expected_rigs, (
        'Cooked Plateau civilian rigs', sorted(loaded_rigs), sorted(expected_rigs))
    return {'mesh_families': meshes, 'loaded_meshes': sum(meshes.values()),
            'pedestrian_actors': len(pedestrians), 'vegetation_actors': len(vegetation),
            'mapped_tree_mesh': tree_component[0], 'civilian_rigs': len(loaded_rigs),
            'tree_instance_count_source': 'verified on saved map by verify_plateau.py, not inferred from package log'}
