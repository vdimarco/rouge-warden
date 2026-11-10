"""Cut a 4x2 magenta-background pose sheet into trimmed, transparent sprites.

usage: slice_sheet.py <dir>/sheets/<id>.png   ->  <dir>/sprites/<id>/<pose>.png + meta.json
The arcade copy in public/lake-brawl/assets/sprites/ holds the same sprites converted to WebP.
Figures are found as connected blobs rather than by cell, so a limb that strays over a cell edge survives.
meta.json gives, per pose, the sprite size and the x of the feet inside it, in units of the idle height.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

POSES = ['idle', 'walk', 'punch', 'kick', 'special', 'block', 'hit', 'win']
OUT_H = 520  # px height of the idle sprite after scaling

def slice_sheet(path):
    cid = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(os.path.dirname(path), '..', 'sprites', cid); os.makedirs(out, exist_ok=True)
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    # distance from key colour: magenta has high r and b, low g
    key = np.minimum(r, b) - g
    alpha = np.clip((150 - key) / 60.0, 0, 1)          # soft edge between 90 and 150
    solid = ndimage.binary_opening(alpha > 0.5, iterations=2)
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(sizes)[::-1][:8]]
    if len(keep) < 8: raise SystemExit(f'{cid}: found only {len(keep)} figures')
    boxes = ndimage.find_objects(lab)
    H, W = alpha.shape
    figs = sorted(keep, key=lambda i: (boxes[i - 1][0].start + boxes[i - 1][0].stop > H, boxes[i - 1][1].start))
    # despill: pull the magenta cast out of edge pixels only
    edge = (alpha > 0) & ~ndimage.binary_erosion(alpha > 0.98, iterations=2)
    rgb = im.copy(); cap = np.where(edge, np.minimum(np.minimum(r, b), g + 25), 0)
    for c in (0, 2): rgb[..., c] = np.where(edge & (rgb[..., c] > g + 25), np.maximum(cap, g), rgb[..., c])
    rgba = np.dstack([rgb.clip(0, 255), alpha * 255]).astype(np.uint8)
    meta, scale = {}, None
    for pose, i in zip(POSES, figs):
        ys, xs = boxes[i - 1]
        cut = rgba[ys, xs].copy(); cut[..., 3] = np.where(lab[ys, xs] == i, cut[..., 3], 0)
        a = cut[..., 3] > 40
        rows = np.where(a.any(1))[0]; cols = np.where(a.any(0))[0]
        cut = cut[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]; a = cut[..., 3] > 40
        if scale is None: scale = OUT_H / cut.shape[0]
        h = cut.shape[0]; feet = np.where(a[int(h * 0.9):].any(0))[0]
        # standing foot: for the kick take the rear cluster, otherwise the middle of both feet
        fx = (feet.min() + feet.max()) / 2 if pose != 'kick' else float(np.median(feet[feet < feet.min() + (feet.max() - feet.min()) * 0.5 + 1]))
        img = Image.fromarray(cut, 'RGBA').resize((max(1, round(cut.shape[1] * scale)), max(1, round(h * scale))), Image.LANCZOS)
        img.save(os.path.join(out, pose + '.png'), optimize=True)
        meta[pose] = {'w': round(img.width / OUT_H, 4), 'h': round(img.height / OUT_H, 4), 'fx': round(fx * scale / OUT_H, 4)}
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'))
    return meta

if __name__ == '__main__':
    for p in sys.argv[1:]:
        m = slice_sheet(p); print(os.path.basename(p), {k: (v['w'], v['h']) for k, v in m.items()})
