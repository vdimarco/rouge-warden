"""Make a scenery room from a Marble app splat export (.spz, version 2, y-up).

  python3 scenery-room.py <world.spz> <out dir> [turn in degrees]
  python3 scenery-room.py <world.spz> <out.spz> thin <count>       one smaller copy only

Writes full.spz, 500k.spz, 150k.spz, a rough door.webp (door-shots.mjs makes the real one), preview.jpg (four views from the
point where the visitor stands) and screens.json. These exports are metric with
the floor at y = 0, so the page sets the eye 1.45 m over the file's origin.
"""
import gzip, json, os, struct, sys
import numpy as np
from PIL import Image, ImageFilter

EYE = 1.45

def read(path):
    d = gzip.decompress(open(path, 'rb').read())
    magic, ver, n, sh, frac, flags, _ = struct.unpack('<IIIBBBB', d[:16])
    assert magic == 0x5053474E and ver == 2 and sh == 0, (magic, ver, sh)
    return d[:16], n, frac, np.frombuffer(d, np.uint8, offset=16)

def parts(body, n):
    o = 0; out = []
    for w in (9, 1, 3, 3, 3):
        out.append(body[o:o + n * w].reshape(n, w)); o += n * w
    return out  # positions, alphas, colours, scales, rotations

def positions(p, frac):
    v = p.reshape(-1, 3, 3).astype(np.int32)
    v = v[..., 0] | (v[..., 1] << 8) | (v[..., 2] << 16)
    v = np.where(v & 0x800000, v - 0x1000000, v)
    return v / float(1 << frac)

def write(path, head, n, cols):
    h = bytearray(head); struct.pack_into('<I', h, 8, n)
    with gzip.open(path, 'wb', compresslevel=6) as f:
        f.write(bytes(h)); [f.write(c.tobytes()) for c in cols]

def thin(head, cols, n, want, path):
    """A smaller copy. A random pick loses the large, solid splats that carry most of the picture, so the pick is
    weighted: a splat's chance grows with its opacity and, more gently, with its area. The kept splats grow a little
    to close the gaps."""
    if want >= n: write(path, head, n, cols); return
    alpha = cols[1][:, 0].astype(np.float64) / 255
    ls = np.sort(cols[3].astype(np.float64) / 16 - 10, axis=1)          # log scales, smallest first
    weight = (alpha + 0.02) * np.exp(0.35 * (ls[:, 1] + ls[:, 2]))      # opacity times area to the power 0.35
    weight /= weight.mean()
    keys = np.log(np.random.default_rng(7).random(n)) / weight         # Efraimidis and Spirakis: the largest keys win
    keep = np.sort(np.argpartition(keys, n - want)[n - want:])
    out = [c[keep].copy() for c in cols]
    grow = int(round(np.log(np.sqrt(n / want)) * 16 * 0.45))
    out[3] = np.clip(out[3].astype(np.int32) + grow, 0, 255).astype(np.uint8)
    write(path, head, want, out)

def view(xyz, rgb, yaw, size=(480, 400), fov=80, pitch=0.0):
    # file axes: +y up, the camera looks along -z at yaw 0, and a positive yaw turns to the right
    w, h = size; x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    c, s = np.cos(yaw), np.sin(yaw); cx = c * x + s * z; cz = -s * x + c * z; depth = -cz
    m = depth > 0.05; f = (w / 2) / np.tan(np.radians(fov) / 2)
    u = (cx[m] / depth[m]) * f + w / 2; v = h / 2 - (y[m] / depth[m]) * f
    ok = (u >= 0) & (u < w - 1) & (v >= 0) & (v < h - 1)
    u, v, d, col = u[ok].astype(int), v[ok].astype(int), depth[m][ok], rgb[m][ok]
    order = np.argsort(-d); img = np.zeros((h, w, 3), np.uint8)
    for du in (0, 1):
        for dv in (0, 1): img[v[order] + dv, u[order] + du] = col[order]
    return img

def main():
    if len(sys.argv) > 4 and sys.argv[3] == 'thin':   # scenery-room.py <world.spz> <out.spz> thin <count>
        head, n, frac, body = read(sys.argv[1]); thin(head, parts(body, n), n, int(sys.argv[4]), sys.argv[2]); print(sys.argv[2], sys.argv[4]); return
    src, out = sys.argv[1], sys.argv[2]; turn = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    os.makedirs(out, exist_ok=True)
    head, n, frac, body = read(src); cols = parts(body, n)
    xyz = positions(cols[0], frac)
    sh = (cols[2].astype(np.float32) / 255 - 0.5) / 0.15
    rgb = (np.clip(0.5 + 0.2820948 * sh, 0, 1) * 255).astype(np.uint8)
    solid = cols[1][:, 0] > 100
    low = float(np.percentile(xyz[solid, 1], 1))
    if abs(low) > 0.5: print('note: ground goes down to', round(low, 1), '(an open landscape); the visitor still stands at y = 0')
    eye = xyz[solid] - np.array([0, EYE, 0]); a = np.radians(turn)
    strip = np.concatenate([view(eye, rgb[solid], a + k * np.pi / 2, size=(480, 360), fov=90) for k in range(4)], axis=1)
    Image.fromarray(strip).save(os.path.join(out, 'preview.jpg'), quality=85)
    # the door picture is a point drawing: a median filter closes the gaps between the points
    Image.fromarray(view(eye, rgb[solid], a, size=(512, 512), fov=75)).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.8)).save(os.path.join(out, 'door.webp'), quality=82)
    write(os.path.join(out, 'full.spz'), head, n, cols)
    thin(head, cols, n, 500000, os.path.join(out, '500k.spz'))
    thin(head, cols, n, 150000, os.path.join(out, '150k.spz'))
    hall = {'scale': 1, 'ground': 0, 'eye': EYE, 'frames': True, 'flip': False, 'turn': round(a, 4)}
    note = 'A scenery room from a Marble app export: metric, y up, floor at y = 0. The page hangs one floating portal frame for each game. turn is the heading in the file that the visitor faces on arrival.'
    json.dump({'note': note, 'hall': hall, 'screens': []}, open(os.path.join(out, 'screens.json'), 'w'))
    print(os.path.basename(src), 'splats', n, 'lowest y', round(low, 3))

main()
