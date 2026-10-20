"""CPU checks for the Plateau replica streetscape (Streets, Furniture, Soul).

Run from games/nord-unreal:  python3 Scripts/test_plateau_replica.py
Builds the layers twice into temporary directories (the committed Data folder is not touched),
then checks determinism, manifest schema, runtime naming, curb heights, the 300 cm traffic band,
paint heights, OSM parity of stops/crossings/lamps/hydrants, budgets and the apply plan, including the
texture sets (Scripts/plateau_textures.py) and their textured materials, the shared rear-pass keys on a
synthetic Plex layer (texture set, parent, masked and two-sided cards, built parents, alpha mips, clamped card
maps, macro variation, Preserve Area meshes, hidden Collision_Only walls, the whole-key shadow rule), planned
collision clear of traffic, and the yard-tree actors from Plex/yard_trees.json (species meshes from
Trees/manifest.json, else the shared mesh), the editor side against a fake unreal module; and the third streets pass: no mapped trunk on carriageway asphalt
(curb extensions, the host list), ruelles paved to the fences, curb-to-building coverage on the capture streets,
textured front lawns and card plants.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import tempfile

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
    textures = {t['asset']: t for t in the_plan['textures']}
    assert len(textures) == len(the_plan['textures']) == the_plan['counts']['textures']
    for t in the_plan['textures']:
        macro = t['set'] == 'macro'
        entry = index['macro'] if macro else index['sets'][t['set']]
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
        # Cards span their texture once in V: all three maps clamp V; every tiling map wraps.
        assert t['address_y'] == ('TA_CLAMP' if not macro and entry.get('uv') == 'card' else 'TA_WRAP'), t['asset']
        if macro:
            assert t['role'] == A.MACRO_ROLE and (t['compression'], t['sampler']) == ('TC_MASKS', 'SAMPLERTYPE_MASKS')
    textured = [m for m in the_plan['materials'] if m.get('texture_set')]
    assert len(textured) == the_plan['counts']['textured_replica_materials']
    specs = {layer: json.loads((replica.OUT / layer / 'manifest.json').read_text()).get('materials', {})
             for layer in {m['layer'] for m in the_plan['materials']} if layer != A.TREES}
    for m in the_plan['materials']:
        spec = m['spec'] if m['layer'] == A.TREES else specs[m['layer']][m['key']]
        assert bool(m.get('texture_set')) == bool(A.texture_set(m['key'], spec) and not spec.get('emissive_srgb')
                                                   and 'brick' not in (spec.get('texture') or '')
                                                   and 'asphalt' not in (spec.get('texture') or '')), m['asset']
    for m in textured:
        entry = index['sets'][m['texture_set']]
        surface = plateau_textures.SETS[m['texture_set']]['surface']
        assert m['duplicate_of'] == A.SURFACE_PARENTS[surface] and m['texture_mean'] == 'replica_' + m['texture_set']
        assert (m['blend_mode'], m['two_sided']) == (entry['material']['blend_mode'], entry['material']['two_sided'])
        spec = m['spec'] if m['layer'] == A.TREES else specs[m['layer']][m['key']]
        assert m['wet'] == (surface == 'ground') and m['metallic'] == spec.get('metallic', 0.)
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
        alpha = t['set'] != 'macro' and t['role'] == 'diff' and index['sets'][t['set']]['alpha']
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
                           'Yard_Grass', 'Yard_Pavers', 'Yard_Soil', 'Yard_Gravel', 'Brick_Buff_Even'])
    masked = {'Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper'}
    ground = {'Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Yard_Grass', 'Yard_Pavers', 'Yard_Soil', 'Yard_Gravel'}
    macro = {'Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Yard_Gravel', 'Brick_Buff_Even'}
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
            want_parent = (A.FOLIAGE_PARENT if key == 'Leaf_Creeper' else A.CUTOUT_PARENT if key in masked
                           else A.WET_PARENT if key in ground else A.TEXTURED_PARENT)
            assert m['duplicate_of'] == want_parent, (key, m['duplicate_of'])
            assert (m['blend_mode'] == 'masked') == (key in masked) and m['two_sided'] == (key in masked), key
            assert m['shading_model'] == ('two_sided_foliage' if key == 'Leaf_Creeper' else 'default_lit'), key
            assert m['opacity_mask_clip'] == (.5 if key in masked else None) and m['wet'] == (key in ground), key
            assert m['tiling'] == entry['tiling'] and m['uv'] == ('card' if key in masked - {'Leaf_Creeper'} else 'metres')
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
        assert parents[A.CUTOUT_PARENT]['textures'] == rows[min(masked - {'Leaf_Creeper'})]['textures']
        sets = {A.SHARED_TEXTURE_KEYS[k] for k in keys}
        assert len(the_plan['textures']) == 3 * len(sets) + 1 == the_plan['counts']['textures'], 'three maps a set + macro'
        alpha = sorted(t['set'] for t in the_plan['textures'] if t['alpha'])
        assert alpha == sorted(['balusters', 'lattice', 'fence_boards', 'creeper'])
        clamped = sorted({t['set'] for t in the_plan['textures'] if t['address_y'] == 'TA_CLAMP'})
        assert clamped == sorted(['balusters', 'lattice', 'fence_boards']) and the_plan['counts']['clamped_textures'] == 9
        assert the_plan['counts']['masked_materials'] == 4 and the_plan['counts']['built_parents'] == 2
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
        assert all((shared[k].get('address_y') == 'TA_CLAMP') == (k in masked - {'Leaf_Creeper'}) for k in keys)
        assert all(bool(shared[k].get('macro_strength')) == (k in macro) for k in keys)
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
    return out


TREE_KINDS_FIXTURE = {
    'norway_maple': {'materials': {'bark': 'Bark_Grey', 'leaves': {'base_color_srgb': '#C8902E', 'roughness': .6}},
                     'height_cm': 1500, 'trunk_cm': 45},
    'linden': {'materials': {'bark': 'Bark_Grey', 'leaves': {'base_color_srgb': '#B89A3A', 'roughness': .6}},
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
    """Trees/manifest.json present: each yard tree on its species mesh (maple and elm read as norway_maple and
    linden), uniformly scaled to its height; bark and leaves materials planned once each (leaves as two-sided
    foliage), an existing /Game/ material used as is; a bad manifest or a missing species fails the plan."""
    A = apply_replica
    with tempfile.TemporaryDirectory() as tmp:
        synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=TREE_KINDS_FIXTURE)
        the_plan = A.plan(tmp)
        yard = the_plan['yard_trees']
        assert yard['mode'] == 'species meshes' and yard['mesh'] is None and yard['aliases'] == A.TREE_ALIASES
        assert [t['kind'] for t in the_plan['trees']] == ['norway_maple', 'silver_maple', 'linden']
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
        assert sorted(meshes) == ['linden', 'norway_maple', 'silver_maple'] and the_plan['counts']['tree_meshes'] == 3
        assert all(m['nanite_shape_preservation'] == A.PRESERVE_AREA and m['collision'] == 'none' for m in meshes.values())
        trees = {m['key']: m for m in the_plan['materials'] if m['layer'] == A.TREES}
        assert sorted(trees) == ['Bark_Grey', 'linden_leaves', 'norway_maple_leaves', 'silver_maple_bark']
        assert the_plan['counts']['tree_materials'] == 4
        assert trees['norway_maple_leaves']['foliage'] and not trees['Bark_Grey']['foliage']
        assert not trees['silver_maple_bark']['foliage'] and trees['Bark_Grey']['duplicate_of'].endswith('/M_Trim')
        assert meshes['norway_maple']['materials'] == {'bark': f'{A.MATERIALS}/M_Replica_Trees_Bark_Grey',
                                                       'leaves': f'{A.MATERIALS}/M_Replica_Trees_norway_maple_leaves'}
        assert meshes['silver_maple']['materials']['leaves'] == '/Game/Art/M_DetailedAutumnLeaves'
        assert meshes['linden']['materials']['bark'] == meshes['norway_maple']['materials']['bark']
        assert not any(a['label'].endswith('Tree_norway_maple') for a in the_plan['actors']), 'Trees is not a layer'
        # The preview keeps the shared-mesh fallback when called without species.
        assert [t['kind'] for t in A.plan_trees(A.load_yard_trees(tmp))] == ['maple', 'elm', 'norway_maple', 'silver_maple']
        out = {'species': {t['kind']: t['count'] for t in the_plan['trees']}, 'materials': sorted(trees)}
    bad_cases = (
        ('an unknown kind', dict(TREE_KINDS_FIXTURE, oak=TREE_KINDS_FIXTURE['linden'])),
        ('a missing leaves slot', dict(TREE_KINDS_FIXTURE, linden={'materials': {'bark': 'Bark_Grey'},
                                                                   'height_cm': 1600, 'trunk_cm': 50})),
        ('a stale mesh hash', dict(TREE_KINDS_FIXTURE, linden=dict(TREE_KINDS_FIXTURE['linden'], sha256='0' * 64))),
        ('a silly height', dict(TREE_KINDS_FIXTURE, linden=dict(TREE_KINDS_FIXTURE['linden'], height_cm=50))),
        ('a species with no mesh', {k: v for k, v in TREE_KINDS_FIXTURE.items() if k != 'linden'}))
    for message, kinds in bad_cases:
        with tempfile.TemporaryDirectory() as tmp:
            synthetic_plex(tmp, ['Yard_Grass'], {'trees': TREE_ROWS_FIXTURE}, tree_kinds=kinds)
            try:
                A.plan(tmp)
            except (AssertionError, KeyError, ValueError):
                continue
            raise AssertionError('Accepted a Trees manifest with ' + message)
    return out


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
    assert sum(t['count'] for t in the_plan['trees']) == len(rows)
    kinds = A.load_tree_kinds(replica.ROOT)
    assert (the_plan['yard_trees']['mode'] == 'species meshes') == (kinds is not None)
    if kinds:
        assert {t['kind'] for t in the_plan['trees']} <= set(kinds) and all(
            t['mesh'] == A.tree_mesh_asset(t['kind']) for t in the_plan['trees'])
    return {'present': True, 'mode': the_plan['yard_trees']['mode'],
            'trees': {t['kind']: t['count'] for t in the_plan['trees']}}


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

    def set_static_mesh(self, mesh):
        self.static_mesh = mesh
        return True

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
        LinearColor=lambda r, g, b, a: (r, g, b, a), Vector4=FakeVector4, Vector=vector,
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
        assert len(alpha) == 4 and all(t['object'].get_editor_property('alpha_coverage_thresholds').w == .5 for t in alpha)
        clamped = [t for t in textures.values() if t['object'].get_editor_property('address_y') == 'TA_CLAMP']
        assert sorted({t['set'] for t in clamped}) == ['balusters', 'fence_boards', 'lattice'] and len(clamped) == 9
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
            want = [min(A.TINT_LIMIT, c / m) for c, m in zip(A.linear(spec['base_color_srgb']), row['mean_linear'])]
            assert all(abs(a - b) < 1e-9 for a, b in zip(tint.get_editor_property('constant')[:3], want)), row['key']
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
    return out


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
    return {'murals_face_out': True, 'card_uv': 'u metres, v 0..1', 'tags_on_plane': 12, 'seeded_green_share': len(first) / 400}


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
        assert 250 <= line['span_cm'] and a[2] <= R.LINE_TOP
    for pole in pole_rows:
        F = lots[pole['lot']]['frame']
        assert not world.in_building(pole['position'], 40) and 330 <= pole['height_cm'] <= R.LINE_TOP + R.POLE_TOP
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
        assert m['offset_cm'] in (1.2, R.PLEX_D_FACE + .9)
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
            assert abs(d0 - F.D - 1.2) < .15
            assert not any(a < tag['x_cm'][1] and b > tag['x_cm'][0] for a, b in [(g - 160, g + 160) for g in
                           [lot['rear']['fence']['gate_at']] if g is not None])
        else:
            assert abs(d0 - lot['door'][2] - 1.6) < .15 and lot['door'][0] <= tag['x_cm'][0] < tag['x_cm'][1] <= lot['door'][1]
    return {'laundry_lines': len(lines), 'laundry_poles': len(pole_rows), 'garments': soul['counts']['garments'],
            'gate_props': kinds, 'gate_sides': {s: sum(1 for r in gates if r['side'] == s) for s in ('lane', 'yard')},
            'ruelles_vertes': {'osm_ways': len(rv['alleys']), 'ids': len({r for a in rv['alleys'] for r in a['ruelles']}),
                               'bed_metres': soul['counts']['green_bed_metres'], 'arches': len(rv['arches']),
                               'planters': len(rv['planters']), 'murals': {h: sum(1 for m in painted if m['host'] == h)
                                                                          for h in ('wall', 'fence')}},
            'tags': {k: sum(1 for t in tags if t['on'] == k) for k in ('fence', 'shed door', 'garage door')},
            'street_murals': len(lane['murals'])}


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


def check_street_trees(world, out, streets):
    """No mapped trunk stands on carriageway asphalt: every one the carriageway covers within 3 m of its curb has
    a curb extension over it (raised and colliding only outside the traffic band), the rest are listed for the
    host; extensions merge only where no parked car would fit between them."""
    R = replica
    from plateau_rendering import tree_positions
    saved = tree_positions()
    mine = R.mapped_trees(world)
    assert [int(n) for n, _ in mine] == [t[2] for t in saved] and \
        all(math.dist(p, t[:2]) < .01 for (_, p), t in zip(mine, saved)), 'mapped trees differ from the saved layer'
    doc = json.loads((out / 'Streets/street_trees.json').read_text())
    assert streets['street_trees'] == 'street_trees.json'
    assert streets['street_trees_sha256'] == R.sha_file(out / 'Streets/street_trees.json')
    asphalt = ground_tris(out / 'Streets', streets, lambda m, z: m == 'asphalt')
    cover = ground_tris(out / 'Streets', streets, lambda m, z: m in ('sidewalk', 'curb', 'soil', 'Yard_Grass')
                        and z >= R.Z_DROP - .01)
    host = {r['osm_node']: r for r in doc['host_review']}
    on, left = 0, []
    for node, p in mine:
        if asphalt.contains(p):
            on += 1
            if not cover.contains(p):
                left.append(node)
    assert on == doc['counts']['mapped_trees_on_carriageway'] == streets['counts']['mapped_trees_on_carriageway']
    assert sorted(left) == sorted(host), ('mapped trunks on carriageway asphalt', sorted(set(left) - set(host))[:10])
    assert len(host) <= 25 and all(r['from_curb_cm'] is None or r['from_curb_cm'] > R.BUMP_REACH for r in host.values())
    assert doc['counts']['curb_extension_trees'] + len(host) == on
    A = R.PIT_L / 2 + R.BUMP_MARGIN
    for ext in doc['extensions']:
        assert all(0 <= d <= R.BUMP_REACH for d in ext['from_curb_cm'])
        assert ext['depth_cm'] <= R.BUMP_REACH + R.PIT_D / 2 + R.BUMP_MARGIN + .01
        assert ext['raised_cm'] == 0 or ext['raised_cm'] >= R.RAISED_MIN
        assert all(pit[2] in (R.Z_WALK, R.Z_DROP) for pit in ext['pits'])
        assert (ext['raised_cm'] < ext['depth_cm'] - .01) == bool(ext['flush_reason']), ext
        if ext['edge'] != 'strip':
            continue
        a, b = ext['curb']
        u = R.unit(a, b)[0] if math.dist(a, b) > 1 else (1., 0.)
        spans = []
        for d, pit in zip(ext['from_curb_cm'], ext['pits']):
            s = (pit[0] - a[0]) * u[0] + (pit[1] - a[1]) * u[1]
            D = max(R.BUMP_MIN, d + R.PIT_D / 2 + R.BUMP_MARGIN)
            tau = min(R.BUMP_TAPER_MAX, R.BUMP_TAPER * D)
            spans.append((s - A - tau, s + A + tau))
        spans.sort()
        reach = spans[0][1]
        for x0, x1 in spans[1:]:
            assert x0 - reach < R.PARK_GAP, ('extensions merged across a parking space', ext['trees'])
            reach = max(reach, x1)
    # separate extensions on one curb leave at least a parked car's length between them
    for strip in world.sidewalk_strips:
        cuts = sorted(strip.get('bump_cuts', []))
        for (x0, x1), (y0, y1) in zip(cuts, cuts[1:]):
            assert y0 - x1 >= R.PARK_GAP - 1, ('two extensions closer than a parking space', strip['seg']['name'])
    parking = sum(strip['len'] for strip in world.sidewalk_strips if any(R._parking_sides(strip['seg']).values()))
    taken = sum(x1 - x0 for strip in world.sidewalk_strips if any(R._parking_sides(strip['seg']).values())
                for x0, x1 in strip.get('bump_cuts', []))
    assert taken < .15 * parking, (taken, parking)          # about a tenth of the parking curb gives way to trees
    return {'mapped_trees': len(mine), 'on_carriageway': on, 'extensions': doc['counts']['curb_extensions'],
            'extension_trees': doc['counts']['curb_extension_trees'], 'merged': doc['counts']['curb_extensions_merged'],
            'flush': doc['counts']['curb_extensions_flush'], 'part_flush': doc['counts']['curb_extensions_part_flush'],
            'host_review': len(host), 'parking_curb_taken': round(taken / parking, 4)}


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
        if batch['material'] in ('alley', 'alley_gutter', 'Yard_Gravel'):
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


def check_capture_coverage(world, out, streets):
    """From the curb to the building line on the capture streets, every point (20 cm steps, every metre of curb)
    has sidewalk, parterre, walk or ruelle paving: no taupe floor. A building line counts up to 15 m behind the
    sidewalk; a sample on another carriageway ends the ray."""
    R = replica
    cover = ground_tris(out / 'Streets', streets, lambda m, z: m != 'asphalt' and z >= R.Z_ALLEY - .1)
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
    return {'card_triangles': faces}


def main():
    report = {'lane_fixtures': check_lane_fixtures()}
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
        lamps = sum(1 for r in furniture['placements'] if r['prop'] in ('lamp_cobra', 'lamp_park'))
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
        for key in ('asphalt_patches', 'crack_lines', 'potholes', 'gutter_leaf_drifts', 'weed_tufts', 'rust_streaks',
                    'murals', 'chantier_zones', 'utility_poles', 'wire_spans', 'laundry_lines', 'curb_bins',
                    'locked_bikes', 'laundry_poles', 'garments', 'gate_bin_recycling', 'gate_bin_compost',
                    'gate_flower_box', 'gate_bike_locked', 'green_bed_metres', 'green_plants', 'green_arches',
                    'green_planters', 'green_murals', 'tags_fences', 'tags_doors'):
            assert so[key] > 0, key
        report['lane_life'] = check_lane_life(world, out, soul, soul_rows['placements'])
        report['street_trees'] = check_street_trees(world, out, streets)
        report['ruelle_paving'] = check_ruelle_paving(world, out, streets, soul_rows['placements'])
        report['capture_coverage'] = check_capture_coverage(world, out, streets)
        report['planting'] = check_planting(out, streets, soul)
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
        report['planned_collision'] = check_plan_clearance(world, the_plan)
        report['shared_keys'] = check_shared_plan()
        report['yard_trees'] = check_yard_trees(the_plan)
        report['editor_side'] = check_editor_side()
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
