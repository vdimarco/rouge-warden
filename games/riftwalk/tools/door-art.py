"""Makes the picture a rift door shows for one zone of Riftwalk: a view into that zone from its capture point,
looking at its front machine, cut from the zone's panorama.
Usage: python3 games/riftwalk/tools/door-art.py <pano.png> <door.webp> [heading in degrees]   (needs numpy and Pillow)"""
import sys
import numpy as np
from PIL import Image

pano = np.asarray(Image.open(sys.argv[1]).convert('RGB')); H, W = pano.shape[:2]
heading = np.radians(float(sys.argv[3])) if len(sys.argv) > 3 else 0.0
w, h, fov = 512, 1024, np.radians(84)            # a tall door, twice as high as wide
f = (h / 2) / np.tan(fov / 2)
x, y = np.meshgrid(np.arange(w) - w / 2 + 0.5, h / 2 - np.arange(h) - 0.5)
lon = heading + np.arctan2(x, f); lat = np.arctan2(y, np.hypot(x, f))
# The panorama's middle column is heading 0, and its top row is straight up.
u = ((lon / (2 * np.pi) + 0.5) % 1.0) * W; v = (0.5 - lat / np.pi) * H
out = pano[np.clip(v.astype(int), 0, H - 1), np.clip(u.astype(int), 0, W - 1)]
Image.fromarray(out).save(sys.argv[2], 'WEBP', quality=80, method=6)
print('wrote', sys.argv[2])
