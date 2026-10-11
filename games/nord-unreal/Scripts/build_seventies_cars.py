"""Import only the authored 1970s-inspired car meshes and materials.

Run with UnrealEditor-Cmd after prepare_seventies_cars.py. This script neither
loads nor saves a level, and never creates, moves, or deletes scene actors.
"""

import json
import math
from pathlib import Path

import unreal as u


ROOT = Path(u.Paths.project_dir()).resolve()
SOURCE = ROOT / "Data/SeventiesCars"
MANIFEST = json.loads((SOURCE / "manifest.json").read_text())
DESTINATION = "/Game/ParkComic"
ASSETS = u.EditorAssetLibrary
TOOLS = u.AssetToolsHelpers.get_asset_tools()
MATERIALS = u.MaterialEditingLibrary
SLOT_NAMES = ("Paint", "Chrome", "Ink", "Rubber", "Glass", "Lens", "Red", "Amber", "Cream", "Vinyl")
MESH_NAMES = (
    *(f"SM_Car70{part}{profile}" for profile in range(3) for part in ("Body", "Cabin", "Roof")),
    "SM_Car70Tire",
    "SM_Car70Rim",
)


def finite_unit(value, label):
    number = float(value)
    assert math.isfinite(number) and 0.0 <= number <= 1.0, (label, value)
    return number


def colour(value, label):
    assert isinstance(value, list) and len(value) == 3, (label, value)
    return [finite_unit(channel, label) for channel in value]


def surface(parent, name, spec):
    path = f"{DESTINATION}/M_Car70_{name}"
    instance = ASSETS.load_asset(path) if ASSETS.does_asset_exist(path) else TOOLS.create_asset(
        f"M_Car70_{name}", DESTINATION, u.MaterialInstanceConstant, u.MaterialInstanceConstantFactoryNew()
    )
    assert isinstance(instance, u.MaterialInstanceConstant), path
    MATERIALS.set_material_instance_parent(instance, parent)
    tint = colour(spec["color"], name)
    roughness = finite_unit(spec["roughness"], name + ".roughness")
    metallic = finite_unit(spec["metallic"], name + ".metallic")
    MATERIALS.set_material_instance_vector_parameter_value(instance, "Tint", u.LinearColor(*tint, 1.0))
    MATERIALS.set_material_instance_scalar_parameter_value(instance, "Roughness", roughness)
    MATERIALS.set_material_instance_scalar_parameter_value(instance, "Metallic", metallic)
    assert ASSETS.save_loaded_asset(instance), path
    return instance


def parent_material():
    path = f"{DESTINATION}/M_Car70_Surface"
    material = ASSETS.load_asset(path) if ASSETS.does_asset_exist(path) else TOOLS.create_asset(
        "M_Car70_Surface", DESTINATION, u.Material, u.MaterialFactoryNew()
    )
    assert isinstance(material, u.Material), path
    MATERIALS.delete_all_material_expressions(material)
    for cls, name, prop in (
        (u.MaterialExpressionVectorParameter, "Tint", u.MaterialProperty.MP_BASE_COLOR),
        (u.MaterialExpressionScalarParameter, "Roughness", u.MaterialProperty.MP_ROUGHNESS),
        (u.MaterialExpressionScalarParameter, "Metallic", u.MaterialProperty.MP_METALLIC),
    ):
        expression = MATERIALS.create_material_expression(material, cls)
        expression.set_editor_property("parameter_name", name)
        assert MATERIALS.connect_material_property(expression, "", prop), name
    MATERIALS.recompile_material(material)
    assert ASSETS.save_loaded_asset(material), path
    return material


def source_mesh(row):
    assert isinstance(row, dict), row
    filename = Path(row["file"])
    assert filename.name == str(filename) and filename.suffix.lower() == ".obj", filename
    name = "SM_" + filename.stem
    assert name in MESH_NAMES, name
    path = SOURCE / "Geometry" / filename
    assert path.is_file(), path
    lines = path.read_text().splitlines()
    triangles = sum(line.startswith("f ") for line in lines)
    assert triangles > 0 and triangles == int(row["triangles"]), (name, triangles, row["triangles"])
    assert any(line.startswith("vn ") for line in lines), name + " lacks authored normals"
    assert all(len(line.split()) == 4 for line in lines if line.startswith("f ")), name + " is not triangulated"
    slots = row["materials"]
    assert isinstance(slots, list) and slots and len(slots) == len(set(slots)), name
    assert set(slots) <= set(SLOT_NAMES), (name, slots)
    source_slots = [line.split(maxsplit=1)[1] for line in lines if line.startswith("usemtl ")]
    assert source_slots == slots, (name, source_slots, slots)
    return name, path, triangles, slots


def import_mesh(row, instances):
    name, filename, triangles, expected_slots = source_mesh(row)
    task = u.AssetImportTask()
    task.filename = str(filename)
    task.destination_path = DESTINATION
    task.destination_name = name
    task.automated = True
    task.replace_existing = True
    task.save = True
    options = u.FbxImportUI()
    options.import_mesh = True
    options.import_materials = False
    options.import_textures = False
    options.import_as_skeletal = False
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    options.static_mesh_import_data.normal_import_method = u.FBXNormalImportMethod.FBXNIM_IMPORT_NORMALS
    task.options = options
    TOOLS.import_asset_tasks([task])
    path = f"{DESTINATION}/{name}"
    mesh = ASSETS.load_asset(path)
    assert isinstance(mesh, u.StaticMesh), (name, task.imported_object_paths)
    slots = mesh.get_editor_property("static_materials")
    actual_slots = [str(entry.material_slot_name) for entry in slots]
    assert actual_slots == expected_slots, (name, actual_slots, expected_slots)
    for index, slot in enumerate(actual_slots):
        mesh.set_material(index, instances[slot])
    assert ASSETS.save_loaded_asset(mesh), path
    bounds = mesh.get_bounds()
    return {
        "asset": path,
        "file": str(filename.relative_to(ROOT)),
        "source_triangles": triangles,
        "material_slots": actual_slots,
        "bounds_origin_cm": [bounds.origin.x, bounds.origin.y, bounds.origin.z],
        "bounds_extent_cm": [bounds.box_extent.x, bounds.box_extent.y, bounds.box_extent.z],
    }


def main():
    assert isinstance(MANIFEST["materials"], dict) and set(MANIFEST["materials"]) == set(SLOT_NAMES)
    assert isinstance(MANIFEST["paints"], list) and len(MANIFEST["paints"]) == 4
    assert isinstance(MANIFEST["models"], list) and len(MANIFEST["models"]) == len(MESH_NAMES)
    assert {"SM_" + Path(row["file"]).stem for row in MANIFEST["models"]} == set(MESH_NAMES)
    mtl = SOURCE / "Geometry/comic.mtl"
    assert mtl.is_file(), mtl
    assert {line.split(maxsplit=1)[1] for line in mtl.read_text().splitlines() if line.startswith("newmtl ")} == set(SLOT_NAMES)
    assert ASSETS.make_directory(DESTINATION) or ASSETS.does_directory_exist(DESTINATION)
    parent = parent_material()
    instances = {name: surface(parent, name, MANIFEST["materials"][name]) for name in SLOT_NAMES}
    paint = MANIFEST["materials"]["Paint"]
    paint_variants = {}
    for index, tint in enumerate(MANIFEST["paints"]):
        paint_variants[index] = surface(parent, f"Paint{index}", {
            "color": colour(tint, f"paints[{index}]"),
            "roughness": paint["roughness"],
            "metallic": paint["metallic"],
        })
    models = [import_mesh(row, instances) for row in MANIFEST["models"]]
    report = {
        "passed": True,
        "source": "Data/SeventiesCars/manifest.json",
        "destination": DESTINATION,
        "parent_material": f"{DESTINATION}/M_Car70_Surface",
        "paint_variants": [f"{DESTINATION}/M_Car70_Paint{i}" for i in paint_variants],
        "models": models,
        "level_or_actor_changes": False,
    }
    output = ROOT / "Saved/Tests/SeventiesCarsImport.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    u.log("NORD_CAR70_IMPORT_OK " + json.dumps(report))


main()
