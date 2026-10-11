"""Street furniture and planted alleys for the surveyed La Fontaine walking loop.

Coordinates and dimensions are centimetres. OSM remains the source of street,
sidewalk, crossing and alley placement; the furniture is illustrative.
"""
import math
import random
import struct

from plateau_ground import signed_area as _area, triangulate

WALK_ROUTE = ((35515, -709), (37460, -1947), (37559, -2239), (39398, -4160),
              (39335, -4613), (39247, -5247), (39331, -5337), (39444, -5333),
              (39556, -5377), (39852, -5577), (42407, -7259), (42578, -7372),
              (41685, -11320), (40766, -15363), (40572, -15233), (37832, -13394), (37661, -13229))


def _distance(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0., min(1., ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) /
                    max(1., dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def _inside(p, points):
    result = False
    for a, b in zip(points, points[1:] + points[:1]):
        if (a[1] > p[1]) != (b[1] > p[1]):
            if p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
                result = not result
    return result


def _frame(a, b):
    length = math.dist(a[:2], b[:2])
    ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    return length, ux, uy, -uy, ux, math.degrees(math.atan2(uy, ux))


def _local(origin, yaw):
    c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    return lambda x, y, z: (origin[0] + c * x - s * y,
                             origin[1] + s * x + c * y, z)


def _slab(mesh, mat, a, b, width, za=18., zb=None):
    """A strip with independent end elevations also makes a continuous curb ramp."""
    if math.dist(a[:2], b[:2]) < 1:
        return
    zb = za if zb is None else zb
    _, _, _, nx, ny, _ = _frame(a, b)
    top = [(a[0] - nx * width / 2, a[1] - ny * width / 2, za),
           (b[0] - nx * width / 2, b[1] - ny * width / 2, zb),
           (b[0] + nx * width / 2, b[1] + ny * width / 2, zb),
           (a[0] + nx * width / 2, a[1] + ny * width / 2, za)]
    mesh.face(mat, top)
    if mat.endswith('_Collision'):
        for p, q in zip(top, top[1:] + top[:1]):
            mesh.face(mat, [(*p[:2], 0), (*q[:2], 0), q, p])


def _clip_side(polygon, a, b, inside=True):
    """Clip a convex polygon against either side of a surveyed straight edge."""
    if not polygon:
        return []
    cross = lambda p: (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
    result, previous = [], polygon[-1]
    before = cross(previous)
    for point in polygon:
        after = cross(point)
        keep_before, keep_after = (before >= 0, after >= 0) if inside else (before <= 0, after <= 0)
        if keep_before != keep_after:
            fraction = before / (before - after)
            result.append(tuple(previous[i] + (point[i] - previous[i]) * fraction for i in (0, 1)))
        if keep_after:
            result.append(point)
        previous, before = point, after
    return result


def _subtract_convex(polygon, clip):
    """Partition a convex face outside a CCW pavement/road rectangle."""
    if any(max(p[i] for p in polygon) <= min(p[i] for p in clip) or
           min(p[i] for p in polygon) >= max(p[i] for p in clip) for i in (0, 1)):
        return [polygon]
    outside = []
    for a, b in zip(clip, clip[1:] + clip[:1]):
        part = _clip_side(polygon, a, b, False)
        if len(part) >= 3 and _area(part) > .01:
            outside.append(part)
        polygon = _clip_side(polygon, a, b)
        if len(polygon) < 3 or _area(polygon) < .01:
            break
    return outside


def _road_rectangle(a, b, width):
    _, _, _, nx, ny, _ = _frame(a, b)
    return [(a[0] - nx * width / 2, a[1] - ny * width / 2),
            (b[0] - nx * width / 2, b[1] - ny * width / 2),
            (b[0] + nx * width / 2, b[1] + ny * width / 2),
            (a[0] + nx * width / 2, a[1] + ny * width / 2)]


def _clean_fill(polygon):
    """Discard clipping slivers that OBJ rounding/UE float32 would collapse."""
    polygon = list(polygon)
    converted = lambda p: tuple(struct.unpack('f', struct.pack('f', round(v, 3)))[0] for v in p)
    while len(polygon) >= 3:
        points = [converted(p) for p in polygon]
        for i, b in enumerate(points):
            a, c = points[i - 1], points[(i + 1) % len(points)]
            if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <= .001:
                polygon.pop(i)
                break
        else:
            return polygon
    return []


def _junction_fills(mesh, roads, drive, near):
    """Fill only surveyed junction interiors missing from nominal road strips.

    Crossing ways form the curb-corner perimeter; their existing mapped strip
    widths also retain asphalt beneath the whole crossing. Non-crossing paths,
    raised sidewalks and existing asphalt are excluded. This visual-only fill
    does not alter road-strip widths or pedestrian collision.
    """
    crossings = [r for r in roads if r.get('tags', {}).get('footway') == 'crossing']
    adjacency = {}
    for i, road in enumerate(crossings):
        for p in (road['points'][0], road['points'][-1]):
            adjacency.setdefault(tuple(p[:2]), []).append(i)
    exclusions = [_road_rectangle(a, b, road['width']) for road, a, b in drive]
    exclusions += [[p[:2] for p in face] for material in ('Asphalt', 'Concrete_Collision', 'Limestone_Collision')
                   for face in mesh.groups.get(material, []) if _area([p[:2] for p in face]) > .01]
    exclusions += [_road_rectangle(a, b, road['width']) for road in roads
                   if road.get('tags', {}).get('highway') in ('footway', 'path', 'pedestrian', 'cycleway', 'steps')
                   and road.get('tags', {}).get('footway') != 'crossing'
                   for a, b in zip(road['points'], road['points'][1:]) if math.dist(a, b) > 1]
    pending, sources = set(range(len(crossings))), []
    while pending:
        first = min(pending)
        component, todo = set(), [first]
        while todo:
            i = todo.pop()
            if i in component:
                continue
            component.add(i)
            for p in (crossings[i]['points'][0], crossings[i]['points'][-1]):
                todo.extend(adjacency[tuple(p[:2])])
        pending -= component
        if len(component) < 3 or any(len(adjacency[tuple(p[:2])]) != 2 for i in component
                                   for p in (crossings[i]['points'][0], crossings[i]['points'][-1])):
            continue
        ring, used, current = [], set(), first
        while current not in used:
            used.add(current)
            line = [tuple(p[:2]) for p in crossings[current]['points']]
            if ring and line[0] != ring[-1]:
                line.reverse()
            ring += line if not ring else line[1:]
            current = next(i for i in adjacency[ring[-1]] if i != current)
        if ring[0] != ring[-1] or used != component:
            continue
        ring.pop()
        centre = tuple(sum(p[i] for p in ring) / len(ring) for i in (0, 1))
        if not near(centre) or not any(_inside(centre, _road_rectangle(a, b, road['width'])) for road, a, b in drive):
            continue
        bounds = tuple(min(p[i] for p in ring) for i in (0, 1)) + tuple(max(p[i] for p in ring) for i in (0, 1))
        candidates = triangulate([ring], bounds) + [_road_rectangle(a, b, crossings[i]['width']) for i in sorted(component)
                                           for a, b in zip(crossings[i]['points'], crossings[i]['points'][1:])]
        pieces = []
        for candidate in candidates:
            parts = [candidate]
            for clip in exclusions + pieces:
                parts = [part for polygon in parts for part in _subtract_convex(polygon, clip)]
                if not parts:
                    break
            pieces += parts
        pieces = [clean for part in pieces if (clean := _clean_fill(part))]
        area = sum(_area(part) for part in pieces)
        if area < 1:
            continue
        for part in pieces:
            mesh.face('Asphalt', [(*p, 7) for p in part])
        sources.append({'crossing_way_ids': sorted(crossings[i]['id'] for i in component),
                        'square_metres': round(area / 10000, 3), 'faces': len(pieces)})
    return sources


def _car(mesh, center, yaw, index):
    """A formed body and cabin, curved tyres and inset trim at human scale."""
    wagon = index % 3 == 1
    length, width = (455., 181.) if wagon else (391. + (index % 2) * 18., 175.)
    paint = ('CarBlue', 'CarSilver', 'CarRed', 'CarOlive', 'CarSilver')[index % 5]
    q = _local(center, yaw)
    rings = []
    for x, breadth, low, high in [(-.5,.77,38,72),(-.46,.91,31,88),(-.43,.98,29,100),(-.34,1,28,101),
                                (-.1,1,27,101),(.16,1,28,101),(.27,.99,29,100),(.34,.98,31,88),
                                (.46,.9,35,76),(.5,.74,40,68)]:
        w = width * breadth / 2
        rings.append([q(x * length, y, z) for y, z in
                      [(-w,low+10),(-w*.98,high-12),(-w*.82,high),(w*.82,high),
                       (w*.98,high-12),(w,low+10),(w*.82,low),(-w*.82,low)]])
    mesh.face(paint + '_Collision', rings[0])
    mesh.face(paint + '_Collision', rings[-1][::-1])
    for back, front in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            mesh.face(paint + '_Collision', [back[i], front[i], front[j], back[j]])
    rear, roof_rear = (-.43, -.32) if wagon else (-.35, -.18)
    base = [q(rear * length, -width * .40, 100), q(length * .27, -width * .40, 100),
            q(length * .27, width * .40, 100), q(rear * length, width * .40, 100)]
    roof = [q(roof_rear * length, -width * .365, 153), q(length * .10, -width * .365, 153),
            q(length * .10, width * .365, 153), q(roof_rear * length, width * .365, 153)]
    mesh.face(paint + '_Collision', roof)
    mesh.face(paint + '_Collision', base[::-1])
    for i in range(4):
        j = (i + 1) % 4
        panel = [base[i], base[j], roof[j], roof[i]]
        mesh.face(paint + '_Collision', panel)
        middle = tuple(sum(p[k] for p in panel) / 4 for k in range(3))
        outward = ((-math.sin(math.radians(yaw)), math.cos(math.radians(yaw)), 0) if i in (0, 2)
                   else (math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0))
        sign = -1 if i in (0, 3) else 1
        mesh.face('CarGlass', [tuple(middle[k] + (p[k] - middle[k]) * .88 + outward[k] * sign * .7
                                    for k in range(3)) for p in panel])
        mesh.rod(paint, roof[i], roof[j], 3, 8)
    for side in (-1, 1):
        mesh.rod(paint, q(-length * .07, side * width * .40, 100),
                 q(-length * .07, side * width * .365, 153), 3.5, 8)
        mesh.rod('Rubber', q(rear * length, side * width * .402, 100),
                 q(length * .27, side * width * .402, 100), 1.4, 6)
        for x in (-length * .30, length * .30):
            tyre = [[q(x + radius * math.cos(i * math.tau / 24), side * (width * .48 + axial),
                       38 + radius * math.sin(i * math.tau / 24)) for i in range(24)]
                    for axial, radius in ((-12.5,20),(-12,24),(-9,29),(0,31),(9,29),(12,24),(12.5,20))]
            for inner, outer in zip(tyre, tyre[1:]+tyre[:1]):
                for i in range(24):
                    j = (i + 1) % 24
                    face = [inner[i], inner[j], outer[j], outer[i]]
                    mesh.face('Rubber', face if side < 0 else face[::-1])
            exterior = side * (width * .48 + 12.5)
            mesh.rod('Iron', q(x, exterior, 38), q(x, exterior + side * .8, 38), 21, 24)
            for i in range(24):
                a, b = i * math.tau / 24, (i + 1) * math.tau / 24
                rim = [q(x + radius * math.cos(angle), exterior + side, 38 + radius * math.sin(angle))
                       for radius, angle in ((21,a),(21,b),(18,b),(18,a))]
                mesh.face('Chrome', rim if side < 0 else rim[::-1])
            for i in range(5):
                a = i * math.tau / 5
                spoke = [q(x + radius * math.cos(angle), exterior + side * 1.5, 38 + radius * math.sin(angle))
                         for radius, angle in ((5,a-.2),(18,a-.12),(18,a+.12),(5,a+.2))]
                mesh.face('Chrome', spoke if side < 0 else spoke[::-1])
            mesh.rod('Chrome', q(x, exterior, 38), q(x, exterior + side * 2, 38), 6, 12)
            for i in range(12):
                a, b = i * math.pi / 12, (i + 1) * math.pi / 12
                mesh.rod('Rubber', q(x + 34 * math.cos(a), side * (width / 2 + 1), 38 + 34 * math.sin(a)),
                         q(x + 34 * math.cos(b), side * (width / 2 + 1), 38 + 34 * math.sin(b)), 2, 6)
        for x in (-length * .16, length * .13):
            mesh.box('Chrome', q(x, side * (width * .485), 88), (14, 2, 2.5), yaw)
        mesh.rod('Iron', q(-length * .07, side * width * .493, 39), q(-length * .07, side * width * .493, 96), .65, 5)
        mesh.rod('Rubber', q(-length * .22, side * width * .495, 46), q(length * .22, side * width * .495, 46), 1.5, 6)
        mirror = q(length * .18, side * (width / 2 + 8), 109)
        mesh.rod(paint, q(length * .17, side * width * .44, 106), mirror, 3, 6)
        mesh.box(paint, mirror, (17, 12, 9), yaw)
        mesh.box('CarGlass', q(length * .18 - 8.8, side * (width / 2 + 8), 109), (1, 10, 7), yaw)
        for material, x, z, halfwidth in [('Glow',length/2+1,59,18),('Tail',-length/2-1,64,17)]:
            y = side * width * .245
            housing = [q(x,y-halfwidth-2,z-7),q(x,y+halfwidth+2,z-7),q(x,y+halfwidth+1,z+7),q(x,y-halfwidth+3,z+7)]
            lamp = [q(x + (1 if x>0 else -1),y-halfwidth,z-5),q(x + (1 if x>0 else -1),y+halfwidth,z-5),
                    q(x + (1 if x>0 else -1),y+halfwidth-2,z+5),q(x + (1 if x>0 else -1),y-halfwidth+3,z+5)]
            mesh.face('Iron', housing if x>0 else housing[::-1])
            mesh.face(material, lamp if x>0 else lamp[::-1])
            mesh.rod('Chrome', q(x + (1.2 if x>0 else -1.2),y,z-5), q(x + (1.2 if x>0 else -1.2),y,z+5), .6, 5)
    for x in (-length / 2, length / 2):
        mesh.box('Rubber', q(x, 0, 41), (5, width * .67, 6), yaw)
        mesh.box('White', q(x + (4 if x > 0 else -4), 0, 50), (1, 29, 11), yaw)
    mesh.box('Iron', q(length / 2 + 1.5, 0, 63), (1, 40, 8), yaw)
    for y in (-15,-8,0,8,15):
        mesh.box('Chrome', q(length / 2 + 2.2,y,63), (.5,1,6), yaw)
    for side in (-1,1):
        mesh.rod('Rubber', q(length*.24,side*width*.06,110), q(length*.24,side*width*.30,110), 1, 6)
    mesh.rod('Iron', q(-length*.13,0,156), q(-length*.17,0,180), 1, 6)
    if wagon:
        for side in (-1, 1):
            mesh.rod('Iron', q(-length * .27, side * 50, 159), q(length * .06, side * 50, 159), 3, 6)


def _bicycle(mesh, center, yaw, colour='CarOlive'):
    q = _local(center, yaw)
    for x in (-54, 54):
        ring = [q(x + 33 * math.cos(i * math.tau / 16), 0,
                  53 + 33 * math.sin(i * math.tau / 16)) for i in range(16)]
        for a, b in zip(ring, ring[1:] + ring[:1]):
            mesh.rod('Rubber', a, b, 2.6, 5)
        for i in range(0, 16, 2):
            mesh.rod('Chrome', q(x, 0, 53), ring[i], .65, 4)
    rear, crank, seat, stem, front = q(-54, 0, 53), q(0, 0, 44), q(-22, 0, 104), q(35, 0, 106), q(54, 0, 53)
    for a, b in ((rear, crank), (crank, seat), (seat, rear), (seat, stem), (stem, crank), (stem, front)):
        mesh.rod(colour, a, b, 2.2, 6)
    mesh.rod('Chrome', stem, q(40, 0, 120), 2, 6)
    mesh.rod('Chrome', q(40, -22, 120), q(40, 22, 120), 2, 6)
    mesh.box('Rubber', q(-24, 0, 109), (25, 14, 6), yaw)
    mesh.rod('Chrome', q(0, -12, 44), q(0, 12, 44), 1.8, 6)
    for side in (-1, 1):
        mesh.box('Rubber', q(5 * side, side * 14, 44), (14, 8, 3), yaw)
    mesh.rod('Iron', q(-9, 2, 44), q(-20, 19, 19), 1.6, 5)


def _bench(mesh, center, yaw):
    q = _local(center, yaw)
    for x in (-65, 65):
        mesh.box('Iron_Collision', q(x, 0, 34), (9, 50, 42), yaw)
        mesh.rod('Iron', q(x, -23, 28), q(x, -29, 100), 4, 6)
        mesh.rod('Iron', q(x, 23, 50), q(x, 23, 75), 3, 6)
        mesh.rod('Iron', q(x, 23, 75), q(x, -24, 75), 3, 6)
    for y in (-18, -6, 6, 18):
        mesh.box('Wood_Collision', q(0, y, 59), (168, 10, 6), yaw)
    for z in (78, 91):
        mesh.box('Wood', q(0, -29, z), (168, 6, 10), yaw)


def _leaf(mesh, base, direction, length, width, material='Leaf', curl=0):
    """A pointed eight-edge blade with a folded midrib and a closed underside.

    Individual centimetre-scale leaves give the planting a permeable silhouette.
    The small thickness keeps both sides visible with the existing opaque palette.
    """
    norm = math.sqrt(sum(v * v for v in direction))
    axis = tuple(v / norm for v in direction)
    reference = (0, 0, 1) if abs(axis[2]) < .9 else (0, 1, 0)
    side = (axis[1] * reference[2] - axis[2] * reference[1],
            axis[2] * reference[0] - axis[0] * reference[2],
            axis[0] * reference[1] - axis[1] * reference[0])
    norm = math.sqrt(sum(v * v for v in side))
    side = tuple(v / norm for v in side)
    normal = (axis[1] * side[2] - axis[2] * side[1],
              axis[2] * side[0] - axis[0] * side[2],
              axis[0] * side[1] - axis[1] * side[0])
    point = lambda u, v, h: tuple(base[i] + axis[i] * length * u + side[i] * width * v +
                                 normal[i] * (h - curl * length * u * u) for i in range(3))
    outline = [point(u, v, 0) for u, v in ((0, 0), (.22, -.34), (.52, -.5), (.79, -.30),
                                                   (1, 0), (.79, .30), (.52, .5), (.22, .34))]
    top, bottom = point(.49, 0, width * .13), point(.49, 0, -width * .035)
    for a, b in zip(outline, outline[1:] + outline[:1]):
        mesh.face(material, [top, a, b])
        mesh.face(material, [bottom, b, a])


def _autumn_colour(rng):
    sample = rng.random()
    return 'Leaf' if sample < .73 else 'Wood' if sample < .97 else 'Yellow'


def _shrub(mesh, center, radius, height, seed):
    """Loose woody perennial: forked twigs and separate leaves, never solid lobes."""
    rng = random.Random(seed)
    base = (center[0], center[1], center[2] - height / 2)
    for branch in range(8):
        angle = branch * 2.399963 + rng.uniform(-.28, .28)
        spread = radius * rng.uniform(.45, .92)
        rise = height * rng.uniform(.65, 1)
        bend = (base[0] + math.cos(angle) * spread * .33,
                base[1] + math.sin(angle) * spread * .33, base[2] + rise * .48)
        tip = (base[0] + math.cos(angle) * spread, base[1] + math.sin(angle) * spread, base[2] + rise)
        mesh.rod('Wood', base, bend, .65, 6)
        mesh.rod('Wood', bend, tip, .38, 5)
        for level in range(4):
            fraction = .2 + level * .21
            node = tuple(bend[i] + (tip[i] - bend[i]) * fraction for i in range(3))
            for side in (-1, 1):
                azimuth = angle + side * rng.uniform(.7, 1.7)
                stem = (node[0] + math.cos(azimuth) * 3.7, node[1] + math.sin(azimuth) * 3.7,
                        node[2] + rng.uniform(-.5, 2))
                mesh.rod('Wood', node, stem, .23, 5)
                direction = (math.cos(azimuth), math.sin(azimuth), rng.uniform(-.32, .60))
                _leaf(mesh, stem, direction, rng.uniform(6.5, 10.5), rng.uniform(3.3, 5.4),
                      _autumn_colour(rng), rng.uniform(-.015, .04))


def _grass(mesh, base, radius, height, seed):
    """Curving, tapered individual grass blades with occasional bronze seed stems."""
    rng = random.Random(seed)
    for blade in range(34):
        angle = blade * 2.399963 + rng.uniform(-.4, .4)
        along = (math.cos(angle), math.sin(angle), 0)
        across = (-along[1], along[0], 0)
        origin = (base[0] + along[0] * rng.uniform(0, radius),
                  base[1] + along[1] * rng.uniform(0, radius), base[2])
        rise, spread = height * rng.uniform(.58, 1), radius * rng.uniform(1.1, 2.4)
        breadth = rng.uniform(.7, 1.35)
        rings = []
        for j in range(7):
            f = j / 6
            centre = (origin[0] + along[0] * spread * f * f,
                      origin[1] + along[1] * spread * f * f,
                      origin[2] + rise * (math.sin(f * math.pi / 2) - .09 * f ** 4))
            slope = rise * (math.pi / 2 * math.cos(f * math.pi / 2) - .36 * f ** 3)
            tangent = (along[0] * spread * 2 * f, along[1] * spread * 2 * f, slope)
            normal = (-tangent[2] * across[1], tangent[2] * across[0],
                      tangent[0] * across[1] - tangent[1] * across[0])
            norm = math.sqrt(sum(v * v for v in normal))
            normal = tuple(v / norm for v in normal)
            w = max(.045, breadth * (1 - f) ** .75)
            rings.append([tuple(centre[i] + across[i] * sign * w + normal[i] * thickness for i in range(3))
                          for sign, thickness in ((1, .045), (-1, .045), (-1, -.045), (1, -.045))])
        material = 'Leaf' if blade % 5 < 3 else 'Wood'
        mesh.face(material, rings[0][::-1])
        mesh.face(material, rings[-1])
        for lower, upper in zip(rings, rings[1:]):
            for i in range(4):
                j = (i + 1) % 4
                mesh.face(material, [lower[i], lower[j], upper[j], upper[i]])
    for i in range(5):
        angle = rng.random() * math.tau
        tip = (base[0] + math.cos(angle) * radius * 1.5,
               base[1] + math.sin(angle) * radius * 1.5, base[2] + height * rng.uniform(.83, 1.13))
        bend = ((base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, base[2] + height * .63)
        mesh.rod('Wood', base, bend, .28, 5)
        mesh.rod('Wood', bend, tip, .22, 5)
        for j in range(5):
            p = (tip[0], tip[1], tip[2] - j * 2.3)
            _leaf(mesh, p, (math.cos(angle + j), math.sin(angle + j), .6), 3.5, 1.1, 'Wood')


def _vine(mesh, branch, outward, seed):
    """Palmate compound leaves spread from petioles on the existing rear trellis."""
    rng = random.Random(seed)
    tangent = (-outward[1], outward[0], 0)
    for i, node in enumerate(branch[1:]):
        petiole = tuple(node[k] + outward[k] * rng.uniform(5, 8) + (3 if k == 2 else 0) for k in range(3))
        mesh.rod('Wood', node, petiole, .30, 5)
        turn = rng.uniform(-.4, .4)
        for j in range(5):
            angle = math.radians((j - 2) * 34) + turn
            direction = tuple(tangent[k] * math.sin(angle) + outward[k] * .16 +
                              (math.cos(angle) if k == 2 else 0) for k in range(3))
            _leaf(mesh, petiole, direction, rng.uniform(8, 12.5), rng.uniform(3.7, 5.8),
                  _autumn_colour(rng), .025)


def _planter(mesh, center, yaw, index):
    q = _local(center, yaw)
    for side in (-1, 1):
        for z in (17,34,51):
            mesh.box('Wood_Collision', q(0, side * 42, z), (145, 7, 16), yaw)
            mesh.box('Wood_Collision', q(side * 70, 0, z), (7, 90, 16), yaw)
            for x in (-62,62):
                mesh.rod('Iron', q(x,side*45.5,z), q(x,side*46,z), 1, 8)
        mesh.box('Wood', q(0,side*42,61), (150,10,5), yaw)
    mesh.box('Soil', q(0, 0, 57), (130, 75, 5), yaw)
    for x, y, height in ((-39, -8, 49 + index * 4), (35, -8, 66 - index * 5)):
        _shrub(mesh, q(x, y, 60 + height / 2), 16 + index, height, index * 101 + int(x))
    _grass(mesh, q(0, 13, 60), 9, 76 + index * 5, index + 41)
    rng = random.Random(index + 621)
    for j in range(16):
        angle = j * 2.399963
        _leaf(mesh, q(-5, -21, 60), (math.cos(angle), math.sin(angle), rng.uniform(.25, .65)),
              rng.uniform(16, 23), rng.uniform(7, 11), _autumn_colour(rng), .09)
    for x, y in ((-52, 16), (20, -19), (48, 13)):
        foot, p = q(x, y, 60), q(x + 3, y - 2, 105 + index * 5)
        mesh.rod('Wood', foot, p, .40, 6)
        ring = [(p[0] + 2.6 * math.cos(i * math.tau / 10), p[1] + 2.6 * math.sin(i * math.tau / 10), p[2])
                for i in range(10)]
        for i, a in enumerate(ring):
            b = ring[(i + 1) % len(ring)]
            mesh.face('Soil', [(p[0], p[1], p[2] + 3.5), a, b])
            mesh.face('Soil', [(p[0], p[1], p[2] - 1), b, a])
        if index != 1:
            for j in range(9):
                angle = j * math.tau / 9
                _leaf(mesh, (p[0] + math.cos(angle), p[1] + math.sin(angle), p[2]),
                      (math.cos(angle), math.sin(angle), -.12), 4.2, 1.5, 'White', .035)


def _fallen_leaves(mesh, polygon, z, seed, amount):
    """Small curled blades stay inside soil/tree-pit edges, clear of the route."""
    rng = random.Random(seed)
    low = tuple(min(p[i] for p in polygon) for i in (0, 1))
    high = tuple(max(p[i] for p in polygon) for i in (0, 1))
    placed = 0
    for _ in range(amount * 6):
        if placed == amount:
            break
        p = tuple(rng.uniform(low[i], high[i]) for i in (0, 1))
        if not _inside(p, polygon) or min(_distance(p, a, b) for a, b in zip(polygon, polygon[1:] + polygon[:1])) < 8:
            continue
        if min(_distance(p, a, b) for a, b in zip(WALK_ROUTE, WALK_ROUTE[1:])) < 65:
            continue
        angle = rng.random() * math.tau
        _leaf(mesh, (*p, z), (math.cos(angle), math.sin(angle), rng.uniform(-.025, .025)),
              rng.uniform(4.8, 7), rng.uniform(2.5, 3.9), 'Wood' if placed % 5 else 'Yellow', .018)
        placed += 1
    return placed


def _wheelie_bin(mesh, center, yaw, side, material):
    """A tapered moulded bin with bevelled shoulders, hinged lid and rear wheels."""
    q = _local(center, yaw)
    rings = []
    for z, w, d, bevel in ((8, 19, 22, 3), (20, 20, 23, 3), (77, 24, 29, 4)):
        rings.append([q(x, y, z) for x, y in ((-w + bevel, -d), (w - bevel, -d), (w, -d + bevel),
                      (w, d - bevel), (w - bevel, d), (-w + bevel, d), (-w, d - bevel), (-w, -d + bevel))])
    mesh.face(material, rings[0][::-1])
    mesh.face(material, rings[-1])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(8):
            j = (i + 1) % 8
            mesh.face(material, [lower[i], lower[j], upper[j], upper[i]])
    mesh.box(material, q(0, 0, 81), (55, 66, 7), yaw)
    mesh.rod('Iron', q(-25, side * 28, 83), q(25, side * 28, 83), 2, 10)
    for x in (-22, 22):
        mesh.rod('Rubber', q(x - 3.5, side * 24, 17), q(x + 3.5, side * 24, 17), 9, 16)
        mesh.rod('Iron', q(x - 3.8, side * 24, 17), q(x + 3.8, side * 24, 17), 3.3, 12)
    for x in (-17, 17):
        mesh.rod(material, q(x, side * 30, 73), q(x, side * 35, 86), 2.1, 8)
    mesh.rod('Iron', q(-17, side * 35, 86), q(17, side * 35, 86), 2, 10)
    for x in (-13, 13):
        mesh.rod(material, q(x, -side * 24.7, 25), q(x, -side * 29.7, 67), 1.2, 6)
    if material == 'CarBlue':
        for i in range(3):
            angle = i * math.tau / 3 + .4
            ring = [(8 * math.cos(angle + f), 49 + 8 * math.sin(angle + f)) for f in (0, .30, .60)]
            tail, middle, tip = ring
            mesh.rod('White', q(tail[0], -side * 29.8, tail[1]), q(middle[0], -side * 29.9, middle[1]), .75, 5)
            arrow = [q(tip[0], -side * 30, tip[1]), q(middle[0] - 2, -side * 30, middle[1] - 2),
                     q(middle[0] + 2, -side * 30, middle[1] + 2)]
            mesh.face('White', arrow if side > 0 else arrow[::-1])
    elif material == 'Wood':
        emblem = [(-3, 42), (-8, 46), (-10, 51), (-8, 55), (-2, 56), (3, 52), (4, 47)]
        if _area(emblem) < 0:
            emblem.reverse()
        face = [q(x, -side * 30, z) for x, z in emblem]
        mesh.face('White', face if side > 0 else face[::-1])
    else:
        mesh.box('White', q(0, -side * 30, 67), (12, .3, 3), yaw)


def _bin_set(mesh, center, yaw, side):
    q = _local(center, yaw)
    for x, material in ((-58, 'CarBlue'), (0, 'Wood'), (58, 'Iron')):
        _wheelie_bin(mesh, q(x, 0, 0), yaw, side, material)


def _hanging_shirt(mesh, q, x, top, phase, material):
    outline = [(-10, 0), (10, 0), (15, -5), (31, -17), (22, -28), (15, -23),
               (15, -52), (-15, -52), (-15, -23), (-22, -28), (-31, -17), (-15, -5)]
    triangles = triangulate([outline], (-31, -52, 31, 0))
    # Split shared scanline edges at every existing vertex before thickening;
    # otherwise the sleeve/body junction would contain a nonmanifold T-junction.
    vertices = set(p for triangle in triangles for p in triangle)
    conforming = []
    for triangle in triangles:
        centre = tuple(sum(p[i] for p in triangle) / 3 for i in (0, 1))
        for a, b in zip(triangle, triangle[1:] + triangle[:1]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            edge = sorted((p for p in vertices if abs(dx * (p[1]-a[1]) - dy * (p[0]-a[0])) < 1e-7
                           and -1e-7 <= (p[0]-a[0])*dx + (p[1]-a[1])*dy <= dx*dx+dy*dy+1e-7),
                          key=lambda p: (p[0]-a[0])*dx + (p[1]-a[1])*dy)
            conforming.extend([centre, c, d] for c, d in zip(edge, edge[1:]))
    triangles = conforming
    point = lambda p, thickness: q(x + p[0], math.sin(p[0] * .2 + p[1] * .03 + phase) *
                                   (1 + abs(p[1]) / 25) + thickness, top + p[1])
    edges = {}
    for triangle in triangles:
        mesh.face(material, [point(p, -.06) for p in triangle])
        mesh.face(material, [point(p, .06) for p in triangle[::-1]])
        for a, b in zip(triangle, triangle[1:] + triangle[:1]):
            key = tuple(sorted((a, b)))
            count, _ = edges.get(key, (0, None))
            edges[key] = (count + 1, (a, b))
    for count, (a, b) in edges.values():
        if count == 1:
            mesh.face(material, [point(a, -.06), point(a, .06), point(b, .06), point(b, -.06)])


def _clothesline(mesh, center, yaw, seed):
    """A short residential drying line entirely within a clear rear setback."""
    q, rng = _local(center, yaw), random.Random(seed)
    for x in (-160, 160):
        mesh.rod('Wood', q(x, 0, 8), q(x, 0, 258), 3.7, 12)
        mesh.rod('Iron', q(x, -5, 247), q(x, 5, 247), 1.2, 8)
    nodes = [q(-160 + i * 40, 0, 245 - 7 * math.sin(i * math.pi / 8)) for i in range(9)]
    for a, b in zip(nodes, nodes[1:]):
        mesh.rod('Iron', a, b, .28, 6)
    for garment, x in enumerate((-112, -37, 40, 112)):
        width, height = (48, 75) if garment % 2 == 0 else (49, 54)
        top = 245 - 7 * math.cos(x * math.pi / 320)
        material = 'Trim' if garment != 2 else 'SignBlue'
        phase = rng.random() * math.tau
        if garment == 1:
            _hanging_shirt(mesh, q, x, top, phase, material)
            for dx in (-8, 8):
                mesh.box('Wood', q(x + dx, 0, top + 1), (2.2, 3, 5), yaw)
            continue
        front, back = [], []
        for row in range(5):
            for col in range(6):
                u, v = col / 5, row / 4
                # Mild folds and a scalloped hem; towels retain a recognisable scale.
                xx = x + (u - .5) * width
                yy = math.sin(u * math.tau * 1.7 + phase) * (1 + v * 2.5)
                zz = top - height * v - math.sin(u * math.pi) * v * 2
                front.append(q(xx, yy - .06, zz))
                back.append(q(xx, yy + .06, zz))
        for row in range(4):
            for col in range(5):
                i = row * 6 + col
                face = (i, i + 1, i + 7, i + 6)
                mesh.face(material, [front[j] for j in face[::-1]])
                mesh.face(material, [back[j] for j in face])
        perimeter = list(range(6)) + list(range(11, 30, 6)) + list(range(28, 23, -1)) + list(range(18, 0, -6))
        for a, b in zip(perimeter, perimeter[1:] + perimeter[:1]):
            mesh.face(material, [front[b], back[b], back[a], front[a]])
        for dx in (-width * .34, width * .34):
            mesh.box('Wood', q(x + dx, 0, top + 1), (2.2, 3, 5), yaw)


def build_streets(mesh, buildings, roads, focus):
    """Build a connected, accessible street vignette without changing traffic paths."""
    assert len(focus) >= 2 and all(len(p) >= 2 for p in focus)
    focus = [tuple(p[:2]) for p in focus]
    near = lambda p, radius=6200: min(_distance(p, a, b) for a, b in zip(focus, focus[1:])) < radius
    road_kinds = {'residential', 'tertiary', 'secondary', 'primary', 'service', 'unclassified', 'living_street'}
    local_roads = [r for r in roads if len(r['points']) > 1 and
                   any(near(p, 9500) for p in r['points'])]
    segments = [(r, tuple(a[:2]), tuple(b[:2])) for r in local_roads
                for a, b in zip(r['points'], r['points'][1:]) if math.dist(a[:2], b[:2]) > 1]
    drive = [(r, a, b) for r, a, b in segments if r.get('tags', {}).get('highway') in road_kinds]
    footprints = []
    for building in buildings:
        points = [tuple(p[:2]) for p in building['points']]
        if not points or not any(near(p, 12000) for p in points):
            continue
        footprints.append((min(p[0] for p in points), max(p[0] for p in points),
                           min(p[1] for p in points), max(p[1] for p in points), points))

    def occupied(p, margin=0):
        return any(x0 - margin <= p[0] <= x1 + margin and y0 - margin <= p[1] <= y1 + margin
                   and (_inside(p, points) or margin > 0 and
                        min(_distance(p, a, b) for a, b in zip(points, points[1:] + points[:1])) < margin)
                   for x0, x1, y0, y1, points in footprints)

    def road_distance(p):
        return min(((_distance(p, a, b), r, a, b) for r, a, b in drive), key=lambda item: item[0])

    def clear_setback(center, yaw, width, depth):
        q = _local(center, yaw)
        # A 20 cm grid plus 16 cm margin conservatively covers the entire object.
        columns, rows = math.ceil(width / 20), math.ceil(depth / 20)
        for i in range(columns + 1):
            for j in range(rows + 1):
                point = q(width * (i / columns - .5), depth * (j / rows - .5), 0)
                if occupied(point, 16) or min(_distance(point, a, b) for a, b in zip(WALK_ROUTE, WALK_ROUTE[1:])) < 68:
                    return False
                if any(_distance(point, a, b) < road['width'] / 2 + 16 for road, a, b in drive):
                    return False
        return True

    signs, detailed_trees, counts = [], [], dict(sidewalk_metres=0, curb_ramps=0, crossings=0, parked_cars=0,
                            bicycles=0, benches=0, bins=0, tree_pits=0, planters=0,
                            street_signs=0, stop_signs=0, bollards=0, ruelles=0, bike_markings=0,
                            road_fill_square_metres=0, garden_square_metres=0, climbing_vines=0,
                            residential_bin_sets=0, clotheslines=0, fallen_leaves=0)
    microdetails, planter_sites = [], []
    sidewalk_samples, crosswalk_faces = [], []
    crossing_ends = [tuple(p[:2]) for r in local_roads if r.get('tags', {}).get('footway') == 'crossing'
                     for p in (r['points'][0], r['points'][-1]) if near(p)]
    for r, a, b in segments:
        t = r.get('tags', {})
        if t.get('highway') not in ('footway', 'path', 'pedestrian', 'cycleway'):
            continue
        length, ux, uy, nx, ny, yaw = _frame(a, b)
        if t.get('footway') == 'crossing':
            if not near(a) and not near(b):
                continue
            # Mark only crossings surveyed as zebra or signal-controlled.
            if t.get('crossing:markings') == 'zebra' or t.get('crossing') == 'traffic_signals':
                for d in range(10, int(length) - 20, 90):
                    p = (a[0] + ux * d, a[1] + uy * d)
                    q = (a[0] + ux * min(length, d + 42), a[1] + uy * min(length, d + 42))
                    _slab(mesh, 'White', p, q, 230, 9)
                    crosswalk_faces.append(mesh.groups['White'][-1])
                counts['crossings'] += 1
            continue
        concrete = t.get('footway') == 'sidewalk' or t.get('surface') in ('concrete', 'concrete:plates', 'paving_stones')
        if not concrete:
            # Keep the surveyed park paths; add furniture alongside them below.
            if t.get('highway') == 'cycleway':
                for d in range(180, int(length) - 180, 700):
                    p = (a[0] + ux * d, a[1] + uy * d)
                    if near(p):
                        _slab(mesh, 'Yellow', p, (p[0] + ux * 180, p[1] + uy * 180), 7, 8)
                        counts['bike_markings'] += 1
            for d in range(900, int(length) - 500, 2800):
                p = (a[0] + ux * d + nx * 190, a[1] + uy * d + ny * 190)
                if near(p, 3500) and not occupied(p, 120) and road_distance(p)[0] > 800:
                    _bench(mesh, p, yaw)
                    counts['benches'] += 1
            continue
        width = 210 if t.get('footway') == 'sidewalk' else 185
        pieces = max(1, math.ceil(length / 200))
        for i in range(pieces):
            da, db = length * i / pieces, length * (i + 1) / pieces
            p, q = (a[0] + ux * da, a[1] + uy * da), (a[0] + ux * db, a[1] + uy * db)
            middle = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
            if not near(middle):
                continue
            distance, road, ra, rb = road_distance(middle)
            if distance < road['width'] / 2 + width / 2 - 8:
                continue
            if occupied(middle):
                continue
            # The last 1.6 m drops to road level at surveyed crossing endpoints.
            z = lambda v: 7 + 11 * min(1, min((math.dist(v, end) for end in crossing_ends), default=160) / 160)
            za, zb = z(p), z(q)
            _slab(mesh, 'Concrete_Collision', p, q, width, za, zb)
            counts['sidewalk_metres'] += (db - da) / 100
            if min(za, zb) < 17 and max(za, zb) >= 17:
                counts['curb_ramps'] += 1
            if i % 2 == 0:
                _slab(mesh, 'ConcreteDark', (p[0] - nx * width / 2, p[1] - ny * width / 2),
                      (p[0] + nx * width / 2, p[1] + ny * width / 2), 1.4, za + .5)
            if t.get('footway') == 'sidewalk':
                side = 1 if _distance((middle[0] + nx * 20, middle[1] + ny * 20), ra, rb) < distance else -1
                _, rux, ruy, rnx, rny, _ = _frame(ra, rb)
                # Lane counts omit parking/gutters; surveyed sidewalk edges set the actual paved extent.
                if length >= 200 and r.get('name') and r.get('name') == road.get('name') and abs(ux * rux + uy * ruy) > .96:
                    curb = [(v[0] + nx * side * width / 2, v[1] + ny * side * width / 2) for v in (p, q)]
                    road_side = 1 if (middle[0] - ra[0]) * rnx + (middle[1] - ra[1]) * rny > 0 else -1
                    edge = []
                    for v in curb:
                        along = max(0, min(math.dist(ra, rb), (v[0] - ra[0]) * rux + (v[1] - ra[1]) * ruy))
                        edge.append((ra[0] + rux * along + rnx * road_side * (road['width'] / 2 - 2),
                                     ra[1] + ruy * along + rny * road_side * (road['width'] / 2 - 2)))
                    if all(_distance(v, ra, rb) > road['width'] / 2 for v in curb):
                        fill = [curb[0], curb[1], edge[1], edge[0]]
                        area = sum(v[0] * w[1] - w[0] * v[1] for v, w in zip(fill, fill[1:] + fill[:1]))
                        if area < 0:
                            fill.reverse()
                        mesh.face('Asphalt', [(*v, 7) for v in fill])
                        counts['road_fill_square_metres'] += abs(area) / 20000
                if distance >= road['width'] / 2 + 450:
                    continue
                pa = (p[0] + nx * side * (width / 2 - 7), p[1] + ny * side * (width / 2 - 7))
                pb = (q[0] + nx * side * (width / 2 - 7), q[1] + ny * side * (width / 2 - 7))
                _slab(mesh, 'Limestone_Collision', pa, pb, 14, za + 1, zb + 1)
                if i % 9 == 4 and min(za, zb) > 17 and near(middle, 3800):
                    sidewalk_samples.append((middle, yaw, -side, nx, ny, road))

    # Keep each painted stripe flat, 1 mm above its highest underlying mapped
    # Path (z5), Road (z6), or gutter fill (z7), rather than floating at z9.
    junction_fills = _junction_fills(mesh, local_roads, drive, near)
    counts['road_fill_square_metres'] += sum(item['square_metres'] for item in junction_fills)
    road_surfaces = [_road_rectangle(a, b, road['width']) for road, a, b in drive]
    fills = [[p[:2] for p in face] for face in mesh.groups.get('Asphalt', [])]
    for face in crosswalk_faces:
        samples = face + [tuple(sum(p[i] for p in face) / len(face) for i in (0, 1))]
        height = .1 + max(7 if any(_inside(p, fill) for fill in fills)
                          else 6 if any(_inside(p, road) for road in road_surfaces) else 5 for p in samples)
        face[:] = [(p[0], p[1], height) for p in face]

    # Furnish the outer sidewalk edge; retain at least 1.5 m of walking clearance.
    for index, (middle, yaw, outer, nx, ny, road) in enumerate(sidewalk_samples):
        p = (middle[0] + nx * outer * 110, middle[1] + ny * outer * 110)
        if occupied(p, 95) or any(math.dist(p, end) < 350 for end in crossing_ends):
            continue
        if index % 3 == 0:
            mesh.box('Soil', (*p, 19), (86, 86, 3), yaw)
            q = _local(p, yaw)
            pit = [q(x, y, 0)[:2] for x, y in ((-43, -43), (43, -43), (43, 43), (-43, 43))]
            counts['fallen_leaves'] += _fallen_leaves(mesh, pit, 20.58, index + 513, 12)
            for side in (-1, 1):
                mesh.box('Iron', q(side * 47, 0, 21), (5, 96, 5), yaw)
                mesh.box('Iron', q(0, side * 47, 21), (96, 5, 5), yaw)
            detailed_trees.append(list(p))
            counts['tree_pits'] += 1
        elif index % 3 == 1:
            mesh.cylinder('Iron_Collision', (*p, 58.5), 24, 79, 10)
            mesh.cylinder('ConcreteDark', (*p, 99), 28, 5, 10)
            mesh.box('Iron', (*p, 96), (30, 20, 4), yaw)
            counts['bins'] += 1
        else:
            q = _local(p, yaw)
            for x in (-35, 35):
                mesh.rod('Iron', q(x, 0, 19), q(x, 0, 95), 3.5, 6)
            mesh.rod('Iron', q(-35, 0, 95), q(35, 0, 95), 3.5, 6)
            _bicycle(mesh, (p[0] + nx * outer * 18, p[1] + ny * outer * 18), yaw)
            counts['bicycles'] += 1

    for r, a, b in drive:
        t = r.get('tags', {})
        if t.get('highway') not in ('residential', 'living_street') or r['width'] < 600 or t.get('busway'):
            continue
        if t.get('name') not in ('Rue Panet', 'Rue de la Visitation', 'Rue Plessis'):
            continue
        length, ux, uy, nx, ny, yaw = _frame(a, b)
        for d in range(700, int(length) - 650, 1250):
            center = (a[0] + ux * d, a[1] + uy * d)
            if not near(center, 4200):
                continue
            for side in (-1, 1):
                if t.get('parking:' + ('left' if side == 1 else 'right')) == 'no':
                    continue
                if t.get('cycleway:' + ('left' if side == 1 else 'right')) in ('lane', 'track'):
                    continue
                p = (center[0] + nx * side * (r['width'] / 2 - 98),
                     center[1] + ny * side * (r['width'] / 2 - 98))
                if any(other.get('id') != r.get('id') and other.get('name') != r.get('name') and
                       _distance(p, c, e) < other['width'] / 2 + 500 for other, c, e in drive):
                    continue
                if occupied(p, 110):
                    continue
                _car(mesh, p, yaw if t.get('oneway') == 'yes' or side < 0 else yaw + 180, counts['parked_cars'])
                counts['parked_cars'] += 1

    entrance = (37460.429386, -1946.9868)
    if near(entrance):
        q = _local(entrance, -32.5)
        for side in (-1, 1):
            p = q(0, side * 150, 0)
            if not occupied(p, 20):
                mesh.cylinder('Iron_Collision', (*p[:2], 63), 7, 90, 8)
                mesh.cylinder('White', (*p[:2], 96), 7.6, 6, 8)
                counts['bollards'] += 1

    # OSM way 347132484 runs behind the Panet / Visitation frontages.
    alley = next((r for r in local_roads if str(r.get('id')) == '347132484'), None)
    if alley is None:
        alley = next((r for r in local_roads if r.get('tags', {}).get('service') == 'alley'
                      and any(near(p, 2500) for p in r['points'])), None)
    if alley:
        counts['ruelles'] = 1
        for a, b in zip(alley['points'], alley['points'][1:]):
            if math.dist(a[:2], b[:2]) < 1:
                continue
            length, ux, uy, nx, ny, yaw = _frame(a, b)
            # The centre 3.8 m remains open; planting and fences sit outside it.
            pieces = max(1, math.ceil(length/180))
            for i in range(pieces):
                pa = (a[0]+ux*length*i/pieces,a[1]+uy*length*i/pieces)
                pb = (a[0]+ux*length*(i+1)/pieces,a[1]+uy*length*(i+1)/pieces)
                midpoint = ((pa[0]+pb[0])/2,(pa[1]+pb[1])/2)
                if not near(midpoint,4600):
                    continue
                for side in (-1,1):
                    inner = [(v[0]+nx*side*(alley['width']/2+3),v[1]+ny*side*(alley['width']/2+3)) for v in (pa,pb)]
                    for bed_width in (120,100,80,60,40,20):
                        outer = [(v[0]+nx*side*bed_width,v[1]+ny*side*bed_width) for v in inner]
                        corners = inner+outer
                        samples = corners+[((p[0]+q[0])/2,(p[1]+q[1])/2) for p,q in zip(corners,corners[1:]+corners[:1])]
                        along,across=max(1,math.ceil(math.dist(pa,pb)/20)),max(1,math.ceil(bed_width/20))
                        samples += [(inner[0][0]+(inner[1][0]-inner[0][0])*j/along+nx*side*bed_width*k/across,
                                     inner[0][1]+(inner[1][1]-inner[0][1])*j/along+ny*side*bed_width*k/across)
                                    for j in range(along+1) for k in range(across+1)]
                        if any(occupied(p,12) or any(other['id']!=alley['id'] and
                               _distance(p,c,d)<other['width']/2+20 for other,c,d in drive) for p in samples):
                            continue
                        polygon = [inner[0],inner[1],outer[1],outer[0]]
                        if side<0:
                            polygon.reverse()
                        mesh.face('Gravel',[(*p,8) for p in polygon])
                        counts['garden_square_metres'] += math.dist(pa,pb)*bed_width/10000
                        if i % 7 == 3 and bed_width >= 60:
                            counts['fallen_leaves'] += _fallen_leaves(mesh, polygon, 8.08,
                                                                     i + int(abs(a[1])) + side * 17, 7)
                        break
            for d in range(480, int(length) - 350, 1250):
                p = (a[0] + ux * d, a[1] + uy * d)
                if not near(p, 4600):
                    continue
                side = 1 if counts['planters'] % 2 == 0 else -1
                plant = (p[0] + nx * side * (alley['width'] / 2 + 55),
                         p[1] + ny * side * (alley['width'] / 2 + 55))
                if occupied(plant, 85):
                    continue
                _planter(mesh, plant, yaw, counts['planters'])
                planter_sites.append({'center': plant, 'yaw': yaw, 'side': side})
                counts['planters'] += 1
                # Open fence segments preserve rear accesses between gardens.
                q = _local(plant, yaw)
                for x in (-230, 230):
                    mesh.rod('Wood_Collision', q(x, side * 80, 0), q(x, side * 80, 154), 4.5, 6)
                for z in (53, 118):
                    mesh.rod('Wood', q(-230, side * 80, z), q(230, side * 80, z), 4, 6)
                for x in range(-210, 211, 25):
                    mesh.box('Wood', q(x, side * 80, 83), (10, 3, 130), yaw)
                for x in (-170, -90, 90, 170):
                    branch = [q(x+math.sin(z*.08+x)*12,side*72, z) for z in (25,55,85,115,145)]
                    for start,end in zip(branch,branch[1:]):
                        mesh.rod('Wood',start,end,1.5,6)
                    _vine(mesh, branch, (nx * side, ny * side, 0), counts['climbing_vines'] + 37)
                    counts['climbing_vines'] += 1
                for i in range(24):
                    theta_a,theta_b=i*math.tau/24,(i+1)*math.tau/24
                    mesh.rod('Rubber',q(-165+25*math.cos(theta_a),side*75,76+25*math.sin(theta_a)),
                             q(-165+25*math.cos(theta_b),side*75,76+25*math.sin(theta_b)),1.7,6)
                mesh.rod('Rubber',q(-140,side*75,76),q(-125,side*73,35),1.7,6)
                mesh.rod('Chrome',q(-125,side*73,35),q(-122,side*73,29),2.3,8)
                pot = q(110,side*28,20)
                if not occupied(pot,25):
                    mesh.cylinder('BrickBrown', pot, 15, 24, 16)
                    mesh.cylinder('Soil', (pot[0],pot[1],33), 13, 2, 16)
                    _shrub(mesh,(pot[0],pot[1],60),21,49,counts['planters']+13)
        # Rear-yard details occupy only sampled clear setbacks beyond the service
        # corridor, between the existing garden fences rather than across access.
        for site in planter_sites:
            q = _local(site['center'], site['yaw'])
            for kind, offset, width, depth in (('bin_set', (370, 0), 184, 74),
                                                ('clothesline', (-430, site['side'] * 80), 330, 22),
                                                ('clothesline', (430, site['side'] * 80), 330, 22)):
                key = 'residential_bin_sets' if kind == 'bin_set' else 'clotheslines'
                if counts[key]:
                    continue
                point = q(*offset, 0)
                if not clear_setback(point, site['yaw'], width, depth):
                    continue
                if kind == 'bin_set':
                    _bin_set(mesh, point, site['yaw'], site['side'])
                else:
                    _clothesline(mesh, point, site['yaw'], 317)
                corners = _local(point, site['yaw'])
                microdetails.append({'kind': kind, 'position': list(point), 'yaw': site['yaw'],
                                     'source_way_id': str(alley['id']), 'collision': False,
                                     'footprint': [list(corners(x, y, 0)[:2]) for x, y in
                                                   ((-width/2, -depth/2), (width/2, -depth/2),
                                                    (width/2, depth/2), (-width/2, depth/2))]})
                counts[key] += 1
        a, b = alley['points'][:2]
        _, ux, uy, nx, ny, yaw = _frame(a, b)
        p = (a[0] + ux * 600 + nx * (alley['width'] / 2 + 70),
             a[1] + uy * 600 + ny * (alley['width'] / 2 + 70))
        if not occupied(p, 90):
            _bench(mesh, p, yaw)
            counts['benches'] += 1
            marker = (p[0] + nx * 85, p[1] + ny * 85)
            q = _local(marker, yaw + 90)
            mesh.cylinder('Iron_Collision', (*marker, 118), 3.5, 220, 8)
            mesh.box('SignGreen', q(0, 0, 211), (4, 150, 26), yaw + 90)
            for side in (-1, 1):
                signs.append({'text': 'RUELLE VERTE', 'position': list(q(side * 3, 0, 211)),
                              'yaw': yaw + 90 + (180 if side < 0 else 0), 'size': 11})

    # Surveyed street-name corners and the minor-road stop on Visitation.
    for text, point, yaw in [('RUE PANET', (39425, -4490), 57),
                             ('RUE SHERBROOKE EST', (39425, -4490), -12),
                             ('RUE DE LA VISITATION', (37530, -13115), 57)]:
        if not near(point) or occupied(point):
            continue
        q = _local(point, yaw)
        mesh.cylinder('Iron_Collision', (*point, 169), 3.7, 302, 8)
        mesh.box('White', q(0, 0, 286), (4, 160, 28), yaw)
        for side in (-1, 1):
            mesh.box('SignGreen', q(side * 2.7, 0, 286), (1, 154, 23), yaw)
            signs.append({'text': text, 'position': list(q(side * 4, 0, 286)),
                          'yaw': yaw + (180 if side < 0 else 0), 'size': 10})
        counts['street_signs'] += 1
    visitation = next((r for r in local_roads if r.get('name') == 'Rue de la Visitation'), None)
    if visitation:
        # OSM stop node 10815231823, forward direction toward Sherbrooke.
        stop = (37787.989769, -14002.9428)
        heading = 146.6
        q = _local(stop, heading)
        point = q(0, -visitation['width'] / 2 - 42, 0)
        if near(point) and not occupied(point, 40):
            mesh.cylinder('Iron_Collision', (*point[:2], 156), 3.7, 276, 8)
            front = _local(point, heading + 180)
            for mat, x, radius in [('White', 0, 34), ('SignRed', 2, 31)]:
                mesh.face(mat, [front(x, radius * math.cos(math.pi / 8 + i * math.tau / 8),
                                      265 + radius * math.sin(math.pi / 8 + i * math.tau / 8)) for i in range(8)])
            signs.append({'text': 'ARRÊT', 'position': list(front(3, 0, 265)), 'yaw': heading + 180, 'size': 14})
            counts['stop_signs'] += 1
    counts['sidewalk_metres'] = round(counts['sidewalk_metres'])
    counts['road_fill_square_metres'] = round(counts['road_fill_square_metres'])
    counts['garden_square_metres'] = round(counts['garden_square_metres'])
    return {'signs': signs, 'counts': counts, 'detailed_trees': detailed_trees, 'junction_fills': junction_fills,
            'microdetails': microdetails, 'route': [list(p) for p in WALK_ROUTE],
            'cameras': [{'name': 'PanetStreet', 'position': [40900, -5600, 180], 'target': [43300, -7250, 380]},
                        {'name': 'PlantedRuelle', 'position': [41700, -11250, 180], 'target': [42150, -10330, 110]}]}
