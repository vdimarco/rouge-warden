"""Import the Plateau replica layers into the saved LaFontaine map (editor Python, host only).

Additive and refuses to run twice. Reads every Data/Plateau/ReplicaGeometry/<Layer>/manifest.json
(Streets, Soul, Plex, Props...), checks the OBJ hashes, imports the texture sets of
Scripts/plateau_textures.py that the manifests use (greystone, slate, even buff brick, and the rear pass's roofs,
siding, parging, cut-out guards and fences, creeper and yard ground) and the macro-variation mask, builds the
masked two-sided parent the cut-out keys need, duplicates materials (never rebuilds an
existing M_*; see the wet-street gotcha in plateau_atmosphere.py), imports each batch with the
upgrade_plateau.import_mesh semantics, enables Nanite (Preserve Area on masked batches), spawns labelled actors
under the 'Replica' folder (Collision_Only batches on actors hidden in game that block pawns and ignore the camera
and visibility), instances Furniture/Soul placements of the MAP-PROPS meshes on HISM components, and instances
the Plex yard trees (Plex/yard_trees.json, when present): on one imported mesh per species when
Trees/manifest.json exists, else on the mapped trees' mesh.
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
import re
import shlex
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Scripts'))
import plateau_textures  # noqa: E402  stdlib only: the texture sets, their shared keys and surfaces
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
# Replica texture sets: tileable PNGs from Scripts/plateau_textures.py, imported next to the replica materials.
# Each material duplicates the parent of its set's surface with the three texture samples swapped and the UV
# tiling set to 1 / tile_m (replica OBJ UVs are metres; cards are metres along the run by 0..1 up the card):
#   wall    M_BrickRed (greystone, slate, siding, parging, sheet metal): the brick graph, no NordSky wrapper
#   ground  M_Gravel (roofs and yards): the same graph with the NordSky wet-ground wrapper, so they darken in rain
#   cutout  M_Replica_CutoutParent, built here: masked, two-sided, OpacityMask from the diffuse alpha
#   foliage M_Replica_FoliageParent, built here: as cutout, with the two-sided foliage shading model
TEXTURES = 'Textures'                      # folder under Data/Plateau/ReplicaGeometry
TEXTURE_INDEX = 'textures.json'
TEXTURE_ASSETS = ASSETS + '/Textures'
TEXTURE_ROLES = ('diff', 'nor_dx', 'rough')
MACRO_ROLE = 'mask'                        # T_Replica_Macro_mask: the macro-variation mask (plateau_textures.MACRO)
MACRO_DESC = 'Replica macro'               # desc of the nodes add_macro adds, so verify can find them
# Card sets (u along the run, v 0..1 up the card) clamp V: the top row of a baluster card is opaque and the bottom
# row (the drain gap) clear, and with the default wrap the lower mips would blend the two into a dashed line.
CARD_ADDRESS_Y = 'TA_CLAMP'
TEXTURED_PARENT = '/Game/Plateau/Materials/M_BrickRed'
WET_PARENT = '/Game/Plateau/Materials/M_Gravel'
CUTOUT_PARENT = MATERIALS + '/M_Replica_CutoutParent'
FOLIAGE_PARENT = MATERIALS + '/M_Replica_FoliageParent'
SURFACE_PARENTS = {'wall': TEXTURED_PARENT, 'ground': WET_PARENT, 'cutout': CUTOUT_PARENT, 'foliage': FOLIAGE_PARENT}
BUILT_PARENTS = (CUTOUT_PARENT, FOLIAGE_PARENT)   # made by this step; Content has no masked parent to duplicate
WET_PARENTS = ('/M_Asphalt', '/M_ConcreteDark', '/M_Gravel')
FOLIAGE_SUBSURFACE = .65                   # as refine_plateau_trees: transmission = base colour x .65
# Material keys (case-insensitive) that take a replica texture set; Stone_Cast stays a smooth flat colour.
TEXTURE_SET_KEYS = {'limestone': ('stone', 'limestone', 'greystone'), 'slate': ('slate', 'roof_slate')}
# The shared keys of the rear pass, exactly as plateau_plex.py writes them (case-sensitive): key -> set.
SHARED_TEXTURE_KEYS = {key: name for name, spec in plateau_textures.SETS.items() for key in spec['keys']}
# Yard trees (Plex/yard_trees.json: [{x, y, z, yaw, scale, kind}], replica frame, cm) on the tree mesh the saved
# map already instances 4,571 times (plateau_rendering.py, QuebecVegetation). Those trees have no collision,
# so these have none either. Each kind is one AQuebecReplicaInstances actor; the value widens or narrows the
# crown of the shared mesh (scale x value on X and Y, scale on Z) so the kinds do not read as clones.
YARD_TREES = 'Plex/yard_trees.json'
TREE_MESH = '/Game/Art/Tree/tree_small_02/StaticMeshes/tree_small_02'
TREE_MESH_HEIGHT_CM = 455.                 # the shared mesh at scale 1; a row's scale is a multiple of this height
# Fallback crown factors (X and Y) per kind on the shared mesh; the old kinds come first, as plateau_plex wrote them.
TREE_KINDS = {'maple': 1.15, 'ash': .9, 'elm': 1.05, 'small': 1., 'norway_maple': 1.15, 'silver_maple': 1.2,
              'honey_locust': 1.1, 'linden': 1.05}
TREE_CULL_CM = (40000, 65000)              # QuebecVegetation's cull distances for the mapped trees
# Species meshes (Trees/manifest.json, from the Blender tree generator): when present, each yard tree uses its
# species' own mesh, uniformly scaled to the row's height, instead of the shared mesh with a crown factor.
TREES = 'Trees'
TREE_SPECIES = ('norway_maple', 'silver_maple', 'honey_locust', 'linden', 'ash', 'small')
TREE_ALIASES = {'maple': 'norway_maple', 'elm': 'linden'}
TREE_SLOTS = ('bark', 'leaves')
PRESERVE_AREA = 'PRESERVE_AREA'            # Nanite shape preservation for masked cards, creeper and tree leaves
COLLISION_ONLY = 'Collision_Only'          # invisible walls (gallery guards): collide, never render
GROUND_KEYS = ('sidewalk', 'curb', 'joint', 'alley_gutter', 'yard_soil', 'yard_path', 'soil', 'patch', 'chantier',
               'pothole', 'crack')
# Material keys whose batches cast no shadow (flat decals and ground), matched as a whole key or a prefix before '_'
# (rust, rust_streak), never as a substring: the ruelle-verte plant_rust plants cast shadows like every plant_*.
SHADOWLESS = ('paint', 'joint', 'curb', 'patch', 'crack', 'pothole', 'leaf', 'grass_edge', 'soil', 'rust',
              'mural', 'chantier', 'alley', 'asphalt', 'cast_iron', COLLISION_ONLY)


def casts_shadow(key):
    return not any(key == t or key.startswith(t + '_') for t in SHADOWLESS)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def linear(hex_colour):
    values = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def load_manifests(root=ROOT, check=True):
    """Every layer manifest present, in a fixed order, with OBJ and placement hashes verified."""
    data = Path(root) / 'Data/Plateau/ReplicaGeometry'
    # Trees/manifest.json describes species meshes, not a layer of batches (load_tree_kinds reads it).
    found = sorted(p.parent.name for p in data.glob('*/manifest.json') if p.parent.name != TREES)
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


def texture_set(key, spec):
    """The replica texture set ('limestone', 'slate', 'siding', 'creeper'...) a material key takes, else None.

    A manifest texture path naming a replica map wins; then the shared rear-pass keys (exact names); then the
    older greystone and slate name rule.
    """
    texture = (spec.get('texture') or '').lower()
    for name, entry in plateau_textures.SETS.items():
        if f't_replica_{entry["name"].lower()}_' in texture or f'replica_{name}' in texture:
            return name
    if key in SHARED_TEXTURE_KEYS:
        return SHARED_TEXTURE_KEYS[key]
    k = key.lower()
    for name, keys in TEXTURE_SET_KEYS.items():
        if k in keys or any(k.startswith(n + '_') and n != 'stone' for n in keys):
            return name
    return None


def base_material(key, spec):
    texture = spec.get('texture') or ''
    if spec.get('emissive_srgb'):
        # Emissive-capable parent (constant tint wired to base colour and emissive); duplicated, never edited.
        return '/Game/Plateau/Materials/M_Glow', None
    if 'asphalt' in texture:
        return '/Game/Plateau/Materials/M_Asphalt', 'asphalt_02'
    if 'brick' in texture:
        return '/Game/Plateau/Materials/M_BrickRed', 'brick_wall_001'
    textured = texture_set(key, spec)
    if textured:
        return SURFACE_PARENTS[plateau_textures.SETS[textured]['surface']], 'replica_' + textured
    if any(key.startswith(g) for g in GROUND_KEYS):
        return '/Game/Plateau/Materials/M_ConcreteDark', None
    return '/Game/Plateau/Materials/M_Trim', None


def load_textures(root=ROOT):
    """textures.json of Scripts/plateau_textures.py, with each PNG's image stream checked against it.

    The check hashes the decompressed stream (raw_sha256), so a PNG rebuilt with another zlib still
    passes; the plan records the file's own sha256 as well. Returns {} when the folder was never built.
    """
    import plateau_textures
    folder = Path(root) / 'Data/Plateau/ReplicaGeometry' / TEXTURES
    if not (folder / TEXTURE_INDEX).is_file():
        return {}
    index = json.loads((folder / TEXTURE_INDEX).read_text())
    sets = {}
    for name, entry in sorted(index['sets'].items()):
        for role in TEXTURE_ROLES:
            row = entry['maps'][role]
            path = folder / row['file']
            assert path.is_file(), f'Missing {path}; run python3 Scripts/plateau_textures.py'
            data = path.read_bytes()
            width, height, raw = plateau_textures.read_png(data)
            assert [width, height] == entry['size_px'], f'Wrong size {path}'
            assert hashlib.sha256(raw).hexdigest() == row['raw_sha256'], f'Stale texture {path}'
            row['file_sha256'] = hashlib.sha256(data).hexdigest()
        sets[name] = entry
    return sets


def load_macro(root=ROOT):
    """The macro-variation mask of textures.json (plateau_textures.MACRO), its image stream checked; None when the
    folder or an older index has none."""
    import plateau_textures
    folder = Path(root) / 'Data/Plateau/ReplicaGeometry' / TEXTURES
    if not (folder / TEXTURE_INDEX).is_file():
        return None
    entry = json.loads((folder / TEXTURE_INDEX).read_text()).get('macro')
    if not entry:
        return None
    path = folder / entry['file']
    assert path.is_file(), f'Missing {path}; run python3 Scripts/plateau_textures.py'
    data = path.read_bytes()
    width, height, raw = plateau_textures.read_png(data)
    assert [width, height] == entry['size_px'], f'Wrong size {path}'
    assert hashlib.sha256(raw).hexdigest() == entry['raw_sha256'], f'Stale texture {path}'
    return dict(entry, file_sha256=hashlib.sha256(data).hexdigest())


def set_material(name, entry):
    """Plan fields of a replica texture set: its maps, tiling, mean colour and how its material is built.

    The material block comes from textures.json (plateau_textures.SURFACES); an index written before it had one
    falls back to the generator's table, so greystone and slate keep their opaque, one-sided brick parent.
    """
    surface = entry.get('surface') or plateau_textures.SETS[name]['surface']
    material = entry.get('material') or plateau_textures.SURFACES[surface]
    out = {'texture_set': name, 'surface': surface, 'mean_linear': entry['mean_linear'], 'tiling': entry['tiling'],
           'uv': entry.get('uv', 'metres'),
           'textures': {role: f'{TEXTURE_ASSETS}/{Path(entry["maps"][role]["file"]).stem}' for role in TEXTURE_ROLES},
           'blend_mode': material['blend_mode'], 'two_sided': bool(material['two_sided']),
           'shading_model': material['shading_model'], 'opacity_mask_clip': material.get('opacity_mask_clip')}
    macro = entry.get('macro')
    if macro:
        # Macro variation: the tint x lerp(1 - s, 1 + s, R) at the first macro tile x lerp(...) of G at the second.
        out['macro'] = {'texture': f'{TEXTURE_ASSETS}/{Path(macro["file"]).stem}', 'strength': list(macro['strength']),
                        'tiling': [[round(1. / t, 6)] * 2 for t in macro['tile_m']], 'channels': list(macro['channels'])}
    return out


def load_yard_trees(root=ROOT):
    """Rows of Plex/yard_trees.json, checked; None when plateau_plex.py has not written the file yet.

    Each row is {x, y, z, yaw, scale, kind}: replica frame (x east, y north, z up, cm), yaw in degrees, scale on
    the shared tree mesh (about 4.55 m tall and 3 to 4.3 m across at 1), kind one of TREE_KINDS (the old maple and
    elm stand for norway_maple and linden), and optionally height_cm (else scale x 4.55 m). A file holding
    {"trees": [...]} is read the same way. Each row also carries its species and target height.
    """
    path = Path(root) / 'Data/Plateau/ReplicaGeometry' / YARD_TREES
    if not path.is_file():
        return None
    rows = json.loads(path.read_text())
    if isinstance(rows, dict):
        rows = rows.get('trees', [])
    out = []
    for n, row in enumerate(rows):
        kind = row.get('kind')
        assert kind in TREE_KINDS, f'{YARD_TREES} row {n}: kind {kind!r} is not one of {sorted(TREE_KINDS)}'
        x, y, z, yaw, scale = (float(row[k]) for k in ('x', 'y', 'z', 'yaw', 'scale'))
        assert all(math.isfinite(v) for v in (x, y, z, yaw, scale)), f'{YARD_TREES} row {n}: {row}'
        assert 0. < scale <= 6. and abs(z) < 2000., f'{YARD_TREES} row {n}: scale {scale}, z {z}'
        height = float(row.get('height_cm', scale * TREE_MESH_HEIGHT_CM))
        assert math.isfinite(height) and 100. <= height <= 3500., f'{YARD_TREES} row {n}: height {height}'
        out.append({'kind': kind, 'species': TREE_ALIASES.get(kind, kind), 'position': (x, y, z), 'yaw': yaw % 360.,
                    'scale': scale, 'height_cm': height})
    return out


def load_tree_kinds(root=ROOT):
    """Trees/manifest.json (the Blender tree generator): {species: {obj, materials {bark, leaves}, height_cm,
    trunk_cm}}, under "kinds" or at the top level, with an optional top-level "materials" table. Checked; None
    when the file does not exist, and the yard trees then keep the shared mesh.

    A slot's material is a spec ({base_color_srgb, roughness, metallic, optional texture as for any layer key,
    optional foliage}), the name of a spec in the top-level "materials" table, or an existing /Game/ material.
    """
    folder = Path(root) / 'Data/Plateau/ReplicaGeometry' / TREES
    path = folder / 'manifest.json'
    if not path.is_file():
        return None
    manifest = json.loads(path.read_text())
    wrapped = 'kinds' in manifest
    kinds = manifest['kinds'] if wrapped else manifest
    table = manifest.get('materials', {}) if isinstance(manifest.get('materials'), dict) else {}
    out = {}
    for species in sorted(kinds):
        spec = kinds[species]
        if species not in TREE_SPECIES:
            assert not wrapped, f'{TREES}/manifest.json: unknown tree kind {species!r}'
            continue
        obj = folder / spec['obj'] if (folder / spec['obj']).is_file() else folder.parent / spec['obj']
        assert obj.is_file(), f'Missing {obj}; run the tree generator first'
        digest = sha(obj)
        if 'sha256' in spec:
            assert spec['sha256'] == digest, f'Stale tree mesh {obj}'
        height, trunk = float(spec['height_cm']), float(spec['trunk_cm'])
        assert math.isfinite(height) and math.isfinite(trunk) and 200. <= height <= 4000. and 2. <= trunk <= 300., \
            f'{species}: height {height} cm, trunk {trunk} cm'
        slots = spec['materials']
        assert sorted(slots) == sorted(TREE_SLOTS), f'{species}: material slots {sorted(slots)}, want {list(TREE_SLOTS)}'
        refs = {}
        for slot in TREE_SLOTS:
            value = slots[slot]
            if isinstance(value, str) and value.startswith('/Game/'):
                refs[slot] = {'existing': value.split('.')[0]}
            else:
                key, mat = (value, table.get(value)) if isinstance(value, str) else (f'{species}_{slot}', value)
                assert isinstance(mat, dict) and re.match(r'^#[0-9A-Fa-f]{6}$', mat.get('base_color_srgb', '')), \
                    f'{species} {slot}: material {value!r} is not a spec with base_color_srgb'
                refs[slot] = {'key': key, 'spec': mat}
        out[species] = {'obj': obj.relative_to(folder.parent).as_posix(), 'sha256': digest, 'height_cm': height,
                        'trunk_cm': trunk, 'materials': refs}
    assert out, f'{TREES}/manifest.json lists no tree kinds'
    return out


def tree_mesh_asset(species):
    return f'{ASSETS}/{TREES}/SM_Tree_{species}'


def plan_trees(rows, kinds=None):
    """One NoCollision instanced actor per tree kind, with each tree's transform.

    Without species meshes (kinds None): the shared mesh, one actor per kind in TREE_KINDS order, scale x crown on
    X and Y. With them (load_tree_kinds): one actor per species in TREE_SPECIES order on that species' mesh, scaled
    uniformly so the tree stands at the row's height (a trunk scales with its tree, as the generator drew it).
    """
    out = []
    if kinds is None:
        groups = {}
        for row in rows:
            groups.setdefault(row['kind'], []).append(row)
        for kind, crown in TREE_KINDS.items():
            if kind not in groups:
                continue
            out.append({'label': f'{PREFIX}Plex yard trees {kind}', 'kind': kind, 'mesh': TREE_MESH,
                        'folder': f'{FOLDER}/Plex yard trees', 'collision': False, 'cast_shadow': True,
                        'cull_cm': list(TREE_CULL_CM), 'crown': crown, 'count': len(groups[kind]),
                        'transforms': [(r['position'], r['yaw'], (r['scale'] * crown, r['scale'] * crown, r['scale']))
                                       for r in groups[kind]]})
        return out
    groups = {}
    for row in rows:
        assert row['species'] in kinds, f'{YARD_TREES}: no {TREES} mesh for {row["kind"]} ({row["species"]})'
        groups.setdefault(row['species'], []).append(row)
    for species in TREE_SPECIES:
        if species not in groups:
            continue
        height = kinds[species]['height_cm']
        out.append({'label': f'{PREFIX}Plex yard trees {species}', 'kind': species, 'mesh': tree_mesh_asset(species),
                    'folder': f'{FOLDER}/Plex yard trees', 'collision': False, 'cast_shadow': True,
                    'cull_cm': list(TREE_CULL_CM), 'crown': 1., 'count': len(groups[species]),
                    'mesh_height_cm': height,
                    'transforms': [(r['position'], r['yaw'], (r['height_cm'] / height,) * 3) for r in groups[species]]})
    return out


def shared_key_plan(root=ROOT):
    """How the apply step builds each shared rear-pass key, whether or not a manifest uses it yet."""
    sets = load_textures(root)
    out = {}
    for key, name in sorted(SHARED_TEXTURE_KEYS.items()):
        parent, texture = base_material(key, {})
        assert texture == 'replica_' + name, (key, texture)
        row = {'set': name, 'duplicate_of': parent}
        if name in sets:
            fields = set_material(name, sets[name])
            row.update({k: fields[k] for k in ('blend_mode', 'two_sided', 'shading_model', 'opacity_mask_clip',
                                                'tiling', 'uv')})
            row['texture_base_color_srgb'] = sets[name].get('base_color_srgb')
            if fields.get('macro'):
                row['macro_strength'] = fields['macro']['strength']
            if fields['uv'] == 'card':
                row['address_y'] = CARD_ADDRESS_Y
        out[key] = row
    return out


def material_row(layer, key, spec, texture_sets, used_sets):
    """The plan row of one material key: the parent it duplicates, its tint basis and, for a replica texture set,
    the set's maps, tiling, blend mode, macro variation and the manifest's metallic."""
    base, texture = base_material(key, spec)
    row = {'layer': layer, 'key': key, 'asset': f'{MATERIALS}/{material_name(layer, key)}',
           'duplicate_of': base, 'texture_mean': texture,
           'mean_linear': list(TEXTURE_MEAN[texture]) if texture in TEXTURE_MEAN else None,
           'base_color_srgb': spec['base_color_srgb'],
           'emissive_srgb': spec.get('emissive_srgb'),
           'emissive_strength': spec.get('emissive_strength', 0.)}
    if texture and texture.startswith('replica_'):
        name = texture[len('replica_'):]
        assert name in texture_sets, f'{layer} {key} needs the {name} textures; run python3 Scripts/plateau_textures.py'
        used_sets.add(name)
        row.update(set_material(name, texture_sets[name]))
        row['metallic'] = float(spec.get('metallic', 0.))
        row['wet'] = base == WET_PARENT
    return row


def texture_rows(name, entry):
    """Import rows of a set's three maps: colour space, compression, sampler, hashes, alpha mips, V addressing."""
    clip = set_material(name, entry)['opacity_mask_clip']
    rows = []
    for role in TEXTURE_ROLES:
        m = entry['maps'][role]
        alpha = bool(m.get('alpha'))
        rows.append({'set': name, 'role': role, 'file': f'{TEXTURES}/{m["file"]}',
                     'asset': f'{TEXTURE_ASSETS}/{Path(m["file"]).stem}', 'size_px': entry['size_px'],
                     'srgb': m['srgb'], 'compression': m['compression'], 'sampler': m['sampler'],
                     'sha256': m['file_sha256'], 'raw_sha256': m['raw_sha256'], 'alpha': alpha,
                     # Mips keep the clip coverage (Castano), so thin balusters do not fade away.
                     'alpha_coverage_threshold': clip if alpha else None,
                     # Cards span their texture once in V: clamp, so no mip blends the top row into the bottom.
                     'address_y': CARD_ADDRESS_Y if entry.get('uv') == 'card' else 'TA_WRAP'})
    return rows


def plan_tree_assets(kinds, species_used, texture_sets, used_sets):
    """Material rows (layer 'Trees') and mesh rows of the species meshes the yard trees use."""
    materials, meshes, seen = [], [], {}
    for species in TREE_SPECIES:
        if species not in species_used:
            continue
        kind = kinds[species]
        slots = {}
        for slot in TREE_SLOTS:
            ref = kind['materials'][slot]
            if 'existing' in ref:
                slots[slot] = ref['existing']
                continue
            key, spec = ref['key'], ref['spec']
            if key in seen:
                assert seen[key][0] == spec and seen[key][1] == slot, f'{TREES} material {key} differs between kinds'
            else:
                row = material_row(TREES, key, spec, texture_sets, used_sets)
                # Leaves without a masked foliage texture set still light as foliage: two-sided, with transmission.
                row['foliage'] = slot == 'leaves' and bool(spec.get('foliage', True)) and not row.get('texture_set')
                row['spec'] = spec
                materials.append(row)
                seen[key] = (spec, slot)
            slots[slot] = f'{MATERIALS}/{material_name(TREES, key)}'
        meshes.append({'species': species, 'file': kind['obj'], 'asset': tree_mesh_asset(species),
                       'sha256': kind['sha256'], 'height_cm': kind['height_cm'], 'trunk_cm': kind['trunk_cm'],
                       'materials': slots, 'collision': 'none', 'nanite_shape_preservation': PRESERVE_AREA})
    return materials, meshes


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
           'missing_props': [], 'textures': [], 'tree_meshes': []}
    texture_sets, used_sets = load_textures(root), set()
    for layer, manifest in manifests.items():
        for key, spec in sorted(manifest.get('materials', {}).items()):
            out['materials'].append(material_row(layer, key, spec, texture_sets, used_sets))
    yard = load_yard_trees(root)
    kinds = load_tree_kinds(root) if yard else None
    out['trees'] = plan_trees(yard or [], kinds)
    if kinds:
        tree_materials, out['tree_meshes'] = plan_tree_assets(kinds, {t['kind'] for t in out['trees']}, texture_sets,
                                                              used_sets)
        out['materials'] += tree_materials
    out['yard_trees'] = {'file': YARD_TREES, 'present': yard is not None,
                         'mode': 'species meshes' if kinds else 'shared mesh',
                         'mesh': TREE_MESH if not kinds else None,
                         'species_meshes': {m['species']: m['asset'] for m in out['tree_meshes']},
                         'aliases': dict(TREE_ALIASES)}
    parents = {}
    for m in out['materials']:
        if m['duplicate_of'] in BUILT_PARENTS and m['duplicate_of'] not in parents:
            # The parent samples the first set that needs it; every duplicate swaps in its own maps.
            parents[m['duplicate_of']] = {'asset': m['duplicate_of'], 'texture_set': m['texture_set'],
                                          **{k: m[k] for k in ('surface', 'blend_mode', 'two_sided', 'shading_model',
                                                               'opacity_mask_clip', 'tiling', 'textures')}}
    out['parents'] = [parents[a] for a in sorted(parents)]
    for name in sorted(used_sets):
        out['textures'] += texture_rows(name, texture_sets[name])
    if any(m.get('macro') for m in out['materials']):
        macro = load_macro(root)
        assert macro, 'A material needs the macro mask; run python3 Scripts/plateau_textures.py'
        out['textures'].append({'set': 'macro', 'role': MACRO_ROLE, 'file': f'{TEXTURES}/{macro["file"]}',
                                'asset': f'{TEXTURE_ASSETS}/{Path(macro["file"]).stem}', 'size_px': macro['size_px'],
                                'srgb': macro['srgb'], 'compression': macro['compression'], 'sampler': macro['sampler'],
                                'sha256': macro['file_sha256'], 'raw_sha256': macro['raw_sha256'], 'alpha': False,
                                'alpha_coverage_threshold': None, 'address_y': 'TA_WRAP'})
    by_material = {m['asset']: m for m in out['materials']}
    for layer, manifest in manifests.items():
        for batch in manifest.get('batches', []):
            mesh = f'{ASSETS}/{layer}/{batch["mesh"]}'
            key = prop_key(batch, keys) if layer == 'Props' else None
            material = f'{MATERIALS}/{material_name(layer, batch["material"])}'
            masked = by_material.get(material, {}).get('blend_mode') == 'masked'
            out['meshes'].append({'layer': layer, 'file': batch['file'], 'asset': mesh, 'material': material,
                                  'collision': batch.get('collision', 'none'), 'triangles': batch['triangles'],
                                  # Masked cards and creeper: Nanite keeps their area at a distance.
                                  'nanite_shape_preservation': PRESERVE_AREA if masked else None,
                                  # Simple box collision from MAP-PROPS colliders_cm, on the prop's main part only.
                                  'colliders': colliders.get(key, []) if key and main_part.get(key) == batch['mesh'] else []})
            if layer != 'Props':
                invisible = batch['material'] == COLLISION_ONLY
                assert not invisible or batch.get('collision', 'none') != 'none', f'{batch["file"]}: a wall that never collides'
                out['actors'].append({'label': f'{PREFIX}{layer} {batch["mesh"][3:]}', 'mesh': mesh,
                                      'folder': f'{FOLDER}/{layer}', 'collision': batch.get('collision', 'none'),
                                      'shadow': casts_shadow(batch['material']),
                                      # Gallery guards: block pawns, ignore the camera and visibility, never render.
                                      'collision_only': invisible, 'hidden_in_game': invisible})
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
                     'textures': len(out['textures']),
                     'clamped_textures': sum(1 for t in out['textures'] if t['address_y'] == 'TA_CLAMP'),
                     'textured_replica_materials': sum(1 for m in out['materials'] if m.get('texture_set')),
                     'masked_materials': sum(1 for m in out['materials'] if m.get('blend_mode') == 'masked'),
                     'macro_materials': sum(1 for m in out['materials'] if m.get('macro')),
                     'built_parents': len(out['parents']),
                     'preserve_area_meshes': sum(1 for m in out['meshes'] if m['nanite_shape_preservation']),
                     'hidden_collision_actors': sum(1 for a in out['actors'] if a['collision_only']),
                     'shadowless_actors': sum(1 for a in out['actors'] if not a['shadow']),
                     'tree_meshes': len(out['tree_meshes']),
                     'tree_materials': sum(1 for m in out['materials'] if m['layer'] == TREES),
                     'yard_tree_actors': len(out['trees']),
                     'yard_tree_instances': sum(t['count'] for t in out['trees']),
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
                 'HierarchicalInstancedStaticMeshComponent', 'TextRenderActor', 'StaticMeshActor', 'KBoxElem',
                 'Texture2D', 'TextureCompressionSettings', 'MaterialSamplerType', 'MaterialExpressionTextureSample',
                 'MaterialExpressionTextureCoordinate', 'BlendMode', 'MaterialShadingModel', 'Vector4'):
        assert getattr(u, name, None) is not None, 'Missing Unreal API ' + name
    for row in the_plan['textures']:
        assert getattr(u.TextureCompressionSettings, row['compression'], None) is not None, row['compression']
        assert getattr(u.MaterialSamplerType, row['sampler'], None) is not None, row['sampler']
    if the_plan['parents']:
        for owner, name in ((u.BlendMode, 'BLEND_MASKED'), (u.MaterialShadingModel, 'MSM_TWO_SIDED_FOLIAGE'),
                            (u.MaterialProperty, 'MP_OPACITY_MASK'), (u.MaterialProperty, 'MP_SUBSURFACE_COLOR')):
            assert getattr(owner, name, None) is not None, 'Missing Unreal API ' + name
    assert u.load_class(None, INSTANCES_CLASS), 'Build the Quebec module first: ' + INSTANCES_CLASS + ' is missing'
    for row in the_plan['materials']:
        if row['duplicate_of'] in BUILT_PARENTS:
            assert not assets.does_asset_exist(row['duplicate_of']), row['duplicate_of'] + ' already exists'
        else:
            assert assets.does_asset_exist(row['duplicate_of']), 'Missing base material ' + row['duplicate_of']
    if the_plan['trees']:
        tree = assets.load_asset(TREE_MESH)
        assert isinstance(tree, u.StaticMesh), 'Missing the mapped tree mesh ' + TREE_MESH
        for slot in tree.get_editor_property('static_materials'):
            # plateau_rendering.py sets these usages for the 4,571 mapped trees; this step does not edit the mesh.
            mat = slot.material_interface
            for usage in (u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES, u.MaterialUsage.MATUSAGE_NANITE):
                assert u.MaterialEditingLibrary.has_material_usage(mat, usage), \
                    f'{mat.get_path_name()} lacks {usage}; run plateau_rendering.py first'
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


def import_texture(u, root, row):
    """Import one replica PNG (Scripts/plateau_textures.py) with the colour space and compression it needs."""
    folder, name = row['asset'].rsplit('/', 1)
    task = u.AssetImportTask()
    task.filename = str(Path(root) / 'Data/Plateau/ReplicaGeometry' / row['file'])
    task.destination_path, task.destination_name = folder, name
    task.automated, task.save, task.replace_existing = True, False, False
    u.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    assert task.imported_object_paths, row['file']
    texture = u.EditorAssetLibrary.load_asset(task.imported_object_paths[0])
    assert isinstance(texture, u.Texture2D), row['file']
    texture.set_editor_property('srgb', row['srgb'])
    texture.set_editor_property('compression_settings', getattr(u.TextureCompressionSettings, row['compression']))
    group = getattr(u.TextureGroup, 'TEXTUREGROUP_WORLD_NORMAL_MAP' if row['role'] == 'nor_dx' else 'TEXTUREGROUP_WORLD',
                    None)
    if group is not None:
        texture.set_editor_property('lod_group', group)
    if row.get('alpha'):
        # Cut-out diffuse (RGBA): keep the alpha (BC3), and scale each mip's alpha so the share of texels over the
        # material's clip stays that of the top mip (Castaño, "Computing Alpha Mipmaps"); without it, balusters
        # and lattice laths thin out and vanish a few metres away. Only the A channel is scaled.
        texture.set_editor_property('compression_no_alpha', False)
        texture.set_editor_property('do_scale_mips_for_alpha_coverage', True)
        texture.set_editor_property('alpha_coverage_thresholds', u.Vector4(0., 0., 0., float(row['alpha_coverage_threshold'])))
    assert u.EditorAssetLibrary.save_loaded_asset(texture, only_if_is_dirty=False)
    return texture


def texture_role(texture):
    """'diff', 'nor_dx' or 'rough' from a texture asset name (brick_wall_001_diff, T_Replica_Slate_rough...)."""
    name = texture.get_name() if texture else ''
    return next((r for r in TEXTURE_ROLES if name.endswith('_' + r)), None)


def retexture(u, mat, row, textures):
    """Swap the brick parent's three samples for the replica set and set the metre tiling.

    Returns False, changing nothing, unless the duplicate has exactly one authored texture coordinate
    and one sample per role (diff, nor_dx, rough), as upgrade_plateau.material() authors M_BrickRed.
    """
    nodes = [n for n in u.MaterialEditingLibrary.get_material_expressions(mat)
             if str(n.get_editor_property('desc')) != MARKER]
    coords = [n for n in nodes if isinstance(n, u.MaterialExpressionTextureCoordinate)]
    samples = {}
    for n in nodes:
        if isinstance(n, u.MaterialExpressionTextureSample):
            samples.setdefault(texture_role(n.get_editor_property('texture')), []).append(n)
    if len(coords) != 1 or sorted(samples) != sorted(TEXTURE_ROLES) or any(len(v) != 1 for v in samples.values()):
        return False
    samplers = {t['role']: t['sampler'] for t in textures.values()}
    for role, (node,) in samples.items():
        node.set_editor_property('texture', textures[row['textures'][role]]['object'])
        node.set_editor_property('sampler_type', getattr(u.MaterialSamplerType, samplers[role]))
    coords[0].set_editor_property('u_tiling', float(row['tiling'][0]))
    coords[0].set_editor_property('v_tiling', float(row['tiling'][1]))
    return True


def textured_graph(u, mat, row, textures, tint, spec):
    """Tint x diff, normal and roughness from R (as M_BrickRed); for the cut-out sets also OpacityMask = diff alpha,
    and for foliage SubsurfaceColor = base colour x .65 (as the mapped trees' leaves).

    Builds the masked parents and the fresh-material fallback, so both keep the textures.
    """
    lib = u.MaterialEditingLibrary
    coords = lib.create_material_expression(mat, u.MaterialExpressionTextureCoordinate)
    coords.set_editor_property('u_tiling', float(row['tiling'][0]))
    coords.set_editor_property('v_tiling', float(row['tiling'][1]))
    samples = {}
    for role in TEXTURE_ROLES:
        t = textures[row['textures'][role]]
        node = lib.create_material_expression(mat, u.MaterialExpressionTextureSample)
        node.set_editor_property('texture', t['object'])
        node.set_editor_property('sampler_type', getattr(u.MaterialSamplerType, t['sampler']))
        assert lib.connect_material_expressions(coords, '', node, '')
        samples[role] = node
    product = lib.create_material_expression(mat, u.MaterialExpressionMultiply)
    assert lib.connect_material_expressions(samples['diff'], 'RGB', product, 'A')
    assert lib.connect_material_expressions(tint, '', product, 'B')
    assert lib.connect_material_property(product, '', u.MaterialProperty.MP_BASE_COLOR)
    assert lib.connect_material_property(samples['nor_dx'], 'RGB', u.MaterialProperty.MP_NORMAL)
    assert lib.connect_material_property(samples['rough'], 'R', u.MaterialProperty.MP_ROUGHNESS)
    metal = lib.create_material_expression(mat, u.MaterialExpressionConstant)
    metal.set_editor_property('r', float(row.get('metallic', spec.get('metallic', 0.))))
    assert lib.connect_material_property(metal, '', u.MaterialProperty.MP_METALLIC)
    if row.get('blend_mode') == 'masked':
        assert lib.connect_material_property(samples['diff'], 'A', u.MaterialProperty.MP_OPACITY_MASK)
    if row.get('shading_model') == 'two_sided_foliage':
        transmission = lib.create_material_expression(mat, u.MaterialExpressionMultiply)
        transmission.set_editor_property('const_b', FOLIAGE_SUBSURFACE)
        assert lib.connect_material_expressions(product, '', transmission, 'A')
        assert lib.connect_material_property(transmission, '', u.MaterialProperty.MP_SUBSURFACE_COLOR)


def material_mode(u, mat, row):
    """Blend mode, sidedness, clip and shading model of a masked replica set (cards and creeper); opaque sets
    keep their parent's."""
    if row.get('blend_mode') != 'masked':
        return
    mat.set_editor_property('blend_mode', u.BlendMode.BLEND_MASKED)
    mat.set_editor_property('two_sided', bool(row['two_sided']))
    mat.set_editor_property('opacity_mask_clip_value', float(row['opacity_mask_clip']))
    if row.get('shading_model') == 'two_sided_foliage':
        mat.set_editor_property('shading_model', u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE)


def set_metallic(u, mat, value):
    """Metallic of a textured duplicate (galvanised sheet): the parent's authored constant, else a new one."""
    lib = u.MaterialEditingLibrary
    node = lib.get_material_property_input_node(mat, u.MaterialProperty.MP_METALLIC)
    if not (isinstance(node, u.MaterialExpressionConstant) and str(node.get_editor_property('desc')) != MARKER):
        node = lib.create_material_expression(mat, u.MaterialExpressionConstant)
        assert lib.connect_material_property(node, '', u.MaterialProperty.MP_METALLIC)
    node.set_editor_property('r', float(value))


def build_parent(u, row, textures):
    """A masked, two-sided parent for the cut-out or foliage sets: Content has none to duplicate, so it is built
    here from a graph whose OpacityMask input is the diffuse alpha. Its one tint is white; the duplicates set it."""
    assets, lib = u.EditorAssetLibrary, u.MaterialEditingLibrary
    folder, name = row['asset'].rsplit('/', 1)
    mat = u.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, u.Material, u.MaterialFactoryNew())
    assert mat, row['asset']
    material_mode(u, mat, row)
    tint = lib.create_material_expression(mat, u.MaterialExpressionConstant3Vector)
    tint.set_editor_property('constant', u.LinearColor(1., 1., 1., 1.))
    textured_graph(u, mat, row, textures, tint, {'metallic': 0.})
    for usage in (u.MaterialUsage.MATUSAGE_NANITE, u.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES):
        lib.set_base_material_usage(mat, usage, True)
    lib.recompile_material(mat)
    assert assets.save_loaded_asset(mat, only_if_is_dirty=False)
    return mat


def make_material(u, row, spec, textures=None):
    """Duplicate a base material and set its single tint; fall back to a fresh constant material.

    Rows with a replica texture set also get the parent's samples swapped (retexture); the fallback for
    them is a fresh textured graph. Returns (material, True if the fallback was used).
    """
    assets, lib = u.EditorAssetLibrary, u.MaterialEditingLibrary
    colour = linear(spec['base_color_srgb'])
    if row['texture_mean']:
        textured_colour = tuple(min(TINT_LIMIT, c / m) for c, m in zip(colour, row['mean_linear']))
    mat = assets.duplicate_asset(row['duplicate_of'], row['asset'])
    tints = authored_tints(u, mat) if mat else []
    duplicated = bool(mat) and len(tints) == 1 and (not row.get('textures') or retexture(u, mat, row, textures))
    if duplicated:
        if row['texture_mean']:
            colour = textured_colour
        tints[0].set_editor_property('constant', u.LinearColor(*colour, 1))
        if spec.get('emissive_srgb'):
            emissive_input(u, mat, spec, tints[0])
        if row.get('texture_set'):
            material_mode(u, mat, row)
            set_metallic(u, mat, row['metallic'])
    else:
        if mat:
            assets.delete_asset(row['asset'])
        folder, name = row['asset'].rsplit('/', 1)
        mat = u.AssetToolsHelpers.get_asset_tools().create_asset(name, folder, u.Material, u.MaterialFactoryNew())
        tint = lib.create_material_expression(mat, u.MaterialExpressionConstant3Vector)
        if row.get('textures'):
            material_mode(u, mat, row)
            tint.set_editor_property('constant', u.LinearColor(*textured_colour, 1))
            textured_graph(u, mat, row, textures, tint, spec)
            if row.get('wet'):
                # The ground parent's NordSky wet-street wrapper, rebuilt on the fresh graph (verify expects it).
                import plateau_atmosphere
                mpc = assets.load_asset(plateau_atmosphere.COLLECTION)
                if mpc:
                    plateau_atmosphere.wet_ground(u, mat, mpc)
        else:
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
    return mat, not duplicated


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


def spawn_yard_trees(u, editor, rows):
    """One AQuebecReplicaInstances actor per tree kind on the mapped trees' mesh and materials, untouched;
    NoCollision like the mapped trees, which cast shadows and cull at QuebecVegetation's distances."""
    placed = {}
    tree = u.EditorAssetLibrary.load_asset(TREE_MESH) if rows else None
    for row in rows:
        actor, comp = instanced_actor(u, editor, row['label'], row['folder'])
        comp.set_static_mesh(tree)
        comp.set_collision_profile_name('NoCollision')
        comp.set_cull_distances(*row['cull_cm'])
        comp.set_cast_shadow(row['cast_shadow'])
        transforms = [u.Transform(u.Vector(*p), u.Rotator(roll=0., pitch=0., yaw=yaw), u.Vector(*scale))
                      for p, yaw, scale in row['transforms']]
        comp.add_instances(transforms, False, True, False)
        assert comp.get_instance_count() == row['count'], row['label']
        placed[row['label']] = {'actor': actor.get_path_name(), 'count': row['count']}
    return placed


def check_yard_trees_placed(u, actors, rows):
    """verify: each kind's actor, its mesh, count, NoCollision, cull distance and first and last transforms."""
    count = 0
    tree_mesh = f'{TREE_MESH}.{TREE_MESH.rsplit("/", 1)[1]}'
    for row in rows:
        actor = actors.get(row['label'])
        assert actor is not None, 'Missing yard trees ' + row['label']
        comp = actor.get_component_by_class(u.HierarchicalInstancedStaticMeshComponent)
        assert comp and comp.static_mesh and comp.static_mesh.get_path_name() == tree_mesh, row['label'] + ' mesh'
        assert comp.get_instance_count() == row['count'], row['label']
        assert str(comp.get_collision_profile_name()) == 'NoCollision', row['label'] + ' collides'
        assert comp.get_editor_property('instance_end_cull_distance') == row['cull_cm'][1], row['label'] + ' cull'
        for index in (0, row['count'] - 1):
            t = comp.get_instance_transform(index, True)
            (x, y, z), _, (sx, _, sz) = row['transforms'][index]
            assert math.dist((t.translation.x, t.translation.y, t.translation.z), (x, y, z)) < .5, row['label']
            assert abs(t.scale3d.x - sx) < 1e-3 and abs(t.scale3d.z - sz) < 1e-3, row['label'] + ' scale'
        count += row['count']
    return count


def check_texture(u, texture, row):
    """verify: an imported replica map's colour space, compression, size and, for cut-out maps, alpha mips."""
    assert isinstance(texture, u.Texture2D), 'Missing texture ' + row['asset']
    assert bool(texture.get_editor_property('srgb')) == row['srgb'], row['asset'] + ' has the wrong colour space'
    assert texture.get_editor_property('compression_settings') == \
        getattr(u.TextureCompressionSettings, row['compression']), row['asset'] + ' has the wrong compression'
    assert [texture.blueprint_get_size_x(), texture.blueprint_get_size_y()] == row['size_px'], row['asset']
    if row['alpha']:
        assert not texture.get_editor_property('compression_no_alpha'), row['asset'] + ' dropped its alpha'
        assert texture.get_editor_property('do_scale_mips_for_alpha_coverage'), row['asset'] + ' mips lose coverage'
        thresholds = texture.get_editor_property('alpha_coverage_thresholds')
        assert abs(thresholds.w - row['alpha_coverage_threshold']) < 1e-4 and thresholds.x == thresholds.y == \
            thresholds.z == 0., row['asset'] + ' alpha coverage threshold'


def check_material_mode(u, mat, row):
    """verify: masked sets are masked, two-sided, at the planned clip and shading, with OpacityMask from their own
    diffuse alpha; opaque sets are not masked and sided as their parent; textured duplicates carry their metallic."""
    lib = u.MaterialEditingLibrary
    blend = mat.get_editor_property('blend_mode')
    if row['blend_mode'] == 'masked':
        assert blend == u.BlendMode.BLEND_MASKED, f'{row["asset"]} blend mode {blend}'
        assert bool(mat.get_editor_property('two_sided')) == row['two_sided'], row['asset'] + ' is one-sided'
        assert abs(mat.get_editor_property('opacity_mask_clip_value') - row['opacity_mask_clip']) < 1e-4, row['asset']
        mask = lib.get_material_property_input_node(mat, u.MaterialProperty.MP_OPACITY_MASK)
        assert isinstance(mask, u.MaterialExpressionTextureSample) and mask.get_editor_property('texture') and \
            mask.get_editor_property('texture').get_path_name().split('.')[0] == row['textures']['diff'], \
            row['asset'] + ' OpacityMask is not its diffuse alpha'
        want = (u.MaterialShadingModel.MSM_TWO_SIDED_FOLIAGE if row['shading_model'] == 'two_sided_foliage'
                else u.MaterialShadingModel.MSM_DEFAULT_LIT)
        assert mat.get_editor_property('shading_model') == want, row['asset'] + ' shading model'
    else:
        parent = u.EditorAssetLibrary.load_asset(row['duplicate_of']) if row.get('duplicate_of') else None
        assert blend != u.BlendMode.BLEND_MASKED, row['asset'] + ' is masked'
        if parent:
            assert bool(mat.get_editor_property('two_sided')) == bool(parent.get_editor_property('two_sided')), \
                row['asset'] + ' sidedness differs from ' + row['duplicate_of']
    if 'metallic' in row:
        metal = lib.get_material_property_input_node(mat, u.MaterialProperty.MP_METALLIC)
        assert isinstance(metal, u.MaterialExpressionConstant) and \
            abs(metal.get_editor_property('r') - row['metallic']) < 1e-4, row['asset'] + ' metallic'


def apply(u, root, backup):
    root, backup = Path(root).resolve(), Path(backup).resolve()
    the_plan = plan(root)
    manifests, placements = load_manifests(root)
    actors = preflight(u, root, backup, the_plan)
    map_files = backup_map(u, root, backup, actors)
    editor = u.get_editor_subsystem(u.EditorActorSubsystem)
    report = {'passed': False, 'map': MAP, 'backup': str(backup.relative_to(root)), 'map_package_files': map_files,
              'plan_counts': the_plan['counts'], 'textures': {}, 'materials': {}, 'fresh_materials': [],
              'parents': {}, 'actors': {}, 'instances': {}, 'trees': {}, 'texts': 0,
              'hidden': {}, 'missing_props': the_plan['missing_props'],
              'manifest_sha256': {n: sha(root / 'Data/Plateau/ReplicaGeometry' / n / 'manifest.json') for n in manifests}}
    try:
        textures = {}
        for row in the_plan['textures']:
            textures[row['asset']] = dict(row, object=import_texture(u, root, row))
            report['textures'][row['asset']] = row['sha256']
        for row in the_plan['parents']:
            report['parents'][row['asset']] = build_parent(u, row, textures).get_path_name()
        materials = {}
        for row in the_plan['materials']:
            spec = manifests[row['layer']]['materials'][row['key']]
            materials[row['asset']], fresh = make_material(u, row, spec, textures)
            report['materials'][row['asset']] = row['duplicate_of']
            if fresh:
                report['fresh_materials'].append(row['asset'])
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
            if row['collision']:
                # Props block people and cars but not the spring arms, which test ECC_Camera; the profile becomes Custom.
                comp.set_collision_response_to_channel(u.CollisionChannel.ECC_CAMERA, u.CollisionResponseType.ECR_IGNORE)
            comp.set_cull_distances(9000, 12000)
            comp.set_cast_shadow(row['prop'] in ('lamp_cobra', 'lamp_park', 'utility_pole', 'bixi_dock', 'bench'))
            transforms = [u.Transform(u.Vector(*p), u.Rotator(roll=0., pitch=0., yaw=yaw), u.Vector(s, s, s))
                          for p, yaw, s in row['transforms']]
            comp.add_instances(transforms, False, True, False)
            assert comp.get_instance_count() == row['count'], row['label']
            report['instances'][row['label']] = {'actor': actor.get_path_name(), 'count': row['count']}
        report['trees'] = spawn_yard_trees(u, editor, the_plan['trees'])
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
        if row['collision']:
            assert comp.get_collision_response_to_channel(u.CollisionChannel.ECC_CAMERA) == \
                u.CollisionResponseType.ECR_IGNORE, row['label'] + ' blocks the camera'
            assert comp.get_collision_response_to_channel(u.CollisionChannel.ECC_PAWN) == \
                u.CollisionResponseType.ECR_BLOCK, row['label'] + ' does not block pawns'
            boxes = comp.static_mesh.get_editor_property('body_setup').get_editor_property('agg_geom') \
                .get_editor_property('box_elems')
            assert len(boxes) == len(by_mesh[row['mesh']]['colliders']) > 0, row['label'] + ' has no simple collision'
        else:
            assert str(comp.get_collision_profile_name()) == 'NoCollision', row['label']
        instances += row['count']
    assets = u.EditorAssetLibrary
    for row in the_plan['textures']:
        check_texture(u, assets.load_asset(row['asset']), row)
    samplers = {t['role']: getattr(u.MaterialSamplerType, t['sampler']) for t in the_plan['textures']}
    parents = {}

    for row in the_plan['parents']:
        mat = assets.load_asset(row['asset'])
        assert isinstance(mat, u.Material), 'Missing masked parent ' + row['asset']
        check_material_mode(u, mat, row)

    def nord_parameters(mat):
        return sorted(str(n.get_editor_property('parameter_name')) for n in u.MaterialEditingLibrary.get_material_expressions(mat)
                      if isinstance(n, u.MaterialExpressionCollectionParameter))

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
        if any(p in row['duplicate_of'] for p in WET_PARENTS):
            assert 'Wetness' in collection, row['asset'] + ' lost the NordSky wet-street wrapper'
        if row.get('textures'):
            # Replica texture sets: exactly the three maps of the set, the right samplers, the tiling, and the
            # same NordSky wrappers (Wetness on the ground parent, none on the brick one) as their parent.
            samples = [n for n in nodes if isinstance(n, u.MaterialExpressionTextureSample)]
            used = sorted(n.get_editor_property('texture').get_path_name().split('.')[0] for n in samples
                          if n.get_editor_property('texture'))
            assert used == sorted(row['textures'].values()), row['asset'] + f' samples {used}'
            for n in samples:
                role = texture_role(n.get_editor_property('texture'))
                assert role in samplers and n.get_editor_property('sampler_type') == samplers[role], \
                    f'{row["asset"]} sampler {role}'
            coords = [n for n in nodes if isinstance(n, u.MaterialExpressionTextureCoordinate)
                      and str(n.get_editor_property('desc')) != MARKER]
            assert any(abs(c.get_editor_property('u_tiling') - row['tiling'][0]) < 1e-4
                       and abs(c.get_editor_property('v_tiling') - row['tiling'][1]) < 1e-4 for c in coords), \
                row['asset'] + ' lost its metre tiling'
            if row['duplicate_of'] not in parents:
                parents[row['duplicate_of']] = nord_parameters(assets.load_asset(row['duplicate_of']))
            assert nord_parameters(mat) == parents[row['duplicate_of']], \
                row['asset'] + ' NordSky wrappers differ from ' + row['duplicate_of']
            # Blend mode and sidedness of the set (cards and creeper masked and two-sided), and its metallic.
            check_material_mode(u, mat, row)
    trees = check_yard_trees_placed(u, actors, the_plan['trees'])
    texts = sum(1 for label in actors if label.startswith(PREFIX + 'street name '))
    assert texts == report['texts'], 'Street-name text count changed'
    for label in HIDE_LABELS:
        if label in report['hidden']:
            assert actors[label].get_editor_property('hidden'), label + ' is visible again'
    result = {'passed': True, 'actors': checked, 'instances': instances, 'texts': texts,
              'textures': len(the_plan['textures']), 'textured_materials': the_plan['counts']['textured_replica_materials'],
              'masked_materials': the_plan['counts']['masked_materials'], 'built_parents': len(the_plan['parents']),
              'yard_trees': trees, 'missing_props': report['missing_props']}
    (backup / 'verify-report.json').write_text(json.dumps(result, indent=1) + '\n')
    return result


def main():
    if '--dry-run' in sys.argv:
        the_plan = plan(ROOT)
        print(json.dumps({'counts': the_plan['counts'], 'missing_props': the_plan['missing_props'],
                          'hide': the_plan['hide'],
                          'textures': {t['asset']: t['sha256'] for t in the_plan['textures']},
                          'textured_materials': {m['asset']: {'set': m['texture_set'], 'duplicate_of': m['duplicate_of'],
                                                              'tiling': m['tiling'], 'blend_mode': m['blend_mode'],
                                                              'two_sided': m['two_sided']}
                                                 for m in the_plan['materials'] if m.get('texture_set')},
                          'parents': {p['asset']: {k: p[k] for k in ('texture_set', 'blend_mode', 'two_sided',
                                                                      'shading_model', 'opacity_mask_clip')}
                                      for p in the_plan['parents']},
                          'shared_keys': shared_key_plan(ROOT),
                          'yard_trees': dict(the_plan['yard_trees'],
                                             actors={t['label']: {'count': t['count'], 'crown': t['crown'],
                                                                  'collision': t['collision'], 'cull_cm': t['cull_cm']}
                                                     for t in the_plan['trees']})}, indent=1))
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
