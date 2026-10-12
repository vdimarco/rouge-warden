"""École Le Plateau: retained survey mass, authored classroom facade, no collision."""
import json
import math

from plateau_facades import _inside
import plateau_tower

ROOT = plateau_tower.ROOT
OSM_ID, CITY_ID = '27395533', '2316935'
SOURCE = 'Data/CityBuildings/Geometry/2316935.obj'
PALETTE = {'SchoolTan': ((.60, .55, .43), .9, 0),
           'SchoolFrame': ((.36, .32, .24), .65, .1),
           'SchoolGlass': ((.04, .067, .078), .23, .05),
           'SchoolTrim': ((.76, .74, .65), .82, 0)}


def build(mesh):
    vertices, edges = plateau_tower.survey_edges(ROOT / SOURCE, 1000, 51)
    survey = next(building for building in json.loads((ROOT / 'Data/CityBuildings/manifest.json').read_text())['buildings']
                  if building['id'] == CITY_ID)
    footprints = survey['footprints']
    windows, walls = 0, []
    for (a, b), height in sorted(edges.items()):
        width = math.dist(a, b)
        if width < 240:
            continue
        tangent = tuple((b[i] - a[i]) / width for i in (0, 1))
        normal = (-tangent[1], tangent[0])
        midpoint = tuple((a[i] + b[i]) / 2 for i in (0, 1))
        probe = tuple(midpoint[i] + normal[i] * 20 for i in (0, 1))
        if any(_inside(probe, footprint) for footprint in footprints):
            normal = tuple(-value for value in normal)
        yaw = math.degrees(math.atan2(tangent[1], tangent[0]))

        def box(material, along, out, z, length, depth, tall):
            mesh.box(material, (a[0] + tangent[0] * along + normal[0] * out,
                                a[1] + tangent[1] * along + normal[1] * out, z),
                     (length, depth, tall), yaw)

        # Keep each wing's actual top; classroom rhythm is an authored illustration.
        levels = 3 if height < 1800 else 4
        pitch_z = (height - 180) / levels
        bays = max(1, round(width / 285))
        pitch_x = width / bays
        for bay in range(bays):
            x = (bay + .5) * pitch_x
            pane = min(160, pitch_x - 65)
            for level in range(levels):
                z = 180 + (level + .5) * pitch_z
                tall = min(245, pitch_z * .64)
                box('SchoolFrame', x, 5, z, pane + 20, 14, tall + 20)
                box('SchoolGlass', x, 14, z, pane, 7, tall)
                box('SchoolTrim', x, 22, z, 7, 7, tall)
                box('SchoolTrim', x, 22, z + tall * .17, pane, 7, 7)
                box('SchoolTrim', x, 16, z - tall / 2 - 13, pane + 37, 36, 14)
                windows += 1
            box('SchoolTrim', x, 5, 115, min(135, pane + 5), 12, 125)
            box('SchoolGlass', x, 13, 115, min(116, pane - 10), 5, 104)
            windows += 1
        box('SchoolTrim', width / 2, 5, 26, width, 20, 52)
        box('SchoolTrim', width / 2, 7, 204, width, 20, 15)
        box('SchoolTrim', width / 2, 8, height - 23, width + 6, 27, 16)
        walls.append({'a': list(a), 'b': list(b), 'normal': list(normal),
                      'width_cm': width, 'height_cm': height, 'classroom_rows': levels,
                      'window_bays': bays})
    assert windows > 100 and walls
    return {'osm_id': OSM_ID, 'city_id': CITY_ID, 'address': '3700 Avenue Calixa-Lavallée',
            'name': 'École Le Plateau', 'source': SOURCE, 'survey_triangles': 626,
            'bounds_cm': [[operation(point[i] for point in vertices) for i in range(3)]
                          for operation in (min, max)],
            'height_cm': 2401.7206, 'windows': windows, 'walls': walls,
            'pose': {'location': [0, 0, 0], 'rotation': [0, 0, 0], 'scale': [1, 1, 1]},
            'footprint_join': {'iou': .9134, 'osm_coverage': .9547, 'city_coverage': .9548},
            'collision': False, 'retained_osm_collider_height_cm': 960,
            'limits': '2016 municipal U-shaped exterior/wing heights and roof profile. Tan masonry, classroom glazing and sills are authored estimates informed by the existing municipal atlas; not a measured elevation. Original 9.6 m OSM collider retained; no interior/upper-floor access.'}


def materials(u):
    result = plateau_tower.materials(u, {name: settings for name, settings in PALETTE.items() if name != 'SchoolTan'})
    assets, library = u.EditorAssetLibrary, u.MaterialEditingLibrary
    path = '/Game/Plateau/Materials/M_SchoolTan'
    masonry = (assets.load_asset(path) if assets.does_asset_exist(path) else
               assets.duplicate_asset('/Game/Plateau/Materials/M_Limestone', path))
    assert masonry
    tints = [node for node in library.get_material_expressions(masonry)
             if isinstance(node, u.MaterialExpressionConstant3Vector)]
    assert len(tints) == 1, 'Expected retained masonry graph with its PBR normal/roughness'
    tints[0].set_editor_property('constant', u.LinearColor(.94, .86, .66, 1))
    library.recompile_material(masonry)
    assets.save_loaded_asset(masonry)
    result['SchoolTan'] = masonry
    return result


def apply(u, import_mesh, nanite, info, palette):
    return plateau_tower.apply(u, import_mesh, nanite, info, palette,
                               source=SOURCE, city_id=CITY_ID, name='LePlateauSchool',
                               wall='SchoolTan', label='École Le Plateau')


def verify(u, info):
    return plateau_tower.verify(u, info, name='LePlateauSchool', wall='SchoolTan', label='École Le Plateau')
