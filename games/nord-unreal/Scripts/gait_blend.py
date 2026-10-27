"""How the hoodie walk and the run share a speed.

Walk is 450 cm/s and sprint is 800. Between them the run's share rises from
0 to 1. The single-node player still cuts from one clip to the other.
"""

import math

import numpy as np

WALK_CM_PER_SECOND = 450.0
SPRINT_CM_PER_SECOND = 800.0


def walk_run_share(speed_cm_per_second):
    if speed_cm_per_second <= WALK_CM_PER_SECOND:
        return 0.0
    if speed_cm_per_second >= SPRINT_CM_PER_SECOND:
        return 1.0
    return (speed_cm_per_second - WALK_CM_PER_SECOND) / (SPRINT_CM_PER_SECOND - WALK_CM_PER_SECOND)


def slerp(a, b, weight):
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    dot = float(np.dot(a, b))
    if dot < 0.0:
        b = -b
        dot = -dot
    if dot > 0.9995:
        blended = a + weight * (b - a)
        return blended / np.linalg.norm(blended)
    theta = math.acos(min(1.0, dot))
    sine = math.sin(theta)
    return (math.sin((1.0 - weight) * theta) * a + math.sin(weight * theta) * b) / sine
