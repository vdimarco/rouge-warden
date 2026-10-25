"""Original 1970s-inspired fleet artwork, using the existing geographic mesh exporter."""
import json
import math
from pathlib import Path

import numpy as np
from prepare_park_comic import Mesh

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Data/SeventiesCars'
MATERIALS = {
    'Paint': {'color': [.035, .26, .24], 'roughness': .30, 'metallic': .45},
    'Chrome': {'color': [.65, .70, .73], 'roughness': .23, 'metallic': .92},
    'Ink': {'color': [.012, .017, .021], 'roughness': .65, 'metallic': .10},
    'Rubber': {'color': [.022, .025, .028], 'roughness': .92, 'metallic': 0.},
    'Glass': {'color': [.045, .105, .14], 'roughness': .18, 'metallic': .42},
    'Lens': {'color': [.78, .73, .53], 'roughness': .22, 'metallic': .15},
    'Red': {'color': [.42, .018, .025], 'roughness': .28, 'metallic': .12},
    'Amber': {'color': [.70, .24, .018], 'roughness': .26, 'metallic': .12},
    'Cream': {'color': [.72, .66, .48], 'roughness': .62, 'metallic': .05},
    'Vinyl': {'color': [.035, .028, .022], 'roughness': .88, 'metallic': 0.},
}
PAINTS = [[.035, .26, .24], [.36, .045, .055], [.54, .32, .065], [.075, .15, .30]]
PROFILES = (
    {'name': 'fastback coupe', 'rear': -166., 'back_top': -82., 'front_top': 17., 'height': 60., 'roof_width': 69.},
    {'name': 'notchback sedan', 'rear': -146., 'back_top': -108., 'front_top': 20., 'height': 66., 'roof_width': 71.},
    {'name': 'long-roof wagon', 'rear': -204., 'back_top': -185., 'front_top': 20., 'height': 69., 'roof_width': 72.},
)


def outline(mesh, points, radius=1.1, material='Chrome', closed=True):
    for a, b in zip(points, points[1:] + (points[:1] if closed else [])):
        mesh.rod(a, b, radius, material, 6)


def revolve(mesh, profile, material, segments=40):
    """Radius/Z cross section about local Z, the existing wheel component axis."""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        for i in range(segments):
            a, b = i * math.tau / segments, (i + 1) * math.tau / segments
            points = [(r0*math.cos(a), r0*math.sin(a), z0), (r0*math.cos(b), r0*math.sin(b), z0),
                      (r1*math.cos(b), r1*math.sin(b), z1), (r1*math.cos(a), r1*math.sin(a), z1)]
            if r0 == 0: points = points[1:]
            if r1 == 0: points = points[:3]
            if len(set(points)) >= 3: mesh.face(points, material)


def width_at(x):
    return 91. + 5. * math.sin(math.pi * (x + 220.) / 440.)


def top_at(x):
    return float(np.interp(x, [-220, -170, -90, 75, 165, 220], [-5, 7, 10, 10, 5, -9]))


def bottom_at(x):
    return max([-60.] + [-64. + math.sqrt(max(0., 44.**2 - (x-c)**2))
                        for c in (-155., 155.) if abs(x-c) <= 44.])


def side_y(x, z, sign):
    return sign * (width_at(x) - max(0., -z-24.) * .105)


def body(profile):
    mesh = Mesh()
    xs = {-220., -211., -200., -105., -80., 0., 80., 105., 200., 211., 220.}
    for c in (-155., 155.):
        xs.update(c + 44.*math.cos(i*math.pi/20) for i in range(21))
    xs = sorted(xs)
    # Rolled upper shoulder and recessed lower sill, with actual open wheel arches.
    def section(x):
        z, y, low = top_at(x), width_at(x), bottom_at(x)
        return [(x, -y+8, z), (x, -y, z-8), (x, -y+1, max(low, -23.)),
                (x, side_y(x, low, -1), low), (x, side_y(x, low, 1), low),
                (x, y-1, max(low, -23.)), (x, y, z-8), (x, y-8, z)]
    for a, b in zip(xs, xs[1:]):
        pa, pb = section(a), section(b)
        for j in range(8):
            k = (j+1) % 8
            mesh.face([pa[j], pa[k], pb[k], pb[j]], 'Paint')
    mesh.face(section(xs[0]), 'Paint', (-1, 0, 0))
    mesh.face(section(xs[-1]), 'Paint', (1, 0, 0))
    for sign in (-1, 1):
        # Thin chrome belt, sculpted wheel lips and black wheel-well recesses.
        outline(mesh, [(x, sign*(width_at(x)+.25), top_at(x)-10.) for x in xs], .65, closed=False)
        for cx in (-155., 155.):
            lip = [(cx + 44.*math.cos(a), sign*(width_at(cx + 44.*math.cos(a))+.35), -64.+44.*math.sin(a))
                   for a in np.linspace(0, math.pi, 25)]
            outline(mesh, lip, 1.35, closed=False)
            for a, b in zip(lip, lip[1:]):
                mesh.face([a, b, (b[0], b[1]-sign*10, b[2]), (a[0], a[1]-sign*10, a[2])], 'Ink')
        outline(mesh, [(-108., sign*92., -56.), (108., sign*92., -56.)], 1.5, closed=False)
        # Panel gaps and period push-button door handles.
        doors = (-84., 61.) if profile == 0 else (-112., -22., 65.)
        for x in doors:
            outline(mesh, [(x, side_y(x, z, sign)+sign*.4, z) for z in (3., -23., -52.)], .55, 'Ink', False)
        for x in ((-69.,) if profile == 0 else (-96., -7.)):
            mesh.box((x, sign*(width_at(x)+1), -2.), (16, 2.5, 2.8), 'Chrome')
            mesh.box((x+9, sign*(width_at(x)+1.8), -2.), (2.5, 1.8, 2.5), 'Ink')
        # Side marker lamps, rocker molding and a separate mirror stalk/housing.
        for x, mat in ((203., 'Amber'), (-205., 'Red')):
            mesh.box((x, sign*(width_at(x)+.5), -28.), (9, 1.4, 4), 'Chrome')
            mesh.box((x, sign*(width_at(x)+1.3), -28.), (7, .8, 2.8), mat)
        mesh.rod((63., sign*79., 16.), (54., sign*102., 21.), 1.7, 'Chrome')
        mesh.ellipsoid((54., sign*104., 23.), (22, 12, 12), 'Chrome', 16, 8)
        mesh.box((44., sign*104., 23.), (1., 9., 8.), 'Glass')
    # Hood center crease, inset cowl vents and a rear deck seam.
    for y in (-49., 49.):
        outline(mesh, [(90., y, 11.), (170., y, 5.7), (205., y*.94, -3.9)], .50, 'Ink', False)
    outline(mesh, [(91., -69., 10.8), (91., 69., 10.8)], .6, 'Ink', False)
    for y in range(-55, 56, 5):
        mesh.box((90., y, 11.), (8., 1.4, .5), 'Ink')
    if profile < 2:
        outline(mesh, [(-188., -69., 3.5), (-188., 69., 3.5)], .65, 'Ink', False)
    # Recessed full-width front fascia, four round sealed-beam lamps and fine grille bars.
    mesh.box((220.6, 0., -24.), (2.4, 174., 27.), 'Chrome')
    mesh.box((222., 0., -24.), (1.8, 168., 23.), 'Ink')
    for y in range(-39, 40, 6):
        mesh.box((223.1, y, -24.), (1.1, 1.0, 19.), 'Chrome')
    for z in (-29., -23., -17.): mesh.box((223.2, 0., z), (1., 83., .65), 'Chrome')
    for y in (-69., -48., 48., 69.):
        mesh.rod((220., y, -23.), (224., y, -23.), 10., 'Chrome', 32)
        mesh.rod((224., y, -23.), (225., y, -23.), 8.2, 'Lens', 32)
        for dz in (-4., 0., 4.):
            length = math.sqrt(8.**2-dz**2)
            mesh.rod((225.4, y-length, -23.+dz), (225.4, y+length, -23.+dz), .22, 'Cream', 4)
    # Wraparound chrome impact bumpers, overriders and amber turn indicators.
    for end in (-1, 1):
        outline(mesh, [(end*211., -90., -45.), (end*225., -79., -45.),
                       (end*228., -66., -45.), (end*228., 66., -45.),
                       (end*225., 79., -45.), (end*211., 90., -45.)], 5., 'Chrome', False)
        for y in (-57., 57.):
            mesh.box((end*228.5, y, -44.), (7., 5., 15.), 'Ink')
    # One licence plate, at the rear only. Quebec has required only a rear plate since 1979
    # (Wikipedia, "Vehicle registration plates of Quebec").
    mesh.box((-222., 0., -51.), (3., 27., 11.), 'Chrome')
    mesh.box((-224., 0., -51.), (1.5, 24., 8.5), 'Cream')
    for y in range(-8, 9, 4): mesh.box((-225., y, -51.), (1., 1.2, 4.), 'Ink')
    for y in (-52., 52.): mesh.box((223., y, -37.), (3., 18., 4.), 'Amber')
    mesh.box((-221., 0., -23.), (3., 172., 23.), 'Chrome')
    mesh.box((-223., 0., -23.), (2., 166., 19.), 'Ink')
    for y in (-60., 60.):
        mesh.box((-224.5, y, -23.), (2., 36., 13.), 'Red')
        for dy in (-9., 0., 9.): mesh.box((-226., y+dy, -23.), (1., .7, 13.), 'Chrome')
    for sign in (-1, 1):
        mesh.rod((-184., sign*51., -61.), (-222., sign*51., -61.), 3., 'Chrome', 12)
        mesh.rod((-223., sign*51., -61.), (-224., sign*51., -61.), 2.3, 'Ink', 12)
    return mesh


def cabin(profile):
    p = PROFILES[profile]
    rear, back, front, height, width = p['rear'], p['back_top'], p['front_top'], p['height'], p['roof_width']
    mesh, roof = Mesh(), Mesh()
    # Glass panes sit inside broad painted pillars instead of being a solid glass cube.
    for sign in (-1, 1):
        xz = [(rear+9., 12.), (back+9., height-7.), (front-7., height-7.), (74., 12.)]
        q = [(x, sign*(81.-(z-10.)/(height-10.)*(81.-width)), z) for x, z in xz]
        mesh.face(q, 'Glass', (0, sign, 0)); outline(mesh, q, .9)
        outer = [(rear, sign*83., 10.), (back, sign*width, height),
                 (front, sign*width, height), (82., sign*82., 10.)]
        for i in range(4):
            j = (i+1) % 4
            roof.face([outer[i], outer[j], q[j], q[i]], 'Paint', (0, sign, 0))
        split = -34. if profile == 0 else -24.
        mesh.rod((split, sign*80.5, 12.), (split, sign*(width+1), height-6.), 2.1, 'Ink')
        if profile == 2:
            mesh.rod((-112., sign*80.5, 12.), (-112., sign*(width+1), height-6.), 2.6, 'Chrome')
        # Painted A/C pillars and curved lower window trim.
        for a, b, radius in (((rear, sign*83., 10.), (back, sign*width, height), 4.3),
                             ((82., sign*82., 10.), (front, sign*width, height), 3.3)):
            roof.rod(a, b, radius, 'Paint')
        roof.rod((rear, sign*83., 9.), (82., sign*82., 9.), 1.2, 'Chrome')
    # Windshield and rear glass: narrower roof, leaning pillars, chrome weather seals.
    for bottom, top, facing in ((82., front, 1), (rear, back, -1)):
        q = [(bottom, -78., 12.), (bottom, 78., 12.), (top, width-4., height-4.), (top, -width+4., height-4.)]
        mesh.face(q, 'Glass', (facing, 0, 1)); outline(mesh, q, 1.05)
        outer = [(bottom, -82., 10.), (bottom, 82., 10.), (top, width, height), (top, -width, height)]
        for i in range(4):
            j = (i+1) % 4
            roof.face([outer[i], outer[j], q[j], q[i]], 'Paint', (facing, 0, 1))
    # Real gently crowned roof with a shallow drip rail, not a scaled flat box.
    for x0, x1 in zip(np.linspace(back-3., front+3., 9), np.linspace(back-3., front+3., 9)[1:]):
        for y0, y1 in zip(np.linspace(-width, width, 13), np.linspace(-width, width, 13)[1:]):
            def point(x, y): return (x, y, height+2.4*(1.-(y/width)**2))
            roof.face([point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)], 'Paint', (0, 0, 1))
    for sign in (-1, 1): roof.rod((back-3., sign*width, height), (front+3., sign*width, height), 1.15, 'Chrome')
    for y in (-31., 31.):
        mesh.rod((79., y, 12.8), (64., y+7., 27.), .8, 'Ink', 6)
    if profile == 0:
        # Coupe sail panels make the fastback silhouette wider and more substantial.
        for sign in (-1, 1):
            roof.face([(-170., sign*84., 9.), (-88., sign*72., 61.), (-73., sign*72., 61.), (-134., sign*84., 9.)], 'Paint', (0, sign, 1))
    if profile == 2:
        for y in (-53., 53.):
            roof.rod((-174., y, height+6.), (5., y, height+6.), 1.7, 'Chrome')
            for x in (-164., -7.): roof.rod((x, y, height+2.), (x, y, height+6.), 1.3, 'Chrome')
    return mesh, roof


def wheels():
    tire, rim = Mesh(), Mesh()
    revolve(tire, [(23., -11.), (28., -13.), (33., -11.), (36., -7.), (36., 7.), (33., 11.), (28., 13.), (23., 11.)], 'Rubber', 48)
    # Tread blocks follow the rolling surface; thin raised white sidewall rings are period detail.
    for i in range(48):
        a = i*math.tau/48
        for sign in (-1, 1):
            tire.rod((35.7*math.cos(a), 35.7*math.sin(a), sign*1.),
                     (35.7*math.cos(a+.035), 35.7*math.sin(a+.035), sign*6.), .42, 'Ink', 4)
    for sign in (-1, 1):
        revolve(tire, [(28.5, sign*12.6), (30., sign*12.3)], 'Cream', 48)
    revolve(rim, [(0., -1.5), (7., -1.5), (8., -3.), (20., -3.5), (23., -2.),
                  (23., 2.), (20., 3.5), (8., 3.), (7., 1.5), (0., 1.5)], 'Chrome', 40)
    for sign in (-1, 1):
        # Recessed five slots and lug bolts give the wheel depth at street distance.
        for i in range(5):
            a = i*math.tau/5
            q = [(r*math.cos(a+t), r*math.sin(a+t), sign*3.65) for r, t in ((10., -.10), (18., -.17), (18., .17), (10., .10))]
            rim.face(q, 'Ink', (0, 0, sign))
            rim.rod((5.*math.cos(a), 5.*math.sin(a), sign*1.5), (5.*math.cos(a), 5.*math.sin(a), sign*3.), .9, 'Chrome', 8)
    return tire, rim


def main():
    (OUT/'Geometry').mkdir(parents=True, exist_ok=True)
    (OUT/'Geometry/comic.mtl').write_text('\n'.join(
        'newmtl '+name+'\nKd '+' '.join(map(str, properties['color']))+'\n'
        for name, properties in MATERIALS.items()))
    models = []
    for i in range(3):
        glass, roof = cabin(i)
        for name, mesh in ((f'Car70Body{i}', body(i)), (f'Car70Cabin{i}', glass), (f'Car70Roof{i}', roof)):
            models.append(mesh.save(name, OUT/'Geometry', smooth=True))
    for name, mesh in zip(('Car70Tire', 'Car70Rim'), wheels()):
        models.append(mesh.save(name, OUT/'Geometry', smooth=True))
    (OUT/'manifest.json').write_text(json.dumps({'profiles': [p['name'] for p in PROFILES],
        'materials': MATERIALS, 'paints': PAINTS, 'models': models,
        'source': 'Original procedural artwork. 1970s-inspired, no manufacturer badges or extracted assets.',
        'units': 'centimetres; X forward; pivot and wheel centres match existing QuebecCar'}, indent=2)+'\n')
    assert len(models) == 11 and all(0 < m['triangles'] < 15000 for m in models)
    print(json.dumps({'models': len(models), 'triangles': sum(m['triangles'] for m in models)}))


if __name__ == '__main__':
    main()
