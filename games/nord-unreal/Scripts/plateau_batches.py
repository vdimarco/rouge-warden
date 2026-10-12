"""Bounded spatial batches for Lumen, preserving complete authored mesh faces."""
import math

from plateau_mesh import Mesh


def spatial_batches(mesh, tile_size_cm=3500, max_batches=599):
    """Return a mesh, batch manifest, and actual tile size; inputs stay unchanged."""
    assert tile_size_cm > 0 and max_batches > 0
    source = [(material, face, sum(p[0] for p in face) / len(face),
               sum(p[1] for p in face) / len(face))
              for material, faces in sorted(mesh.groups.items()) for face in faces]
    # Small district details span many materials. Widen the common grid only when
    # necessary to avoid hundreds of tiny static-mesh assets beyond the budget.
    for attempt in range(65):
        size = tile_size_cm + attempt * 250
        buckets = {}
        for material, face, x, y in source:
            key = (material, math.floor(x / size), math.floor(y / size))
            buckets.setdefault(key, []).append(face)
        if len(buckets) <= max_batches:
            break
    else:
        raise ValueError('Spatial mesh budget is too small for this district')

    output, manifest = Mesh(), {}
    for (material, x, y), faces in sorted(buckets.items()):
        coordinate = lambda value: ('M' if value < 0 else 'P') + f'{abs(value):03d}'
        name = f'{material}_X{coordinate(x)}_Y{coordinate(y)}'
        assert name.replace('_', '').isalnum(), name
        output.groups[name] = faces
        manifest[name] = {'material': material.removesuffix('_Collision'),
                          'collision': material.endswith('_Collision'),
                          'tile': [x, y], 'faces': len(faces),
                          'triangles': sum(len(face) - 2 for face in faces)}
    assert sum(len(faces) for faces in output.groups.values()) == len(source)
    assert sum(batch['triangles'] for batch in manifest.values()) == sum(len(face) - 2 for _, face, _, _ in source)
    return output, manifest, size
