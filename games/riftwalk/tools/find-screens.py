"""Finds the arcade screens in a Marble panorama, for Riftwalk.
A screen in the hall's prompt is a plain bright patch with no picture. This script finds each bright, grey, roughly
four-sided patch near eye level in the equirectangular panorama, and writes its four corners and a spread of its
pixels as compass angles: lon (radians, 0 at the middle of the picture, positive to the right) and lat (radians,
positive up).
The second tool, place-screens.mjs, turns those angles into places in the hall.
Usage: python3 games/riftwalk/tools/find-screens.py <pano.png> <corners.json> [overlay.jpg] [level] [top]   (needs Pillow, numpy)
level is the least brightness of a screen, 0 to 1. Without it, the script takes a level from the panorama itself."""
import os, json, math, sys
import numpy as np
from PIL import Image, ImageDraw

pano_path, out_path = sys.argv[1], sys.argv[2]
overlay_path = sys.argv[3] if len(sys.argv) > 3 else None
full = Image.open(pano_path).convert('RGB')
W, H = 1536, 768                      # work size: a screen is tens of pixels wide here
small = np.asarray(full.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
# Join the left edge to the right edge, so a screen that sits on the seam is one patch.
PAD = W // 8
img = np.concatenate([small, small[:, :PAD]], axis=1)
mx, mn = img.max(axis=2), img.min(axis=2)
bright, grey = mx, (mx - mn)
def convex_hull(points):
    """Andrew's monotone chain. points: an array of (x, y). Returns the hull's corners in order."""
    p = sorted(set(map(tuple, points)))
    if len(p) < 3: return np.array(p)
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for q in p:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], q) <= 0: lower.pop()
        lower.append(q)
    for q in reversed(p):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], q) <= 0: upper.pop()
        upper.append(q)
    return np.array(lower[:-1] + upper[:-1])

lat_of = lambda y: (0.5 - (y + 0.5) / H) * math.pi
lon_of = lambda x: (((x + 0.5) / W) % 1.0 - 0.5) * 2 * math.pi
rows = np.arange(H)[:, None]
near_level = np.abs((0.5 - (rows + 0.5) / H) * math.pi) < math.radians(40)
# The level is relative: brighter than most of this panorama, and nearly without colour.
level = float(sys.argv[4]) if len(sys.argv) > 4 else max(0.62, float(np.quantile(bright, 0.93)))
# top, when given, is the most brightness of a screen: for a world whose screens are dim grey glass, not white.
top = float(sys.argv[5]) if len(sys.argv) > 5 else 2.0
seed = (bright > level) & (bright < top) & (grey < (0.16 if top > 1 else 0.07)) & near_level
# A screen can carry a tint from a neon tube near it. Pixels a little dimmer or a little coloured count as screen when
# they join a patch that has plain bright pixels in it.
mask = (bright > level * 0.86) & (bright < top * 1.1) & (grey < (0.30 if top > 1 else 0.10)) & near_level

# Patches of joined pixels (4 neighbours), with a plain stack: no scipy here.
seen = np.zeros_like(mask, dtype=bool); patches = []
ys, xs = np.nonzero(mask)
for y0, x0 in zip(ys.tolist(), xs.tolist()):
    if seen[y0, x0]: continue
    stack, pts = [(y0, x0)], []; seen[y0, x0] = True
    while stack:
        y, x = stack.pop(); pts.append((y, x))
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W + PAD and mask[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; stack.append((ny, nx))
    patches.append(np.array(pts))

screens = []
for pts in patches:
    y, x = pts[:, 0], pts[:, 1]; w, h = x.max() - x.min() + 1, y.max() - y.min() + 1; area = len(pts)
    if not seed[y, x].any() or seed[y, x].mean() < 0.35: continue      # a tinted patch with no plain bright part
    if area < 90 or w < 9 or h < 9: continue                       # too small to be a screen
    if w > W * 0.2 or h > H * 0.35: continue                       # a lamp, a window or a wall of light
    if area / (w * h) < 0.62: continue                             # not a filled four-sided patch
    if not 0.45 <= w / h <= 2.6: continue
    if x.min() >= W: continue                                      # the copy of a patch that sits in the padding
    if lat_of(y.mean()) < math.radians(float(os.environ.get('MIN_LAT', -18))): continue   # under the cabinets: a reflection in the floor. MIN_LAT raises the cut, for cabinets with a second panel under the screen
    # Corners: the four points of the patch's outline that span the largest four-sided shape. A screen seen at an angle
    # is a slanted four-sided patch, and this finds its true corners where a box or a diagonal would cut them.
    hull = convex_hull(pts[:, ::-1].astype(float))                 # (x, y) points, counter-clockwise
    if len(hull) > 28: hull = hull[np.linspace(0, len(hull) - 1, 28).round().astype(int)]
    best, n = None, len(hull)
    tri = lambda a, b, c: abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
    for a in range(n):
        for b in range(a + 1, n):
            for c2 in range(b + 1, n):
                for d2 in range(c2 + 1, n):
                    q = tri(hull[a], hull[b], hull[c2]) + tri(hull[a], hull[c2], hull[d2])
                    if best is None or q > best[0]: best = (q, (a, b, c2, d2))
    if best is None or best[0] < area * 0.7: continue                # the patch is not four-sided
    four = [hull[k] for k in best[1]]
    # Name the corners: the two upper ones (smaller y) and the two lower ones, each pair left to right.
    four.sort(key=lambda p: p[1]); top, bottom = sorted(four[:2], key=lambda p: p[0]), sorted(four[2:], key=lambda p: p[0])
    tl, tr, br, bl = [(p[1], p[0]) for p in (top[0], top[1], bottom[1], bottom[0])]
    # A spread of the patch's own pixels, for the tool that finds the screen's tilt from its whole shape.
    some = pts[:: max(1, len(pts) // 500)]
    screens.append({'px': [[float(p[1]), float(p[0])] for p in (tl, tr, br, bl)], 'some': [[int(p[1]), int(p[0])] for p in some], 'area': int(area), 'cx': float(x.mean()) % W})
# A patch on the seam was found twice, once at each end: keep one for each centre.
screens.sort(key=lambda s: s['cx']); kept = []
for s in screens:
    if kept and abs(s['cx'] - kept[-1]['cx']) < 6: continue
    kept.append(s)
if len(kept) > 1 and abs(kept[0]['cx'] + W - kept[-1]['cx']) < 6: kept.pop()
out = [{'corners': [[round(lon_of(px), 5), round(lat_of(py), 5)] for px, py in s['px']], 'points': [[round(lon_of(px), 4), round(lat_of(py), 4)] for px, py in s['some']], 'pixel': round(2 * math.pi / W, 6), 'area': s['area']} for s in kept]
json.dump({'pano': [full.width, full.height], 'order': 'top-left, top-right, bottom-right, bottom-left; [lon, lat] in radians', 'screens': out}, open(out_path, 'w'), indent=1)
print(len(out), 'screens; bright level', round(level, 3))
if overlay_path:
    view = Image.fromarray((small * 255).astype(np.uint8)); d = ImageDraw.Draw(view)
    for i, s in enumerate(kept):
        q = [(px % W, py) for px, py in s['px']]
        if max(p[0] for p in q) - min(p[0] for p in q) < W / 2: d.polygon(q, outline=(0, 255, 0))
        d.text((q[0][0], q[0][1] - 11), str(i), fill=(255, 255, 0))
    view.save(overlay_path, quality=90)
