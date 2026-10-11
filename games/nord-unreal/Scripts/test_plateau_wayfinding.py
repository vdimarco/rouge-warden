"""Production artwork, board geometry, clearances and OBJ import convention."""
import json
import math
from pathlib import Path
import struct
import tempfile

from plateau_cartography import board_clearance, source as cartography_source
from plateau_wayfinding import FRAME_WIDTH, build_geometry, load_cartography, prepare


def _cross(a, b, c):
    u, v = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0]]


def _float32(value):
    return struct.unpack('f', struct.pack('f', value))[0]


def main():
    source = load_cartography()
    survey = cartography_source()
    assert [b['id'] for b in source['boards']] == ['EntreeCalixa', 'PromenadeEtangs']
    mesh, boards = build_geometry(source)
    assert set(mesh.groups) == {'Iron_Collision'}
    # Every steel box/rod is closed and outward, including the small fasteners.
    edges = {}
    for face in mesh.groups['Iron_Collision']:
        p = [tuple(round(v, 6) for v in point) for point in face]
        for a, b in zip(p, p[1:] + p[:1]):
            key = tuple(sorted((a, b)))
            count, direction = edges.get(key, (0, 0))
            edges[key] = count + 1, direction + (1 if a < b else -1)
        q = [tuple(_float32(round(v, 3)) for v in point) for point in face]
        for b, c in zip(q[1:-1], q[2:]):
            assert sum(v * v for v in _cross(q[0], b, c)) > 1e-8
    # Adjacent frame parts can share an edge; each closed component contributes
    # two opposite incidences without creating an open boundary.
    assert all(count % 2 == 0 and direction == 0 for count, direction in edges.values())

    with tempfile.TemporaryDirectory() as temporary:
        report = prepare(temporary)
        assert report == json.loads((Path(temporary) / 'wayfinding.json').read_text())
        assert len(report['batches']) == 4
        assert sum(b['collision'] for b in report['batches'].values()) == 2
        first = {p.name: p.read_bytes() for p in Path(temporary).iterdir()}
        assert prepare(temporary) == report
        assert {p.name: p.read_bytes() for p in Path(temporary).iterdir()} == first
        for board in report['boards']:
            assert board['image_size_cm'] == [105, 140]
            assert board['frame_size_cm'] == [112, 148]
            assert board['frame_collision'] and not board['panel_collision']
            assert board['minimum_capsule_edge_clearance_cm'] > 52
            assert board['path_edge_clearance_cm'] > 200
            surveyed = board_clearance(survey, board['position_cm'][:2])
            assert surveyed['path_edge_clearance_cm'] == board['path_edge_clearance_cm']
            assert surveyed['nearest_path'] == board['nearest_path']
            assert len(board['frame_batches']) == 1
            normal, right = board['facing_normal_xy'], board['viewer_right_xy']
            assert abs(sum(a * b for a, b in zip(normal, right))) < 1e-9
            vertices, uvs, triangles = [], [], []
            data = (Path(temporary) / (board['panel_mesh_name'] + '.obj')).read_text()
            for line in data.splitlines():
                fields = line.split()
                if fields[0] == 'v':
                    x, y, z = map(float, fields[1:])
                    vertices.append((_float32(x), _float32(-y), _float32(z)))
                if fields[0] == 'vt':
                    u, v = map(float, fields[1:])
                    uvs.append((u, 1 - v))  # UE importer flips V for Texture2D.
                if fields[0] == 'f':
                    # Mesh.write's winding reversal offsets the Y reflection.
                    triangles.append([int(v.split('/')[0]) - 1 for v in fields[1:]][::-1])
            assert board['texture_built_size_pixels'] == [2048, 2048]
            assert board['texture_uv_bounds'] == [0, 0, .75, 1]
            assert uvs == [(0, 1), (0, 0), (.75, 0), (.75, 1)], 'Artwork inverted, mirrored or padded'
            assert uvs[2][0] * board['texture_built_size_pixels'][0] == board['image_size_pixels'][0]
            assert uvs[0][1] * board['texture_built_size_pixels'][1] == board['image_size_pixels'][1]
            assert [p[2] for p in vertices] == [75, 215, 215, 75]
            assert abs(math.dist(vertices[0], vertices[3]) - 105) < .01
            assert abs(math.dist(vertices[0], vertices[1]) - 140) < .01
            assert sum((vertices[3][i] - vertices[0][i]) * right[i] for i in (0, 1)) > 104.99
            for triangle in triangles:
                cross = _cross(*(vertices[i] for i in triangle))
                assert sum(cross[i] * normal[i] for i in (0, 1)) > 14699
            # Imported triangle bounds retain the exact panel dimensions and source placement.
            for actual, expected in zip(vertices, board['panel_corners_cm']):
                assert math.dist(actual, expected) < .01
            batch = report['batches'][board['frame_batches'][0]]
            assert batch['material'] == 'Iron' and batch['collision'] is True
            assert batch['bounds_cm']['min'][2] == 2
            assert batch['bounds_cm']['max'][2] == 219
            # Whole steel footprint stays safely outside the nearest surveyed
            # path edge, even using a conservative radius rather than orientation.
            assert board['path_edge_clearance_cm'] - math.hypot(FRAME_WIDTH / 2, 7) > 52
        print('PLATEAU_WAYFINDING_SOURCE_OK', len(boards), 'boards,', report['triangles'], 'triangles')


if __name__ == '__main__':
    main()
