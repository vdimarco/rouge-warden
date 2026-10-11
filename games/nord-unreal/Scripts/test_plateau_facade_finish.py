"""Check the bounded corner and closed cornice geometry without an editor."""
import json

import plateau_facade_finish as finish


def main():
    mesh, result = finish.build()
    _, repeat = finish.build()
    assert result == repeat
    assert result['triangles'] < 15000
    assert all(not record['collision'] for record in result['materials'].values())
    assert len(result['corner_edges']) == 4
    assert {(edge['id'], edge['edge_index']) for edge in result['corner_edges']} == {
        ('356350796', 1), ('356350796', 2), ('356350765', 2), ('345835052', 4)}
    assert all(not edge['stairs'] and not edge['balcony_levels'] and not edge['commercial']
               and edge['height'] == 960.0000000000001 for edge in result['corner_edges'])
    # Every former rake gets five connected closing faces (10 triangles).
    assert len(result['metal_cornices']) >= 60
    assert any(cap['id']=='356350916' for cap in result['metal_cornices'])
    manifest = json.loads((finish.DIRECTORY/'finish.json').read_text())
    finish.inputs(manifest)
    assert manifest == {**json.loads(json.dumps(result)), 'source_sha256':manifest['source_sha256'],
                        'geometry_sha256':manifest['geometry_sha256']}
    print(f"PASS: {len(result['metal_cornices'])} closed metal cornices, four exact QA-visible edges on three parcels, {result['triangles']} triangles, {len(result['materials'])} batches, deterministic geometry and zero collision")


if __name__=='__main__':
    main()
