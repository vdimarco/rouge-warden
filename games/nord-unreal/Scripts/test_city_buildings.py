"""Check CityGML triangulation preserves a courtyard, its winding and geographic origin."""
import numpy as np
import json
from prepare_city_buildings import local, triangles, ring
import xml.etree.ElementTree as ET
assert ring(ET.fromstring('<g:LinearRing xmlns:g="http://www.opengis.net/gml"><g:posList>299339 5042788 10 299339 5042788 10</g:posList></g:LinearRing>')) == []

outer = [(0,0,0),(10,0,0),(10,10,0),(0,10,0)]
hole = [(3,3,0),(3,7,0),(7,7,0),(7,3,0)]
for rings in ([outer,hole], [[(x,0,y) for x,y,z in r] for r in (outer,hole)]):
    points = np.array([p for r in rings for p in r])
    tris = list(triangles(rings))
    area = sum(np.linalg.norm(np.cross(points[b]-points[a],points[c]-points[a]))/2 for a,b,c in tris)
    assert abs(area-84)<1e-8, area
x,y,z = local((299339.8298339926,5042788.285064886,10))
assert abs(x)<.1 and abs(y)<.1 and z==1000, (x,y,z)
from pathlib import Path
manifest=json.loads((Path(__file__).resolve().parents[1]/'Data/CityBuildings/manifest.json').read_text())
assert not any(b['id']=='2316936' for b in manifest['buildings']),'Park-wide composite must not obscure current landmarks'
for obj in (Path(__file__).resolve().parents[1]/'Data/CityBuildings/Geometry').glob('*.obj'):
    assert sum(line.startswith('usemtl ') for line in obj.read_text().splitlines()) <= 2, obj.name
print('NORD_CITY_TEST_OK courtyard, wall-plane triangulation, geographic origin')
