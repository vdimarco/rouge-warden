"""Where the Sherbrooke frame puts moving traffic and sidewalk walkers.

The lane offset is QuebecTraffic::CurbLane. The sidewalk is the road's half
width plus the 150 cm the population spawn uses. The Marie-Anne corner looks
into a facade, so this frame stands on Rue Sherbrooke Est, the wide road
nearest the spawn, and looks along it. The opening aim stays.
"""

import math


LANE_CM = 145.0
SIDEWALK_PAST_CURB_CM = 150.0
SHERBROOKE = 63
# Past the starter, so the look is down the avenue and the starter is behind the eye.
ALONG_PAST_STARTER_CM = 1400.0
EYE_BACK_CM = 180.0
EYE_LATERAL_CM = -420.0
EYE_Z_CM = 155.0
PITCH = -12.0


def _basis(road):
    start = road[0]
    end = road[1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    forward = (dx / length, dy / length)
    right = (-forward[1], forward[0])
    yaw = math.degrees(math.atan2(forward[1], forward[0]))
    return start, forward, right, yaw


def _point(start, forward, right, along, lateral, z):
    return (
        start[0] + forward[0] * along + right[0] * lateral,
        start[1] + forward[1] * along + right[1] * lateral,
        z,
    )


def sherb_along(road, starter_xy):
    start, forward, _right, _yaw = _basis(road)
    return (starter_xy[0] - start[0]) * forward[0] + (starter_xy[1] - start[1]) * forward[1]


def sidewalk_cm(width_cm):
    return width_cm * 0.5 + SIDEWALK_PAST_CURB_CM


def street_population(road, width_cm, starter_xy):
    """Cars in the two lanes, and walkers on both sidewalks, ahead of the eye."""
    start, forward, right, yaw = _basis(road)
    base = sherb_along(road, starter_xy) + ALONG_PAST_STARTER_CM
    side = sidewalk_cm(width_cm)
    cars = (
        {"along": base + 850.0, "lateral": -LANE_CM, "yaw": yaw + 180.0, "paint": 1, "body": 1},
        {"along": base + 1900.0, "lateral": LANE_CM, "yaw": yaw, "paint": 2, "body": 0},
        {"along": base + 3100.0, "lateral": -LANE_CM, "yaw": yaw + 180.0, "paint": 3, "body": 2},
    )
    walkers = (
        {"along": base + 420.0, "lateral": -side, "yaw": yaw, "phase": 0.22},
        {"along": base + 1100.0, "lateral": -side, "yaw": yaw + 180.0, "phase": 0.62},
        {"along": base + 1900.0, "lateral": side, "yaw": yaw, "phase": 0.40},
    )
    eye = _point(start, forward, right, base - EYE_BACK_CM, EYE_LATERAL_CM, EYE_Z_CM)
    return {"yaw": yaw, "pitch": PITCH, "eye": eye, "cars": cars, "walkers": walkers}
