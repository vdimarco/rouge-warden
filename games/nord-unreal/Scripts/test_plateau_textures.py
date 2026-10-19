"""CPU checks for the replica greystone and slate textures (Scripts/plateau_textures.py).

Run from games/nord-unreal:  python3 Scripts/test_plateau_textures.py
Builds the textures twice into temporary directories (about 30 s), then checks byte-identical output,
the PNG structure, seamless tiling, the ashlar and slate layouts, the normal maps, colour and roughness
means, the tints the apply step will need, and that the committed folder matches the generator.
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


def files(directory):
    return {p.name: p.read_bytes() for p in sorted(Path(directory).iterdir()) if p.is_file()}


def pixels(data):
    """(width, height, rows of RGB bytes) from a PNG written by plateau_textures.png()."""
    width, height, raw = T.read_png(data)
    stride = 1 + 3 * width
    assert all(raw[y * stride] == 0 for y in range(height)), 'Expected filter type 0 on every scanline'
    return width, height, [raw[y * stride + 1:(y + 1) * stride] for y in range(height)]


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
    return {'limestone_courses_cm': [round(h / px_cm, 1) for h in layout['heights']],
            'limestone_stones_per_course': [len(j) for j in layout['joints']]}


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


def main():
    report = {'layouts': check_layouts()}
    with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
        index = T.prepare(a)
        T.prepare(b)
        fa, fb = files(a), files(b)
        assert fa.keys() == fb.keys() and all(fa[k] == fb[k] for k in fa), \
            'Non-deterministic output: ' + str([k for k in fa if fa.get(k) != fb.get(k)])
        assert len(fa) == 1 + 3 * len(T.SETS)
        report['determinism'] = f'{len(fa)} files byte-identical across two builds'
        plex = apply_replica.ROOT / 'Data/Plateau/ReplicaGeometry/Plex/manifest.json'
        plex_materials = json.loads(plex.read_text())['materials'] if plex.is_file() else {}
        summary = {}
        for key, spec in T.SETS.items():
            entry = index['sets'][key]
            assert entry['size_px'] == list(spec['size_px']) and entry['tile_m'] == list(spec['tile_m'])
            assert all(abs(t * m - 1) < 1e-6 for t, m in zip(entry['tiling'], entry['tile_m']))
            maps = {}
            for role in T.ROLES:
                m = entry['maps'][role]
                data = fa[m['file']]
                assert hashlib.sha256(data).hexdigest() == m['sha256']
                assert hashlib.sha256(T.read_png(data)[2]).hexdigest() == m['raw_sha256']
                assert (m['srgb'], m['compression'], m['sampler']) == tuple(T.IMPORT[role][k] for k in ('srgb', 'compression', 'sampler'))
                width, height, rows = pixels(data)
                assert [width, height] == entry['size_px']
                sx, sy = seam_ratio(width, height, rows)
                assert sx < 1.6 and sy < 1.6, f'{m["file"]} seam {sx:.2f} x {sy:.2f} the neighbour step'
                maps[role] = rows
                summary[m['file']] = {'bytes': len(data), 'sha256': m['sha256'], 'seam': [round(sx, 2), round(sy, 2)]}
            # Normals: unit length, no overall tilt (a tileable height field has zero mean slope), mostly facing out.
            n = maps['nor_dx']
            r_mean, g_mean, b_mean = (T.channel_mean(n, c) for c in range(3))
            assert abs(r_mean - .5) < .02 and abs(g_mean - .5) < .02 and b_mean > .9, (key, r_mean, g_mean, b_mean)
            worst = max(abs(sqrt(sum((row[3 * x + c] / 127.5 - 1) ** 2 for c in range(3))) - 1)
                        for row in n[::17] for x in range(0, len(row) // 3, 13))
            assert worst < .02, (key, worst)
            # Colour and roughness: greystone is a near-neutral grey, slate a dark blue-grey.
            mean = entry['mean_linear']
            assert mean == T.linear_mean(maps['diff'])
            if key == 'limestone':
                assert .18 < sum(mean) / 3 < .38 and max(mean) / min(mean) < 1.2, mean
                assert .8 <= entry['roughness_mean'] <= .92, entry['roughness_mean']
            else:
                assert sum(mean) / 3 < .12 and mean[2] > mean[0] and mean[2] > mean[1], mean
                assert .44 <= entry['roughness_mean'] <= .56, entry['roughness_mean']
                check_slate_gaps(maps['rough'], spec)
            assert abs(entry['roughness_mean'] - T.channel_mean(maps['rough'], 0)) < 1e-4
            # Tints the apply step derives from the Plex colours stay in range and keep the texture's contrast.
            for name, spec_m in plex_materials.items():
                if apply_replica.texture_set(name, spec_m) == key:
                    tint = [c / m for c, m in zip(apply_replica.linear(spec_m['base_color_srgb']), mean)]
                    assert .2 <= min(tint) and max(tint) <= apply_replica.TINT_LIMIT, (name, tint)
                    assert abs(entry['roughness_mean'] - spec_m['roughness']) < .08, (name, entry['roughness_mean'])
                    summary[f'tint {name}'] = [round(t, 3) for t in tint]
        report['maps'] = summary
        # The committed folder is this generator's output (pixel streams; file bytes may vary with zlib).
        committed = T.OUT / T.INDEX
        if committed.is_file():
            stored = json.loads(committed.read_text())
            for key in T.SETS:
                for role in T.ROLES:
                    m = stored['sets'][key]['maps'][role]
                    assert m['raw_sha256'] == index['sets'][key]['maps'][role]['raw_sha256'], \
                        f'{m["file"]}: rerun python3 Scripts/plateau_textures.py'
                    raw = T.read_png((T.OUT / m['file']).read_bytes())[2]
                    assert hashlib.sha256(raw).hexdigest() == m['raw_sha256'], f'{m["file"]} is stale'
                assert stored['sets'][key]['mean_linear'] == index['sets'][key]['mean_linear']
            report['committed'] = 'Data/Plateau/ReplicaGeometry/Textures matches the generator'
    print(json.dumps(report, indent=1))
    print('Plateau texture checks passed')


if __name__ == '__main__':
    main()
