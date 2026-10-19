"""Import the Plateau replica layers into the saved LaFontaine map (editor Python, host only).

Additive and refuses to run twice. Reads every Data/Plateau/ReplicaGeometry/<Layer>/manifest.json
(Streets, Soul, Plex, Props...), checks the OBJ hashes, duplicates materials (never rebuilds an
existing M_*; see the wet-street gotcha in plateau_atmosphere.py), imports each batch with the
upgrade_plateau.import_mesh semantics, enables Nanite, spawns labelled actors under the 'Replica'
folder, and instances Furniture/Soul placements of the MAP-PROPS meshes on HISM components.
The only change to an existing actor: the visual 'OSM Marking' dashes are hidden (collision and
transform unchanged) because they would poke through the new asphalt.

Host commands (see Data/Plateau/ReplicaGeometry/README.md):
  UnrealEditor-Cmd <abs>/Quebec.uproject /Game/Maps/LaFontaine -NullRHI -Unattended -NoP4 -NoSound \
    -ExecutePythonScript=<abs>/Scripts/apply_plateau_replica.py -NordPlateauReplicaBackup=<abs>/Saved/Recovery/replica-<id>
  ... same command plus -NordPlateauReplicaVerify   (fresh process: reload and check counts)
  ... -NordPlateauReplicaDryRun                       (no change; prints the plan)
Offline plan without Unreal:  python3 Scripts/apply_plateau_replica.py --dry-run
"""
import hashlib
import json
import math
from pathlib import Path
import shlex
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Scripts'))
DATA = ROOT / 'Data/Plateau/ReplicaGeometry'
MAP = '/Game/Maps/LaFontaine.LaFontaine'
MAP_FILE = Path('Content/Maps/LaFontaine.umap')
ASSETS = '/Game/Plateau/Replica'
MATERIALS = ASSETS + '/Materials'
PREFIX = 'Plateau replica '
FOLDER = 'Replica'
LAYER_ORDER = ('Streets', 'Soul', 'Plex', 'Props')
HIDE_LABELS = ('OSM Marking',)
INSTANCES_CLASS = '/Script/Quebec.QuebecReplicaInstances'
MARKER = 'NordSky'   # plateau_atmosphere.MARKER: wrapper nodes, never the authored tint
TINT_LIMIT = 8.      # light buff brick (#CCB07F) needs about 5.6x the brick texture mean
# Mean linear colour of the textures the duplicated materials multiply (measured from Data/Art).
TEXTURE_MEAN = {'asphalt_02': (.1162, .1143, .1020), 'concrete_pavement': (.2170, .1790, .1372),
                'brick_wall_001': (.1402, .0776, .0516), 'grass_ground': (.1593, .1198, .0498)}
GROUND_KEYS = ('sidewalk', 'curb', 'joint', 'alley_gutter', 'yard_soil', 'yard_path', 'soil', 'patch', 'chantier',
               'pothole', 'crack')
SHADOWLESS = ('paint', 'joint', 'curb', 'patch', 'crack', 'pothole', 'leaf', 'grass_edge', 'soil', 'rust',
              'mural', 'chantier', 'alley', 'asphalt', 'cast_iron')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def linear(hex_colour):
    values = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def load_manifests(root=ROOT, check=True):
    """Every layer manifest present, in a fixed order, with OBJ and placement hashes verified."""
    data = Path(root) / 'Data/Plateau/ReplicaGeometry'
    found = sorted(p.parent.name for p in data.glob('*/manifest.json'))
    order = [n for n in LAYER_ORDER if n in found] + [n for n in found if n not in LAYER_ORDER]
    manifests = {}
    for name in order:
        manifest = json.loads((data / name / 'manifest.json').read_text())
        assert manifest.get('layer', name) == name, name
        if check:
            for batch in manifest.get('batches', []):
                path = data / name / batch['file']
                assert path.is_file(), f'Missing {path}; run the layer generator first'
                if 'sha256' in batch:
                    assert sha(path) == batch['sha256'], f'Stale OBJ {path}'
            for rel, digest in manifest.get('source_sha256', {}).items():
                source = Path(root) / rel
                if source.is_file() and rel.endswith('.osm.xml'):
                    assert sha(source) == digest, f'Source changed since generation: {rel}'
        manifests[name] = manifest
    placements = {}
    for name in order:
        path = data / name / 'placements.json'
        if path.is_file():
            placements[name] = json.loads(path.read_text())['placements']
    return manifests, placements


def prop_key(batch, keys):
    """Prop key of a MAP-PROPS batch: an explicit 'prop' field, else the longest key in the mesh name."""
    if batch.get('prop'):
        return batch['prop']
    name = batch['mesh'][3:] if batch['mesh'].startswith('SM_') else batch['mesh']
    name = name[6:] if name.startswith('Props_') else name
    matches = [k for k in keys if name == k or name.startswith(k + '_')]
    return max(matches, key=len) if matches else None


MAIN_PARTS = ('pole', 'post', 'body', 'barrel', 'frame', 'ends', 'dock', 'base', 'case', 'platform', 'bags')


def main_part_mesh(batches):
    """The part that carries a prop's collision boxes: a named structural part, else the largest."""
    for name in MAIN_PARTS:
        for batch in batches:
            if batch.get('part') == name:
                return batch['mesh']
    volume = lambda b: math.prod(max(1., b['bounds_cm'][3 + i] - b['bounds_cm'][i]) for i in range(3))
    return max(batches, key=volume)['mesh']


def material_name(layer, key):
    return f'M_Replica_{layer}_{key}'


def base_material(key, spec):
    texture = spec.get('texture') or ''
    if spec.get('emissive_srgb'):
        # Emissive-capable parent (constant tint wired to base colour and emissive); duplicated, never edited.
        return '/Game/Plateau/Materials/M_Glow', None
    if 'asphalt' in texture:
        return '/Game/Plateau/Materials/M_Asphalt', 'asphalt_02'
    if 'brick' in texture:
        return '/Game/Plateau/Materials/M_BrickRed', 'brick_wall_001'
    if any(key.startswith(g) for g in GROUND_KEYS):
        return '/Game/Plateau/Materials/M_ConcreteDark', None
    return '/Game/Plateau/Materials/M_Trim', None


def plan(root=ROOT):
    """The full, deterministic list of what apply() creates; used by the dry run and the CPU test."""
    manifests, placements = load_manifests(root)
    props = manifests.get('Props', {'batches': []})
    keys = sorted({row['prop'] for rows in placements.values() for row in rows})
    props_meta = props.get('props', {})
    keys = sorted(set(keys) | set(props_meta))
    parts = {}
    for batch in props.get('batches', []):
        key = prop_key(batch, keys)
        if key:
            parts.setdefault(key, []).append(batch)
    colliders = {key: props_meta.get(key, {}).get('colliders_cm', []) for key in parts}
    main_part = {key: main_part_mesh(batches) for key, batches in parts.items()}
    out = {'materials': [], 'meshes': [], 'actors': [], 'instances': [], 'texts': [], 'hide': list(HIDE_LABELS),
           'missing_props': []}
    for layer, manifest in manifests.items():
        for key, spec in sorted(manifest.get('materials', {}).items()):
            base, texture = base_material(key, spec)
            out['materials'].append({'layer': layer, 'key': key, 'asset': f'{MATERIALS}/{material_name(layer, key)}',
                                     'duplicate_of': base, 'texture_mean': texture,
                                     'base_color_srgb': spec['base_color_srgb'],
                                     'emissive_srgb': spec.get('emissive_srgb'),
                                     'emissive_strength': spec.get('emissive_strength', 0.)})
        for batch in manifest.get('batches', []):
            mesh = f'{ASSETS}/{layer}/{batch["mesh"]}'
            key = prop_key(batch, keys) if layer == 'Props' else None
            out['meshes'].append({'layer': layer, 'file': batch['file'], 'asset': mesh,
                                  'material': f'{MATERIALS}/{material_name(layer, batch["material"])}',
                                  'collision': batch.get('collision', 'none'), 'triangles': batch['triangles'],
                                  # Simple box collision from MAP-PROPS colliders_cm, on the prop's main part only.
                                  'colliders': colliders.get(key, []) if key and main_part.get(key) == batch['mesh'] else []})
            if layer != 'Props':
                out['actors'].append({'label': f'{PREFIX}{layer} {batch["mesh"][3:]}', 'mesh': mesh,
                                      'folder': f'{FOLDER}/{layer}', 'collision': batch.get('collision', 'none'),
                                      'shadow': not any(t in batch['material'] for t in SHADOWLESS)})
    for layer, rows in placements.items():
        groups, missing = {}, {}
        for row in rows:
            key = row['prop']
            if key not in parts:
                missing[key] = missing.get(key, 0) + 1
                continue
            for batch in parts[key]:
                # Colour variants: one material key per placement, picked from its seed (Props/README.md).
                options = [batch['material']] + list(batch.get('variants', []))
                variant = options[row.get('variant_seed', 0) % len(options)]
                collides = bool(row.get('collision')) and main_part[key] == batch['mesh'] and bool(colliders[key])
                groups.setdefault((key, batch['mesh'], variant, collides), []).append(row)
            if key == 'sign_street':
                out['texts'].append(row)
        for key, count in sorted(missing.items()):
            out['missing_props'].append({'layer': layer, 'prop': key, 'instances': count})
        for (key, mesh, variant, collides), group in sorted(groups.items()):
            out['instances'].append({
                'label': f'{PREFIX}{layer} {key} {mesh[3:]} {variant}{" collision" if collides else ""}',
                'layer': layer, 'prop': key, 'mesh': f'{ASSETS}/Props/{mesh}',
                'material': f'{MATERIALS}/{material_name("Props", variant)}', 'variant': variant,
                'collision': collides, 'count': len(group),
                'transforms': [(r['position'], r['yaw'], r.get('scale', 1.)) for r in group]})
    out['counts'] = {'materials': len(out['materials']), 'meshes': len(out['meshes']), 'actors': len(out['actors']),
                     'emissive_materials': sum(1 for m in out['materials'] if m['emissive_srgb']),
                     'instance_components': len(out['instances']),
                     'instances': sum(i['count'] for i in out['instances'] if i['mesh']),
                     'colliding_instance_components': sum(1 for i in out['instances'] if i['collision']),
                     'meshes_with_box_collision': sum(1 for m in out['meshes'] if m['colliders']),
                     'variant_materials_used': len({i['variant'] for i in out['instances']}),
                     'street_name_texts': len(street_name_texts(out, manifests)),
                     'missing_prop_instances': sum(m['instances'] for m in out['missing_props'])}
    return out


DEFAULT_TEXT_SLOTS = {
    'blade_a': [{'face_normal': [1, 0, 0], 'generic': {'center_cm': [.33, 37., 293.8], 'size_cm': [18, 5.5]},
                 'specific': {'center_cm': [.33, 7., 285.6], 'size_cm': [78., 11]}},
                {'face_normal': [-1, 0, 0], 'generic': {'center_cm': [-.33, -37., 293.8], 'size_cm': [18, 5.5]},
                 'specific': {'center_cm': [-.33, -7., 285.6], 'size_cm': [78., 11]}}],
    'blade_b': [{'face_normal': [0, 1, 0], 'generic': {'center_cm': [37., -.33, 263.8], 'size_cm': [18, 5.5]},
                 'specific': {'center_cm': [7., -.33, 255.6], 'size_cm': [78., 11]}},
                {'face_normal': [0, -1, 0], 'generic': {'center_cm': [-37., .33, 263.8], 'size_cm': [18, 5.5]},
                 'specific': {'center_cm': [-7., .33, 255.6], 'size_cm': [78., 11]}}]}


def street_name_texts(the_plan, manifests):
    """Black TextRender rows for each sign_street blade face, from MAP-PROPS text_slots (prop-local cm)."""
    props = manifests.get('Props', {}).get('props', {})
    slots = props.get('sign_street', {}).get('text_slots', DEFAULT_TEXT_SLOTS)
    rows = []
    for row in the_plan['texts']:
        yaw = row['yaw']
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        for blade in ('blade_a', 'blade_b'):
            names = row['text'].get(blade)
            if not names:
                continue
            for face, slot in enumerate(slots.get(blade, [])):
                n = slot['face_normal']
                face_yaw = yaw + math.degrees(math.atan2(n[1], n[0]))
                for part, size in (('generic', 4.2), ('specific', 9.)):
                    text = names[part]
                    if not text:
                        continue
                    if part == 'specific':
                        size = min(size, slot[part]['size_cm'][0] / max(1, .62 * len(text)))
                    x, y, z = slot[part]['center_cm']
                    # Lift the text 0.3 cm off the blade face so it never z-fights the white plate.
                    x, y = x + .3 * n[0], y + .3 * n[1]
                    p = (row['position'][0] + x * c - y * s, row['position'][1] + x * s + y * c, row['position'][2] + z)
                    label = f'{PREFIX}street name {row["variant_seed"]} {blade} {face} {part}'
                    rows.append((row, label, p, face_yaw, text, round(size, 2)))
    return rows


# ------------------------------------------------------------------------------------------------
# Editor side

def offline(u, root):
    assert Path(u.Paths.project_dir()).resolve() == root, 'Wrong Unreal project'
    assert not u.EditorLevelLibrary.get_pie_worlds(True), 'PIE must be stopped'
    world = u.get_editor_subsystem(u.UnrealEditorSubsystem).get_editor_world()
    assert world.get_path_name() == MAP, 'Load only the saved LaFontaine map'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Refuse unsaved map changes'
    assert not u.EditorLoadingAndSavingUtils.get_dirty_content_packages(), 'Refuse unsaved asset changes'


def snapshot(actors):
    rows = {}
    for a in actors:
        loc = a.get_actor_location()
        rows[a.get_path_name()] = {'label': a.get_actor_label(), 'class': a.get_class().get_name(),
                                   'hidden': bool(a.is_hidden_ed() or a.get_editor_property('hidden')),
                                   'location': [round(loc.x, 2), round(loc.y, 2), round(loc.z, 2)]}
    return rows


def preflight(u, root, backup, the_plan):
    offline(u, root)
    assert (root / 'Saved/Recovery').resolve() in backup.parents and not backup.exists(), \
        'Use a fresh backup directory inside Saved/Recovery'
    assets = u.EditorAssetLibrary
    actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    assert not any(a.get_actor_label().startswith(PREFIX) for a in actors), 'Replica actors already exist: refusing to run twice'
    assert not assets.does_directory_exist(ASSETS), f'{ASSETS} already exists: refusing to run twice'
    for name in ('AssetImportTask', 'FbxImportUI', 'StaticMeshEditorSubsystem', 'MaterialEditingLibrary',
                 'HierarchicalInstancedStaticMeshComponent', 'TextRenderActor', 'StaticMeshActor', 'KBoxElem'):
        assert getattr(u, name, None) is not None, 'Missing Unreal API ' + name
    assert u.load_class(None, INSTANCES_CLASS), 'Build the Quebec module first: ' + INSTANCES_CLASS + ' is missing'
    for row in the_plan['materials']:
        assert assets.does_asset_exist(row['duplicate_of']), 'Missing base material ' + row['duplicate_of']
    labels = [a.get_actor_label() for a in actors]
    for label in HIDE_LABELS:
        assert labels.count(label) <= 1, 'Ambiguous actor ' + label
    return actors


def backup_map(u, root, backup, actors):
    backup.mkdir(parents=True, exist_ok=False)
    files = [MAP_FILE.with_suffix(s) for s in ('.umap', '.uexp', '.ubulk') if (root / MAP_FILE.with_suffix(s)).is_file()]
    for rel in files:
        target = backup / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / rel, target)
    (backup / 'original-actors.json').write_text(json.dumps(snapshot(actors), indent=1) + '\n')
    manifest = {str(p): sha(backup / p) for p in files}
    manifest['original-actors.json'] = sha(backup / 'original-actors.json')
    (backup / 'backup-manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    return [str(p) for p in files]


def make_material(u, row, spec):
    """Duplicate a base material and set its single tint; fall back to a fresh constant material."""
    assets, lib = u.EditorAssetLibrary, u.MaterialEditingLibrary
    colour = linear(spec['base_color_srgb'])
    mat = assets.duplicate_asset(row['duplicate_of'], row['asset'])
    tints = authored_tints(u, mat) if mat else []
    if mat and len(tints) == 1:
        if row['texture_mean']:
            mean = TEXTURE_MEAN[row['texture_mean']]
            colour = tuple(min(TINT_LIMIT, c / m) for c, m in zip(colour, mean))
        tints[0].set_editor_property('constant', u.LinearColor(*colour, 1))
        if spec.get('emissive_srgb'):
            emissive_input(u, mat, spec, tints[0])
    else:
        if mat:
            assets.delete_asset(row['asset'])
        folder, name = row['asset'].rsplit('/', 1)
        mat = u.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, u.Material, u.MaterialFactoryNew())
        tint = lib.create_material_expression(mat, u.MaterialExpressionConstant3Vector)
        tint.set_editor_property('constant', u.LinearColor(*colour, 1))
        lib.connect_material_property(tint, '', u.MaterialProperty.MP_BASE_COLOR)
        for value, prop in ((spec.get('roughness', .8), u.MaterialProperty.MP_ROUGHNESS),
                            (spec.get('metallic', 0.), u.MaterialProperty.MP_METALLIC)):
            node = lib.create_material_expression(mat, u.MaterialExpressionConstant)
            node.set_editor_property('r', value)
            lib.connect_material_property(node, '', prop)
        if spec.get('emissive_srgb'):
            emissive_input(u, mat, spec, tint)
    for usage in (u.MaterialUsage.MATUSAGE_NANITE, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES):
        lib.set_base_material_usage(mat, usage, True)
    lib.recompile_material(mat)
    assert assets.save_loaded_asset(mat, only_if_is_dirty=False)
    return mat


def authored_tints(u, mat):
    """Constant3Vector nodes that are not NordSky wrapper nodes (the rain pass adds a flat-normal one to M_Asphalt)."""
    return [n for n in u.MaterialEditingLibrary.get_material_expressions(mat)
            if isinstance(n, u.MaterialExpressionConstant3Vector) and str(n.get_editor_property('desc')) != MARKER]


def emissive_input(u, mat, spec, tint):
    """Emissive = colour x EmissiveStrength (scalar parameter), still x the NordSky WindowGlow night factor.

    M_Glow's emissive runs tint -> NordSky Multiply(tint, WindowGlow) [-> other wrappers]. The new product
    replaces the tint on that wrapper's A input, so the night behaviour is kept. A material without the
    wrapper (the fresh-material fallback) gets plateau_atmosphere.night_window.
    """
    lib = u.MaterialEditingLibrary
    colour = lib.create_material_expression(mat, u.MaterialExpressionConstant3Vector)
    colour.set_editor_property('constant', u.LinearColor(*linear(spec['emissive_srgb']), 1))
    strength = lib.create_material_expression(mat, u.MaterialExpressionScalarParameter)
    strength.set_editor_property('parameter_name', 'EmissiveStrength')
    strength.set_editor_property('default_value', float(spec.get('emissive_strength', 1.)))
    product = lib.create_material_expression(mat, u.MaterialExpressionMultiply)
    assert lib.connect_material_expressions(colour, '', product, 'A')
    assert lib.connect_material_expressions(strength, '', product, 'B')
    node, wrapper = lib.get_material_property_input_node(mat, u.MaterialProperty.MP_EMISSIVE_COLOR), None
    for _ in range(8):
        if node is None or str(node.get_editor_property('desc')) != MARKER:
            break
        inputs = [n for n in lib.get_inputs_for_material_expression(mat, node) if n]
        if any(n == tint for n in inputs):
            wrapper = node
            break
        nested = [n for n in inputs if str(n.get_editor_property('desc')) == MARKER]
        node = nested[0] if nested else None
    if wrapper is not None:
        assert lib.connect_material_expressions(product, '', wrapper, 'A')
    else:
        import plateau_atmosphere
        assert lib.connect_material_property(product, '', u.MaterialProperty.MP_EMISSIVE_COLOR)
        mpc = u.EditorAssetLibrary.load_asset(plateau_atmosphere.COLLECTION)
        if mpc:
            plateau_atmosphere.night_window(u, mat, mpc)


def add_box_collision(u, mesh, colliders):
    """Simple box elements from MAP-PROPS colliders_cm (prop-local cm, Unreal axes), replacing any others."""
    body = mesh.get_editor_property('body_setup')
    geometry = body.get_editor_property('agg_geom')
    boxes = []
    for collider in colliders:
        box = u.KBoxElem()
        box.set_editor_property('center', u.Vector(*collider['center']))
        sx, sy, sz = collider['size']
        box.set_editor_property('x', float(sx))
        box.set_editor_property('y', float(sy))
        box.set_editor_property('z', float(sz))
        boxes.append(box)
    geometry.set_editor_property('box_elems', boxes)
    body.set_editor_property('agg_geom', geometry)
    body.set_editor_property('collision_trace_flag', u.CollisionTraceFlag.CTF_USE_DEFAULT)
    assert len(body.get_editor_property('agg_geom').get_editor_property('box_elems')) == len(colliders), mesh.get_path_name()


def import_mesh(u, source, destination, name, material, collision, colliders=()):
    task = u.AssetImportTask()
    task.filename, task.destination_path, task.destination_name = str(source), destination, name
    task.automated, task.save, task.replace_existing = True, False, False
    options = u.FbxImportUI()
    options.import_mesh, options.import_materials, options.import_textures = True, False, False
    options.import_as_skeletal = False
    options.static_mesh_import_data.combine_meshes = True
    options.static_mesh_import_data.auto_generate_collision = False
    task.options = options
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    assert task.imported_object_paths, str(source)
    mesh = u.EditorAssetLibrary.load_asset(task.imported_object_paths[0])
    assert isinstance(mesh, u.StaticMesh), str(source)
    mesh.set_material(0, material)
    subsystem = u.get_editor_subsystem(u.StaticMeshEditorSubsystem)
    build = subsystem.get_lod_build_settings(mesh, 0)
    build.set_editor_property('max_lumen_mesh_cards', 64)
    build.set_editor_property('generate_distance_field_as_if_two_sided', True)
    subsystem.set_lod_build_settings(mesh, 0, build)
    if collision != 'none':
        mesh.get_editor_property('body_setup').set_editor_property('collision_trace_flag',
                                                                   u.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
    if colliders:
        add_box_collision(u, mesh, colliders)
    settings = mesh.get_editor_property('nanite_settings')
    settings.set_editor_property('enabled', True)
    # Exact fallback keeps complex-as-simple collision identical to the authored curbs.
    settings.set_editor_property('fallback_target', u.NaniteFallbackTarget.PERCENT_TRIANGLES)
    settings.set_editor_property('fallback_percent_triangles', 1.)
    settings.set_editor_property('fallback_relative_error', 0.)
    subsystem.set_nanite_settings(mesh, settings, True)
    assert u.EditorAssetLibrary.save_loaded_asset(mesh, only_if_is_dirty=False)
    return mesh


def instanced_actor(u, editor, label, folder):
    """An AQuebecReplicaInstances actor (Source/Quebec/QuebecReplicaInstances.h): its root is a static HISM."""
    actor = editor.spawn_actor_from_class(u.load_class(None, INSTANCES_CLASS), u.Vector(0., 0., 0.), u.Rotator())
    assert actor, INSTANCES_CLASS
    actor.set_actor_label(label)
    actor.set_folder_path(folder)
    component = actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
    assert component is not None, label
    return actor, component


def apply(u, root, backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    the_plan = plan(root)
    manifests, placements = load_manifests(root)
    actors = preflight(u, root, backup, the_plan)
    map_files = backup_map(u, root, backup, actors)
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    report = {'passed': False, 'map': MAP, 'backup': str(backup.relative_to(root)), 'map_package_files': map_files,
              'plan_counts': the_plan['counts'], 'materials': {}, 'actors': {}, 'instances': {}, 'texts': 0,
              'hidden': {}, 'missing_props': the_plan['missing_props'],
              'manifest_sha256': {n: sha(root / 'Data/Plateau/ReplicaGeometry' / n / 'manifest.json') for n in manifests}}
    try:
        materials = {}
        for row in the_plan['materials']:
            spec = manifests[row['layer']]['materials'][row['key']]
            materials[row['asset']] = make_material(u, row, spec)
            report['materials'][row['asset']] = row['duplicate_of']
        meshes = {}
        for row in the_plan['meshes']:
            folder, name = row['asset'].rsplit('/', 1)
            source = root / 'Data/Plateau/ReplicaGeometry' / row['layer'] / row['file']
            meshes[row['asset']] = import_mesh(u, source, folder, name, materials[row['material']], row['collision'],
                                               row['colliders'])
        by_mesh = {m['asset']: m for m in the_plan['meshes']}
        for row in the_plan['actors']:
            actor = editor.spawn_actor_from_class(u.StaticMeshActor, u.Vector(0., 0., 0.), u.Rotator())
            actor.set_actor_label(row['label'])
            actor.set_folder_path(row['folder'])
            c = actor.static_mesh_component
            c.set_static_mesh(meshes[row['mesh']])
            c.set_material(0, materials[by_mesh[row['mesh']]['material']])
            # Asphalt stays NoCollision here; QuebecGameplay promotes SM_Asphalt* to Visibility-only at BeginPlay.
            c.set_collision_profile_name('BlockAll' if row['collision'] != 'none' else 'NoCollision')
            c.set_cast_shadow(row['shadow'])
            report['actors'][row['label']] = actor.get_path_name()
        for row in the_plan['instances']:
            if not row['mesh']:
                continue
            actor, comp = instanced_actor(u, editor, row['label'], f'{FOLDER}/{row["layer"]} instances')
            comp.set_static_mesh(meshes[row['mesh']])
            comp.set_material(0, materials[row['material']])
            comp.set_collision_profile_name('BlockAll' if row['collision'] else 'NoCollision')
            comp.set_cull_distances(9000, 12000)
            comp.set_cast_shadow(row['prop'] in ('lamp_cobra', 'lamp_park', 'utility_pole', 'bixi_dock', 'bench'))
            transforms = [u.Transform(u.Vector(*p), u.Rotator(roll=0., pitch=0., yaw=yaw), u.Vector(s, s, s))
                          for p, yaw, s in row['transforms']]
            comp.add_instances(transforms, False, True, False)
            assert comp.get_instance_count() == row['count'], row['label']
            report['instances'][row['label']] = {'actor': actor.get_path_name(), 'count': row['count']}
        black = u.EditorAssetLibrary.load_asset('/Engine/EngineMaterials/DefaultTextMaterialOpaque')
        for row, label, p, yaw, text, size in street_name_texts(the_plan, manifests):
            t = editor.spawn_actor_from_class(u.TextRenderActor, u.Vector(*p), u.Rotator(roll=0., pitch=0., yaw=yaw))
            t.set_actor_label(label)
            t.set_folder_path(f'{FOLDER}/Street names')
            comp = t.text_render
            comp.set_text(text)
            comp.set_world_size(size)
            comp.set_horizontal_alignment(u.HorizTextAligment.EHTA_CENTER)
            comp.set_vertical_alignment(u.VerticalTextAligment.EVRTA_TEXT_CENTER)
            comp.set_text_render_color(u.Color(17, 17, 17, 255))
            if black:
                comp.set_text_material(black)
            report['texts'] += 1
        for actor in editor.get_all_level_actors():
            if actor.get_actor_label() in HIDE_LABELS:
                report['hidden'][actor.get_actor_label()] = {'path': actor.get_path_name(),
                                                             'was_hidden_in_game': bool(actor.get_editor_property('hidden'))}
                actor.set_actor_hidden_in_game(True)
        assert u.get_editor_subsystem(u.LevelEditorSubsystem).save_current_level()
        report['passed'] = True
    except Exception as error:
        report['error'] = repr(error)
        raise
    finally:
        (backup / 'apply-report.json').write_text(json.dumps(report, indent=1) + '\n')
    return report


def verify(u, root, backup):
    """Fresh process: reload the saved map and check every planned actor, mesh, material and count."""
    root, backup = Path(root).resolve(), Path(backup).resolve()
    offline(u, root)
    report = json.loads((backup / 'apply-report.json').read_text())
    assert report['passed'], 'The apply step did not pass'
    the_plan = plan(root)
    assert the_plan['counts'] == report['plan_counts'], 'Manifests changed since the apply step'
    level_actors = u.get_editor_subsystem(u.EditorActorSubsystem).get_all_level_actors()
    actors = {a.get_actor_label(): a for a in level_actors}
    by_mesh = {m['asset']: m for m in the_plan['meshes']}
    # Existing actors: only the hidden flag of HIDE_LABELS may differ from the pre-apply snapshot.
    before = json.loads((backup / 'original-actors.json').read_text())
    now = snapshot(level_actors)
    for path, row in before.items():
        assert path in now, 'An existing actor disappeared: ' + row['label']
        changed = {k for k in row if now[path][k] != row[k]}
        allowed = {'hidden'} if row['label'] in HIDE_LABELS else set()
        assert changed <= allowed, f'Existing actor {row["label"]} changed: {sorted(changed)}'
    added = [p for p in now if p not in before]
    assert all(now[p]['label'].startswith(PREFIX) for p in added), 'Unexpected new actor outside the replica layer'
    checked = 0
    for row in the_plan['actors']:
        actor = actors.get(row['label'])
        assert actor is not None, 'Missing actor ' + row['label']
        c = actor.static_mesh_component
        mesh = c.static_mesh
        name = row['mesh'].rsplit('/', 1)[1]
        assert mesh.get_path_name() == f'{row["mesh"]}.{name}', row['label']
        # The CPU test rejects float32-degenerate triangles up front; allow a sliver of import-side welding.
        planned = by_mesh[row['mesh']]['triangles']
        assert abs(mesh.get_num_triangles(0) - planned) <= max(2, planned // 1000), row['label']
        assert mesh.get_editor_property('nanite_settings').enabled, row['label']
        expected = 'BlockAll' if row['collision'] != 'none' else 'NoCollision'
        assert str(c.get_collision_profile_name()) == expected, row['label']
        material = by_mesh[row['mesh']]['material']
        assert c.get_material(0).get_path_name().split('.')[0] == material, row['label']
        assert actor.get_actor_location().length() < .1
        checked += 1
    instances = 0
    for row in the_plan['instances']:
        if not row['mesh']:
            continue
        actor = actors.get(row['label'])
        assert actor is not None, 'Missing instanced actor ' + row['label']
        comp = actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
        assert comp and comp.get_instance_count() == row['count'], row['label']
        assert comp.get_material(0).get_path_name().split('.')[0] == row['material'], row['label']
        assert str(comp.get_collision_profile_name()) == ('BlockAll' if row['collision'] else 'NoCollision'), row['label']
        if row['collision']:
            boxes = comp.get_static_mesh().get_editor_property('body_setup').get_editor_property('agg_geom') \
                .get_editor_property('box_elems')
            assert len(boxes) == len(by_mesh[row['mesh']]['colliders']) > 0, row['label'] + ' has no simple collision'
        instances += row['count']
    assets = u.EditorAssetLibrary
    for row in the_plan['materials']:
        mat = assets.load_asset(row['asset'])
        assert mat, 'Missing material ' + row['asset']
        if row['emissive_srgb']:
            params = [n for n in u.MaterialEditingLibrary.get_material_expressions(mat)
                      if isinstance(n, u.MaterialExpressionScalarParameter)
                      and str(n.get_editor_property('parameter_name')) == 'EmissiveStrength']
            assert len(params) == 1 and abs(params[0].get_editor_property('default_value') - row['emissive_strength']) < 1e-3, row['asset']
        nodes = u.MaterialEditingLibrary.get_material_expressions(mat)
        collection = {str(n.get_editor_property('parameter_name')) for n in nodes
                      if isinstance(n, u.MaterialExpressionCollectionParameter)}
        if row['emissive_srgb']:
            assert 'WindowGlow' in collection, row['asset'] + ' lost the NordSky night glow'
        if row['texture_mean']:
            assert any(isinstance(n, u.MaterialExpressionTextureSample) for n in nodes), row['asset'] + ' lost its texture'
        if 'M_Asphalt' in row['duplicate_of'] or 'M_ConcreteDark' in row['duplicate_of']:
            assert 'Wetness' in collection, row['asset'] + ' lost the NordSky wet-street wrapper'
    texts = sum(1 for label in actors if label.startswith(PREFIX + 'street name '))
    assert texts == report['texts'], 'Street-name text count changed'
    for label in HIDE_LABELS:
        if label in report['hidden']:
            assert actors[label].get_editor_property('hidden'), label + ' is visible again'
    result = {'passed': True, 'actors': checked, 'instances': instances, 'texts': texts,
              'missing_props': report['missing_props']}
    (backup / 'verify-report.json').write_text(json.dumps(result, indent=1) + '\n')
    return result


def main():
    if '--dry-run' in sys.argv:
        the_plan = plan(ROOT)
        print(json.dumps({'counts': the_plan['counts'], 'missing_props': the_plan['missing_props'],
                          'hide': the_plan['hide']}, indent=1))
        return
    import unreal as u
    root = Path(u.Paths.project_dir()).resolve()
    args = shlex.split(u.SystemLibrary.get_command_line())
    if '-NordPlateauReplicaDryRun' in args:
        the_plan = plan(root)
        u.log('PLATEAU_REPLICA_PLAN ' + json.dumps(the_plan['counts']))
        return
    values = [a.split('=', 1)[1] for a in args if a.startswith('-NordPlateauReplicaBackup=')]
    assert len(values) == 1, 'Pass one -NordPlateauReplicaBackup=<abs Saved/Recovery path>'
    if '-NordPlateauReplicaVerify' in args:
        result = verify(u, root, values[0])
    else:
        assert '-nullrhi' in [a.lower() for a in args], 'Author in a fresh -NullRHI process'
        result = apply(u, root, values[0])
        result = {k: result[k] for k in ('passed', 'plan_counts', 'texts', 'missing_props')}
    u.log('PLATEAU_REPLICA_OK ' + json.dumps(result))


if __name__ == '__main__':
    main()
