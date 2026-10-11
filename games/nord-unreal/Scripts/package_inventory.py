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
        'Perimeter': ('Data/Plateau/PerimeterGeometry/perimeter.json', 'materials'),
    }
    meshes = {}
    for folder, (manifest, key) in manifests.items():
        data = json.loads((root / manifest).read_text())
        expected = set(data[key])
        if folder == 'Perimeter':
            assert data['survey_landmark']['city_id'] == '2317003', 'Le Neuville survey identity changed'
            assert data['survey_school']['city_id'] == '2316935', 'École Le Plateau survey identity changed'
            expected.update(('LeNeuvilleSurvey', 'LePlateauSchoolSurvey'))
            visuals = json.loads((root / 'Data/Plateau/LandmarkVisualGeometry/visuals.json').read_text())
            assert set(visuals['targets']) == {'27395533', '355385456'}, 'Landmark visual repair targets changed'
            assert visuals['collision_changed'] is False, 'Landmark visual repair changed collision'
            assert len(visuals['replacements']) == 7, 'Landmark visual repair source count changed'
            copies = set()
            for record in visuals['replacements']:
                if record['target_asset'] is None:
                    assert record['target_actor_label'] is None
                    continue
                asset = re.fullmatch(r'/Game/Plateau/Perimeter/SM_(LandmarkContext_[A-Za-z0-9_]+)\.SM_\1',
                                     record['target_asset'])
                assert asset, 'Invalid landmark visual copy asset path'
                name = asset.group(1)
                assert record['target_actor_label'] == 'Plateau survey context ' + name.removeprefix('LandmarkContext_')
                assert name not in copies, 'Duplicate landmark visual copy'
                copies.add(name)
            assert len(copies) == 4, 'Landmark visual copy count changed'
            expected.update(copies)
            finish = json.loads((root / 'Data/Plateau/FacadeFinishGeometry/finish.json').read_text())
            assert finish['new_collision'] is False and finish['corner_osm_id'] == '356350796', 'Facade finish scope changed'
            side_edges = [(record['id'], record['edge_index']) for record in finish['corner_edges']]
            assert len(side_edges) == 4 and set(side_edges) == {
                ('356350796', 1), ('356350796', 2), ('345835052', 4), ('356350765', 2)
            }, 'Facade finish confirmed side edges changed'
            assert 0 < len(finish['materials']) <= 48 and finish['triangles'] < 15000, 'Facade finish budget changed'
            assert all(record['collision'] is False for record in finish['materials'].values()), 'Facade finish collision changed'
            expected.update('FacadeFinish_' + name for name in finish['materials'])
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
