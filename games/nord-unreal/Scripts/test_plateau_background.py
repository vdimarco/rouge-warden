"""Prove legacy OBJ partitioning preserves exact UVs, polygons and orientation."""
from collections import Counter
from pathlib import Path
import tempfile

from plateau_background import SOURCES, partition, read_obj, write_obj


def canonical(faces):
    return Counter(tuple(face) for face in faces)


def main():
    # A concave roof n-gon makes accidental fan triangulation visible to this test.
    vertices = [('0.000', '0.000', '960.000'), ('8000.000', '0.000', '960.000'),
                ('8000.000', '4000.000', '960.000'), ('4000.000', '2000.000', '960.000'),
                ('0.000', '4000.000', '960.000')]
    uvs = [('-0.00123', '12.34567'), ('27.11111', '0.00001'), ('27.11111', '13.77777'),
           ('13.12345', '6.54321'), ('-0.00123', '13.77777')]
    with tempfile.TemporaryDirectory() as directory:
        source = Path(directory) / 'source'
        source.mkdir()
        for index, material in enumerate(SOURCES):
            path = source / (material + '.obj')
            text = ['o ' + material]
            text += ['v ' + ' '.join((str(float(v[0]) + index * 18000), v[1], v[2])) for v in vertices]
            text += ['vt ' + ' '.join(uv) for uv in uvs]
            text += ['f -1/-1 -2/-2 -3/-3 -4/-4 -5/-5']
            if material == 'Roof':
                # Centroids share a100m tile, while their union would be160m wide.
                text += ['v ' + ' '.join((str(float(v[0]) + 46000), v[1], v[2])) for v in vertices]
                text += ['f -1/-1 -2/-2 -3/-3 -4/-4 -5/-5']
            path.write_text('\n'.join(text) + '\n')
        before = {material: (source / (material + '.obj')).read_bytes() for material in SOURCES}
        mesh, manifest, attributes = partition(source, 10000)
        assert manifest['triangles'] == 15 and manifest['faces'] == 5
        assert len(manifest['batches']) == 5
        assert all(max(m['bounds_cm'][1][i] - m['bounds_cm'][0][i] for i in (0, 1)) <= 12000 for m in manifest['batches'].values())
        output = Path(directory) / 'output'
        output.mkdir()
        recovered = {material: [] for material in SOURCES}
        for name, faces in mesh.groups.items():
            path = output / (name + '.obj')
            write_obj(path, name, faces, attributes)
            records = read_obj(path)
            recovered[manifest['batches'][name]['material']] += records
            assert all(len(face) == 5 for face in records), 'Keep the original concave polygon triangulation input'
            assert manifest['batches'][name]['collision'] is False
        for material in SOURCES:
            assert canonical(read_obj(source / (material + '.obj'))) == canonical(recovered[material]), 'Position/UV tokens and winding must survive exactly once'
            assert (source / (material + '.obj')).read_bytes() == before[material]
        _, repeated, _ = partition(source, 10000)
        assert repeated == manifest, 'Batch names, bounds and metadata must be stable'
    print('Plateau background checks passed')


if __name__ == '__main__':
    main()
