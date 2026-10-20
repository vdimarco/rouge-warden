"""CPU checks for the replica surface textures (Scripts/plateau_textures.py).

Run from games/nord-unreal:  python3 Scripts/test_plateau_textures.py
Builds the textures twice into temporary directories (about a minute on four cores), then checks byte-identical
output (also against a build in this process), the PNG structure, seamless tiling, the ashlar, slate, siding,
herringbone, buff-brick and card layouts, the cut-out alpha (coverage, anti-aliased edges, guard openings), the
normal maps, colour and roughness means, the large-scale variation of the gravel, ballast and tar tiles, the macro
mask, the shared material keys, the tints the apply step will need, and that the committed folder matches the
generator.
"""
import hashlib
import json
from math import sqrt
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import plateau_textures as T  # noqa: E402
import apply_plateau_replica as apply_replica  # noqa: E402

# The shared material keys of the rear pass (plateau_plex.py and the apply step use exactly these names).
SHARED_KEYS = ('Roof_Membrane', 'Roof_Gravel', 'Roof_Tar', 'Sheet_Metal', 'Siding_Lap_Cream', 'Siding_Lap_Grey',
               'Parged', 'Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Creeper', 'Yard_Grass', 'Yard_Pavers',
               'Yard_Soil', 'Yard_Gravel', 'Brick_Buff_Even')
CUTOUT_KEYS = ('Rail_Baluster', 'Rail_Lattice', 'Fence_Boards')


def files(directory):
    return {p.name: p.read_bytes() for p in sorted(Path(directory).iterdir()) if p.is_file()}


def pixels(data):
    """(width, height, channels, rows of bytes) from a PNG written by plateau_textures.png()."""
    width, height, channels, raw = T.read_png_channels(data)
    stride = 1 + channels * width
    assert all(raw[y * stride] == 0 for y in range(height)), 'Expected filter type 0 on every scanline'
    return width, height, channels, [raw[y * stride + 1:(y + 1) * stride] for y in range(height)]


def rgb(rows, channels):
    """Rows as RGB bytes (drops alpha)."""
    if channels == 3:
        return rows
    out = []
    for r in rows:
        b = bytearray(len(r) // 4 * 3)
        b[0::3], b[1::3], b[2::3] = r[0::4], r[1::4], r[2::4]
        out.append(bytes(b))
    return out


def seam_ratio(width, height, rows):
    """Mean |difference| across the wrap seam over the step a seam may show, per axis.

    The allowed step is the larger of the mean neighbour step and its 98th percentile: a joint that
    happens to run next to the tile edge makes a large but legitimate step there, as it does inside.
    """
    sample = rows[::3]

    def col(x):
        return [r[3 * x + c] for r in sample for c in range(3)]

    def step(a, b):
        return sum(abs(p - q) for p, q in zip(a, b)) / len(a)

    def allowed(steps):
        steps = sorted(steps)
        return max(sum(steps) / len(steps), steps[int(.98 * (len(steps) - 1))])

    cols = [col(x) for x in range(width)]
    inner_x = allowed([step(cols[x], cols[x + 1]) for x in range(width - 1)])
    inner_y = allowed([step(rows[y], rows[y + 1]) for y in range(height - 1)])
    return step(cols[-1], cols[0]) / inner_x, step(rows[height - 1], rows[0]) / inner_y


def runs(values, threshold=128, opaque=False):
    """Lengths of the cyclic runs of texels below (or, with opaque, at or above) threshold in one row."""
    flags = [(v >= threshold) == opaque for v in values]
    if all(flags):
        return [len(flags)]
    start = flags.index(False)
    flags = flags[start:] + flags[:start]
    out, n = [], 0
    for f in flags:
        if f:
            n += 1
        elif n:
            out.append(n)
            n = 0
    if n:
        out.append(n)
    return out


def check_layouts():
    spec = T.SETS['limestone']
    width, height = spec['size_px']
    px_cm = width / (spec['tile_m'][0] * 100)
    layout = T.ashlar_layout(spec['seed'], width, height, px_cm)
    assert len(layout['heights']) == T.COURSES and sum(layout['heights']) == height
    for h in layout['heights']:
        assert 27 <= h / px_cm <= 42, f'Course of {h / px_cm:.1f} cm'
    for c, joints in enumerate(layout['joints']):
        lengths = [((joints[(i + 1) % len(joints)] - joints[i]) % width) / px_cm for i in range(len(joints))]
        assert abs(sum(lengths) - spec['tile_m'][0] * 100) < 1e-6 and 2 <= len(joints) <= 4
        assert all(T.STONE_CM[0] - 1e-6 <= v <= T.STONE_CM[1] + 1e-6 for v in lengths), (c, lengths)
        above = layout['joints'][c - 1]    # course 0 against the last course: the tile wraps vertically
        gap = min(T.cyclic_gap(a, b, width) for a in joints for b in above) / px_cm
        assert gap >= T.MIN_JOINT_OFFSET_CM - 1e-6, f'Joints of courses {c - 1} and {c} only {gap:.1f} cm apart'
    s = T.slate_layout(T.SETS['slate'])
    assert abs(s['exposure'] / s['px_cm'] - 12.5) < 1e-9 and abs(s['w'] / s['px_cm'] - T.SLATE_WIDTH_CM) < 1e-9
    assert T.SLATE_ROWS % 2 == 0, 'Half-bond rows must wrap with an even row count'
    assert T.FISH_ROWS and all(0 < r < T.SLATE_ROWS - 1 for r in T.FISH_ROWS)
    # Lap siding: 10 cm courses fill the tile, one butt joint per course, staggered by 40 cm or more.
    siding = T.SETS['siding']
    assert abs(siding['tile_m'][1] * 100 / T.LAP_ROWS - 10.) < 1e-9
    joints = T.lap_joints(siding['seed'], T.LAP_ROWS, siding['tile_m'][0] * 100)
    for r in range(T.LAP_ROWS):
        assert T.cyclic_gap(joints[r], joints[r - 1], siding['tile_m'][0] * 100) >= T.LAP_JOINT_GAP_CM - 1e-9, r
    # Herringbone: every 10 cm cell of the 4 x 4 unit belongs to exactly one 10 x 20 paver, and the k-th
    # motif is the (k, k) translate of the first (a 90-degree herringbone).
    motif = T.herringbone()
    assert sorted(motif) == [(i, j) for i in range(4) for j in range(4)]
    pavers = {}
    for (i, j), (kind, dx, dy) in motif.items():
        pavers.setdefault(((i - dx) % 4, (j - dy) % 4, kind), []).append((i, j))
    assert len(pavers) == 8 and all(len(v) == 2 for v in pavers.values())
    assert sorted(k[:2] for k in pavers if k[2] == 'h') == [(k, k) for k in range(4)]
    # Guard and lattice dimensions: openings under 10 cm, as the gallery guard rules ask.
    assert T.GUARD_BANDS_CM['gap'][1] <= 10. and 100. / T.BALUSTERS_PER_M - T.BALUSTER_CM < 10.
    assert abs(100. / T.LATTICE_PER_M / sqrt(2) - T.LATH_CM - 4.06) < .01
    # Deterministic sin and cos (no C library): within 1e-10 of the true values.
    import math
    worst = max(max(abs(T.sin_cos(t / 997.)[0] - math.sin(2 * math.pi * t / 997.)),
                    abs(T.sin_cos(t / 997.)[1] - math.cos(2 * math.pi * t / 997.))) for t in range(-2000, 2001))
    assert worst < 1e-10, worst
    return {'limestone_courses_cm': [round(h / px_cm, 1) for h in layout['heights']],
            'limestone_stones_per_course': [len(j) for j in layout['joints']],
            'siding_butt_joints_cm': [round(v, 1) for v in joints], 'sin_cos_error': worst}


def check_slate_gaps(rows, spec):
    """Mid-row of a rectangular course: the cavity channel marks the joints between slates, not their middles."""
    s = T.slate_layout(spec)
    r = 2
    y = int(r * s['exposure'] + s['exposure'] * .45) + s['shift']
    offset = s['offsets'][r]
    joints = [int(offset + k * s['w']) % spec['size_px'][0] for k in range(s['per_row'])]
    middles = [int(offset + (k + .5) * s['w']) % spec['size_px'][0] for k in range(s['per_row'])]
    cavity = rows[y][2::3]
    assert all(max(cavity[max(0, x - 2):x + 3]) > 200 for x in joints), 'Missing slate joints'
    assert all(cavity[x] < 30 for x in middles), 'Cavity in the middle of a slate'


def row_at(spec, z_cm):
    """Image row of a card at z_cm above the card's bottom edge."""
    height = spec['size_px'][1]
    return min(height - 1, max(0, int(height - z_cm / (spec['card_height_m'] * 100.) * height)))


def check_cutout(key, spec, entry, rows):
    """Alpha of a cut-out set: coverage, soft edges about the clip, a colour under holes, and its openings."""
    width = spec['size_px'][0]
    alpha = [r[3::4] for r in rows]
    values = [v for a in alpha for v in a]
    edge = sum(1 for v in values if 0 < v < 255) / len(values)
    assert values.count(0) and values.count(255) and edge > .002, (key, 'alpha must be a mask with soft edges', edge)
    # Holes keep the surface colour (no dark halo when the mips blend RGB across the edge).
    hole = [sum(r[c::4][x] for r, a in zip(rows, alpha) for x in range(width) if a[x] == 0) for c in range(3)]
    solid = [sum(r[c::4][x] for r, a in zip(rows, alpha) for x in range(width) if a[x] == 255) for c in range(3)]
    n_hole = sum(1 for v in values if v == 0)
    n_solid = sum(1 for v in values if v == 255)
    ratio = sum(hole) / n_hole / (sum(solid) / n_solid)
    assert .6 < ratio < 1.6, (key, 'colour under the holes', ratio)
    out = {'coverage': entry['coverage'], 'soft_edge_share': round(edge, 4), 'hole_colour_ratio': round(ratio, 3)}
    px_cm = width / (spec['tile_m'][0] * 100.)
    if key == 'balusters':
        assert .38 <= entry['coverage'] <= .5, entry['coverage']
        gaps = runs(alpha[row_at(spec, 50.)])
        assert len(gaps) == T.BALUSTERS_PER_M and all(g / px_cm < 10. for g in gaps), gaps
        assert max(alpha[row_at(spec, 2.5)]) == 0, 'The drain gap under the bottom rail must be open'
        for z in (9., 98., 105.):
            assert min(alpha[row_at(spec, z)]) == 255, f'Rail at {z} cm must be solid'
        out['clear_gap_cm'] = round(max(gaps) / px_cm, 2)
    elif key == 'lattice':
        assert .65 <= entry['coverage'] <= .85, entry['coverage']
        gaps = runs(alpha[row_at(spec, 50.)])
        assert all(g / px_cm < 4.06 * sqrt(2) + .5 for g in gaps) and max(gaps) / px_cm > 3., gaps
        for z in (2.5, 97.5):
            assert min(alpha[row_at(spec, z)]) == 255, f'Frame at {z} cm must be solid'
        out['widest_opening_along_run_cm'] = round(max(gaps) / px_cm, 2)
    elif key == 'fence_boards':
        assert .8 <= entry['coverage'] <= .95, entry['coverage']
        row = alpha[row_at(spec, 100.)]
        boards, gaps = runs(row, opaque=True), runs(row)
        assert len(boards) == T.FENCE_BOARDS and all(1. <= g / px_cm <= 3.4 for g in gaps), (boards, gaps)
        for lo, hi in T.FENCE_RAILS_CM:
            assert min(alpha[row_at(spec, (lo + hi) / 2.)]) == 255, 'The rails must show through the gaps'
        assert max(alpha[row_at(spec, .5)]) == 0, 'Boards stand clear of the ground'
        out['gaps_cm'] = [round(min(gaps) / px_cm, 2), round(max(gaps) / px_cm, 2)]
    elif key == 'creeper':
        assert .7 <= entry['coverage'] <= .9, entry['coverage']
        green = sum(1 for r, a in zip(rows, alpha) for x in range(width) if a[x] >= 128 and r[4 * x + 1] > r[4 * x])
        share = green / n_solid
        assert .03 < share < .25, ('some leaves stay green', share)
        out['green_leaf_share'] = round(share, 3)
    return out


# Expected colour (mean linear) and roughness per set.
EXPECT = {
    'limestone': lambda m, r: .18 < sum(m) / 3 < .38 and max(m) / min(m) < 1.2 and .8 <= r <= .92,
    'slate': lambda m, r: sum(m) / 3 < .12 and m[2] > m[0] and m[2] > m[1] and .44 <= r <= .56,
    'membrane': lambda m, r: sum(m) / 3 > .55 and max(m) / min(m) < 1.1 and .35 <= r <= .6,
    'ballast': lambda m, r: .3 < sum(m) / 3 < .6 and max(m) / min(m) < 1.2 and .75 <= r <= .95,
    # Tar and gravel reads dark grey from above, about #4A4744 (linear .0685, .0648, .0595), not black.
    'tar': lambda m, r: all(abs(v / t - 1.) < .12 for v, t in zip(m, (.0685, .0648, .0595))) and .5 <= r <= .75,
    # Weathered galvanised sheet: light grey and dull (roughness about .6), not a mirror.
    'sheet_metal': lambda m, r: .25 < sum(m) / 3 < .45 and m[2] >= m[0] and max(m) / min(m) < 1.15 and .52 <= r <= .68,
    'siding': lambda m, r: sum(m) / 3 > .55 and max(m) / min(m) < 1.1 and .4 <= r <= .6,
    'parging': lambda m, r: .2 < sum(m) / 3 < .4 and max(m) / min(m) < 1.2 and .75 <= r <= .92,
    'balusters': lambda m, r: sum(m) / 3 > .4 and max(m) / min(m) < 1.25 and .55 <= r <= .75,
    'lattice': lambda m, r: sum(m) / 3 > .4 and max(m) / min(m) < 1.3 and .6 <= r <= .8,
    'fence_boards': lambda m, r: .2 < sum(m) / 3 < .45 and m[0] > m[1] > m[2] and .7 <= r <= .9,
    'creeper': lambda m, r: m[0] > 4 * m[1] and m[0] > 4 * m[2] and .45 <= r <= .7,
    'lawn': lambda m, r: m[1] > m[0] > m[2] and .85 <= r <= .95,
    'pavers': lambda m, r: .15 < sum(m) / 3 < .35 and max(m) / min(m) < 1.35 and .75 <= r <= .85,
    'soil': lambda m, r: sum(m) / 3 < .1 and m[0] > m[1] > m[2] and .8 <= r <= .95,
    'crushed_stone': lambda m, r: .15 < sum(m) / 3 < .3 and max(m) / min(m) < 1.2 and .8 <= r <= .92,
    # Even buff brick: yellow-tan (red over green over blue, blue well under red), light, matte.
    'buff_brick': lambda m, r: .3 < sum(m) / 3 < .5 and m[0] > m[1] > m[2] and m[2] / m[0] < .5 and .8 <= r <= .92,
}
# Sets whose tile must not read as a grid on a large roof or yard: 2 m tiles with 25 cm to 1 m zones. Minimum
# coefficient of variation of the mean luminance of 25 cm and 50 cm blocks (the 1 m tiles of the last pass had
# .04 and .01 to .016).
LARGE_SCALE = {'ballast': (.08, .05), 'tar': (.15, .1), 'crushed_stone': (.07, .05)}


def check_shared_keys(index):
    """Each shared key belongs to exactly one set, and the set's material block says how the apply step builds it."""
    owner = {}
    for name, spec in T.SETS.items():
        for key in spec['keys']:
            assert key not in owner, f'{key} is in two sets'
            owner[key] = name
    assert sorted(owner) == sorted(SHARED_KEYS), sorted(set(owner) ^ set(SHARED_KEYS))
    for key, name in owner.items():
        entry = index['sets'][name]
        assert key in entry['keys'] and entry['material'] == T.SURFACES[T.SETS[name]['surface']]
        masked = entry['material']['blend_mode'] == 'masked'
        assert masked == entry['alpha'] == (key in CUTOUT_KEYS or key == 'Leaf_Creeper'), key
        assert entry['material']['two_sided'] == masked
        assert (entry['uv'] == 'card') == (key in CUTOUT_KEYS), key
        if key in CUTOUT_KEYS:
            assert entry['tiling'][1] == 1. and entry['card_height_m'] > .5, key
        if key == 'Leaf_Creeper':
            assert entry['material']['shading_model'] == 'two_sided_foliage'
        assert apply_replica.texture_set(key, {}) == name, (key, apply_replica.texture_set(key, {}))
    return {key: owner[key] for key in SHARED_KEYS}


def main():
    report = {'layouts': check_layouts()}
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        index = T.prepare(a)
        T.prepare(b)
        fa, fb = files(a), files(b)
        assert fa.keys() == fb.keys() and all(fa[k] == fb[k] for k in fa), \
            'Non-deterministic output: ' + str([k for k in fa if fa.get(k) != fb.get(k)])
        assert len(fa) == 1 + 3 * len(T.SETS)
        # A set built in this process (no worker pool) gives the same pixels as the pooled build.
        _, solo = T.build('lattice')
        assert all(solo['maps'][r]['raw_sha256'] == index['sets']['lattice']['maps'][r]['raw_sha256'] for r in T.ROLES)
        report['determinism'] = f'{len(fa)} files byte-identical across two builds and an in-process rebuild'
        report['shared_keys'] = check_shared_keys(index)
        plex = apply_replica.ROOT / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json'
        plex_materials = json.loads(plex.read_text())['materials'] if plex.is_file() else {}
        summary, sets = {}, {}
        for key, spec in T.SETS.items():
            entry = index['sets'][key]
            assert entry['size_px'] == list(spec['size_px']) and entry['tile_m'] == list(spec['tile_m'])
            assert all(abs(t * m - 1) < 1e-6 for t, m in zip(entry['tiling'], entry['tile_m']))
            assert all(n & (n - 1) == 0 for n in spec['size_px']), f'{key}: power-of-two sizes keep their mips'
            card = key in T.CARDS
            maps = {}
            for role in T.ROLES:
                m = entry['maps'][role]
                data = fa[m['file']]
                assert hashlib.sha256(data).hexdigest() == m['sha256']
                assert hashlib.sha256(T.read_png(data)[2]).hexdigest() == m['raw_sha256']
                assert (m['srgb'], m['compression'], m['sampler']) == tuple(T.IMPORT[role][k] for k in ('srgb', 'compression', 'sampler'))
                width, height, channels, rows = pixels(data)
                assert [width, height] == entry['size_px']
                assert channels == (4 if role == 'diff' and entry['alpha'] else 3), (m['file'], channels)
                sx, sy = seam_ratio(width, height, rgb(rows, channels))
                assert sx < 1.6 and (card or sy < 1.6), f'{m["file"]} seam {sx:.2f} x {sy:.2f} the neighbour step'
                maps[role] = rows
                summary[m['file']] = {'bytes': len(data), 'sha256': m['sha256'][:16], 'seam': [round(sx, 2), round(sy, 2)]}
            # Normals: unit length, no overall tilt (a tileable height field has zero mean slope), mostly facing out.
            n = maps['nor_dx']
            r_mean, g_mean, b_mean = (T.channel_mean(n, c) for c in range(3))
            assert abs(r_mean - .5) < .02 and abs(g_mean - .5) < .02 and b_mean > .9, (key, r_mean, g_mean, b_mean)
            worst = max(abs(sqrt(sum((row[3 * x + c] / 127.5 - 1) ** 2 for c in range(3))) - 1)
                        for row in n[::17] for x in range(0, len(row) // 3, 13))
            assert worst < .02, (key, worst)
            # Colour and roughness.
            mean = entry['mean_linear']
            channels = 4 if entry['alpha'] else 3
            alpha = [r[3::4] for r in maps['diff']] if entry['alpha'] else None
            assert mean == T.linear_mean(maps['diff'], channels)
            assert abs(entry['roughness_mean'] - T.channel_mean(maps['rough'], 0, alpha)) < 1e-4
            assert EXPECT[key](mean, entry['roughness_mean']), (key, mean, entry['roughness_mean'])
            assert entry['base_color_srgb'] == T.to_srgb_hex(mean)
            sets[key] = {'mean_linear': mean, 'base_color_srgb': entry['base_color_srgb'],
                         'roughness_mean': entry['roughness_mean'], 'surface': entry['surface']}
            if key == 'slate':
                check_slate_gaps(maps['rough'], spec)
            if entry['alpha']:
                sets[key].update(check_cutout(key, spec, entry, maps['diff']))
            if key == 'sheet_metal':
                assert entry['metallic'] == T.SETS['sheet_metal']['metallic']
            # Tints the apply step derives from the Plex colours stay in range and keep the texture's contrast.
            for name, spec_m in plex_materials.items():
                if apply_replica.texture_set(name, spec_m) == key:
                    tint = [c / m for c, m in zip(apply_replica.linear(spec_m['base_color_srgb']), mean)]
                    floor_ = spec.get('tint_floor', .2)
                    assert floor_ <= min(tint) and max(tint) <= apply_replica.TINT_LIMIT, \
                        (name, tint, f'set base_color_srgb near {entry["base_color_srgb"]}')
                    if key in ('limestone', 'slate'):
                        assert abs(entry['roughness_mean'] - spec_m['roughness']) < .08, (name, entry['roughness_mean'])
                    summary[f'tint {name}'] = [round(t, 3) for t in tint]
                    summary[f'roughness {name}'] = {'manifest': spec_m['roughness'], 'texture': entry['roughness_mean']}
        report['sets'] = sets
        report['maps'] = summary
        # The committed folder is this generator's output (pixel streams; file bytes may vary with zlib).
        committed = T.OUT / T.INDEX
        if committed.is_file():
            stored = json.loads(committed.read_text())
            for key in T.SETS:
                assert key in stored['sets'], f'{key}: rerun python3 Scripts/plateau_textures.py'
                for role in T.ROLES:
                    m = stored['sets'][key]['maps'][role]
                    assert m['raw_sha256'] == index['sets'][key]['maps'][role]['raw_sha256'], \
                        f'{m["file"]}: rerun python3 Scripts/plateau_textures.py'
                    raw = T.read_png((T.OUT / m['file']).read_bytes())[2]
                    assert hashlib.sha256(raw).hexdigest() == m['raw_sha256'], f'{m["file"]} is stale'
                assert stored['sets'][key]['mean_linear'] == index['sets'][key]['mean_linear']
                assert stored['sets'][key]['material'] == index['sets'][key]['material']
            report['committed'] = 'Data/Plateau/ReplicaGeometry/Textures matches the generator'
    print(json.dumps(report, indent=1))
    print('Plateau texture checks passed')


if __name__ == '__main__':
    main()
