"""Perimeter selection, survey preservation and nonblocking decoration checks."""
import copy
import json
import math

from plateau_perimeter import STREETS, build_perimeter
from plateau_mesh import Mesh
import plateau_tower
import plateau_school


def assert_backing(mesh, result):
    faces = {frozenset(tuple(round(value, 3) for value in point) for point in face)
             for group in mesh.groups.values() for face in group if len(face) == 4}
    for front in result['fronts']:
        depth = 8 * min(1, max(.43, front['setback'] / 70))
        assert depth > 3, 'Backing must sit outside the legacy 3 cm glass cards'
        a, b, normal, height = front['a'], front['b'], front['normal'], front['height']
        corners = [(point[0] + normal[0] * depth, point[1] + normal[1] * depth, z)
                   for point, z in ((a, 0), (b, 0), (b, height), (a, height))]
        assert frozenset(tuple(round(value, 3) for value in point) for point in corners) in faces, front['id']


def check():
    boundary = [(0, 0), (6000, 0), (6000, 6000), (0, 6000)]
    buildings = [
        {'id': '101', 'points': [(1000, -5000), (1900, -5000), (1900, -3000), (1000, -3000)]},
        {'id': '102', 'points': [(9000, 1000), (11000, 1000), (11000, 1900), (9000, 1900)]},
        {'id': '103', 'points': [(1000, 9000), (1900, 9000), (1900, 11000), (1000, 11000)]},
        {'id': '104', 'points': [(-5000, 1000), (-3000, 1000), (-3000, 1900), (-5000, 1900)]}]
    for building in buildings:
        building.update(height=960, tags={'building:levels': '3'})
    buildings[3]['tags']['building:material'] = 'limestone'
    lines = [[(-1000, -1500), (7000, -1500)], [(7500, -1000), (7500, 7000)],
             [(-1000, 7500), (7000, 7500)], [(-1500, -1000), (-1500, 7000)]]
    roads = [{'points': points, 'width': 620, 'name': name, 'tags': {'highway': 'residential'}}
             for points, name in zip(lines, STREETS)]
    originals = copy.deepcopy((buildings, roads, boundary))
    mesh, result = build_perimeter(buildings, roads, boundary, [])
    repeated, same = build_perimeter(buildings, roads, boundary, [])
    assert originals == (buildings, roads, boundary), 'Never mutate the retained survey'
    assert result == same and mesh.groups == repeated.groups, 'Geometry and finish variation must be stable'
    assert_backing(mesh, result)
    assert len(result['fronts']) == len({front['id'] for front in result['fronts']}) == 4
    assert {front['street'] for front in result['fronts']} == set(STREETS)
    assert result['counts']['storefronts'] == 0, 'Do not invent new named businesses'
    assert result['new_collision'] is False
    assert all(not material['collision'] and not name.endswith('_Collision')
               for name, material in result['materials'].items())
    assert result['counts']['recessed_windows'] > 20 and result['counts']['balconies'] > 0
    assert result['counts']['exterior_stairs'] > 0
    for front in result['fronts']:
        source = next(building for building in buildings if building['id'] == front['id'])
        assert tuple(front['a']) in source['points'] and tuple(front['b']) in source['points']
        assert front['height'] == source['height'] and front['height_source'] == 'OSM levels × 3.2 m'
        assert front['window_width_cm'] <= 98, 'Tall sash proportions must survive narrow lots'
        assert not front.get('corner_returns'), 'Do not cover side/rear shells with invented park fronts'
    tagged = next(front for front in result['fronts'] if front['id'] == '104')
    assert tagged['style'] == 'Limestone' and tagged['masonry_source'] == 'OSM material tag'
    without, reduced = build_perimeter(buildings, roads, boundary, ['102'])
    assert {front['id'] for front in reduced['fronts']} == {'101', '103', '104'}
    assert reduced['triangles'] < result['triangles']
    assert result['triangles'] < 100000 and len(result['materials']) < 80
    tower = Mesh()
    landmark = plateau_tower.build(tower)
    assert landmark['storeys'] == 17 and landmark['height_cm'] == 5744.392
    assert landmark['collision'] is False and landmark['windows'] > 100 and landmark['balconies'] > 0
    assert set(tower.groups) == set(plateau_tower.PALETTE)
    repeated_tower = Mesh()
    assert plateau_tower.build(repeated_tower) == landmark and tower.groups == repeated_tower.groups
    assert all(not name.endswith('_Collision') for name in tower.groups)
    disguised_tower = copy.deepcopy(buildings)
    disguised_tower[0]['id'] = plateau_tower.OSM_ID
    _, excluded = build_perimeter(disguised_tower, roads, boundary, [])
    assert plateau_tower.OSM_ID not in {front['id'] for front in excluded['fronts']}
    school = Mesh()
    school_info = plateau_school.build(school)
    assert school_info['survey_triangles'] == 626 and abs(school_info['height_cm'] - 2401.7206) < .001
    assert school_info['collision'] is False and school_info['windows'] > 100
    assert set(school.groups) == set(plateau_school.PALETTE) - {'SchoolTan'}, 'Tan belongs to the copied survey body'
    assert all(wall['height_cm'] > 1500 and wall['classroom_rows'] in (3, 4) for wall in school_info['walls'])
    assert not any(name.endswith('_Collision') for name in school.groups)
    assert all(math.isfinite(value) for faces in mesh.groups.values() for face in faces for point in face for value in point)
    return {'passed': True, 'fronts': len(result['fronts']), 'triangles': result['triangles'],
            'batches': len(result['materials']), 'new_collision': False,
            'tower_windows': landmark['windows'], 'tower_balconies': landmark['balconies'],
            'school_windows': school_info['windows'], 'school_walls': len(school_info['walls'])}


if __name__ == '__main__':
    print(json.dumps(check(), indent=2))
