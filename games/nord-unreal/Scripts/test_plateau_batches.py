"""Spatial export checks without Unreal or changing project geometry files."""
from collections import Counter
from copy import deepcopy
from pathlib import Path
import tempfile

from plateau_batches import spatial_batches
from plateau_mesh import Mesh


def _bounds(mesh):
    points = [point for faces in mesh.groups.values() for face in faces for point in face]
    return tuple(min(p[i] for p in points) for i in range(3)), tuple(max(p[i] for p in points) for i in range(3))


def _faces(mesh, manifest=None):
    result = Counter()
    for name, faces in mesh.groups.items():
        material = manifest[name]['material'] if manifest else name.removesuffix('_Collision')
        collision = manifest[name]['collision'] if manifest else name.endswith('_Collision')
        result.update((material, collision, tuple(face)) for face in faces)
    return result


def _exported_triangles(directory, manifest=None):
    result = Counter()
    for path in Path(directory).glob('*.obj'):
        material = manifest[path.stem]['material'] if manifest else path.stem.removesuffix('_Collision')
        collision = manifest[path.stem]['collision'] if manifest else path.stem.endswith('_Collision')
        vertices = []
        for line in path.read_text().splitlines():
            fields = line.split()
            if fields[0] == 'v':
                vertices.append(tuple(float(value) for value in fields[1:]))
            elif fields[0] == 'f':
                result[(material, collision, tuple(vertices[int(value.split('/')[0]) - 1] for value in fields[1:]))] += 1
    return result


def main():
    mesh = Mesh()
    mesh.face('BrickRed', [(-100, -100, 0), (4000, -100, 0), (4000, 100, 960), (-100, 100, 960)])
    mesh.face('BrickRed', [(-30, -30, 0), (-10, -30, 0), (-20, -10, 100)])
    mesh.box('Iron_Collision', (7200, -4000, 120), (160, 110, 12), 23)
    original = deepcopy(mesh.groups)
    batches, manifest, size = spatial_batches(mesh)
    assert size == 3500 and len(manifest) >= 3
    assert 'BrickRed_XM001_YM001' in manifest, 'Negative coordinates need floor-based stable tile names'
    assert 'BrickRed_XP000_YP000' in manifest, 'Assign each complete face by its centroid'
    assert mesh.groups == original, 'Batching must not mutate authored input'
    assert _faces(mesh) == _faces(batches, manifest), 'Every original oriented face and collision association must survive exactly once'
    assert _bounds(mesh) == _bounds(batches), 'Spatial batching must preserve world bounds'
    repeated, repeated_manifest, repeated_size = spatial_batches(mesh)
    assert (batches.groups, manifest, size) == (repeated.groups, repeated_manifest, repeated_size)
    with tempfile.TemporaryDirectory() as directory:
        source, partitioned = Path(directory) / 'source', Path(directory) / 'partitioned'
        mesh.write(source)
        batches.write(partitioned)
        assert _exported_triangles(source) == _exported_triangles(partitioned, manifest), 'OBJ positions, triangle winding, materials and collision associations must be identical'
    budget = Mesh()
    for x in range(10):
        budget.face('Trim', [(x * 351, 0, 0), (x * 351 + 10, 0, 0), (x * 351, 10, 50)])
    bounded, records, actual_size = spatial_batches(budget, 350, 4)
    assert actual_size > 350 and len(records) <= 4
    assert _faces(budget) == _faces(bounded, records)
    assert sum(r['triangles'] for r in records.values()) == 10
    print('Plateau spatial batch checks passed')


if __name__ == '__main__':
    main()
