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
}
rigs = ('MenCasual', 'MenHoodie', 'MenSuit', 'WomenCasual', 'WomenFormal', 'WomenPunk')
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    lines = []
    mesh_rows = []
    for index, (folder, (relative, key)) in enumerate(families.items()):
        manifest = root / relative
        manifest.parent.mkdir(parents=True, exist_ok=True)
        manifest.write_text(json.dumps({key: {'Batch0': {'triangles': 2}}}))
        row = (f"{index}) StaticMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel."
               f"StaticMeshActor_{index}.StaticMeshComponent.StaticMesh = "
               f"/Script/Engine.StaticMesh'/Game/Plateau/{folder}/SM_Batch0.SM_Batch0'")
        mesh_rows.append(row)
        lines.append(row)
    for i in range(12):
        lines.append(f'{i}) QuebecPedestrian /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecPedestrian_{i}.WalkSpeed = 90')
    lines.append("0) QuebecVegetation /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees = "
                 "HierarchicalInstancedStaticMeshComponent'/Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees'")
    lines.append("0) HierarchicalInstancedStaticMeshComponent /Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0.Trees.StaticMesh = "
                 "/Script/Engine.StaticMesh'/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02.tree_small_02'")
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
    assert result['loaded_meshes'] == len(families)
    assert result['pedestrian_actors'] == 12 and result['vegetation_actors'] == 1
    assert result['civilian_rigs'] == 6
    for needle in (mesh_rows[0], lines[7], lines[19], lines[20], rig_rows[-1]):
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
    assert verify_plateau_inventory(pie, root)['loaded_meshes'] == len(families)
print('Packaged Plateau inventory parser checks passed')
