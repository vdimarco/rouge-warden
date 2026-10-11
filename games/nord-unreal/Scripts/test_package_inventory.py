"""CPU-only regression for parsing a packaged Unreal `getall` inventory."""
import json
import tempfile
from pathlib import Path

from package_inventory import verify_plateau_inventory


families = {
    'Meshes': ('Data/Plateau/layout.json', 'materials'),
    'Context': ('Data/Plateau/ContextGeometry/context.json', 'materials'),
    'Background': ('Data/Plateau/BackgroundGeometry/layout.json', 'batches'),
    'Landmarks': ('Data/Plateau/LandmarkGeometry/landmarks.json', 'materials'),
    'Park': ('Data/Plateau/ParkGeometry/park.json', 'materials'),
    'Edges': ('Data/Plateau/EdgesGeometry/edges.json', 'materials'),
    'Wayfinding': ('Data/Plateau/Wayfinding/Geometry/wayfinding.json', 'batches'),
    'Perimeter': ('Data/Plateau/PerimeterGeometry/perimeter.json', 'materials'),
}
rigs = ('MenCasual', 'MenHoodie', 'MenSuit', 'WomenCasual', 'WomenFormal', 'WomenPunk')
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    lines = []
    mesh_rows = []
    for index, (folder, (relative, key)) in enumerate(families.items()):
        manifest = root / relative
        manifest.parent.mkdir(parents=True, exist_ok=True)
        data = {key: {'Batch0': {'triangles': 2}}}
        if folder == 'Perimeter':
            data.update(survey_landmark={'city_id': '2317003'}, survey_school={'city_id': '2316935'})
        manifest.write_text(json.dumps(data))
        row = (f"{index}) StaticMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel."
               f"StaticMeshActor_{index}.StaticMeshComponent.StaticMesh = "
               f"/Script/Engine.StaticMesh'/Game/Plateau/{folder}/SM_Batch0.SM_Batch0'")
        mesh_rows.append(row)
        lines.append(row)
    visuals_path = root / 'Data/Plateau/LandmarkVisualGeometry/visuals.json'
    visuals_path.parent.mkdir(parents=True, exist_ok=True)
    copy_names = ('Roof_XM004_YP001', 'Sage_XM004_YP000', 'Sage_XM004_YP001', 'Glass')
    visuals = {'targets': ['27395533', '355385456'], 'collision_changed': False,
               'replacements': [
                   {'target_actor_label': 'Plateau survey context ' + name,
                    'target_asset': f'/Game/Plateau/Perimeter/SM_LandmarkContext_{name}.SM_LandmarkContext_{name}'}
                   for name in copy_names] + [{'target_asset': None, 'target_actor_label': None} for _ in range(3)]}
    visuals_path.write_text(json.dumps(visuals))
    finish_path = root / 'Data/Plateau/FacadeFinishGeometry/finish.json'
    finish_path.parent.mkdir(parents=True, exist_ok=True)
    finish = {'materials': {'Finish0': {'collision': False}}, 'new_collision': False,
              'corner_osm_id': '356350796', 'triangles': 100,
              'corner_edges': [{'id': ident, 'edge_index': edge} for ident, edge in
                               (('356350796', 1), ('356350796', 2), ('345835052', 4), ('356350765', 2))]}
    finish_path.write_text(json.dumps(finish))
    landmark_rows = []
    for index, name in enumerate(('LeNeuvilleSurvey', 'LePlateauSchoolSurvey', 'FacadeFinish_Finish0') +
                                 tuple('LandmarkContext_' + name for name in copy_names), len(families)):
        row = (f"{index}) StaticMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel."
               f"StaticMeshActor_{index}.StaticMeshComponent.StaticMesh = "
               f"/Script/Engine.StaticMesh'/Game/Plateau/Perimeter/SM_{name}.SM_{name}'")
        landmark_rows.append(row)
        lines.append(row)
    pedestrian_rows = [f'{i}) QuebecPedestrian /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecPedestrian_{i}.WalkSpeed = 90'
                       for i in range(12)]
    lines.extend(pedestrian_rows)
    vegetation_row = ("0) QuebecVegetation /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees = "
                      "HierarchicalInstancedStaticMeshComponent'/Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees'")
    tree_row = ("0) HierarchicalInstancedStaticMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees.StaticMesh = "
                "/Script/Engine.StaticMesh'/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02.tree_small_02'")
    lines.extend((vegetation_row, tree_row))
    rig_rows = []
    for i in range(12):
        rig = rigs[i % len(rigs)]
        asset = root / 'Content/Plateau/Life/Civilians' / rig / ('SK_' + rig + '.uasset')
        asset.parent.mkdir(parents=True, exist_ok=True)
        asset.touch()
        row = (f"{i}) SkeletalMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel."
               f"QuebecPedestrian_{i}.ResidentMesh.SkinnedAsset = "
               f"/Script/Engine.SkeletalMesh'/Game/Plateau/Life/Civilians/{rig}/SK_{rig}.SK_{rig}'")
        rig_rows.append(row)
        lines.append(row)
    good = '\n'.join(lines)
    result = verify_plateau_inventory(good, root)
    assert result['loaded_meshes'] == len(families) + len(landmark_rows)
    assert result['mesh_families']['Perimeter'] == 8
    assert result['pedestrian_actors'] == 12 and result['vegetation_actors'] == 1
    assert result['civilian_rigs'] == 6
    for needle in (*mesh_rows, *landmark_rows, pedestrian_rows[0], vegetation_row, tree_row, rig_rows[-1]):
        try:
            verify_plateau_inventory(good.replace(needle, ''), root)
        except AssertionError:
            pass
        else:
            raise AssertionError('Missing packaged dependency was accepted: ' + needle[:100])
    def must_reject(corrupt):
        try:
            verify_plateau_inventory(corrupt, root)
        except AssertionError:
            return
        raise AssertionError('Counterfeit or conflicting package inventory was accepted')

    # A warning can mention an asset path without proving that a live component loaded it.
    must_reject(good.replace(mesh_rows[0],
        "LogLinker: Warning: Failed to load /Game/Plateau/Meshes/SM_Batch0.SM_Batch0"))
    must_reject(good.replace(rig_rows[0],
        "LogLinker: Warning: Failed to load /Game/Plateau/Life/Civilians/MenCasual/SK_MenCasual.SK_MenCasual"))
    for row in landmark_rows:
        must_reject(good.replace(row, 'LogLinker: Warning: ' + row))
        must_reject(good + '\n' + row.replace('StaticMeshActor_', 'DuplicateActor_'))
        must_reject(good.replace(row, row.replace('/Game/Maps/LaFontaine.LaFontaine:', '/Game/Maps/Other.Other:')))
    perimeter_path = root / 'Data/Plateau/PerimeterGeometry/perimeter.json'
    perimeter_data = json.loads(perimeter_path.read_text())
    for key in ('survey_landmark', 'survey_school'):
        original = perimeter_data[key]['city_id']
        perimeter_data[key]['city_id'] = 'unrelated-survey'
        perimeter_path.write_text(json.dumps(perimeter_data))
        must_reject(good)
        perimeter_data[key]['city_id'] = original
    perimeter_path.write_text(json.dumps(perimeter_data))
    for field, corrupt in (('targets', ['27395533', 'unrelated-building']), ('collision_changed', True)):
        original = visuals[field]
        visuals[field] = corrupt
        visuals_path.write_text(json.dumps(visuals))
        must_reject(good)
        visuals[field] = original
    for field, corrupt in (
            ('target_asset', '/Game/Other/SM_LandmarkContext_Glass.SM_LandmarkContext_Glass'),
            ('target_actor_label', 'Plateau landmark context Roof_XM004_YP001'),
            ('target_actor_label', 'unrelated actor')):
        original = visuals['replacements'][0][field]
        visuals['replacements'][0][field] = corrupt
        visuals_path.write_text(json.dumps(visuals))
        must_reject(good)
        visuals['replacements'][0][field] = original
    visuals_path.write_text(json.dumps(visuals))
    for field, corrupt in (('new_collision', True), ('corner_osm_id', 'unrelated-building'), ('triangles', 15000)):
        original = finish[field]
        finish[field] = corrupt
        finish_path.write_text(json.dumps(finish))
        must_reject(good)
        finish[field] = original
    for corrupt in (finish['corner_edges'][:-1], finish['corner_edges'] + [finish['corner_edges'][0]],
                    [{'id': 'unrelated-building', 'edge_index': 1}] + finish['corner_edges'][1:],
                    [{'id': '356350796', 'edge_index': 0}] + finish['corner_edges'][1:]):
        original = finish['corner_edges']
        finish['corner_edges'] = corrupt
        finish_path.write_text(json.dumps(finish))
        must_reject(good)
        finish['corner_edges'] = original
    finish['materials']['Finish0']['collision'] = True
    finish_path.write_text(json.dumps(finish))
    must_reject(good)
    finish['materials']['Finish0']['collision'] = False
    finish_path.write_text(json.dumps(finish))
    # Another loaded actor using the same batch, an unrelated map, or the wrong
    # pedestrian component path must not count as the expected saved actor layer.
    must_reject(good + '\n' + mesh_rows[0].replace('StaticMeshActor_0', 'StaticMeshActor_99'))
    must_reject(good.replace(mesh_rows[0], mesh_rows[0].replace(
        '/Game/Maps/LaFontaine.LaFontaine:', '/Game/Maps/Other.Other:')))
    must_reject(good.replace(rig_rows[0], rig_rows[0].replace(
        'QuebecPedestrian_0.ResidentMesh', 'QuebecPedestrian_99.ResidentMesh')))
    # PIE prefixes and Unreal's timestamped console-log wrapper remain valid.
    pie = good.replace(mesh_rows[0], '[2026.10.11-03.00.00:000][  1]' + mesh_rows[0].replace(
        '/Game/Maps/LaFontaine.LaFontaine:',
        '/Game/Maps/UEDPIE_0_LaFontaine.UEDPIE_0_LaFontaine:'))
    assert verify_plateau_inventory(pie, root)['loaded_meshes'] == len(families) + len(landmark_rows)
print('Packaged Plateau inventory parser checks passed')
