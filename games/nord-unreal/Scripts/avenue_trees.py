"""Park trees that continue the Sherbrooke planting strip past the near crowns.

The shade already draws crowns within 50 m of the eye. These are the surveyed
trees beside the same road, further along, still inside 90 m of the starter
stretch. The opening aim stays.
"""

import math

from street_life import ALONG_PAST_STARTER_CM, sherb_along

NEAR_CM = 5000.0
FAR_ALONG_CM = 9000.0
LATERAL_MIN_CM = 500.0
LATERAL_MAX_CM = 1600.0


def _basis(road):
    start = road[0]
    end = road[1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    forward = (dx / length, dy / length)
    right = (-forward[1], forward[0])
    return start, forward, right


def avenue_trees(trees, road, starter_xy, eye_xy):
    start, forward, right = _basis(road)
    base = sherb_along(road, starter_xy) + ALONG_PAST_STARTER_CM
    row = []
    for tree in trees:
        x, y = tree["xy"]
        if math.hypot(x - eye_xy[0], y - eye_xy[1]) <= NEAR_CM:
            continue
        along = (x - start[0]) * forward[0] + (y - start[1]) * forward[1]
        lateral = (x - start[0]) * right[0] + (y - start[1]) * right[1]
        if base < along < base + FAR_ALONG_CM and LATERAL_MIN_CM < abs(lateral) < LATERAL_MAX_CM:
            row.append(tree)
    return row
