"""Run once with UnrealEditor-Cmd -run=pythonscript -script=<this file>."""
import math
import unreal as u

MAP = "/Game/Maps/Quebec"
assets = u.EditorAssetLibrary
assert not assets.does_asset_exist(MAP), "Map already exists; preserve edits and duplicate it before rebuilding."
tools = u.AssetToolsHelpers.get_asset_tools()
editor = u.get_editor_subsystem(u.EditorActorSubsystem)
levels = u.get_editor_subsystem(u.LevelEditorSubsystem)
assert levels.new_level(MAP), "Could not create map"


def material(name, color, glow=False):
    parent_name = "M_Glow" if glow else "M_Palette"
    parent_path = "/Game/Materials/" + parent_name
    parent = assets.load_asset(parent_path) if assets.does_asset_exist(parent_path) else None
    if not parent:
        parent = tools.create_asset(parent_name, "/Game/Materials", u.Material, u.MaterialFactoryNew())
        node = u.MaterialEditingLibrary.create_material_expression(parent, u.MaterialExpressionVectorParameter)
        node.set_editor_property("parameter_name", "Tint")
        node.set_editor_property("default_value", u.LinearColor(0.5, 0.5, 0.5, 1))
        prop = u.MaterialProperty.MP_EMISSIVE_COLOR if glow else u.MaterialProperty.MP_BASE_COLOR
        u.MaterialEditingLibrary.connect_material_property(node, "", prop)
        if glow:
            parent.set_editor_property("shading_model", u.MaterialShadingModel.MSM_UNLIT)
        else:
            rough = u.MaterialEditingLibrary.create_material_expression(parent, u.MaterialExpressionConstant)
            rough.set_editor_property("r", 0.75)
            u.MaterialEditingLibrary.connect_material_property(rough, "", u.MaterialProperty.MP_ROUGHNESS)
        u.MaterialEditingLibrary.recompile_material(parent)
    path = "/Game/Materials/" + name
    instance = assets.load_asset(path) if assets.does_asset_exist(path) else tools.create_asset(name, "/Game/Materials", u.MaterialInstanceConstant, u.MaterialInstanceConstantFactoryNew())
    u.MaterialEditingLibrary.set_material_instance_parent(instance, parent)
    u.MaterialEditingLibrary.set_material_instance_vector_parameter_value(instance, "Tint", u.LinearColor(*color, 1))
    return instance


palette = {
    "Grass": (0.17, 0.22, 0.13), "Road": (0.035, 0.045, 0.052),
    "Stone": (0.46, 0.43, 0.35), "Cream": (0.76, 0.68, 0.51),
    "Brick": (0.32, 0.12, 0.075), "Sage": (0.23, 0.34, 0.29),
    "Roof": (0.075, 0.11, 0.14), "Wood": (0.24, 0.13, 0.065),
    "Ochre": (0.72, 0.35, 0.055), "Red": (0.46, 0.085, 0.025),
    "Gold": (0.78, 0.56, 0.12), "White": (0.85, 0.85, 0.73),
    "CarBody": (0.035, 0.28, 0.32), "Glass": (0.025, 0.075, 0.10),
    "Dark": (0.018, 0.021, 0.025), "Light": (1.0, 0.87, 0.56),
    "Tail": (0.65, 0.015, 0.005), "Beacon": (0.15, 0.86, 0.76),
}
mats = {name: material("M_" + name, color, name in ("Light", "Tail", "Beacon")) for name, color in palette.items()}
meshes = {name: assets.load_asset("/Engine/BasicShapes/" + name) for name in ("Cube", "Cylinder", "Sphere", "Cone")}
assert all(meshes.values()), "Missing engine primitives"


def shape(name, pos, size, mat, mesh="Cube", rotation=(0, 0, 0), collision=True):
    actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector(*pos), u.Rotator(*rotation))
    actor.set_actor_label(name)
    comp = actor.static_mesh_component
    comp.set_static_mesh(meshes[mesh])
    comp.set_material(0, mats[mat])
    comp.set_collision_profile_name("BlockAll" if collision else "NoCollision")
    actor.set_actor_scale3d(u.Vector(*(s / 100 for s in size)))
    return actor


def text(label, pos, yaw=180, size=65, color=(190, 240, 225, 255)):
    actor = editor.spawn_actor_from_class(u.TextRenderActor, u.Vector(*pos), u.Rotator(0, yaw, 0))
    actor.set_actor_label("Sign " + label)
    comp = actor.get_component_by_class(u.TextRenderComponent)
    comp.set_text(label)
    comp.set_world_size(size)
    comp.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
    comp.set_text_render_color(u.Color(*color))
    return actor


def tree(x, y, size=1, color="Ochre"):
    shape("Maple trunk", (x, y, 180 * size), (55 * size, 55 * size, 360 * size), "Wood", "Cylinder")
    shape("Autumn canopy", (x, y, 460 * size), (480 * size, 420 * size, 500 * size), color, "Sphere", collision=False)


shape("Neighborhood ground", (0, 0, -100), (24000, 20000, 200), "Grass")
for x in (-2500, 3000):
    shape("Avenue", (x, 0, -1), (1250, 17000, 4), "Road", collision=False)
    for side in (-1, 1):
        shape("Sidewalk", (x + side * 755, 0, 1), (240, 17000, 4), "Stone", collision=False)
    for y in range(-7800, 8200, 500):
        shape("Center dash", (x, y, 5), (12, 230, 2), "Gold", collision=False)
for y in (0, 6000):
    shape("Boulevard", (0, y, -1), (20000, 1250, 4), "Road", collision=False)
    for side in (-1, 1):
        shape("Promenade", (0, y + side * 755, 1), (20000, 240, 4), "Stone", collision=False)
    for x in range(-9500, 9500, 500):
        if abs(x + 2500) > 700 and abs(x - 3000) > 700:
            shape("Lane marking", (x, y, 7), (230, 12, 2), "Gold", collision=False)
shape("Mansion driveway", (-3500, -3000, -6), (1800, 650, 16), "Stone", collision=False)
for x in (-2500, 3000):
    for y in (0, 6000):
        for offset in range(-420, 500, 160):
            shape("Crosswalk", (x + offset, y - 510, 8), (80, 260, 2), "White", collision=False)

# A traversable original mansion, awaiting the user's Zillow reference.
shape("Mansion raised floor", (-5000, -3000, 40), (1800, 2200, 80), "Cream")
shape("Mansion rear", (-5910, -3000, 580), (40, 2200, 1000), "Cream")
for y in (-4110, -1890):
    shape("Mansion side", (-5000, y, 580), (1800, 40, 1000), "Cream")
for y in (-3700, -2300):
    shape("Mansion facade", (-4090, y, 580), (40, 800, 1000), "Cream")
    for z in (350, 800):
        shape("Mansion glazing", (-4065, y, z), (12, 460, 230), "Glass")
        for frame in (-240, 240):
            shape("Window trim", (-4050, y + frame, z), (20, 18, 250), "White")
shape("Entry lintel", (-4090, -3000, 950), (40, 600, 260), "Cream")
shape("Copper mansion roof", (-5000, -3000, 1110), (2000, 2400, 80), "Roof")
shape("Entrance portico", (-3930, -3000, 720), (400, 950, 65), "Cream")
for y in (-3400, -2600):
    shape("Portico column", (-3780, y, 380), (55, 55, 680), "White", "Cylinder")
for i in range(4):
    shape("Entrance step", (-4020 + i * 65, -3000, 40 - i * 10), (90, 600, 80 - i * 20), "Cream")
shape("Interior rug", (-5100, -3000, 82), (900, 1100, 3), "CarBody", collision=False)
shape("Sofa base", (-5600, -3000, 150), (220, 700, 100), "Sage")
shape("Sofa back", (-5680, -3000, 225), (60, 700, 160), "Sage")
shape("Coffee table", (-5300, -3000, 130), (160, 350, 90), "Wood")
text("N O R D", (-5870, -3000, 650), 0, 160)
text("YOUR STORY STARTS HERE", (-5870, -3000, 520), 0, 44)
text("MAISON / PROTOTYPE", (-4030, -3000, 1000), 0, 42)

# Small distinct streets; all foreground geometry is independently authored.
for index, (x, y) in enumerate([
    (-6800, 2300), (-5200, 2300), (-3600, 2300), (-6800, 4000), (-5200, 4000),
    (-800, 2100), (800, 2100), (-800, 4200), (800, 4200),
    (5100, -1800), (7000, -1800), (5100, -4500), (7000, -4500),
    (5100, 4300), (7000, 4300), (8800, 4300),
]):
    height = 750 + (index % 3) * 200
    wall = ("Brick", "Cream", "Sage")[index % 3]
    shape("Townhouse", (x, y, height / 2), (1100, 1200, height), wall)
    shape("Cornice", (x, y, height + 25), (1190, 1300, 70), "Cream")
    shape("Slate roof", (x, y, height + 160), (1150, 1350, 270), "Roof")
    for z in range(240, height - 50, 270):
        for dx in (-330, 0, 330):
            shape("Shop window", (x + dx, y - 607, z), (180, 12, 170), "Glass")
            shape("Window sill", (x + dx, y - 625, z - 95), (210, 40, 25), "Cream")
    shape("Door", (x, y - 612, 115), (150, 15, 230), "Wood")

for x in (-1700, 2200, 3800):
    for y in (-6200, -4600, -2500, 1400, 3200, 4900, 7400):
        tree(x, y, 0.8 + ((y // 100) % 3) * 0.1, "Red" if y % 3 else "Ochre")
for x, y in [(-6400, -4700), (-6400, -1400), (-7000, -3000), (-4300, -4800), (-4300, -1300)]:
    tree(x, y, 1.3)

shape("Riverside", (0, 9050, -18), (24000, 1800, 30), "CarBody")
shape("Stone riverbank", (0, 8050, 65), (24000, 100, 130), "Cream")
for x in range(-10000, 10000, 700):
    shape("Quay bollard", (x, 7940, 70), (35, 35, 140), "Dark", "Cylinder")
for x in range(8200, 11000, 650):
    height = 1300 + ((x // 50) % 4) * 500
    shape("Distant skyline", (x, 1000, height / 2), (450, 650, height), "Roof")

objectives = [(1000, -3200, "01 / FIND YOUR BEARINGS"), (5200, 1600, "02 / TAKE A NEW ROUTE"), (-4200, 4300, "03 / MAKE ROOM FOR FRIENDS")]
for x, y, label in objectives:
    shape("Objective plaza", (x, y, 8), (900, 900, 16), "Stone")
    shape("Mission ring", (x, y, 24), (380, 380, 25), "Beacon", "Cylinder", collision=False)
    shape("Mission beacon", (x, y, 250), (20, 20, 450), "Beacon", "Cylinder", collision=False)
    text(label, (x, y, 560), 180, 45)
    text("SAMPLE DREAM / E TO COMPLETE", (x, y, 490), 180, 22)
    tree(x - 550, y + 500, 0.8)
    shape("Park bench", (x + 470, y + 200, 60), (100, 300, 30), "Wood")

for x in (-11800, 11800):
    shape("Map boundary", (x, 0, 180), (100, 20000, 360), "Stone")
for y in (-9800, 9800):
    shape("Map boundary", (0, y, 180), (24000, 100, 360), "Stone")

for offset in (0, 170, -170, 340):
    start = editor.spawn_actor_from_class(u.PlayerStart, u.Vector(-5000, -3000 + offset, 220), u.Rotator(0, 0, 0))
    start.set_actor_label("Mansion spawn")
car_class = u.load_class(None, "/Script/Quebec.QuebecCar")
assert car_class, "Compile QuebecEditor before generating the world"
car = editor.spawn_actor_from_class(car_class, u.Vector(-3370, -3000, 120), u.Rotator(0, 0, 0))
car.set_actor_label("Your first car")

sun = editor.spawn_actor_from_class(u.DirectionalLight, u.Vector(0, 0, 3000), u.Rotator(-27, -35, 0))
sun.light_component.set_editor_property("mobility", u.ComponentMobility.MOVABLE)
sun.light_component.set_editor_property("intensity", 18000.0)
sun.light_component.set_editor_property("atmosphere_sun_light", True)
sun.light_component.set_editor_property("light_source_angle", 3.0)
editor.spawn_actor_from_class(u.SkyAtmosphere, u.Vector(0, 0, 0))
sky = editor.spawn_actor_from_class(u.SkyLight, u.Vector(0, 0, 1000))
sky.light_component.set_editor_property("mobility", u.ComponentMobility.MOVABLE)
sky.light_component.set_editor_property("real_time_capture", True)
sky.light_component.set_editor_property("intensity", 1.3)
fog = editor.spawn_actor_from_class(u.ExponentialHeightFog, u.Vector(0, 0, -100))
fog.get_component_by_class(u.ExponentialHeightFogComponent).set_editor_property("fog_density", 0.00001)
post = editor.spawn_actor_from_class(u.PostProcessVolume, u.Vector(0, 0, 0))
post.set_editor_property("unbound", True)
settings = post.get_editor_property("settings")
for key, value in {"override_auto_exposure_min_brightness": True, "override_auto_exposure_max_brightness": True,
                   "auto_exposure_min_brightness": 10.0, "auto_exposure_max_brightness": 10.0,
                   "override_auto_exposure_bias": True, "auto_exposure_bias": 0.0}.items():
    settings.set_editor_property(key, value)
post.set_editor_property("settings", settings)
lamp = editor.spawn_actor_from_class(u.PointLight, u.Vector(-5100, -3000, 700))
lamp.light_component.set_editor_property("mobility", u.ComponentMobility.MOVABLE)
lamp.light_component.set_editor_property("intensity", 12000.0)
lamp.light_component.set_editor_property("attenuation_radius", 1600.0)

u.get_editor_subsystem(u.UnrealEditorSubsystem).set_level_viewport_camera_info(u.Vector(-1200, -6500, 4500), u.Rotator(-30, 48, 0))
assets.save_directory("/Game/Materials")
assert levels.save_current_level(), "World save failed"
actors = editor.get_all_level_actors()
assert len([a for a in actors if isinstance(a, u.PlayerStart)]) == 4
assert len([a for a in actors if a.get_actor_label() == "Mission beacon"]) == 3
assert len([a for a in actors if a.get_actor_label() == "Your first car"]) == 1
u.log("NORD_WORLD_OK actors=" + str(len(actors)))
