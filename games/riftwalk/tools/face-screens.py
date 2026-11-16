"""For a zone of Riftwalk whose screens measure poorly (small, far, or dim screens give a noisy tilt): rebuild every
screen as a rectangle that faces the capture point, at the distance place-screens.mjs measured. From the capture point
the rectangle covers the same view rays as the measured corners, so the portal still sits on the screen. Its tilt is
not the cabinet's own, which shows a little when the visitor walks.
Usage: python3 games/riftwalk/tools/face-screens.py <screens.json>   (rewrites the file; needs numpy)"""
import json, math, sys
import numpy as np

path = sys.argv[1]; data = json.load(open(path)); eye = np.array([0.0, data['hall']['ground'], 0.0])
unit = lambda v: v / np.linalg.norm(v)
for s in data['screens']:
    rays = [unit(np.array(c) - eye) for c in s['corners']]            # top-left, top-right, bottom-right, bottom-left
    aim = unit(sum(rays)); normal = -aim
    up = unit(np.array([0.0, 1.0, 0.0]) - normal[1] * normal); right = np.cross(up, normal)
    tl, tr, br, bl = [eye + r * s['distance'] / float(r @ aim) for r in rays]
    width = (abs((tr - tl) @ right) + abs((br - bl) @ right)) / 2; height = (abs((tl - bl) @ up) + abs((tr - br) @ up)) / 2
    centre = (tl + tr + br + bl) / 4; h = [right * width / 2, up * height / 2]
    s.update(centre=centre.round(4).tolist(), right=right.round(5).tolist(), up=up.round(5).tolist(), normal=normal.round(5).tolist(), width=round(float(width), 4), height=round(float(height), 4),
             heading=round(math.atan2(centre[0], -centre[2]), 5), distance=round(float(np.linalg.norm(centre - eye)), 4), square=0.0, faced=True,
             corners=[(centre + a * h[0] + b * h[1]).round(4).tolist() for a, b in ((-1, 1), (1, 1), (1, -1), (-1, -1))])
data['screens'].sort(key=lambda s: s['heading'])
json.dump(data, open(path, 'w'), separators=(',', ':'))
print(len(data['screens']), 'screens now face the capture point')
