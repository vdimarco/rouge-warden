"""Plane geometry for the map: projection, clipping, simplification and triangulation.

Coordinates are metres on a local plane: x points east, y points north, and the
origin is the map centre. Rings are lists of (x, y) tuples without a repeated
closing point.
"""

from __future__ import annotations

import math
from typing import Iterable, Optional, Sequence

Point = tuple[float, float]
EARTH_M_PER_DEG = 111_320.0


class Projection:
    """Equirectangular projection around one centre point.

    The error stays far under a metre for the map sizes this plugin builds (a few
    kilometres at most), which is the same method the NORD Unreal map uses.
    """

    def __init__(self, lat: float, lon: float):
        self.lat = float(lat)
        self.lon = float(lon)
        self._kx = EARTH_M_PER_DEG * math.cos(math.radians(self.lat))

    def xy(self, lat: float, lon: float) -> Point:
        return ((lon - self.lon) * self._kx, (lat - self.lat) * EARTH_M_PER_DEG)

    def latlon(self, x: float, y: float) -> tuple[float, float]:
        return (self.lat + y / EARTH_M_PER_DEG, self.lon + x / self._kx)

    def bbox(self, half_size_m: float) -> tuple[float, float, float, float]:
        """Return (south, west, north, east) in degrees for a square around the centre."""
        s, w = self.latlon(-half_size_m, -half_size_m)
        n, e = self.latlon(half_size_m, half_size_m)
        return (s, w, n, e)


def signed_area(ring: Sequence[Point]) -> float:
    a = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return a / 2.0


def centroid(ring: Sequence[Point]) -> Point:
    a = signed_area(ring)
    if abs(a) < 1e-9:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    cx = cy = 0.0
    n = len(ring)
    for i in range(n):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % n]
        f = x0 * y1 - x1 * y0
        cx += (x0 + x1) * f
        cy += (y0 + y1) * f
    return (cx / (6 * a), cy / (6 * a))


def clean_ring(points: Iterable[Point], min_gap: float = 0.05) -> list[Point]:
    """Drop repeated points and the closing point, so a ring is ready to use."""
    out: list[Point] = []
    for p in points:
        if not out or math.dist(out[-1], p) > min_gap:
            out.append((float(p[0]), float(p[1])))
    if len(out) > 1 and math.dist(out[0], out[-1]) <= min_gap:
        out.pop()
    return out


def ccw(ring: list[Point]) -> list[Point]:
    """Return the ring in counter-clockwise order (positive area)."""
    return ring if signed_area(ring) >= 0 else ring[::-1]


def simplify(points: Sequence[Point], tolerance: float) -> list[Point]:
    """Douglas-Peucker simplification of an open polyline."""
    if len(points) < 3 or tolerance <= 0:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy)
        best, best_i = -1.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if length < 1e-9:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / length
            if d > best:
                best, best_i = d, i
        if best > tolerance and best_i > 0:
            keep[best_i] = True
            stack.append((a, best_i))
            stack.append((best_i, b))
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(ring: Sequence[Point], tolerance: float) -> list[Point]:
    if len(ring) < 5 or tolerance <= 0:
        return list(ring)
    closed = list(ring) + [ring[0]]
    out = simplify(closed, tolerance)[:-1]
    return out if len(out) >= 3 else list(ring)


def clip_segment(a: Point, b: Point, box: tuple[float, float, float, float]) -> Optional[tuple[Point, Point]]:
    """Liang-Barsky clip of segment a-b to box (minx, miny, maxx, maxy)."""
    lo, hi = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] - box[0]), (dx, box[2] - a[0]), (-dy, a[1] - box[1]), (dy, box[3] - a[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return None
        else:
            t = q / p
            if p < 0:
                lo = max(lo, t)
            else:
                hi = min(hi, t)
            if lo > hi:
                return None
    return ((a[0] + lo * dx, a[1] + lo * dy), (a[0] + hi * dx, a[1] + hi * dy))


def clip_polyline(points: Sequence[Point], box: tuple[float, float, float, float]) -> list[list[Point]]:
    """Clip a polyline to a box. A line that leaves and comes back gives several pieces."""
    pieces: list[list[Point]] = []
    current: list[Point] = []
    for a, b in zip(points, points[1:]):
        seg = clip_segment(a, b, box)
        if seg is None:
            if len(current) > 1:
                pieces.append(current)
            current = []
            continue
        s, e = seg
        if current and math.dist(current[-1], s) < 1e-6:
            current.append(e)
        else:
            if len(current) > 1:
                pieces.append(current)
            current = [s, e]
        if math.dist(e, b) > 1e-6:  # left the box during this segment
            pieces.append(current)
            current = []
    if len(current) > 1:
        pieces.append(current)
    return pieces


def clip_ring(ring: Sequence[Point], box: tuple[float, float, float, float]) -> list[Point]:
    """Sutherland-Hodgman clip of a polygon ring to box (minx, miny, maxx, maxy)."""
    def clip(points: list[Point], inside, cut) -> list[Point]:
        if not points:
            return []
        out: list[Point] = []
        prev = points[-1]
        for cur in points:
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
            prev = cur
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) or 1e-12))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) or 1e-12), y)

    pts = list(ring)
    pts = clip(pts, lambda p: p[0] >= box[0], at_x(box[0]))
    pts = clip(pts, lambda p: p[0] <= box[2], at_x(box[2]))
    pts = clip(pts, lambda p: p[1] >= box[1], at_y(box[1]))
    pts = clip(pts, lambda p: p[1] <= box[3], at_y(box[3]))
    return clean_ring(pts)


def point_in_ring(p: Point, ring: Sequence[Point]) -> bool:
    x, y = p
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def _cross(o: Point, a: Point, b: Point) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _in_triangle(p: Point, a: Point, b: Point, c: Point) -> bool:
    return _cross(a, b, p) >= -1e-9 and _cross(b, c, p) >= -1e-9 and _cross(c, a, p) >= -1e-9


def triangulate(ring: Sequence[Point]) -> list[int]:
    """Ear-clipping triangulation of a simple polygon.

    Returns a flat list of indices into ``ring``, three per triangle, all
    counter-clockwise. A ring that is not simple (self-touching OSM data) can
    trap the ear search; in that case the rest of the ring is closed with a fan
    so the shape still renders.
    """
    n = len(ring)
    if n < 3:
        return []
    idx = list(range(n))
    if signed_area(ring) < 0:
        idx.reverse()
    out: list[int] = []
    guard = 0
    i = 0
    while len(idx) > 3 and guard < 4 * n * n:
        guard += 1
        m = len(idx)
        a, b, c = idx[(i - 1) % m], idx[i % m], idx[(i + 1) % m]
        pa, pb, pc = ring[a], ring[b], ring[c]
        if _cross(pa, pb, pc) > 1e-9:
            ear = True
            for j in idx:
                if j in (a, b, c):
                    continue
                if _in_triangle(ring[j], pa, pb, pc):
                    ear = False
                    break
            if ear:
                out.extend((a, b, c))
                idx.pop(i % m)
                i = max(i - 1, 0)
                continue
        elif abs(_cross(pa, pb, pc)) <= 1e-9:
            idx.pop(i % m)  # collinear point: no area to keep
            i = max(i - 1, 0)
            continue
        i = (i + 1) % len(idx)
        if guard > 2 * n * n:  # no ear found: fall back to a fan for the rest
            break
    if len(idx) >= 3:
        for k in range(1, len(idx) - 1):
            out.extend((idx[0], idx[k], idx[k + 1]))
    return out


def join_ways(ways: list[list[Point]], tol: float = 0.05) -> list[list[Point]]:
    """Join open ways that share end points into closed rings (OSM multipolygons)."""
    rings: list[list[Point]] = []
    pending = [list(w) for w in ways if len(w) >= 2]
    while pending:
        ring = pending.pop(0)
        changed = True
        while changed and math.dist(ring[0], ring[-1]) > tol:
            changed = False
            for k, w in enumerate(pending):
                if math.dist(ring[-1], w[0]) <= tol:
                    ring.extend(w[1:])
                elif math.dist(ring[-1], w[-1]) <= tol:
                    ring.extend(w[-2::-1])
                elif math.dist(ring[0], w[-1]) <= tol:
                    ring[:0] = w[:-1]
                elif math.dist(ring[0], w[0]) <= tol:
                    ring[:0] = w[:0:-1]
                else:
                    continue
                pending.pop(k)
                changed = True
                break
        cleaned = clean_ring(ring)
        if len(cleaned) >= 3:
            rings.append(cleaned)
    return rings


def distance_to_segment(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy
    if l2 < 1e-12:
        return math.dist(p, a)
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    return math.dist(p, (a[0] + t * dx, a[1] + t * dy))
