"""CPU checks for the Plateau replica streetscape (Streets, Furniture, Soul).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica.py
Builds the layers twice into temporary directories (the committed Data folder is not touched),
then checks determinism, manifest schema, runtime naming, curb heights, the 300 cm traffic band,
paint heights, OSM parity of stops/crossings/lamps/hydrants, budgets and the apply plan, including the
texture sets (Scripts/plateau_textures.py) and their textured materials, the shared rear-pass keys on a
synthetic Plex layer (texture set, parent, masked and two-sided cards, built parents, alpha mips, clamped card
maps, macro variation, Preserve Area meshes, hidden Collision_Only walls, the whole-key shadow rule), planned
collision clear of traffic, and the yard-tree actors from Plex/yard_trees.json (species meshes from
Trees/manifest.json, else the shared mesh), the editor side against a fake unreal module; the streets passes: every
street and park tree of the city's inventory in street_trees.json, sidewalk pits 65-80 cm behind the curb and never on
the carriageway, curb extensions only at corners or where the data lists one, no trunk on carriageway or parking
asphalt (trees mapped there re-seated from the inventory's side, place and distance, or listed), their late-October
colours and conifer kinds, each pit's iron guard and planting cards, the sunken aged-concrete ruelle gutter on its own
UVs above the old OSM road, the dull asphalt overlays, ruelles paved to the fences and, behind the street-front yards,
out to the lot lines, curb-to-building coverage on the capture streets,
textured front lawns and card plants (crossed fountain-grass cards for the ornamental grass), and no open step at a
raised slab's edge (risers at aprons and ramps); and the lane life: laundry poles at the back fence with lines rising
to them, each strand a true catenary (closed-form fixtures and every line's record), the washing as folded strips of
quads on the laundry atlas whose tops follow the rope, no rope or garment inside a tree crown or near a trunk (the
crowns as the apply step stands the trees), the leaf litter (ragged Leaf_Litter patches on world metre UVs under the
street and park crowns, as dense as each kind's leaf fall, and drifts along the curbs and ruelle gutters, lying just
over their ground, within the Soul budget), a line with washing in sight within 15 m of the Mentana and
Saint-André ruelle camera over the fences (a ray cast through the game's own geometry and tree meshes), paint only on
solid lane-fence faces, and the gallery props (chairs, pots, barbecues, bikes, bins, AC units, rail planters, dishes)
on the decks' props floor, clear of stairs and doors.
"""
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import struct
import sys
import tempfile
import types

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plateau_replica as replica  # noqa: E402
import apply_plateau_replica as apply_replica  # noqa: E402
import plateau_textures  # noqa: E402

HEX = re.compile(r'^#[0-9a-f]{6}$')


def files(directory):
    return {p.relative_to(directory).as_posix(): p.read_bytes() for p in sorted(Path(directory).rglob('*')) if p.is_file()}


def parse_obj(path):
    vs, faces = [], []
    for line in Path(path).read_text().splitlines():
        if line.startswith('v '):
            _, x, y, z = line.split()
            vs.append((float(x), -float(y), float(z)))
        elif line.startswith('f '):
            faces.append([vs[int(t.split('/')[0]) - 1] for t in line.split()[1:]])
    return vs, faces


def f32(v):
    return struct.unpack('f', struct.pack('f', v))[0]


def _tri_contains(t, p):
    d1, d2, d3 = (replica._cross(t[0], t[1], p), replica._cross(t[1], t[2], p), replica._cross(t[2], t[0], p))
    return (d1 >= 0 and d2 >= 0 and d3 >= 0) or (d1 <= 0 and d2 <= 0 and d3 <= 0)


class TriIndex:
    def __init__(self, tris, cell=250.):
        self.tris, self.grid = tris, replica.Grid(cell)
        for i, t in enumerate(tris):
            self.grid.add(i, replica.bbox(t))

    def contains(self, p):
        return any(_tri_contains(self.tris[i], p) for i in self.grid.query((p[0], p[1], p[0], p[1])))


def _normal(t):
    u = [t[1][j] - t[0][j] for j in range(3)]
    v = [t[2][j] - t[0][j] for j in range(3)]
    return (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])


def wall_orientation(directory, manifest):
    """Every vertical sidewalk face must point out of its slab, and curb faces toward the road."""
    road = []
    for batch in manifest['batches']:
        if batch['material'] == 'asphalt':
            road += [[p[:2] for p in t] for t in parse_obj(directory / batch['file'])[1]]
    road = TriIndex(road)
    totals = {'walls': 0, 'out_of_slab': 0, 'into_slab': 0, 'curb_toward_road': 0, 'curb_away_from_road': 0}
    for batch in manifest['batches']:
        if batch['material'] != 'sidewalk':
            continue
        tris = parse_obj(directory / batch['file'])[1]
        tops, walls = [], []
        for t in tris:
            (walls if abs(replica.area([p[:2] for p in t])) < .5 else tops).append(t)
        # Writer convention: reversed fan plus mirrored y; recover the authored sign from the up-facing tops.
        up = sum(1 for t in tops if _normal(t)[2] > 0)
        assert min(up, len(tops) - up) == 0, f'{min(up, len(tops) - up)} sidewalk tops face down'
        flip = 1 if up else -1
        top_index = TriIndex([[p[:2] for p in t] for t in tops])
        for t in walls:
            n = [flip * v for v in _normal(t)]
            length = math.hypot(n[0], n[1])
            if length < 1e-9:
                continue
            n = (n[0] / length, n[1] / length)
            c = (sum(p[0] for p in t) / 3, sum(p[1] for p in t) / 3)
            out_p, in_p = (c[0] + 4 * n[0], c[1] + 4 * n[1]), (c[0] - 4 * n[0], c[1] - 4 * n[1])
            totals['walls'] += 1
            inside_out, inside_in = top_index.contains(out_p), top_index.contains(in_p)
            totals['out_of_slab'] += inside_in and not inside_out
            totals['into_slab'] += inside_out and not inside_in
            if road.contains(out_p) and not inside_out:
                totals['curb_toward_road'] += 1
            elif road.contains(in_p) and not inside_in:
                totals['curb_away_from_road'] += 1
    return totals


def check_schema(manifest, directory):
    for key in ('layer', 'generator', 'frame', 'batches', 'materials', 'counts', 'source_sha256'):
        assert key in manifest, key
    assert manifest['frame'] == 'x east, y north, cm, z up'
    assert manifest['generator'] == 'Scripts/plateau_replica.py'
    names = set()
    for batch in manifest['batches']:
        for key in ('file', 'mesh', 'material', 'collision', 'triangles', 'bounds_cm', 'sha256'):
            assert key in batch, (key, batch)
        assert batch['mesh'] == 'SM_' + batch['file'][:-4] and batch['mesh'] not in names
        names.add(batch['mesh'])
        assert batch['collision'] in ('none', 'simple', 'complex')
        assert batch['material'] in manifest['materials']
        assert 0 < batch['triangles'] <= replica.MAX_TRIS, batch
        assert len(batch['bounds_cm']) == 6 and all(math.isfinite(v) for v in batch['bounds_cm'])
        assert replica.sha_bytes((directory / batch['file']).read_bytes()) == batch['sha256']
    for key, spec in manifest['materials'].items():
        assert HEX.match(spec['base_color_srgb']), key
        assert 0 <= spec['roughness'] <= 1 and 0 <= spec['metallic'] <= 1
    for rel, digest in manifest['source_sha256'].items():
        assert replica.sha_file(replica.ROOT / rel) == digest, rel


def check_textures(the_plan):
    """Greystone, slate, buff brick and the rear-pass sets: textured duplicates of their surface parent, with the plan
    listing each PNG and its hashes, card maps clamped in V, the macro mask on the large-surface sets, Preserve Area
    on masked batches, Collision_Only batches as hidden walls, and the whole-key shadow rule."""
    A = apply_replica
    assert A.texture_set('Stone', {}) == 'limestone' and A.texture_set('Slate', {}) == 'slate'
    assert A.texture_set('Stone_Cast', {}) is None and A.texture_set('Trim', {}) is None
    assert A.texture_set('limestone_rear', {}) == 'limestone' and A.texture_set('roof_slate', {}) == 'slate'
    assert A.texture_set('Wall', {'texture': A.TEXTURE_ASSETS + '/T_Replica_Slate_diff'}) == 'slate'
    assert A.texture_set('Brick_Buff_Even', {}) == 'buff_brick' and A.texture_set('Brick_Red', {}) is None
    assert A.base_material('Brick_Buff_Even', {'base_color_srgb': '#CCB07F'}) == (A.TEXTURED_PARENT, 'replica_buff_brick')
    folder = replica.OUT / A.TEXTURES
    index = json.loads((folder / A.TEXTURE_INDEX).read_text())
    # The Trees manifest's own sets (bark, autumn leaf atlas) sit beside the textures.json sets.
    trees = replica.OUT / A.TREES / 'manifest.json'
    tree_sets = (json.loads(trees.read_text()).get(A.TREE_TEXTURE_SETS) or {}) if trees.is_file() else {}
    assert not set(tree_sets) & set(index['sets']), 'A tree texture set reuses a replica set name'
    sets_index = dict(index['sets'], **tree_sets)
    textures = {t['asset']: t for t in the_plan['textures']}
    assert len(textures) == len(the_plan['textures']) == the_plan['counts']['textures']
    for t in the_plan['textures']:
        macro = t['set'] == 'macro'
        entry = index['macro'] if macro else sets_index[t['set']]
        assert t['file'].startswith((A.TREES if t['set'] in tree_sets else A.TEXTURES) + '/'), t['file']
        stored = entry if macro else entry['maps'][t['role']]
        path = replica.OUT / t['file']
        data = path.read_bytes()
        assert hashlib.sha256(data).hexdigest() == t['sha256'], t['file']
        width, height, raw = plateau_textures.read_png(data)
        assert hashlib.sha256(raw).hexdigest() == t['raw_sha256'] == stored['raw_sha256'], t['file']
        assert [width, height] == t['size_px'] == entry['size_px'] and width >= 512 and height >= 512
        assert t['asset'] == f'{A.TEXTURE_ASSETS}/{path.stem}' and t['asset'].startswith(A.ASSETS + '/')
        assert (t['srgb'], t['compression'], t['sampler']) == (stored['srgb'], stored['compression'], stored['sampler'])
        assert t['srgb'] == (t['role'] == 'diff') and (t['compression'] == 'TC_NORMALMAP') == (t['role'] == 'nor_dx')
        # Cards span their texture once in V: all three maps clamp V; the leaf atlas clamps both axes; every tiling
        # map wraps.
        uv = None if macro else entry.get('uv')
        assert t['address_y'] == ('TA_CLAMP' if uv in ('card', 'atlas') else 'TA_WRAP'), t['asset']
        assert t['address_x'] == ('TA_CLAMP' if uv == 'atlas' else 'TA_WRAP'), t['asset']
        if macro:
            assert t['role'] == A.MACRO_ROLE and (t['compression'], t['sampler']) == ('TC_MASKS', 'SAMPLERTYPE_MASKS')
    textured = [m for m in the_plan['materials'] if m.get('texture_set')]
    assert len(textured) == the_plan['counts']['textured_replica_materials']
    specs = {layer: json.loads((replica.OUT / layer / 'manifest.json').read_text()).get('materials', {})
             for layer in {m['layer'] for m in the_plan['materials']} if layer != A.TREES}
    for m in the_plan['materials']:
        spec = m['spec'] if m['layer'] == A.TREES else specs[m['layer']][m['key']]
        assert bool(m.get('texture_set')) == bool(A.texture_set(m['key'], spec, sets_index)
                                                   and not spec.get('emissive_srgb')
                                                   and 'brick' not in (spec.get('texture') or '')
                                                   and 'asphalt' not in (spec.get('texture') or '')), m['asset']
        if m['layer'] == A.TREES and spec.get('texture'):
            assert m.get('texture_set') in tree_sets, (m['asset'], 'a tree map with no texture set renders flat')
    for m in textured:
        entry = sets_index[m['texture_set']]
        surface = entry['surface']
        assert m['duplicate_of'] == A.SURFACE_PARENTS[surface] and m['texture_mean'] == 'replica_' + m['texture_set']
        assert (m['blend_mode'], m['two_sided']) == (entry['material']['blend_mode'], entry['material']['two_sided'])
        spec = m['spec'] if m['layer'] == A.TREES else specs[m['layer']][m['key']]
        # Metallic: the manifest's, capped by the set's own (galvanised sheet); tint: the manifest colour over the
        # texture mean, or white where the set owns its colour (tar).
        want_metal = spec.get('metallic', 0.) if 'metallic' not in entry else min(spec.get('metallic', 0.), entry['metallic'])
        assert m['wet'] == (surface == 'ground') and m['metallic'] == want_metal, (m['asset'], m['metallic'])
        own = bool(entry.get('own_colour'))
        want_tint = (1., 1., 1.) if own else tuple(min(A.TINT_LIMIT, c / mm) for c, mm in
                                                    zip(A.linear(spec['base_color_srgb']), entry['mean_linear']))
        assert m['tint'] == want_tint and m['colour_source'] == ('texture' if own else 'manifest'), m['asset']
        assert sorted(m['textures']) == sorted(A.TEXTURE_ROLES) and all(a in textures for a in m['textures'].values())
        assert all(textures[a]['set'] == m['texture_set'] and textures[a]['role'] == r for r, a in m['textures'].items())
        assert m['mean_linear'] == entry['mean_linear'] and m['tiling'] == entry['tiling']
        assert all(abs(t * s - 1) < 1e-6 for t, s in zip(m['tiling'], entry['tile_m'])), m['asset']
        if 'macro' in entry:
            macro = m['macro']
            assert macro['strength'] == entry['macro']['strength'] and macro['channels'] == ['R', 'G']
            assert textures[macro['texture']]['role'] == A.MACRO_ROLE
            assert all(abs(t[0] * s - 1) < 1e-5 and t[0] == t[1] for t, s in zip(macro['tiling'], index['macro']['tile_m']))
        else:
            assert 'macro' not in m, m['asset']
    used = {t['set'] for t in the_plan['textures'] if t['set'] != 'macro'}
    assert used == {m['texture_set'] for m in textured}
    assert any(t['set'] == 'macro' for t in the_plan['textures']) == any(m.get('macro') for m in textured)
    assert the_plan['counts']['macro_materials'] == sum(1 for m in textured if m.get('macro'))
    for t in the_plan['textures']:
        # The cut-out diffuse maps carry alpha, and their mips keep the clip coverage.
        alpha = t['set'] != 'macro' and t['role'] == 'diff' and sets_index[t['set']]['alpha']
        assert t['alpha'] == alpha and (t['alpha_coverage_threshold'] == .5 if alpha else t['alpha_coverage_threshold'] is None)
    check_plan_meshes(the_plan)
    plex = replica.OUT / 'Plex/manifest.json'
    if plex.is_file():
        keys = {m['key']: m for m in the_plan['materials'] if m['layer'] == 'Plex'}
        assert keys['Stone'].get('texture_set') == 'limestone' and keys['Slate'].get('texture_set') == 'slate'
        assert not keys.get('Stone_Cast', {}).get('texture_set')
        stone_meshes = [mesh for mesh in the_plan['meshes'] if mesh['material'] == keys['Stone']['asset']]
        slate_meshes = [mesh for mesh in the_plan['meshes'] if mesh['material'] == keys['Slate']['asset']]
        assert stone_meshes and slate_meshes, 'No Plex batch uses the textured stone or slate material'
        for key, name in A.SHARED_TEXTURE_KEYS.items():
            if key in keys:
                assert keys[key].get('texture_set') == name, (key, keys[key].get('texture_set'))
        # The tar roof shows its own grey gravel (about #4A4744) whatever Plex calls its colour, and galvanised
        # sheet stays at most .3 metallic, so it reads light grey in shade.
        if 'Roof_Tar' in keys:
            tar = keys['Roof_Tar']
            assert tar['tint'] == (1., 1., 1.) and tar['colour_source'] == 'texture', tar['tint']
            shown = plateau_textures.to_srgb_hex([c * t for c, t in zip(tar['mean_linear'], tar['tint'])])
            assert all(abs(int(shown[i:i + 2], 16) - int('4A4744'[i - 1:i + 1], 16)) <= 6 for i in (1, 3, 5)), shown
        if 'Sheet_Metal' in keys:
            sheet = keys['Sheet_Metal']
            assert sheet['metallic'] <= plateau_textures.SETS['sheet_metal']['metallic'] <= .35, sheet['metallic']
            grey = [c * t for c, t in zip(sheet['mean_linear'], sheet['tint'])]
            assert .25 < sum(grey) / 3 < .5 and max(grey) / min(grey) < 1.15, ('Sheet_Metal reads light grey', grey)
    return {'textures': {t['asset'].rsplit('/', 1)[1]: {'size_px': t['size_px'], 'sha256': t['sha256'][:16],
                                                        'raw_sha256': t['raw_sha256'][:16], 'address_y': t['address_y']}
                         for t in the_plan['textures']},
            'materials': {m['asset'].rsplit('/', 1)[1]: {'set': m['texture_set'], 'tiling': m['tiling'],
                                                         'duplicate_of': m['duplicate_of'].rsplit('/', 1)[1],
                                                         'blend_mode': m['blend_mode'], 'two_sided': m['two_sided'],
                                                         'macro': (m.get('macro') or {}).get('strength')}
                          for m in textured}}


def check_plan_meshes(the_plan):
    """Mesh and actor rows: Preserve Area exactly on masked batches; Collision_Only batches collide, hidden in game;
    shadows by whole key or prefix, so plant_rust casts one and rust or crack_seal do not."""
    A = apply_replica
    mats = {m['asset']: m for m in the_plan['materials']}
    meshes = {m['asset']: m for m in the_plan['meshes']}
    for mesh in the_plan['meshes']:
        masked = mats[mesh['material']].get('blend_mode') == 'masked'
        assert mesh['nanite_shape_preservation'] == (A.PRESERVE_AREA if masked else None), mesh['asset']
    for actor in the_plan['actors']:
        key = mats[meshes[actor['mesh']]['material']]['key']
        assert actor['shadow'] == A.casts_shadow(key) and actor['collision_only'] == (key == A.COLLISION_ONLY), actor
        assert actor['hidden_in_game'] == actor['collision_only'], actor['label']
        if actor['collision_only']:
            assert actor['collision'] != 'none' and not actor['shadow'], actor['label']
    assert A.casts_shadow('plant_rust') and A.casts_shadow('plant_green') and A.casts_shadow('Leaf_Creeper')
    assert not any(A.casts_shadow(k) for k in ('rust', 'rust_streak', 'crack_seal', 'paint_white', 'Collision_Only'))
    assert the_plan['counts']['preserve_area_meshes'] == sum(1 for m in the_plan['meshes'] if m['nanite_shape_preservation'])
    assert the_plan['counts']['hidden_collision_actors'] == sum(1 for a in the_plan['actors'] if a['collision_only'])


def check_plan_clearance(world, the_plan):
    """Every batch the apply step imports with collision, Plex and Collision_Only included, stays at least 300 cm
    from every traffic centreline (OBJ y negated, as parse_obj reads it)."""
    worst, faces = math.inf, 0
    for mesh in the_plan['meshes']:
        if mesh['collision'] == 'none' or mesh['layer'] == 'Props':
            continue
        for face in parse_obj(replica.OUT / mesh['layer'] / mesh['file'])[1]:
            worst = min(worst, world.traffic_distance([p[:2] for p in face], 2000))
            faces += 1
    assert worst >= replica.CLEAR - .01, f'Planned collision {worst:.1f} cm from a traffic centreline'
    return {'collision_faces': faces, 'min_to_traffic_cm': round(worst, 1)}


def synthetic_plex(root, keys, trees=None, extra=None, tree_kinds=None):
    """A minimal Plex layer under root: one one-triangle batch per material key, the committed Textures folder,
    and optionally Plex/yard_trees.json, more keys (extra: {key: (spec, collision)}) and a Trees/manifest.json
    (tree_kinds: {species: {materials, height_cm, trunk_cm}}, each with a two-slot OBJ), so the apply plan can be
    checked before the generators write them."""
    A = apply_replica
    data = Path(root) / 'Data/Plateau/ReplicaGeometry'
    (data / 'Plex').mkdir(parents=True, exist_ok=True)
    try:
        (data / A.TEXTURES).symlink_to(replica.OUT / A.TEXTURES, target_is_directory=True)
    except OSError:
        import shutil
        shutil.copytree(replica.OUT / A.TEXTURES, data / A.TEXTURES)
    index = json.loads((replica.OUT / A.TEXTURES / A.TEXTURE_INDEX).read_text())['sets']
    batches, materials = [], {}
    rows = [(key, None, 'none') for key in keys] + [(key, spec, collision) for key, (spec, collision) in
                                                   sorted((extra or {}).items())]
    for key, spec, collision in rows:
        name = f'{key}_XP000_YP000.obj'
        body = b'v 0 0 0\nv 100 0 0\nv 0 0 100\nvt 0 0\nvt 1 0\nvt 0 1\nf 1/1 2/2 3/3\n'
        (data / 'Plex' / name).write_bytes(body)
        batches.append({'file': name, 'mesh': 'SM_' + name[:-4], 'material': key, 'collision': collision, 'triangles': 1,
                        'bounds_cm': [0, 0, 0, 100, 0, 100], 'sha256': hashlib.sha256(body).hexdigest()})
        if spec is None:
            entry = index[A.SHARED_TEXTURE_KEYS[key]]
            spec = {'base_color_srgb': entry['base_color_srgb'], 'roughness': entry['roughness_mean'],
                    'metallic': entry.get('metallic', 0.)}
        materials[key] = spec
    (data / 'Plex/manifest.json').write_text(json.dumps({
        'layer': 'Plex', 'generator': 'test', 'frame': 'x east, y north, cm, z up', 'batches': batches,
        'materials': materials, 'counts': {}, 'source_sha256': {}}))
    if trees is not None:
        (data / A.YARD_TREES).write_text(json.dumps(trees))
    if tree_kinds is not None:
        (data / A.TREES).mkdir(exist_ok=True)
        manifest = {'generator': 'test', 'kinds': {}, 'materials': {'Bark_Grey': {'base_color_srgb': '#5A534B',
                                                                                   'roughness': .9, 'metallic': 0}}}
        for species, kind in tree_kinds.items():
            body = (b'o tree\nv 0 0 0\nv 40 0 0\nv 0 0 900\nv 300 0 600\nv 0 300 700\nv -300 0 800\n'
                    b'usemtl bark\nf 1 2 3\nusemtl leaves\nf 4 5 6\n')
            (data / A.TREES / f'Tree_{species}.obj').write_bytes(body)
            manifest['kinds'][species] = dict(kind, obj=f'Tree_{species}.obj')
        (data / A.TREES / 'manifest.json').write_text(json.dumps(manifest))
    return index


def check_shared_plan():
    """Every shared key of the rear pass, as plateau_plex.py will write it, through the apply plan: its texture set,
    parent, blend mode and sidedness, tiling, macro variation, built masked parents, alpha textures, clamped cards,
    Preserve Area meshes, Collision_Only walls, the shadow rule; and the yard-tree actors."""
    A = apply_replica
    keys = sorted(A.SHARED_TEXTURE_KEYS)
    assert keys == sorted(['Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Sheet_Metal', 'Siding_Lap_Cream',
                           'Siding_Lap_Grey', 'Parged', 'Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper',
                           'Yard_Grass', 'Yard_Pavers', 'Yard_Soil', 'Yard_Gravel', 'Brick_Buff_Even',
                           'Concrete_Lane_Aged', 'Leaf_Cedar', 'Plant_Grass_Fountain', 'Plant_Pit_Flowers',
                           'Iron_Wrought', 'Cloth_Laundry', 'Leaf_Litter'])
    # cards (V clamped), the laundry atlas (both axes clamped), the foliage-lit keys, the tiling cut-outs (fallen leaves)
    cards = {'Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Cedar', 'Plant_Grass_Fountain', 'Plant_Pit_Flowers',
             'Iron_Wrought'}
    atlas = {'Cloth_Laundry'}
    foliage = {'Leaf_Creeper', 'Leaf_Cedar', 'Plant_Grass_Fountain', 'Plant_Pit_Flowers'}
    litter = {'Leaf_Litter'}
    masked = cards | atlas | foliage | litter
    ground = {'Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Yard_Grass', 'Yard_Pavers', 'Yard_Soil', 'Yard_Gravel',
              'Concrete_Lane_Aged'}
    macro = {'Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Yard_Gravel', 'Brick_Buff_Even', 'Concrete_Lane_Aged',
             'Leaf_Litter'}
    plain = {'Collision_Only': ({'base_color_srgb': '#FF00FF', 'roughness': 1., 'metallic': 0}, 'complex'),
             'plant_rust': ({'base_color_srgb': '#8A3A20', 'roughness': .8, 'metallic': 0}, 'none'),
             'rust': ({'base_color_srgb': '#6A3A20', 'roughness': .8, 'metallic': 0}, 'none')}
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        index = synthetic_plex(tmp, keys, extra=plain)
        the_plan = A.plan(tmp)
        rows = {m['key']: m for m in the_plan['materials']}
        assert sorted(rows) == sorted(keys + list(plain))
        for key, m in rows.items():
            if key in plain:
                assert not m.get('texture_set') and m['duplicate_of'].endswith('/M_Trim'), key
                continue
            name = A.SHARED_TEXTURE_KEYS[key]
            entry = index[name]
            assert m['texture_set'] == name and m['texture_mean'] == 'replica_' + name, key
            assert m['asset'] == f'{A.MATERIALS}/M_Replica_Plex_{key}'
            want_parent = (A.FOLIAGE_PARENT if key in foliage else A.CUTOUT_PARENT if key in masked
                           else A.WET_PARENT if key in ground else A.TEXTURED_PARENT)
            assert m['duplicate_of'] == want_parent, (key, m['duplicate_of'])
            assert (m['blend_mode'] == 'masked') == (key in masked) and m['two_sided'] == (key in masked), key
            assert m['shading_model'] == ('two_sided_foliage' if key in foliage else 'default_lit'), key
            assert m['opacity_mask_clip'] == (.5 if key in masked else None) and m['wet'] == (key in ground), key
            assert m['tiling'] == entry['tiling'] and m['uv'] == ('card' if key in cards else 'atlas' if key in atlas
                                                                  else 'metres'), key
            if m['uv'] == 'card':
                assert m['tiling'][1] == 1., key            # v runs 0..1 up the card once
            assert m['metallic'] == entry.get('metallic', 0.), key
            assert bool(m.get('macro')) == (key in macro), key
            # The test colours are the texture means, so the tint is about 1 in every channel.
            tint = [c / mm for c, mm in zip(A.linear(m['base_color_srgb']), m['mean_linear'])]
            assert all(.97 < t < 1.03 for t in tint), (key, tint)
            out[key] = {'set': name, 'parent': m['duplicate_of'].rsplit('/', 1)[1], 'blend_mode': m['blend_mode'],
                        'two_sided': m['two_sided'], 'tiling': m['tiling'], 'macro': (m.get('macro') or {}).get('strength')}
        assert rows['Siding_Lap_Cream']['textures'] == rows['Siding_Lap_Grey']['textures'], 'Both sidings share one set'
        parents = {p['asset']: p for p in the_plan['parents']}
        assert sorted(parents) == sorted(A.BUILT_PARENTS)
        assert parents[A.FOLIAGE_PARENT]['shading_model'] == 'two_sided_foliage'
        assert all(p['blend_mode'] == 'masked' and p['two_sided'] and p['opacity_mask_clip'] == .5 for p in parents.values())
        assert parents[A.CUTOUT_PARENT]['textures'] == rows[min(masked - foliage)]['textures']
        sets = {A.SHARED_TEXTURE_KEYS[k] for k in keys}
        assert len(the_plan['textures']) == 3 * len(sets) + 1 == the_plan['counts']['textures'], 'three maps a set + macro'
        alpha = sorted(t['set'] for t in the_plan['textures'] if t['alpha'])
        assert alpha == sorted(['balusters', 'lattice', 'fence_boards', 'creeper', 'cedar', 'fountain_grass',
                                'pit_flowers', 'iron_wrought', 'laundry', 'leaf_litter'])
        clamped = sorted({t['set'] for t in the_plan['textures'] if t['address_y'] == 'TA_CLAMP'})
        assert clamped == sorted(A.SHARED_TEXTURE_KEYS[k] for k in cards | atlas)
        assert the_plan['counts']['clamped_textures'] == 3 * len(cards | atlas)
        assert sorted({t['set'] for t in the_plan['textures'] if t['address_x'] == 'TA_CLAMP'}) == ['laundry']
        assert the_plan['counts']['masked_materials'] == len(masked) and the_plan['counts']['built_parents'] == 2
        assert the_plan['counts']['macro_materials'] == len(macro)
        preserve = sorted(m['material'].rsplit('_Plex_', 1)[1] for m in the_plan['meshes'] if m['nanite_shape_preservation'])
        assert preserve == sorted(masked), preserve
        actors = {a['label'].rsplit(' ', 1)[1][:-len('_XP000_YP000')]: a for a in the_plan['actors']}
        wall = actors['Collision_Only']
        assert wall['collision_only'] and wall['hidden_in_game'] and not wall['shadow'] and wall['collision'] == 'complex'
        assert actors['plant_rust']['shadow'] and not actors['rust']['shadow'], 'plant_rust is a plant, not a rust decal'
        assert sum(1 for a in actors.values() if a['collision_only']) == 1 == the_plan['counts']['hidden_collision_actors']
        check_plan_meshes(the_plan)
        assert the_plan['trees'] == [] and not the_plan['yard_trees']['present']
        assert the_plan['counts']['yard_tree_actors'] == the_plan['counts']['yard_tree_instances'] == 0
        shared = A.shared_key_plan(tmp)
        assert sorted(shared) == keys
        # Every key reports its maps' addressing: cards clamp V, the laundry atlas both axes, the rest wrap.
        assert all((shared[k]['address_y'] == 'TA_CLAMP') == (k in cards | atlas) for k in keys)
        assert all((shared[k]['address_x'] == 'TA_CLAMP') == (k in atlas) for k in keys)
        assert all(bool(shared[k].get('macro_strength')) == (k in macro) for k in keys)
        # The fourth pass's contract keys, as agreed: each on its set, masked, two-sided and V-clamped where the
        # contract says, the ruelle gutter without a shadow.
        contract = the_plan['contract_keys']
        assert sorted(contract) == sorted(A.CONTRACT_KEYS) == sorted(['Concrete_Lane_Aged', 'Leaf_Cedar',
                                                                      'Plant_Grass_Fountain', 'Plant_Pit_Flowers',
                                                                      'Iron_Wrought', 'Cloth_Laundry', 'Leaf_Litter'])
        for k, row in contract.items():
            assert row['set'] == A.SHARED_TEXTURE_KEYS[k] and row['used_by'] == ['Plex'], (k, row)
            assert (row['blend_mode'] == 'masked') == (k in masked) and row['two_sided'] == (k in masked), k
            assert row['address'] == [shared[k]['address_x'], shared[k]['address_y']], k
        assert contract['Leaf_Cedar']['address'][1] == contract['Plant_Grass_Fountain']['address'][1] == 'TA_CLAMP'
        assert contract['Cloth_Laundry']['address'] == ['TA_CLAMP', 'TA_CLAMP'] and contract['Cloth_Laundry']['own_colour']
        assert not contract['Concrete_Lane_Aged']['shadow'] and not actors['Concrete_Lane_Aged']['shadow'], \
            'the ruelle gutter is ground: no shadow'
        # Fallen leaves: masked cut-outs on metre UVs that tile both ways, their own colour, flat on the ground, so no
        # shadow (a masked shadow pass over every litter patch costs and shows nothing).
        litter = contract['Leaf_Litter']
        assert (litter['set'], litter['parent'], litter['uv'], litter['address']) == \
            ('leaf_litter', A.CUTOUT_PARENT, 'metres', ['TA_WRAP', 'TA_WRAP']), litter
        assert litter['own_colour'] and not litter['shadow'] and not actors['Leaf_Litter']['shadow'], litter
        assert rows['Leaf_Litter']['tint'] == (1., 1., 1.) and rows['Leaf_Litter']['tiling'] == [.5, .5]
        assert 'alley_gutter' not in A.GROUND_KEYS, 'the gutter is Concrete_Lane_Aged now'
    # Yard trees: grouped by kind in a fixed order, the shared crown factor on X and Y only, no collision.
    trees = [{'x': 100. * n, 'y': -50. * n, 'z': 12., 'yaw': 400. + n, 'scale': 1.5 + .1 * n, 'kind': kind}
             for n, kind in enumerate(['elm', 'maple', 'maple', 'small', 'ash', 'maple', 'elm'])]
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': trees})
        the_plan = A.plan(tmp)
        assert the_plan['yard_trees']['present'] and the_plan['yard_trees']['mesh'] == A.TREE_MESH
        assert the_plan['yard_trees']['mode'] == 'shared mesh' and not the_plan['tree_meshes']
        assert [t['kind'] for t in the_plan['trees']] == ['maple', 'ash', 'elm', 'small']
        assert [t['count'] for t in the_plan['trees']] == [3, 1, 2, 1] and the_plan['counts']['yard_tree_instances'] == 7
        for t in the_plan['trees']:
            assert t['label'] == f'{A.PREFIX}Plex yard trees {t["kind"]}' and not t['collision']
            assert t['mesh'] == A.TREE_MESH and t['cull_cm'] == list(A.TREE_CULL_CM)
            src = [r for r in trees if r['kind'] == t['kind']]
            for (p, yaw, scale), r in zip(t['transforms'], src):
                assert p == (r['x'], r['y'], r['z']) and yaw == r['yaw'] % 360.
                assert scale == (r['scale'] * A.TREE_KINDS[r['kind']], r['scale'] * A.TREE_KINDS[r['kind']], r['scale'])
        labels = [t['label'] for t in the_plan['trees']]
        assert len(set(labels)) == len(labels)
        out['yard_trees'] = {t['kind']: t['count'] for t in the_plan['trees']}
    for bad in ({'x': 0, 'y': 0, 'z': 0, 'yaw': 0, 'scale': 1, 'kind': 'oak'},
                {'x': float('nan'), 'y': 0, 'z': 0, 'yaw': 0, 'scale': 1, 'kind': 'ash'},
                {'x': 0, 'y': 0, 'z': 0, 'yaw': 0, 'scale': 0, 'kind': 'ash'}):
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_plex(tmp, ['Yard_Grass'], [bad])
            try:
                A.plan(tmp)
            except (AssertionError, ValueError):
                continue
            raise AssertionError(f'A bad yard tree was accepted: {bad}')
    out['species_meshes'] = check_tree_species_plan()
    out['tree_textures'] = check_tree_texture_plan()
    out['street_trees'] = check_street_trees_synthetic()
    out['street_tree_falls'] = check_street_tree_falls()
    out['kind_falls'] = check_kind_falls()
    out['street_tree_traffic'] = check_street_tree_traffic()
    out['missing_tree_obj'] = check_missing_tree_obj()
    out['host_steps'] = check_host_steps()
    return out


TREE_KINDS_FIXTURE = {
    'norway_maple': {'materials': {'bark': 'Bark_Grey', 'leaves': {'base_color_srgb': '#C8902E', 'roughness': .6}},
                     'height_cm': 1500, 'trunk_cm': 45},
    'elm': {'materials': {'bark': 'Bark_Grey', 'leaves': {'base_color_srgb': '#B89A3A', 'roughness': .6}},
            'height_cm': 1600, 'trunk_cm': 50},
    'silver_maple': {'materials': {'bark': {'base_color_srgb': '#77736C', 'roughness': .85},
                                   'leaves': '/Game/Art/M_DetailedAutumnLeaves'}, 'height_cm': 1800, 'trunk_cm': 60},
}
TREE_ROWS_FIXTURE = [
    {'x': 0., 'y': 0., 'z': 0., 'yaw': 10., 'scale': 3., 'kind': 'maple'},
    {'x': 500., 'y': 0., 'z': 2., 'yaw': 20., 'scale': 2.5, 'kind': 'elm'},
    {'x': 900., 'y': 300., 'z': 0., 'yaw': 30., 'scale': 3.2, 'kind': 'silver_maple', 'height_cm': 1700.},
    {'x': 1300., 'y': 300., 'z': 0., 'yaw': 40., 'scale': 2., 'kind': 'norway_maple'},
]


def check_tree_species_plan():
    """Trees/manifest.json present: each yard tree on its species mesh (maple reads as norway_maple; elm is the vase
    species since the fourth pass), uniformly scaled to its height; bark and leaves materials planned once each (leaves as two-sided
    foliage), an existing /Game/ material used as is; a bad manifest or a missing species fails the plan."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        the_plan = A.plan(tmp)
        yard = the_plan['yard_trees']
        assert yard['mode'] == 'species meshes' and yard['mesh'] is None and yard['aliases'] == A.TREE_ALIASES
        assert [t['kind'] for t in the_plan['trees']] == ['norway_maple', 'silver_maple', 'elm']
        assert [t['count'] for t in the_plan['trees']] == [2, 1, 1]
        for t in the_plan['trees']:
            assert t['mesh'] == A.tree_mesh_asset(t['kind']) == f'{A.ASSETS}/Trees/SM_Tree_{t["kind"]}'
            assert t['label'] == f'{A.PREFIX}Plex yard trees {t["kind"]}' and not t['collision'] and t['crown'] == 1.
            height = TREE_KINDS_FIXTURE[t['kind']]['height_cm']
            src = [r for r in TREE_ROWS_FIXTURE if A.TREE_ALIASES.get(r['kind'], r['kind']) == t['kind']]
            for (p, yaw, scale), r in zip(t['transforms'], src):
                want = r.get('height_cm', r['scale'] * A.TREE_MESH_HEIGHT_CM) / height
                assert p == (r['x'], r['y'], r['z']) and scale == (want, want, want), (t['kind'], scale, want)
        meshes = {m['species']: m for m in the_plan['tree_meshes']}
        assert sorted(meshes) == ['elm', 'norway_maple', 'silver_maple'] and the_plan['counts']['tree_meshes'] == 3
        assert all(m['nanite_shape_preservation'] == A.PRESERVE_AREA and m['collision'] == 'none' for m in meshes.values())
        trees = {m['key']: m for m in the_plan['materials'] if m['layer'] == A.TREES}
        assert sorted(trees) == ['Bark_Grey', 'elm_leaves', 'norway_maple_leaves', 'silver_maple_bark']
        assert the_plan['counts']['tree_materials'] == 4
        assert trees['norway_maple_leaves']['foliage'] and not trees['Bark_Grey']['foliage']
        assert not trees['silver_maple_bark']['foliage'] and trees['Bark_Grey']['duplicate_of'].endswith('/M_Trim')
        assert meshes['norway_maple']['materials'] == {'bark': f'{A.MATERIALS}/M_Replica_Trees_Bark_Grey',
                                                       'leaves': f'{A.MATERIALS}/M_Replica_Trees_norway_maple_leaves'}
        assert meshes['silver_maple']['materials']['leaves'] == '/Game/Art/M_DetailedAutumnLeaves'
        assert meshes['elm']['materials']['bark'] == meshes['norway_maple']['materials']['bark']
        assert not any(a['label'].endswith('Tree_norway_maple') for a in the_plan['actors']), 'Trees is not a layer'
        # The preview keeps the shared-mesh fallback when called without species.
        assert [t['kind'] for t in A.plan_trees(A.load_yard_trees(tmp))] == ['maple', 'elm', 'norway_maple', 'silver_maple']
        out = {'species': {t['kind']: t['count'] for t in the_plan['trees']}, 'materials': sorted(trees)}
    bad_cases = (
        ('an unknown kind', dict(TREE_KINDS_FIXTURE, oak=TREE_KINDS_FIXTURE['elm'])),
        ('a missing leaves slot', dict(TREE_KINDS_FIXTURE, elm={'materials': {'bark': 'Bark_Grey'},
                                                                   'height_cm': 1600, 'trunk_cm': 50})),
        ('a stale mesh hash', dict(TREE_KINDS_FIXTURE, elm=dict(TREE_KINDS_FIXTURE['elm'], sha256='0' * 64))),
        ('a silly height', dict(TREE_KINDS_FIXTURE, elm=dict(TREE_KINDS_FIXTURE['elm'], height_cm=50))),
        ('a species with no mesh', {k: v for k, v in TREE_KINDS_FIXTURE.items() if k != 'elm'}))
    for message, kinds in bad_cases:
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=kinds)
            try:
                A.plan(tmp)
            except (AssertionError, KeyError, ValueError):
                continue
            raise AssertionError('Accepted a Trees manifest with ' + message)
    return out


def synthetic_streets(root, rows, detailed=2, young=('norway_maple',)):
    """Streets/street_trees.json under a synthetic root (rows in the plateau_replica.py row format), the
    Data/Plateau/layout.json route trees (detailed) and young meshes for the given kinds of its Trees manifest."""
    A = apply_replica
    data = Path(root) / 'Data/Plateau/ReplicaGeometry'
    (data / 'Streets').mkdir(parents=True, exist_ok=True)
    (data / A.STREET_TREES).write_text(json.dumps({'layer': 'Streets', 'trees': rows}))
    (Path(root) / A.PLATEAU_LAYOUT).write_text(json.dumps({'streets': {'detailed_trees': [[0., 0.]] * detailed}}))
    path = data / A.TREES / 'manifest.json'
    if path.is_file():
        manifest = json.loads(path.read_text())
        for species in young:
            body = (b'o tree\nv 0 0 0\nv 8 0 0\nv 0 0 500\nv 100 0 300\nv 0 100 400\nv -100 0 450\n'
                    b'usemtl bark\nf 1 2 3\nusemtl leaves\nf 4 5 6\n')
            (data / A.TREES / f'Tree_{species}_young.obj').write_bytes(body)
            manifest['kinds'][species][A.YOUNG] = {'obj': f'Tree_{species}_young.obj', 'height_cm': 500, 'trunk_cm': 7}
        path.write_text(json.dumps(manifest))


def street_row(n, kind, height, dbh, **extra):
    return dict({'id': f'inv:5-{n}', 'x_cm': 100. * n, 'y_cm': -40. * n, 'z_cm': 18., 'species': 'Ulmus', 'kind': kind,
                 'fall': 'yellow', 'dbh_cm': dbh, 'height_cm': height, 'source': 'inventory', 'pit': True,
                 'yaw_deg': 30 * n}, **extra)


STREET_ROWS_FIXTURE = [
    street_row(1, 'norway_maple', 425, 5.),        # a new planting: the young mesh, 0.85 of its 5 m
    street_row(2, 'norway_maple', 1500, 45.),      # the mature mesh at about its own size
    street_row(3, 'silver_maple', 3200, 200.),     # an old giant: the height scale clamps, the crown spreads
    street_row(4, 'elm', 300, 3.),                 # no young elm in this fixture: the mature mesh at its floor
    street_row(5, 'norway_maple', None, 90.),      # no height: the trunk gives it
    street_row(6, 'silver_maple', 1800, 20.),      # a slim trunk narrows the crown to the spread floor
]


def check_street_trees_synthetic():
    """Streets/street_trees.json through the apply plan on a synthetic root: each row on its kind's mesh, a new
    planting on the kind's young mesh, the height scale clamped, the crown spread from the trunk within its limits, one
    actor per kind and mesh after the yard actors; the old summer trees planned away (the vegetation cleared, the
    route trees hidden); street trees without species meshes, an unknown kind, a repeated id or a bad number fail."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        synthetic_streets(tmp, STREET_ROWS_FIXTURE)
        the_plan = A.plan(tmp)
        yard = [t for t in the_plan['trees'] if t['group'] == 'yard']
        street = [t for t in the_plan['trees'] if t['group'] == 'street']
        assert the_plan['trees'] == yard + street, 'street actors follow the yard actors'
        assert [(t['kind'], t['variant']) for t in street] == [('norway_maple', None), ('norway_maple', A.YOUNG),
                                                               ('silver_maple', None), ('elm', None)]
        assert [t['ids'] for t in street] == [['inv:5-2', 'inv:5-5'], ['inv:5-1'], ['inv:5-3', 'inv:5-6'], ['inv:5-4']]
        assert street[1]['label'] == f'{A.PREFIX}Street trees norway_maple young'
        assert street[1]['mesh'] == f'{A.ASSETS}/Trees/SM_Tree_norway_maple_young'
        scale = {i: s for t in street for i, (_, _, s) in zip(t['ids'], t['transforms'])}
        nm = TREE_KINDS_FIXTURE['norway_maple']
        assert scale['inv:5-1'][2] == round(425 / 500, 4) and abs(scale['inv:5-1'][0] / scale['inv:5-1'][2] - 1) < .1
        assert scale['inv:5-2'][2] == round(1500 / nm['height_cm'], 4) and scale['inv:5-2'][0] == scale['inv:5-2'][2]
        assert scale['inv:5-3'][2] == A.TREE_SCALE[1] and scale['inv:5-3'][0] == round(A.TREE_SCALE[1] * A.CROWN_SPREAD[1], 4)
        assert scale['inv:5-4'][2] == A.TREE_SCALE[0], 'a sapling with no young mesh stands at the floor'
        assert scale['inv:5-5'][2] == A.TREE_SCALE[1], 'no height: a 90 cm trunk on a 45 cm mesh is as tall as allowed'
        assert scale['inv:5-6'][0] == round(scale['inv:5-6'][2] * A.CROWN_SPREAD[0], 4), scale['inv:5-6']
        assert all(t['transforms'][0][0] == (100. * int(t['ids'][0].split('-')[1]), -40. * int(t['ids'][0].split('-')[1]), 18.)
                   for t in street)
        meshes = {(m['species'], m['variant']) for m in the_plan['tree_meshes']}
        assert ('norway_maple', A.YOUNG) in meshes and ('elm', None) in meshes
        young = next(m for m in the_plan['tree_meshes'] if m['variant'])
        mature = next(m for m in the_plan['tree_meshes'] if m['species'] == 'norway_maple' and not m['variant'])
        assert young['materials'] == mature['materials'] and young['file'] == 'Trees/Tree_norway_maple_young.obj'
        assert the_plan['counts']['street_tree_instances'] == 6 and the_plan['counts']['young_street_trees'] == 1
        assert the_plan['counts']['yard_tree_instances'] == len(TREE_ROWS_FIXTURE)
        assert the_plan['vegetation']['label'] == A.VEGETATION_LABEL and the_plan['vegetation']['mesh'] == A.TREE_MESH
        assert the_plan['hide'] == list(A.HIDE_LABELS) + [f'{A.DETAIL_TREE_LABEL}{i}' for i in range(2)]
        out = {t['label'][len(A.PREFIX):]: t['count'] for t in street}
    bad = (('street trees without species meshes', None, STREET_ROWS_FIXTURE),
           ('an unknown kind', TREE_KINDS_FIXTURE, STREET_ROWS_FIXTURE + [street_row(9, 'oak', 900, 30.)]),
           ('a repeated id', TREE_KINDS_FIXTURE, STREET_ROWS_FIXTURE + [STREET_ROWS_FIXTURE[0]]),
           ('a trunk of nothing', TREE_KINDS_FIXTURE, [street_row(9, 'elm', 900, 0.)]),
           ('a tree at nan', TREE_KINDS_FIXTURE, [street_row(9, 'elm', 900, 30., x_cm=float('nan'))]))
    for message, kinds, rows in bad:
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE} if kinds else None, tree_kinds=kinds)
            synthetic_streets(tmp, rows)
            expect_rejected(lambda: A.plan(tmp), message)
    # A plan without street trees leaves the old trees alone.
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        the_plan = A.plan(tmp)
        assert the_plan['vegetation'] is None and the_plan['hide'] == list(A.HIDE_LABELS)
    return out


def check_missing_tree_obj():
    """A fresh checkout has Trees/manifest.json but no Tree_*.obj (git-ignored): the plan stops with the OBJ's path
    under Trees/ and the command that builds it."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        for obj in (Path(tmp) / 'Data/Plateau/ReplicaGeometry' / A.TREES).glob('Tree_*.obj'):
            obj.unlink()
        try:
            A.plan(tmp)
        except AssertionError as error:
            message = str(error)
        else:
            raise AssertionError('A Trees manifest without its OBJs was accepted')
    assert 'Trees/Tree_' in message and 'plateau_trees.py' in message, message
    return message[message.index('Trees/Tree_'):]


def check_missing_plex_glass():
    """A fresh checkout has Plex/manifest.json (committed) but none of its OBJs (git-ignored): reading the Glass
    batches for the gallery windows stops with the missing OBJ's path and the command that builds it
    (plateau_plex.py), not a bare FileNotFoundError deep in the lane life. A root without a Plex manifest still
    reads as no glass."""
    R = replica
    with tempfile.TemporaryDirectory() as tmp:
        plex = Path(tmp) / 'Plex'
        plex.mkdir()
        assert not R.PlexGlass(plex / 'manifest.json').tris
        (plex / 'manifest.json').write_text(json.dumps({'layer': 'Plex', 'batches': [
            {'file': 'Brick_Red_XM001_YM001.obj', 'material': 'Brick_Red'},
            {'file': 'Glass_XM001_YM001.obj', 'material': 'Glass'}]}))
        try:
            R.PlexGlass(plex / 'manifest.json')
        except FileNotFoundError as error:
            message = str(error)
        else:
            raise AssertionError('A Plex manifest without its Glass OBJ was read as no glass')
        assert 'Glass_XM001_YM001.obj' in message and 'plateau_plex.py' in message, message
        (plex / 'Glass_XM001_YM001.obj').write_text('o Glass\nv 0 0 100\nv 100 0 100\nv 100 0 200\nf 1 2 3\n')
        glass = R.PlexGlass(plex / 'manifest.json')
        assert len(glass.tris) == 1 and glass.tris[0][2] == (100., 0., 200.), glass.tris
    return message[message.index('Glass_XM001_YM001.obj'):]


def check_host_steps(readme=None):
    """Both host blocks of the README build the git-ignored tree OBJs (plateau_trees.py), Plex OBJs (plateau_plex.py)
    and prop OBJs (the Blender props build) before plateau_replica.py, whose test and the apply step read them."""
    readme = (replica.OUT / 'README.md').read_text() if readme is None else readme
    blocks = re.findall(r'```bash\n(.*?)```', readme, re.S)
    hosts = [b for b in blocks if 'python3 Scripts/plateau_replica.py' in b]
    assert len(hosts) >= 2, f'{len(hosts)} host blocks run plateau_replica.py'
    for block in hosts:
        replica_at = block.find('Scripts/plateau_replica.py')
        for step, what in (('python3 Scripts/blender/plateau_trees.py --no-render', 'tree'),
                           ('python3 Scripts/plateau_plex.py', 'Plex'),
                           ('Scripts/blender/plateau_props.py --no-render', 'prop')):
            assert 0 <= block.find(step) < replica_at, (f'a host block runs plateau_replica.py before building the {what} OBJs', block)
    return len(hosts)


TREE_TEXTURED_KINDS = {
    'norway_maple': {'materials': {'bark': 'Bark_Grey', 'leaves': 'Tree_Leaves_Autumn'}, 'height_cm': 1500,
                     'trunk_cm': 45},
    'linden': {'materials': {'bark': 'Bark_Grey', 'leaves': 'Tree_Leaves_Autumn'}, 'height_cm': 1600, 'trunk_cm': 50},
}


def write_tree_texture_sets(root, sets=None, materials=None):
    """Small RGB(A) bark and leaf-atlas PNGs in the synthetic Trees folder, with their texture_sets entries in the
    textures.json format (Scripts/blender/plateau_trees.py writes the real ones), and materials naming them. Returns
    the manifest; sets and materials override its entries."""
    A, PT = apply_replica, plateau_textures
    folder = Path(root) / 'Data/Plateau/ReplicaGeometry' / A.TREES
    manifest = json.loads((folder / 'manifest.json').read_text())
    table = {}
    for name, stem, (w, h), surface, uv, tile, alpha, keys, mean in (
            ('tree_leaves', 'TreeLeaves', (8, 8), 'foliage', 'atlas', [1., 1.], True, ['Tree_Leaves_Autumn'],
             [.4618, .2679, .0268]),
            ('tree_bark', 'TreeBark', (8, 16), 'wall', 'metres', [1., 2.], False, ['Bark_Grey'], [.1807, .1525, .1211])):
        maps = {}
        for role in A.TEXTURE_ROLES:
            channels = 4 if role == 'diff' and alpha else 3
            rows = [bytes((255 if (x // 2 + y // 2) % 2 else 0) if c == 3 else (x * 29 + y * 13 + c * 61) % 256
                          for x in range(w) for c in range(channels)) for y in range(h)]
            raw = PT.raw_stream(rows)
            data = PT.png(w, h, raw, channels)
            file = f'T_Replica_{stem}_{role}.png'
            (folder / file).write_bytes(data)
            maps[role] = dict(PT.IMPORT[role], file=file, sha256=hashlib.sha256(data).hexdigest(),
                              raw_sha256=hashlib.sha256(raw).hexdigest(), **({'alpha': True} if channels == 4 else {}))
        table[name] = {'name': stem, 'size_px': [w, h], 'tile_m': tile, 'tiling': [1. / t for t in tile],
                       'mean_linear': mean, 'maps': maps, 'surface': surface, 'material': PT.SURFACES[surface],
                       'keys': keys, 'uv': uv, 'alpha': alpha}
    manifest[A.TREE_TEXTURE_SETS] = dict(table, **(sets or {}))
    manifest['materials'] = dict({
        'Bark_Grey': {'base_color_srgb': '#5A534B', 'roughness': .92, 'metallic': 0,
                      'texture': 'Trees/T_Replica_TreeBark_diff.png'},
        'Tree_Leaves_Autumn': {'base_color_srgb': '#B58D2E', 'roughness': .6, 'metallic': 0, 'foliage': True,
                               'texture': 'Trees/T_Replica_TreeLeaves_diff.png'}}, **(materials or {}))
    (folder / 'manifest.json').write_text(json.dumps(manifest))
    return manifest


def check_tree_texture_plan():
    """Trees/manifest.json with its own texture sets (the bark and the autumn leaf atlas): the bark is a textured
    duplicate of the wall parent at its metre tiling, the leaves a masked, two-sided foliage duplicate (clip .5) of the
    built foliage parent, whose maps import from the Trees folder with alpha-coverage mips and clamp U and V (atlas);
    a stale map, a set that reuses a replica set name, a set with an unknown surface, or a tree material naming a map
    that no set covers fails the plan."""
    A = apply_replica
    rows = [{'x': 100. * n, 'y': 0., 'z': 0., 'yaw': 10. * n, 'scale': 3., 'kind': k}
            for n, k in enumerate(['maple', 'linden', 'linden', 'norway_maple'])]
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': rows}, tree_kinds=TREE_TEXTURED_KINDS)
        manifest = write_tree_texture_sets(tmp)
        the_plan = A.plan(tmp)
        trees = {m['key']: m for m in the_plan['materials'] if m['layer'] == A.TREES}
        bark, leaves = trees['Bark_Grey'], trees['Tree_Leaves_Autumn']
        assert bark['texture_set'] == 'tree_bark' and bark['duplicate_of'] == A.TEXTURED_PARENT, bark['duplicate_of']
        assert (bark['blend_mode'], bark['two_sided'], bark['uv'], bark['tiling']) == ('opaque', False, 'metres', [1., .5])
        assert bark['tint'] == tuple(min(A.TINT_LIMIT, c / m) for c, m in zip(A.linear('#5A534B'), bark['mean_linear']))
        assert not bark['wet'] and not bark['foliage'] and bark['metallic'] == 0
        assert leaves['texture_set'] == 'tree_leaves' and leaves['duplicate_of'] == A.FOLIAGE_PARENT
        assert (leaves['blend_mode'], leaves['two_sided'], leaves['shading_model'], leaves['opacity_mask_clip'],
                leaves['uv']) == ('masked', True, 'two_sided_foliage', .5, 'atlas'), leaves
        assert not leaves['foliage'], 'the masked foliage parent lights the leaves; no second transmission graph'
        parents = {p['asset']: p for p in the_plan['parents']}
        assert sorted(parents) == [A.FOLIAGE_PARENT] and parents[A.FOLIAGE_PARENT]['texture_set'] == 'tree_leaves'
        tex = {(t['set'], t['role']): t for t in the_plan['textures']}
        assert sorted(tex) == sorted((s, r) for s in ('tree_bark', 'tree_leaves', 'lawn') for r in A.TEXTURE_ROLES)
        assert the_plan['counts']['tree_textures'] == 6
        for (name, role), t in tex.items():
            if name == 'lawn':
                assert t['file'].startswith(A.TEXTURES + '/') and (t['address_x'], t['address_y']) == ('TA_WRAP',) * 2
                continue
            stored = manifest[A.TREE_TEXTURE_SETS][name]['maps'][role]
            assert t['file'] == f'{A.TREES}/{stored["file"]}' and t['raw_sha256'] == stored['raw_sha256'], t['file']
            assert t['asset'] == f'{A.TEXTURE_ASSETS}/{Path(stored["file"]).stem}'
            atlas = name == 'tree_leaves'
            assert (t['address_x'], t['address_y']) == (('TA_CLAMP',) * 2 if atlas else ('TA_WRAP',) * 2), t['asset']
            assert t['alpha'] == (atlas and role == 'diff')
            assert t['alpha_coverage_threshold'] == (.5 if t['alpha'] else None), t['asset']
        assert the_plan['counts']['clamped_textures'] == 3
        assert the_plan['yard_trees']['texture_sets'] == ['tree_bark', 'tree_leaves']
        meshes = {m['species']: m for m in the_plan['tree_meshes']}
        assert meshes['linden']['materials'] == {'bark': bark['asset'], 'leaves': leaves['asset']}
        assert [t['count'] for t in the_plan['trees']] == [2, 2] and the_plan['counts']['tree_materials'] == 2
        out = {'bark': {'parent': bark['duplicate_of'].rsplit('/', 1)[1], 'tiling': bark['tiling']},
               'leaves': {'parent': leaves['duplicate_of'].rsplit('/', 1)[1], 'blend_mode': leaves['blend_mode'],
                          'address': [tex[('tree_leaves', 'diff')]['address_x'], tex[('tree_leaves', 'diff')]['address_y']]}}
    stale = lambda m: m[A.TREE_TEXTURE_SETS]['tree_bark']['maps']['rough'].update(raw_sha256='0' * 64)  # noqa: E731
    bad_cases = (
        ('a stale bark map', {'edit': stale}),
        ('a tree set named like a replica set', {'rename': 'creeper'}),
        ('a tree set with an unknown surface', {'edit': lambda m: m[A.TREE_TEXTURE_SETS]['tree_bark'].update(
            surface='glass')}),
        ('a tree material naming a map no set covers', {'edit': lambda m: m['materials']['Bark_Grey'].update(
            texture='Trees/T_Replica_TreeNeedles_diff.png')}),
        ('tree materials naming maps with no texture_sets', {'edit': lambda m: m.pop(A.TREE_TEXTURE_SETS)}))
    for message, case in bad_cases:
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_plex(tmp, ['Yard_Grass'], {'trees': rows}, tree_kinds=TREE_TEXTURED_KINDS)
            manifest = write_tree_texture_sets(tmp)
            if 'rename' in case:
                manifest[A.TREE_TEXTURE_SETS][case['rename']] = manifest[A.TREE_TEXTURE_SETS].pop('tree_bark')
            else:
                case['edit'](manifest)
            (Path(tmp) / 'Data/Plateau/ReplicaGeometry' / A.TREES / 'manifest.json').write_text(json.dumps(manifest))
            expect_rejected(lambda: A.plan(tmp), 'a Trees manifest with ' + message)
    return out


# The fall fixture: the textured leaf atlas with each cell's cover and mean colour (layout.cell_stats, as
# Scripts/blender/plateau_trees.py writes them), each kind's cards per cell (cell_usage), and the conifer and larch kinds.
FALL_CELLS = {'yl': {'cover': .4, 'mean_srgb': [194.1, 155.3, 38.8]}, 'gr': {'cover': .35, 'mean_srgb': [124.4, 129., 42.]},
              'or': {'cover': .3, 'mean_srgb': [182.8, 101., 29.9]}, 'cf': {'cover': .25, 'mean_srgb': [67.7, 86.6, 47.]},
              'lx': {'cover': .13, 'mean_srgb': [227.9, 181.5, 65.7]}}
TREE_FALL_KINDS = {
    'norway_maple': dict(TREE_TEXTURED_KINDS['norway_maple'], cell_usage={'yl': 50, 'gr': 10}),
    'linden': dict(TREE_TEXTURED_KINDS['linden'], cell_usage={'yl': 30, 'or': 20}),
    'conifer': {'materials': {'bark': 'Bark_Grey', 'leaves': 'Tree_Leaves_Autumn'}, 'height_cm': 1400, 'trunk_cm': 38,
                'cell_usage': {'cf': 40}},
    'larch': {'materials': {'bark': 'Bark_Grey', 'leaves': 'Tree_Leaves_Autumn'}, 'height_cm': 1440, 'trunk_cm': 34,
              'cell_usage': {'lx': 40}}}
FALL_ROWS = [street_row(1, 'norway_maple', 1500, 45.), street_row(2, 'norway_maple', 1400, 40., fall='red'),
             street_row(3, 'norway_maple', 425, 5., fall='red'), street_row(4, 'norway_maple', 430, 5.),
             street_row(5, 'linden', 1400, 42., fall='russet', species='Quercus rubra'), street_row(6, 'linden', 1300, 40.),
             street_row(7, 'conifer', 1200, 30., fall='evergreen', species='Picea pungens'),
             street_row(8, 'larch', 1300, 30., fall='gold', species='Larix laricina'),
             street_row(9, 'norway_maple', 1600, 50., fall='red', species='Acer rubrum')]
FALL_YARD = [{'x': 0., 'y': 900., 'z': 0., 'yaw': 0., 'scale': 3., 'kind': 'maple'},
             {'x': 400., 'y': 900., 'z': 0., 'yaw': 90., 'scale': 3., 'kind': 'linden'}]


def fall_root(tmp, rows, yard=()):
    """A synthetic root for the fall checks: TREE_FALL_KINDS on the textured atlas with FALL_CELLS, young Norway
    maples, the street rows and optional yard rows."""
    A = apply_replica
    synthetic_plex(tmp, ['Yard_Grass'], {'trees': list(yard)}, tree_kinds=TREE_FALL_KINDS)
    manifest = write_tree_texture_sets(tmp)
    manifest[A.TREE_TEXTURE_SETS]['tree_leaves']['layout'] = {'cell_stats': FALL_CELLS}
    (Path(tmp) / 'Data/Plateau/ReplicaGeometry' / A.TREES / 'manifest.json').write_text(json.dumps(manifest))
    synthetic_streets(tmp, rows, young=('norway_maple',))


def fall_cells_mean(usage):
    """The linear colour a kind's leaf cards average on the fixture atlas: each cell's mean, weighted by cards x cover."""
    lin = lambda v: v / 255. / 12.92 if v / 255. <= .04045 else ((v / 255. + .055) / 1.055) ** 2.4  # noqa: E731
    weight = {cell: n * FALL_CELLS[cell]['cover'] for cell, n in usage.items()}
    return [sum(w * lin(FALL_CELLS[cell]['mean_srgb'][i]) for cell, w in weight.items()) / sum(weight.values())
            for i in range(3)]


def check_street_tree_falls():
    """Each street tree's late-October colour (street_trees.json "fall") through the apply plan. The trees of a kind's
    own fall (broadleaf yellow, the conifer's evergreen needles, the larch's gold) wear the kind's leaves. The others
    stand on their own actor per kind, mesh and fall, on the same mesh, and their leaves material duplicates the kind's
    with a tint that moves the kind's atlas cells to the fall's colour (red maples, russet oaks). The conifer and larch
    kinds have their own meshes. Every street-tree actor carries the NordStreetTree tag that the dogs' sniff search
    reads; the yard trees carry none. A conifer that turns yellow, an evergreen maple, a larch tinted red, a row with no
    fall or an unknown one, and a red tree whose kind's leaves are an existing material all fail."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        fall_root(tmp, FALL_ROWS, FALL_YARD)
        the_plan = A.plan(tmp)
        yard = [t for t in the_plan['trees'] if t['group'] == 'yard']
        street = [t for t in the_plan['trees'] if t['group'] == 'street']
        groups = [(t['kind'], t['variant'], t['fall']) for t in street]
        assert groups == [('norway_maple', None, 'yellow'), ('norway_maple', None, 'red'),
                          ('norway_maple', A.YOUNG, 'yellow'), ('norway_maple', A.YOUNG, 'red'),
                          ('linden', None, 'yellow'), ('linden', None, 'russet'), ('conifer', None, 'evergreen'),
                          ('larch', None, 'gold')], groups
        assert [t['ids'] for t in street] == [['inv:5-1'], ['inv:5-2', 'inv:5-9'], ['inv:5-4'], ['inv:5-3'],
                                              ['inv:5-6'], ['inv:5-5'], ['inv:5-7'], ['inv:5-8']]
        labels = [t['label'][len(A.PREFIX):] for t in street]
        assert labels == ['Street trees norway_maple', 'Street trees norway_maple red', 'Street trees norway_maple young',
                          'Street trees norway_maple young red', 'Street trees linden', 'Street trees linden russet',
                          'Street trees conifer', 'Street trees larch'], labels
        assert A.STREET_TREE_TAG == 'NordStreetTree' and all(t['tag'] == A.STREET_TREE_TAG for t in street)
        assert all(t['tag'] is None and t['leaves'] is None for t in yard), 'the yard trees are no street trees'
        assert [t['fall'] for t in street if t['leaves'] is None] == ['yellow', 'yellow', 'yellow', 'evergreen', 'gold']
        red = [t['leaves'] for t in street if t['fall'] == 'red']
        assert red[0] == red[1] and red[0]['asset'] == f'{A.MATERIALS}/M_Replica_Trees_Tree_Leaves_Autumn_norway_maple_red'
        # No new mesh and no new triangle: each group stands on its kind's mesh (mature or young).
        assert sorted(((m['species'], m['variant'] or '') for m in the_plan['tree_meshes'])) == \
            sorted({(t['kind'], t['variant'] or '') for t in the_plan['trees']})
        assert all(t['mesh'] == A.tree_mesh_asset(t['kind'], t['variant']) for t in street)
        mats = {m['key']: m for m in the_plan['materials'] if m['layer'] == A.TREES}
        leaves = mats['Tree_Leaves_Autumn']
        tinted = {k: m for k, m in mats.items() if m.get('fall')}
        assert sorted(tinted) == ['Tree_Leaves_Autumn_linden_russet', 'Tree_Leaves_Autumn_norway_maple_red'], sorted(tinted)
        for key, m in tinted.items():
            same = ('duplicate_of', 'texture_set', 'blend_mode', 'two_sided', 'shading_model', 'opacity_mask_clip',
                    'textures', 'tiling', 'uv', 'foliage')
            assert all(m[k] == leaves[k] for k in same), (key, [k for k in same if m[k] != leaves[k]])
            # The kind's cards, under the group's tint, average the fall's colour (the hex rounding allows 5 %).
            got = [c * t for c, t in zip(fall_cells_mean(TREE_FALL_KINDS[m['tree_kind']]['cell_usage']), m['tint'])]
            want = A.linear(A.FALL_SRGB[m['fall']])
            assert all(abs(g - w) <= max(.003, .05 * w) for g, w in zip(got, want)), (key, got, want)
            assert key == f'Tree_Leaves_Autumn_{m["tree_kind"]}_{m["fall"]}'
        assert tinted['Tree_Leaves_Autumn_norway_maple_red']['tint'][1] < .3, 'a red maple keeps its yellow green'
        counts = the_plan['counts']
        assert counts['fall_materials'] == 2 and counts['tinted_street_tree_actors'] == 3
        assert counts['tagged_actors'] == counts['street_tree_actors'] == len(street) == 8
        assert the_plan['street_trees']['falls'] == {'conifer evergreen': 1, 'larch gold': 1, 'linden russet': 1,
                                                     'linden yellow': 1, 'norway_maple red': 3,
                                                     'norway_maple yellow': 2}, the_plan['street_trees']['falls']
        out = {'groups': labels, 'tints': {k: [round(t, 3) for t in m['tint']] for k, m in sorted(tinted.items())}}
    bad = (('a conifer that turns yellow', street_row(1, 'conifer', 1200, 30., fall='yellow')),
           ('an evergreen maple', street_row(1, 'norway_maple', 1200, 30., fall='evergreen')),
           ('a larch tinted red', street_row(1, 'larch', 1200, 30., fall='red')),
           ('a row without a fall', {k: v for k, v in street_row(1, 'linden', 1200, 30.).items() if k != 'fall'}),
           ('an unknown fall', street_row(1, 'linden', 1200, 30., fall='purple')))
    for message, row in bad:
        with tempfile.TemporaryDirectory() as tmp:
            fall_root(tmp, [row])
            expect_rejected(lambda: A.plan(tmp), message)
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': []}, tree_kinds=TREE_KINDS_FIXTURE)
        synthetic_streets(tmp, [street_row(1, 'silver_maple', 1800, 60., fall='red')])
        expect_rejected(lambda: A.plan(tmp), 'a red tree whose leaves are an existing material')
    return out


SHADOW_PROPS = ('hydrant', 'sign_stop', 'sign_street', 'sign_oneway', 'sign_parking', 'bike_locked',
                'bin_recycling', 'bin_compost', 'bin_garbage')   # the street props the local review saw without one


def check_prop_shadows(the_plan):
    """The props a player sees at the curb cast shadows in game: lamps, poles, docks and benches, and also hydrants,
    sign posts, locked bikes and bins, which the local review found standing in the low sun with none. Every instance
    row carries its shadow flag from the apply step's PROP_SHADOW, and apply() sets it from that flag."""
    A = apply_replica
    assert set(SHADOW_PROPS) <= set(A.PROP_SHADOW), sorted(set(SHADOW_PROPS) - set(A.PROP_SHADOW))
    assert {'lamp_cobra', 'lamp_park', 'utility_pole', 'bixi_dock', 'bench'} <= set(A.PROP_SHADOW)
    rows = [i for i in the_plan['instances'] if i['mesh']]
    assert rows and all(i['shadow'] == (i['prop'] in A.PROP_SHADOW) for i in rows), \
        [i['label'] for i in rows if i.get('shadow') != (i['prop'] in A.PROP_SHADOW)][:5]
    seen = {i['prop'] for i in rows if i['shadow']}
    assert {'hydrant', 'sign_stop', 'sign_street', 'bike_locked', 'bin_recycling'} <= seen, sorted(seen)
    source = (replica.ROOT / 'Scripts/apply_plateau_replica.py').read_text()
    assert "comp.set_cast_shadow(row['shadow'])" in source, 'apply() does not set the planned prop shadows'
    return {'casting_props': sorted(seen), 'casting_components': sum(1 for i in rows if i['shadow'])}


def check_kind_falls():
    """A kind with its own fall (KIND_FALL: the conifer's evergreen, the larch's gold) gets exactly that fall from every
    species and genus row that puts a tree on it. The apply step refuses a larch tinted another colour, so a dawn
    redwood or a bald cypress (larch genera) that TREE_FALL turned russet would stop the dry run and the import."""
    R = replica
    bad = []
    names = [prefix for prefix, _ in R.TREE_SPECIES + R.TREE_FALL] + [g.lower() for g in R.TREE_GENERA]
    for name in sorted(set(names)):
        species = name[0].upper() + name[1:]
        kind = R.tree_kind(species, 30.)
        if kind in R.KIND_FALL and R.tree_fall(species, kind) != R.KIND_FALL[kind]:
            bad.append((species, kind, R.tree_fall(species, kind)))
    assert not bad, ('a kind of its own fall tinted another colour', bad)
    for species in ('Metasequoia glyptostroboides', 'Taxodium distichum', 'Larix decidua'):
        kind = R.tree_kind(species, 30.)
        assert kind == 'larch' and R.tree_fall(species, kind) == 'gold', (species, kind, R.tree_fall(species, kind))
    return {'checked': len(set(names))}


TRAFFIC_FIXTURE = {'roads': [[[-5000., 0.], [5000., 0.]], [[-5000., 3000.], [5000., 3000.]]], 'road_widths': [620., 380.]}


def check_street_tree_traffic():
    """No planned trunk stands within 300 cm of a traffic centreline (Data/LaFontaine/layout.json: the roads the game's
    cars drive, in the street_trees.json frame) unless it is in a sidewalk or curb-extension pit, or at a ruelle's edge
    where every centreline that near is a 380 cm service lane; and none stands within 200 cm of any, where a car's side
    passes. Trees have no collision, so a trunk in the band is one that cars and the player drive through."""
    A = apply_replica

    def root(tmp, rows, layout=TRAFFIC_FIXTURE):
        fall_root(tmp, rows)
        path = Path(tmp) / A.TRAFFIC_LAYOUT
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(layout))

    good = [street_row(1, 'linden', 1300, 40., x_cm=0., y_cm=320., pit=False),        # outside the band
            street_row(2, 'linden', 1300, 40., x_cm=500., y_cm=-260., pit=True),       # in a pit, 260 cm out
            street_row(3, 'linden', 1300, 40., x_cm=1000., y_cm=2770., pit=False),     # at a ruelle's edge, 230 cm out
            street_row(4, 'linden', 1300, 40., x_cm=9000., y_cm=150., pit=False)]      # 40 m past the street's end
    with tempfile.TemporaryDirectory() as tmp:
        root(tmp, good)
        band = A.plan(tmp)['street_trees']['traffic']
        assert band == {'layout': A.TRAFFIC_LAYOUT, 'checked': 4, 'in_pits': 1, 'at_ruelle_edges': 1,
                        'nearest_cm': 230.0}, band
        # plan_trees refuses a trunk in the band by itself, given the traffic.
        rows, kinds = A.load_street_trees(tmp), A.load_tree_kinds(tmp)
        rows[0] = dict(rows[0], position=(0., 100., 18.))
        expect_rejected(lambda: A.plan_trees(rows, kinds, A.load_traffic(tmp)), 'a trunk 100 cm from a street')
    bad = (('a trunk 150 cm from a street centreline', dict(x_cm=0., y_cm=150., pit=False)),
           ('a trunk 250 cm from a street centreline outside a pit', dict(x_cm=0., y_cm=-250., pit=False)),
           ('a pit trunk 150 cm from a street centreline', dict(x_cm=0., y_cm=150., pit=True)),
           ('a trunk 150 cm from a ruelle centreline', dict(x_cm=0., y_cm=2850., pit=False)))
    for message, where in bad:
        with tempfile.TemporaryDirectory() as tmp:
            root(tmp, good + [street_row(9, 'linden', 1300, 40., **where)])
            try:
                A.plan(tmp)
            except AssertionError as error:
                assert 'inv:5-9' in str(error), (message, str(error))
                continue
            raise AssertionError('Accepted ' + message)
    with tempfile.TemporaryDirectory() as tmp:
        root(tmp, good, dict(TRAFFIC_FIXTURE, road_widths=[620.]))
        expect_rejected(lambda: A.plan(tmp), 'road widths that do not match the roads')
    return {'checked': band['checked'], 'in_pits': band['in_pits'], 'at_ruelle_edges': band['at_ruelle_edges'],
            'rejected': [m for m, _ in bad]}


def check_yard_trees(the_plan):
    """Plex/yard_trees.json as plateau_plex.py wrote it: kinds, counts and positions inside the Plex layer; species
    meshes when Trees/manifest.json exists."""
    A = apply_replica
    rows = A.load_yard_trees(replica.ROOT)
    assert the_plan['yard_trees']['present'] == (rows is not None)
    assert (replica.ROOT / 'Content/Art/Tree/tree_small_02/StaticMeshes/tree_small_02.uasset').is_file(), A.TREE_MESH
    if rows is None:
        return {'present': False, 'note': 'Plex/yard_trees.json not written yet; the apply step skips yard trees'}
    plex = json.loads((replica.OUT / 'Plex/manifest.json').read_text())
    lo = [min(b['bounds_cm'][i] for b in plex['batches']) for i in range(2)]
    hi = [max(b['bounds_cm'][3 + i] for b in plex['batches']) for i in range(2)]
    for r in rows:
        assert all(lo[i] - 500 <= r['position'][i] <= hi[i] + 500 for i in range(2)), r
        assert -50. <= r['position'][2] <= 300. and .3 <= r['scale'] <= 4., r
        assert r['species'] in A.TREE_SPECIES, r
    yard = [t for t in the_plan['trees'] if t['group'] == 'yard']
    assert sum(t['count'] for t in yard) == len(rows) == the_plan['counts']['yard_tree_instances']
    kinds = A.load_tree_kinds(replica.ROOT)
    assert (the_plan['yard_trees']['mode'] == 'species meshes') == (kinds is not None)
    if kinds:
        assert {t['kind'] for t in yard} <= set(kinds) and all(t['mesh'] == A.tree_mesh_asset(t['kind']) for t in yard)
        # The generated trees' own texture sets: every tree material that names a map is textured, the leaves are
        # masked two-sided foliage on the leaf atlas (clamped U and V), the bark a textured wall duplicate.
        tree_mats = [m for m in the_plan['materials'] if m['layer'] == A.TREES]
        for m in tree_mats:
            assert not m['spec'].get('texture') or m.get('texture_set'), m['asset'] + ' renders flat'
            if m.get('texture_set') and m['spec'].get('foliage'):
                assert m['duplicate_of'] == A.FOLIAGE_PARENT and m['blend_mode'] == 'masked' and m['two_sided'], m['asset']
                assert m['shading_model'] == 'two_sided_foliage' and m['uv'] == 'atlas', m['asset']
            elif m.get('texture_set'):
                assert m['duplicate_of'] == A.TEXTURED_PARENT and m['blend_mode'] == 'opaque', m['asset']
        atlas = [t for t in the_plan['textures'] if t['file'].startswith(A.TREES + '/') and t['address_x'] == 'TA_CLAMP']
        assert all(t['address_y'] == 'TA_CLAMP' for t in atlas)
        assert the_plan['counts']['tree_textures'] == 3 * len(the_plan['yard_trees']['texture_sets'])
    return {'present': True, 'mode': the_plan['yard_trees']['mode'],
            'trees': {t['kind']: t['count'] for t in yard},
            'tree_texture_sets': the_plan['yard_trees'].get('texture_sets', [])}


def check_street_tree_plan(the_plan):
    """Every row of Streets/street_trees.json, once, on the species mesh for its kind (or the kind's young mesh under
    YOUNG_BELOW of the mature height), at its own position and yaw, its height scale within the mesh's limits and its
    crown within CROWN_SPREAD of it, no collision; the old summer trees planned away (the vegetation cleared, the seven
    route trees hidden)."""
    A = apply_replica
    rows = A.load_street_trees(replica.ROOT)
    if rows is None:
        assert the_plan['vegetation'] is None and not the_plan['street_trees']['present']
        return {'present': False}
    kinds = A.load_tree_kinds(replica.ROOT)
    groups = [t for t in the_plan['trees'] if t['group'] == 'street']
    by_id = {r['id']: r for r in rows}
    placed = [i for g in groups for i in g['ids']]
    assert sorted(placed) == sorted(by_id) and len(placed) == len(rows) == the_plan['counts']['street_tree_instances']
    meshes = {m['asset']: m for m in the_plan['tree_meshes']}
    young = 0
    for g in groups:
        assert g['label'] == f"{A.PREFIX}Street trees {g['kind']}" + (f" {g['variant']}" if g['variant'] else '') + \
            (f" {g['fall']}" if g['leaves'] else '')
        assert g['folder'] == f'{A.FOLDER}/{A.STREET_TREE_FOLDER}' and not g['collision'] and g['cast_shadow']
        assert g['mesh'] == A.tree_mesh_asset(g['kind'], g['variant']) and g['mesh'] in meshes, g['label']
        mesh = kinds[g['kind']][g['variant']] if g['variant'] else kinds[g['kind']]
        assert meshes[g['mesh']]['file'] == mesh['obj'] and g['mesh_height_cm'] == mesh['height_cm']
        limits = A.YOUNG_SCALE if g['variant'] else A.TREE_SCALE
        for tid, (p, yaw, (sx, sy, sz)) in zip(g['ids'], g['transforms']):
            r = by_id[tid]
            assert r['kind'] == g['kind'] and p == r['position'] and yaw == r['yaw'], tid
            assert limits[0] - 1e-4 <= sz <= limits[1] + 1e-4 and sx == sy, (tid, sz)
            assert A.CROWN_SPREAD[0] - 1e-3 <= sx / sz <= A.CROWN_SPREAD[1] + 1e-3, (tid, sx, sz)
            assert (r['height_cm'] < A.YOUNG_BELOW * kinds[r['kind']]['height_cm']) == bool(g['variant']) or \
                A.YOUNG not in kinds[r['kind']], tid
        young += g['count'] if g['variant'] else 0
        # Its late-October colour: the kind's own leaves for the kind's own fall, else the group's tinted leaves.
        assert g['tag'] == A.STREET_TREE_TAG and all(by_id[t]['fall'] == g['fall'] for t in g['ids']), g['label']
        own = g['fall'] == A.KIND_FALL.get(g['kind'], 'yellow')
        assert (g['leaves'] is None) == own and g['label'].endswith(g['fall']) != own, g['label']
    assert young == the_plan['counts']['young_street_trees'] > 0
    assert set(the_plan['street_trees']['kinds']) == {r['kind'] for r in rows}
    # The species table and the apply step agree on the falls; the conifers and larches stand on their own kinds; the
    # red and russet trees add a few actors and no mesh (no triangle).
    assert A.TREE_FALLS == replica.TREE_FALLS and A.KIND_FALL == replica.KIND_FALL
    assert {'conifer', 'larch'} <= {g['kind'] for g in groups}
    tinted = [g for g in groups if g['leaves']]
    assert {g['fall'] for g in tinted} == {'red', 'russet'} and len(tinted) <= 13, [g['label'] for g in tinted]
    assert len({(m['species'], m['variant']) for m in the_plan['tree_meshes']}) == len(the_plan['tree_meshes'])
    assert {(g['kind'], g['variant']) for g in the_plan['trees']} == {(m['species'], m['variant'])
                                                                       for m in the_plan['tree_meshes']}
    falls = {}
    for r in rows:
        falls[f"{r['kind']} {r['fall']}"] = falls.get(f"{r['kind']} {r['fall']}", 0) + 1
    doc = json.loads((replica.OUT / A.STREET_TREES).read_text())
    assert the_plan['street_trees']['falls'] == falls == doc['falls'], (the_plan['street_trees']['falls'], doc['falls'])
    mats = {m['asset']: m for m in the_plan['materials']}
    for g in tinted:
        m = mats[g['leaves']['asset']]
        assert m['fall'] == g['fall'] and m['tree_kind'] == g['kind'] and m['blend_mode'] == 'masked', g['label']
        assert m['tint'][1] < m['tint'][0] and m['texture_set'] == 'tree_leaves', (g['label'], m['tint'])
    # No trunk in the traffic band but in a pit or at a ruelle's edge, and none where a car's side passes.
    band = the_plan['street_trees']['traffic']
    assert band['layout'] == A.TRAFFIC_LAYOUT and band['checked'] == len(rows), band
    assert band['nearest_cm'] >= A.TRUNK_CAR_CLEAR_CM, band
    # The old summer tree goes: QuebecVegetation's instances cleared, the seven route trees hidden in game.
    assert the_plan['vegetation'] == {'label': A.VEGETATION_LABEL, 'class': A.VEGETATION_CLASS, 'mesh': A.TREE_MESH,
                                      'action': 'clear instances'}
    old = [h for h in the_plan['hide'] if h.startswith(A.DETAIL_TREE_LABEL)]
    assert old == A.old_tree_labels(replica.ROOT) and len(old) == 7, old
    return {'trees': len(rows), 'young': young,
            'actors': {g['label'][len(A.PREFIX):]: g['count'] for g in groups}, 'hidden_old_trees': len(old),
            'tinted_actors': len(tinted), 'traffic_band': band}


# ------------------------------------------------------------------------------------------------
# The editor-side material, mesh, actor and tree code against a small fake of the unreal module

class FakeObj:
    defaults = {}

    def __init__(self, **props):
        self.props = dict(self.defaults)
        self.props.update(props)

    def set_editor_property(self, name, value):
        self.props[name] = value

    def get_editor_property(self, name):
        return self.props[name]


class FakeExpr(FakeObj):
    defaults = {'desc': ''}

    def __init__(self, **props):
        super().__init__(**props)
        self.links, self.mat = {}, None


class FakeCoords(FakeExpr):
    defaults = {'desc': '', 'u_tiling': 1., 'v_tiling': 1.}


class FakeSample(FakeExpr):
    defaults = {'desc': '', 'texture': None, 'sampler_type': 'SAMPLERTYPE_COLOR'}


class FakeVector3(FakeExpr):
    defaults = {'desc': '', 'constant': (1., 1., 1., 1.)}


class FakeConstant(FakeExpr):
    defaults = {'desc': '', 'r': 0.}


class FakeMultiply(FakeExpr):
    defaults = {'desc': '', 'const_a': 0., 'const_b': 1.}


class FakeLerp(FakeExpr):
    defaults = {'desc': '', 'const_a': 0., 'const_b': 1., 'const_alpha': .5}


class FakeScalar(FakeExpr):
    defaults = {'desc': '', 'parameter_name': '', 'default_value': 0.}


class FakeCollection(FakeExpr):
    defaults = {'desc': '', 'parameter_name': ''}


class FakeVector4:
    def __init__(self, x, y, z, w):
        self.x, self.y, self.z, self.w = x, y, z, w


class FakeAsset(FakeObj):
    def __init__(self, path, **props):
        super().__init__(**props)
        self.path = path

    def get_name(self):
        return self.path.rsplit('/', 1)[1]

    def get_path_name(self):
        return f'{self.path}.{self.get_name()}'


class FakeMaterial(FakeAsset):
    defaults = {'blend_mode': 'BLEND_OPAQUE', 'two_sided': False, 'opacity_mask_clip_value': 1. / 3.,
                'shading_model': 'MSM_DEFAULT_LIT'}

    def __init__(self, path):
        super().__init__(path)
        self.nodes, self.inputs, self.usages = [], {}, set()


class FakeTexture(FakeAsset):
    defaults = {'srgb': True, 'compression_settings': 'TC_DEFAULT', 'lod_group': None, 'compression_no_alpha': False,
                'do_scale_mips_for_alpha_coverage': False, 'alpha_coverage_thresholds': FakeVector4(0., 0., 0., 0.),
                'address_x': 'TA_WRAP', 'address_y': 'TA_WRAP'}

    def __init__(self, path, size=(512, 512)):
        super().__init__(path)
        self.size = size

    def blueprint_get_size_x(self):
        return self.size[0]

    def blueprint_get_size_y(self):
        return self.size[1]


class FakeNanite(FakeObj):
    defaults = {'enabled': False, 'shape_preservation': 'NONE', 'fallback_target': None,
                'fallback_percent_triangles': 0., 'fallback_relative_error': 1.}

    @property
    def enabled(self):
        return self.props['enabled']


class FakeMesh(FakeAsset):
    """A static mesh imported from an OBJ: one material slot per usemtl (or one), its triangle count, Nanite and
    body setup."""

    def __init__(self, path, slots=('',), triangles=1):
        super().__init__(path)
        self.triangles = triangles
        self.materials = [None] * len(slots)
        self.props.update(nanite_settings=FakeNanite(), body_setup=FakeObj(collision_trace_flag='CTF_USE_DEFAULT'),
                          static_materials=[FakeObj(material_slot_name=n, material_interface=None) for n in slots])

    def set_material(self, index, material):
        self.materials[index] = material
        self.props['static_materials'][index].props['material_interface'] = material

    def get_material(self, index):
        return self.materials[index]

    def get_num_triangles(self, lod):
        return self.triangles


class FakeMeshSubsystem:
    def get_lod_build_settings(self, mesh, lod):
        return FakeObj()

    def set_lod_build_settings(self, mesh, lod, settings):
        pass

    def set_nanite_settings(self, mesh, settings, apply_changes):
        mesh.props['nanite_settings'] = settings


class FakeImportUI:
    def __init__(self):
        from types import SimpleNamespace
        self.static_mesh_import_data = SimpleNamespace()


class FakeLibrary:
    PINS = ('A', 'B', 'Alpha')

    @staticmethod
    def create_material_expression(mat, cls):
        node = cls()
        node.mat = mat
        mat.nodes.append(node)
        return node

    @staticmethod
    def connect_material_expressions(a, output, b, name):
        assert a.mat is b.mat
        b.links[name] = (a, output)
        return True

    @staticmethod
    def connect_material_property(node, output, prop):
        node.mat.inputs[prop] = (node, output)
        return True

    @staticmethod
    def get_material_property_input_node(mat, prop):
        return mat.inputs.get(prop, (None, ''))[0]

    @staticmethod
    def get_material_expressions(mat):
        return list(mat.nodes)

    @staticmethod
    def get_inputs_for_material_expression(mat, node):
        """The expressions on the node's inputs in pin order (A, B[, Alpha]), None where nothing is linked."""
        pins = FakeLibrary.PINS if isinstance(node, FakeLerp) else FakeLibrary.PINS[:2]
        return [node.links[p][0] if p in node.links else None for p in pins]

    @staticmethod
    def set_base_material_usage(mat, usage, flag):
        mat.usages.add(usage)

    @staticmethod
    def has_material_usage(mat, usage):
        return usage in mat.usages

    @staticmethod
    def recompile_material(mat):
        pass


class FakeAssets:
    def __init__(self):
        self.registry = {}

    def load_asset(self, path):
        return self.registry.get(path.split('.')[0])

    def does_asset_exist(self, path):
        return path.split('.')[0] in self.registry

    def duplicate_asset(self, source, target):
        import copy
        if source not in self.registry:
            return None
        new = copy.deepcopy(self.registry[source])
        new.path = target
        self.registry[target] = new
        return new

    def delete_asset(self, path):
        self.registry.pop(path, None)
        return True

    def save_loaded_asset(self, asset, only_if_is_dirty=True):
        return True


class FakeImportTask:
    def __init__(self):
        self.filename = self.destination_path = self.destination_name = None
        self.imported_object_paths = []


class FakeTools:
    def __init__(self, assets):
        self.assets = assets

    def create_asset(self, name, folder, cls, factory):
        asset = cls(f'{folder}/{name}')
        self.assets.registry[asset.path] = asset
        return asset

    def import_asset_tasks(self, tasks):
        for task in tasks:
            path = f'{task.destination_path}/{task.destination_name}'
            if task.filename.endswith('.obj'):
                lines = Path(task.filename).read_text().splitlines()
                slots = list(dict.fromkeys(line.split()[1] for line in lines if line.startswith('usemtl '))) or ['']
                faces = sum(len(line.split()) - 3 for line in lines if line.startswith('f '))
                asset = FakeMesh(path, slots, faces)
            else:
                width, height, _, _ = plateau_textures.read_png_channels(Path(task.filename).read_bytes())
                asset = FakeTexture(path, (width, height))
            self.assets.registry[asset.path] = asset
            task.imported_object_paths = [asset.get_path_name()]


class FakeTransform:
    def __init__(self, location, rotation, scale):
        self.translation, self.rotation, self.scale3d = location, rotation, scale


class FakeHism(FakeObj):
    defaults = {'instance_start_cull_distance': 0, 'instance_end_cull_distance': 0}

    def __init__(self):
        super().__init__()
        self.static_mesh, self.profile, self.transforms, self.shadow = None, 'NoCollision', [], False
        self.overrides = {}

    def set_static_mesh(self, mesh):
        self.static_mesh = mesh
        return True

    def set_material(self, index, material):
        """A slot override on the component, for every instance (UPrimitiveComponent::SetMaterial)."""
        self.overrides[index] = material

    def get_material(self, index):
        """The slot's override, else the mesh's own material (UMeshComponent::GetMaterial)."""
        return self.overrides.get(index) or self.static_mesh.get_material(index)

    def set_collision_profile_name(self, name):
        self.profile = name

    def get_collision_profile_name(self):
        return self.profile

    def set_cull_distances(self, start, end):
        self.props.update(instance_start_cull_distance=start, instance_end_cull_distance=end)

    def set_cast_shadow(self, value):
        self.shadow = value

    def add_instances(self, transforms, return_indices, world_space, update_navigation):
        self.transforms += transforms

    def get_instance_count(self):
        return len(self.transforms)

    def get_instance_transform(self, index, world_space):
        return self.transforms[index]


class FakeMeshComponent(FakeObj):
    """A StaticMeshComponent: its mesh and material, collision profile and per-channel responses (a profile
    resets them; one changed response turns the profile Custom, as in Unreal), shadow and lighting flags."""
    defaults = {'cast_shadow': True, 'affect_distance_field_lighting': True, 'affect_dynamic_indirect_lighting': True}
    CHANNELS = ('ECC_PAWN', 'ECC_CAMERA', 'ECC_VISIBILITY', 'ECC_WORLD_STATIC')

    def __init__(self):
        super().__init__()
        self.static_mesh, self.material, self.profile = None, None, 'BlockAll'
        self.responses = dict.fromkeys(self.CHANNELS, 'ECR_BLOCK')

    def set_static_mesh(self, mesh):
        self.static_mesh = mesh
        return True

    def set_material(self, index, material):
        self.material = material

    def get_material(self, index):
        return self.material

    def set_collision_profile_name(self, name):
        self.profile = name
        self.responses = dict.fromkeys(self.CHANNELS, 'ECR_IGNORE' if name == 'NoCollision' else 'ECR_BLOCK')

    def get_collision_profile_name(self):
        return self.profile

    def set_collision_response_to_channel(self, channel, response):
        self.responses[channel] = response
        self.profile = 'Custom'

    def get_collision_response_to_channel(self, channel):
        return self.responses[channel]

    def set_cast_shadow(self, value):
        self.props['cast_shadow'] = value


class FakeMeshActor(FakeObj):
    defaults = {'hidden': False}

    def __init__(self):
        super().__init__()
        self.label, self.folder, self.static_mesh_component = None, None, FakeMeshComponent()

    def set_actor_label(self, label):
        self.label = label

    def set_folder_path(self, folder):
        self.folder = folder

    def set_actor_hidden_in_game(self, hidden):
        self.props['hidden'] = hidden

    def get_actor_location(self):
        from types import SimpleNamespace
        return SimpleNamespace(length=lambda: 0.)

    def get_path_name(self):
        return '/Game/Maps/LaFontaine.LaFontaine:PersistentLevel.' + (self.label or '').replace(' ', '_')


class FakeActor:
    def __init__(self):
        self.label, self.folder, self.component = None, None, FakeHism()
        self.props = {'tags': []}

    def set_editor_property(self, name, value):
        assert name == 'tags', name
        self.props[name] = [str(v) for v in value]

    def get_editor_property(self, name):
        return list(self.props[name])

    def set_actor_label(self, label):
        self.label = label

    def set_folder_path(self, folder):
        self.folder = folder

    def get_component_by_class(self, cls):
        return self.component

    def get_path_name(self):
        return '/Game/Maps/LaFontaine.LaFontaine:PersistentLevel.' + (self.label or '').replace(' ', '_')


class FakeEditor:
    def __init__(self):
        self.actors = []

    def spawn_actor_from_class(self, cls, location, rotation):
        assert cls in (apply_replica.INSTANCES_CLASS, FakeMeshActor), cls
        actor = FakeActor() if cls == apply_replica.INSTANCES_CLASS else FakeMeshActor()
        self.actors.append(actor)
        return actor


def fake_unreal():
    """The slice of the unreal module that the apply step's texture, material, mesh, actor and tree code calls."""
    from types import SimpleNamespace as NS
    names = lambda *n: NS(**{k: k for k in n})  # noqa: E731
    assets = FakeAssets()
    tools = FakeTools(assets)
    subsystem = FakeMeshSubsystem()
    vector = lambda x=0., y=0., z=0.: NS(x=x, y=y, z=z)  # noqa: E731
    return NS(
        EditorAssetLibrary=assets, MaterialEditingLibrary=FakeLibrary,
        AssetToolsHelpers=NS(get_asset_tools=lambda: tools), AssetImportTask=FakeImportTask, FbxImportUI=FakeImportUI,
        StaticMeshEditorSubsystem='StaticMeshEditorSubsystem', get_editor_subsystem=lambda cls: subsystem,
        Material=FakeMaterial, Texture2D=FakeTexture, StaticMesh=FakeMesh, StaticMeshActor=FakeMeshActor,
        MaterialFactoryNew=lambda: None,
        MaterialExpressionTextureCoordinate=FakeCoords, MaterialExpressionTextureSample=FakeSample,
        MaterialExpressionConstant3Vector=FakeVector3, MaterialExpressionConstant=FakeConstant,
        MaterialExpressionMultiply=FakeMultiply, MaterialExpressionLinearInterpolate=FakeLerp,
        MaterialExpressionScalarParameter=FakeScalar,
        MaterialExpressionCollectionParameter=FakeCollection, HierarchicalInstancedStaticMeshComponent=FakeHism,
        LinearColor=lambda r, g, b, a: (r, g, b, a), Vector4=FakeVector4, Vector=vector, Name=str,
        Rotator=lambda roll=0., pitch=0., yaw=0.: NS(roll=roll, pitch=pitch, yaw=yaw), Transform=FakeTransform,
        load_class=lambda outer, path: path,
        BlendMode=names('BLEND_OPAQUE', 'BLEND_MASKED'),
        MaterialShadingModel=names('MSM_DEFAULT_LIT', 'MSM_TWO_SIDED_FOLIAGE'),
        MaterialProperty=names('MP_BASE_COLOR', 'MP_NORMAL', 'MP_ROUGHNESS', 'MP_METALLIC', 'MP_OPACITY_MASK',
                               'MP_SUBSURFACE_COLOR', 'MP_EMISSIVE_COLOR'),
        MaterialSamplerType=names('SAMPLERTYPE_COLOR', 'SAMPLERTYPE_NORMAL', 'SAMPLERTYPE_LINEAR_COLOR',
                                  'SAMPLERTYPE_MASKS'),
        TextureCompressionSettings=names('TC_DEFAULT', 'TC_NORMALMAP', 'TC_MASKS'),
        TextureGroup=names('TEXTUREGROUP_WORLD', 'TEXTUREGROUP_WORLD_NORMAL_MAP'),
        TextureAddress=names('TA_WRAP', 'TA_CLAMP', 'TA_MIRROR'),
        NaniteShapePreservation=names('NONE', 'PRESERVE_AREA', 'VOXELIZE'),
        NaniteFallbackTarget=names('AUTO', 'PERCENT_TRIANGLES', 'RELATIVE_ERROR'),
        CollisionTraceFlag=names('CTF_USE_DEFAULT', 'CTF_USE_COMPLEX_AS_SIMPLE'),
        CollisionChannel=names(*FakeMeshComponent.CHANNELS),
        CollisionResponseType=names('ECR_IGNORE', 'ECR_OVERLAP', 'ECR_BLOCK'),
        MaterialUsage=names('MATUSAGE_NANITE', 'MATUSAGE_INSTANCED_STATIC_MESHES'))


def fake_parent(u, path, texture, wet=False):
    """A Content parent as upgrade_plateau.material() authors it (tint, one coordinate node, three samples, metallic
    constant), with the NordSky wet-ground wrapper nodes plateau_atmosphere adds to M_Gravel."""
    mat = FakeMaterial(path)
    u.EditorAssetLibrary.registry[path] = mat
    L, P = u.MaterialEditingLibrary, u.MaterialProperty
    tint = L.create_material_expression(mat, FakeVector3)
    tint.set_editor_property('constant', (1.05, .8, .66, 1.))
    coords = L.create_material_expression(mat, FakeCoords)
    coords.props.update(u_tiling=1.5, v_tiling=1.5)
    samples = {}
    for role in apply_replica.TEXTURE_ROLES:
        node = L.create_material_expression(mat, FakeSample)
        node.set_editor_property('texture', FakeTexture(f'/Game/Art/Textures/{texture}_{role}'))
        L.connect_material_expressions(coords, '', node, '')
        samples[role] = node
    product = L.create_material_expression(mat, FakeMultiply)
    L.connect_material_expressions(samples['diff'], 'RGB', product, 'A')
    L.connect_material_expressions(tint, '', product, 'B')
    L.connect_material_property(product, '', P.MP_BASE_COLOR)
    L.connect_material_property(samples['nor_dx'], 'RGB', P.MP_NORMAL)
    L.connect_material_property(samples['rough'], 'R', P.MP_ROUGHNESS)
    L.connect_material_property(L.create_material_expression(mat, FakeConstant), '', P.MP_METALLIC)
    if wet:
        for name in ('Wetness', 'Wetness', 'Puddles'):
            L.create_material_expression(mat, FakeCollection).props.update(desc=apply_replica.MARKER, parameter_name=name)
        L.create_material_expression(mat, FakeVector3).props.update(desc=apply_replica.MARKER, constant=(0., 0., 1., 1.))
    return mat


def fake_trim(u, path='/Game/Plateau/Materials/M_Trim'):
    """M_Trim as upgrade_plateau.material() authors a plain colour: tint straight into BaseColor, constants."""
    mat = FakeMaterial(path)
    u.EditorAssetLibrary.registry[path] = mat
    L, P = u.MaterialEditingLibrary, u.MaterialProperty
    tint = L.create_material_expression(mat, FakeVector3)
    L.connect_material_property(tint, '', P.MP_BASE_COLOR)
    for prop in (P.MP_ROUGHNESS, P.MP_METALLIC):
        L.connect_material_property(L.create_material_expression(mat, FakeConstant), '', prop)
    return mat


def expect_rejected(action, message):
    try:
        action()
    except AssertionError:
        return
    raise AssertionError('Accepted ' + message)


def macro_chain(mat, row):
    """The tint, through the macro multiplies, into the diffuse product: returns the multiplies in order."""
    product = next(n for n in mat.nodes if isinstance(n, FakeMultiply) and n.links.get('A', (None,))[0] is not None
                   and isinstance(n.links['A'][0], FakeSample) and n.links['A'][0].get_editor_property('texture').path
                   == row['textures']['diff'])
    chain, node = [], product.links['B'][0]
    while isinstance(node, FakeMultiply) and node.get_editor_property('desc') == apply_replica.MACRO_DESC:
        chain.append(node)
        lerp = node.links['B'][0]
        assert isinstance(lerp, FakeLerp) and isinstance(lerp.links['Alpha'][0], FakeSample), row['key']
        node = node.links['A'][0]
    assert isinstance(node, FakeVector3) and node.get_editor_property('desc') != apply_replica.MARKER, \
        (row['key'], 'the macro chain does not start at the tint')
    return chain


def check_editor_side():
    """Run the apply step's texture import (clamped cards, macro mask), masked-parent build, material duplication
    (macro variation on the tint, and the fresh fallback), mesh import (Preserve Area on masked batches), layer
    actors (Collision_Only walls hidden in game, blocking pawns, ignoring camera and visibility), yard-tree
    spawning, and the matching verify checks against a fake unreal module, for every shared key."""
    A = apply_replica
    keys = sorted(A.SHARED_TEXTURE_KEYS)
    trees = [{'x': 300. * n, 'y': 200. * n, 'z': 5., 'yaw': 30. * n, 'scale': 1.6 + .2 * (n % 3), 'kind': kind}
             for n, kind in enumerate(['maple', 'elm', 'maple', 'ash', 'small', 'maple'])]
    wall = {'Collision_Only': ({'base_color_srgb': '#FF00FF', 'roughness': 1., 'metallic': 0}, 'complex')}
    out = {}
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, keys, trees, extra=wall)
        the_plan = A.plan(tmp)
        specs = json.loads((Path(tmp) / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json').read_text())['materials']
        u = fake_unreal()
        registry = u.EditorAssetLibrary.registry
        fake_parent(u, A.TEXTURED_PARENT, 'brick_wall_001')
        fake_parent(u, A.WET_PARENT, 'concrete_pavement', wet=True)
        fake_trim(u)
        textures = {}
        for row in the_plan['textures']:
            textures[row['asset']] = dict(row, object=A.import_texture(u, Path(tmp), row))
            A.check_texture(u, registry[row['asset']], row)
        alpha = [t for t in textures.values() if t['alpha']]
        masked_sets = {name for name, e in A.load_textures(Path(tmp)).items() if e['alpha']}
        assert len(alpha) == len(masked_sets) == 10 and \
            all(t['object'].get_editor_property('alpha_coverage_thresholds').w == .5 for t in alpha)
        clamped = [t for t in textures.values() if t['object'].get_editor_property('address_y') == 'TA_CLAMP']
        assert sorted({t['set'] for t in clamped}) == ['balusters', 'cedar', 'fence_boards', 'fountain_grass',
                                                        'iron_wrought', 'lattice', 'laundry', 'pit_flowers']
        assert len(clamped) == 24
        assert sorted({t['set'] for t in textures.values()
                       if t['object'].get_editor_property('address_x') == 'TA_CLAMP'}) == ['laundry']
        for row in the_plan['parents']:
            mat = A.build_parent(u, row, textures)
            A.check_material_mode(u, mat, row)
            assert len(A.authored_tints(u, mat)) == 1 and FakeLibrary.has_material_usage(mat, 'MATUSAGE_NANITE')
            assert A.check_macro_nodes(u, mat, row) == 0
        materials = {}
        for row in the_plan['materials']:
            spec = specs[row['key']]
            mat, fresh = A.make_material(u, row, spec, textures)
            materials[row['asset']] = mat
            assert not fresh, row['key'] + ' fell back to a fresh material: its parent graph did not retexture'
            if not row.get('texture_set'):
                continue
            A.check_material_mode(u, mat, row)
            plain = [n for n in mat.nodes if n.get_editor_property('desc') != A.MACRO_DESC]
            used = sorted(n.get_editor_property('texture').path for n in plain if isinstance(n, FakeSample))
            assert used == sorted(row['textures'].values()), (row['key'], used)
            coords = [n for n in plain if isinstance(n, FakeCoords)]
            assert len(coords) == 1 and [coords[0].get_editor_property(k) for k in ('u_tiling', 'v_tiling')] == row['tiling']
            (tint,) = A.authored_tints(u, mat)
            want = ([1., 1., 1.] if row.get('own_colour') else
                    [min(A.TINT_LIMIT, c / m) for c, m in zip(A.linear(spec['base_color_srgb']), row['mean_linear'])])
            assert all(abs(a - b) < 1e-9 for a, b in zip(tint.get_editor_property('constant')[:3], want)), row['key']
            assert A.check_tint(u, mat, row), row['key']
            wet = [n.get_editor_property('parameter_name') for n in mat.nodes if isinstance(n, FakeCollection)]
            assert ('Wetness' in wet) == row['wet'], row['key']
            if row['shading_model'] == 'two_sided_foliage':
                assert FakeLibrary.get_material_property_input_node(mat, 'MP_SUBSURFACE_COLOR') is not None
            # Macro variation: two mask samples at the macro tiles, multiplied into the tint pin of the product.
            assert A.check_macro_nodes(u, mat, row) == (2 if row.get('macro') else 0), row['key']
            assert len(macro_chain(mat, row)) == (2 if row.get('macro') else 0), row['key']
            out[row['key']] = {'parent': row['duplicate_of'].rsplit('/', 1)[1],
                               'blend_mode': mat.get_editor_property('blend_mode'),
                               'two_sided': mat.get_editor_property('two_sided'),
                               'macro_samples': 2 if row.get('macro') else 0}
        rows = {m['key']: m for m in the_plan['materials']}
        # The contract keys, as built: verify's own contract check passes them and rejects a cedar card that wraps in
        # V or a laundry atlas that lost its mask.
        assert sum(A.check_contract(u, materials[rows[k]['asset']], rows[k]) for k in A.CONTRACT_KEYS) == 7
        cedar_v = textures[rows['Leaf_Cedar']['textures']['diff']]['object']
        cedar_v.set_editor_property('address_y', 'TA_WRAP')
        expect_rejected(lambda: A.check_contract(u, materials[rows['Leaf_Cedar']['asset']], rows['Leaf_Cedar']),
                        'a cedar card that wraps in V')
        cedar_v.set_editor_property('address_y', 'TA_CLAMP')
        laundry = materials[rows['Cloth_Laundry']['asset']]
        laundry.set_editor_property('blend_mode', 'BLEND_OPAQUE')
        expect_rejected(lambda: A.check_contract(u, laundry, rows['Cloth_Laundry']), 'an opaque laundry atlas')
        laundry.set_editor_property('blend_mode', 'BLEND_MASKED')
        # The fresh-material fallback keeps the mask, sidedness, foliage shading and macro variation.
        for key in ('Rail_Lattice', 'Leaf_Creeper', 'Siding_Lap_Grey', 'Roof_Gravel'):
            row = dict(rows[key], asset=rows[key]['asset'] + '_Fresh', duplicate_of='/Game/Plateau/Materials/M_Missing')
            mat, fresh = A.make_material(u, row, specs[key], textures)
            assert fresh
            A.check_material_mode(u, mat, dict(row, duplicate_of=None))
            assert A.check_macro_nodes(u, mat, row) == (2 if row.get('macro') else 0), key
            assert len(macro_chain(mat, row)) == (2 if row.get('macro') else 0), key
        # verify rejects a card that lost its mask, its two sides, its own alpha or its metallic.
        baluster = rows['Rail_Baluster']
        broken = registry[baluster['asset']]
        broken.set_editor_property('blend_mode', 'BLEND_OPAQUE')
        expect_rejected(lambda: A.check_material_mode(u, broken, baluster), 'an opaque baluster card')
        broken.set_editor_property('blend_mode', 'BLEND_MASKED')
        broken.set_editor_property('two_sided', False)
        expect_rejected(lambda: A.check_material_mode(u, broken, baluster), 'a one-sided baluster card')
        broken.set_editor_property('two_sided', True)
        rough = next(n for n in broken.nodes
                     if isinstance(n, FakeSample) and n.get_editor_property('texture').path.endswith('_rough'))
        diff_link = broken.inputs['MP_OPACITY_MASK']
        broken.inputs['MP_OPACITY_MASK'] = (rough, 'A')
        expect_rejected(lambda: A.check_material_mode(u, broken, baluster), 'an OpacityMask from the wrong map')
        broken.inputs['MP_OPACITY_MASK'] = diff_link
        A.check_material_mode(u, broken, baluster)
        sheet = rows['Sheet_Metal']
        expect_rejected(lambda: A.check_material_mode(u, registry[sheet['asset']], dict(sheet, metallic=0.)),
                        'galvanised sheet with the wrong metallic')
        cutout = next(t for t in alpha if t['set'] == 'balusters')
        cutout['object'].set_editor_property('do_scale_mips_for_alpha_coverage', False)
        expect_rejected(lambda: A.check_texture(u, cutout['object'], cutout), 'cut-out mips without alpha coverage')
        cutout['object'].set_editor_property('do_scale_mips_for_alpha_coverage', True)
        cutout['object'].set_editor_property('address_y', 'TA_WRAP')
        expect_rejected(lambda: A.check_texture(u, cutout['object'], cutout), 'a baluster card that wraps in V')
        gravel = rows['Roof_Gravel']
        lerp = next(n for n in registry[gravel['asset']].nodes if isinstance(n, FakeLerp))
        lerp.set_editor_property('const_b', 1.)
        expect_rejected(lambda: A.check_macro_nodes(u, registry[gravel['asset']], gravel), 'a flattened macro lerp')
        expect_rejected(lambda: A.check_macro_nodes(u, registry[rows['Parged']['asset']], dict(rows['Parged'],
                        macro=gravel['macro'])), 'a macro set without its macro nodes')
        # Meshes: every batch imported as Nanite, Preserve Area on the masked ones; layer actors and their checks.
        meshes, editor = {}, FakeEditor()
        for row in the_plan['meshes']:
            folder, name = row['asset'].rsplit('/', 1)
            source = Path(tmp) / 'Data/Plateau/ReplicaGeometry' / row['layer'] / row['file']
            meshes[row['asset']] = A.import_mesh(u, source, folder, name, materials[row['material']], row['collision'],
                                                 row['colliders'], row['nanite_shape_preservation'])
        by_mesh = {m['asset']: m for m in the_plan['meshes']}
        actors = {}
        for row in the_plan['actors']:
            actors[row['label']] = A.spawn_layer_actor(u, editor, row, meshes[row['mesh']],
                                                       materials[by_mesh[row['mesh']]['material']])
            A.check_layer_actor(u, actors[row['label']], row, by_mesh[row['mesh']])
        kinds = {r['label']: r for r in the_plan['actors']}
        wall_row = next(r for r in the_plan['actors'] if r['collision_only'])
        wall_actor = actors[wall_row['label']]
        c = wall_actor.static_mesh_component
        assert wall_actor.get_editor_property('hidden') and not c.get_editor_property('cast_shadow')
        assert c.get_collision_response_to_channel('ECC_PAWN') == 'ECR_BLOCK' and c.profile == 'Custom'
        assert c.get_collision_response_to_channel('ECC_CAMERA') == c.get_collision_response_to_channel('ECC_VISIBILITY') \
            == 'ECR_IGNORE'
        assert meshes[wall_row['mesh']].get_editor_property('body_setup').get_editor_property('collision_trace_flag') \
            == 'CTF_USE_COMPLEX_AS_SIMPLE'
        c.set_collision_response_to_channel('ECC_CAMERA', 'ECR_BLOCK')
        expect_rejected(lambda: A.check_layer_actor(u, wall_actor, wall_row, by_mesh[wall_row['mesh']]),
                        'an invisible wall that blocks the camera')
        c.set_collision_response_to_channel('ECC_CAMERA', 'ECR_IGNORE')
        wall_actor.set_actor_hidden_in_game(False)
        expect_rejected(lambda: A.check_layer_actor(u, wall_actor, wall_row, by_mesh[wall_row['mesh']]),
                        'a Collision_Only wall that renders in game')
        wall_actor.set_actor_hidden_in_game(True)
        A.check_layer_actor(u, wall_actor, wall_row, by_mesh[wall_row['mesh']])
        card_row = next(r for r in the_plan['actors'] if 'Rail_Baluster' in r['label'])
        card_mesh = meshes[card_row['mesh']]
        assert card_mesh.get_editor_property('nanite_settings').get_editor_property('shape_preservation') == 'PRESERVE_AREA'
        card_mesh.get_editor_property('nanite_settings').set_editor_property('shape_preservation', 'NONE')
        expect_rejected(lambda: A.check_layer_actor(u, actors[card_row['label']], card_row, by_mesh[card_row['mesh']]),
                        'a baluster card that thins out at a distance')
        out['actors'] = {'checked': len(actors), 'hidden_walls': sum(1 for r in kinds.values() if r['collision_only']),
                         'preserve_area': sum(1 for m in the_plan['meshes'] if m['nanite_shape_preservation'])}
        # Yard trees on the mapped trees' mesh, one actor per kind, no collision.
        registry[A.TREE_MESH] = FakeAsset(A.TREE_MESH)
        editor = FakeEditor()
        placed = A.spawn_yard_trees(u, editor, the_plan['trees'])
        actors = {a.label: a for a in editor.actors}
        assert sorted(placed) == sorted(actors) and A.check_yard_trees_placed(u, actors, the_plan['trees']) == len(trees)
        assert all(a.component.profile == 'NoCollision' and a.component.shadow for a in editor.actors)
        maple = actors[f'{A.PREFIX}Plex yard trees maple'].component
        maple.transforms.pop()
        expect_rejected(lambda: A.check_yard_trees_placed(u, actors, the_plan['trees']), 'a missing yard tree')
        out['yard_tree_actors'] = {label: placed[label]['count'] for label in sorted(placed)}
        out['fresh_fallback'] = 'masked, foliage, opaque and macro fallbacks keep their mode'
    out['species_trees'] = check_editor_trees()
    out['street_trees'] = check_editor_street_trees()
    out['tree_textures'] = check_editor_tree_textures()
    out['import_order'] = check_import_order()
    out['old_trees'] = check_editor_old_trees()
    return out


def editor_fakes():
    """A fake unreal module with the parents the tree and Plex fixtures duplicate, and a log of every import's file."""
    A = apply_replica
    u = fake_unreal()
    fake_parent(u, A.TEXTURED_PARENT, 'brick_wall_001')
    fake_parent(u, A.WET_PARENT, 'concrete_pavement', wet=True)
    fake_trim(u)
    u.EditorAssetLibrary.registry['/Game/Art/M_DetailedAutumnLeaves'] = FakeMaterial('/Game/Art/M_DetailedAutumnLeaves')
    tools, order = u.AssetToolsHelpers.get_asset_tools(), []
    real = tools.import_asset_tasks

    def logged(tasks):
        order.extend(t.filename for t in tasks)
        return real(tasks)
    tools.import_asset_tasks = logged
    return u, order


def check_import_order():
    """The apply step imports and checks the species meshes (the pipeline's only two-slot OBJs) before every other
    material and layer mesh: on the fake, every tree OBJ import precedes the first layer OBJ import, the yard and street
    trees then stand on them, and a tree OBJ whose slots name neither bark nor leaves stops the step before any layer
    mesh or layer material exists."""
    A = apply_replica
    report = lambda: {'textures': {}, 'parents': {}, 'materials': {}, 'fresh_materials': [], 'tree_meshes': {}}  # noqa: E731
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        synthetic_plex(tmp, ['Yard_Grass', 'Rail_Lattice'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        synthetic_streets(tmp, STREET_ROWS_FIXTURE)
        the_plan = A.plan(tmp)
        manifests, _ = A.load_manifests(root)
        u, order = editor_fakes()
        done = report()
        textures, materials, meshes = A.import_assets(u, root, the_plan, manifests, done)
        objs = [f for f in order if f.endswith('.obj')]
        trees = [i for i, f in enumerate(objs) if f'/{A.TREES}/' in f]
        layers = [i for i, f in enumerate(objs) if '/Plex/' in f]
        assert len(trees) == len(the_plan['tree_meshes']) == 4 and layers and max(trees) < min(layers), objs
        assert sorted(done['tree_meshes']) == sorted(m['asset'] for m in the_plan['tree_meshes'])
        made = list(done['materials'])
        assert all(a.startswith(f'{A.MATERIALS}/M_Replica_Trees_') for a in made[:the_plan['counts']['tree_materials']])
        # The yard and street trees on those meshes; verify's placement check passes the crowns' X and Y scale.
        editor = FakeEditor()
        A.spawn_yard_trees(u, editor, the_plan['trees'], meshes)
        actors = {a.label: a for a in editor.actors}
        assert A.check_yard_trees_placed(u, actors, the_plan['trees']) == len(TREE_ROWS_FIXTURE) + len(STREET_ROWS_FIXTURE)
        assert actors[f'{A.PREFIX}Street trees norway_maple young'].component.static_mesh is \
            meshes[f'{A.ASSETS}/Trees/SM_Tree_norway_maple_young']
        giant = actors[f'{A.PREFIX}Street trees silver_maple'].component
        assert giant.transforms[0].scale3d.x > giant.transforms[0].scale3d.z
        saved = giant.transforms[0].scale3d
        giant.transforms[0].scale3d = u.Vector(saved.z, saved.z, saved.z)
        expect_rejected(lambda: A.check_yard_trees_placed(u, actors, the_plan['trees']),
                        'a street tree that lost its crown spread')
        giant.transforms[0].scale3d = saved
        # A slot problem fails first.
        (root / 'Data/Plateau/ReplicaGeometry' / A.TREES / 'Tree_elm.obj').write_bytes(
            b'o tree\nv 0 0 0\nv 40 0 0\nv 0 0 900\nv 300 0 600\nv 0 300 700\nv -300 0 800\n'
            b'usemtl lambert1\nf 1 2 3\nusemtl lambert2\nf 4 5 6\n')
        u, order = editor_fakes()
        try:
            A.import_assets(u, root, A.plan(tmp), manifests, report())
        except AssertionError as error:
            message = str(error)
        else:
            raise AssertionError('A tree mesh whose slots name neither bark nor leaves was imported')
        assert 'must name the bark and the leaves' in message, message
        assert not any('/Plex/' in f for f in order), 'layer meshes were imported before the tree slots were checked'
        assert not any(a.startswith(f'{A.MATERIALS}/M_Replica_Plex_') for a in u.EditorAssetLibrary.registry), \
            'layer materials were made before the tree slots were checked'
        return {'tree_imports_first': len(trees), 'layer_imports': len(layers), 'slot_failure_before_layers': True}


class FakeVegetation:
    """AQuebecVegetation: its Trees HISM (the old summer trees on tree_small_02)."""

    def __init__(self, count, label=None):
        self.label = label or apply_replica.VEGETATION_LABEL
        self.trees = FakeHism()
        self.trees.static_mesh = FakeAsset(apply_replica.TREE_MESH)
        self.trees.transforms = [None] * count
        self.trees.clear_instances = lambda: self.trees.transforms.clear()

    def get_actor_label(self):
        return self.label

    def get_class(self):
        from types import SimpleNamespace
        return SimpleNamespace(get_name=lambda: 'QuebecVegetation')

    def get_editor_property(self, name):
        assert name == 'trees', name
        return self.trees

    def get_path_name(self):
        return '/Game/Maps/LaFontaine.LaFontaine:PersistentLevel.QuebecVegetation_0'


def check_editor_old_trees():
    """The old summer trees on the fake: apply clears the vegetation's instances (the actor stays), verify passes a
    cleared one and rejects one whose trees came back; two vegetation actors are refused; a map without one has
    nothing to clear."""
    from types import SimpleNamespace as NS
    A = apply_replica
    row = {'label': A.VEGETATION_LABEL, 'class': A.VEGETATION_CLASS, 'mesh': A.TREE_MESH, 'action': 'clear instances'}
    veg = FakeVegetation(4707)
    other = NS(get_actor_label=lambda: 'OSM Road')
    editor = NS(get_all_level_actors=lambda: [other, veg])
    cleared = A.clear_vegetation(None, editor, row)
    assert cleared == {'present': True, 'path': veg.get_path_name(), 'mesh': f'{A.TREE_MESH}.tree_small_02',
                       'cleared': 4707}, cleared
    assert veg.trees.get_instance_count() == 0 and veg.label == A.VEGETATION_LABEL
    actors = {A.VEGETATION_LABEL: veg}
    assert A.check_vegetation_cleared(None, actors, row, cleared) == 4707
    veg.trees.transforms.append(None)
    expect_rejected(lambda: A.check_vegetation_cleared(None, actors, row, cleared), 'an old summer tree that came back')
    twice = NS(get_all_level_actors=lambda: [FakeVegetation(3), FakeVegetation(3)])
    expect_rejected(lambda: A.clear_vegetation(None, twice, row), 'two vegetation actors')
    none = A.clear_vegetation(None, NS(get_all_level_actors=lambda: [other]), row)
    assert none == {'present': False, 'cleared': 0} and A.check_vegetation_cleared(None, {}, row, none) == 0
    assert A.check_vegetation_cleared(None, {}, None, None) == 0, 'no street trees: nothing to check'
    return {'cleared': cleared['cleared']}


def check_editor_trees():
    """Species meshes against the fake: tree materials (leaves as two-sided foliage), the OBJ imported with its bark
    and leaves slots set by name and Nanite Preserve Area, the yard trees instanced on those meshes, and verify."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        the_plan = A.plan(tmp)
        u = fake_unreal()
        registry = u.EditorAssetLibrary.registry
        fake_parent(u, A.WET_PARENT, 'concrete_pavement', wet=True)
        fake_trim(u)
        registry['/Game/Art/M_DetailedAutumnLeaves'] = FakeMaterial('/Game/Art/M_DetailedAutumnLeaves')
        textures = {row['asset']: dict(row, object=A.import_texture(u, Path(tmp), row)) for row in the_plan['textures']}
        materials = {}
        for row in the_plan['materials']:
            if row['layer'] != A.TREES:
                continue
            materials[row['asset']], fresh = A.make_material(u, row, row['spec'], textures)
            assert not fresh, row['key']
            if row['foliage']:
                A.check_foliage(u, materials[row['asset']], row)
            else:
                expect_rejected(lambda: A.check_foliage(u, materials[row['asset']], row), 'bark as foliage')
        meshes = {}
        for row in the_plan['tree_meshes']:
            slots = {slot: materials[a] if a in materials else u.EditorAssetLibrary.load_asset(a)
                     for slot, a in row['materials'].items()}
            meshes[row['asset']] = A.import_tree_mesh(u, Path(tmp), row, slots)
            A.check_tree_mesh(u, meshes[row['asset']], row)
        maple = next(r for r in the_plan['tree_meshes'] if r['species'] == 'norway_maple')
        mesh = meshes[maple['asset']]
        assert [s.get_editor_property('material_slot_name') for s in mesh.get_editor_property('static_materials')] == \
            ['bark', 'leaves'] and mesh.get_material(1).path.endswith('norway_maple_leaves')
        mesh.set_material(1, mesh.get_material(0))
        expect_rejected(lambda: A.check_tree_mesh(u, mesh, maple), 'a maple whose leaves wear its bark')
        expect_rejected(lambda: A.assign_tree_slots(u, FakeMesh('/Game/x', ('lambert1', 'lambert2')), {}),
                        'tree slots that name neither bark nor leaves')
        editor = FakeEditor()
        placed = A.spawn_yard_trees(u, editor, the_plan['trees'], meshes)
        actors = {a.label: a for a in editor.actors}
        assert A.check_yard_trees_placed(u, actors, the_plan['trees']) == len(TREE_ROWS_FIXTURE)
        assert all(a.component.static_mesh is meshes[t['mesh']] for a, t in zip(editor.actors, the_plan['trees']))
        return {label: placed[label]['count'] for label in sorted(placed)}


def check_editor_street_trees():
    """The fall groups and the sniff tag against the fake. Apply imports the tree materials (the tinted leaves among
    them) and the species meshes, and spawns each street group with the NordStreetTree tag. A tinted group's leaves slot
    takes the fall material on the kind's own mesh; the other groups keep the mesh's leaves; the yard trees carry no
    tag. Verify passes them, and rejects a street-tree actor without the tag, a red group that lost its tint and a
    yellow group that wears one."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        fall_root(tmp, FALL_ROWS, FALL_YARD)
        the_plan = A.plan(tmp)
        manifests, _ = A.load_manifests(Path(tmp))
        u, _ = editor_fakes()
        report = {'textures': {}, 'parents': {}, 'materials': {}, 'fresh_materials': [], 'tree_meshes': {}}
        _, materials, meshes = A.import_assets(u, Path(tmp), the_plan, manifests, report)
        assert not report['fresh_materials'], report['fresh_materials']
        editor = FakeEditor()
        A.spawn_yard_trees(u, editor, the_plan['trees'], meshes, materials)
        actors = {a.label: a for a in editor.actors}
        assert A.check_yard_trees_placed(u, actors, the_plan['trees']) == len(FALL_ROWS) + len(FALL_YARD)
        for t in the_plan['trees']:
            actor = actors[t['label']]
            assert actor.get_editor_property('tags') == ([A.STREET_TREE_TAG] if t['group'] == 'street' else []), t['label']
            mesh = actor.component.static_mesh
            slots = [i for i, s in enumerate(mesh.get_editor_property('static_materials'))
                     if A.tree_slot(s.get_editor_property('material_slot_name')) == 'leaves']
            assert len(slots) == 1 and mesh.get_material(slots[0]) is materials[
                f'{A.MATERIALS}/M_Replica_Trees_Tree_Leaves_Autumn'], t['label']
            want = materials[t['leaves']['asset']] if t['leaves'] else mesh.get_material(slots[0])
            assert actor.component.get_material(slots[0]) is want, t['label']
            assert actor.component.get_material(1 - slots[0]) is mesh.get_material(1 - slots[0]), 'the bark is untouched'
        red, yellow = (actors[f'{A.PREFIX}Street trees norway_maple{s}'] for s in (' red', ''))
        assert red.component.static_mesh is yellow.component.static_mesh, 'a tinted group needs no mesh of its own'
        red.set_editor_property('tags', [])
        expect_rejected(lambda: A.check_yard_trees_placed(u, actors, the_plan['trees']), 'a street tree with no tag')
        red.set_editor_property('tags', [A.STREET_TREE_TAG])
        tint = dict(red.component.overrides)
        red.component.overrides.clear()
        expect_rejected(lambda: A.check_yard_trees_placed(u, actors, the_plan['trees']), 'a red maple drawn yellow')
        red.component.overrides.update(tint)
        yellow.component.overrides.update(tint)
        expect_rejected(lambda: A.check_yard_trees_placed(u, actors, the_plan['trees']), 'a yellow maple drawn red')
        yellow.component.overrides.clear()
        A.check_yard_trees_placed(u, actors, the_plan['trees'])
        return {'tagged': sum(1 for a in editor.actors if a.get_editor_property('tags')),
                'tinted': sorted(t['label'][len(A.PREFIX):] for t in the_plan['trees'] if t['leaves'])}


def check_editor_tree_textures():
    """The trees' own texture sets against the fake: the leaf atlas imports clamped in U and V with alpha-coverage
    mips, the foliage parent is built from it, the leaves duplicate it masked and two-sided with OpacityMask from the
    atlas alpha, the bark retextures the wall parent; the species meshes wear both; verify rejects a wrapping atlas,
    an opaque leaf material and leaves masked by the bark."""
    A = apply_replica
    rows = [{'x': 100. * n, 'y': 0., 'z': 0., 'yaw': 10. * n, 'scale': 3., 'kind': k}
            for n, k in enumerate(['maple', 'linden', 'linden'])]
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': rows}, tree_kinds=TREE_TEXTURED_KINDS)
        write_tree_texture_sets(tmp)
        the_plan = A.plan(tmp)
        specs = json.loads((Path(tmp) / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json').read_text())['materials']
        u = fake_unreal()
        registry = u.EditorAssetLibrary.registry
        fake_parent(u, A.TEXTURED_PARENT, 'brick_wall_001')
        fake_parent(u, A.WET_PARENT, 'concrete_pavement', wet=True)
        fake_trim(u)
        textures = {}
        for row in the_plan['textures']:
            textures[row['asset']] = dict(row, object=A.import_texture(u, Path(tmp), row))
            A.check_texture(u, registry[row['asset']], row)
        atlas = textures[f'{A.TEXTURE_ASSETS}/T_Replica_TreeLeaves_diff']['object']
        assert atlas.get_editor_property('address_x') == atlas.get_editor_property('address_y') == 'TA_CLAMP'
        assert atlas.get_editor_property('do_scale_mips_for_alpha_coverage') and \
            atlas.get_editor_property('alpha_coverage_thresholds').w == .5
        bark_map = textures[f'{A.TEXTURE_ASSETS}/T_Replica_TreeBark_diff']['object']
        assert bark_map.get_editor_property('address_x') == bark_map.get_editor_property('address_y') == 'TA_WRAP'
        for row in the_plan['parents']:
            A.check_material_mode(u, A.build_parent(u, row, textures), row)
        materials = {}
        for row in the_plan['materials']:
            spec = row['spec'] if row['layer'] == A.TREES else specs[row['key']]
            materials[row['asset']], fresh = A.make_material(u, row, spec, textures)
            assert not fresh, row['key'] + ' fell back to a fresh material'
            A.check_material_mode(u, materials[row['asset']], row)
            assert A.check_tint(u, materials[row['asset']], row), row['key']
        leaves = next(m for m in the_plan['materials'] if m['key'] == 'Tree_Leaves_Autumn')
        bark = next(m for m in the_plan['materials'] if m['key'] == 'Bark_Grey')
        leaf_mat, bark_mat = materials[leaves['asset']], materials[bark['asset']]
        assert leaf_mat.get_editor_property('blend_mode') == 'BLEND_MASKED' and leaf_mat.get_editor_property('two_sided')
        assert leaf_mat.get_editor_property('shading_model') == 'MSM_TWO_SIDED_FOLIAGE'
        assert FakeLibrary.get_material_property_input_node(leaf_mat, 'MP_SUBSURFACE_COLOR') is not None
        mask = FakeLibrary.get_material_property_input_node(leaf_mat, 'MP_OPACITY_MASK')
        assert mask.get_editor_property('texture').path == leaves['textures']['diff']
        assert bark_mat.get_editor_property('blend_mode') == 'BLEND_OPAQUE'
        coords = [n for n in bark_mat.nodes if isinstance(n, FakeCoords)]
        assert [coords[0].get_editor_property(k) for k in ('u_tiling', 'v_tiling')] == [1., .5]
        meshes = {}
        for row in the_plan['tree_meshes']:
            slots = {slot: materials[a] for slot, a in row['materials'].items()}
            meshes[row['asset']] = A.import_tree_mesh(u, Path(tmp), row, slots)
            A.check_tree_mesh(u, meshes[row['asset']], row)
            assert meshes[row['asset']].get_material(1) is leaf_mat and meshes[row['asset']].get_material(0) is bark_mat
        # verify rejects an atlas that wraps, an opaque leaf material and leaves masked by the bark's map.
        leaf_row = next(t for t in the_plan['textures'] if t['asset'].endswith('TreeLeaves_diff'))
        atlas.set_editor_property('address_x', 'TA_WRAP')
        expect_rejected(lambda: A.check_texture(u, atlas, leaf_row), 'a leaf atlas that wraps in U')
        atlas.set_editor_property('address_x', 'TA_CLAMP')
        leaf_mat.set_editor_property('blend_mode', 'BLEND_OPAQUE')
        expect_rejected(lambda: A.check_material_mode(u, leaf_mat, leaves), 'opaque leaf cards')
        leaf_mat.set_editor_property('blend_mode', 'BLEND_MASKED')
        bark_sample = next(n for n in bark_mat.nodes if isinstance(n, FakeSample)
                           and n.get_editor_property('texture').path == bark['textures']['diff'])
        good = leaf_mat.inputs['MP_OPACITY_MASK']
        stray = FakeLibrary.create_material_expression(leaf_mat, FakeSample)
        stray.set_editor_property('texture', bark_sample.get_editor_property('texture'))
        leaf_mat.inputs['MP_OPACITY_MASK'] = (stray, 'A')
        expect_rejected(lambda: A.check_material_mode(u, leaf_mat, leaves), 'leaves masked by the bark map')
        leaf_mat.inputs['MP_OPACITY_MASK'] = good
        A.check_material_mode(u, leaf_mat, leaves)
        return {'textures': len(the_plan['textures']), 'parents': [p['asset'].rsplit('/', 1)[1] for p in the_plan['parents']],
                'leaves': leaf_mat.get_editor_property('blend_mode'), 'tree_meshes': len(meshes)}


def check_set_authority():
    """With Plex's own colours (#2C2B29 tar, .6-metallic sheet): the tar set owns its colour, so its tint stays white
    and the roof shows its grey gravel (about #4A4744), not black; the sheet set caps metallic at .3; the other sets
    follow the manifest. Checked in the plan, the dry-run key table, the material the editor side builds (duplicate
    and fresh fallback), and verify, which rejects a black-tinted tar roof and a .6-metallic sheet."""
    A = apply_replica
    extra = {'Roof_Tar': ({'base_color_srgb': '#2C2B29', 'roughness': .9, 'metallic': 0}, 'none'),
             'Sheet_Metal': ({'base_color_srgb': '#A4A8AA', 'roughness': .4, 'metallic': .6}, 'none'),
             'Siding_Lap_Grey': ({'base_color_srgb': '#8E9091', 'roughness': .6, 'metallic': .05}, 'none'),
             'Roof_Gravel': ({'base_color_srgb': '#C8C4BA', 'roughness': .95, 'metallic': 0}, 'none')}
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, [], extra=extra)
        the_plan = A.plan(tmp)
        specs = {k: v[0] for k, v in extra.items()}
        rows = {m['key']: m for m in the_plan['materials']}
        tar, sheet, siding, gravel = (rows[k] for k in ('Roof_Tar', 'Sheet_Metal', 'Siding_Lap_Grey', 'Roof_Gravel'))
        assert tar['own_colour'] and tar['tint'] == (1., 1., 1.) and tar['colour_source'] == 'texture', tar['tint']
        shown = plateau_textures.to_srgb_hex(tar['mean_linear'])
        assert all(abs(int(shown[i:i + 2], 16) - int('4A4744'[i - 1:i + 1], 16)) <= 6 for i in (1, 3, 5)), shown
        black = A.textured_tint(dict(tar, own_colour=False), specs['Roof_Tar'])
        assert max(black) < .45, ('the Plex colour would multiply the gravel down to black', black)
        assert not gravel['own_colour'] and gravel['colour_source'] == 'manifest'
        assert gravel['tint'] == tuple(min(A.TINT_LIMIT, c / m) for c, m in zip(A.linear('#C8C4BA'), gravel['mean_linear']))
        assert sheet['metallic_max'] == plateau_textures.SETS['sheet_metal']['metallic'] == sheet['metallic'] == .3
        assert A.textured_metallic(sheet, {'metallic': .1}) == .1, 'the cap never raises a lower metallic'
        assert siding['metallic_max'] is None and siding['metallic'] == .05
        shared = A.shared_key_plan(tmp)
        assert shared['Roof_Tar'].get('own_colour') and not shared['Roof_Gravel'].get('own_colour')
        assert shared['Sheet_Metal'].get('metallic_max') == .3 and 'metallic_max' not in shared['Siding_Lap_Grey']
        u = fake_unreal()
        registry = u.EditorAssetLibrary.registry
        fake_parent(u, A.TEXTURED_PARENT, 'brick_wall_001')
        fake_parent(u, A.WET_PARENT, 'concrete_pavement', wet=True)
        textures = {row['asset']: dict(row, object=A.import_texture(u, Path(tmp), row)) for row in the_plan['textures']}
        for key, row in rows.items():
            mat, fresh = A.make_material(u, row, specs[key], textures)
            assert not fresh, key
            assert A.check_tint(u, mat, row) and A.check_material_mode(u, mat, row) is None, key
        tar_mat = registry[tar['asset']]
        (tint,) = A.authored_tints(u, tar_mat)
        assert tint.get_editor_property('constant')[:3] == (1., 1., 1.)
        tint.set_editor_property('constant', (*black, 1.))
        expect_rejected(lambda: A.check_tint(u, tar_mat, tar), 'a tar roof tinted down to black')
        sheet_mat = registry[sheet['asset']]
        metal = FakeLibrary.get_material_property_input_node(sheet_mat, 'MP_METALLIC')
        assert abs(metal.get_editor_property('r') - .3) < 1e-9, metal.get_editor_property('r')
        metal.set_editor_property('r', .6)
        expect_rejected(lambda: A.check_material_mode(u, sheet_mat, sheet), 'galvanised sheet at the manifest .6')
        fresh_row = dict(tar, asset=tar['asset'] + '_Fresh', duplicate_of='/Game/Plateau/Materials/M_Missing')
        mat, fresh = A.make_material(u, fresh_row, specs['Roof_Tar'], textures)
        assert fresh and A.check_tint(u, mat, fresh_row), 'the fresh fallback keeps the white tar tint'
        return {'Roof_Tar': {'tint': list(tar['tint']), 'shows': shown, 'plex_tint_would_be': [round(t, 3) for t in black]},
                'Sheet_Metal': {'manifest_metallic': .6, 'metallic': sheet['metallic']},
                'Roof_Gravel': {'tint': [round(t, 3) for t in gravel['tint']]}}


# ------------------------------------------------------------------------------------------------
# Lane life (Soul): laundry from the galleries, gate props, ruelles vertes, tags, murals

def _outward(face, facing):
    n = replica.newell([tuple(p) for p in face])
    return n[0] * facing[0] + n[1] * facing[1] + n[2] * facing[2] > 0


def check_lane_fixtures():
    """Small synthetic checks of the lane-life helpers, independent of the map."""
    R = replica
    # A mural faces out of its wall (right of a->b); the first version was wound inward and culled.
    S = R.Layer('Soul', R.SOUL_MATERIALS)
    assert R._mural(S, {'a': (0., 0.), 'b': (1000., 0.)}, {'height': 1200.}, R.Rng('fixture'), off=R.PLEX_D_FACE + .9)
    faces = [f for k, fs in S.faces.items() if k.startswith('mural_') for f in fs]
    assert faces and all(_outward(f, (0., -1., 0.)) for f in faces), 'a mural face points into its wall'
    assert all(-17.31 <= p[1] <= -16.89 for f in faces for p in f), 'a mural left the Plex skin face (16.9-17.3 cm)'
    assert all(0 <= p[0] <= 1000 and 130 <= p[2] <= 1110 for f in faces for p in f)
    # A fence mural: low and narrow, still facing the lane, still on the fence.
    S = R.Layer('Soul', R.SOUL_MATERIALS)
    assert R._mural(S, {'a': (0., 0.), 'b': (0., 400.)}, {'height': 180. + 82.}, R.Rng('fence'), off=1.2, z0=15.,
                    margin=15., min_h=120., min_w=250.)
    faces = [f for k, fs in S.faces.items() if k.startswith('mural_') for f in fs]
    assert all(_outward(f, (1., 0., 0.)) for f in faces) and all(15 <= p[2] <= 172 for f in faces for p in f)
    # Card UVs: u in metres along the run, v 0..1 up the card, whatever the facing.
    S = R.Layer('Soul', R.SOUL_MATERIALS)
    S.card('Rail_Lattice', (0., 0.), (40., 0.), 30., 130., (0., 1.))
    S.card('Rail_Lattice', (0., 0.), (40., 0.), 130., 230., (0., -1.))
    text = R.obj_text('t', S.faces['Rail_Lattice'])
    vts = [tuple(map(float, line.split()[1:])) for line in text.splitlines() if line.startswith('vt ')]
    assert sorted({v for _, v in vts}) == [0., 1.] and sorted({u for u, _ in vts}) == [0., .4], vts
    assert _outward(S.faces['Rail_Lattice'][0], (0., 1., 0.)) and _outward(S.faces['Rail_Lattice'][1], (0., -1., 0.))
    # A tag stays inside its rectangle on the fence plane and faces the lane.
    F = R.Frame2((0., 0.), (1., 0.), (0., 1.), 300., 500.)
    for n in range(12):
        S = R.Layer('Soul', R.SOUL_MATERIALS)
        tris, kind = R._tag(S, F, 20., 220., 32., 150., 501.2, R.Rng('tag-fixture', n))
        faces = [f for k, fs in S.faces.items() if k.startswith('tag_') for f in fs]
        assert tris > 0 and faces and kind in ('tag', 'throw-up')
        assert all(_outward(f, (0., 1., 0.)) for f in faces), 'a tag face points into the fence'
        assert all(501.1 <= p[1] <= 501.6 for f in faces for p in f)
        assert all(16. <= p[0] <= 224. and 28. <= p[2] <= 154. for f in faces for p in f), kind
    # Interval subtraction, used for beds and murals around gates and sheds.
    assert R.subtract((0., 100.), [(20., 30.), (25., 50.)]) == [(0., 20.), (50., 100.)]
    assert R.subtract((0., 100.), [(40., 60.)], 5.) == [(0., 35.), (65., 100.)]
    # Without the open-data clip a seeded share (about 30%) of the ruelles is green, the same on every run.
    fake = type('W', (), {'alleys': [{'id': str(i), 'segments': [((0., 0.), (100., 0.))]} for i in range(400)]})()
    first, source = R.green_alleys(fake, None)
    assert first == R.green_alleys(fake, None)[0] and 'seeded' in source and 90 <= len(first) <= 150, len(first)
    # The rope is a true catenary. Level ends: c = ((L / 2)^2 - sag^2) / (2 sag) (Wikipedia, "Catenary", Determining
    # parameters), its vertex at mid-span; ends 40 cm apart in height: through both, its lowest point (the vertex)
    # toward the lower end, and L^2 - v^2 = 4c^2 sinh^2(span / 2c); a line rising 1.3 m has no vertex on its span.
    rope = R.Catenary((0., 0., 400.), (1000., 0., 400.), 25.)
    assert abs(rope.sag - 25.) < 1e-6 and abs(rope.m - 500.) < 1e-6, (rope.sag, rope.m)
    assert abs(rope.c - ((rope.length / 2) ** 2 - 25. ** 2) / 50.) < 1e-6 * rope.c, (rope.c, rope.length)
    rope = R.Catenary((0., 0., 300.), (600., 800., 340.), 22.)
    assert abs(rope.at(0.)[2] - 300.) < 1e-6 and math.dist(rope.at(1000.), (600., 800., 340.)) < 1e-6
    assert abs(320. - rope.at(500.)[2] - 22.) < 1e-6 and 0. < rope.m < 500.
    assert abs(rope.length ** 2 - 40. ** 2 - (2 * rope.c * math.sinh(500. / rope.c)) ** 2) < 1e-6 * rope.length ** 2
    assert abs(min(range(1001), key=lambda x: rope.at(x)[2]) - rope.m) <= .5, rope.m
    rope = R.Catenary((0., 0., 300.), (1000., 0., 430.), 22.)
    assert rope.m < 0. and all(rope.at(x)[2] < rope.at(x + 10)[2] for x in range(0, 991, 10)) and abs(rope.sag - 22.) < 1e-6
    # Paint goes on the solid faces of plateau_plex's lane fences, between its posts.
    import plateau_plex
    assert R.PLEX_POSTS == plateau_plex.FENCE_POSTS and R.PLEX_LATTICE_BAND == plateau_plex.LATTICE_TOP + 4.
    assert set(R.PAINT_FACE) == {'boards', 'lattice', 'slats'} and R.PAINT_FACE['slats'] > 1.5   # the 3 cm slat panel
    return {'murals_face_out': True, 'card_uv': 'u metres, v 0..1', 'tags_on_plane': 12, 'seeded_green_share': len(first) / 400,
            'catenary': 'closed form and both ends'}


def check_lane_life(world, out, soul, soul_rows):
    """Laundry, gate props, ruelles vertes and tags against the Plex records they were built from."""
    R = replica
    lane = json.loads((out / 'Soul/lane_life.json').read_text())
    assert soul['lane_life'] == 'lane_life.json' and soul['lane_life_sha256'] == R.sha_file(out / 'Soul/lane_life.json')
    assert lane['counts'] == {k: soul['counts'][k] for k in R.LANE_COUNTS}
    for rel in ('Data/Plateau/ReplicaGeometry/Plex/fronts.json', 'Data/Plateau/ReplicaGeometry/Soul/ruelles_vertes_clip.json'):
        assert rel in soul['source_sha256'], rel
    plex = R.PlexYards.load(world)
    lots = {lot['id']: lot for lot in plex.lots}
    poles = [r['position'][:2] for r in soul_rows if r['prop'] == 'utility_pole']
    edges = R.Grid(1000.)
    for i, (a, b, _) in enumerate(world.building_edges):
        edges.add(i, R.bbox([a, b]))

    def wall_distance(p, limit=300.):
        return min([limit] + [R.seg_dist(p, *world.building_edges[i][:2]) for i in edges.query(R.bbox([p], limit))])

    # Laundry: from a gallery guard at deck height out over the lot's own yard to its clothesline pole.
    laundry = lane['laundry']
    lines, pole_rows = laundry['lines'], laundry['poles']
    assert len(lines) >= 150 and len(pole_rows) >= 100, (len(lines), len(pole_rows))
    assert sum(l['garments'] for l in lines) == soul['counts']['garments'] >= 300
    for line in lines:
        lot = lots[line['lot']]
        rear, F = lot['rear'], lot['frame']
        guard = rear['guards'][line['guard']]
        a, e = line['anchor'], line['end']
        assert any(abs(dk['z'] - line['deck_z']) < .01 for dk in rear['decks']) and abs(guard['z0'] - line['deck_z']) < 1
        assert R.seg_dist(a[:2], guard['a'], guard['b']) <= 6., ('laundry anchor off its guard', line)
        assert guard['z0'] + 94 <= a[2] <= guard['z1'], ('laundry anchor not at the guard rail', line)
        pole = pole_rows[line['pole']]
        assert pole['lot'] == line['lot'] and math.dist(pole['position'], e[:2]) <= 12. and e[2] < pole['height_cm']
        rect = rear['yard']['rect']
        assert R.point_in(pole['position'], rect) and R.point_in(a[:2], [F.world(0, -400), F.world(F.W, -400),
                                                                          F.world(F.W, F.D), F.world(0, F.D)])
        # private land: the pole stands in the yard, so the line never crosses the fence or the ruelle
        assert all(R.point_in(R.lerp(a[:2], e[:2], t / 10), rect) or t == 0 for t in range(1, 11)), line
        assert world.traffic_distance(pole['position']) >= R.CLEAR
        assert all(math.dist(pole['position'], q) >= 100 for q in poles), 'a clothesline on a utility pole'
        # it runs out from the gallery, never to the mass wall behind it
        assert R.wall_clearance(world, a[:2], e[:2]) >= R.LINE_WALL - .5, line
        assert min(wall_distance(R.lerp(a[:2], e[:2], t / 20)) for t in range(21)) >= R.LINE_WALL - .5, line
        assert R.LINE_MIN_SPAN <= line['span_cm'] and a[2] <= R.LINE_TOP
        # the line rises from its pulley to the pole (by 30 cm or more), so it and its washing show over the lane fence
        assert e[2] - a[2] >= 30., ('a line falls to its pole', line)
        assert e[2] <= max(a[2] + R.LINE_RISE[1], R.LINE_MIN_END) + .01, line
        fence = rear.get('fence') or {}
        if fence.get('height_cm'):
            assert e[2] - 110 >= fence['height_cm'], ('washing would hang into the fence', line)
        shed = lots[line['lot']]['shed_poly']
        assert not shed or not any(R.segments_cross(a[:2], e[:2], p, q) for p, q in zip(shed, shed[1:] + shed[:1]))
    near_fence = 0
    for pole in pole_rows:
        F = lots[pole['lot']]['frame']
        assert not world.in_building(pole['position'], 40)
        assert 330 <= pole['height_cm'] <= R.LINE_END_TOP + R.POLE_TOP, pole
        # poles stand at the back of the yard: the recorded distance is the pole's, and most are at the fence line
        assert abs(F.D - F.local(pole['position'])[1] - pole['from_fence_cm']) < .05, pole
        assert pole['from_fence_cm'] in R.POLE_FENCE + R.POLE_FALLBACK, pole
        near_fence += pole['from_fence_cm'] <= 70.          # at the back fence, seen from the ruelle
        mine = [l for l in lines if pole_rows[l['pole']] is pole]
        assert pole['height_cm'] >= max(l['end'][2] for l in mine) + R.POLE_TOP - .5, pole
    assert near_fence >= .85 * len(pole_rows), (near_fence, len(pole_rows))
    # Gate props: blue and brown bins, flower boxes and bikes at the gates, never in the traffic band, a gate's
    # swing or another prop.
    gates = [r for r in soul_rows if 'gate_of' in r]
    kinds = {k: sum(1 for r in gates if r['prop'] == k) for k, _ in R.GATE_PROPS}
    assert all(v > 0 for v in kinds.values()) and len(gates) == len(lane['gates']), kinds
    assert kinds['bin_recycling'] >= 150 and kinds['bin_compost'] >= 100, kinds
    keep = R.Grid(1000.)
    for i, (poly, kind, _) in enumerate(plex.keepout):
        keep.add(i, R.bbox(poly))
    taken = []
    for row, rec in zip(gates, lane['gates']):
        assert not row['collision'] and row['prop'] == rec['prop'] and row['side'] in ('lane', 'yard')
        poly = R._prop_poly(row['prop'], row['position'][:2], row['yaw'])
        assert world.traffic_distance(poly, 2000) >= R.CLEAR, ('gate prop in the traffic band', row)
        assert not any(world.in_building(q) for q in poly)
        for i in keep.query(R.bbox(poly)):
            other, kind, owner = plex.keepout[i]
            if kind == 'gate':
                assert not any(R.point_in(q, other) for q in poly) and not any(R.point_in(q, poly) for q in other) and \
                    min(R.poly_seg_dist(other, *e) for e in zip(poly, poly[1:] + poly[:1])) > 0, ('blocks a gate', row)
        F = lots[row['gate_of']]['frame']
        g = lots[row['gate_of']]['rear']['fence']['gate_at']
        assert abs(rec['along_cm'] - g) >= R.GATE_KEEP and math.dist(F.world(rec['along_cm'], F.D), row['position'][:2]) < 130
        taken.append(poly)
    grid = R.Grid(1000.)
    for i, poly in enumerate(taken):
        for j in grid.query(R.bbox(poly)):
            other = taken[j]
            assert not any(R.point_in(q, other) for q in poly) and not any(R.point_in(q, poly) for q in other), 'props overlap'
        grid.add(i, R.bbox(poly))
    # Ruelles vertes: matched from the city's open data, with beds, plants, arches, planters and murals.
    clip = json.loads(R.RUELLES_VERTES.read_text())
    assert clip['source']['licence'] == 'CC BY 4.0' and clip['source']['dataset'].startswith('https://donnees.montreal.ca')
    assert clip['source']['borough_ruelles'] >= 80 and len(clip['polygons']) >= 20
    rv = lane['ruelles_vertes']
    assert rv['source'] == 'Ville de Montréal open data' and len(rv['alleys']) >= 15
    assert len({r for a in rv['alleys'] for r in a['ruelles']}) >= 10
    alley_ids = {a['id'] for a in world.alleys}
    assert all(a['osm_way'] in alley_ids for a in rv['alleys'])
    assert soul['counts']['green_bed_metres'] >= 1000 and soul['counts']['green_plants'] >= 2000
    assert len(rv['arches']) >= 8 and len(rv['planters']) == 2 * len(rv['arches'])
    for arch in rv['arches']:
        u = arch['axis']
        n = (-u[1], u[0])
        posts = [R.add(R.add(arch['position'], n, h * k), u, f) for h, k in zip(arch['half_cm'], (1, -1)) for f in (-25, 25)]
        assert not world.in_building(arch['position']) and not any(world.in_building(q, 14) for q in posts), arch
        assert all(R.ALLEY_HALF + 13 <= h <= 255 for h in arch['half_cm']), arch
        assert not R.on_pavement(world, arch['position']) and min(math.dist(q, pole) for q in posts for pole in poles) >= 59
    painted = [m for m in rv['murals'] if m.get('host')]
    assert len(painted) >= .7 * len({r for a in rv['alleys'] for r in a['ruelles']}), rv['murals']
    for m in painted:
        assert m['offset_cm'] in (1.2, R.PAINT_FACE['slats'], R.PLEX_D_FACE + .9)
        if m['host'] == 'fence':
            fence = lots[m['owner']]['rear']['fence']
            assert fence['kind'] in R.PAINT_FACE and m['offset_cm'] == R.PAINT_FACE[fence['kind']], m
    for key in ('Yard_Soil', 'Leaf_Creeper', 'Rail_Lattice', 'bed_edge', 'line_rope', 'pulley', 'clothes_pole'):
        assert key in soul['materials'], key
    for batch in soul['batches']:
        if batch['material'] == 'Rail_Lattice':
            vs = {float(line.split()[2]) for line in (out / 'Soul' / batch['file']).read_text().splitlines()
                  if line.startswith('vt ')}
            assert vs <= {0., 1.}, ('lattice cards lost their card UVs', vs)
    # Street murals sit on a bare wall (6 cm) or on a blank Plex skin (16.9 cm), never over windows.
    for m in lane['murals']:
        assert m['offset_cm'] in (6., R.PLEX_D_FACE + .9)
        assert R.PlexYards.mural_spot(plex, m['a'], m['b']) is not None
    # Tags on lane fences (between posts) and on shed and garage doors, facing the ruelle.
    tags = lane['tags']
    assert sum(1 for t in tags if t['on'] == 'fence') >= 15 and sum(1 for t in tags if t['on'] != 'fence') >= 5
    assert any(t['on'] == 'garage door' for t in tags) and any(t['kind'] == 'throw-up' for t in tags)
    for tag in tags:
        lot = lots[tag['lot']]
        F = lot['frame']
        assert lot['rear']['fence']['lane'] and tag['facing'] == [round(F.n[0], 2), round(F.n[1], 2)]
        x0, d0 = F.local(tag['plane'][0])
        if tag['on'] == 'fence':
            # only on a solid face: boards, the boards under a lattice band, a slat panel; never on pickets or chain-link
            fence = lot['rear']['fence']
            assert fence['kind'] in R.PAINT_FACE and tag['fence'] == fence['kind'], ('paint on an open fence', tag)
            assert abs(d0 - F.D - R.PAINT_FACE[fence['kind']]) < .15 and tag['top_cm'] <= R.board_top(fence) - 15 + .01
            assert not any(a < tag['x_cm'][1] and b > tag['x_cm'][0] for a, b in [(g - 160, g + 160) for g in
                           [lot['rear']['fence']['gate_at']] if g is not None])
        else:
            assert abs(d0 - lot['door'][2] - 1.6) < .15 and lot['door'][0] <= tag['x_cm'][0] < tag['x_cm'][1] <= lot['door'][1]
    return {'laundry_lines': len(lines), 'laundry_poles': len(pole_rows), 'garments': soul['counts']['garments'],
            'poles_at_fence': near_fence,
            'line_rise_cm': [round(min(l['end'][2] - l['anchor'][2] for l in lines)),
                             round(max(l['end'][2] - l['anchor'][2] for l in lines))],
            'gate_props': kinds, 'gate_sides': {s: sum(1 for r in gates if r['side'] == s) for s in ('lane', 'yard')},
            'ruelles_vertes': {'osm_ways': len(rv['alleys']), 'ids': len({r for a in rv['alleys'] for r in a['ruelles']}),
                               'bed_metres': soul['counts']['green_bed_metres'], 'arches': len(rv['arches']),
                               'planters': len(rv['planters']), 'murals': {h: sum(1 for m in painted if m['host'] == h)
                                                                          for h in ('wall', 'fence')}},
            'tags': {k: sum(1 for t in tags if t['on'] == k) for k in ('fence', 'shed door', 'garage door')},
            'street_murals': len(lane['murals'])}


# ------------------------------------------------------------------------------------------------
# Lane life, fourth pass: laundry seen from the ruelle, and the galleries as outdoor rooms

LAUNDRY_KEYS = ('line_rope', 'pulley', 'clothes_pole', 'Cloth_Laundry')
LAUNDRY_VIEW = 'ruelle_mentana'     # Scripts/blender/plateau_replica_preview.py: the Mentana and Saint-André ruelle
VIEW_SAMPLES = 24                   # points along each line's lower strand
VIEW_SEEN = (.25, 60.)              # a line counts as seen with this share of its points in sight, spanning these pixels
VIEW_NEAR = 1500.                   # and one such line, with washing in sight, within 15 m of the camera


def preview_view(name):
    """A view of the Blender preview script, without Blender: stub bpy and mathutils modules let it import, and its
    views() computes the camera from the OSM ways the renders use."""
    stubs = {'bpy': types.ModuleType('bpy'), 'mathutils': types.ModuleType('mathutils')}
    stubs['mathutils'].Matrix = stubs['mathutils'].Vector = object
    saved = {k: sys.modules.get(k) for k in stubs}
    sys.modules.update(stubs)
    try:
        spec = importlib.util.spec_from_file_location(
            '_replica_preview_views', replica.ROOT / 'Scripts/blender/plateau_replica_preview.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.views()[name]
    finally:
        for k, v in saved.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v


class ViewCamera:
    """The preview camera (Blender, sensor fit horizontal, no roll) in the game frame. The preview mirrors the scene
    and the camera together, which leaves what is in frame and what hides what unchanged."""

    def __init__(self, position, target, fov, res=(1280, 720)):
        self.c = tuple(position)
        f = [t - p for t, p in zip(target, position)]
        n = math.sqrt(sum(v * v for v in f))
        self.f = [v / n for v in f]
        rn = math.hypot(self.f[1], self.f[0])
        self.r = (self.f[1] / rn, -self.f[0] / rn, 0.)
        self.u = (self.r[1] * self.f[2] - self.r[2] * self.f[1], self.r[2] * self.f[0] - self.r[0] * self.f[2],
                  self.r[0] * self.f[1] - self.r[1] * self.f[0])
        self.tx = math.tan(math.radians(fov) / 2)
        self.ty = self.tx * res[1] / res[0]
        self.res = res

    def pixel(self, p):
        v = [a - b for a, b in zip(p, self.c)]
        depth = sum(a * b for a, b in zip(v, self.f))
        if depth <= 10:
            return None
        x = sum(a * b for a, b in zip(v, self.r)) / depth / self.tx
        y = sum(a * b for a, b in zip(v, self.u)) / depth / self.ty
        return None if abs(x) > 1 or abs(y) > 1 else ((x + 1) * self.res[0] / 2, (1 - y) * self.res[1] / 2)


def _ray_tri(o, d, tri, tmax):
    """Moller and Trumbore's ray-triangle test: the hit parameter along o + t d for 0 < t < tmax, or None."""
    a, b, c = tri
    e1 = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    e2 = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    p = (d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0])
    det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]
    if -1e-9 < det < 1e-9:
        return None
    inv = 1. / det
    s = (o[0] - a[0], o[1] - a[1], o[2] - a[2])
    u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv
    if u < 0. or u > 1.:
        return None
    q = (s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0])
    v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv
    if v < 0. or u + v > 1.:
        return None
    t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv
    return t if 0. < t < tmax else None


class Occluders:
    """Triangles in a uniform 2D grid, walked cell by cell along a sight line (Amanatides and Woo's traversal)."""

    def __init__(self, box, cell=150.):
        self.box, self.cell = box, cell
        self.tris, self.ranges, self.cells, self.tags, self.tag, self.hit = [], [], {}, [], None, None

    def add(self, tri):
        xs, ys, zs = [p[0] for p in tri], [p[1] for p in tri], [p[2] for p in tri]
        if max(xs) < self.box[0] or min(xs) > self.box[2] or max(ys) < self.box[1] or min(ys) > self.box[3]:
            return
        i = len(self.tris)
        self.tris.append(tri)
        self.tags.append(self.tag)
        self.ranges.append((min(zs), max(zs)))
        c = self.cell
        for gx in range(math.floor(min(xs) / c), math.floor(max(xs) / c) + 1):
            for gy in range(math.floor(min(ys) / c), math.floor(max(ys) / c) + 1):
                self.cells.setdefault((gx, gy), []).append(i)

    def add_obj(self, path):
        vs = []
        for line in Path(path).read_text().splitlines():
            if line.startswith('v '):
                x, y, z = (float(v) for v in line.split()[1:4])
                vs.append((x, -y, z))
            elif line.startswith('f '):
                idx = [int(t.split('/')[0]) - 1 for t in line.split()[1:]]
                for k in range(1, len(idx) - 1):
                    self.add((vs[idx[0]], vs[idx[k]], vs[idx[k + 1]]))

    def add_prism(self, poly, z0, z1):
        lo, hi = [(p[0], p[1], z0) for p in poly], [(p[0], p[1], z1) for p in poly]
        for k in range(len(poly)):
            j = (k + 1) % len(poly)
            self.add((lo[k], lo[j], hi[j]))
            self.add((lo[k], hi[j], hi[k]))
        for k in range(1, len(poly) - 1):
            self.add((hi[0], hi[k], hi[k + 1]))
            self.add((lo[0], lo[k], lo[k + 1]))

    def blocked(self, o, p, skip_end=4.):
        d = (p[0] - o[0], p[1] - o[1], p[2] - o[2])
        tmax = 1. - skip_end / math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
        c = self.cell
        gx, gy = math.floor(o[0] / c), math.floor(o[1] / c)
        ex, ey = math.floor(p[0] / c), math.floor(p[1] / c)
        sx, sy = (1 if d[0] > 0 else -1), (1 if d[1] > 0 else -1)
        step_x = abs(c / d[0]) if d[0] else math.inf
        step_y = abs(c / d[1]) if d[1] else math.inf
        next_x = ((gx + (sx > 0)) * c - o[0]) / d[0] if d[0] else math.inf
        next_y = ((gy + (sy > 0)) * c - o[1]) / d[1] if d[1] else math.inf
        seen, t0 = set(), 0.
        while True:
            t1 = min(next_x, next_y, 1.)
            za, zb = sorted((o[2] + d[2] * t0, o[2] + d[2] * t1))
            for i in self.cells.get((gx, gy), ()):
                if i in seen or self.ranges[i][0] > zb + 1 or self.ranges[i][1] < za - 1:
                    continue
                seen.add(i)
                if _ray_tri(o, d, self.tris[i], tmax) is not None:
                    self.hit = self.tags[i]
                    return True
            if (gx, gy) == (ex, ey) or t1 >= 1.:
                return False
            t0 = t1
            if next_x < next_y:
                gx, next_x = gx + sx, next_x + step_x
            else:
                gy, next_y = gy + sy, next_y + step_y


def _tree_occluders(world, occ, box):
    """The trees as the game draws them: the Plex yard trees on the Trees species meshes with the apply step's
    transforms (plan_trees), bark and every leaf card taken as opaque (the cards are masked, so this hides more than
    the game does), and the mapped trees, for which the norway_maple mesh stands in at the preview's height."""
    rows, kinds = apply_replica.load_yard_trees(replica.ROOT), apply_replica.load_tree_kinds(replica.ROOT)
    if not kinds:
        return 0
    meshes = {}

    def mesh(species):
        if species not in meshes:
            vs, fs = [], []
            for line in (replica.OUT / kinds[species]['obj']).read_text().splitlines():
                if line.startswith('v '):
                    x, y, z = (float(v) for v in line.split()[1:4])
                    vs.append((x, -y, z))           # the props convention: Unreal-local (x, -y_file, z)
                elif line.startswith('f '):
                    fs.append([int(t.split('/')[0]) - 1 for t in line.split()[1:]])
            meshes[species] = (vs, fs)
        return meshes[species]

    def place(species, position, yaw, scale):
        x, y, z = position
        if not (box[0] - 1500 <= x <= box[2] + 1500 and box[1] - 1500 <= y <= box[3] + 1500):
            return 0
        vs, fs = mesh(species)
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        w = [(x + a * scale[0] * c - b * scale[1] * s, y + a * scale[0] * s + b * scale[1] * c, z + h * scale[2])
             for a, b, h in vs]
        occ.tag = 'tree ' + species
        for f in fs:
            for k in range(1, len(f) - 1):
                occ.add((w[f[0]], w[f[k]], w[f[k + 1]]))
        return 1
    count = 0
    for group in apply_replica.plan_trees(rows or [], kinds):
        for position, yaw, scale in group['transforms']:
            count += place(group['kind'], position, yaw, scale)
    stand_in = kinds['norway_maple']['height_cm']
    for node, (x, y) in replica.mapped_trees(world):
        k = (650. + int(node) % 500) / stand_in
        count += place('norway_maple', (x, y, 0.), int(node) % 360, (k, k, k))
    return count


def rope_point(rope, s):
    """The point s cm (horizontally) along a recorded rope: the catenary z = z_a + c (cosh((s - m) / c) - cosh(m / c))
    from its record (catenary_cm c, vertex_cm m)."""
    a, b = rope['from'], rope['to']
    t = s / math.dist(a[:2], b[:2])
    c, m = rope['catenary_cm'], rope['vertex_cm']
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + c * (math.cosh((s - m) / c) - math.cosh(m / c)))


def _strand(line, k, count):
    """Point k of count along a laundry line's lower strand (the one the washing hangs from), 4 cm under the
    pulleys, as its catenary record describes it."""
    rope = line['rope']
    return rope_point(rope, math.dist(rope['from'][:2], rope['to'][:2]) * k / count)


def _washing_points(line):
    """The middle of each garment on a line, half its drop under the rope."""
    out = []
    for g in line.get('washing') or ():
        p = rope_point(line['rope'], g['from_cm'] + g['width_cm'] / 2)
        out.append((p[0], p[1], p[2] - g['drop_cm'] / 2))
    return out


def check_laundry_view(world, out, view=LAUNDRY_VIEW, reach=6000.):
    """At least one laundry line is in sight of the preview's ruelle camera: points along each line in frame are
    tested for a clear sight line through the game's own geometry: the Plex layer (all but the Collision_Only walls),
    the Streets and Soul layers just built (all but the laundry itself), the props of both placement layers (their
    collider boxes, else their bounds) and the trees (_tree_occluders). The cards of the masked materials (balusters,
    lattice, fence boards, leaves) count as solid, so a line seen here is seen in the game. One such line stands
    within VIEW_NEAR of the camera with washing on it in sight (the middle of a garment), every point of it in sight
    over its lot's fence top: the local review found the nearest lines 28 to 48 m out, behind the tree crowns."""
    spec = preview_view(view)
    cam = ViewCamera(*spec['camera'], spec.get('fov', 85.))
    lane = json.loads((out / 'Soul/lane_life.json').read_text())
    lines = []
    for i, line in enumerate(lane['laundry']['lines']):
        pts = [_strand(line, k, VIEW_SAMPLES) for k in range(VIEW_SAMPLES + 1)]
        if any(math.dist(p[:2], cam.c[:2]) <= reach and cam.pixel(p) for p in pts):
            lines.append((i, line, pts))
    assert lines, f'no laundry line in frame of the {view} camera'
    xs = [p[0] for _, _, pts in lines for p in pts] + [cam.c[0]]
    ys = [p[1] for _, _, pts in lines for p in pts] + [cam.c[1]]
    box = (min(xs) - 50, min(ys) - 50, max(xs) + 50, max(ys) + 50)
    occ = Occluders(box)
    for folder in (replica.OUT / 'Plex', out / 'Streets', out / 'Soul'):
        manifest = json.loads((folder / 'manifest.json').read_text())
        for batch in manifest['batches']:
            b = batch['bounds_cm']
            if batch['material'] in ('Collision_Only',) + LAUNDRY_KEYS or \
                    b[3] < box[0] or b[0] > box[2] or b[4] < box[1] or b[1] > box[3]:
                continue
            occ.tag = f'{folder.name} {batch["material"]}'
            occ.add_obj(folder / batch['file'])
    info = replica.props_info()
    for layer in ('Furniture', 'Soul'):
        for row in json.loads((out / layer / 'placements.json').read_text())['placements']:
            p, yaw, prop = row['position'], row['yaw'], row['prop']
            if not (box[0] - 300 <= p[0] <= box[2] + 300 and box[1] - 300 <= p[1] <= box[3] + 300):
                continue
            occ.tag = 'prop ' + prop
            boxes = info.get('colliders', {}).get(prop) or []
            for (cx, cy, cz), (sx, sy, sz) in boxes:
                poly = [replica.local_to_world(p[:2], yaw, (cx + ax * sx / 2, cy + ay * sy / 2))
                        for ax, ay in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
                occ.add_prism(poly, p[2] + cz - sz / 2, p[2] + cz + sz / 2)
            if not boxes and prop in info['bounds']:
                b = info['bounds'][prop]
                occ.add_prism(replica._prop_poly(prop, p[:2], yaw), p[2] + b[2], p[2] + b[5])
    trees = _tree_occluders(world, occ, box)
    fences = {str(f['id']): ((f.get('rear') or {}).get('fence') or {}).get('height_cm') or 0.
              for f in json.loads(replica.PLEX_FRONTS.read_text())['fronts']}
    seen = []
    for i, line, pts in lines:
        visible = [p for p in pts if cam.pixel(p) and not occ.blocked(cam.c, p)]
        px = [cam.pixel(p) for p in visible]
        span = max((math.dist(a, b) for a in px for b in px), default=0.)
        washing = [w for w in _washing_points(line) if cam.pixel(w) and not occ.blocked(cam.c, w)]
        near = min((math.dist(p[:2], cam.c[:2]) for p in visible), default=math.inf)
        seen.append({'line': i, 'lot': line['lot'], 'deck_z': line['deck_z'], 'in_sight': len(visible),
                     'points': len(pts), 'pixel_span': round(span), 'garments': line['garments'],
                     'garments_in_sight': len(washing), 'nearest_in_sight_m': round(near / 100, 1),
                     'over_fence_cm': round(min((p[2] for p in visible), default=0.) - fences[line['lot']]),
                     'distance_m': round(math.dist(pts[len(pts) // 2][:2], cam.c[:2]) / 100, 1)})
    good = [s for s in seen if s['in_sight'] >= VIEW_SEEN[0] * s['points'] and s['pixel_span'] >= VIEW_SEEN[1]]
    assert good, ('no laundry line in sight of the ' + view + ' camera', seen)
    near = [s for s in good if s['nearest_in_sight_m'] * 100 <= VIEW_NEAR and s['garments_in_sight'] and
            s['over_fence_cm'] > 0]
    assert near, (f'no line with washing in sight within {VIEW_NEAR / 100:.0f} m of the {view} camera, over the fences',
                  seen)
    return {'view': view, 'camera_cm': [round(v) for v in cam.c], 'occluders': len(occ.tris), 'trees': trees,
            'lines_in_frame': len(lines), 'lines_in_sight': len(good),
            'nearest_in_sight': min(near, key=lambda s: s['nearest_in_sight_m'])}


def check_washing(out, soul):
    """The washing hangs on its rope (the local review found sheets as stiff white boards). Each line's lower strand is
    the catenary its record names: through both pulleys 4 cm under them, sagging sag_cm at mid-span, as long as its
    arc. Each garment is a Cloth_Laundry strip (no one-colour cloth_* boards) of three quads or more on one cell of the
    laundry atlas: its top vertices on the rope as drawn (on the line's vertical plane, the card's top .8 cm over the
    rope), its hem vertices plumb under them but folded in front of and behind that plane."""
    R, A = replica, apply_replica
    mats = soul['materials']
    assert not [k for k in mats if k.startswith('cloth_')] and 'Cloth_Laundry' in mats, sorted(mats)
    assert A.texture_set('Cloth_Laundry', mats['Cloth_Laundry']) == 'laundry'
    cells = json.loads((R.OUT / 'Textures/textures.json').read_text())['sets']['laundry']['layout']['cells']
    lines = json.loads((out / 'Soul/lane_life.json').read_text())['laundry']['lines']
    grid, quads, kinds = R.Grid(1000.), 0, set()
    for i, line in enumerate(lines):
        rope, a, e = line['rope'], line['anchor'], line['end']
        f, t = rope['from'], rope['to']
        assert math.dist(f, (a[0], a[1], a[2] - 4)) < .02 and math.dist(t, (e[0], e[1], e[2] - 4)) < .02, line
        span = math.dist(f[:2], t[:2])
        assert abs(rope_point(rope, 0.)[2] - f[2]) < .05 and abs(rope_point(rope, span)[2] - t[2]) < .05, rope
        assert abs((f[2] + t[2]) / 2 - rope_point(rope, span / 2)[2] - line['sag_cm']) < .05, line
        arc = sum(math.dist(rope_point(rope, span * k / 400), rope_point(rope, span * (k + 1) / 400)) for k in range(400))
        assert abs(arc - rope['length_cm']) < .2, (arc, rope)
        assert .015 * span <= line['sag_cm'] <= .035 * span, line
        end = -math.inf
        for g in line['washing']:
            cell = cells[g['cell']]
            assert abs(g['width_cm'] - cell['garment_cm'][0]) < .01 and g['quads'] >= 3, g
            assert g['from_cm'] >= end and g['from_cm'] + g['width_cm'] <= span - 60 + .01, (g, span)
            end = g['from_cm'] + g['width_cm']
            quads += g['quads']
            kinds.add(cell['kind'])
        assert line['garments'] == len(line['washing'])
        grid.add(i, R.bbox([f, t], 20))
    assert kinds >= {'sheet', 'towel', 'shirt', 'tshirt', 'jeans', 'pillowcase'}, kinds

    def on_rope(p):
        """(distance off the line's vertical plane, height over its rope) of the line nearest p (plane, then height)."""
        best = None
        for i in grid.query(R.bbox([p], 10)):
            rope = lines[i]['rope']
            f, t = rope['from'], rope['to']
            span = math.dist(f[:2], t[:2])
            u = ((t[0] - f[0]) / span, (t[1] - f[1]) / span)
            along = (p[0] - f[0]) * u[0] + (p[1] - f[1]) * u[1]
            if not -3 <= along <= span + 3:
                continue
            off = abs((p[0] - f[0]) * u[1] - (p[1] - f[1]) * u[0])
            dz = p[2] - rope_point(rope, along)[2]
            key = (round(off, 1), abs(dz - R.PEG_UP))
            if best is None or key < best[0]:
                best = (key, off, dz)
        return best and best[1:]
    tris, tops, folded, hems = 0, 0, 0, 0
    pad = 8 / 1024
    for batch in soul['batches']:
        if batch['material'] != 'Cloth_Laundry':
            continue
        for face in parse_obj_uv(out / 'Soul' / batch['file']):
            tris += 1
            cu = sum(uv[0] for _, uv in face) / 3
            cv = sum(uv[1] for _, uv in face) / 3
            name = next((n for n, c in cells.items() if c['uv'][0] <= cu <= c['uv'][2] and c['uv'][1] <= cv <= c['uv'][3]),
                        None)
            assert name, ('a garment face on no atlas cell', face)
            u0, v0, u1, v1 = cells[name]['uv']
            for p, (u, v) in face:
                assert u0 - 1e-4 <= u <= u1 + 1e-4 and v0 - 1e-4 <= v <= v1 + pad, ('UV off its atlas cell', name, u, v)
                hit = on_rope(p)
                assert hit, ('a garment vertex off every line', p)
                off, dz = hit
                if v > v1 - 1e-4:
                    tops += 1
                    assert off < .5 and abs(dz - R.PEG_UP) <= 1.2, ('a garment top off its rope', p, off, dz)
                else:
                    hems += 1
                    folded += off >= 1.
                    assert off <= 9. and -(cells[name]['garment_cm'][1] + R.HEM_FREE) - 1.5 <= dz < -20, (p, off, dz)
    assert tris == 2 * quads and tops and folded >= .5 * hems, (tris, quads, tops, folded, hems)
    return {'lines': len(lines), 'garments': sum(len(l['washing']) for l in lines), 'quads': quads,
            'kinds': sorted(kinds), 'hem_vertices_folded': round(folded / hems, 2),
            'sag_cm': [min(l['sag_cm'] for l in lines), max(l['sag_cm'] for l in lines)]}


# ------------------------------------------------------------------------------------------------
# Fifth pass: the washing clear of the trees, and the leaf litter of late October

CROWN_KEEP, TRUNK_KEEP = .7, 150.   # the local review: no washing in this share of a crown, nor this near a trunk
LITTER_KEYS = ('leaf_gold', 'leaf_rust', 'leaf_brown')   # the flat one-colour leaf polygons the litter replaced
LITTER_TRIANGLES = 100000           # the litter's share of the Soul layer's 300,000 triangles (70,000 before the fine
                                    # outlines, the fringe and the ruelle litter of the fifth pass's repair)
LITTER_GAP = (.2, .8)               # cm a litter vertex lies over the ground under it


def drawn_crowns(street_rows):
    """Every crown the game draws, as (x, y, ground z, radius, crown base, top): the Plex yard trees (load_yard_trees)
    and the street and park trees (street_rows, as street_trees.json holds them) on their species meshes at the apply
    step's own scale (plan_trees, street_tree_scale): the radius half the mesh's crown width, its base and top the
    mesh's, scaled (Trees/manifest.json). Independent of plateau_replica's mirror of that scaling."""
    A = apply_replica
    kinds = json.loads((replica.OUT / 'Trees/manifest.json').read_text())['kinds']
    out = []
    for row in A.load_yard_trees(replica.ROOT) or []:
        mesh = kinds[row['species']]
        s = row['height_cm'] / mesh['height_cm']
        out.append((*row['position'], mesh['crown_width_cm'] / 2 * s, mesh['crown_base_cm'] * s, row['height_cm']))
    for row in street_rows:
        kind = kinds[row['kind']]
        variant, (sxy, _, sz) = A.street_tree_scale(row, kind)
        mesh = kind[variant] if variant else kind
        out.append((row['x_cm'], row['y_cm'], row['z_cm'], mesh['crown_width_cm'] / 2 * sxy,
                    mesh['crown_base_cm'] * sz, mesh['height_cm'] * sz))
    return out


def crown_index(trees):
    """(x, y) -> the first tree whose inner crown (CROWN_KEEP of its radius, base to top) the band z_lo..z_hi over it
    enters, or whose trunk stands within TRUNK_KEEP, as (distance, radius, base, top); None when clear."""
    grid = replica.Grid(2000.)
    for i, t in enumerate(trees):
        grid.add(i, replica.bbox([t[:2]], max(CROWN_KEEP * t[3], TRUNK_KEEP)))

    def inside(p, z_lo, z_hi):
        for i in grid.query((p[0], p[1], p[0], p[1])):
            x, y, z, radius, base, top = trees[i]
            d = math.dist(p[:2], (x, y))
            if (d < TRUNK_KEEP and z_lo < z + top) or (d < CROWN_KEEP * radius and z_hi > z + base and z_lo < z + top):
                return round(d), round(radius), round(z + base), round(z + top)
        return None
    return inside


def check_crown_scaling():
    """plateau_replica's crowns stand where the apply step stands the trees: its mirror of street_tree_scale and of the
    yard rows' scale gives the apply step's mesh and scale on every street_trees.json row."""
    R, A = replica, apply_replica
    assert (R.TREE_SCALE, R.YOUNG_SCALE, R.YOUNG_BELOW, R.CROWN_SPREAD) == \
        (A.TREE_SCALE, A.YOUNG_SCALE, A.YOUNG_BELOW, A.CROWN_SPREAD)
    assert R.YARD_TREE_MESH_CM == A.TREE_MESH_HEIGHT_CM and R.YARD_TREE_ALIASES == A.TREE_ALIASES
    kinds = R.tree_kinds()
    rows = json.loads((R.OUT / 'Streets/street_trees.json').read_text())['trees']
    for row in rows:
        variant, (sxy, _, sz) = A.street_tree_scale(row, kinds[row['kind']])
        mesh, rxy, rz = R.street_tree_mesh(row, kinds[row['kind']])
        assert mesh is (kinds[row['kind']][variant] if variant else kinds[row['kind']]) and (rxy, rz) == (sxy, sz), \
            (row['id'], variant, sxy, sz, rxy, rz)
    return {'rows': len(rows)}


def check_laundry_crowns(out):
    """No washing in a tree. The local review found 180 of the 295 lines with washing strung through yard-tree crowns
    and 92 within 1.5 m of a trunk. Every rope point, and every garment from its top on the rope to its hem at its
    edges and quarters, keeps out of every crown the game draws (CROWN_KEEP of the radius, from the crown base to the
    top) and TRUNK_KEEP from every trunk. Lines with washing still hang in many yards."""
    lane = json.loads((out / 'Soul/lane_life.json').read_text())
    inside = crown_index(drawn_crowns(json.loads((out / 'Streets/street_trees.json').read_text())['trees']))
    bad, points, garments = [], 0, 0
    for line in lane['laundry']['lines']:
        rope = line['rope']
        span = math.dist(rope['from'][:2], rope['to'][:2])
        for k in range(VIEW_SAMPLES + 1):
            p = rope_point(rope, span * k / VIEW_SAMPLES)
            points += 1
            hit = inside(p, p[2], p[2] + 8.)
            if hit:
                bad.append(('rope', line['lot'], line['deck_z'], hit))
        for g in line['washing']:
            garments += 1
            for f in (0., .25, .5, .75, 1.):
                p = rope_point(rope, g['from_cm'] + g['width_cm'] * f)
                hit = inside(p, p[2] - g['drop_cm'], p[2])
                if hit:
                    bad.append(('garment', line['lot'], line['deck_z'], g['cell'], hit))
    assert not bad, (f'{len(bad)} rope points or garments in a tree', bad[:6])
    loaded = sum(1 for line in lane['laundry']['lines'] if line['washing'])
    counts = lane['counts']
    assert loaded >= 100 and garments >= 400 and counts['laundry_modules_under_trees'] > 0, (loaded, garments, counts)
    return {'lines': len(lane['laundry']['lines']), 'lines_with_washing': loaded, 'garments': garments,
            'rope_points': points, 'modules_under_trees': counts['laundry_modules_under_trees'],
            'lines_left_in_trees': counts['laundry_lines_left_in_trees']}


def check_laundry_crown_fixture():
    """A tree beside the yard: where the module's first spot would string its line through the crown, the line moves
    to a later spot clear of it. A yard under a grove hangs no washing."""
    R = replica
    world = FixtureWorld()
    report = {}

    def run(lot_id, crowns):
        plex = R.PlexYards({'fronts': [_fixture_rear(lot_id)]}, world)
        S, lane = R.Layer('Soul', R.SOUL_MATERIALS), {}
        counts = {k: 0 for k in R.LANE_COUNTS}
        R.lane_laundry(world, plex, S, lane, counts, crowns)
        return lane['laundry'], counts
    tree = (-150., -600., 0., 400., 150., 1400.)
    inside = crown_index([tree])
    crowns = R.Crowns()
    crowns.add(*tree)
    moved = None
    for n in range(60):
        open_, _ = run(f'tree-{n}', R.Crowns())
        if not open_['lines'] or not any(inside(_strand(line, k, 20), -1e9, 1e9) for line in open_['lines']
                                         for k in range(21)):
            continue
        near, counts = run(f'tree-{n}', crowns)
        if near['lines']:
            moved = (open_, near, counts)
            break
    assert moved, 'no fixture lot whose first line crosses the crown and moves'
    open_, near, counts = moved
    for line in near['lines']:
        for k in range(21):
            p = _strand(line, k, 20)
            drop = max((g['drop_cm'] for g in line['washing']), default=0.)
            assert not inside(p, p[2] - drop, p[2] + 8.), ('a moved line still in the crown', line['anchor'], p)
    assert near['poles'][0]['position'] != open_['poles'][0]['position']
    report['moved_pole_cm'] = round(math.dist(near['poles'][0]['position'], open_['poles'][0]['position']))
    grove = R.Crowns()
    for x in (-300., 100., 500., 900.):
        for y in (-400., -800.):
            grove.add(x, y, 0., 600., 150., 1500.)
    for n in range(40):
        lines, counts = run(f'grove-{n}', grove)
        assert not lines['lines'] and not lines['poles'], 'washing under a grove'
        if counts['laundry_modules_under_trees']:
            report['grove'] = counts['laundry_modules_under_trees']
            break
    assert report.get('grove') == 1, report
    return report


def litter_ground(out, streets):
    """p -> the height of the ground under a litter point: the highest Streets face (its plane at p) no more than 1 cm
    over it, else the park lawn (BaseGeometry/Grass.obj) where no path, pond, court or old road covers it; and the
    highest Streets face over it, if any (which would hide it)."""
    tris, grid = [], replica.Grid(500.)
    for batch in streets['batches']:
        for face in parse_obj(out / 'Streets' / batch['file'])[1]:
            n = _normal(face)
            if abs(n[2]) < .3 * math.sqrt(sum(c * c for c in n)):
                continue                                    # walls, curb faces, cards
            grid.add(len(tris), replica.bbox(face))
            tris.append(face)
    lawn = replica.LitterGround(type('W', (), {})())

    def plane(t, p):
        (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = t
        det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
        a = ((y2 - y3) * (p[0] - x3) + (x3 - x2) * (p[1] - y3)) / det
        b = ((y3 - y1) * (p[0] - x3) + (x1 - x3) * (p[1] - y3)) / det
        return a * z1 + b * z2 + (1. - a - b) * z3

    def at(p):
        under, over = None, None
        for i in grid.query((p[0], p[1], p[0], p[1])):
            t = tris[i]
            if _tri_contains([q[:2] for q in t], p):
                z = plane(t, p)
                if z <= p[2] + 1.:
                    under = z if under is None else max(under, z)
                else:
                    over = z if over is None else max(over, z)
        if under is None and lawn._top(lawn.covers, p) is None:
            under = lawn._top(lawn.lawn, p)
        return under, over
    return at


def check_leaf_litter(world, out, soul, streets):
    """Late-October leaf litter. The local review found the drifts flat one-colour polygons that read as paint, and the
    lawns and sidewalks under full crowns spotless. Now: no leaf_* key is left and every drift and patch is the masked
    Leaf_Litter set on world metre UVs; each litter vertex lies just over the ground under it (never floating over a
    curb drop or sunk under a slab); a patch lies under nearly every street and park crown, its outline ragged; the
    cover follows each kind's leaf fall (1 - leaf_retention, Trees/manifest.json); drifts line the curbs and the
    ruelle gutters; the litter stays within its share of the Soul budget."""
    R, A = replica, apply_replica
    mats = soul['materials']
    assert not set(LITTER_KEYS) & set(mats) and 'Leaf_Litter' in mats, sorted(mats)
    assert A.texture_set('Leaf_Litter', mats['Leaf_Litter']) == 'leaf_litter'
    assert mats['Leaf_Litter']['base_color_srgb'] == '#96733d', mats['Leaf_Litter']
    batches = [b for b in soul['batches'] if b['material'] == 'Leaf_Litter']
    tris = sum(b['triangles'] for b in batches)
    assert 0 < tris <= LITTER_TRIANGLES and len(batches) <= 20 and soul['counts']['triangles'] < 300000, \
        (tris, len(batches), soul['counts']['triangles'])
    assert soul['counts']['litter_triangles'] == tris, (soul['counts']['litter_triangles'], tris)
    at = litter_ground(out, streets)
    curbs, curb_grid = [], R.Grid(500.)
    for batch in streets['batches']:
        if batch['material'] == 'curb':
            for face in parse_obj(out / 'Streets' / batch['file'])[1]:
                for a, b in zip(face, face[1:] + face[:1]):
                    curb_grid.add(len(curbs), R.bbox([a, b], 100.))
                    curbs.append((a[:2], b[:2]))
    curb = lambda p: min((R.seg_dist(p, *curbs[i]) for i in curb_grid.query((p[0], p[1], p[0], p[1]))),  # noqa: E731
                         default=1e9)
    in_gutter = lambda z: R.gutter_z(0.) + R.LITTER_LIFT - .01 <= z <= R.Z_ALLEY + R.LITTER_LIFT + .01   # noqa: E731
    alleys = R.AlleyIndex(world)
    faces, drawn, gaps, hidden = [], 0., [], 0
    road, gutter, uv_worst = 0, 0, 0.
    for batch in batches:
        for face in parse_obj_uv(out / 'Soul' / batch['file']):
            pts = [q for q, _ in face]
            for q, (u, v) in face:
                uv_worst = max(uv_worst, abs(u - q[0] / 100.), abs(v - q[1] / 100.))
            drawn += abs(R.area([q[:2] for q in pts]))
            faces.append(pts)
            c = tuple(sum(q[i] for q in pts) / 3 for i in range(3))
            for q in pts + [c]:
                under, over = at(q)
                assert under is not None, ('litter over no ground', q)
                gaps.append(q[2] - under)
                hidden += over is not None
                assert LITTER_GAP[0] <= q[2] - under <= LITTER_GAP[1], ('litter off its ground', q, under)
            if abs(c[2] - R.Z_LITTER_ROAD) < .01:
                road += 1
                assert curb(c) <= 100., ('a curb drift away from the curb', c)
            elif in_gutter(c[2]):
                gutter += 1
                hit = alleys.nearest(c, 50.)
                assert hit and hit[0] <= R.GUTTER_HALF + 1., ('a ruelle drift off the gutter', c)
    assert uv_worst < 2e-4, ('litter UVs off world metres', uv_worst)
    assert hidden <= .005 * len(gaps), ('litter under a slab', hidden, len(gaps))
    record = soul['leaf_litter']
    kinds = R.tree_kinds()
    for kind, rec in record['kinds'].items():
        fallen = 1. - kinds[kind]['leaf_retention']
        assert abs(rec['fallen'] - fallen) < 1e-3 and \
            abs(rec['cover'] - min(R.LITTER_COVER, R.LITTER_GAIN * fallen)) < 1e-3, (kind, rec)
    order = sorted(record['kinds'].values(), key=lambda r: r['fallen'])
    assert all(a['cover'] <= b['cover'] for a, b in zip(order, order[1:])) and order[0]['cover'] < order[-1]['cover']
    total = sum(r['drawn_m2'] for r in record['kinds'].values()) + record['curb_drifts_m2'] + record['ruelle_drifts_m2'] + \
        record['yard_trees_over_ruelles']['drawn_m2']
    assert abs(total - drawn / 1e4) <= .005 * total + 1., (total, drawn / 1e4)
    assert soul['counts']['gutter_leaf_drifts'] >= 600 and road >= 4 * soul['counts']['gutter_leaf_drifts'], road
    assert soul['counts']['ruelle_gutter_leaf_drifts'] > 100 and gutter > 1000, gutter
    # a patch under nearly every street and park crown
    grid = R.Grid(500.)
    for i, f in enumerate(faces):
        grid.add(i, R.bbox(f))
    rows = json.loads((out / 'Streets/street_trees.json').read_text())['trees']
    crowns = drawn_crowns(rows)[-len(rows):]
    under = 0
    for x, y, z, radius, base, top in crowns:
        reach = max(150., .7 * radius)
        under += any(math.dist(q[:2], (x, y)) <= reach for i in grid.query(R.bbox([(x, y)], reach)) for q in faces[i])
    assert under >= .9 * len(rows), (under, len(rows))
    # the patches are ragged fans: grouped by their centre (each face's last vertex, as obj_text writes a fan)
    fans = {}
    for f in faces:
        if abs(f[2][2] - R.Z_LITTER_ROAD) > .01 and not in_gutter(f[2][2]):
            fans.setdefault(tuple(round(v, 2) for v in f[2]), set()).update(tuple(round(v, 2) for v in q) for q in f[:2])
    spreads, small = [], 0
    for c, ring in fans.items():
        radii = [math.dist(c[:2], q[:2]) for q in ring]
        small += len(ring) < min(R.LITTER_RING[0], R.LITTER_FRINGE_RING)
        spreads.append((max(radii) - min(radii)) / (sum(radii) / len(radii)))
    spreads.sort()
    assert small == 0 and len(fans) >= .85 * len(rows) and spreads[len(spreads) // 2] >= .25, \
        (small, len(fans), spreads[len(spreads) // 2])
    return {'triangles': tris, 'batches': len(batches), 'litter_m2': round(drawn / 1e4), 'tree_patches': len(fans),
            'crowns_with_litter': f'{under} of {len(rows)}', 'curb_drift_faces': road, 'ruelle_drift_faces': gutter,
            'gap_cm': [round(min(gaps), 3), round(max(gaps), 3)], 'median_outline_spread': round(spreads[len(spreads) // 2], 2),
            'cover_by_kind': {k: r['cover'] for k, r in record['kinds'].items()}}


PARK_LEAVES = replica.ROOT / 'Data/Plateau/ParkGeometry'
PARK_LEAF_GAP = .05           # cm: a park leaf (rim and rib) stays at least this far under the litter lying over it


def check_city_poles(world, furniture_rows):
    """The residential streets' lights and wooden poles come from the city's sign-pole clip (sign_poles.json, CC BY
    4.0): every wooden street pole is a utility pole with a cobra head over the street (unless an OSM lamp stands
    there) and every steel one a cobra-head light; the junction's street-name blades, ARRÊT and one-way signs hang on
    the city pole that carries them, with no post of their own and no collision, stacked clear of the pole. The local
    review found no light within 204 m of the Mentana camera and the Mentana and Napoléon blades on a short post 1.2 m
    from the city's wooden pole 65496, which carries them."""
    R = replica
    clip = json.loads(R.SIGN_POLES.read_text())
    assert clip['source']['licence'] == 'CC BY 4.0' and 'Ville de Montréal' in clip['source']['attribution']
    assert clip['count'] == len(clip['poles']) > 1000 and all(
        R.inside((float(r['LATITUDE']), float(r['LONGITUDE']))) for r in clip['poles'])
    kinds = {r['POTEAU_ID_POT']: R.POLE_KINDS.get(r['DESCRIPTION_RTP']) for r in clip['poles']}
    city = [r for r in furniture_rows if 'city_pole' in r]
    wood = {r['city_pole']: r for r in city if r['prop'] == 'utility_pole'}
    heads = {r['city_pole']: r for r in city if r['prop'] == 'lamp_cobra' and r.get('mount') == 'utility_pole'}
    steel = {r['city_pole']: r for r in city if r['prop'] == 'lamp_cobra' and 'mount' not in r}
    hung = [r for r in city if r.get('mount') == 'city_pole']
    assert len(wood) >= 100 and len(steel) >= 100 and len(heads) >= .8 * len(wood), (len(wood), len(steel), len(heads))
    assert all(kinds[i] == 'wood' for i in wood) and all(kinds[i] == 'steel' for i in steel)
    lamps = [tuple(r['position'][:2]) for r in furniture_rows if r['prop'] in ('lamp_cobra', 'lamp_park') and 'osm_node' in r]
    for i, pole in wood.items():
        if i in heads:
            head = heads[i]
            assert head['position'] == pole['position'] and head['without'] == ['pole'] and not head['collision'], head
            assert abs((head['yaw'] - pole['yaw'] - 90) % 360) < .02 or abs((head['yaw'] - pole['yaw'] - 90) % 360 - 360) < .02
        else:
            assert any(math.dist(pole['position'][:2], q) < R.CITY_LAMP_SAME + 50 for q in lamps), ('a dark wooden pole', i)
    # no pole or lamp collision in the traffic band, none on the carriageway, none in a tree pit
    trees = json.loads((R.OUT / 'Streets/street_trees.json').read_text())['trees'] if (R.OUT / 'Streets/street_trees.json').is_file() else []
    for r in list(wood.values()) + list(steel.values()):
        p = r['position'][:2]
        assert not R.on_pavement(world, p), ('a pole on the carriageway', r)
        if r['collision']:
            assert world.traffic_distance(p, 2000) >= R.CLEAR
        for t in trees:
            if t.get('pit') and abs(t['x_cm'] - p[0]) < 120 and abs(t['y_cm'] - p[1]) < 120:
                u = (math.cos(math.radians(t['pit_yaw_deg'])), math.sin(math.radians(t['pit_yaw_deg'])))
                along = (p[0] - t['x_cm']) * u[0] + (p[1] - t['y_cm']) * u[1]
                across = -(p[0] - t['x_cm']) * u[1] + (p[1] - t['y_cm']) * u[0]
                assert abs(along) >= R.PIT_L / 2 or abs(across) >= R.PIT_D / 2, ('a pole in a tree pit', r, t['id'])
    # hung signs: on a placed pole, off its axis, stacked, without a post or collision
    poles = {r['city_pole']: r for r in list(wood.values()) + list(steel.values())}
    for r in hung:
        pole = poles[r['city_pole']]
        d = math.dist(r['position'][:2], pole['position'][:2])
        assert R.MOUNT_OFF - .1 <= d <= R.MOUNT_OFF * math.sqrt(2) + .1 and r['without'] == ['post'] and not r['collision'], r
        assert abs(r['position'][2] - pole['position'][2] - R.MOUNT_RAISE[r['prop']]) < .02, r
        assert r['code'] in json.dumps([p['signs'] for p in clip['poles'] if p['POTEAU_ID_POT'] == r['city_pole']]), r
    # the critic's corner: the Mentana and Napoléon blades on the city's wooden pole 65496
    pole = wood.get('65496')
    blades = [r for r in furniture_rows if r['prop'] == 'sign_street' and pole
              and {r['text']['blade_a']['full'], r['text']['blade_b']['full']} == {'Rue de Mentana', 'Rue Napoléon'}
              and math.dist(r['position'][:2], pole['position'][:2]) < 1500]
    assert len(blades) == 1 and blades[0].get('city_pole') == '65496' and blades[0]['mount'] == 'city_pole', blades
    assert '65496' in wood and kinds['65496'] == 'wood' and '65496' in heads
    # light along Mentana: the wooden poles that carry its cobra heads
    mentana = [s for s in world.segs if s['name'] == 'Rue de Mentana' and not s['excluded']]
    lit = {i for i, r in heads.items() if any(R.seg_dist(r['position'][:2], s['pa'], s['pb']) < 1200 for s in mentana)}
    assert len(lit) >= 6, sorted(lit)
    return {'wooden_poles': len(wood), 'cobra_heads_on_wood': len(heads), 'steel_lamps': len(steel),
            'signs_on_poles': len(hung), 'by_sign': {k: sum(1 for r in hung if r['prop'] == k) for k in R.MOUNT_RAISE},
            'mentana_wooden_lamps': len(lit)}


def litter_fans(out, soul):
    """The Leaf_Litter fans of the Soul layer, grouped by their centre (each triangle's last vertex, as obj_text writes
    a fan): {centre: set of ring points}."""
    fans = {}
    for batch in soul['batches']:
        if batch['material'] == 'Leaf_Litter':
            for f in parse_obj(out / 'Soul' / batch['file'])[1]:
                fans.setdefault(tuple(round(v, 2) for v in f[2]), set()).update(tuple(round(v, 2) for v in q) for q in f[:2])
    return fans


def litter_ground_kind(z):
    """Which ground a litter fan lies on, from its height: the park lawn, a ruelle gutter, a ruelle's paving, a curb
    drift on the asphalt, or a sidewalk, lawn or parterre of the Streets layer."""
    R = replica
    if z < 6.:
        return 'park'
    if abs(z - R.Z_ALLEY - R.LITTER_LANE) < .01:
        return 'lane'
    if abs(z - R.Z_LITTER_ROAD) < .01:
        return 'road'
    if R.gutter_z(0.) + R.LITTER_LIFT - .01 <= z <= R.Z_ALLEY + R.LITTER_LIFT + .01:
        return 'gutter'
    return 'street'


def check_litter_edges(out, soul):
    """The local review saw the street patches as cut rugs: 1.6 to 2 m straight sides, the leaves stopping dead at the
    outline. A patch on a sidewalk, a lawn, a parterre or a ruelle now has a point every LITTER_EDGE_FINE cm round a
    serrated outline, and small clumps of leaves (LITTER_FRINGE) lie just outside it, more and bigger near the edge
    than out toward the drip line, so the litter thins out leaf clump by leaf clump."""
    R = replica
    fans = litter_fans(out, soul)
    main, fringe, outlines = [], [], []
    for c, ring in fans.items():
        if litter_ground_kind(c[2]) not in ('street', 'lane'):
            continue
        pts = sorted(ring, key=lambda q: math.atan2(q[1] - c[1], q[0] - c[0]))
        radii = [math.dist(c[:2], q[:2]) for q in pts]
        mean = sum(radii) / len(radii)
        if mean <= R.LITTER_FRINGE_SIZE[1] + 5:
            fringe.append((c, mean))
        elif mean >= 80.:
            edge = math.tau * mean / len(pts)          # outline per point (the serration makes each chord longer)
            jag = sum(abs(radii[i] - radii[i - 1]) for i in range(len(radii))) / len(radii) / mean
            main.append((c, mean, edge, jag, len(pts)))
            outlines.append([q[:2] for q in pts])
    edges = sorted(m[2] for m in main)
    jags = sorted(m[3] for m in main)
    assert len(main) > 500 and edges[len(edges) // 2] <= R.LITTER_EDGE_FINE + 15, \
        ('street patches with long straight sides', len(main), edges[len(edges) // 2] if edges else None)
    assert jags[len(jags) // 2] >= .12, ('street patch outlines without a serrated edge', jags[len(jags) // 2])
    grid = R.Grid(800.)
    for i, m in enumerate(main):
        grid.add(i, R.bbox([m[0]], 2 * m[1]))
    inner = outer = 0
    for c, r in fringe:
        # how far the clump lies outside the nearest main patch's outline, as a share of that patch's radius
        best = None
        for i in grid.query((c[0], c[1], c[0], c[1])):
            m, ring = main[i], outlines[i]
            if math.dist(c[:2], m[0][:2]) > 2 * m[1] or R.point_in(c[:2], ring):
                continue
            d = min(R.seg_dist(c[:2], a, b) for a, b in zip(ring, ring[1:] + ring[:1])) / m[1]
            best = d if best is None else min(best, d)
        if best is None:
            continue
        inner += best < R.LITTER_FRINGE_OUT / 2
        outer += best >= R.LITTER_FRINGE_OUT / 2
    assert inner + outer >= 2 * len(main) and inner > 1.5 * outer, ('no fringe thinning out the patches', inner, outer,
                                                                    len(main))
    return {'street_patches': len(main), 'median_edge_cm': round(edges[len(edges) // 2], 1),
            'median_jag': round(jags[len(jags) // 2], 3), 'fringe_clumps': len(fringe),
            'fringe_near_edge': inner, 'fringe_toward_drip_line': outer}


def check_lane_litter(world, out, soul):
    """The local review found the ruelles bare under the yard trees (a 12.7 m Norway maple over the Mentana lane) and
    no gutter drift in sight. Every yard crown that reaches a metre or more over a ruelle's paving now drops leaves on
    the paving under it (never over the sunken gutter) and, where it overhangs the gutter, into the gutter."""
    R = replica
    fans = litter_fans(out, soul)
    lane = [c for c in fans if litter_ground_kind(c[2]) == 'lane']
    gutter = [c for c in fans if litter_ground_kind(c[2]) == 'gutter']
    alleys = R.AlleyIndex(world)
    for c in lane:
        for q in fans[c] | {c}:
            hit = alleys.nearest(q, R.GUTTER_HALF + 1.)
            assert hit is None, ('lane litter over the gutter', q)
    lane_grid, gutter_grid = R.Grid(1000.), R.Grid(1000.)
    for i, c in enumerate(lane):
        lane_grid.add(i, R.bbox([c]))
    for i, c in enumerate(gutter):
        gutter_grid.add(i, R.bbox([c]))
    crowns = [row for row in R.tree_crowns(world).items if row[8] == 'yard']
    over = with_litter = over_gutter = with_drift = 0
    for x, y, z, radius, *_ in crowns:
        hit = alleys.nearest((x, y), radius + R.ALLEY_HALF)
        if hit is None or hit[0] - R.ALLEY_HALF > radius - 100.:
            continue
        over += 1
        with_litter += any(math.dist((x, y), lane[i][:2]) <= radius for i in lane_grid.query(R.bbox([(x, y)], radius)))
        if hit[0] < radius - 100.:
            over_gutter += 1
            with_drift += any(math.dist((x, y), gutter[i][:2]) <= radius + 300.
                              for i in gutter_grid.query(R.bbox([(x, y)], radius + 300.)))
    assert over > 100 and with_litter >= .8 * over, ('yard crowns over a ruelle with no leaves under them', with_litter, over)
    assert with_drift >= .8 * over_gutter, ('yard crowns over a ruelle gutter with no drift', with_drift, over_gutter)
    return {'lane_patches': len(lane), 'crowns_over_lanes': over, 'with_litter': with_litter,
            'crowns_over_gutters': over_gutter, 'with_gutter_drift': with_drift}


def check_park_leaves_under_litter(out, soul, park=PARK_LEAVES):
    """The park build (plateau_park.py) already scatters its own one-colour fallen leaves on the lawn, 2.30 to 2.38 cm
    up with a rib 0.35 cm higher. The Soul litter lies over them: every AutumnGold or AutumnRust face whose centre
    lies on a Leaf_Litter face stays at least PARK_LEAF_GAP under that face, so the two never cross or z-fight. The
    tech review found 20,927 of them crossing a litter plane at 2.4 cm."""
    tris, grid = [], replica.Grid(500.)
    for batch in soul['batches']:
        if batch['material'] != 'Leaf_Litter':
            continue
        for face in parse_obj(out / 'Soul' / batch['file'])[1]:
            for k in range(1, len(face) - 1):
                t = (face[0], face[k], face[k + 1])
                grid.add(len(tris), replica.bbox(t))
                tris.append(t)
    leaves, under, worst, bad = 0, 0, math.inf, []
    for path in sorted(park.glob('Autumn*.obj')):
        for face in parse_obj(path)[1]:
            leaves += 1
            c = (sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face))
            tops = [max(p[2] for p in tris[i]) for i in grid.query((c[0], c[1], c[0], c[1]))
                    if _tri_contains([q[:2] for q in tris[i]], c)]
            if not tops:
                continue
            under += 1
            gap = min(tops) - max(p[2] for p in face)
            worst = min(worst, gap)
            if gap < PARK_LEAF_GAP:
                bad.append((round(c[0]), round(c[1]), round(gap, 3)))
    assert leaves > 1000, ('the park leaves are missing', leaves)
    assert not bad, (f'{len(bad)} of the {under} park leaves under the litter cross it or lie within '
                     f'{PARK_LEAF_GAP} cm of it', bad[:5])
    return {'park_leaves': leaves, 'under_litter': under, 'closest_gap_cm': round(worst, 3) if under else None}


def check_gallery_life(world, out, soul, soul_rows):
    """Gallery props on the Plex decks: floor props inside the props floor (decks[].free), never in front of a door
    or at a flight's head, an AC unit in a drawn window, planters hung on the outer guard, dishes clamped to a guard
    that faces the satellite, nothing overlapping, the colliding ones with their boxes on the deck."""
    R = replica
    lane = json.loads((out / 'Soul/lane_life.json').read_text())
    rows = lane['galleries']
    placed = [r for r in soul_rows if 'gallery_of' in r]
    assert len(placed) == len(rows) == soul['counts']['gallery_props'] > 0
    plex = R.PlexYards.load(world)
    lots = {lot['id']: lot for lot in plex.lots}
    glass = R.PlexGlass()
    info = R.props_info()
    anchors = {}
    for line in lane['laundry']['lines']:
        anchors.setdefault((line['lot'], line['deck_z']), []).append(line['anchor'])
    kinds = {k: 0 for k in R.GALLERY_PROPS}
    by_deck = {}
    tol = .6
    for row, inst in zip(rows, placed):
        assert row['prop'] == inst['prop'] and row['position'] == inst['position'] and row['yaw'] == inst['yaw'], row
        assert inst['collision'] == (row['prop'] in R.GALLERY_COLLIDE), ('collision flag', row)
        kinds[row['prop']] += 1
        lot = lots[row['lot']]
        assert lot['storeys'] < 5, ('props on a steel fire escape', row)
        kind, index = row['deck']
        deck = lot['rear'][kind][index]
        F = R.deck_frame(deck)
        rects = R.deck_rects(F, deck)
        z, (x, d) = deck['z'], F.local(row['position'][:2])
        poly = R._prop_poly(row['prop'], row['position'][:2], row['yaw'])
        loc = [F.local(q) for q in poly]
        x0, x1 = min(q[0] for q in loc), max(q[0] for q in loc)
        d0, d1 = min(q[1] for q in loc), max(q[1] for q in loc)
        flights = [fl for fl in lot['rear'].get('flights') or [] if fl.get('head')]
        if row['place'] in ('floor', 'window'):
            door = F.local(deck['door'])[0]
            assert x1 <= door - 58 or x0 >= door + 58, ('in front of a gallery door', row)
            for fl in flights:
                if abs(fl['head'][2] - z) < 1:
                    assert R.poly_point_dist(poly, fl['head'][:2]) >= 40, ('at the head of a flight', row)
            by_deck.setdefault((row['lot'], kind, index), []).append((x0, x1, d0, d1, row))
        if row['place'] == 'floor':
            assert abs(row['position'][2] - z) < .01, row
            if row['prop'] == 'bike_gallery':
                # leaning on the cap rail: its top at the cap's inner face, its wheels on the props floor
                assert abs(d1 - (F.D - R.CAP_FACE - .5)) < .1, row
                assert any(r[0] - tol <= x0 and x1 <= r[1] + tol and r[2] - tol <= d0 and d <= r[3] for r in rects), row
                assert any(all(abs(F.local(q)[1] - F.D) < 2 for q in (g['a'], g['b'])) and
                           min(F.local(q)[0] for q in (g['a'], g['b'])) - 1 <= x0 and
                           x1 <= max(F.local(q)[0] for q in (g['a'], g['b'])) + 1
                           for g in lot['rear'].get('guards') or [] if abs(g['z0'] - z) < 1), ('a bike on no guard', row)
            else:
                assert any(r[0] - tol <= x0 and x1 <= r[1] + tol and r[2] - tol <= d0 and d1 <= r[3] + tol
                           for r in rects), ('off the props floor', row)
        elif row['place'] == 'window':
            assert row['prop'] == 'ac_unit' and abs(row['position'][2] - z - R.WINDOW_SILL) < .01, row
            assert abs(d + info['anchors']['ac_wall_x'] - R.WINDOW_GLASS_D - .5) < .05, ('off the glass', row)
            assert any(abs(xc - x) < .5 for xc, _ in glass.windows(F, z, x0 - 10, x1 + 10)), ('no window there', row)
        else:
            guards = [g for g in lot['rear'].get('guards') or [] if abs(g['z0'] - z) < 1]
            for fl in flights:
                a, b = (fl.get('foot') or fl['head'])[:2], fl['head'][:2]
                assert R.poly_seg_dist(poly, a, b) >= R.STAIR_CLEAR.get(fl.get('kind'), 85.) - .5, ('over a stair', row)
            assert not any(world.in_building(q) for q in poly), ('in a wall', row)
            if row['place'] == 'rail':
                assert row['prop'] == 'flower_box'
                assert abs(d + info['anchors']['flower_wall_x'] - (F.D + R.CAP_FACE + .5)) < .05, ('off the guard', row)
                g = [g for g in guards if all(abs(F.local(q)[1] - F.D) < 2 for q in (g['a'], g['b'])) and
                     min(F.local(q)[0] for q in (g['a'], g['b'])) - tol <= x0 and
                     x1 <= max(F.local(q)[0] for q in (g['a'], g['b'])) + tol]
                assert g and abs(row['position'][2] - (g[0]['z1'] - R.RAIL_BOX_DROP)) < .01, ('not on an outer guard', row)
                assert all(math.dist(row['position'][:2], q[:2]) >= R.HUNG_LINE + 45.5
                           for q in anchors.get((row['lot'], z), ())), ('on a laundry pulley', row)
            else:
                assert row['place'] == 'guard' and row['prop'] == 'satellite_dish', row
                g = [g for g in guards if R.seg_dist(row['position'][:2], g['a'], g['b']) < .5 and
                     abs(row['position'][2] - (g['z1'] - info['anchors']['dish_clamp_z'])) < .01]
                assert g, ('a dish off its guard cap', row)
                az = row['aim_azimuth']
                assert 190 <= az <= 230 and 25 <= row['aim_elevation'] <= 40, row
                aim = (math.sin(math.radians(az)), math.cos(math.radians(az)))
                assert abs((math.degrees(math.atan2(aim[1], aim[0])) - row['yaw'] + 180) % 360 - 180) < .05, row
                u, _ = R.unit(g[0]['a'], g[0]['b'])
                n = (u[1], -u[0])
                centre = F.world(F.W / 2, F.D / 2)
                if (centre[0] - g[0]['a'][0]) * n[0] + (centre[1] - g[0]['a'][1]) * n[1] > 0:
                    n = (-n[0], -n[1])
                assert n[0] * aim[0] + n[1] * aim[1] >= R.DISH_FACING - .01, ('a dish aimed into its gallery', row)
    for items in by_deck.values():
        for i, a in enumerate(items):
            for b in items[i + 1:]:
                assert a[1] <= b[0] or b[1] <= a[0] or a[3] <= b[2] or b[3] <= a[2], ('props overlap', a[4], b[4])
    for row in rows:
        if row['collision']:
            kind, index = row['deck']
            deck = lots[row['lot']]['rear'][kind][index]
            F = R.deck_frame(deck)
            for box in R.collider_polys(row['prop'], row['position'][:2], row['yaw']):
                assert all(-1 <= F.local(q)[0] <= F.W + 1 and -1 <= F.local(q)[1] <= F.D for q in box), \
                    ('a collider off its deck', row)
    counts = soul['counts']
    decks = counts['gallery_decks']
    assert counts['gallery_decks_lived'] >= .7 * decks and decks >= 1000, counts
    assert kinds == {k: counts['gallery_' + k] for k in R.GALLERY_PROPS}
    for prop, least in (('chair_patio', 500), ('potted_plant', 800), ('bbq', 100), ('bike_gallery', 50),
                        ('bin_recycling', 150), ('bin_compost', 100), ('ac_unit', 60), ('flower_box', 60)):
        assert kinds[prop] >= least, (prop, kinds)
    assert 4 <= kinds['satellite_dish'] <= .03 * decks, kinds
    return {'decks': decks, 'lived': counts['gallery_decks_lived'], 'props': kinds,
            'dishes_without_sky': counts['gallery_dishes_without_sky']}


class FixtureWorld:
    """Just enough of plateau_replica.World for the lane-life fixtures: one building north of y = 0, no traffic."""

    def __init__(self):
        R = replica
        self.buildings = [{'points': [(-2000., 0.), (3000., 0.), (3000., 1500.), (-2000., 1500.)], 'height': 1100.}]
        self.building_grid, self.edge_grid = R.Grid(2500.), R.Grid(2500.)
        self.building_grid.add(0, R.bbox(self.buildings[0]['points']))
        pts = self.buildings[0]['points']
        self.building_edges = [(a, b, 0) for a, b in zip(pts, pts[1:] + pts[:1])]
        for i, (a, b, _) in enumerate(self.building_edges):
            self.edge_grid.add(i, R.bbox([a, b]))
        self.utility_poles = []

    def in_building(self, p, margin=0.):
        if replica.point_in(p, self.buildings[0]['points']):
            return True
        return margin > 0 and any(replica.seg_dist(p, a, b) < margin for a, b, _ in self.building_edges)

    def traffic_distance(self, p, limit=350.):
        return limit


def _fixture_rear(lot_id, shed=None):
    """A two-gallery straight stack on a wall along y = 0 (the yard south of it, 9 m deep), with its stair at the
    east end, a board fence with a gate on the lane and, optionally, a shed (sx0, sx1, sd0, sd1 in the yard frame)."""
    rect = [(0., -18.), (800., -18.), (800., -918.), (0., -918.)]
    decks = [{'z': z, 'quad': [(0., 0.), (800., 0.), (800., -180.), (0., -180.)]} for z in (330., 650.)]
    return {'id': lot_id, 'storeys': 3, 'front': None, 'rear': {
        'walls': [], 'footprints': [[(0., 0.), (800., 0.), (800., -200.), (0., -200.)]], 'decks': decks,
        'guards': [{'a': (0., -177.), 'b': (800., -177.), 'z0': z, 'z1': z + 107.} for z in (330., 650.)],
        'flights': [{'kind': 'straight', 'foot': (780., -400., 20.), 'head': (780., -190., 330.)}],
        'yard': {'rect': rect, 'cells': [], 'trees': [], 'pad': None, 'shed': shed},
        'shed': 'shed' if shed else None,
        'fence': {'kind': 'boards', 'height_cm': 180., 'gate_at': 640., 'runs': [[0., 590.], [690., 800.]],
                  'lane': True, 'shed_at': shed[:2] if shed else None}}}


def check_laundry_fixture():
    """The pole stands at the back fence and the line rises to it; round a shed the line runs askew to a pole beside
    it, never over its roof."""
    R = replica
    world = FixtureWorld()
    report = {}
    for name, shed in (('open', None), ('shed', [0., 330., 640., 880.])):
        found = None
        for n in range(40):
            plex = R.PlexYards({'fronts': [_fixture_rear(f'{name}-{n}', shed)]}, world)
            S, lane = R.Layer('Soul', R.SOUL_MATERIALS), {}
            counts = {k: 0 for k in R.LANE_COUNTS}
            R.lane_laundry(world, plex, S, lane, counts)
            if lane['laundry']['lines']:
                found = (plex, lane)
                break
        assert found, name
        plex, lane = found
        lot = plex.lots[0]
        F = lot['frame']
        pole = lane['laundry']['poles'][0]
        # at the fence line itself (the 11 cm pole clear of the 9 cm posts), or a little in from it where the line
        # must clear the shed's corner
        assert pole['from_fence_cm'] <= (25. if not shed else 70.), pole
        assert abs(F.D - F.local(pole['position'])[1] - pole['from_fence_cm']) < .05
        for line in lane['laundry']['lines']:
            a, e = line['anchor'], line['end']
            assert 30. <= e[2] - a[2] <= R.LINE_RISE[1] + .01 or abs(e[2] - R.LINE_MIN_END) < .01, line
            assert pole['height_cm'] >= e[2] + R.POLE_TOP - .5
            assert all(R.point_in(R.lerp(a[:2], e[:2], t / 10), lot['frame'].poly(0, F.W, -400, F.D)) for t in range(11))
            if shed:
                poly = lot['shed_poly']
                assert not any(R.segments_cross(a[:2], e[:2], p, q) for p, q in zip(poly, poly[1:] + poly[:1])), line
                assert R.poly_point_dist(poly, pole['position']) >= 30
        report[name] = {'from_fence_cm': pole['from_fence_cm'], 'pole_cm': pole['height_cm'],
                        'lines': len(lane['laundry']['lines']),
                        'skew_cm': round(abs(F.local(pole['position'])[0] - F.local(lane['laundry']['lines'][0]['anchor'][:2])[0]))}
    assert report['shed']['skew_cm'] > 0
    return report


class FixtureGlass:
    def windows(self, F, z, x0, x1):
        return [(xc, 68.) for xc in (150., 330.) if x0 <= xc <= x1]


def check_gallery_fixture(runs=300):
    """Gallery life on a synthetic deck facing south (a dish can see the satellite over the yard), with a stair
    flight alongside its outer guard, a door, two windows and a laundry pulley: over many seeds every prop stays on
    the props floor or its rail, window or guard, away from the stair, the door and the pulley, and every kind
    turns up."""
    R = replica
    world = FixtureWorld()
    plex = R.PlexYards({'fronts': []}, world)
    door = (560., -45.)
    deck = {'z': 330., 'quad': [(0., 0.), (700., 0.), (700., -170.), (0., -170.)], 'out': (0., -1.),
            'edge': [(0., -167.), (700., -167.)], 'door': door,
            'free': [[(8., -3.), (455., -3.), (455., -155.), (8., -155.)]]}
    guards = [{'a': (0., -167.), 'b': (700., -167.), 'z0': 330., 'z1': 437.},
              {'a': (2., 0.), 'b': (2., -164.), 'z0': 330., 'z1': 437.},
              {'a': (698., 0.), 'b': (698., -164.), 'z0': 330., 'z1': 437.}]
    flight = ('straight', (330., -215., 20.), (700., -215., 330.))
    anchor = (40., -168., 430.)
    seen = {k: 0 for k in R.GALLERY_PROPS}
    for n in range(runs):
        lot = {'id': f'fixture-{n}', 'storeys': 3, 'rear': {'guards': guards}}
        rows = []

        def put(prop, p, yaw, collides, parts, extra=None, z=None):
            row = R.placement(world, prop, p, yaw, collides and R.collision_clear(world, prop, p, yaw), parts, extra, z)
            rows.append(row)
            return row
        counts = {k: 0 for k in R.LANE_COUNTS}
        out = R._gallery_deck(world, plex, put, lot, 'decks', 0, deck, R.Rng('fixture-deck', n), [flight],
                              FixtureGlass(), [anchor], {}, [], counts)
        assert len(out) == len(rows)
        F = R.deck_frame(deck)
        boxes = []
        for row in out:
            seen[row['prop']] += 1
            loc = [F.local(q) for q in row['footprint']]
            x0, x1 = min(q[0] for q in loc), max(q[0] for q in loc)
            d0, d1 = min(q[1] for q in loc), max(q[1] for q in loc)
            x, d = F.local(row['position'][:2])
            if row['place'] == 'floor':
                top = F.D - R.CAP_FACE if row['prop'] == 'bike_gallery' else 155.
                assert 8 - .6 <= x0 and x1 <= 455 + .6 and 3 - .6 <= d0 and d1 <= top + .6, row
            if row['place'] in ('floor', 'window'):
                assert x1 <= door[0] - 58 or x0 >= door[0] + 58, row
                boxes.append((x0, x1, d0, d1))
            if row['place'] == 'window':
                assert x in (150., 330.) and abs(row['position'][2] - 330. - R.WINDOW_SILL) < .01
            if row['place'] in ('rail', 'guard'):
                assert R.poly_seg_dist(row['footprint'], flight[1][:2], flight[2][:2]) >= R.STAIR_CLEAR['straight'] - .5
                assert not any(world.in_building(q) for q in row['footprint']), row
            if row['place'] == 'rail':
                assert abs(d - 11. - (F.D + R.CAP_FACE + .5)) < .05 and math.dist(row['position'][:2], anchor[:2]) >= 95.5
                assert abs(row['position'][2] - (437. - R.RAIL_BOX_DROP)) < .01
            if row['place'] == 'guard':
                assert any(R.seg_dist(row['position'][:2], g['a'], g['b']) < .5 for g in guards)
                assert 190 <= row['aim_azimuth'] <= 230 and abs(row['position'][2] - 431.) < .01
            if row['prop'] == 'bike_gallery':
                # it leans to its left (-Y) onto the cap rail: its +Y axis points from the guard back to the wall
                yaw = math.radians(row['yaw'])
                assert abs(-math.sin(yaw) - 0.) < 1e-6 and abs(math.cos(yaw) - 1.) < 1e-6, row
        for i, a in enumerate(boxes):
            for b in boxes[i + 1:]:
                assert a[1] <= b[0] or b[1] <= a[0] or a[3] <= b[2] or b[3] <= a[2], (a, b)
    assert all(v > 0 for v in seen.values()), seen
    rng = R.Rng('shuffle')
    items = list(range(20))
    rng.shuffle(items)
    again = list(range(20))
    R.Rng('shuffle').shuffle(again)
    assert items == again and sorted(items) == list(range(20)) and items != list(range(20))
    return {'runs': runs, 'props': seen}


# ------------------------------------------------------------------------------------------------
# Streets, third pass: mapped trees off the carriageway, ruelles paved to the fences, curb-to-building coverage on
# the capture streets, textured front lawns and card plants

CAPTURE_STREETS = ('Rue de Mentana', 'Rue Fabre', 'Rue Rachel Est', 'Avenue Papineau', 'Rue Sherbrooke Est',
                   'Rue Napoléon')     # the streets of the reference views (Preview/Replica, the cameras)


def ground_tris(directory, manifest, keep):
    """Ground triangles (xy; flat or sloped, not walls) of the batches whose material passes keep(material, z)."""
    out = []
    for batch in manifest['batches']:
        for face in parse_obj(directory / batch['file'])[1]:
            xy = [p[:2] for p in face]
            if abs(replica.area(xy)) > 1. and keep(batch['material'], min(p[2] for p in face)):
                out.append(xy)
    return TriIndex(out)


def covered(index, p, tol=1.):
    """p lies on the index, or within tol of it (a point on the seam between two pieces)."""
    return any(index.contains((p[0] + dx, p[1] + dy)) for dx, dy in ((0, 0), (tol, 0), (-tol, 0), (0, tol), (0, -tol)))


def parse_obj_uv(path):
    """Faces as lists of ((x, y, z), (u, v)), in the map frame (the OBJ stores -y)."""
    vs, vts, faces = [], [], []
    for line in Path(path).read_text().splitlines():
        if line.startswith('v '):
            _, x, y, z = line.split()
            vs.append((float(x), -float(y), float(z)))
        elif line.startswith('vt '):
            _, u, v = line.split()
            vts.append((float(u), float(v)))
        elif line.startswith('f '):
            faces.append([(vs[int(t.split('/')[0]) - 1], vts[int(t.split('/')[1]) - 1]) for t in line.split()[1:]])
    return faces


def curb_lines(world):
    """Each sidewalk strip's curb segment, indexed, for distances from the curb."""
    lines, grid = [], replica.Grid(1000.)
    for strip in world.sidewalk_strips:
        a, b = strip['curb']
        grid.add(len(lines), replica.bbox([a, b], 400.))
        lines.append((a, b))
    return lambda p: min((replica.seg_dist(p, *lines[i]) for i in grid.query((p[0], p[1], p[0], p[1]))), default=1e9)


TREE_FIELDS = ('id', 'x_cm', 'y_cm', 'z_cm', 'species', 'kind', 'fall', 'dbh_cm', 'height_cm', 'source', 'pit')


def check_street_trees(world, out, streets):
    """Every street and park tree of the city's inventory clip (and the OSM trees it lacks) is one row of
    street_trees.json with the contract's fields. A tree the inventory puts in a sidewalk pit stands in one on the
    sidewalk, its centre 65 to 80 cm behind the curb, and no pit lies on carriageway asphalt. Curb extensions stand
    only within about 15 m of a corner or where the data lists one (a saillie, a median on a mapped median, an OSM
    choker): Mentana, where all 120 trees stand in sidewalk pits, has none. No trunk stands on carriageway or parking
    asphalt outside a curb extension (the host's few are left out and listed), and the parking curb is back: separate
    extensions leave a parked car's length, and they take under 3% of it. Each row carries its late-October colour
    from the species table, and conifers and larches stand on their own kinds."""
    R = replica
    doc = json.loads((out / 'Streets/street_trees.json').read_text())
    assert streets['street_trees'] == 'street_trees.json'
    assert streets['street_trees_sha256'] == R.sha_file(out / 'Streets/street_trees.json')
    rows = doc['trees']
    by_id = {r['id']: r for r in rows}
    assert len(by_id) == len(rows) == doc['counts']['street_trees'], 'one row per tree'
    for r in rows:
        assert all(k in r for k in TREE_FIELDS), r
        assert r['kind'] in R.TREE_KINDS and r['source'] in ('inventory', 'osm') and isinstance(r['pit'], bool), r
        assert r['fall'] in R.TREE_FALLS and r['fall'] == R.tree_fall(
            r['species'] if r['source'] == 'inventory' else None, r['kind']), r
        assert all(math.isfinite(r[k]) for k in ('x_cm', 'y_cm', 'z_cm', 'dbh_cm', 'height_cm')), r
        assert 0. <= r['z_cm'] <= R.Z_WALK + .2 and 200. <= r['height_cm'] <= 3000. and 0. < r['dbh_cm'] < 300., r
        assert (r['species'] == 'unknown') == (r['source'] == 'osm') and r['id'].startswith(('inv:', 'osm:')), r
    sources = [r['source'] for r in rows]
    assert sources == sorted(sources), 'inventory trees first, then the OSM trees the inventory lacks'
    # Every clipped inventory record inside the district is a row, or a dropped one (inside a building).
    clip = {f"inv:{r['ARROND']}-{r['EMP_NO']}" for _, r in R.load_tree_inventory()
            if R.inside((float(r['Latitude']), float(r['Longitude'])))}
    dropped = {d['id'] for d in doc['dropped']}
    host = {h['id'] for h in doc['host_review']}
    assert not host & set(by_id) and not dropped & set(by_id), 'a tree left out is still placed'
    assert clip == {r['id'] for r in rows if r['source'] == 'inventory'} | dropped | {h for h in host if
                                                                                    h.startswith('inv:')}
    assert len(dropped) <= 5 and len(host) <= 30, (len(clip), len(dropped), len(host))
    assert len(clip) > 4500, 'the Plateau and Ville-Marie clips over the district'
    # An OSM row is a mapped tree no inventory tree stands within 3 m of (the OSM nodes came from the inventory).
    inv_pts = R.Grid(1000.)
    inv_xy = []
    for r in rows:
        if r['source'] == 'inventory':
            p = tuple(r.get('mapped_xy_cm') or (r['x_cm'], r['y_cm']))
            inv_pts.add(len(inv_xy), R.bbox([p]))
            inv_xy.append(p)
    for r in rows:
        if r['source'] == 'osm':
            p = tuple(r.get('mapped_xy_cm') or (r['x_cm'], r['y_cm']))
            assert all(math.dist(p, inv_xy[i]) >= R.OSM_TREE_SAME for i in inv_pts.query(R.bbox([p], R.OSM_TREE_SAME)))
    osm_nodes = {f'osm:{n}' for n, _ in R.mapped_trees(world)}
    assert {r['id'] for r in rows if r['source'] == 'osm'} <= osm_nodes
    # Species to kinds (the contract's table), and unknown species by crown size.
    for species, dbh, kind in (('Acer saccharinum', 40, 'silver_maple'), ("Acer x freemanii 'Autumn Blaze'", 20,
                               'silver_maple'), ('Acer platanoides', 30, 'norway_maple'), ('Celtis occidentalis', 30,
                               'elm'), ("Ulmus x 'Morton' (Accolade TM)", 20, 'elm'), ('Gleditsia triacanthos', 30,
                               'honey_locust'), ('Gymnocladus dioicus', 30, 'honey_locust'), ('Fraxinus pennsylvanica', 30,
                               'ash'), ('Tilia cordata', 30, 'linden'), ('Malus', 15, 'small'), (None, 60, 'silver_maple'),
                              (None, 25, 'norway_maple'), (None, 8, 'small'), ("Pinus nigra 'Austriaca'", 8, 'conifer'),
                              ('Picea punges glauca Colorado', 20, 'conifer'), ('Thuja occidentalis', 10, 'conifer'),
                              ("Taxus cuspidata 'Capitata'", 10, 'conifer'), ('Tsuga canadensis', 10, 'conifer'),
                              ('Larix laricina', 20, 'larch'), ('Larix decidua', 30, 'larch')):
        assert R.tree_kind(species, dbh) == kind, (species, kind, R.tree_kind(species, dbh))
    # Late-October colour: red and sugar maples, Freeman maples, red, pin and white oaks turn red or russet,
    # conifers stay green, larches go gold, the rest yellow.
    for species, kind, fall in (('Acer rubrum', 'norway_maple', 'red'), ("Acer rubrum 'Armstrong'", 'norway_maple', 'red'),
                                ('Acer saccharum', 'norway_maple', 'red'), ("Acer x freemanii 'Autumn Blaze'",
                                'silver_maple', 'red'), ("Acer x Freemanii 'Morgan'", 'silver_maple', 'red'),
                                ('Quercus rubra', 'linden', 'russet'), ('Quercus palustris', 'linden', 'russet'),
                                ('Quercus alba', 'linden', 'russet'), ('Acer saccharinum', 'silver_maple', 'yellow'),
                                ('Acer platanoides', 'norway_maple', 'yellow'), ('Quercus macrocarpa', 'linden', 'yellow'),
                                ('Larix laricina', 'larch', 'gold'), ("Picea pungens 'Glauca'", 'conifer', 'evergreen'),
                                (None, 'norway_maple', 'yellow')):
        assert R.tree_fall(species, kind) == fall, (species, fall, R.tree_fall(species, kind))
    conifers = [r for r in rows if r['species'].split(' ')[0] in ('Picea', 'Pinus', 'Abies', 'Thuja', 'Tsuga')]
    assert conifers and all(r['kind'] == 'conifer' and r['fall'] == 'evergreen' for r in conifers)
    larches = [r for r in rows if r['species'].startswith('Larix')]
    assert larches and all(r['kind'] == 'larch' and r['fall'] == 'gold' for r in larches)
    reds = [r for r in rows if r['species'].lower().startswith(('acer rubrum', 'acer saccharum', 'acer x freemanii',
                                                                'quercus rubra', 'quercus palustris', 'quercus alba'))]
    assert len(reds) > 300 and all(r['fall'] in ('red', 'russet') for r in reds), len(reds)
    assert doc['falls'] == {g: sum(1 for r in rows if r['kind'] + ' ' + r['fall'] == g)
                            for g in {r['kind'] + ' ' + r['fall'] for r in rows}}
    assert all(r['kind'] == R.tree_kind(r['species'] if r['source'] == 'inventory' else None, r['dbh_cm'])
               for r in rows)
    # Pits: on the sidewalk (or an extension's top), never on carriageway asphalt; sidewalk pits 65-80 cm back.
    asphalt = ground_tris(out / 'Streets', streets, lambda m, z: m == 'asphalt')
    walk = ground_tris(out / 'Streets', streets, lambda m, z: m == 'sidewalk' and z >= R.Z_DROP - .01)
    cover = ground_tris(out / 'Streets', streets, lambda m, z: m in ('sidewalk', 'curb', 'soil', 'Yard_Grass')
                        and z >= R.Z_DROP - .01)
    from_curb = curb_lines(world)
    exts = doc['extensions']
    sidewalk_pits = back = 0
    for r in rows:
        if not r['pit']:
            continue
        a = math.radians(r['pit_yaw_deg'])
        u, n = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
        c = (r['x_cm'], r['y_cm'])
        on_ext = 'extension' in r
        # an extension's pit may slide up to PIT_SLIDE along the curb from its trunk
        slide = R.PIT_SLIDE if on_ext else 0.
        corners = [R.add(R.add(c, u, x * (R.PIT_L / 2 - slide - 1.)), n, y * (R.PIT_D / 2 - 1.))
                   for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for q in corners + [c]:
            assert not asphalt.contains(q) or covered(cover, q), ('a pit corner on carriageway asphalt', r['id'], q)
        if on_ext:
            assert exts[r['extension']] and r['id'] in exts[r['extension']]['trees']
            continue
        sidewalk_pits += 1
        assert all(covered(walk, q) for q in corners), ('a sidewalk pit off the sidewalk', r['id'])
        if r['placement'] in R.SIDEWALK_PITS:
            d = from_curb(c)
            assert R.PIT_BACK[0] - .1 <= d <= R.PIT_BACK[1] + .1, ('pit centre from the curb', r['id'], d)
            back += 1
    assert sidewalk_pits == doc['counts']['sidewalk_pits'] > 1000 and back > 900, (sidewalk_pits, back)
    in_strips = [r for r in rows if r['placement'] in R.SIDEWALK_PITS and not world.route_near((r['x_cm'], r['y_cm']))]
    share = sum(1 for r in in_strips if r['pit']) / len(in_strips)
    assert share > .95, ('inventory sidewalk trees in sidewalk pits', share)
    mentana = [r for r in rows if r['street'] == 'Rue de Mentana' and r['source'] == 'inventory']
    assert len(mentana) >= 110 and all(r['pit'] and 'extension' not in r for r in mentana if r['placement'] == 'TRottoir')
    # Extensions: within 15 m of a corner, or where the data lists one; none mid-block on Mentana's 120 pit trees.
    corners = R.corner_points(world)
    chokers = [world.nodes[n] for n, t in world.node_tags.items() if t.get('traffic_calming') == 'choker' and n in world.nodes]
    reasons, far = {}, []
    for i, ext in enumerate(exts):
        trees = [by_id[t] for t in ext['trees']]
        pts = [tuple(t.get('mapped_xy_cm') or (t['x_cm'], t['y_cm'])) for t in trees]
        near = min(math.dist(p, c) for p in pts for c in corners)
        reasons[ext['reason']] = reasons.get(ext['reason'], 0) + 1
        if ext['reason'] == 'inventory saillie':
            assert any(t['placement'] in R.SAILLIES for t in trees), ext
        elif ext['reason'] == 'inventory median':
            assert any(t['placement'].startswith('Terre-plein') for t in trees), ext
            assert R.mapped_median(world, pts[0], trees[0]['street']) is not None, ('a median off any mapped median', ext)
        elif ext['reason'] == 'osm choker':
            assert any(math.dist(p, k) <= R.CHOKER_REACH for p in pts for k in chokers), ext
        else:
            assert ext['reason'] == 'corner' and near <= R.CORNER_REACH + 1., ('a corner extension mid-block', ext)
        if near > R.CORNER_REACH + 100. and ext['reason'] == 'corner':
            far.append(ext)
        assert all(-5. <= d <= R.DATA_REACH for d in ext['from_curb_cm'])
        assert ext['depth_cm'] <= R.DATA_REACH + R.PIT_D / 2 + R.BUMP_MARGIN + .01
        assert ext['raised_cm'] == 0 or ext['raised_cm'] >= R.RAISED_MIN
        assert all(pit[2] in (R.Z_WALK, R.Z_DROP) for pit in ext['pits'])
        assert (ext['raised_cm'] < ext['depth_cm'] - .01) == bool(ext['flush_reason']), ext
    assert not far and len(exts) == doc['counts']['curb_extensions'] <= 120, (len(far), len(exts))
    assert not [e for e in exts if e['street'] == 'Rue de Mentana'], 'Mentana has no curb extension'
    # No trunk on carriageway or parking asphalt outside a curb extension; the host's are left out, each on it.
    left = [r['id'] for r in rows if asphalt.contains((r['x_cm'], r['y_cm'])) and not cover.contains((r['x_cm'], r['y_cm']))]
    assert not left, ('trunks on carriageway asphalt', left[:10])
    for h in doc['host_review']:
        assert asphalt.contains(tuple(h['position'])) and h['reason'], h
    # Parking: separate extensions on one curb leave a parked car's length; extensions take under 3% of the curb.
    for strip in world.sidewalk_strips:
        cuts = sorted(strip.get('bump_cuts', []))
        for (x0, x1), (y0, y1) in zip(cuts, cuts[1:]):
            assert y0 - x1 >= R.PARK_GAP - 1, ('two extensions closer than a parking space', strip['seg']['name'])
    parking = sum(strip['len'] for strip in world.sidewalk_strips if any(R._parking_sides(strip['seg']).values()))
    taken = sum(x1 - x0 for strip in world.sidewalk_strips if any(R._parking_sides(strip['seg']).values())
                for x0, x1 in strip.get('bump_cuts', []))
    assert taken < .03 * parking, (taken, parking)
    moved = sorted(r.get('moved_cm', 0.) for r in rows if r['pit'] and 'extension' not in r)
    return {'trees': len(rows), 'inventory': doc['counts']['street_trees_inventory'], 'osm': doc['counts']['street_trees_osm'],
            'sidewalk_pits': sidewalk_pits, 'sidewalk_trees_in_pits': round(share, 4),
            'moved_cm_median_p90_max': [round(moved[len(moved) // 2]), round(moved[int(.9 * (len(moved) - 1))]), round(moved[-1])],
            'extensions': reasons, 'host_review': len(host), 'parking_curb_taken': round(taken / parking, 4),
            'kinds': doc['kinds']}


RESEAT_NAMED = {      # the critics' named rows: the outcome the inventory's own side, place and distance give
    'inv:5-263258': ('parterre', 'N'),      # a Colorado spruce on Rachel, mapped 0.5 m from the centre line
    'inv:5-168207': ('parterre', 'O'),      # Parc-La Fontaine, mapped on the park-side carriageway
    'inv:5-169265': ('median', None),       # Parc-La Fontaine, a median tree mapped on a carriageway
}
ROY_ROWS = ('inv:5-35', 'inv:5-36', 'inv:5-45', 'inv:5-55', 'inv:5-61')   # sidewalk trees in Roy Est's parking lane


def street_side(world, street, p):
    """The outward normal of the side of `street` p stands on, at the nearest carriageway of that name, and how far
    from that carriageway's centre line."""
    R = replica
    key = R.street_key(street)
    _, i = min((R.seg_dist(p, s['pa'], s['pb']), s['i']) for s in world.segs
               if R.street_key(s['name']) == key and not s['excluded'] and s['quad'])
    s = world.segs[i]
    _, lat = R.seg_local(s, p)
    return ((s['n'][0], s['n'][1]) if lat > 0 else (-s['n'][0], -s['n'][1])), abs(lat), s


def check_reseated_trees(world, out, streets):
    """Trees the inventory maps on carriageway or parking asphalt are re-seated from its own fields (Rue_cote,
    Emplacement, Distance_pave), or left out and listed: a sidewalk tree in a pit 65-80 cm behind the curb of its own
    side, a parterre tree on the lawn Distance_pave behind the curb of its side, a median tree on its street's mapped
    median, never on a carriageway. The critics' rows: the Rachel spruce on the north lawn, the two Parc-La Fontaine
    trees on the west lawn and on the median, the Roy Est sidewalk trees in pits on their side or listed, the
    Rue de Champlain median trees listed (no median is mapped there). And no trunk outside a pit stands within 300 cm
    of a traffic centre line but on ruelle paving."""
    R = replica
    doc = json.loads((out / 'Streets/street_trees.json').read_text())
    by_id = {r['id']: r for r in doc['trees']}
    host = {h['id']: h for h in doc['host_review']}
    inv = {f"inv:{r['ARROND']}-{r['EMP_NO']}": r for _, r in R.load_tree_inventory()}
    asphalt = ground_tris(out / 'Streets', streets, lambda m, z: m == 'asphalt')
    walk = ground_tris(out / 'Streets', streets, lambda m, z: m == 'sidewalk')
    alley = ground_tris(out / 'Streets', streets, lambda m, z: m == 'alley')
    for tid, (how, side) in RESEAT_NAMED.items():
        r = by_id.get(tid)
        assert r is not None and r.get('reseated') == how, (tid, r, host.get(tid))
        p, mapped = (r['x_cm'], r['y_cm']), tuple(r['mapped_xy_cm'])
        assert asphalt.contains(mapped) and not asphalt.contains(p) and not walk.contains(p), (tid, 'still on the road')
        assert world.traffic_distance(p, 2000) >= R.CLEAR, tid
        if how == 'parterre':
            normal, lat, s = street_side(world, r['street'], p)
            card = R.CARDINAL[side]
            assert normal[0] * card[0] + normal[1] * card[1] > 0, (tid, 'on the wrong side of the street')
            curb = s['curbL'] if R.seg_local(s, p)[1] > 0 else s['curbR']
            pave = 100. * float(inv[tid]['Distance_pave'])
            assert abs(lat - curb - pave) < 1., (tid, lat, curb, pave)
        else:
            m = R.mapped_median(world, mapped, r['street'])
            assert m is not None and math.dist(m['at'], p) < 1. and m['width'] >= R.MEDIAN_GROUND, (tid, m)
    spruce = by_id['inv:5-263258']
    assert spruce['kind'] == 'conifer' and spruce['fall'] == 'evergreen', spruce
    # Roy Est: each sidewalk tree in a pit on its own side of the street, or listed with the reason
    for tid in ROY_ROWS:
        card = R.CARDINAL[inv[tid]['Rue_cote']]
        if tid in host:
            assert host[tid]['side'] == inv[tid]['Rue_cote'] and tid not in by_id, host[tid]
            continue
        r = by_id[tid]
        p = (r['x_cm'], r['y_cm'])
        normal, _, _ = street_side(world, r['street'], p)
        assert r['pit'] and 'extension' not in r and normal[0] * card[0] + normal[1] * card[1] > 0, r
        assert R.PIT_BACK[0] - .1 <= r['pit_from_curb_cm'] <= R.PIT_BACK[1] + .1, r
    assert any(tid in by_id for tid in ROY_ROWS), 'no Roy Est tree found a pit on its side'
    # Rue de Champlain's median trees: the city's new median is not mapped, so they are listed, not placed
    champlain = [t for t, r in inv.items() if r.get('Rue') == 'Rue de Champlain' and
                 (r.get('Emplacement') or '').startswith('Terre-plein') and t in host]
    assert len(champlain) >= 10 and all(R.mapped_median(world, tuple(host[t]['position']), 'Rue de Champlain') is None
                                        for t in champlain), len(champlain)
    # Every re-seated row stands off the carriageway, a pit on the sidewalk, a parterre tree behind it
    seen = {}
    for r in doc['trees']:
        how = r.get('reseated')
        if not how:
            continue
        seen[how] = seen.get(how, 0) + 1
        p = (r['x_cm'], r['y_cm'])
        assert how in ('sidewalk pit', 'parterre', 'median') and not asphalt.contains(p), r
        assert (how == 'sidewalk pit') == r['pit'] and (how != 'parterre' or not walk.contains(p)), r
        card = R.CARDINAL.get(inv[r['id']]['Rue_cote']) if r['id'] in inv else None
        if card and how != 'median':
            normal, _, _ = street_side(world, r['street'], p)
            assert normal[0] * card[0] + normal[1] * card[1] > -R.SIDE_DOT, ('a tree re-seated across its street', r)
    assert doc['counts']['trees_reseated'] == sum(seen.values()), (seen, doc['counts'])
    # Outside a pit, no trunk within 300 cm of a traffic centre line but at a ruelle's edge (a car drives the lane's
    # middle, and trees stand along it as in the real lanes)
    band = [r['id'] for r in doc['trees'] if not r['pit'] and world.traffic_distance((r['x_cm'], r['y_cm']), 2000) < R.CLEAR
            and not covered(alley, (r['x_cm'], r['y_cm']))]
    assert not band, ('trunks in the traffic band', band[:10])
    return {'reseated': seen, 'host_review': len(host), 'roy_placed': sorted(t for t in ROY_ROWS if t in by_id)}


def check_pit_dressing(world, out, streets):
    """Each tree pit has a low wrought-iron guard (Iron_Wrought cut-out cards round it, no collision) and planted
    cards on its soil (Plant_Pit_Flowers), varied per pit: the guard's height and sides, and the planting's cards,
    heights and stretch of the planting texture."""
    A = apply_replica
    mats = streets['materials']
    assert A.texture_set('Iron_Wrought', mats['Iron_Wrought']) == 'iron_wrought'
    assert A.texture_set('Plant_Pit_Flowers', mats['Plant_Pit_Flowers']) == 'pit_flowers'
    cards = {'Iron_Wrought': [], 'Plant_Pit_Flowers': []}
    for batch in streets['batches']:
        if batch['material'] in cards:
            assert batch['collision'] == 'none', batch
            for face in parse_obj_uv(out / 'Streets' / batch['file']):
                xyz = [p for p, _ in face]
                zs = [p[2] for p in xyz]
                assert max(zs) - min(zs) >= 5. and sorted({round(t[1], 4) for _, t in face}) == [0., 1.], 'a card'
                c = (sum(p[0] for p in xyz) / len(xyz), sum(p[1] for p in xyz) / len(xyz))
                cards[batch['material']].append((c, max(zs) - min(zs), min(t[0] for _, t in face)))
    grids = {}
    for key, items in cards.items():
        g = replica.Grid(500.)
        for i, (c, _, _) in enumerate(items):
            g.add(i, replica.bbox([c]))
        grids[key] = g
    variants, pits = set(), 0
    for r in json.loads((out / 'Streets/street_trees.json').read_text())['trees']:
        if not r['pit']:
            continue
        pits += 1
        c = (r['x_cm'], r['y_cm'])
        near = {key: [cards[key][i] for i in grids[key].query(replica.bbox([c], 90.)) if math.dist(cards[key][i][0], c) < 80.]
                for key in cards}
        guard, plants = near['Iron_Wrought'], near['Plant_Pit_Flowers']
        assert len(guard) >= 3 and plants, ('a pit without its guard or planting', r['id'], len(guard), len(plants))
        variants.add((len(guard), round(max(h for _, h, _ in guard) / 10.), len(plants)))
    us = [u0 % 1. for _, _, u0 in cards['Plant_Pit_Flowers']]
    assert len(variants) >= 6 and min(us) < .2 and max(us) > .8, (len(variants), min(us), max(us))
    return {'pits': pits, 'guard_cards': len(cards['Iron_Wrought']), 'planting_cards': len(cards['Plant_Pit_Flowers']),
            'variants': len(variants)}


def check_ruelle_gutter(world, out, streets, soul):
    """The ruelle's centre gutter is aged lane concrete, darker than the sidewalk and the old flat grey strip, sunk
    in a shallow V (GUTTER_DEPTH) between the asphalt halves (no asphalt over its centre line), on its own UVs (u along the ruelle,
    v across it with the centre at 0.5, where the texture's damp channel runs); leaves drift along it; and the sealed
    cracks are dull near-black, no longer a white stroke."""
    R, A = replica, apply_replica
    spec = streets['materials']['Concrete_Lane_Aged']
    assert 'alley_gutter' not in streets['materials'] and A.texture_set('Concrete_Lane_Aged', spec) == 'lane_concrete'
    lum = lambda hex_: sum(w * c for w, c in zip((.2126, .7152, .0722), A.linear(hex_)))   # noqa: E731
    assert lum(spec['base_color_srgb']) < .75 * lum('#8b8a86') and lum(spec['base_color_srgb']) < .5 * lum(
        streets['materials']['sidewalk']['base_color_srgb'])
    gutter, alley = [], []
    for batch in streets['batches']:
        if batch['material'] == 'Concrete_Lane_Aged':
            gutter += parse_obj_uv(out / 'Streets' / batch['file'])
        elif batch['material'] == 'alley':
            alley += [[p[:2] for p in f] for f in parse_obj(out / 'Streets' / batch['file'])[1]]
    alley = TriIndex(alley)
    tris = []
    for face in gutter:
        pts = [p for p, _ in face]
        if abs(R.area([p[:2] for p in pts])) < 1.:
            continue                                        # the V's end walls
        tris.append([p[:2] for p in pts])
        assert all(abs(p[2] - R.gutter_z(0.)) < .01 or abs(p[2] - R.Z_ALLEY) < .01 for p in pts)
        for p, (u, v) in face:
            if abs(p[2] - R.gutter_z(0.)) < .01:
                assert abs(v - .5) < 1e-4, ('the gutter centre line at v 0.5', v)
            else:
                assert abs(abs(v - .5) - R.GUTTER_HALF / 100.) < 1e-4, v
    gi = TriIndex(tris)
    samples = sunk = 0
    others = R.AlleyIndex(world)
    for a in world.alleys:
        for pa, pb in a['segments']:
            u, length = R.unit(pa, pb)
            x = 100.
            while x < length - 100.:
                c = R.add(pa, u, x)
                x += 200.
                if world.in_building(c) or any(
                        R.seg_dist(c, s0, s1) < R.ALLEY_HALF + 40. for aid, s0, s1 in
                        (others.segs[i] for i in others.grid.query(R.bbox([c], 300.))) if aid != a['id']):
                    continue                                # another ruelle's paving crosses here
                samples += 1
                if gi.contains(c) and not alley.contains(c):
                    sunk += 1
    assert samples > 2000 and sunk >= .97 * samples, (sunk, samples)
    assert soul['counts'].get('ruelle_gutter_leaf_drifts', 0) > 100 and streets['counts']['ruelle_gutter_metres'] > 1000
    crack = soul['materials']['crack_seal']
    assert crack['roughness'] >= SOUL_OVERLAY_ROUGHNESS and lum(crack['base_color_srgb']) < lum('#151617'), crack
    return {'samples': samples, 'sunk_centre': sunk, 'gutter_metres': streets['counts']['ruelle_gutter_metres'],
            'leaf_drifts': soul['counts']['ruelle_gutter_leaf_drifts'], 'crack_seal': crack}


def check_ruelle_paving(world, out, streets, soul_rows):
    """Every ruelle is paved from fence to fence (or wall to wall): nothing bare 2.55 m off any centreline, the
    paving reaches the 2.9 m fence line wherever no wall stands nearer, no piece runs more than 20 m along its lane,
    a weedy edge lines most of the fence feet, and props on the lane side stand on the paving."""
    R = replica
    paved = ground_tris(out / 'Streets', streets, lambda m, z: True)
    total = bare = fence_total = fence_bare = 0
    misses = []
    for alley in world.alleys:
        for pa, pb in alley['segments']:
            u, length = R.unit(pa, pb)
            n = (-u[1], u[0])
            for i in range(int(length // 200) + 1):
                c = R.add(pa, u, min(length, i * 200.))
                for k in (1, -1):
                    p = R.add(c, n, 255. * k)
                    if world.in_building(p):
                        continue
                    total += 1
                    if not covered(paved, p):
                        bare += 1
                        misses.append([round(v) for v in p])
                    q = R.add(c, n, (R.ALLEY_PAVE - 5) * k)
                    if world.building_ray(c, (n[0] * k, n[1] * k), R.ALLEY_PAVE) is None and \
                            not world.in_building(c) and not world.in_building(q):
                        fence_total += 1
                        fence_bare += not covered(paved, q)
    assert total > 5000 and bare == 0, ('bare ground 2.55 m off a ruelle', bare, total, misses[:8])
    assert fence_bare <= .01 * fence_total, (fence_bare, fence_total)
    lanes = R.AlleyIndex(world)
    longest = 0.
    for batch in streets['batches']:
        if batch['material'] in ('alley', 'Concrete_Lane_Aged', 'Yard_Gravel'):
            for face in parse_obj(out / 'Streets' / batch['file'])[1]:
                near = lanes.nearest((sum(p[0] for p in face) / 3, sum(p[1] for p in face) / 3), 700)
                if near is not None:
                    u = R.unit(near[2], near[3])[0]
                    along = [p[0] * u[0] + p[1] * u[1] for p in face]
                    longest = max(longest, max(along) - min(along))
    assert longest <= R.PAVE_PIECE + 1, ('a ruelle piece over 20 m', longest)
    c = streets['counts']
    assert c['ruelle_edge_metres'] >= .5 * c['ruelle_metres'] and c['ruelle_square_metres'] >= 5 * c['ruelle_metres']
    for row in soul_rows:
        if row.get('side') == 'lane' and world.surfaces.has(row['position'][:2], 'alley') and row['prop'] != 'flower_box':
            assert row['position'][2] == R.Z_ALLEY, ('a lane-side prop sunk in the paving', row)
    return {'samples_2_55m': total, 'bare_2_55m': bare, 'fence_line_samples': fence_total, 'fence_line_bare': fence_bare,
            'longest_piece_cm': round(longest), 'paved_m2': c['ruelle_square_metres'], 'edge_m': c['ruelle_edge_metres']}


OLD_ROAD = replica.ROOT / 'Data/Plateau/BaseGeometry/Road.obj'   # the old OSM road, left in the map under the replica
OVER_OLD_ROAD = .25                 # cm a ruelle gutter or leaf vertex keeps over it (closer z-fights at a distance)


def check_over_old_road(out, streets, soul):
    """The old OSM road (BaseGeometry/Road.obj) never shows through the ruelle gutter or the leaves in it: every
    Concrete_Lane_Aged vertex and every Leaf_Litter vertex over Road.obj's footprint stands at least 0.25 cm above the
    highest Road.obj point there (the gutter used to dip to z 5.3 under its 6.0, and read as two pale lines)."""
    tris, tops = [], []
    for face in parse_obj(OLD_ROAD)[1]:
        for k in range(1, len(face) - 1):
            t = (face[0], face[k], face[k + 1])
            tris.append([q[:2] for q in t])
            tops.append(max(q[2] for q in t))
    index = TriIndex(tris)

    def top(p):
        hits = [tops[i] for i in index.grid.query((p[0], p[1], p[0], p[1])) if _tri_contains(index.tris[i], p)]
        return max(hits) if hits else None
    checked, worst = {}, math.inf
    for layer, manifest, keep in (('Streets', streets, lambda m: m == 'Concrete_Lane_Aged'),
                                  ('Soul', soul, lambda m: m == 'Leaf_Litter' or m.startswith('leaf_'))):
        for batch in manifest['batches']:
            if not keep(batch['material']):
                continue
            for p in parse_obj(out / layer / batch['file'])[0]:
                z = top(p)
                if z is None:
                    continue
                checked[batch['material']] = checked.get(batch['material'], 0) + 1
                worst = min(worst, p[2] - z)
                assert p[2] >= z + OVER_OLD_ROAD - 1e-6, ('under the old road', batch['material'], p, z)
    assert checked.get('Concrete_Lane_Aged', 0) > 1000 and sum(v for k, v in checked.items() if k != 'Concrete_Lane_Aged'), \
        checked
    return {'vertices_over_old_road': checked, 'min_gap_cm': round(worst, 3)}


SOUL_OVERLAY_ROUGHNESS = .8     # the asphalt is .92; a smoother overlay catches the sky as a white stroke


def check_soul_overlays(out, streets, soul):
    """Every Soul overlay lying on the asphalt (patches, sealed cracks, potholes: the flat faces within 2 mm over a
    carriageway or ruelle) is as dull as the asphalt, roughness at least 0.8: at .62 the corner capture still showed
    the sealed crack as a white painted hook, and the pothole was a glare at .3."""
    R = replica
    asphalt = ground_tris(out / 'Streets', streets, lambda m, z: m in ('asphalt', 'alley'))
    keys = set()
    for batch in soul['batches']:
        if batch['material'] in keys:
            continue
        for face in parse_obj(out / 'Soul' / batch['file'])[1]:
            zs = [p[2] for p in face]
            if max(zs) - min(zs) < .01 and R.Z_ALLEY - .1 < zs[0] <= R.Z_ROAD + .2 and asphalt.contains(
                    (sum(p[0] for p in face) / len(face), sum(p[1] for p in face) / len(face))):
                keys.add(batch['material'])
                break
    assert {'crack_seal', 'pothole', 'patch_dark', 'patch_light'} <= keys, keys
    dull = {k: soul['materials'][k]['roughness'] for k in sorted(keys)}
    assert all(v >= SOUL_OVERLAY_ROUGHNESS for v in dull.values()), dull
    return dull


def check_lane_corridor(world, out, streets, lane='204859680', step=200.):
    """Every ruelle is paved from lot line to lot line: behind the street-front yards (more than FRONT_MAX from any
    sidewalk, where the parterres reach back to the buildings), across the corridor from the lane strip out to the
    first Plex lot line, fence, shed or wall within 15 m (taken over a 1 m band along the lane, so a seam between two
    yards is no corridor), nothing shows the bare floor (YardGround). The Mentana and Saint-André lane (OSM way
    204859680), where a strip 6 to 12 m out lay bare beside the Habitations De Mentana, has no bare sample at all."""
    R = replica
    stops = R.PaveStops(world, world.plex, lots=True)
    ground = ground_tris(out / 'Streets', streets, lambda m, z: True)
    total = bare = lane_total = lane_bare = 0
    misses = []
    for alley in world.alleys:
        for pa, pb in alley['segments']:
            u, length = R.unit(pa, pb)
            n = (-u[1], u[0])
            for i in range(int(length // step) + 1):
                c = R.add(pa, u, min(length, i * step))
                if world.in_building(c) or stops.inside(c):
                    continue
                for k in (1, -1):
                    d = (n[0] * k, n[1] * k)
                    if world.building_ray(c, d, R.LOT_PAVE) is None and stops.ray(c, d, R.LOT_PAVE) is None:
                        continue                    # no lot line within 15 m: the fence-line paving (check_ruelle_paving)
                    end = min(v for dt in (-50., 0., 50.) for q in (R.add(c, u, dt),)
                              for v in (world.building_ray(q, d, R.LOT_PAVE), stops.ray(q, d, R.LOT_PAVE), R.LOT_PAVE)
                              if v is not None)
                    xs = [R.ALLEY_HALF + 10. + 50. * j for j in range(int(max(0., end - 20. - R.ALLEY_HALF) // 50) + 1)
                          if R.ALLEY_HALF + 10. + 50. * j < end - 10.]
                    if not all(stops.behind_front(R.add(c, d, x)) for x in xs + [end]):
                        continue                    # in the street-front band: the parterres' (check_capture_coverage)
                    for x in xs:
                        p = R.add(c, d, x)
                        total += 1
                        lane_total += alley['id'] == lane
                        if not covered(ground, p):
                            bare += 1
                            lane_bare += alley['id'] == lane
                            misses.append((alley['id'], [round(v) for v in p], round(x), round(end)))
    assert lane_total > 500 and lane_bare == 0, ('bare floor beside the Mentana and Saint-André lane', lane_bare,
                                                 lane_total, [m for m in misses if m[0] == lane][:6])
    assert total > 5000 and bare <= .002 * total, ('bare floor in a lane corridor', bare, total, misses[:6])
    return {'corridor_samples': total, 'bare': bare, lane: {'samples': lane_total, 'bare': lane_bare},
            'ruelle_m2': streets['counts']['ruelle_square_metres']}


def check_capture_coverage(world, out, streets):
    """From the curb to the building line on the capture streets, every point (20 cm steps, every metre of curb)
    has sidewalk, parterre, walk or ruelle paving: no taupe floor. A building line counts up to 15 m behind the
    sidewalk; a sample on another carriageway ends the ray."""
    R = replica
    cover = ground_tris(out / 'Streets', streets, lambda m, z: m != 'asphalt' and
                        (z >= R.Z_ALLEY - .1 or m == 'Concrete_Lane_Aged'))
    road = ground_tris(out / 'Streets', streets, lambda m, z: m == 'asphalt')
    stats, misses = {}, []
    for strip in world.sidewalk_strips:
        s = strip['seg']
        if s['name'] not in CAPTURE_STREETS:
            continue
        (ca, cb), (oa, _) = strip['curb'], strip['outer']
        u, length = R.unit(ca, cb)
        out_n = (-u[1], u[0])
        if (oa[0] - ca[0]) * out_n[0] + (oa[1] - ca[1]) * out_n[1] < 0:
            out_n = (-out_n[0], -out_n[1])
        w0 = math.dist(ca, oa)
        x = 100.
        while x < length - 100:
            c = R.add(ca, u, x)
            line = world.building_ray(c, out_n, w0 + R.FRONT_MAX - 100)
            d = 10.
            while line is not None and d < line - 10:
                p = R.add(c, out_n, d)
                if world.in_building(p) or world.in_park(p) or (not covered(cover, p) and road.contains(p)):
                    break
                st = stats.setdefault(s['name'], [0, 0])
                st[0] += 1
                if not covered(cover, p):
                    st[1] += 1
                    misses.append((s['name'], [round(v) for v in p], round(d), round(line)))
                d += 20.
            x += 100.
    assert set(stats) == set(CAPTURE_STREETS), sorted(stats)
    for name, (n, m) in stats.items():
        assert n > 2000 and m <= .001 * n, (name, n, m, [mm for mm in misses if mm[0] == name][:6])
    assert len(misses) <= 30, misses
    return {name: {'samples': n, 'bare': m} for name, (n, m) in sorted(stats.items())}


def check_planting(out, streets, soul):
    """Front lawns and beds take the shared textured lawn and soil keys; the ruelle-verte perennials and shrubs are
    crossed cut-out foliage cards (vertical cards and a flat leaf card), not faceted mounds."""
    A = apply_replica
    keys = set(streets['materials'])
    assert {'Yard_Grass', 'Yard_Soil'} <= keys and not {'yard_grass', 'yard_soil'} & keys
    for key, want in (('Yard_Grass', 'lawn'), ('Yard_Soil', 'soil'), ('grass_edge', 'lawn'), ('soil', 'soil'),
                      ('Yard_Gravel', 'crushed_stone')):
        assert A.texture_set(key, streets['materials'][key]) == want, key
    cards = ('plant_green', 'plant_gold', 'plant_rust', 'plant_purple', 'plant_red')
    faces = 0
    for batch in soul['batches']:
        if batch['material'] not in cards:
            continue
        assert A.texture_set(batch['material'], soul['materials'][batch['material']]) == 'creeper'
        for face in parse_obj(out / 'Soul' / batch['file'])[1]:
            zs = [p[2] for p in face]
            n = replica.newell([tuple(p) for p in face])
            vertical = abs(n[2]) < 1e-3 * math.sqrt(sum(v * v for v in n))
            assert max(zs) - min(zs) < .01 or vertical, ('a slanted plant facet', batch['material'], face)
            faces += 1
    assert faces > 1000, faces
    # Ornamental grass: crossed Plant_Grass_Fountain cards (the local review's "straw cone" was plant_straw), each a
    # vertical quad showing the fountain_grass set's whole clump once (u 0..1, v 0..1), three to a clump crossing at
    # its centre about 60 degrees apart, the clump about as wide as tall.
    mats = soul['materials']
    assert 'plant_straw' not in mats and 'Plant_Grass_Fountain' in mats, sorted(mats)
    assert A.texture_set('Plant_Grass_Fountain', mats['Plant_Grass_Fountain']) == 'fountain_grass'
    cards = []
    for batch in soul['batches']:
        if batch['material'] != 'Plant_Grass_Fountain':
            continue
        for face in parse_obj_uv(out / 'Soul' / batch['file']):
            n = replica.newell([p for p, _ in face])
            assert abs(n[2]) < 1e-3 * math.sqrt(sum(v * v for v in n)), ('a slanted grass card', face)
            assert {uv for _, uv in face} <= {(0., 0.), (1., 0.), (1., 1.), (0., 1.)}, face
            ends = sorted({(p[0], p[1]) for p, _ in face})
            assert len(ends) == 2, face
            cards.append((((ends[0][0] + ends[1][0]) / 2, (ends[0][1] + ends[1][1]) / 2),
                          math.dist(*ends), max(p[2] for p, _ in face) - min(p[2] for p, _ in face),
                          math.atan2(ends[1][1] - ends[0][1], ends[1][0] - ends[0][0]) % math.pi))
    clumps, cells = {}, {}
    for c in cards:
        gx, gy = math.floor(c[0][0]), math.floor(c[0][1])
        near = [k for i in (-1, 0, 1) for j in (-1, 0, 1) for k in cells.get((gx + i, gy + j), ())]
        key = next((k for k in near if math.dist(k, c[0]) < .1), None)
        if key is None:
            key = c[0]
            cells.setdefault((gx, gy), []).append(key)
        clumps.setdefault(key, []).append(c)
    assert len(clumps) >= 100, len(clumps)
    for group in clumps.values():
        assert len(group) == 2 * replica.GRASS_CARDS, group           # two triangles a card
        angles = sorted({round(c[3], 3) for c in group})
        assert len(angles) == replica.GRASS_CARDS and all(
            min(abs(a - b), math.pi - abs(a - b)) > math.radians(40) for i, a in enumerate(angles) for b in angles[i + 1:]), angles
        width, height = max(c[1] for c in group), max(c[2] for c in group)
        assert replica.GRASS_H[0] * .85 <= height <= replica.GRASS_H[1] * 1.06 and .7 <= width / height <= 1.4, group
    return {'card_triangles': faces, 'fountain_grass_clumps': len(clumps)}


SLAB_KEYS = ('sidewalk', 'curb', 'Yard_Grass', 'Yard_Soil', 'yard_path', 'grass_edge', 'soil')
OPEN_STEPS_MAX = 50         # of about 174,000 outer slab edges; 25 now (see the README's Limits)


def check_open_steps(world, out, streets):
    """No step opens onto the floor under a raised slab: every outer edge of a sidewalk, curb extension, apron,
    parterre, walk or pit top that stands more than 2.5 cm over the ground just in front of it (a dropped apron, the
    foot of a ramp, the carriageway or bare floor; a building or the park aside) has a wall under it. The critic
    saw the old OSM path through such a gap on Fabre, between a raised sidewalk piece and the dropped apron at a
    ruelle mouth. A few dozen short ones remain district-wide (pits on extensions cut short at a junction, slivers
    a few cm wide); none is 2 m long, and none 1 m long within 25 m of a capture street's centreline."""
    R = replica
    ground_keys = SLAB_KEYS + ('asphalt', 'alley', 'Concrete_Lane_Aged', 'Yard_Gravel')
    tops, ground, walls = [], [], []
    for batch in streets['batches']:
        if batch['material'] not in ground_keys:
            continue
        for face in parse_obj(out / 'Streets' / batch['file'])[1]:
            if abs(R.area([p[:2] for p in face])) > .01:
                ground.append(face)
                if batch['material'] in SLAB_KEYS and max(p[2] for p in face) > R.Z_ROAD + 1.5:
                    tops.append((batch['material'], face))
            elif batch['material'] in SLAB_KEYS:
                walls.append(face)
    gi = R.Grid(250.)
    for i, face in enumerate(ground):
        gi.add(i, R.bbox([p[:2] for p in face]))

    def height(p):
        """The highest ground face under p (interpolated on a ramp), 0 on bare floor."""
        best = 0.
        for i in gi.query((p[0], p[1], p[0], p[1])):
            (x1, y1, z1), (x2, y2, z2), (x3, y3, z3) = ground[i]
            det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3)
            if abs(det) < 1e-9 or not _tri_contains([q[:2] for q in ground[i]], p):
                continue
            l1 = ((y2 - y3) * (p[0] - x3) + (x3 - x2) * (p[1] - y3)) / det
            l2 = ((y3 - y1) * (p[0] - x3) + (x1 - x3) * (p[1] - y3)) / det
            best = max(best, l1 * z1 + l2 * z2 + (1 - l1 - l2) * z3)
        return best
    wi, wsegs = R.Grid(250.), []
    for face in walls:
        pts = sorted({(round(p[0], 2), round(p[1], 2)) for p in face})
        a, b = max(((p, q) for p in pts for q in pts), key=lambda pq: math.dist(*pq))
        wi.add(len(wsegs), R.bbox([a, b], 2))
        wsegs.append((a, b, min(p[2] for p in face), max(p[2] for p in face)))
    key = lambda p: (round(p[0], 1), round(p[1], 1), round(p[2], 1))      # noqa: E731
    seen, owner = {}, {}
    for mat, face in tops:
        for i in range(3):
            a, b, c = face[i], face[(i + 1) % 3], face[(i + 2) % 3]
            k = tuple(sorted((key(a), key(b))))
            seen[k] = seen.get(k, 0) + 1
            owner[k] = (a, b, c, mat)
    capture = [s for s in world.segs if s['name'] in CAPTURE_STREETS and not s['excluded']]
    edges, opened = 0, []
    for k, n in seen.items():
        a, b, c, mat = owner[k]
        if n != 1 or math.dist(a[:2], b[:2]) < 2.:
            continue
        edges += 1
        mid, z = R.lerp(a[:2], b[:2], .5), (a[2] + b[2]) / 2
        u = R.unit(a[:2], b[:2])[0]
        nrm = (-u[1], u[0])
        if (c[0] - mid[0]) * nrm[0] + (c[1] - mid[1]) * nrm[1] > 0:
            nrm = (-nrm[0], -nrm[1])                 # away from the face's third corner: out of the slab
        o = R.add(mid, nrm, 1.)
        g = height(o)
        if z - g <= 2.5 or world.in_building(o) or world.in_building(R.add(o, nrm, 8.)) or world.in_park(o):
            continue
        if any(R.seg_dist(mid, wsegs[i][0], wsegs[i][1]) < 2. and wsegs[i][3] >= z - 1 and wsegs[i][2] <= g + 1
               for i in wi.query((mid[0], mid[1], mid[0], mid[1]))):
            continue
        near = min((R.seg_dist(mid, s['pa'], s['pb']) for s in capture), default=1e9)
        opened.append((mat, [round(v) for v in mid], round(z - g, 1), round(math.dist(a[:2], b[:2])), round(near)))
    assert edges > 100000, edges
    assert len(opened) <= OPEN_STEPS_MAX, (len(opened), sorted(opened, key=lambda r: -r[3])[:10])
    assert all(r[3] < 200 for r in opened), [r for r in opened if r[3] >= 200]
    assert all(r[3] < 100 for r in opened if r[4] < 2500), [r for r in opened if r[4] < 2500 and r[3] >= 100]
    by = {}
    for r in opened:
        by[r[0]] = by.get(r[0], 0) + 1
    return {'outer_edges': edges, 'open_steps': len(opened), 'by_material': dict(sorted(by.items())),
            'longest_cm': max((r[3] for r in opened), default=0),
            'on_capture_streets': sum(1 for r in opened if r[4] < 2500)}


def main():
    report = {'lane_fixtures': check_lane_fixtures(), 'laundry_fixture': check_laundry_fixture(),
              'laundry_crown_fixture': check_laundry_crown_fixture(), 'crown_scaling': check_crown_scaling(),
              'gallery_fixture': check_gallery_fixture(), 'missing_plex_glass': check_missing_plex_glass()}
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        world, results = replica.prepare(a)
        replica.prepare(b)
        fa, fb = files(a), files(b)
        assert fa.keys() == fb.keys() and all(fa[k] == fb[k] for k in fa), \
            'Non-deterministic output: ' + str([k for k in fa if fa.get(k) != fb.get(k)][:5])
        out = Path(a)
        report['determinism'] = f'{len(fa)} files byte-identical across two builds'

        streets = json.loads((out / 'Streets/manifest.json').read_text())
        soul = json.loads((out / 'Soul/manifest.json').read_text())
        furniture = json.loads((out / 'Furniture/placements.json').read_text())
        furniture_rows = furniture['placements']
        soul_rows = json.loads((out / 'Soul/placements.json').read_text())
        check_schema(streets, out / 'Streets')
        check_schema(soul, out / 'Soul')
        assert json.loads((out / 'Furniture/manifest.json').read_text())['layer'] == 'Furniture'

        # Runtime naming couplings (QuebecGameplay.cpp: SM_Asphalt*, SM_Concrete_Collision*).
        for batch in streets['batches']:
            if batch['material'] in ('asphalt', 'alley'):
                assert batch['mesh'].startswith('SM_Asphalt'), batch['mesh']
                assert batch['collision'] == 'none'
            if batch['material'] == 'sidewalk':
                assert batch['mesh'].startswith('SM_Concrete_Collision') and batch['collision'] == 'complex'
            if batch['collision'] != 'none':
                assert batch['material'] in ('sidewalk', 'Yard_Grass', 'Yard_Soil', 'yard_path'), batch
        assert all(b['collision'] == 'none' for b in soul['batches'])

        # Geometry: float32-safe faces, curb tops, paint heights, traffic clearance.
        curb_top_area = curb_other_area = 0.
        asphalt_z, paint_z = set(), set()
        degenerate = 0
        collision_faces = []
        for layer, manifest in (('Streets', streets), ('Soul', soul)):
            for batch in manifest['batches']:
                _, faces = parse_obj(out / layer / batch['file'])
                assert len(faces) == batch['triangles']  # OBJ faces are written as triangle fans
                pts = [p for f in faces for p in f]
                for i in range(3):
                    assert abs(min(p[i] for p in pts) - batch['bounds_cm'][i]) < .02
                    assert abs(max(p[i] for p in pts) - batch['bounds_cm'][3 + i]) < .02
                for face in faces:
                    q = [tuple(f32(v) for v in p) for p in face]
                    for k in range(1, len(q) - 1):
                        u = [q[k][j] - q[0][j] for j in range(3)]
                        v = [q[k + 1][j] - q[0][j] for j in range(3)]
                        cross = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
                        if math.sqrt(sum(c * c for c in cross)) < 1e-4:
                            degenerate += 1
                    zs = [p[2] for p in face]
                    flat = max(zs) - min(zs) < .01
                    if batch['material'] == 'sidewalk' and min(zs) > 1:
                        a2 = abs(replica.area([p[:2] for p in face]))
                        if all(abs(z - replica.Z_WALK) < .01 for z in zs):
                            curb_top_area += a2
                        else:
                            curb_other_area += a2
                            assert replica.Z_DROP - .01 <= min(zs) and max(zs) <= replica.Z_WALK + .01
                    if batch['material'] == 'asphalt':
                        assert flat
                        asphalt_z.add(round(zs[0], 3))
                    if batch['material'].startswith('paint') and flat and min(zs) < 8:
                        paint_z.add(round(zs[0], 3))
                    if batch['collision'] != 'none':
                        collision_faces.append(face)
                assert max(p[2] for p in pts) <= (replica.Z_WALK + .31 if batch['collision'] != 'none' else 1300), batch
        assert degenerate == 0, f'{degenerate} triangles collapse in float32'
        assert asphalt_z == {replica.Z_ROAD}, asphalt_z
        assert min(paint_z) >= replica.Z_ROAD + .1 - 1e-6 and max(paint_z) <= replica.Z_ROAD + .25, paint_z
        assert 17 <= replica.Z_WALK <= 25
        share = curb_top_area / (curb_top_area + curb_other_area)
        assert share > .95, f'Only {share:.3f} of the sidewalk top sits at the 18 cm curb height'
        report['curb'] = {'top_cm': replica.Z_WALK, 'share_of_sidewalk_top_at_18cm': round(share, 4)}

        # No collision within 300 cm of any traffic segment; traffic curbs >= 540 cm.
        worst = math.inf
        for face in collision_faces:
            worst = min(worst, world.traffic_distance([p[:2] for p in face], 2000))
        assert worst >= replica.CLEAR - .01, f'Collision {worst:.1f} cm from a traffic centreline'
        for s in world.segs:
            if s['traffic'] and not s['excluded']:
                assert s['curbL'] >= 540 and s['curbR'] >= 540, (s['name'], s['curbL'], s['curbR'])
        report['clearance'] = {'min_collision_to_traffic_cm': round(worst, 1), 'collision_faces': len(collision_faces)}
        walls = wall_orientation(out / 'Streets', streets)
        assert walls['out_of_slab'] >= .9 * walls['walls'], walls
        assert walls['into_slab'] <= .02 * walls['walls'], walls
        assert walls['curb_toward_road'] >= .97 * (walls['curb_toward_road'] + walls['curb_away_from_road']), walls
        report['walls'] = walls
        # Route dashes: apply hides OSM Marking, so the dashes no replica asphalt covers are re-authored.
        uncovered = [f for f in replica.legacy_marking_faces()
                     if not world.surfaces.has((sum(p[0] for p in f) / 4, sum(p[1] for p in f) / 4), 'road')]
        assert 0 < len(uncovered) < 120 and streets['counts']['legacy_route_dashes'] == len(uncovered), \
            (len(uncovered), streets['counts'].get('legacy_route_dashes'))
        report['legacy_route_dashes'] = len(uncovered)
        # They keep the live M_LF_Marking pale yellow (linear .85, .73, .39), not the new white paint.
        legacy = [b for b in streets['batches'] if b['material'] == 'legacy_marking']
        assert legacy and sum(b['triangles'] for b in legacy) == 2 * len(uncovered), legacy
        assert streets['materials']['legacy_marking']['base_color_srgb'] == '#eddea8'
        # Simple concave sidewalk pieces stay (as two triangles); only bow-tie slivers are dropped.
        assert streets['counts']['concave_pieces'] >= 1 and streets['counts']['bowtie_pieces_dropped'] < 40
        quad = [(0, 0), (100, 0), (40, 30), (0, 100)]          # reflex vertex at index 2
        tris = replica.quad_triangles(quad)
        assert all(replica.area(t) > 0 for t in tris) and abs(sum(replica.area(t) for t in tris) - replica.area(quad)) < 1e-6
        # Furniture and soul instances that keep collision are clear of the band too.
        for row in furniture['placements'] + soul_rows['placements']:
            assert row['prop'] in replica.PROP_KEYS, row['prop']
            assert all(math.isfinite(v) for v in row['position']) and 0 <= row['yaw'] < 360
            if row['collision']:
                assert world.traffic_distance(row['position'][:2], 2000) >= replica.CLEAR, row
                # Collider boxes (MAP-PROPS colliders_cm), not just the base point, clear the band.
                for poly in replica.collider_polys(row['prop'], row['position'][:2], row['yaw']):
                    assert world.traffic_distance(poly, 2000) >= replica.CLEAR, (row['prop'], row['position'])

        # Widths: curb-to-curb by street (medians over replica segments).
        widths = {}
        for s in world.segs:
            if not s['excluded'] and s['quad']:
                widths.setdefault(s['name'], []).append(s['curbL'] + s['curbR'])
        median = {k: sorted(v)[len(v) // 2] / 100 for k, v in widths.items() if k}
        for name, lo, hi in (('Rue Rachel Est', 12.5, 16.5), ('Avenue Papineau', 15.5, 19.5),
                             ('Rue Sherbrooke Est', 19.5, 23.5), ('Rue de Mentana', 10, 12.5),
                             ('Rue Fabre', 10, 12.5), ('Rue Garnier', 10, 12.5)):  # spec: plex streets 10-12.5 m
            assert lo <= median[name] <= hi, (name, median[name])
        report['curb_to_curb_m'] = {k: round(median[k], 2) for k in ('Rue Rachel Est', 'Avenue Papineau',
                                                                       'Rue Sherbrooke Est', 'Rue de Mentana',
                                                                       'Rue Fabre', 'Rue Garnier',
                                                                       'Avenue du Parc-La Fontaine')}

        # OSM parity: stops, crossings, lamps, hydrants, BIXI, street names.
        sc, fc = streets['counts'], furniture['counts']
        on_network = sc['osm_stop_nodes_inside'] - sc['stop_nodes_off_network']
        assert sc['stop_bars_osm_stop'] == on_network and fc['sign_stop'] == on_network, (sc, fc)
        styled = {(c['way'], c['seg']) for c in world.crossings if c['style']}
        painted = sum(v for k, v in sc.items() if k.startswith('crosswalks_') and k != 'crosswalks_generated_at_stops')
        assert painted >= .85 * len({w for w, _ in styled}), (painted, len(styled))
        assert sc['crosswalks_continental_yellow'] > 0 and sc['crosswalks_lines_white'] > 0
        lamps = sum(1 for r in furniture['placements'] if r['prop'] in ('lamp_cobra', 'lamp_park') and 'osm_node' in r)
        excluded = sum(1 for n, t in world.node_tags.items() if t.get('highway') == 'street_lamp' and n in world.nodes
                       and replica.inside(world.latlon[n]) and world.route_near(world.nodes[n]))
        assert lamps == fc['osm_lamps_inside'] - excluded, (lamps, fc['osm_lamps_inside'], excluded)
        hydrant_excl = sum(1 for n, t in world.node_tags.items() if t.get('emergency') == 'fire_hydrant' and
                           n in world.nodes and replica.inside(world.latlon[n]) and world.route_near(world.nodes[n]))
        assert fc['hydrant'] == fc['osm_hydrants_inside'] - hydrant_excl
        docks = {r['osm_node'] for r in furniture['placements'] if r['prop'] == 'bixi_dock'}
        assert len(docks) >= fc['osm_bixi_inside'] - 2
        names = {w['tags'].get('name') for w in world.ways if w['tags'].get('highway') in replica.DRIVE}
        signs = [r for r in furniture['placements'] if r['prop'] == 'sign_street']
        blades = [r['text'][k] for r in signs for k in ('blade_a', 'blade_b')]
        assert len(signs) >= 40 and all(b['full'] in names for b in blades)
        assert all(b['generic'] in ('Rue', 'Avenue', 'Place', 'Boulevard', '') for b in blades)
        assert all(r['text']['blade_a']['full'] != r['text']['blade_b']['full'] for r in signs)
        assert sc['bollards'] > 100 and sc['bike_track_metres'] > 500, 'Rachel cycle track missing'
        assert sc['tree_pits'] > 200 and sc['yards'] > 1000 and sc['fence_metres'] > 2000

        # Soul: every requested ingredient exists, and neighbouring blocks differ.
        so = soul['counts']
        for key in ('asphalt_patches', 'crack_lines', 'potholes', 'gutter_leaf_drifts', 'litter_patches', 'weed_tufts',
                    'rust_streaks', 'murals', 'chantier_zones', 'utility_poles', 'wire_spans', 'laundry_lines', 'curb_bins',
                    'locked_bikes', 'laundry_poles', 'garments', 'gate_bin_recycling', 'gate_bin_compost',
                    'gate_flower_box', 'gate_bike_locked', 'green_bed_metres', 'green_plants', 'green_arches',
                    'green_planters', 'green_murals', 'tags_fences', 'tags_doors'):
            assert so[key] > 0, key
        report['lane_life'] = check_lane_life(world, out, soul, soul_rows['placements'])
        report['laundry_view'] = check_laundry_view(world, out)
        report['washing'] = check_washing(out, soul)
        report['laundry_crowns'] = check_laundry_crowns(out)
        report['leaf_litter'] = check_leaf_litter(world, out, soul, streets)
        report['park_leaves'] = check_park_leaves_under_litter(out, soul)
        report['litter_edges'] = check_litter_edges(out, soul)
        report['lane_litter'] = check_lane_litter(world, out, soul)
        report['city_poles'] = check_city_poles(world, furniture_rows)
        report['gallery_life'] = check_gallery_life(world, out, soul, soul_rows['placements'])
        report['street_trees'] = check_street_trees(world, out, streets)
        report['reseated_trees'] = check_reseated_trees(world, out, streets)
        report['pit_dressing'] = check_pit_dressing(world, out, streets)
        report['ruelle_gutter'] = check_ruelle_gutter(world, out, streets, soul)
        report['over_old_road'] = check_over_old_road(out, streets, soul)
        report['soul_overlays'] = check_soul_overlays(out, streets, soul)
        report['ruelle_paving'] = check_ruelle_paving(world, out, streets, soul_rows['placements'])
        report['lane_corridor'] = check_lane_corridor(world, out, streets)
        report['capture_coverage'] = check_capture_coverage(world, out, streets)
        report['planting'] = check_planting(out, streets, soul)
        report['open_steps'] = check_open_steps(world, out, streets)
        bins = {}
        for row in soul_rows['placements']:
            if row['prop'].startswith('bin_'):
                cell = (math.floor(row['position'][0] / 10000), math.floor(row['position'][1] / 10000))
                bins.setdefault(cell, []).append(round(row['position'][0] % 10000 / 100))
        patterns = [tuple(sorted(v)) for v in bins.values() if len(v) > 3]
        assert len(set(patterns)) == len(patterns), 'Two blocks repeat the same bin arrangement'

        # Budgets.
        assert streets['counts']['triangles'] < 900000 and soul['counts']['triangles'] < 300000
        assert len(streets['batches']) <= 250 and len(soul['batches']) <= 200
        report['budget'] = {'streets_batches': len(streets['batches']), 'streets_triangles': streets['counts']['triangles'],
                            'soul_batches': len(soul['batches']), 'soul_triangles': soul['counts']['triangles'],
                            'furniture_placements': len(furniture['placements']),
                            'soul_placements': len(soul_rows['placements'])}

    # Apply plan against the committed data (when generated): labels, materials and instances.
    if (replica.OUT / 'Streets/manifest.json').is_file():
        the_plan = apply_replica.plan(replica.ROOT)
        labels = [a['label'] for a in the_plan['actors']]
        assert len(labels) == len(set(labels)) and all(l.startswith(apply_replica.PREFIX) for l in labels)
        assert all(m['asset'].startswith(apply_replica.MATERIALS + '/M_Replica_') for m in the_plan['materials'])
        assert all(m['duplicate_of'].startswith('/Game/Plateau/Materials/M_') or m['duplicate_of'] in apply_replica.BUILT_PARENTS
                   for m in the_plan['materials'])
        assert all(p['asset'] in apply_replica.BUILT_PARENTS for p in the_plan['parents'])
        props = json.loads((replica.OUT / 'Props/manifest.json').read_text()) if (replica.OUT / 'Props/manifest.json').is_file() else None
        if props:
            glowing = {k for k, v in props['materials'].items() if v.get('emissive_srgb')}
            planned = {m['key'] for m in the_plan['materials'] if m['layer'] == 'Props' and m['emissive_srgb']}
            assert planned == glowing and all(m['duplicate_of'].endswith('/M_Glow') for m in the_plan['materials']
                                              if m['emissive_srgb']), (planned, glowing)
            slots = props['props']['bixi_dock']['slots']
            docks = [r for r in furniture_rows if r['prop'] == 'bixi_dock']
            bikes = [r for r in furniture_rows if r['prop'] == 'bixi_bike']
            for bike in bikes:
                dock = next(d for d in docks if d['osm_node'] == bike['osm_node'] and d['module'] == bike['module'])
                sx, sy, _ = slots[bike['slot']]['position_cm'][0], slots[bike['slot']]['position_cm'][1], 0
                want = replica.local_to_world(dock['position'][:2], dock['yaw'], (sx, sy))
                assert math.dist(want, bike["position"][:2]) < .1, bike
            assert bikes and len({b['osm_node'] for b in bikes}) >= len({d['osm_node'] for d in docks}) - 2
        mats = {m['asset']: m for m in the_plan['materials']}
        meshes = {m['asset']: m for m in the_plan['meshes']}
        for inst in the_plan['instances']:
            assert inst['material'] in mats, inst['label']
            if inst['collision']:
                assert meshes[inst['mesh']]['colliders'], inst['label'] + ' collides without simple collision'
        labels_i = [i['label'] for i in the_plan['instances']]
        assert len(labels_i) == len(set(labels_i))
        if props:
            colliding = {r['prop'] for r in furniture_rows + soul_rows['placements'] if r['collision']}
            assert colliding <= {k for k, v in props['props'].items() if v.get('colliders_cm')}, colliding
            assert any(i['collision'] for i in the_plan['instances'])
            assert the_plan['counts']['variant_materials_used'] > len({i['prop'] for i in the_plan['instances']})
        for m in the_plan['materials']:
            if m['key'] in ('asphalt', 'alley') and m['layer'] == 'Streets':
                assert m['duplicate_of'].endswith('/M_Asphalt') and m['texture_mean'] == 'asphalt_02'
            if m['texture_mean']:
                need = max(c / t for c, t in zip(apply_replica.linear(m['base_color_srgb']), m['mean_linear']))
                assert need <= apply_replica.TINT_LIMIT, (m['asset'], need)
        report['textures'] = check_textures(the_plan)
        report['prop_shadows'] = check_prop_shadows(the_plan)
        report['planned_collision'] = check_plan_clearance(world, the_plan)
        report['shared_keys'] = check_shared_plan()
        report['yard_trees'] = check_yard_trees(the_plan)
        report['street_tree_plan'] = check_street_tree_plan(the_plan)
        report['editor_side'] = check_editor_side()
        report['set_authority'] = check_set_authority()
        ini = (replica.ROOT / 'Config/DefaultGame.ini').read_text()
        assert '+DirectoriesToAlwaysCook=(Path="/Game/Plateau/Replica/Props")' in ini, 'Props folder is not always cooked'
        header = (replica.ROOT / 'Source/Quebec/QuebecReplicaInstances.h').read_text()
        source = (replica.ROOT / 'Source/Quebec/QuebecReplicaInstances.cpp').read_text()
        assert apply_replica.INSTANCES_CLASS == '/Script/Quebec.QuebecReplicaInstances'
        assert 'class QUEBEC_API AQuebecReplicaInstances : public AActor' in header
        assert 'SetMobility(EComponentMobility::Static)' in source and 'RootComponent = Instances' in source
        report['apply_plan'] = the_plan['counts']
    print(json.dumps(report, indent=1, ensure_ascii=False))
    print('Plateau replica checks passed')


if __name__ == '__main__':
    main()
