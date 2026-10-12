"""Author the short La Fontaine / Panet / Visitation environment route from OSM."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from prepare_lafontaine import BOUNDS, inside, xy, tags, road_width, clip_segment
from plateau_mesh import Mesh
from plateau_batches import spatial_batches

ROOT = Path(__file__).resolve().parents[1]
ROUTE = [(37400,-3280),(38405,-3924),(42703,-6819),(41685,-11320),(40636,-15933),(35500,-14300)]


def geography():
    root = ET.parse(ROOT/'Data/LaFontaine/osm.xml').getroot()
    nodes = {e.get('id'):(float(e.get('lat')),float(e.get('lon'))) for e in root.findall('node')}
    buildings, roads = [], []
    for e in root.findall('way'):
        refs = [nodes[n.get('ref')] for n in e.findall('nd') if n.get('ref') in nodes]
        if len(refs) < 2: continue
        p = [xy(*v) for v in refs]; t = tags(e)
        if 'building' in t and all(inside(v) for v in refs) and p[0] == p[-1]:
            try: height = float(t.get('height',str(float(t.get('building:levels',3))*3.2)).split()[0])*100
            except ValueError: height = 960
            p = p[:-1]
            if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p,p[1:]+p[:1])) < 0: p.reverse()
            buildings.append({'id':e.get('id'),'points':p,'height':max(250,min(6000,height)),'tags':t})
        if t.get('highway') in ('residential','tertiary','secondary','primary','service','unclassified','living_street','footway','path','cycleway','pedestrian','steps'):
            lines = []
            for a,b in zip(p,p[1:]):
                segment = clip_segment(a,b)
                if segment:
                    if lines and math.dist(lines[-1][-1],segment[0]) < .01:
                        lines[-1].append(segment[1])
                    else: lines.append(segment)
            roads.extend({'id':e.get('id'),'points':line,'width':road_width(t),'name':t.get('name',''),'tags':t} for line in lines)
    return buildings,roads


def main():
    from plateau_facades import build_facades
    from plateau_streets import build_streets
    buildings,roads = geography()
    mesh = Mesh()
    facades = build_facades(mesh,buildings,roads,ROUTE)
    streets = build_streets(mesh,buildings,roads,ROUTE)
    mesh, batches, tile_size = spatial_batches(mesh, tile_size_cm=4750, max_batches=800)
    output = ROOT/'Data/Plateau'; output.mkdir(parents=True,exist_ok=True)
    mesh.write(output/'Geometry')
    manifest = {'route':streets['route'],'focus':ROUTE,'facades':facades,'streets':streets,
                'materials':batches, 'batching':{'tile_size_cm':tile_size,'max_batches':800},
                'source':'OpenStreetMap contributors, ODbL 1.0; authored illustrative architecture and fictional storefronts'}
    assert len(facades['fronts']) >= 20, 'Route needs a continuous run of detailed frontage'
    assert all(math.isfinite(v) for p in ROUTE for v in p)
    (output/'layout.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
    print(json.dumps({'facades':facades['counts'],'streets':streets['counts'],
                      'meshes':len(mesh.groups),'triangles':sum(v['triangles'] for v in manifest['materials'].values())},indent=2))


if __name__ == '__main__': main()
