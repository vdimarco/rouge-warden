"""A surveyed bag pile and a fire hydrant, close enough to read.

The Sherbrooke eye leaves the nearest pair about 100 m down the avenue, a few
pixels tall. This look stands on the wide road where a bag pile and a hydrant
are about 4 m apart. The opening aim stays.
"""
import math

ROAD = 61
BIN = (35394.46, -24048.46, 7.0)
HYDRANT = (35624.11, -23688.59, 18.0)
YAW_PROP = 172.27
EYE_BACK_CM = 420.0
EYE_TOWARD_CM = 860.0
EYE_Z_CM = 140.0
PITCH = -14.0


def _closest(road, point):
    best = None
    for index in range(len(road) - 1):
        ax, ay = road[index][0], road[index][1]
        bx, by = road[index + 1][0], road[index + 1][1]
        dx, dy = bx - ax, by - ay
        length = math.hypot(dx, dy)
        if length < 1.0:
            continue
        t = ((point[0] - ax) * dx + (point[1] - ay) * dy) / (length * length)
        t = max(0.0, min(1.0, t))
        qx, qy = ax + dx * t, ay + dy * t
        dist = math.hypot(point[0] - qx, point[1] - qy)
        if best is None or dist < best[0]:
            best = (dist, qx, qy, dx / length, dy / length)
    return best


def curb_look(road):
    """Eye on the sidewalk side of the bag pile, looking along the road."""
    _dist, qx, qy, fx, fy = _closest(road, BIN)
    rx, ry = -fy, fx
    lateral = (BIN[0] - qx) * rx + (BIN[1] - qy) * ry
    toward = math.copysign(EYE_TOWARD_CM, lateral)
    eye = (
        qx + fx * -EYE_BACK_CM + rx * toward,
        qy + fy * -EYE_BACK_CM + ry * toward,
        EYE_Z_CM,
    )
    yaw = math.degrees(math.atan2(fy, fx))
    return {"eye": eye, "yaw": yaw, "pitch": PITCH, "bin": BIN, "hydrant": HYDRANT}
