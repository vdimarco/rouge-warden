"""Extract the starting district from municipal CityGML tile ZIPs (CC BY 4.0).

Run with pyproj, numpy and mapbox-earcut installed; see Data/CityBuildings/README.md.
"""
import argparse
import hashlib
import io
import json
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

import mapbox_earcut
import numpy as np
from pyproj import Transformer
from PIL import Image
from prepare_lafontaine import xy, BOUNDS, inside

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/CityBuildings'
NS = {'g': 'http://www.opengis.net/gml', 'b': 'http://www.opengis.net/citygml/building/2.0',
      'a': 'http://www.opengis.net/citygml/appearance/2.0'}
ID = '{' + NS['g'] + '}id'
TO_GEO = Transformer.from_crs(2950, 4326, always_xy=True)
ADDRESS = xy(45.5242984, -73.5647429)


def local(p):
    lon, lat = TO_GEO.transform(p[0], p[1])
    return (*xy(lat, lon), p[2] * 100)


def ring(e):
    values = list(map(float, e.find('g:posList', NS).text.split()))
    assert len(values) % 3 == 0 and all(math.isfinite(v) for v in values)
    points = [local(values[i:i+3]) for i in range(0, len(values), 3)]
    if len(points) < 4: return []  # Survey contains zero-area two-point rings.
    assert math.dist(points[0], points[-1]) < .1, (e.get(ID), points)
    return points[:-1]


def triangles(rings):
    """Project each planar surface onto its dominant plane, keeping hole rings and UV indices."""
    points = np.array([p for r in rings for p in r], dtype=np.float64)
    normal = np.zeros(3)
    for a, b in zip(rings[0], rings[0][1:] + rings[0][:1]):
        normal += np.cross(a, b)
    if np.linalg.norm(normal) < 1: return  # Survey slivers smaller than 0.5 cm².
    plane = np.delete(points, np.argmax(np.abs(normal)), axis=1)
    indices = mapbox_earcut.triangulate_float64(plane, np.cumsum([len(r) for r in rings], dtype=np.uint32))
    assert len(indices) % 3 == 0
    assert len(indices) or np.linalg.norm(normal) < 2, 'Triangulation failed'
    for i in range(0, len(indices), 3):
        face = list(map(int, indices[i:i+3]))
        a, b, c = points[face]
        if np.dot(np.cross(b-a, c-a), normal) < 0: face.reverse()
        yield face


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tiles', nargs='+', type=Path)
    parser.add_argument('--radius', type=float, default=1000, help='Selection radius in metres, clipped to the playable district')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    (OUT/'Geometry').mkdir(exist_ok=True)
    (OUT/'Textures').mkdir(exist_ok=True)
    buildings = {}
    (OUT/'Geometry/facade.mtl').write_text('newmtl Facade\nKd 1 1 1\nnewmtl EstimatedWall\nKd .5 .4 .3\n')
    sources = []
    for tile in args.tiles:
        sources.append({'file': tile.name, 'sha256': hashlib.sha256(tile.read_bytes()).hexdigest()})
        with zipfile.ZipFile(tile) as archive:
            gml = next(n for n in archive.namelist() if n.lower().endswith('.gml'))
            root = ET.fromstring(archive.read(gml))
            for b in root.findall('.//b:Building', NS):
                ident = b.get(ID)
                assert re.fullmatch(r'[A-Za-z0-9_-]+', ident), 'Unsafe building identifier'
                lo = local(list(map(float, b.find('g:boundedBy/g:Envelope/g:lowerCorner', NS).text.split())))
                hi = local(list(map(float, b.find('g:boundedBy/g:Envelope/g:upperCorner', NS).text.split())))
                center = ((lo[0]+hi[0])/2, (lo[1]+hi[1])/2)
                if math.dist(center, ADDRESS) > args.radius * 100: continue
                lon, lat = TO_GEO.transform(*map(float, b.find('g:boundedBy/g:Envelope/g:lowerCorner', NS).text.split()[:2]))
                if not inside((lat, lon)): continue
                if ident in buildings: continue
                # shortcut: this park-wide composite mixes elevations and obsolete facilities; use mapped park models.
                if ident=='2316936':continue
                ground = [p for r in b.findall('.//b:GroundSurface//g:exterior/g:LinearRing', NS) if (p := ring(r))]
                assert ground, ident + ' missing footprint'
                base = min(p[2] for r in ground for p in r)
                textures = b.findall('.//a:ParameterizedTexture', NS)
                assert len(textures) == 1, (ident, len(textures))
                texture = textures[0]
                uv = {e.get('ring').lstrip('#'): list(map(float, e.text.split()))
                      for e in texture.findall('.//a:textureCoordinates', NS)}
                image = texture.find('a:imageURI', NS).text
                image_path = OUT/'Textures'/f'{ident}.jpg'
                image_data = archive.read(str(Path(gml).parent/image))
                with Image.open(io.BytesIO(image_data)) as photo:
                    photo.thumbnail((2048, 2048))
                    photo.convert('RGB').save(image_path, quality=92)
                    texels = photo.width * photo.height
                obj = OUT/'Geometry'/f'{ident}.obj'
                faces = 0
                fallback = 0
                roof_probe = None
                batches = {'Facade': [], 'EstimatedWall': []}
                roofs = set(b.findall('.//b:RoofSurface//g:Polygon', NS))
                walls = set(b.findall('.//b:WallSurface//g:Polygon', NS))
                with obj.open('w') as f:
                    f.write('mtllib facade.mtl\no City_' + ident + '\n'); offset = 1
                    # lod2Solid references these polygons; read actual bounded surfaces only once.
                    for polygon in b.findall('./b:boundedBy//g:Polygon', NS):
                        rings = [polygon.find('g:exterior/g:LinearRing', NS)] + polygon.findall('g:interior/g:LinearRing', NS)
                        points = [ring(r) for r in rings]
                        if not points[0]: continue
                        valid = [(r, p) for r, p in zip(rings, points) if p]
                        rings, points = map(list, zip(*valid))
                        coords = []
                        for r, ps in zip(rings, points):
                            values = uv[r.get(ID)]
                            assert all(math.isfinite(v) for v in values), 'Invalid texture coordinates'
                            assert len(values) == (len(ps)+1)*2, (ident, r.get(ID))
                            coords += list(zip(values[::2], values[1::2]))[:-1]
                        verts = [p for ps in points for p in ps]
                        uv_area = abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(coords[:len(points[0])], coords[1:len(points[0])]+coords[:1])))
                        normal = sum((np.cross(a,b) for a,b in zip(points[0],points[0][1:]+points[0][:1])),np.zeros(3))
                        # Below one texel per 1000 cm², aerial smears cannot describe a facade.
                        edges = [(math.dist(a,b), math.hypot((u[0]-v[0])*photo.width,(u[1]-v[1])*photo.height))
                                 for a,b,u,v in zip(verts,verts[1:]+verts[:1],coords,coords[1:]+coords[:1]) if math.dist(a,b)>10]
                        estimated = polygon in walls or uv_area * texels / max(np.linalg.norm(normal),1) < .001 or any(pixels/cm < .02 for cm,pixels in edges)
                        if estimated:
                            # Aerial wall photographs smear at eye level; retain roof imagery and estimate facades.
                            edge = max((np.array(p)-verts[0] for p in verts[1:]), key=lambda e: math.hypot(e[0],e[1]))
                            length = math.hypot(edge[0], edge[1]) or 1
                            coords = [(x/300,y/300) if abs(normal[2]) > np.linalg.norm(normal)*.7 else ((x*edge[0]+y*edge[1])/length/300, (z-base)/300) for x,y,z in verts]
                            fallback += 1
                        is_roof = polygon in roofs
                        for x,y,z in verts: f.write(f'v {x:.3f} {-y:.3f} {z-base:.3f}\n')
                        for u,v in coords: f.write(f'vt {u:.6f} {v:.6f}\n')
                        for tri in triangles(points):
                            if is_roof:
                                probe = np.mean([verts[i] for i in tri], axis=0).tolist()
                                probe[2] -= base
                                if roof_probe is None or probe[2] > roof_probe[2]: roof_probe = probe
                            batches['EstimatedWall' if estimated else 'Facade'].append('f ' + ' '.join(f'{offset+i}/{offset+i}' for i in reversed(tri)))
                            faces += 1
                        offset += len(verts)
                    for material, batch in batches.items():
                        if batch: f.write('usemtl '+material+'\n'+'\n'.join(batch)+'\n')
                assert faces > 4 and roof_probe is not None
                buildings[ident] = {'id': ident, 'center': center, 'footprints': [[[x,y] for x,y,z in r] for r in ground],
                                    'roof_probe':roof_probe, 'estimated_surfaces':fallback, 'base_elevation_m': base/100, 'height_cm': hi[2]-base, 'triangles': faces,
                                    'texture_sha256': hashlib.sha256(image_path.read_bytes()).hexdigest()}
    assert len(buildings) > 20, 'Insufficient source coverage'
    report = {'source': 'Ville de Montréal — Bâtiments 3D 2016 (LOD2 avec textures)',
              'url': 'https://www.donneesquebec.ca/recherche/dataset/vmtl-batiment-3d-2016-maquette-citygml-lod2-avec-textures2',
              'license': 'CC BY 4.0', 'crs': 'EPSG:2950',
              'excluded_ids': {'2316936':'Park-wide composite with mixed terrain elevations and obsolete facilities; replaced by mapped park models'}, 'radius_m': args.radius, 'tiles': sources,
              'buildings': list(buildings.values())}
    (OUT/'manifest.json').write_text(json.dumps(report, indent=2, ensure_ascii=False))
    print('NORD_CITY_PREPARED', len(buildings), 'buildings', sum(b['triangles'] for b in buildings.values()), 'triangles')


if __name__ == '__main__': main()
