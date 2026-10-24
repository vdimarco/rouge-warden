"""CPU checks for the replica surface textures (Scripts/plateau_textures.py).

Run from games/nord-unreal:  python3 Scripts/test_plateau_textures.py
Builds the textures twice into temporary directories (about a minute on four cores), then checks byte-identical
output (also against a build in this process), the PNG structure, seamless tiling, the ashlar, slate, siding,
herringbone, buff-brick and card layouts, the cut-out alpha (coverage, anti-aliased edges, guard openings), the
normal maps, colour and roughness means, the large-scale variation of the gravel, ballast and tar tiles, the macro
mask, the shared material keys, the tints the apply step will need, the fallen-leaf litter (the tree atlas's leaf
shapes, mixed colours, darker and damper lower leaves, drifts, a tiling mask, and --check naming a change in the
tree leaf forms), and that the committed folder matches the generator.
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
               'Yard_Soil', 'Yard_Gravel', 'Brick_Buff_Even',
               # fourth pass: the ruelle gutter, cedars, fountain grass, tree-pit planting and guards, laundry
               'Concrete_Lane_Aged', 'Leaf_Cedar', 'Plant_Grass_Fountain', 'Plant_Pit_Flowers', 'Iron_Wrought',
               'Cloth_Laundry',
               # fifth pass: fallen leaves on sidewalks, gutters and lawns
               'Leaf_Litter')
# Cards (uv "card": u metres along the run, v 0..1 up the card, V clamped), the masked keys, the foliage-lit keys,
# the atlas keys (each quad addresses one cell; both axes clamped) and the sets that own their colour.
CUTOUT_KEYS = ('Rail_Baluster', 'Rail_Lattice', 'Fence_Boards', 'Leaf_Cedar', 'Plant_Grass_Fountain',
               'Plant_Pit_Flowers', 'Iron_Wrought')
FOLIAGE_KEYS = ('Leaf_Creeper', 'Leaf_Cedar', 'Plant_Grass_Fountain', 'Plant_Pit_Flowers')
ATLAS_KEYS = ('Cloth_Laundry',)
# Tiling masked sets on metre UVs (wrap both ways): the creeper on walls and the leaf litter on the ground.
MASKED_KEYS = CUTOUT_KEYS + ('Leaf_Creeper', 'Leaf_Litter') + ATLAS_KEYS
OWN_COLOUR = ('tar', 'pit_flowers', 'laundry', 'leaf_litter')


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


def luminance(rows, x, y):
    lin = T.SRGB_TO_LINEAR
    r = rows[y]
    return .2126 * lin[r[3 * x]] + .7152 * lin[r[3 * x + 1]] + .0722 * lin[r[3 * x + 2]]


def check_buff_brick(spec, diff, rough):
    """Even buff brick: 24 bed joints and 8 head joints per course where the layout puts them, grey mortar darker
    than the yellow-tan brick so the grid reads, and an even shade from brick to brick."""
    L = T.brick_layout(spec)
    width, height = spec['size_px']
    px = L['px']
    mx, my = L['module_cm']
    assert abs(mx - 20.) < 1e-9 and abs(3 * my - 20.) < 1e-9 and L['joint_cm'] >= .8, 'Brick module or joint'
    cavity = [r[2::3] for r in rough]
    for c in range(L['courses']):
        # The bed joint on top of course c, and the middle of course c (rows from the layout's roll).
        joint_y = int(((c * my - L['roll_cm'][1]) % L['size_cm'][1]) * px)
        mid_y = int(((c * my + my / 2. - L['roll_cm'][1]) % L['size_cm'][1]) * px)
        assert sum(1 for v in cavity[joint_y] if v > 200) > .95 * width, f'Bed joint over course {c} is not mortar'
        heads = runs(cavity[mid_y], 128, opaque=True)
        assert len(heads) == L['per_course'], (c, heads)
        assert all(4 <= h <= 2 * L['joint_cm'] * px for h in heads), f'Head joints of course {c}: {heads}'
    bricks, mortar, brick_lum = {}, [], []
    for y in range(0, height, 2):
        for x in range(0, width, 2):
            v = cavity[y][x]
            if v > 230:
                mortar.append(luminance(diff, x, y))
            elif v < 10:
                lum = luminance(diff, x, y)
                brick_lum.append(lum)
                r, k = T.brick_at(L, (x + .5) / px, (y + .5) / px)[:2]
                bricks.setdefault((r, k), []).append(lum)
    assert len(bricks) == L['courses'] * L['per_course'], len(bricks)
    m_brick, m_mortar = sum(brick_lum) / len(brick_lum), sum(mortar) / len(mortar)
    assert m_mortar < .88 * m_brick, ('the mortar grid must read darker than the brick', m_mortar, m_brick)
    means = [sum(v) / len(v) for v in bricks.values()]
    mean = sum(means) / len(means)
    spread = (sum((v - mean) ** 2 for v in means) / len(means)) ** .5 / mean
    assert spread < .05, ('even buff brick: per-brick shade varies too much', spread)
    share = sum(1 for r in cavity for v in r if v >= 128) / (width * height)
    assert .12 < share < .26, ('mortar share of the face', share)
    return {'mortar_to_brick_luminance': round(m_mortar / m_brick, 3), 'brick_shade_spread': round(spread, 4),
            'mortar_share': round(share, 4)}


def block_variation(rows, channels, px, block_cm):
    """Coefficient of variation of the mean luminance of square blocks of block_cm: large-scale variation."""
    lin = T.SRGB_TO_LINEAR
    width, height = len(rows[0]) // channels, len(rows)
    b = max(1, round(block_cm * px))
    nx, ny = width // b, height // b
    sums = [0.] * (nx * ny)
    for y in range(ny * b):
        r = rows[y]
        for x in range(nx * b):
            o = channels * x
            sums[(y // b) * nx + x // b] += .2126 * lin[r[o]] + .7152 * lin[r[o + 1]] + .0722 * lin[r[o + 2]]
    vals = [v / (b * b) for v in sums]
    mean = sum(vals) / len(vals)
    return (sum((v - mean) ** 2 for v in vals) / len(vals)) ** .5 / mean


def check_macro(index, data):
    """The macro mask: tileable, three full-range channels near 0.5 that do not follow each other, and tiles that
    are not a whole multiple of any set's tile, so the macro and the detail never line up."""
    entry = index['macro']
    assert entry['file'] == T.macro_file() and entry['tile_m'] == list(T.MACRO['tile_m'])
    assert (entry['srgb'], entry['compression'], entry['sampler']) == (False, 'TC_MASKS', 'SAMPLERTYPE_MASKS')
    assert hashlib.sha256(data).hexdigest() == entry['sha256']
    assert hashlib.sha256(T.read_png(data)[2]).hexdigest() == entry['raw_sha256']
    width, height, channels, rows = pixels(data)
    assert [width, height] == entry['size_px'] and channels == 3
    sx, sy = seam_ratio(width, height, rows)
    assert sx < 1.6 and sy < 1.6, ('macro mask seam', sx, sy)
    values = [[r[c::3] for r in rows] for c in range(3)]
    flat = [[v for r in ch for v in r] for ch in values]
    for c, v in enumerate(flat):
        ordered = sorted(v)
        assert .4 < sum(v) / len(v) / 255. < .6 and ordered[len(v) // 50] < 30 and ordered[-len(v) // 50] > 225, c
    for a in range(3):
        for b in range(a + 1, 3):
            ma, mb = sum(flat[a]) / len(flat[a]), sum(flat[b]) / len(flat[b])
            cov = sum((p - ma) * (q - mb) for p, q in zip(flat[a], flat[b]))
            corr = cov / (sum((p - ma) ** 2 for p in flat[a]) * sum((q - mb) ** 2 for q in flat[b])) ** .5
            assert abs(corr) < .3, ('macro channels follow each other', a, b, corr)
    for key, spec in T.SETS.items():
        for tile in spec['tile_m']:
            for m in T.MACRO['tile_m']:
                ratio = m / tile
                assert abs(ratio - round(ratio)) > .05, (key, m, tile, 'macro tile lines up with the detail tile')
    users = sorted(k for k, s in T.SETS.items() if 'macro' in s)
    for key in users:
        macro = index['sets'][key]['macro']
        assert macro['file'] == entry['file'] and macro['tile_m'] == entry['tile_m'] and macro['channels'] == ['R', 'G']
        s = T.SETS[key]['macro']
        assert macro['strength'] == [s, round(s * T.MACRO['second_scale'], 6)] and 0. < s <= .2, key
    return {'means': entry['mean'], 'tile_m': entry['tile_m'], 'sets': users}


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
    elif key == 'cedar':
        # one soft column per metre: opaque down the middle, open at the run's edges, nothing over the crown
        assert .4 <= entry['coverage'] <= .7, entry['coverage']
        for z in (30., 150., 240.):
            row = alpha[row_at(spec, z)]
            assert row[width // 2] == 255 and row[0] == 0 and row[-1] == 0, ('cedar column at', z)
        assert max(alpha[row_at(spec, T.CEDAR_CROWN_CM + 12.)]) == 0, 'nothing grows over the crown'
        widths = [len([v for v in alpha[row_at(spec, z)] if v >= 128]) / px_cm for z in (40., 140., 240.)]
        assert widths[0] > widths[1] > widths[2] and widths[0] < 2 * T.CEDAR_HALF_CM + 12., ('a column that narrows', widths)
        green = sum(1 for r, a in zip(rows, alpha) for x in range(width) if a[x] == 255 and r[4 * x + 1] > r[4 * x])
        assert green > .85 * n_solid, ('cedar stays green in October', green / n_solid)
        out['green_share'] = round(green / n_solid, 3)
        out['widths_cm'] = [round(w, 1) for w in widths]
    elif key == 'fountain_grass':
        assert .2 <= entry['coverage'] <= .45, entry['coverage']
        assert alpha[row_at(spec, 3.)][width // 2] == 255, 'the clump stands on its crown'
        assert max(alpha[row_at(spec, 92.)]) == 0 and max(a[0] for a in alpha) < 255, 'the clump stays inside the card'
        straw = sum(1 for r, a in zip(rows, alpha) for x in range(width)
                    if a[x] == 255 and r[4 * x] > r[4 * x + 1] > r[4 * x + 2])
        assert straw > .7 * n_solid, ('straw and gold in late October', straw / n_solid)
        out['straw_share'] = round(straw / n_solid, 3)
    elif key == 'pit_flowers':
        assert .25 <= entry['coverage'] <= .5, entry['coverage']
        assert max(alpha[row_at(spec, 48.5)]) == 0, 'the planting stays under the card top'
        base = sum(1 for v in alpha[row_at(spec, 4.)] if v >= 128) / width
        assert base > .6, ('dense planting at the soil', base)
        hues = set()
        for r, a in zip(rows, alpha):
            for x in range(0, width, 3):
                if a[x] >= 250:
                    c = r[4 * x:4 * x + 3]
                    hues.add(max(range(3), key=lambda n: c[n]) if max(c) - min(c) > 40 else 'grey')
        assert {0, 1, 2} <= hues, ('red, green and blue-purple flowers and leaves', hues)
        out['groups'] = len(entry['layout']['groups'])
    elif key == 'iron_wrought':
        assert .15 <= entry['coverage'] <= .32, entry['coverage']
        for lo, hi in T.IRON_RAILS_CM:
            assert min(alpha[row_at(spec, (lo + hi) / 2.)]) == 255, f'Rail at {(lo + hi) / 2.} cm must be solid'
        feet = runs(alpha[row_at(spec, 3.)], opaque=True)
        assert len(feet) == entry['layout']['pickets_per_tile'], ('pickets to the soil', feet)
        assert all(1. <= f / px_cm <= 1.6 for f in feet), feet
        gaps = runs(alpha[row_at(spec, 3.)])
        assert all(abs(g / px_cm - (T.IRON_PICKET_CM - 1.2)) < .6 for g in gaps), gaps
        assert max(alpha[row_at(spec, T.IRON_FINIAL[0] + T.IRON_FINIAL[1] + .6)]) == 0, 'nothing over the finials'
        out['picket_gap_cm'] = round(max(gaps) / px_cm, 2)
    elif key == 'laundry':
        out.update(check_laundry(entry, rows))
    elif key == 'leaf_litter':
        # a carpet with gaps: the patch's ground shows between the leaves
        assert .68 <= entry['coverage'] <= .88, entry['coverage']
    elif key == 'creeper':
        assert .7 <= entry['coverage'] <= .9, entry['coverage']
        green = sum(1 for r, a in zip(rows, alpha) for x in range(width) if a[x] >= 128 and r[4 * x + 1] > r[4 * x])
        share = green / n_solid
        assert .03 < share < .25, ('some leaves stay green', share)
        out['green_leaf_share'] = round(share, 3)
    return out


def check_laundry(entry, rows):
    """The garment atlas: 14 cells inside the atlas, apart by twice the padding, their UV rects (OBJ, v up) matching
    their pixels, the padding clear, each garment hanging from the top edge of its cell (opaque under every peg),
    drawn to scale inside the cell, and covering a good part of it."""
    width, height = entry['size_px']
    layout = entry['layout']
    cells = layout['cells']
    pad = layout['pad_px']
    assert len(cells) == len(T.LAUNDRY_CELLS) and sorted(c['index'] for c in cells.values()) == list(range(len(cells)))
    rects = []
    alpha = [r[3::4] for r in rows]
    for name, c in cells.items():
        x0, y0, x1, y1 = c['px']
        assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height and x0 >= pad and y0 >= pad, name
        assert c['uv'] == [round(x0 / width, 6), round(1 - y1 / height, 6), round(x1 / width, 6), round(1 - y0 / height, 6)]
        assert abs(c['size_cm'][0] - (x1 - x0) / layout['px_per_cm']) < 1e-3 and c['garment_cm'][1] <= c['size_cm'][1]
        for a, b, c_, d in rects:
            assert x1 + 2 * pad <= a or c_ + 2 * pad <= x0 or y1 + 2 * pad <= b or d + 2 * pad <= y0, ('cells overlap', name)
        rects.append((x0, y0, x1, y1))
        # the padding round the cell is clear (a peg may reach 2 px over the rope)
        for y in range(y0 - pad, y0 - 2):
            assert max(alpha[y][x0 - pad:x1 + pad]) == 0, (name, 'padding above')
        for y in range(y0, y1):
            assert max(alpha[y][x0 - pad:x0]) == 0 and max(alpha[y][x1:x1 + pad]) == 0, (name, 'padding beside')
        inside = sum(1 for y in range(y0, y1) for v in alpha[y][x0:x1] if v >= 128) / ((x1 - x0) * (y1 - y0))
        assert inside > .2, (name, inside)
        for p in c['pins_cm']:
            xp = x0 + round(p * layout['px_per_cm'])
            assert min(alpha[y0 + 1][xp - 1:xp + 2]) == 255, (name, 'hangs from its pegs at the rope')
    return {'cells': len(cells), 'cover': layout['cover']}


def check_lane_concrete(spec, entry, diff, rough):
    """The ruelle gutter: the tooled joint (mid-tile) reads as a dark, open line; the damp channel along the middle
    row is darker and glossier than the concrete at the gutter's edges (18 cm out), without being black."""
    width, height = spec['size_px']
    px = width / (spec['tile_m'][0] * 100.)
    cavity = [r[2::3] for r in rough]
    jx = round(entry['layout']['joint_u_m'][0] * 100. * px)
    joint = sum(cavity[y][x] for y in range(height) for x in (jx - 1, jx)) / (2 * height)
    away = [x for x in range(0, width, 7) if abs(x - jx) > 40]
    field_ = sum(cavity[y][x] for y in range(0, height, 4) for x in away) / (len(range(0, height, 4)) * len(away))
    assert joint > 200 and field_ < 140, ('the transverse joint', joint, field_)

    def band(z_cm, half_cm=2.):
        ys = range(int((50. + z_cm - half_cm) * px), int((50. + z_cm + half_cm) * px))
        xs = [x for x in range(0, width, 5) if abs(x - jx) > 30]
        lum = sum(luminance(diff, x, y) for y in ys for x in xs) / (len(ys) * len(xs))
        r_ = sum(rough[y][3 * x] for y in ys for x in xs) / (255. * len(ys) * len(xs))
        return lum, r_
    centre, edge_a, edge_b = band(0.), band(-17.), band(17.)
    assert centre[0] < .88 * min(edge_a[0], edge_b[0]) and centre[0] > .05, ('damp channel', centre, edge_a, edge_b)
    assert centre[1] < min(edge_a[1], edge_b[1]) - .12, ('the damp channel is glossier', centre, edge_a, edge_b)
    assert entry['layout']['centre_v_m'] == spec['tile_m'][1] / 2.
    return {'joint_cavity': round(joint / 255., 3), 'channel_luminance_ratio': round(centre[0] / min(edge_a[0], edge_b[0]), 3),
            'channel_roughness': round(centre[1], 3), 'edge_roughness': round(min(edge_a[1], edge_b[1]), 3)}


def hue_family(r, g, b):
    """'yellow' (light yellows, golds and tans), 'red' (orange, red and maroon), 'brown' (russet, dried and rotting
    browns: dark or greyish), 'green' (lime and green) or 'dark' (tar spots, deep shade) for an sRGB colour."""
    hi, lo = max(r, g, b), min(r, g, b)
    if hi < 40:
        return 'dark'
    if g >= r:
        return 'green'
    q, value, sat = g / r, hi / 255., (hi - lo) / hi
    if q < .45 or (q < .6 and value >= .6):
        return 'red'
    if value < .6 or sat < .4:
        return 'brown'
    return 'yellow'


def check_leaf_litter(spec, entry, diff, rough):
    """Fallen leaves (Leaf_Litter): the tree atlas's own leaf shapes (plateau_trees.FORMS, broadleaf only) stamped at
    their real size, in mixed late-October colours, the lower leaves darker and damper than the ones on top (Adam
    Sharp's fallen-leaves material), in drifts rather than an even film, and a mask that tiles: leaves cross every
    edge of the tile and run on across the seam."""
    width, height = spec['size_px']
    layout = entry['layout']
    trees = T.tree_module()
    assert layout['px_per_cm'] == width / (spec['tile_m'][0] * 100.) and layout['stamp_px_per_cm'] > layout['px_per_cm']
    assert set(layout['stamps']) == set(T.LITTER_STAMPS)
    for name, s in layout['stamps'].items():
        form, kind, blade, share = T.LITTER_STAMPS[name]
        assert form in trees.FORMS and 'needles' not in trees.FORMS[form], (name, form)
        assert s['form'] == form and s['blade_cm'] == list(blade) and s['count'] > 0, (name, s)
    # Real sizes: a maple blade 9 to 14 cm, a honey locust leaflet about 2 cm.
    assert 9. <= T.LITTER_STAMPS['silver'][2][0] and T.LITTER_STAMPS['silver'][2][1] <= 15.
    assert T.LITTER_STAMPS['locust_leaflet'][2][1] <= 3.
    assert layout['leaves'] == sum(s['count'] for s in layout['stamps'].values()) >= 1500, layout['leaves']
    alpha = [r[3::4] for r in diff]
    heights = [r[1::3] for r in rough]
    rough_r = [r[0::3] for r in rough]
    fam, n = {}, 0
    low, high = [], []
    for y in range(0, height, 2):
        r_ = diff[y]
        for x in range(0, width, 2):
            if alpha[y][x] < 250:
                continue
            c = r_[4 * x:4 * x + 3]
            f = hue_family(*c)
            fam[f] = fam.get(f, 0) + 1
            n += 1
            low.append((heights[y][x], .2126 * T.SRGB_TO_LINEAR[c[0]] + .7152 * T.SRGB_TO_LINEAR[c[1]]
                        + .0722 * T.SRGB_TO_LINEAR[c[2]], rough_r[y][x] / 255.))
    share = {k: round(v / n, 4) for k, v in sorted(fam.items())}
    # Mixed late-October colours: yellows, golds and tans and as much brown (the dried and rotting leaves below),
    # some orange and red, a little frost-green, and the black tar spots of Norway maples (Rhytisma), none of them
    # taking over.
    assert .25 <= share.get('yellow', 0) <= .6, share
    assert .3 <= share.get('brown', 0) <= .65, share
    assert .04 <= share.get('red', 0) <= .3, share
    assert .005 <= share.get('green', 0) <= .1, share
    assert .0005 <= share.get('dark', 0) <= .03, share
    # Lower leaves (the lowest third of the height map) are darker and damper (glossier) than the top third.
    low.sort()
    third = len(low) // 3
    bottom, top = low[:third], low[-third:]
    lum = [sum(v[1] for v in part) / len(part) for part in (bottom, top)]
    gloss = [sum(v[2] for v in part) / len(part) for part in (bottom, top)]
    assert lum[0] < .8 * lum[1], ('lower leaves darker', lum)
    assert gloss[0] < gloss[1] - .06, ('lower leaves damper', gloss)
    layers = layout['layers']
    assert layers['bottom']['luminance'] < layers['middle']['luminance'] < layers['top']['luminance'], layers
    assert all(layers[k]['visible_share'] > .1 for k in ('bottom', 'middle', 'top')), layers
    # The splat wraps: leaves cross all four edges, and the mask runs on across the seam like any neighbour step.
    edges = [alpha[0], alpha[-1], [a[0] for a in alpha], [a[-1] for a in alpha]]
    crossing = [sum(1 for v in e if v >= 128) / len(e) for e in edges]
    assert min(crossing) > .4, ('leaves cross the tile edges', crossing)
    step_x = sum(abs(a[x] - a[x + 1]) for a in alpha[::3] for x in range(width - 1)) / ((width - 1) * len(alpha[::3]))
    seam_x = sum(abs(a[-1] - a[0]) for a in alpha[::3]) / len(alpha[::3])
    step_y = sum(abs(p - q) for y in range(0, height - 1, 3) for p, q in zip(alpha[y], alpha[y + 1])) / (
        width * len(range(0, height - 1, 3)))
    seam_y = sum(abs(p - q) for p, q in zip(alpha[-1], alpha[0])) / width
    assert seam_x < 1.6 * step_x and seam_y < 1.6 * step_y, ('mask seam', seam_x, step_x, seam_y, step_y)
    # Drifts: 25 cm blocks differ in cover (clumped, not an even film), and no block of a patch is bare.
    px = layout['px_per_cm']
    b = round(25. * px)
    blocks = []
    for by in range(0, height - b + 1, b):
        for bx in range(0, width - b + 1, b):
            blocks.append(sum(1 for y in range(by, by + b, 2) for v in alpha[y][bx:bx + b:2] if v >= 128)
                          / (len(range(by, by + b, 2)) * len(range(bx, bx + b, 2))))
    mean = sum(blocks) / len(blocks)
    cv = (sum((v - mean) ** 2 for v in blocks) / len(blocks)) ** .5 / mean
    assert .06 < cv < .4 and min(blocks) > .3, ('drifts', round(cv, 3), round(min(blocks), 3))
    return {'hue_share': share, 'lower_to_upper_luminance': round(lum[0] / lum[1], 3),
            'lower_upper_roughness': [round(v, 3) for v in gloss], 'edge_cover': [round(v, 3) for v in crossing],
            'block_cover_cv_25cm': round(cv, 3), 'leaves': layout['leaves'], 'layers': layers}


def check_litter_forms_watch():
    """--check names a change in the tree leaf forms: the litter stamps the atlas's shapes, so editing a form in
    Scripts/blender/plateau_trees.py must ask for a texture rebuild, in words, before any pixel hash differs."""
    trees = T.tree_module()
    stored = T.litter_stamp_digest()
    assert T.check_litter_stamps({'layout': {'stamps_sha256': stored}}) is None
    old = trees.FORMS['elm']
    try:
        trees.FORMS['elm'] = dict(old, lobes=[(-.03, 1., .3, 11), (.03, .9, .24, 11)])
        try:
            T.check_litter_stamps({'layout': {'stamps_sha256': stored}})
        except AssertionError as error:
            assert 'plateau_trees.py' in str(error) and 'rerun' in str(error), error
        else:
            raise AssertionError('--check missed a change in the tree leaf forms')
    finally:
        trees.FORMS['elm'] = old
    assert T.litter_stamp_digest() == stored
    return {'stamps_sha256': stored[:16]}


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
    # Aged lane concrete: a warm mid grey, well under a new sidewalk's (#B5B8B8, linear about .47), and matte.
    'lane_concrete': lambda m, r: .1 < sum(m) / 3 < .22 and m[0] > m[1] > m[2] and .75 <= r <= .9,
    'cedar': lambda m, r: m[1] > m[0] > m[2] and sum(m) / 3 < .12 and .7 <= r <= .85,
    'fountain_grass': lambda m, r: m[0] > m[1] > m[2] and .12 < sum(m) / 3 < .32 and .75 <= r <= .9,
    'pit_flowers': lambda m, r: .1 < sum(m) / 3 < .3 and .6 <= r <= .85,
    # black paint with rust at the feet; paint is not metal
    'iron_wrought': lambda m, r: sum(m) / 3 < .04 and m[0] >= m[2] and .4 <= r <= .6,
    'laundry': lambda m, r: .3 < sum(m) / 3 < .6 and .85 <= r <= .95,
    # Fallen leaves: warm (red over green over blue, little blue), mid-dark from above, dry on top and damp below.
    'leaf_litter': lambda m, r: m[0] > m[1] > m[2] and m[2] < .35 * m[0] and .1 < sum(m) / 3 < .3 and .62 <= r <= .82,
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
        assert masked == entry['alpha'] == (key in MASKED_KEYS), key
        assert entry['material']['two_sided'] == masked
        assert (entry['uv'] == 'card') == (key in CUTOUT_KEYS), key
        assert (entry['uv'] == 'atlas') == (key in ATLAS_KEYS), key
        if key in CUTOUT_KEYS:
            assert entry['tiling'][1] == 1. and entry['card_height_m'] >= .5, key
        assert (entry['material']['shading_model'] == 'two_sided_foliage') == (key in FOLIAGE_KEYS), key
        # the apply step clamps V on cards and both axes on the atlas
        assert apply_replica.address_modes(entry) == {'card': ('TA_WRAP', 'TA_CLAMP'), 'atlas': ('TA_CLAMP', 'TA_CLAMP'),
                                                      'metres': ('TA_WRAP', 'TA_WRAP')}[entry['uv']], key
        assert apply_replica.texture_set(key, {}) == name, (key, apply_replica.texture_set(key, {}))
    return {key: owner[key] for key in SHARED_KEYS}


def main():
    report = {'layouts': check_layouts(), 'litter_forms_watch': check_litter_forms_watch()}
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        index = T.prepare(a)
        T.prepare(b)
        fa, fb = files(a), files(b)
        assert fa.keys() == fb.keys() and all(fa[k] == fb[k] for k in fa), \
            'Non-deterministic output: ' + str([k for k in fa if fa.get(k) != fb.get(k)])
        assert len(fa) == 2 + 3 * len(T.SETS), 'textures.json, the macro mask and three maps per set'
        # A set built in this process (no worker pool) gives the same pixels as the pooled build.
        _, solo = T.build('lattice')
        assert all(solo['maps'][r]['raw_sha256'] == index['sets']['lattice']['maps'][r]['raw_sha256'] for r in T.ROLES)
        report['determinism'] = f'{len(fa)} files byte-identical across two builds and an in-process rebuild'
        report['shared_keys'] = check_shared_keys(index)
        report['macro'] = check_macro(index, fa[T.macro_file()])
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
                assert key in T.ATLASES or sx < 1.6 and (card or sy < 1.6), \
                    f'{m["file"]} seam {sx:.2f} x {sy:.2f} the neighbour step'
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
            if key == 'buff_brick':
                sets[key].update(check_buff_brick(spec, maps['diff'], maps['rough']))
            if key == 'lane_concrete':
                sets[key].update(check_lane_concrete(spec, entry, maps['diff'], maps['rough']))
            if key == 'leaf_litter':
                sets[key].update(check_leaf_litter(spec, entry, maps['diff'], maps['rough']))
            if key in LARGE_SCALE:
                # Large-scale variation: the tile is 2 m, and 25 cm and 50 cm blocks differ in tone (zones).
                assert spec['tile_m'] == (2., 2.) and spec['size_px'] == (1024, 1024), key
                px = spec['size_px'][0] / (spec['tile_m'][0] * 100.)
                cv = [block_variation(maps['diff'], 3, px, c) for c in (25., 50.)]
                assert all(v >= lo for v, lo in zip(cv, LARGE_SCALE[key])), (key, 'too even at large scale', cv)
                sets[key]['block_variation_25_50cm'] = [round(v, 4) for v in cv]
            if entry['alpha']:
                sets[key].update(check_cutout(key, spec, entry, maps['diff']))
            if key == 'sheet_metal':
                assert entry['metallic'] == T.SETS['sheet_metal']['metallic'] <= .35, 'galvanised sheet reads grey'
            # The tar set owns its colour (whatever colour a manifest gives Roof_Tar, the roof shows the texture's own
            # grey gravel, the EXPECT range above, about #4A4744), and so do the many-coloured pit planting and laundry.
            assert entry.get('own_colour', False) == (key in OWN_COLOUR) == bool(spec.get('own_colour')), key
            # Tints the apply step derives from the Plex colours stay in range and keep the texture's contrast.
            for name, spec_m in plex_materials.items():
                if apply_replica.texture_set(name, spec_m) == key:
                    row = apply_replica.set_material(key, entry)
                    tint = list(apply_replica.textured_tint(row, spec_m))
                    if row['own_colour']:
                        assert tint == [1., 1., 1.], (name, tint)
                    floor_ = spec.get('tint_floor', .2)
                    assert floor_ <= min(tint) and max(tint) <= apply_replica.TINT_LIMIT, \
                        (name, tint, f'set base_color_srgb near {entry["base_color_srgb"]}')
                    metal = apply_replica.textured_metallic(row, spec_m)
                    assert metal <= entry.get('metallic', 1.), (name, metal)
                    summary[f'metallic {name}'] = {'manifest': spec_m.get('metallic', 0.), 'material': metal}
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
                for field in ('own_colour', 'metallic'):
                    assert stored['sets'][key].get(field) == index['sets'][key].get(field), \
                        f'{key} {field}: rerun python3 Scripts/plateau_textures.py'
            assert stored['macro']['raw_sha256'] == index['macro']['raw_sha256'], 'rerun python3 Scripts/plateau_textures.py'
            raw = T.read_png((T.OUT / stored['macro']['file']).read_bytes())[2]
            assert hashlib.sha256(raw).hexdigest() == stored['macro']['raw_sha256'], 'The macro mask is stale'
            report['committed'] = 'Data/Plateau/ReplicaGeometry/Textures matches the generator'
    print(json.dumps(report, indent=1))
    print('Plateau texture checks passed')


if __name__ == '__main__':
    main()
