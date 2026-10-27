"""Soft shadows and ambient occlusion for the offline shade.

The penumbra follows the solar disk in QuebecContact.h. A blocker far above the
ground throws a wider edge than one at the contact. Occlusion darkens a pixel
whose neighbour is closer.
"""
import math

import numpy as np

SUN_DISK_DEGREES = 3.0
CONTACT_CM = 45.0
AO_INTENSITY = 0.65
SHADOW_FLOOR = 0.57


def penumbra_cm(gap_cm):
    half = math.radians(SUN_DISK_DEGREES * 0.5)
    return CONTACT_CM + math.tan(half) * np.maximum(0.0, np.asarray(gap_cm, dtype=np.float64))


def _smooth(edge0, edge1, value):
    span = np.maximum(edge1 - edge0, 1e-4)
    t = np.clip((value - edge0) / span, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def convex_hull(points):
    pts = np.unique(np.round(np.asarray(points, dtype=np.float64), 3), axis=0)
    if len(pts) < 3:
        return pts
    pts = pts[np.lexsort((pts[:, 1], pts[:, 0]))]

    def chain(seq):
        hull = []
        for point in seq:
            while len(hull) >= 2:
                a, b = hull[-2], hull[-1]
                if (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]) <= 0:
                    hull.pop()
                else:
                    break
            hull.append(point)
        return hull[:-1]

    return np.array(chain(pts) + chain(reversed(pts)))


def _signed_distance(points, poly):
    sd = np.full(len(points), -1e9)
    for index in range(len(poly)):
        a = poly[index]
        b = poly[(index + 1) % len(poly)]
        edge = b - a
        length = float(np.hypot(edge[0], edge[1]))
        if length < 1e-4:
            continue
        outward = np.array([edge[1], -edge[0]]) / length
        sd = np.maximum(sd, (points - a) @ outward)
    return sd


def building_shadow(footprint, height_cm, sun):
    base = np.asarray(footprint, dtype=np.float64)
    if sun[2] < 0.08:
        return convex_hull(base)
    shift = np.array([-sun[0], -sun[1]]) / sun[2] * float(height_cm)
    return convex_hull(np.vstack((base, base + shift)))


def shadow_light(points, poly, gap_cm):
    if len(poly) < 3:
        return np.ones(len(points))
    return _smooth(0.0, penumbra_cm(gap_cm), _signed_distance(points, poly))


def capsule_light(points, base_xy, height_cm, radius_cm, sun):
    base = np.asarray(base_xy, dtype=np.float64)
    if sun[2] < 0.08 or height_cm <= 1.0:
        dist = np.linalg.norm(points - base, axis=1) - radius_cm
        return _smooth(0.0, CONTACT_CM, dist)
    shift = np.array([-sun[0], -sun[1]]) / sun[2] * float(height_cm)
    ab = shift
    length = float(ab @ ab)
    rel = points - base
    t = np.clip((rel @ ab) / length, 0.0, 1.0)
    closest = base + t[:, None] * ab
    dist = np.linalg.norm(points - closest, axis=1) - radius_cm
    return _smooth(0.0, penumbra_cm(t * height_cm), dist)


def combine_light(layers):
    light = np.ones(len(layers[0]))
    for layer in layers:
        light = np.minimum(light, layer)
    return light


def apply_light(colour, light):
    factor = SHADOW_FLOOR + (1.0 - SHADOW_FLOOR) * np.clip(light, 0.0, 1.0)
    return colour * factor[..., None]


def ambient_occlusion(colour, depth, radius_px=10):
    occ = np.zeros(depth.shape, dtype=np.float64)
    finite = np.isfinite(depth)
    samples = (
        (radius_px, 0), (-radius_px, 0), (0, radius_px), (0, -radius_px),
        (radius_px, radius_px), (-radius_px, radius_px), (radius_px, -radius_px), (-radius_px, -radius_px),
    )
    for dx, dy in samples:
        nearer = np.roll(np.roll(depth, dy, axis=0), dx, axis=1)
        farther = np.roll(np.roll(depth, -dy, axis=0), -dx, axis=1)
        with np.errstate(invalid="ignore"):
            closer = np.where(finite, depth - nearer, 0.0)
            opposite = np.where(finite, farther - depth, 0.0)
        # A smooth slope steps about the same both ways. A contact jumps one way.
        occ += (closer > 30.0) & (closer < 900.0) & (closer > opposite + 40.0) & finite
    occ /= float(len(samples))
    darkened = colour * (1.0 - AO_INTENSITY * occ[..., None])
    darkened[~finite] = colour[~finite]
    return darkened
