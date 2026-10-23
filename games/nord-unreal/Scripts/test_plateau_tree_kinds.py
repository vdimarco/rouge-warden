"""Checks for the species trees (Data/Plateau/ReplicaGeometry/Trees, from Scripts/blender/plateau_trees.py) and for
the late-October leaf option of Scripts/refine_plateau_trees.py. Stdlib only; no Blender or Unreal needed.

    python3 Scripts/test_plateau_tree_kinds.py            # the files on disk, the generator's rules, the refine graph
    python3 Scripts/test_plateau_tree_kinds.py --rebuild  # also two fresh builds, byte for byte, and against disk

The OBJs are git-ignored, so a fresh checkout runs `python3 Scripts/blender/plateau_trees.py --no-render` first.
"""
import colorsys
import hashlib
import json
import math
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'Scripts'))
sys.path.insert(0, str(ROOT / 'Scripts/blender'))
import apply_plateau_replica as A  # noqa: E402  (the real consumer of Trees/manifest.json)
import plateau_textures as PT  # noqa: E402
import plateau_trees as T  # noqa: E402
import refine_plateau_trees as R  # noqa: E402

TREES = ROOT / 'Data/Plateau/ReplicaGeometry/Trees'
SHEET = ROOT / 'Preview/Replica/trees_contact_sheet.png'
REBUILD = '--rebuild' in sys.argv


def manifest():
    return json.loads((TREES / 'manifest.json').read_text())


def read_obj(path):
    """(positions, uvs, normals, {usemtl name: [((vi, ti, ni) x 3)]})."""
    v, vt, vn, groups, current = [], [], [], {}, None
    for line in path.read_text().splitlines():
        tag, _, rest = line.partition(' ')
        if tag == 'v':
            v.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vt':
            vt.append(tuple(float(c) for c in rest.split()))
        elif tag == 'vn':
            vn.append(tuple(float(c) for c in rest.split()))
        elif tag == 'usemtl':
            current = rest
            groups.setdefault(current, [])
        elif tag == 'f':
            face = tuple(tuple(int(i) - 1 for i in tok.split('/')) for tok in rest.split())
            assert len(face) == 3, (path, line)
            groups[current].append(face)
        else:
            assert tag in ('o', '#'), (path, line)
    return v, vt, vn, groups


_OBJS = {}


def obj(kind):
    if kind not in _OBJS:
        _OBJS[kind] = read_obj(TREES / manifest()['kinds'][kind]['obj'])
    return _OBJS[kind]


def tri_area(a, b, c):
    e1 = [b[i] - a[i] for i in range(3)]
    e2 = [c[i] - a[i] for i in range(3)]
    x = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
    return .5 * math.sqrt(sum(k * k for k in x)), x


def segment_distance(p, a, b):
    ab = [b[i] - a[i] for i in range(3)]
    ap = [p[i] - a[i] for i in range(3)]
    d = sum(x * x for x in ab)
    t = 0. if d < 1e-12 else max(0., min(1., sum(x * y for x, y in zip(ap, ab)) / d))
    return math.dist(p, [a[i] + ab[i] * t for i in range(3)])


def cell_of(uv, cells):
    for name, cell in cells.items():
        u0, v0, u1, v1 = cell['uv']
        if u0 - 1e-4 <= uv[0] <= u1 + 1e-4 and v0 - 1e-4 <= uv[1] <= v1 + 1e-4:
            return name
    return None


def atlas_rgba():
    data = (TREES / f'T_Replica_{T.ATLAS["name"]}_diff.png').read_bytes()
    width, height, channels, raw = PT.read_png_channels(data)
    assert channels == 4
    stride = 1 + 4 * width
    rows = [raw[y * stride + 1:(y + 1) * stride] for y in range(height)]
    return width, height, rows


def hue_class(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255., g / 255., b / 255.)
    h *= 360.
    if h < 18. or h >= 300.:
        return 'red'
    if h < 62.:
        return 'yellow_orange'
    if h < 170.:
        return 'green'
    return 'other'


_HUES = {}


def cell_hues():
    """{cell: {class: share of its opaque texels}} from the atlas PNG."""
    if not _HUES:
        width, height, rows = atlas_rgba()
        for index, name in enumerate(T.CELL_ORDER):
            x0, y0, x1, y1 = T.cell_rect(index)
            counts, n = {}, 0
            for y in range(y0, y1):
                row = rows[y]
                for x in range(x0, x1):
                    o = 4 * x
                    if row[o + 3] < 128:
                        continue
                    k = hue_class(row[o], row[o + 1], row[o + 2])
                    counts[k] = counts.get(k, 0) + 1
                    n += 1
            _HUES[name] = {k: c / n for k, c in counts.items()}
    return _HUES


def cards_per_cell(kind):
    """Cards of a kind by atlas cell, read from the leaf UVs (4 triangles per card, the first corner's UV)."""
    v, vt, vn, groups = obj(kind)
    faces = groups[f'{kind}_leaves']
    cells = manifest()['atlas_cells']
    out = {}
    for i in range(0, len(faces), 4):
        name = cell_of(vt[faces[i][0][1]], cells)
        out[name] = out.get(name, 0) + 1
    return out


class GeneratorRules(unittest.TestCase):
    def test_shape_ratio_follows_weber_and_penn_table(self):
        sr = T.shape_ratio
        self.assertAlmostEqual(sr(0, 0.), .2)
        self.assertAlmostEqual(sr(0, 1.), 1.)
        self.assertAlmostEqual(sr(1, .5), 1.)
        self.assertAlmostEqual(sr(1, 0.), .2)
        self.assertAlmostEqual(sr(2, 1.), 1.)
        self.assertAlmostEqual(sr(2, 0.), .2)
        self.assertEqual(sr(3, .3), 1.)
        self.assertAlmostEqual(sr(4, 0.), .5)
        self.assertAlmostEqual(sr(5, .7), 1.)
        self.assertAlmostEqual(sr(5, .85), .5)
        self.assertAlmostEqual(sr(6, 1.), .2)
        self.assertAlmostEqual(sr(7, .7), 1.)
        self.assertAlmostEqual(sr(7, 1.), .5)
        # Flare: Flare * (100^y - 1) / 100 + 1, y = 1 - 8 Z clamped at 0.
        self.assertAlmostEqual(T.flare_factor(.5, 0.), 1.495)
        self.assertAlmostEqual(T.flare_factor(.5, .2), 1.)

    def test_every_stem_grows_out_of_its_parent_and_crowns_are_pruned_up(self):
        for kind in T.KINDS:
            P = T.SPECIES[kind]
            stems, cards = T.calibrated(kind)
            limbs = [s for s in stems if s.level == 1]
            self.assertTrue(limbs and all(s.points[0][2] >= P['prune_cm'] + 15. for s in limbs),
                            (kind, 'a limb starts below the pruned height'))
            for s in stems:
                if s.parent is None:
                    continue
                p, _, r = s.parent.at(s.t)
                self.assertLess(math.dist(p, s.points[0]), .5, (kind, 'child base off its parent axis'))
                self.assertLessEqual(s.radius0, r + 1e-6, (kind, 'child thicker than its parent there'))
                lowest = min(q[2] for q in s.points)
                self.assertGreaterEqual(lowest, P['prune_cm'] - 15. - 1., (kind, s.level, 'branch dips under clearance'))
            # Leaders (trunk clones) start where the trunk ends.
            trunk = stems[0]
            for leader in [s for s in stems if s.level == 0][1:]:
                self.assertLess(math.dist(leader.points[0], trunk.points[-1]), 1e-6, kind)


class TreeFiles(unittest.TestCase):
    def test_manifest_matches_the_apply_step_contract(self):
        m = manifest()
        self.assertEqual(m['generator'], T.GENERATOR)
        self.assertEqual(m['source_sha256'][T.GENERATOR],
                         hashlib.sha256((ROOT / T.GENERATOR).read_bytes()).hexdigest(),
                         'Trees manifest is stale: rerun python3 Scripts/blender/plateau_trees.py --no-render')
        kinds = A.load_tree_kinds(ROOT)           # the apply step's own loader and checks
        self.assertEqual(sorted(kinds), sorted(A.TREE_SPECIES))
        self.assertEqual(set(T.KINDS), set(A.TREE_SPECIES))
        self.assertEqual(m['aliases'], A.TREE_ALIASES)
        bark_keys = set()
        for kind, row in kinds.items():
            k = m['kinds'][kind]
            self.assertEqual(row['sha256'], hashlib.sha256((TREES / k['obj']).read_bytes()).hexdigest())
            self.assertEqual(row['materials']['leaves']['key'], T.LEAF_KEY)
            bark_keys.add(row['materials']['bark']['key'])
            for slot in A.TREE_SLOTS:
                spec = row['materials'][slot]['spec']
                tex = spec['texture']
                self.assertTrue((TREES.parent / tex).is_file(), tex)
                entry = m['texture_sets'][T.ATLAS['key'] if slot == 'leaves' else T.BARK['key']]
                self.assertEqual(Path(tex).name, entry['maps']['diff']['file'])
                self.assertIn(row['materials'][slot]['key'], entry['keys'])
            groups = obj(kind)[3]
            self.assertEqual(list(groups), [k['slots']['bark'], k['slots']['leaves']])
            self.assertEqual({A.tree_slot(name) for name in groups}, set(A.TREE_SLOTS))
        self.assertEqual(len(bark_keys), len(T.KINDS), 'each kind has its own bark tint')
        # Yard trees of every kind the Plex layer writes, old kinds included, find a species mesh.
        rows = A.load_yard_trees(ROOT)
        if rows:
            plan = A.plan_trees(rows, kinds)
            self.assertEqual(sum(r['count'] for r in plan), len(rows))
            for r in plan:
                self.assertEqual(r['mesh_height_cm'], m['kinds'][r['kind']]['height_cm'])

    def test_texture_sets(self):
        m = manifest()
        for key, entry in m['texture_sets'].items():
            for role, row in entry['maps'].items():
                data = (TREES / row['file']).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), row['sha256'], row['file'])
                width, height, channels, raw = PT.read_png_channels(data)
                self.assertEqual([width, height], entry['size_px'])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['raw_sha256'])
                self.assertEqual(channels, 4 if role == 'diff' and entry['alpha'] else 3)
                for name in ('srgb', 'compression', 'sampler'):
                    self.assertEqual(row[name], PT.IMPORT[role][name])
            self.assertEqual(entry['material'], PT.SURFACES[entry['surface']])
        leaves, bark = m['texture_sets'][T.ATLAS['key']], m['texture_sets'][T.BARK['key']]
        self.assertEqual((leaves['surface'], leaves['uv'], leaves['tiling']), ('foliage', 'atlas', [1., 1.]))
        self.assertEqual(leaves['material']['blend_mode'], 'masked')
        self.assertTrue(leaves['material']['two_sided'])
        self.assertTrue(.15 <= leaves['coverage'] <= .5, leaves['coverage'])
        self.assertEqual((bark['surface'], bark['uv'], bark['alpha']), ('wall', 'metres', False))

    def test_atlas_cells_have_no_halo_and_stay_inside_their_padding(self):
        width, height, rows = atlas_rgba()
        pad = T.ATLAS['pad_px']
        for index, name in enumerate(T.CELL_ORDER):
            x0, y0, x1, y1 = T.cell_rect(index)
            opaque, clear = [0., 0., 0., 0], [0., 0., 0., 0]
            for y in range(y0, y1):
                row = rows[y]
                for x in range(x0, x1):
                    o = 4 * x
                    a = row[o + 3]
                    edge = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y)
                    if edge < pad // 2:
                        self.assertLess(a, 8, (name, x, y, 'alpha inside the cell padding'))
                    acc = opaque if a >= 128 else clear if a == 0 else None
                    if acc is not None:
                        acc[0] += row[o]
                        acc[1] += row[o + 1]
                        acc[2] += row[o + 2]
                        acc[3] += 1
            mo = [c / opaque[3] for c in opaque[:3]]
            mc = [c / clear[3] for c in clear[:3]]
            # The colour under clear texels is the cell's mean leaf colour (edge padding): no dark or grey halo.
            self.assertLess(max(abs(a - b) for a, b in zip(mo, mc)), 3., (name, mo, mc))

    def test_meshes(self):
        m = manifest()
        for kind in T.KINDS:
            k = m['kinds'][kind]
            P = T.SPECIES[kind]
            v, vt, vn, groups = obj(kind)
            bark, leaves = groups[f'{kind}_bark'], groups[f'{kind}_leaves']
            self.assertEqual(k['triangles'], {'bark': len(bark), 'leaves': len(leaves), 'total': len(bark) + len(leaves)})
            target = T.TRIANGLE_TARGET['small' if kind == 'small' else 'mature']
            self.assertLess(k['triangles']['total'], target, kind)
            self.assertEqual(len(leaves) % 4, 0, (kind, 'four triangles per card'))
            for face in bark + leaves:
                ids = [c[0] for c in face]
                self.assertEqual(len(set(ids)), 3, (kind, 'repeated vertex'))
                self.assertGreater(tri_area(*(v[i] for i in ids))[0], 1e-4, (kind, 'zero-area triangle'))
            top = max(p[2] for p in v)
            self.assertAlmostEqual(top, k['height_cm'], delta=.06)
            self.assertTrue(-5. <= min(p[2] for p in v) <= 0., (kind, 'the trunk base sits on or just under the pivot'))
            self.assertLess(abs(k['height_cm'] - P['height_cm']) / P['height_cm'], .04, kind)
            if kind in T.MATURE:
                self.assertTrue(1200. <= k['height_cm'] <= 1800., kind)
                self.assertTrue(25. <= k['trunk_cm'] <= 60., kind)
            else:
                self.assertTrue(500. <= k['height_cm'] <= 800. and 10. <= k['trunk_cm'] <= 25., kind)
            # The trunk diameter at breast height, measured on the mesh, is the manifest's trunk_cm.
            bark_v = {c[0] for f in bark for c in f}
            ring = [v[i] for i in bark_v if 126. < v[i][2] < 134. and math.hypot(v[i][0], v[i][1]) < 60.]
            cx, cy = sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring)
            dbh = 2. * sum(math.hypot(p[0] - cx, p[1] - cy) for p in ring) / len(ring)
            self.assertLess(abs(dbh - k['trunk_cm']) / k['trunk_cm'], .03, (kind, dbh))
            # Crowns pruned up: no leaf card hangs more than CARD_HANG_CM below the pruned height.
            leaf_v = {c[0] for f in leaves for c in f}
            self.assertGreaterEqual(min(v[i][2] for i in leaf_v), P['prune_cm'] - T.CARD_HANG_CM - .01, kind)
            if kind in T.MATURE:
                self.assertGreaterEqual(min(v[i][2] for i in leaf_v), 270., kind)
            # Leaf normals are unit, never point fully down, and mostly lean out of the crown.
            for i in {c[2] for f in leaves for c in f}:
                self.assertAlmostEqual(math.sqrt(sum(x * x for x in vn[i])), 1., delta=2e-3)
                self.assertGreaterEqual(vn[i][2], T.MIN_NORMAL_Z - 2e-3)
            self.assertGreaterEqual(k['outward_cards'] / k['cards'], .97, kind)

    def test_cards_sit_on_twigs_and_map_into_one_cell_of_their_kind(self):
        m = manifest()
        cells = m['atlas_cells']
        for kind in T.KINDS:
            v, vt, vn, groups = obj(kind)
            bark, leaves = groups[f'{kind}_bark'], groups[f'{kind}_leaves']
            grid = {}
            for f in bark:                      # every bark edge, filed under each 25 cm cell its box touches
                for a, b in ((f[0][0], f[1][0]), (f[1][0], f[2][0]), (f[2][0], f[0][0])):
                    lo = [int(min(v[a][k], v[b][k]) // 25) for k in range(3)]
                    hi = [int(max(v[a][k], v[b][k]) // 25) for k in range(3)]
                    for gx in range(lo[0], hi[0] + 1):
                        for gy in range(lo[1], hi[1] + 1):
                            for gz in range(lo[2], hi[2] + 1):
                                grid.setdefault((gx, gy, gz), set()).add((a, b) if a < b else (b, a))
            allowed = set(T.SPECIES[kind]['leaves']['cells'])
            for n in range(0, len(leaves), 4):
                card = leaves[n:n + 4]
                names = {cell_of(vt[c[1]], cells) for f in card for c in f}
                self.assertEqual(len(names), 1, (kind, 'card UVs span cells', names))
                self.assertTrue(names <= allowed, (kind, names))
                base = v[card[0][1][0]]          # the bottom-centre corner, where the card meets its twig
                key = tuple(int(base[k] // 25) for k in range(3))
                near = min((segment_distance(base, v[a], v[b]) for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                            for dz in (-1, 0, 1) for a, b in grid.get((key[0] + dx, key[1] + dy, key[2] + dz), ())),
                           default=1e9)
                # The card starts on the twig surface, lifted by the fold: within a few cm of a bark edge.
                self.assertLess(near, 8., (kind, 'leaf card floating off its twig', base))

    def test_late_october_colours(self):
        hues = cell_hues()
        total = {}
        for kind in T.KINDS:
            per = cards_per_cell(kind)
            self.assertEqual(sum(per.values()), manifest()['kinds'][kind]['cards'])
            mix = {}
            for name, n in per.items():
                for k, share in hues[name].items():
                    mix[k] = mix.get(k, 0.) + share * n
                    total[k] = total.get(k, 0.) + share * n
            s = sum(mix.values())
            mix = {k: c / s for k, c in mix.items()}
            if kind == 'small':
                self.assertGreater(mix.get('red', 0.), .3, (kind, mix))
            else:
                self.assertGreater(mix.get('yellow_orange', 0.), .6, (kind, mix))
            self.assertLess(mix.get('green', 0.), .3, (kind, mix))
            if kind == 'norway_maple':
                self.assertGreater(mix.get('green', 0.), .03, 'Norway maples keep some green in late October')
        s = sum(total.values())
        total = {k: c / s for k, c in total.items()}
        self.assertGreater(total['yellow_orange'], .6, total)
        self.assertGreater(total['red'], .05, total)
        self.assertTrue(.02 < total['green'] < .25, total)

    def test_crowns_are_thinner_in_late_october(self):
        m = manifest()
        stats = m['texture_sets'][T.ATLAS['key']]['layout']['cell_stats']
        index = {}
        for kind in T.KINDS:
            k = m['kinds'][kind]
            self.assertLess(k['leaf_retention'], .85, kind)
            v, vt, vn, groups = obj(kind)
            leaves = groups[f'{kind}_leaves']
            area = 0.
            for n in range(0, len(leaves), 4):
                card = leaves[n:n + 4]
                name = cell_of(vt[card[0][0][1]], m['atlas_cells'])
                area += sum(tri_area(*(v[c[0]] for c in f))[0] for f in card) * stats[name]['cover']
            r = k['crown_width_cm'] / 2.
            index[kind] = area / (math.pi * r * r)
            self.assertTrue(.15 < index[kind] < 3., (kind, index[kind]))
        self.assertLess(index['honey_locust'], index['norway_maple'])
        self.assertLess(index['ash'], index['norway_maple'])

    def test_contact_sheet(self):
        data = SHEET.read_bytes()
        self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
        width, height = int.from_bytes(data[16:20], 'big'), int.from_bytes(data[20:24], 'big')
        self.assertEqual((width, height), (1600, 1000))

    @unittest.skipUnless(REBUILD, 'pass --rebuild for two fresh builds')
    def test_two_builds_are_byte_identical_and_match_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for run in ('a', 'b'):
                out = Path(tmp) / run
                T.build(out)
                outs.append({p.name: p.read_bytes() for p in sorted(out.iterdir())})
            self.assertEqual(outs[0], outs[1])
            disk = {p.name: p.read_bytes() for p in sorted(TREES.iterdir()) if p.suffix in ('.obj', '.json', '.png')}
            self.assertEqual(sorted(outs[0]), sorted(n for n in disk if n != 'README.md'))
            fresh = json.loads(outs[0]['manifest.json'])
            self.assertEqual({k: v['sha256'] for k, v in fresh['kinds'].items()},
                             {k: v['sha256'] for k, v in manifest()['kinds'].items()})
            for key, entry in fresh['texture_sets'].items():
                for role, row in entry['maps'].items():
                    self.assertEqual(row['raw_sha256'], manifest()['texture_sets'][key]['maps'][role]['raw_sha256'])


# ------------------------------------------------------------------------------------------------ refine autumn

class _Node:
    def __init__(self, cls):
        self.cls, self.props, self.inputs = cls, {}, {}

    def set_editor_property(self, name, value):
        self.props[name] = value

    def get_editor_property(self, name):
        return self.props[name]


class _Library:
    def __init__(self):
        self.nodes = []

    def create_material_expression(self, mat, cls):
        node = _Node(cls)
        self.nodes.append(node)
        return node

    def connect_material_expressions(self, a, output, b, name):
        b.inputs[name] = (a, output)
        return True


def fake_unreal(command_line=''):
    class U:
        pass
    u = U()
    for name in ('TextureSample', 'PerInstanceRandom', 'Desaturation', 'Constant', 'Constant3Vector',
                 'LinearInterpolate', 'Multiply', 'Add', 'Subtract', 'Clamp'):
        setattr(u, 'MaterialExpression' + name, name)
    u.MaterialEditingLibrary = _Library()
    u.MaterialSamplerType = type('S', (), {'SAMPLERTYPE_COLOR': 'colour'})
    u.LinearColor = lambda r, g, b, a: (r, g, b)
    u.SystemLibrary = type('L', (), {'get_command_line': staticmethod(lambda: command_line)})
    return u


def evaluate(node, texel, r, output=''):
    """Evaluate a recorded node graph for one texel (linear RGB) and per-instance random value r."""
    def inp(name, default=None):
        if name in node.inputs:
            src, out = node.inputs[name]
            return evaluate(src, texel, r, out)
        return default

    def vec(x):
        return x if isinstance(x, tuple) else (x, x, x)
    c = node.cls
    if c == 'TextureSample':
        return texel
    if c == 'PerInstanceRandom':
        return r
    if c == 'Constant':
        return node.props['r']
    if c == 'Constant3Vector':
        return node.props['constant']
    if c == 'Desaturation':
        col, frac = inp(''), inp('Fraction', 1.)
        grey = R.luminance(col)
        return tuple(x + (grey - x) * frac for x in col)
    if c == 'LinearInterpolate':
        a, b, t = inp('A'), inp('B'), inp('Alpha')
        if isinstance(a, tuple) or isinstance(b, tuple):
            return tuple(x + (y - x) * t for x, y in zip(vec(a), vec(b)))
        return a + (b - a) * t
    if c in ('Multiply', 'Add', 'Subtract'):
        a, b = inp('A'), inp('B', node.props.get('const_b'))
        op = {'Multiply': lambda x, y: x * y, 'Add': lambda x, y: x + y, 'Subtract': lambda x, y: x - y}[c]
        if isinstance(a, tuple) or isinstance(b, tuple):
            return tuple(op(x, y) for x, y in zip(vec(a), vec(b)))
        return op(a, b)
    if c == 'Clamp':
        return min(node.props['max_default'], max(node.props['min_default'], inp('')))
    raise AssertionError(c)


def srgb_hue(linear):
    s = [12.92 * v if v <= .0031308 else 1.055 * v ** (1 / 2.4) - .055 for v in linear]
    return colorsys.rgb_to_hsv(*[min(1., max(0., x)) for x in s])[0] * 360.


class RefineAutumn(unittest.TestCase):
    TEXELS = ((.387, .451, .223), (.2, .32, .08), (.55, .6, .35))   # the leaf texture's mean, a dark and a light texel

    def test_graphs_match_the_cpu_colour_in_both_modes(self):
        for autumn in (False, True):
            u = fake_unreal()
            out = R.leaf_graph(u, 'mat', 'diffuse', autumn)
            for texel in self.TEXELS:
                for r in [i / 20. for i in range(21)]:
                    got = evaluate(out, texel, r)
                    want = R.leaf_colour(texel, r, autumn)
                    self.assertTrue(all(abs(a - b) < 1e-9 for a, b in zip(got, want)), (autumn, texel, r, got, want))

    def test_default_keeps_the_summer_green_to_gold(self):
        texel = self.TEXELS[0]
        grey = R.luminance(texel)
        desat = [c + (grey - c) * .35 for c in texel]
        for r in (0., .5, 1.):
            tint = [g + (o - g) * r for g, o in zip(R.GREEN_TINT, R.GOLD_TINT)]
            want = [d * t + l for d, t, l in zip(desat, tint, (.025, .035, .008))]
            self.assertEqual(list(R.leaf_colour(texel, r)), want)
        self.assertEqual(R.MASK_CLIP, 1. / 3.)

    def test_autumn_shifts_leaves_to_yellow_and_orange_with_some_red_and_green(self):
        classes = {}
        for texel in self.TEXELS:
            for i in range(200):
                h = srgb_hue(R.leaf_colour(texel, (i + .5) / 200., True))
                k = 'red' if h < 18. else 'yellow_orange' if h < 62. else 'green'
                classes[k] = classes.get(k, 0) + 1
        n = sum(classes.values())
        self.assertGreater(classes['yellow_orange'] / n, .75, classes)
        self.assertTrue(.02 < classes.get('red', 0) / n < .15, classes)
        self.assertTrue(.02 < classes.get('green', 0) / n < .12, classes)
        # Against the summer graph (green to gold), autumn sits well toward orange for every instance value.
        summer = sum(srgb_hue(R.leaf_colour(self.TEXELS[0], r / 10.)) for r in range(11)) / 11.
        autumn = sum(srgb_hue(R.leaf_colour(self.TEXELS[0], r / 10., True)) for r in range(11)) / 11.
        self.assertGreater(summer - autumn, 25., (summer, autumn))
        self.assertGreater(R.AUTUMN_MASK_CLIP, R.MASK_CLIP)   # thinner crowns: many leaves already down

    def test_flag(self):
        self.assertTrue(R.autumn_flag(fake_unreal('UnrealEditor-Cmd Quebec.uproject -NordTreeAutumn -NullRHI')))
        self.assertFalse(R.autumn_flag(fake_unreal('UnrealEditor-Cmd Quebec.uproject -NullRHI')))
        self.assertIn('autumn', R.apply.__code__.co_varnames)


if __name__ == '__main__':
    argv = [a for a in sys.argv if a != '--rebuild']
    unittest.main(argv=argv, verbosity=1)
