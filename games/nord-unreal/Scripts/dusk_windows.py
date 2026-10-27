"""How many warm panes a dusk wall carries.

The afternoon leaves a wall dark, with the street lamps. A wall shorter than
five metres, or lower than four and a half, stays blank. Consecutive footprint
edges that face the same way are one wall, so a facade split into two short
pieces still counts.
"""

import math


def window_grid(length_cm, height_cm, lamps):
    if not lamps or height_cm < 450 or length_cm < 500:
        return 0, 0
    cols = min(8, int(length_cm // 280))
    rows = min(4, int((height_cm - 180) // 240))
    if cols < 1 or rows < 1:
        return 0, 0
    return cols, rows


def facade_runs(points):
    """Join consecutive ring edges whose directions agree.

    Returns (start_xy, end_xy, length_cm) for each run. A turn starts a new run.
    """
    count = len(points)
    edges = []
    for i in range(count):
        p = points[i]
        q = points[(i + 1) % count]
        dx, dy = q[0] - p[0], q[1] - p[1]
        length = math.hypot(dx, dy)
        if length < 1.0:
            continue
        edges.append((p, q, dx / length, dy / length, length))
    if not edges:
        return []
    runs = []
    start, end, dx, dy, length = edges[0]
    for p, q, ndx, ndy, nlen in edges[1:]:
        if dx * ndx + dy * ndy > 0.999:
            end = q
            length += nlen
        else:
            runs.append((start, end, length))
            start, end, dx, dy, length = p, q, ndx, ndy, nlen
    runs.append((start, end, length))
    if len(runs) > 1:
        s0, e0, l0 = runs[0]
        s1, e1, l1 = runs[-1]
        d0 = (e0[0] - s0[0], e0[1] - s0[1])
        d1 = (e1[0] - s1[0], e1[1] - s1[1])
        n0, n1 = math.hypot(*d0), math.hypot(*d1)
        same = n0 > 1 and n1 > 1 and (d0[0] / n0) * (d1[0] / n1) + (d0[1] / n0) * (d1[1] / n1) > 0.999
        if same and math.hypot(e1[0] - s0[0], e1[1] - s0[1]) < 5:
            runs[0] = (s1, e0, l0 + l1)
            runs.pop()
    return runs
