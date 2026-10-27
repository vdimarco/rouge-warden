"""How many warm panes a dusk wall carries, and the border around each one.

The afternoon leaves a wall dark, with the street lamps. A wall shorter than
five metres, or lower than four and a half, stays blank. Consecutive footprint
edges that face the same way are one wall, so a facade split into two short
pieces still counts. The sash is a darker rectangle ten centimetres past the glass.
A bar six centimetres tall sits across the middle of the glass.
An upright bar of the same thickness splits that glass the other way.
Each pane is its own room: some are dark, and the lit ones are not one lamp.
"""

import math


GLASS_HALF_ALONG_CM = 36.0
GLASS_HALF_UP_CM = 55.0
SASH_CM = 10.0
GLASS_OUT_CM = 7.0
SASH_OUT_CM = 4.0
MUNTIN_HALF_UP_CM = 6.0
MULLION_HALF_ALONG_CM = 6.0


def pane_light(column, row, salt):
    """One dusk window. Some rooms are dark, and the lit ones are not one lamp."""
    mix = (int(salt) * 131 + int(column) * 17 + int(row) * 29) & 0x7FFFFFFF
    if mix % 100 < 22:
        return (0.08, 0.06, 0.05, False)
    warm = ((mix // 7) % 100) / 100.0
    bright = 0.40 + ((mix // 13) % 100) / 100.0 * 0.60
    red = (1.0 - 0.45 * warm) * bright
    green = (0.62 + 0.16 * warm) * bright
    blue = (0.28 + 0.62 * warm) * bright
    return (red, green, blue, True)


def sash_box():
    """The warm glass, then the darker border that sits on the wall behind it."""
    return (
        GLASS_HALF_ALONG_CM,
        GLASS_HALF_UP_CM,
        GLASS_HALF_ALONG_CM + SASH_CM,
        GLASS_HALF_UP_CM + SASH_CM,
    )


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
