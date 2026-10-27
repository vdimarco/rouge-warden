"""How many warm panes a dusk wall carries.

The afternoon leaves a wall dark, with the street lamps. A wall shorter than
five metres, or lower than four and a half, stays blank.
"""


def window_grid(length_cm, height_cm, lamps):
    if not lamps or height_cm < 450 or length_cm < 500:
        return 0, 0
    cols = min(8, int(length_cm // 280))
    rows = min(4, int((height_cm - 180) // 240))
    if cols < 1 or rows < 1:
        return 0, 0
    return cols, rows
