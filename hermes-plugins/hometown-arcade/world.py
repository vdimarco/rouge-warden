"""Turn OpenStreetMap elements into the game's world: buildings, roads, areas, trees, places.

The world is a plain dict that the game page reads as JSON. All positions are
metres on the local plane from :mod:`geo` (x east, y north), rounded to 0.1 m.
"""

from __future__ import annotations

import hashlib
import math
import random
from typing import Any, Optional

from . import geo

WORLD_VERSION = 1
ATTRIBUTION = "Map data © OpenStreetMap contributors (ODbL)"

MAJOR = {"motorway", "trunk", "primary", "secondary", "tertiary", "motorway_link", "trunk_link",
         "primary_link", "secondary_link", "tertiary_link"}
STREET = {"residential", "unclassified", "living_street", "road", "busway"}
SERVICE = {"service"}
PATH = {"footway", "path", "cycleway", "pedestrian", "steps", "track", "bridleway", "corridor"}
SKIP_HIGHWAY = {"proposed", "construction", "abandoned", "platform", "raceway", "elevator", "via_ferrata"}

AREA_KINDS = {
    "water": 0, "park": 1, "wood": 2, "pitch": 3, "parking": 4, "plaza": 5, "sand": 6, "island": 7,
}

POI_KEYS = ("amenity", "shop", "tourism", "leisure", "historic", "craft", "railway")
POI_SKIP = {"parking", "bicycle_parking", "parking_entrance", "parking_space", "vending_machine",
            "post_box", "bench", "waste_basket", "waste_disposal", "recycling", "atm", "telephone",
            "charging_station", "motorcycle_parking", "toilets", "drinking_water", "fire_hydrant",
            "bicycle_rental", "loading_dock", "clock", "shelter"}
POI_RANK = {  # higher shows first in the list the agent sees
    "tourism": 6, "historic": 6, "leisure": 4, "amenity": 3, "shop": 3, "craft": 2, "railway": 5,
}
INTERESTING = {"cafe": 3, "restaurant": 2, "bar": 2, "pub": 3, "bakery": 3, "ice_cream": 3,
               "museum": 4, "theatre": 4, "cinema": 3, "library": 3, "place_of_worship": 2,
               "park": 2, "fountain": 3, "marketplace": 3, "school": 1, "fast_food": 1,
               "pharmacy": 1, "station": 3, "viewpoint": 4, "attraction": 4, "artwork": 3,
               "stadium": 4, "pitch": 1, "playground": 2, "hospital": 2, "fire_station": 3,
               "police": 2, "townhall": 3, "books": 2, "deli": 2, "butcher": 2, "convenience": 1}


def _r(v: float) -> float:
    return round(v, 1)


def _flat(points: list[geo.Point]) -> list[float]:
    out: list[float] = []
    for x, y in points:
        out.append(_r(x))
        out.append(_r(y))
    return out


def _num(text: Optional[str]) -> Optional[float]:
    if not text:
        return None
    t = str(text).split(";")[0].strip().lower().replace(",", ".")
    for unit in (" m", "m"):
        if t.endswith(unit):
            t = t[: -len(unit)]
    try:
        v = float(t)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def _hash01(*parts: Any) -> float:
    h = hashlib.blake2b("|".join(map(str, parts)).encode(), digest_size=4).digest()
    return int.from_bytes(h, "big") / 0xFFFFFFFF


def building_height(tags: dict[str, str], key: Any) -> float:
    h = _num(tags.get("height"))
    if h and 2 <= h <= 400:
        return h
    levels = _num(tags.get("building:levels"))
    if levels and 0 < levels < 120:
        roof = _num(tags.get("roof:levels")) or 0
        return (levels + roof * 0.6) * 3.2 + 1.0
    kind = tags.get("building", "yes")
    base = {"house": 7, "detached": 7, "semidetached_house": 8, "terrace": 10, "garage": 3.2,
            "garages": 3.2, "shed": 2.8, "hut": 3, "roof": 4, "kiosk": 3.5, "church": 18,
            "cathedral": 30, "commercial": 12, "retail": 8, "office": 20, "industrial": 9,
            "warehouse": 9, "school": 12, "university": 16, "hospital": 22, "hotel": 24,
            "apartments": 13, "residential": 11}.get(kind, 10)
    return round(base * (0.85 + 0.3 * _hash01("h", key)), 1)


def building_color(tags: dict[str, str], key: Any) -> int:
    """Pick one of the game's eight façade colours."""
    colour = (tags.get("building:colour") or "").lower()
    named = {"red": 0, "brown": 1, "darkred": 0, "white": 4, "beige": 3, "grey": 5, "gray": 5,
             "yellow": 3, "black": 6, "blue": 7, "lightgrey": 4, "tan": 3}
    if colour in named:
        return named[colour]
    material = (tags.get("building:material") or "").lower()
    if material in ("brick",):
        return 0 if _hash01("c", key) < 0.6 else 1
    if material in ("stone", "sandstone", "limestone"):
        return 2
    if material in ("glass", "metal"):
        return 7
    kind = tags.get("building", "yes")
    if kind in ("church", "cathedral", "chapel", "civic", "public", "government", "townhall"):
        return 2
    if kind in ("office", "commercial", "hotel", "hospital", "university"):
        return 7 if _hash01("c", key) < 0.5 else 5
    if kind in ("industrial", "warehouse", "garage", "garages", "shed"):
        return 5 if _hash01("c", key) < 0.5 else 6
    return [0, 1, 0, 3, 1, 4, 2, 0][int(_hash01("c", key) * 8) % 8]


def road_style(tags: dict[str, str]) -> Optional[tuple[str, float]]:
    h = tags.get("highway")
    if not h or h in SKIP_HIGHWAY:
        return None
    if tags.get("area") == "yes":
        return None
    if h in MAJOR:
        kind, fallback = "major", 12.0
    elif h in STREET:
        kind, fallback = "street", 8.0
    elif h in SERVICE:
        kind, fallback = "service", 4.5
    elif h in PATH:
        kind, fallback = "path", 2.6
    else:
        return None
    w = _num(tags.get("width"))
    if w and 1 <= w <= 40:
        return kind, w
    lanes = _num(tags.get("lanes"))
    if lanes and kind in ("major", "street") and 1 <= lanes <= 10:
        return kind, max(6.0, min(22.0, lanes * 3.3))
    return kind, fallback


def area_kind(tags: dict[str, str]) -> Optional[str]:
    if tags.get("natural") == "water" or tags.get("waterway") == "riverbank" or tags.get("water"):
        return "water"
    leisure, landuse, natural = tags.get("leisure"), tags.get("landuse"), tags.get("natural")
    if leisure in ("pitch", "playground", "dog_park") :
        return "pitch"
    if leisure in ("park", "garden", "common", "golf_course") or landuse in (
            "grass", "meadow", "recreation_ground", "village_green", "park", "cemetery") or natural == "grassland":
        return "park"
    if landuse == "forest" or natural in ("wood", "scrub"):
        return "wood"
    if natural in ("beach", "sand"):
        return "sand"
    if tags.get("amenity") == "parking" and tags.get("parking") not in ("underground", "multi-storey"):
        return "parking"
    if tags.get("highway") == "pedestrian" and tags.get("area") == "yes":
        return "plaza"
    return None


def poi_kind(tags: dict[str, str]) -> Optional[tuple[str, str]]:
    for key in POI_KEYS:
        v = tags.get(key)
        if not v or v in POI_SKIP or v in ("yes", "no"):
            continue
        if key == "railway" and v != "station":
            continue
        return key, v
    return None


def _ring_xy(proj: geo.Projection, geometry: list[tuple[float, float]]) -> list[geo.Point]:
    return geo.clean_ring(proj.xy(lat, lon) for lat, lon in geometry)


def _polygons(proj: geo.Projection, el: dict[str, Any]) -> list[tuple[list[geo.Point], list[list[geo.Point]]]]:
    """Return [(outer ring, inner rings)] for a closed way or a multipolygon relation."""
    if el["type"] == "way":
        g = el["geometry"]
        if len(g) < 4 or g[0] != g[-1]:
            return []
        ring = _ring_xy(proj, g)
        return [(ring, [])] if len(ring) >= 3 else []
    if el["type"] == "relation":
        outers = geo.join_ways([[proj.xy(*p) for p in m["geometry"]] for m in el["members"] if m["role"] != "inner"])
        inners = geo.join_ways([[proj.xy(*p) for p in m["geometry"]] for m in el["members"] if m["role"] == "inner"])
        out = []
        for o in outers:
            holes = [i for i in inners if geo.point_in_ring(i[0], o)]
            out.append((o, holes))
        return out
    return []


def build_world(elements: list[dict[str, Any]], center: tuple[float, float], radius_m: float,
                title: str, *, max_buildings: int = 6000, seed: int = 7) -> dict[str, Any]:
    """Build the world dict. ``radius_m`` is half the side of the square map."""
    proj = geo.Projection(*center)
    half = float(radius_m)
    box = (-half, -half, half, half)
    rng = random.Random(seed)

    buildings: list[dict[str, Any]] = []
    roads: list[dict[str, Any]] = []
    areas: list[dict[str, Any]] = []
    trees: list[float] = []
    scattered: list[geo.Point] = []  # trees we add to woods and parks; mapped trees go in `trees`
    pois: list[dict[str, Any]] = []
    rails: list[dict[str, Any]] = []
    blockers: list[list[geo.Point]] = []  # rings that the car can not drive through
    seen_poi: set[str] = set()

    def add_area(kind: str, ring: list[geo.Point], name: str = "") -> None:
        ring = geo.simplify_ring(ring, 0.4)
        ring = geo.clip_ring(ring, box)
        if len(ring) < 3 or abs(geo.signed_area(ring)) < 4:
            return
        ring = geo.ccw(ring)
        tri = geo.triangulate(ring)
        if not tri:
            return
        area = {"k": AREA_KINDS[kind], "p": _flat(ring), "t": tri}
        if name:
            area["n"] = name
        areas.append(area)
        if kind == "water":
            blockers.append(ring)
        if kind in ("wood", "park"):
            density = 260.0 if kind == "wood" else 1400.0
            count = min(400, int(abs(geo.signed_area(ring)) / density))
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            tries = 0
            while count > 0 and tries < count * 6:
                tries += 1
                p = (rng.uniform(min(xs), max(xs)), rng.uniform(min(ys), max(ys)))
                if geo.point_in_ring(p, ring):
                    scattered.append(p)
                    count -= 1

    def add_poi(tags: dict[str, str], pos: geo.Point, el_id: Any) -> None:
        name = (tags.get("name") or "").strip()
        if not name or not (-half <= pos[0] <= half and -half <= pos[1] <= half):
            return
        pk = poi_kind(tags)
        if pk is None:
            b = tags.get("building")
            if b and b not in ("yes", "residential", "apartments", "house"):
                pk = ("building", b)
            else:
                return
        key = f"{name.lower()}|{pk[1]}"
        if key in seen_poi:
            return
        seen_poi.add(key)
        score = POI_RANK.get(pk[0], 1) + INTERESTING.get(pk[1], 0) - math.hypot(*pos) / max(half, 1) * 2
        pois.append({"n": name[:60], "k": pk[1], "g": pk[0], "x": _r(pos[0]), "y": _r(pos[1]),
                     "s": round(score, 2), "osm": f"{el_id}"})

    for el in elements:
        tags = el.get("tags") or {}
        t = el["type"]
        if t == "node":
            pos = proj.xy(el["lat"], el["lon"])
            if tags.get("natural") == "tree" and -half <= pos[0] <= half and -half <= pos[1] <= half:
                trees.extend((_r(pos[0]), _r(pos[1])))
            if tags.get("name"):
                add_poi(tags, pos, f"n{el['id']}")
            continue

        if tags.get("building") and tags.get("building") not in ("no",) and not tags.get("building:part"):
            if tags.get("location") == "underground" or tags.get("layer", "0").startswith("-"):
                continue
            for outer, _holes in _polygons(proj, el):
                c = geo.centroid(outer)
                if not (-half <= c[0] <= half and -half <= c[1] <= half):
                    continue
                ring = geo.ccw(geo.simplify_ring(outer, 0.15))
                if len(ring) < 3 or abs(geo.signed_area(ring)) < 6:
                    continue
                tri = geo.triangulate(ring)
                if not tri:
                    continue
                key = el.get("id")
                b = {"p": _flat(ring), "t": tri, "h": _r(building_height(tags, key)),
                     "c": building_color(tags, key)}
                min_h = _num(tags.get("min_height"))
                if min_h and 0 < min_h < b["h"]:
                    b["m"] = _r(min_h)  # raised building (a bridge or an overhang): drive under it
                else:
                    blockers.append(ring)
                buildings.append(b)
                if tags.get("name"):
                    add_poi(tags, c, f"w{el['id']}")
            continue

        kind = area_kind(tags)
        if kind:
            for outer, holes in _polygons(proj, el):
                add_area(kind, outer, tags.get("name", ""))
                for hole in holes:  # an island in a pond, a courtyard in a park
                    add_area("island" if kind == "water" else "plaza", hole)
                if tags.get("name"):
                    add_poi(tags, geo.centroid(outer), f"{t[0]}{el['id']}")
            continue

        if t == "way":
            style = road_style(tags)
            if style:
                if tags.get("tunnel") in ("yes", "building_passage") or tags.get("layer", "0").startswith("-"):
                    continue
                pts = geo.simplify([proj.xy(lat, lon) for lat, lon in el["geometry"]], 0.3)
                for piece in geo.clip_polyline(pts, box):
                    if len(piece) < 2:
                        continue
                    road = {"p": _flat(piece), "k": style[0], "w": _r(style[1])}
                    if tags.get("name"):
                        road["n"] = tags["name"][:60]
                    if tags.get("oneway") == "yes":
                        road["o"] = 1
                    roads.append(road)
                continue
            if tags.get("waterway") in ("river", "canal", "stream"):
                w = {"river": 14.0, "canal": 10.0, "stream": 2.5}[tags["waterway"]]
                pts = [proj.xy(lat, lon) for lat, lon in el["geometry"]]
                for piece in geo.clip_polyline(pts, box):
                    roads.append({"p": _flat(piece), "k": "water", "w": w})
                continue
            if tags.get("railway") in ("rail", "tram", "light_rail") and tags.get("tunnel") != "yes":
                pts = [proj.xy(lat, lon) for lat, lon in el["geometry"]]
                for piece in geo.clip_polyline(pts, box):
                    rails.append({"p": _flat(piece), "k": "rail", "w": 2.0})
                continue
            if tags.get("name") and poi_kind(tags):
                pts = [proj.xy(lat, lon) for lat, lon in el["geometry"]]
                add_poi(tags, pts[len(pts) // 2], f"w{el['id']}")

    trees.extend(v for p in _off_roads(scattered, roads) for v in (_r(p[0]), _r(p[1])))

    if len(buildings) > max_buildings:  # keep the ones nearest the centre
        buildings.sort(key=lambda b: math.hypot(b["p"][0], b["p"][1]))
        buildings = buildings[:max_buildings]

    roads.extend(rails)
    roads.sort(key=lambda r: ("water", "path", "service", "street", "major", "rail").index(r["k"]))

    # Name each place by its street, so missions can say where things are.
    named = [(r["n"], r["p"]) for r in roads if r.get("n") and r["k"] in ("major", "street", "service", "path")]
    for p in pois:
        best, best_d = "", 60.0
        for name, flat in named:
            for i in range(0, len(flat) - 2, 2):
                d = geo.distance_to_segment((p["x"], p["y"]), (flat[i], flat[i + 1]), (flat[i + 2], flat[i + 3]))
                if d < best_d:
                    best, best_d = name, d
        if best:
            p["st"] = best
    pois.sort(key=lambda p: -p["s"])
    pois = pois[:400]
    for i, p in enumerate(pois, 1):
        p["id"] = f"p{i}"

    spawn = _spawn(roads, blockers)
    lengths: dict[str, float] = {}
    for r in roads:
        if r.get("n") and r["k"] in ("major", "street"):
            f = r["p"]
            lengths[r["n"]] = lengths.get(r["n"], 0.0) + sum(
                math.hypot(f[i + 2] - f[i], f[i + 3] - f[i + 1]) for i in range(0, len(f) - 2, 2))
    streets = [n for n, _ in sorted(lengths.items(), key=lambda kv: -kv[1])]

    return {
        "version": WORLD_VERSION,
        "title": title,
        "center": {"lat": round(center[0], 6), "lon": round(center[1], 6)},
        "half": _r(half),
        "attribution": ATTRIBUTION,
        "buildings": buildings,
        "roads": roads,
        "areas": areas,
        "trees": trees[: 2 * 6000],
        "pois": pois,
        "streets": streets[:60],
        "spawn": spawn,
    }


def _off_roads(points: list[geo.Point], roads: list[dict[str, Any]], margin: float = 1.5) -> list[geo.Point]:
    """Drop added trees that would stand on a road or path."""
    cell = 20.0
    grid: dict[tuple[int, int], list[tuple[float, float, float, float, float]]] = {}
    for r in roads:
        f, reach = r["p"], r["w"] / 2 + margin
        for i in range(0, len(f) - 2, 2):
            seg = (f[i], f[i + 1], f[i + 2], f[i + 3], reach)
            for ix in range(int((min(f[i], f[i + 2]) - reach) // cell), int((max(f[i], f[i + 2]) + reach) // cell) + 1):
                for iy in range(int((min(f[i + 1], f[i + 3]) - reach) // cell), int((max(f[i + 1], f[i + 3]) + reach) // cell) + 1):
                    grid.setdefault((ix, iy), []).append(seg)
    out = []
    for p in points:
        segs = grid.get((int(p[0] // cell), int(p[1] // cell)), [])
        if not any(geo.distance_to_segment(p, (s[0], s[1]), (s[2], s[3])) < s[4] for s in segs):
            out.append(p)
    return out


def _spawn(roads: list[dict[str, Any]], blockers: list[list[geo.Point]]) -> dict[str, float]:
    """Start on the drivable road nearest the centre, facing along it."""
    best = None
    for r in roads:
        if r["k"] not in ("major", "street", "service"):
            continue
        f = r["p"]
        for i in range(0, len(f) - 2, 2):
            a, b = (f[i], f[i + 1]), (f[i + 2], f[i + 3])
            seg = math.dist(a, b)
            if seg < 1:
                continue
            for t in (0.25, 0.5, 0.75):
                p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                d = math.hypot(*p) + (25 if r["k"] == "service" else 0)
                if best is None or d < best[0]:
                    if not any(geo.point_in_ring(p, ring) for ring in blockers):
                        best = (d, p, math.atan2(b[1] - a[1], b[0] - a[0]))
    if best is None:
        return {"x": 0.0, "y": 0.0, "a": 0.0}
    return {"x": _r(best[1][0]), "y": _r(best[1][1]), "a": round(best[2], 3)}


def summary(world: dict[str, Any], poi_limit: int = 25) -> dict[str, Any]:
    """The facts the agent needs to write missions, without the geometry."""
    return {
        "buildings": len(world["buildings"]),
        "roads": sum(1 for r in world["roads"] if r["k"] in ("major", "street", "service")),
        "paths": sum(1 for r in world["roads"] if r["k"] == "path"),
        "areas": len(world["areas"]),
        "trees": len(world["trees"]) // 2,
        "places": len(world["pois"]),
        "size_m": round(world["half"] * 2),
        "streets": world["streets"][:15],
        "top_places": [poi_brief(p) for p in world["pois"][:poi_limit]],
    }


def poi_brief(p: dict[str, Any]) -> dict[str, Any]:
    d = math.hypot(p["x"], p["y"])
    bearing = (math.degrees(math.atan2(p["x"], p["y"])) + 360) % 360
    compass = "N NE E SE S SW W NW".split()[int((bearing + 22.5) // 45) % 8]
    out = {"id": p["id"], "name": p["n"], "type": p["k"].replace("_", " "),
           "from_centre": f"{round(d)} m {compass}" if d >= 15 else "at the centre"}
    if p.get("st"):
        out["street"] = p["st"]
    return out
