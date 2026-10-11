"""Street-facing Plateau details on the surveyed OSM footprints, in centimetres."""
import math


class _BoundsMesh:
    """Track the actual authored extent without changing the shared mesh primitives."""
    def __init__(self, mesh):
        self.mesh = mesh
        self.minimum = [math.inf] * 3
        self.maximum = [-math.inf] * 3

    def _include(self, points):
        for point in points:
            for axis in range(3):
                self.minimum[axis] = min(self.minimum[axis], point[axis])
                self.maximum[axis] = max(self.maximum[axis], point[axis])

    def face(self, material, points):
        self._include(points)
        self.mesh.face(material, points)

    def box(self, material, centre, size, yaw=0):
        c, s = abs(math.cos(math.radians(yaw))), abs(math.sin(math.radians(yaw)))
        extent = ((size[0] * c + size[1] * s) / 2,
                  (size[0] * s + size[1] * c) / 2, size[2] / 2)
        self._include([tuple(centre[i] + side * extent[i] for i in range(3)) for side in (-1, 1)])
        self.mesh.box(material, centre, size, yaw)

    def rod(self, material, start, end, radius, sides=8):
        self._include([tuple(point[i] + side * radius for i in range(3))
                       for point in (start, end) for side in (-1, 1)])
        self.mesh.rod(material, start, end, radius, sides)

    def cylinder(self, material, centre, radius, height, sides=12):
        extent = (radius, radius, height / 2)
        self._include([tuple(centre[i] + side * extent[i] for i in range(3)) for side in (-1, 1)])
        self.mesh.cylinder(material, centre, radius, height, sides)

    def bounds(self):
        return [[round(v, 3) for v in values] for values in (self.minimum, self.maximum)]


def _wall_rectangles(width, height, apertures):
    """Fill a wall around rectangular openings, using a small number of whole faces."""
    clipped = [(max(0, left), min(width, right), max(0, bottom), min(height, top))
               for left, right, bottom, top in apertures]
    clipped = [rect for rect in clipped if rect[1] > rect[0] and rect[3] > rect[2]]
    heights = sorted({0, height} | {z for rect in clipped for z in rect[2:]})
    for bottom, top in zip(heights, heights[1:]):
        intervals = sorted((left, right) for left, right, low, high in clipped
                           if low < top and high > bottom)
        cursor = 0
        for left, right in intervals:
            if left > cursor:
                yield cursor, left, bottom, top
            cursor = max(cursor, right)
        if cursor < width:
            yield cursor, width, bottom, top


def _nearest(point, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    if length2 < 1:
        return math.dist(point, a), a
    t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2))
    q = (a[0] + t * dx, a[1] + t * dy)
    return math.dist(point, q), q


def _route_distance(point, route):
    if len(route) == 1:
        return math.dist(point, route[0])
    return min(_nearest(point, a, b)[0] for a, b in zip(route, route[1:]))


def _inside(point, points):
    inside = False
    for a, b in zip(points, points[1:] + points[:1]):
        if (a[1] > point[1]) != (b[1] > point[1]):
            x = a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if point[0] < x:
                inside = not inside
    return inside


def _outward_clearance(point, normal, neighbours):
    clearance = 2000.
    for points in neighbours:
        for a, b in zip(points, points[1:] + points[:1]):
            edge = (b[0] - a[0], b[1] - a[1])
            offset = (a[0] - point[0], a[1] - point[1])
            cross = normal[0] * edge[1] - normal[1] * edge[0]
            if abs(cross) < 1e-6:
                continue
            distance = (offset[0] * edge[1] - offset[1] * edge[0]) / cross
            along = (offset[0] * normal[1] - offset[1] * normal[0]) / cross
            if 1 < distance < clearance and 0 <= along <= 1:
                clearance = distance
    return clearance


def _candidates(buildings, roads, focus):
    segments = []
    for road in roads:
        tags = road.get('tags', {})
        if tags.get('highway') in ('footway', 'path', 'cycleway', 'steps', 'pedestrian', 'crossing'):
            continue
        for a, b in zip(road['points'], road['points'][1:]):
            length = math.dist(a, b)
            if length > 1:
                segments.append((a, b, road, ((b[0] - a[0]) / length, (b[1] - a[1]) / length)))
    local = []
    edge_counts = {}
    for building in buildings:
        points = [tuple(p[:2]) for p in building['points']]
        if points and points[0] == points[-1]:
            points.pop()
        if len(points) < 3 or min(_route_distance(p, focus) for p in points) > 16000:
            continue
        if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1])) < 0:
            points.reverse()
        local.append((building, points))
        for a, b in zip(points, points[1:] + points[:1]):
            key = tuple(sorted((a, b)))
            edge_counts[key] = edge_counts.get(key, 0) + 1
    candidates = []
    for building, points in local:
        height = building['height']
        tags = building.get('tags', {})
        if not 250 <= height <= 2400 or min(_route_distance(p, focus) for p in points) > 12000:
            continue
        neighbours = [other_points for other, other_points in local if other['id'] != building['id']]
        options = []
        for a, b in zip(points, points[1:] + points[:1]):
            width = math.dist(a, b)
            if width < 35 or edge_counts[tuple(sorted((a, b)))] > 1:
                continue
            u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
            normal = (u[1], -u[0])
            midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            distance = _route_distance(midpoint, focus)
            samples = [(a[0] + (b[0] - a[0]) * t + normal[0] * 25,
                        a[1] + (b[1] - a[1]) * t + normal[1] * 25) for t in (.25, .5, .75)]
            hidden = sum(any(_inside(sample, neighbour) for neighbour in neighbours) for sample in samples)
            if hidden >= 2:
                continue
            adjacent = []
            for c, d, road, direction in segments:
                road_distance, q = _nearest(midpoint, c, d)
                facing = (q[0] - midpoint[0]) * normal[0] + (q[1] - midpoint[1]) * normal[1]
                parallel = abs(u[0] * direction[0] + u[1] * direction[1])
                if facing > road_distance * .75 and parallel > .8 and road_distance < 3200:
                    adjacent.append((road_distance, road))
            clearance = _outward_clearance(midpoint, normal, [points] + neighbours)
            if adjacent:
                road_distance, road = min(adjacent, key=lambda item: item[0])
                kind = 'rear' if road.get('tags', {}).get('highway') == 'service' else 'front'
                setback = max(0, min(clearance - 40, road_distance - road['width'] / 2 - 230))
                gallery_depth = min(clearance - 50, road_distance - 50, 145)
            else:
                road, kind = {}, 'side'
                setback, gallery_depth = max(0, clearance - 60), min(145, clearance - 60)
            options.append({'id': str(building['id']), 'a': list(a), 'b': list(b), 'width': width,
                            'height': height, 'normal': list(normal), 'setback': setback,
                            'street': road.get('name', ''), 'distance': distance,
                            'kind': kind, 'gallery_depth': gallery_depth, 'tags': tags})
        if options:
            eligible = [option for option in options if option['kind'] == 'front' and option['width'] >= 460]
            primary = min(eligible or options, key=lambda item: item['distance'] + max(0, 650 - item['width']) * 2)
            primary['alternates'] = [option for option in options if option is not primary]
            candidates.append(primary)
    return sorted(candidates, key=lambda item: (item['distance'], item['id']))


def build_facades(mesh, buildings, roads, focus):
    """Return authored fronts and French sign placements for the shared scene importer."""
    assert focus and all(len(p) >= 2 for p in focus), 'A walking route is required'
    return _author_facades(mesh, _candidates(buildings, roads, focus))


def _author_facades(mesh, fronts, storefronts=True):
    """Share the established facade geometry with the decorative park perimeter."""
    signs = []
    counts = {'fronts': len(fronts), 'windows': 0, 'balconies': 0, 'exterior_stairs': 0,
              'raised_entrances': 0, 'storefronts': 0, 'corner_returns': 0, 'cafe_tables': 0,
              'bay_windows': 0, 'rear_galleries': 0, 'treated_surfaces': 0, 'rear_surfaces': 0,
              'side_surfaces': 0, 'parapets': 0, 'rear_doors': 0, 'garage_doors': 0, 'chimneys': 0,
              'recessed_windows': 0, 'curtained_windows': 0, 'blind_windows': 0,
              'warm_windows': 0, 'domestic_balcony_details': 0}
    commercial = [f for f in fronts if storefronts and f['kind'] == 'front' and any(name in f['street'] for name in ('Sherbrooke', 'Gauthier', 'Marquette', 'Panet', 'Visitation')) and 650 <= f['width'] <= 1800 and f['setback'] >= 330]
    corner = (38405, -3924)
    hero = min(commercial, key=lambda f: math.dist(((f['a'][0] + f['b'][0]) / 2, (f['a'][1] + f['b'][1]) / 2), corner)) if commercial else None
    shops = [hero] if hero else []
    cafe = [front for front in commercial if 'Visitation' in front['street'] and front['distance'] < 4500
            and all(math.dist(front['a'], shop['a']) > 8000 for shop in shops)]
    if cafe:
        shops.append(min(cafe, key=lambda front: front['distance']))
    returns = []
    for front in fronts:
        for alternate in front.pop('alternates'):
            returns.append((alternate['distance'], front, alternate))
    counts['corner_returns'] = len(returns)
    for _, owner, surface in returns:
        surface['return'] = True
        owner.setdefault('corner_returns', []).append(surface)
    target_mesh = mesh
    for front in fronts + [surface for _, _, surface in returns]:
        mesh = _BoundsMesh(target_mesh)
        a, b, width, height = front['a'], front['b'], front['width'], front['height']
        u = ((b[0] - a[0]) / width, (b[1] - a[1]) / width)
        normal = front['normal']
        yaw = math.degrees(math.atan2(u[1], u[0]))
        seed = sum((i + 1) * ord(c) for i, c in enumerate(front['id']))
        institutional = bool(front['tags'].get('name') or front['tags'].get('religion'))
        masonry = ('BrickRed', 'BrickRed', 'BrickBrown', 'BrickOchre', 'Limestone')[seed % 5]
        masonry = front.get('masonry', masonry)
        if institutional:
            masonry = 'Limestone'
        door_material = 'DoorTeal' if seed % 3 else 'DoorBurgundy'
        levels = max(1, min(7, round((height - 80) / (400 if institutional else 305))))
        floor_height = min(450 if institutional else 325, (height - 105) / levels)
        raised = (45 if institutional else 85) if front['setback'] >= 330 else 15
        bays = max(1, min(36, round(width / 250)))
        centres = [(i + .5) * width / bays for i in range(bays)]
        window_width = min(128, width / bays * .53)
        if front.get('perimeter'):
            window_width = min(window_width, floor_height * .30)
            front['window_width_cm'] = round(window_width, 3)
        is_shop = any(front is shop for shop in shops)
        side_only = front.get('return', False)
        rear = front['kind'] == 'rear'
        depth_scale = min(1, max(.43, front['setback'] / 70))
        cornice = ('dentil', 'metal', 'parapet', 'stone')[seed % 4]
        if institutional:
            cornice = 'stone'
        front.update({'style': masonry, 'commercial': is_shop, 'levels': levels, 'balcony_levels': [],
                      'stairs': False, 'cornice': cornice, 'bay_windows': 0, 'institutional': institutional})
        counts['treated_surfaces'] += 1
        counts['rear_surfaces'] += int(rear)
        counts['side_surfaces'] += int(front['kind'] == 'side')
        apertures = [(0, width, 0, 410)] if is_shop else []
        front['window_treatments'] = {'recessed': 0, 'curtains': 0, 'blinds': 0, 'warm': 0}

        def p(x, depth, z):
            return (a[0] + u[0] * x + normal[0] * depth * depth_scale,
                    a[1] + u[1] * x + normal[1] * depth * depth_scale, z)

        def box(material, x, depth, z, sx, sy, sz):
            mesh.box(material, p(x, depth, z), (sx, sy * depth_scale, sz), yaw)

        def rod(material, start, end, radius=3):
            mesh.rod(material, p(*start), p(*end), radius, 6)

        def flat(material, left, right, bottom, top, depth):
            mesh.face(material, [p(left, depth, bottom), p(right, depth, bottom),
                                 p(right, depth, top), p(left, depth, top)])

        def pane(x, bottom, top, pane_width, door=False, lit=False, projection=0):
            domestic = not door and not institutional and not (is_shop and top < 250)
            aperture_half = pane_width / 2 + (39 if projection else 11)
            apertures.append((x - aperture_half, x + aperture_half, bottom - 10, top + 10))
            box('Iron', x, 15 + projection, (bottom + top) / 2, pane_width + 22, 12, top - bottom + 20)
            if domestic:
                left, right, low, high = x - pane_width / 2 + 6, x + pane_width / 2 - 6, bottom + 6, top - 6
                inner_width, inner_height = right - left, high - low
                window_seed = seed * 17 + round(a[0] / 17) * 3 + round(a[1] / 19) * 5 + round(x * 7 + bottom * 11)
                mode = window_seed % 10
                cloth = 'CurtainSage' if (window_seed // 7) % 4 == 0 else 'CurtainIvory'
                flat('InteriorDark', left, right, low, high, 25 + projection)
                counts['recessed_windows'] += 1
                front['window_treatments']['recessed'] += 1
                if lit and mode != 9:
                    # A dim far-room patch remains behind curtains and the reflective edge.
                    flat('InteriorWarm', left + inner_width * .18, right - inner_width * .12,
                         low + inner_height * .1, high - inner_height * .14, 25.5 + projection)
                    counts['warm_windows'] += 1
                    front['window_treatments']['warm'] += 1
                if mode in (0, 1, 2, 3, 4, 5):
                    panels = [(-1, .23 + (window_seed % 3) * .045), (1, .23)] if mode < 4 else [(1 if mode == 4 else -1, .38)]
                    for side, fraction in panels:
                        panel_left = left if side < 0 else right - inner_width * fraction
                        panel_right = left + inner_width * fraction if side < 0 else right
                        curtain_bottom = low + (7 if mode % 2 else 0)
                        for fold in range(4):
                            first = panel_left + (panel_right - panel_left) * fold / 4
                            last = panel_left + (panel_right - panel_left) * (fold + 1) / 4
                            first_depth, last_depth = (26, 29) if fold % 2 == 0 else (29, 26)
                            mesh.face(cloth, [p(first, first_depth + projection, curtain_bottom),
                                              p(last, last_depth + projection, curtain_bottom),
                                              p(last, last_depth + projection, high),
                                              p(first, first_depth + projection, high)])
                    box('Wood', x, 28 + projection, high + 1, pane_width - 9, 4, 3)
                    counts['curtained_windows'] += 1
                    front['window_treatments']['curtains'] += 1
                elif mode in (6, 7, 8):
                    blind_bottom = high - inner_height * (.34, .56, .75)[mode - 6]
                    flat(cloth, left, right, blind_bottom, high, 26 + projection)
                    if mode != 6:
                        # Small slat lips cast useful horizontal shadows at walking height.
                        for z in range(math.ceil(blind_bottom + 8), int(high), 11):
                            mesh.face(cloth, [p(left, 29 + projection, z - 2), p(right, 29 + projection, z - 2),
                                              p(right, 26.5 + projection, z + 2), p(left, 26.5 + projection, z + 2)])
                    box('Wood', x, 28 + projection, blind_bottom, pane_width - 10, 4, 3)
                    counts['blind_windows'] += 1
                    front['window_treatments']['blinds'] += 1
                # Opaque glass is used only as a restrained sky reflection, never a full blue fill.
                reflection_width = inner_width * (.09 if mode != 9 else .19)
                reflection_left = left if window_seed % 2 else right - reflection_width
                flat('Glass', reflection_left, reflection_left + reflection_width, low, high, 31 + projection)
                if mode == 9:
                    flat('Glass', left + inner_width * .26, right - inner_width * .2,
                         high - inner_height * .09, high, 31 + projection)
                if window_seed % 7 == 0:
                    # A few books on an inside sill make the dark field read as occupied space.
                    for item in range(3):
                        box(('Wood', 'CurtainSage', 'DoorBurgundy')[item], x - 13 + item * 9,
                            27 + projection, low + 10 + item * 2, 7, 5, 20 + item * 4)
            else:
                box('Glow' if lit else 'Glass', x, 23 + projection, (bottom + top) / 2, pane_width - 12, 5, top - bottom - 12)
            if not projection:
                left, right, low, high = x - aperture_half, x + aperture_half, bottom - 10, top + 10
                # The inner pane is behind the masonry face; these four returns close the recess.
                mesh.face(masonry, [p(left, 42, low), p(left, 22, low), p(left, 22, high), p(left, 42, high)])
                mesh.face(masonry, [p(right, 22, low), p(right, 42, low), p(right, 42, high), p(right, 22, high)])
                mesh.face(masonry, [p(left, 42, low), p(right, 42, low), p(right, 22, low), p(left, 22, low)])
                mesh.face(masonry, [p(left, 22, high), p(right, 22, high), p(right, 42, high), p(left, 42, high)])
            frame = 'Wood' if rear else (door_material if door else 'Trim')
            for offset in (-pane_width / 2, pane_width / 2):
                box(frame, x + offset, 29 + projection, (bottom + top) / 2, 9, 15, top - bottom + 8)
            for z in (bottom, top):
                box(frame, x, 29 + projection, z, pane_width + 9, 15, 9)
            if door:
                box(frame, x, 32 + projection, bottom + 45, pane_width - 8, 10, 78)
                box('Zinc', x + pane_width * .31, 41 + projection, bottom + 102, 4, 5, 16)
                box(frame, x, 30 + projection, top - 35, pane_width, 14, 7)
            else:
                if seed % 3 != 1:
                    box(frame, x, 30 + projection, (bottom + top) / 2, 6, 15, top - bottom)
                box(frame, x, 30 + projection, bottom + (top - bottom) * (.62 if seed % 3 == 2 else .48), pane_width, 15, 6)
                box('Limestone', x, 43 + projection, bottom - 11, pane_width + 32, 45, 18)
                box('Limestone', x, 40 + projection, top + 17, pane_width + 28, 28, 22)
                if not institutional and not rear and seed % 4 == 1:
                    box('Limestone', x, 45 + projection, top + 22, 22, 25, 32)
                counts['windows'] += 1

        def rail(left, right, depth, z, opening=None):
            spans = [(left, right)]
            if opening:
                spans = [(left, max(left, opening[0])), (min(right, opening[1]), right)]
            for first, last in spans:
                if last - first < 10:
                    continue
                for rail_z in (z + 12, z + 96):
                    rod('Iron', (first, depth, rail_z), (last, depth, rail_z), 3.4)
                steps = max(1, math.ceil((last - first) / 42))
                for i in range(steps + 1):
                    x = first + (last - first) * i / steps
                    rod('Iron', (x, depth, z + 5), (x, depth, z + 96), 2)

        def balcony_details(floor_z, depth, level, is_gallery=False):
            # Domestic objects belong to existing private decks; no new collision or path intrusion.
            domestic_seed = seed + level * 7 + int(is_gallery) * 3
            if width < 580 or domestic_seed % 4 == 0:
                return
            x = min(width - 120, max(120, width * (.58 if is_gallery else .32)))
            soil_z = floor_z + 88
            box('Wood' if domestic_seed % 2 else 'DoorBurgundy', x, depth - 15, floor_z + 77, 66, 23, 22)
            mesh.face('Soil', [p(x - 29, depth - 5, soil_z + .5), p(x + 29, depth - 5, soil_z + .5),
                               p(x + 29, depth - 25, soil_z + .5), p(x - 29, depth - 25, soil_z + .5)])
            # Sparse stems and folded, double-sided leaves avoid a low-poly foliage ball.
            for stem in range(3):
                stem_x = x - 21 + stem * 20
                top_z = soil_z + 21 + (domestic_seed + stem * 7) % 20
                rod('Wood', (stem_x, depth - 15, soil_z), (stem_x + 4, depth - 17, top_z), .8)
                for leaf_index in range(2):
                    z = soil_z + 9 + leaf_index * 10
                    side = -1 if (stem + leaf_index) % 2 else 1
                    points = [p(stem_x, depth - 16, z - 3), p(stem_x + side * 10, depth - 20, z),
                              p(stem_x + side * 16, depth - 14, z + 10), p(stem_x + side * 4, depth - 12, z + 6)]
                    mesh.face('Leaf', points)
                    mesh.face('Leaf', points[::-1])
            counts['domestic_balcony_details'] += 1
            if domestic_seed % 5 == 1 and width >= 750 and depth >= 120:
                # One folded outdoor chair, tucked beside the wall rather than at a stair opening.
                chair_x, chair_depth = width * .5, min(depth - 48, 78)
                box('Wood', chair_x, chair_depth, floor_z + 47, 39, 36, 4)
                box('Wood', chair_x, chair_depth - 16, floor_z + 68, 39, 4, 39)
                for dx in (-15, 15):
                    rod('Iron', (chair_x + dx, chair_depth - 12, floor_z + 7),
                        (chair_x + dx, chair_depth + 12, floor_z + 46), 1.7)
                    rod('Iron', (chair_x + dx, chair_depth + 12, floor_z + 7),
                        (chair_x + dx, chair_depth - 12, floor_z + 46), 1.7)

        # The opaque skin sits ahead of the old flat window grid and preserves the streetwall.
        mesh.face(masonry, [p(0, 8, 0), p(width, 8, 0), p(width, 8, height), p(0, 8, height)])
        box('Limestone', width / 2, 13, 53, width, 22, 106)
        if width < 150:
            box('Zinc', width / 2, 32, height + 10, width + 4, 65, 12)
            front['detail_bounds_cm'] = mesh.bounds()
            front.pop('tags')
            continue
        for x in (15, width - 15):
            box('Limestone' if seed % 2 else masonry, x, 43, height / 2, 30, 30, height)
        for level in range(1, levels):
            box('Limestone', width / 2, 43, raised + level * floor_height - 13, width, 25, 13)
        if institutional and front['kind'] == 'front':
            for x in range(80, int(width), 620):
                box('Trim', x, 31, height / 2, 46, 45, height - 110)
                box('Trim', x, 42, height - 70, 76, 65, 38)
        if rear or front['kind'] == 'side':
            box('Limestone', width / 2, 25, height - 32, width + 8, 50, 16)
            box('Zinc', width / 2, 35, height + 6, width + 16, 76, 12)
        elif cornice == 'parapet':
            box(masonry, width / 2, 20, height + 27, width + 8, 44, 54)
            box('Limestone', width / 2, 32, height + 57, width + 35, 75, 15)
            box(masonry, width / 2, 20, height + 65, min(width * .4, 360), 44, 55)
            box('Zinc', width / 2, 30, height + 96, min(width * .4, 360) + 28, 70, 10)
            counts['parapets'] += 1
        elif cornice == 'metal':
            box('Trim', width / 2, 35, height - 30, width + 24, 75, 42)
            mesh.face('Zinc', [p(0, 95, height + 15), p(width, 95, height + 15),
                               p(width, 10, height + 65), p(0, 10, height + 65)])
            for x in range(45, int(width), 88):
                box('Trim', x, 45, height - 42, 22, 65, 45)
        else:
            for z, depth, thickness in ((height - 57, 32, 20), (height - 28, 42, 23), (height + 1, 55, 22)):
                box('Limestone' if cornice == 'stone' else 'Trim', width / 2, depth, z, width + 32, depth * 2, thickness)
            if cornice == 'dentil':
                for x in range(35, int(width), 58):
                    box('Trim', x, 48, height - 42, 20, 58, 23)
            box('Zinc', width / 2, 58, height + 15, width + 44, 126, 8)

        stair = not institutional and not is_shop and not side_only and front['kind'] == 'front' and 700 <= width <= 1700 and front['setback'] >= 440 and seed % 3 != 0
        balcony = not institutional and not is_shop and not side_only and front['kind'] == 'front' and front['setback'] >= 195 and seed % 5 in (0, 1, 3)
        gallery = not institutional and rear and 520 <= width <= 1800 and front['gallery_depth'] >= 90 and seed % 3 != 0
        if stair:
            balcony = True
        front['stairs'] = stair
        for level in range(levels):
            floor_z = raised + level * floor_height
            for index, x in enumerate(centres):
                if is_shop and level == 0:
                    continue
                if level == 0 and index == 0 and ((not side_only and front['kind'] == 'front') or rear):
                    continue
                upper_door = (balcony and level > 0 and index == (len(centres) - 1 if level == 1 else 0)) or (gallery and level > 0 and floor_z >= 295 and index == 0)
                bay = not institutional and front['kind'] == 'front' and not is_shop and not stair and width >= 650 and front['setback'] >= 175 and seed % 5 in (1, 4) and index == min(1, len(centres) - 1)
                projection = 85 if bay and not upper_door else 0
                bottom = floor_z + (55 if institutional else 35)
                top = floor_z + min(320 if institutional else 211, max(100, floor_height - 35))
                if projection:
                    for side in (-1, 1):
                        outer_x, inner_x = x + side * (window_width / 2 + 35), x + side * window_width / 2
                        points = [p(outer_x, 42, bottom), p(inner_x, 108, bottom), p(inner_x, 108, top), p(outer_x, 42, top)]
                        mesh.face('InteriorDark', points if side == -1 else points[::-1])
                        # A small upper reflection retains the angled glazed-bay silhouette.
                        reflect = [p(outer_x, 42.5, top - 26), p(inner_x, 108.5, top - 26),
                                   p(inner_x, 108.5, top), p(outer_x, 42.5, top)]
                        mesh.face('Glass', reflect if side == -1 else reflect[::-1])
                        rod('Trim', (outer_x, 42, bottom), (outer_x, 42, top), 4)
                    box('Limestone', x, 66, bottom - 17, window_width + 90, 140, 20)
                    box('Zinc', x, 66, top + 22, window_width + 100, 150, 12)
                    counts['bay_windows'] += 1
                    front['bay_windows'] += 1
                pane(x, floor_z + 5 if upper_door else bottom,
                     floor_z + 225 if upper_door else top,
                     85 if upper_door else window_width, door=upper_door,
                     lit=not upper_door and (seed + index + level * 3) % 11 == 0, projection=projection)
            if gallery and level > 0 and floor_z >= 295:
                depth = front['gallery_depth']
                left, right = 30, width - 30
                box('Wood_Collision', width / 2, depth / 2 + 10, floor_z, width - 60, depth, 12)
                rail(left, right, depth + 10, floor_z)
                for x in (left, right):
                    rod('Iron', (x, 12, floor_z + 96), (x, depth + 10, floor_z + 96), 3)
                    rod('Iron', (x, depth, floor_z - 8), (x, 15, floor_z - 55), 4)
                counts['rear_galleries'] += 1
                front['balcony_levels'].append(round(floor_z, 2))
                front['gallery_clearance'] = round(front['gallery_depth'], 2)
                # Include the bracket radius and retain the lowest floor's clearance.
                front['gallery_headroom'] = round(min(front.get('gallery_headroom', math.inf), floor_z - 59), 2)
                balcony_details(floor_z, depth + 10, level, True)
            if balcony and level > 0:
                balcony_width = width - 70
                box('Iron_Collision', width / 2, 84, floor_z - 6, balcony_width, 168, 12)
                box('Wood', width / 2, 86, floor_z + 1, balcony_width - 12, 158, 5)
                opening = (centres[-1] - 53, centres[-1] + 53) if stair and level == 1 else None
                rail(35, width - 35, 165, floor_z, opening)
                for x in (35, width - 35):
                    rod('Iron', (x, 12, floor_z + 96), (x, 165, floor_z + 96), 3.4)
                    rod('Iron', (x, 165, floor_z - 7), (x, 16, floor_z - 155), 4)
                counts['balconies'] += 1
                front['balcony_levels'].append(round(floor_z, 2))
                balcony_details(floor_z, 165, level)

        if is_shop:
            counts['storefronts'] += 1
            shop_name = 'DÉPANNEUR DU PARC' if front is hero else 'CAFÉ DES ÉRABLES'
            shop_detail = 'CAFÉ • PAIN • PRODUITS FRAIS' if front is hero else 'ESPRESSO • PÂTISSERIES'
            awning = 'DoorBurgundy' if front is hero else 'DoorTeal'
            glass_left, glass_right = 48, width - 48
            box('DoorTeal', width / 2, 12, 153, width - 40, 8, 293)
            door_x = centres[0]
            pane(door_x, 10, 239, 87, door=True)
            for x in centres[1:]:
                pane(x, 48, 237, width / bays - 40)
                box('Limestone', x, 39, 27, width / bays - 18, 60, 45)
            box('DoorTeal', width / 2, 38, 353, width - 42, 45, 56)
            canvas = [p(glass_left, 180, 286), p(glass_right, 180, 286), p(glass_right, 26, 327), p(glass_left, 26, 327)]
            underside = [(point[0], point[1], point[2] - 1.5) for point in canvas]
            mesh.face(awning, canvas)
            mesh.face(awning, underside[::-1])
            for first, last in ((0, 3), (2, 1)):
                mesh.face(awning, [canvas[first], canvas[last], underside[last], underside[first]])
            box(awning, width / 2, 178, 274, width - 96, 8, 24)
            for x in range(65, int(width) - 55, 94):
                mesh.face('Trim', [p(x, 181, 286.5), p(x + 20, 181, 286.5), p(x + 20, 27, 327.5), p(x, 27, 327.5)])
            signs.append({'text': shop_name, 'position': list(p(width / 2, 65, 353)),
                          'normal': list(normal), 'yaw': math.degrees(math.atan2(normal[1], normal[0])),
                          'size': min(31, (width - 115) / 17)})
            signs.append({'text': shop_detail, 'position': list(p(width / 2, 188, 275)),
                          'normal': list(normal), 'yaw': math.degrees(math.atan2(normal[1], normal[0])), 'size': 15})
            front['terrace'] = list(p(width * .7, min(360, max(210, front['setback'] - 100)), 12))
            front['terrace_yaw'] = yaw
            if front['setback'] >= 450:
                table_x, table_depth = width * .7, min(360, front['setback'] - 100)
                mesh.cylinder('Wood', p(table_x, table_depth, 78), 38, 5, 16)
                mesh.cylinder('Iron', p(table_x, table_depth, 11), 24, 5, 12)
                rod('Iron', (table_x, table_depth, 12), (table_x, table_depth, 75), 4)
                for side in (-1, 1):
                    chair_x = table_x + side * 79
                    box('Wood', chair_x, table_depth, 45, 42, 42, 5)
                    box('Wood', chair_x + side * 19, table_depth, 68, 5, 42, 40)
                    for dx in (-16, 16):
                        for dy in (-16, 16):
                            rod('Iron', (chair_x + dx, table_depth + dy, 10), (chair_x + dx, table_depth + dy, 43), 2.5)
                front['terrace_clearance'] = front['setback'] - table_depth - 38
                counts['cafe_tables'] += 1
            for index, x in enumerate(centres[1:]):
                box('Wood', x, 34, 64, width / bays - 68, 18, 15)
                for item in range(3):
                    box('DoorBurgundy' if index % 2 else 'Limestone', x - 40 + item * 35, 39, 83, 22, 12, 23 + item * 5)
        elif rear:
            entry = centres[0]
            if not institutional and width >= 700 and seed % 7 == 0:
                apertures.append((entry - 118, entry + 118, 5, 245))
                box('Iron', entry, 18, 124, 236, 14, 238)
                box('Wood', entry, 29, 124, 220, 9, 224)
                for z in range(24, 230, 25):
                    box('Zinc', entry, 36, z, 222, 6, 4)
                for x in (-114, 114):
                    box('Limestone', entry + x, 36, 124, 12, 25, 245)
                counts['garage_doors'] += 1
            else:
                pane(entry, 16, 232, min(92, width * .5), door=True)
                box('Zinc', entry, 48, 250, min(140, width - 20), 100, 8)
                counts['rear_doors'] += 1
        elif not side_only and front['kind'] == 'front':
            entry = centres[0]
            for offset in (-36, 36):
                pane(entry + offset, raised + 5, raised + 221, 61, door=True)
            box('Trim', entry, 36, raised + 239, 173, 60, 28)
            porch_depth = max(16, min(170, front['setback'] - 20))
            box('Concrete_Collision', entry, porch_depth / 2, raised - 9, 182, porch_depth, 18)
            # Five 17 cm risers fit a 1.3 m stoop without occupying the public sidewalk.
            if front['setback'] >= 330:
                for step in range(5):
                    z = raised * (step + 1) / 5
                    box('Concrete_Collision', entry, 305 - step * 29, z / 2, 158, 30, z)
                for side in (-87, 87):
                    rod('Iron', (entry + side, 145, raised + 87), (entry + side, 315, 100), 3.5)
                    for depth in (160, 300):
                        z = raised if depth == 160 else 17
                        rod('Iron', (entry + side, depth, z), (entry + side, depth, z + 90), 2.7)
                counts['raised_entrances'] += 1
            else:
                # shortcut: tight setbacks keep a low threshold; replace with surveyed entrance geometry when available.
                box('Concrete_Collision', entry, 25, 7.5, 160, 40, 15)
            for x in centres[1:] if raised > 50 else []:
                apertures.append((x - window_width / 2 - 4, x + window_width / 2 + 4, 9, 69))
                box('Iron', x, 27, 38, window_width, 12, 56)
                box('Glass', x, 35, 38, window_width - 14, 5, 40)
                for offset in (-window_width / 3, 0, window_width / 3):
                    rod('Iron', (x + offset, 42, 13), (x + offset, 42, 65), 2)
            if stair:
                bottom_x, top_x = centres[0] + 30, centres[-1]
                steps = max(15, math.ceil(floor_height / 18))
                path = []
                for i in range(steps + 1):
                    t = i / steps
                    path.append((bottom_x + (top_x - bottom_x) * t,
                                 155 + 130 * (1 - t) + 55 * math.sin(math.pi * t),
                                 raised + floor_height * t))
                box('Iron_Collision', bottom_x, 285, raised - 5, 130, 140, 10)
                for step in range(5):
                    z = raised * (step + 1) / 5
                    box('Concrete_Collision', bottom_x, 425 - step * 27, z / 2, 112, 28, z)
                for index, (start, end) in enumerate(zip(path, path[1:])):
                    world_a, world_b = p(*start), p(*end)
                    dx, dy = world_b[0] - world_a[0], world_b[1] - world_a[1]
                    run = math.hypot(dx, dy)
                    tangent = (dx / run, dy / run)
                    centre = ((world_a[0] + world_b[0]) / 2, (world_a[1] + world_b[1]) / 2, end[2] - 4)
                    mesh.box('Iron_Collision', centre, (run + 3, 92, 8), math.degrees(math.atan2(dy, dx)))
                    for side in (-1, 1):
                        offset = (-tangent[1] * 46 * side, tangent[0] * 46 * side)
                        edge_a = (world_a[0] + offset[0], world_a[1] + offset[1], world_a[2])
                        edge_b = (world_b[0] + offset[0], world_b[1] + offset[1], world_b[2])
                        mesh.rod('Iron', edge_a, edge_b, 4, 6)
                        mesh.rod('Iron', (*edge_a[:2], edge_a[2] + 95), (*edge_b[:2], edge_b[2] + 95), 3, 6)
                        if index % 2 == 0:
                            mesh.rod('Iron', edge_b, (*edge_b[:2], edge_b[2] + 95), 2.3, 6)
                counts['exterior_stairs'] += 1
                front['stair_clearance'] = round(front['setback'] - 440, 2)

        if not side_only and not institutional and front['kind'] == 'front' and width >= 500 and seed % 3 != 1:
            box(masonry, width * .35, -78, height + 70, 68, 62, 140)
            box('Limestone', width * .35, -78, height + 145, 88, 82, 15)
            mesh.cylinder('Zinc', p(width * .35, -78, height + 165), 15, 30, 8)
            counts['chimneys'] += 1
        rod('Zinc', (width - 34, 47, 35), (width - 34, 47, height - 55), 3.8)
        # A continuous outer wall around the openings makes the shallow inner fields read as
        # recesses while the original backing skin still masks the legacy window grid.
        for left, right, bottom, top in _wall_rectangles(width, height, apertures):
            if bottom < 106:
                flat('Limestone', left, right, bottom, min(106, top), 42)
            if top > 106:
                flat(masonry, left, right, max(106, bottom), top, 42)
        front['detail_bounds_cm'] = mesh.bounds()
        front.pop('tags')
    return {'fronts': fronts, 'signs': signs, 'counts': counts}


def self_check():
    """Check orientation, determinism, dimensional bounds, and a useful Montreal front."""
    class CheckedMesh:
        def __init__(self):
            self.vertices = 0
            self.faces = []
            self.boxes = []

        def face(self, material, points):
            assert material and len(points) >= 3
            assert all(len(p) == 3 and all(math.isfinite(v) for v in p) for p in points)
            self.vertices += len(points)
            self.faces.append((material, points))

        def box(self, material, centre, size, yaw=0):
            assert all(math.isfinite(v) for v in (*centre, *size, yaw)) and min(size) > 0
            self.vertices += 8
            self.boxes.append((material, centre, size))

        def rod(self, material, start, end, radius, sides=8):
            assert radius > 0 and sides >= 3 and math.dist(start, end) > 0
            assert all(math.isfinite(v) for v in (*start, *end))
            self.vertices += sides * 2

        def cylinder(self, material, centre, radius, height, sides=12):
            assert radius > 0 and height > 0 and sides >= 3
            assert all(math.isfinite(v) for v in centre)
            self.vertices += sides * 2

    buildings = [{'id': str(i), 'height': 960, 'tags': {},
                  'points': [[i * 1100, 0], [i * 1100 + 850, 0], [i * 1100 + 850, 1800], [i * 1100, 1800]]}
                 for i in range(4)]
    roads = [{'points': [[-1000, -1400], [6000, -1400]], 'width': 620, 'name': 'Rue Sherbrooke Est', 'tags': {'highway': 'residential'}}]
    mesh = CheckedMesh()
    result = build_facades(mesh, buildings, roads, [[0, -1100], [5000, -1100]])
    assert len(result['fronts']) == 4
    assert result['counts']['exterior_stairs'] >= 1 and result['counts']['storefronts'] == 1
    assert all(front['normal'][1] == -1 and front['height'] == 960 for front in result['fronts'])
    skins = [points for material, points in mesh.faces
             if material in ('BrickRed', 'BrickBrown', 'BrickOchre', 'Limestone')
             and min(point[2] for point in points) == 0 and max(point[2] for point in points) == 960]
    surfaces = result['fronts'] + [surface for front in result['fronts'] for surface in front.get('corner_returns', [])]
    assert len(skins) == len(surfaces) == result['counts']['treated_surfaces']
    for points, front in zip(skins, surfaces):
        a, b, c = points[:3]
        ab, ac = [b[i] - a[i] for i in range(3)], [c[i] - a[i] for i in range(3)]
        normal_x = ab[1] * ac[2] - ab[2] * ac[1]
        normal_y = ab[2] * ac[0] - ab[0] * ac[2]
        assert normal_x * front['normal'][0] + normal_y * front['normal'][1] > 0, 'The opaque facade must face the street'
    awning_tops = awning_bottoms = 0
    for material, points in mesh.faces:
        if material in ('DoorBurgundy', 'DoorTeal', 'Trim'):
            a, b, c = points[:3]
            normal_z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if material == 'Trim' or (min(p[2] for p in points), max(p[2] for p in points)) == (286, 327):
                assert normal_z > 0, 'Awning tops must face the sky'
                awning_tops += material != 'Trim'
            elif (min(p[2] for p in points), max(p[2] for p in points)) == (284.5, 325.5):
                assert normal_z < 0, 'Awning undersides must remain visible from walking height'
                awning_bottoms += 1
    assert awning_tops == awning_bottoms == result['counts']['storefronts']
    assert all(front.get('stair_clearance', 0) >= 0 for front in result['fronts'])
    shop = next(front for front in result['fronts'] if front['commercial'])
    backing = next((centre, size) for material, centre, size in mesh.boxes if material == 'DoorTeal' and size[2] == 293)
    glass = [(centre, size) for material, centre, size in mesh.boxes if material == 'Glass'
             and shop['a'][0] < centre[0] < shop['b'][0] and centre[1] < 0 and centre[2] < 250]
    assert glass and all(-centre[1] + size[1] / 2 > -backing[0][1] + backing[1][1] / 2 for centre, size in glass), 'Store glazing must be in front of its backing'
    main_sign = next(sign for sign in result['signs'] if sign['text'] == 'DÉPANNEUR DU PARC')
    assert main_sign['position'][2] - main_sign['size'] / 2 > 327, 'Shop name must clear the awning'
    assert result['counts']['cafe_tables'] == 1 and shop['terrace_clearance'] >= 0
    assert len(set(front['id'] for front in result['fronts'])) == len(result['fronts'])
    assert result == build_facades(CheckedMesh(), buildings, roads, [[0, -1100], [5000, -1100]]), 'Authoring must be deterministic without mutating input records'
    tight_roads = [dict(roads[0], points=[[-1000, -600], [6000, -600]])]
    tight = build_facades(CheckedMesh(), buildings, tight_roads, [[0, -500], [5000, -500]])
    assert tight['counts']['exterior_stairs'] == 0 and tight['counts']['balconies'] == 0
    alley = {'points': [[-1000, 2300], [6000, 2300]], 'width': 380, 'name': '', 'tags': {'highway': 'service', 'service': 'alley'}}
    rear = build_facades(CheckedMesh(), buildings, roads + [alley], [[0, -1100], [5000, -1100]])
    rear_surfaces = [surface for front in rear['fronts'] for surface in front.get('corner_returns', []) if surface['kind'] == 'rear']
    assert rear['counts']['rear_galleries'] > 0 and rear['counts']['rear_doors'] > 0
    assert all(surface.get('gallery_headroom', 240) >= 240 for surface in rear_surfaces)
    galleries = [surface for surface in rear_surfaces if surface.get('gallery_headroom')]
    assert all(surface['gallery_headroom'] == round(min(surface['balcony_levels']) - 59, 2) for surface in galleries), 'Gallery headroom must describe the lowest bracket, not the highest floor'
    assert any(len(surface['balcony_levels']) > 1 for surface in galleries), 'Headroom fixture must include stacked galleries'
    bay_buildings = [dict(buildings[0], id='6'), buildings[1]]
    bays = build_facades(CheckedMesh(), bay_buildings, roads, [[0, -1100], [5000, -1100]])
    assert bays['counts']['bay_windows'] > 0
    contiguous = [buildings[0], dict(buildings[1], points=[[850, 0], [1700, 0], [1700, 1800], [850, 1800]])]
    shared = _candidates(contiguous, roads, [[0, -1100], [5000, -1100]])
    assert all(not (surface['a'][0] == surface['b'][0] == 850) for front in shared for surface in [front] + front['alternates'])
    many = [dict(buildings[0], id=str(i), points=[[i * 1100, 0], [i * 1100 + 850, 0], [i * 1100 + 850, 1800], [i * 1100, 1800]]) for i in range(46)]
    long_road = [dict(roads[0], points=[[-1000, -1400], [52000, -1400]])]
    assert len(_candidates(many, long_road, [[0, -1100], [52000, -1100]])) == 46, 'Continuous frontage cannot have a building-count cap'
    assert _inside((5, 5), [(0, 0), (10, 0), (10, 10), (0, 10)])
    assert _outward_clearance((0, 0), (1, 0), [[(100, -10), (120, -10), (120, 10), (100, 10)]]) == 100
    assert mesh.vertices > 1000
    assert result['counts']['recessed_windows'] > 0 and result['counts']['curtained_windows'] > 0
    assert result['counts']['blind_windows'] > 0 and result['counts']['domestic_balcony_details'] > 0
    assert all(len(surface['detail_bounds_cm']) == 2 for surface in surfaces)
    reversed_buildings = [dict(building, points=building['points'][::-1]) for building in buildings]
    assert [f['id'] for f in _candidates(reversed_buildings, roads, [[0, -1100], [5000, -1100]])] == [f['id'] for f in result['fronts']]
    return result['counts']


if __name__ == '__main__':
    print(self_check())
