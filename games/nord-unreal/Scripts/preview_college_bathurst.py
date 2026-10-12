"""Render a north-up plan and an oblique massing view of the College and Bathurst layout for review."""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import LineString, Polygon, box as rectangle

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT/'Data/CollegeBathurst'
OUT = ROOT/'Preview/CollegeBathurst'
GROUND, INK, PAPER = (226, 223, 214), (34, 32, 36), (250, 248, 242)
DEES, SPAWN, CAR, TRAM, LAMP = (226, 34, 120), (24, 150, 84), (36, 92, 200), (150, 28, 34), (246, 196, 40)
HALF = 30000  # Massing view half-size around the intersection, centimetres.


def font(size, bold=False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try: return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/' + name, size)
    except OSError: return ImageFont.load_default(size=size)


def ramp(height):
    """Low buildings pale sand, towers dark plum, over 0-40 m."""
    t = max(0., min(1., height/4000))
    low, mid, high = (238, 218, 178), (196, 120, 96), (74, 42, 70)
    a, b, f = (low, mid, t*2) if t < .5 else (mid, high, t*2 - 1)
    return tuple(int(a[i] + (b[i] - a[i])*f) for i in range(3))


def clipped(line, area):
    part = LineString(line).intersection(area)
    return [list(g.coords) for g in getattr(part, 'geoms', [part]) if g.geom_type == 'LineString' and not g.is_empty]


def shade(color, factor):
    return tuple(max(0, min(255, int(c*factor))) for c in color)


def plan(data):
    x0, y0, x1, y1 = data['bounds_cm']
    width = 2000; s = width/(x1 - x0); top, bottom = 84, 96
    height = int((y1 - y0)*s) + top + bottom
    image = Image.new('RGB', (width, height), PAPER); draw = ImageDraw.Draw(image)
    # North up, east right: image rows grow southward.
    P = lambda p: ((p[0] - x0)*s, top + (y1 - p[1])*s)
    draw.rectangle([P((x0, y1)), P((x1, y0))], fill=GROUND)
    for b in data['buildings']:
        if b['id'] != data['landmarks']['sneaky_dees']['osm'].split('/')[1]:
            draw.polygon([P(p) for p in b['footprint']], fill=ramp(b['height']), outline=shade(ramp(b['height']), .7))
    for line in data['paths']: draw.line([P(p) for p in line], fill=(190, 180, 160), width=2)
    for line, w in sorted(zip(data['roads'], data['road_widths']), key=lambda r: r[1]):
        draw.line([P(p) for p in line], fill=(98, 98, 104), width=max(2, round(w*s)), joint='curve')
    for track in data['tram_lines']: draw.line([P(p) for p in track['points']], fill=TRAM, width=2)
    for x, y in data['trees']: draw.ellipse([P((x - 250, y + 250)), P((x + 250, y - 250))], fill=(92, 150, 70))
    for x, y, _ in data['lamps']:
        cx, cy = P((x, y)); draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=LAMP, outline=INK)
    dees = data['landmarks']['sneaky_dees']
    draw.polygon([P(p) for p in dees['footprint']], fill=DEES, outline=INK, width=2)
    sx, sy = P(data['spawn']); draw.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=SPAWN, outline=INK, width=2)
    cx, cy = P(data['car']); yaw = math.radians(data['car_yaw'])
    tip = (cx + 16*math.cos(yaw), cy - 16*math.sin(yaw))
    left = (cx + 9*math.cos(yaw + 2.5), cy - 9*math.sin(yaw + 2.5)); right = (cx + 9*math.cos(yaw - 2.5), cy - 9*math.sin(yaw - 2.5))
    draw.polygon([tip, left, right], fill=CAR, outline=INK)
    ix, iy = P(data['landmarks']['intersection']['position'])
    draw.line([ix - 12, iy, ix + 12, iy], fill=INK, width=2); draw.line([ix, iy - 12, ix, iy + 12], fill=INK, width=2)
    label, small = font(20, True), font(15)
    dx, dy = P(dees['centroid'])
    draw.text((dx + 30, dy + 18), "Sneaky Dee's", font=label, fill=DEES, stroke_width=3, stroke_fill=PAPER)
    draw.text((sx + 14, sy + 4), 'spawn', font=small, fill=SPAWN, stroke_width=3, stroke_fill=PAPER)
    draw.text((cx + 14, cy - 24), 'car', font=small, fill=CAR, stroke_width=3, stroke_fill=PAPER)
    for name in ('College Street', 'Bathurst Street'):
        line = max((r for r, n in zip(data['roads'], data['road_names']) if n == name), key=len)
        a, b = P(line[0]), P(line[-1]); m = ((a[0] + b[0])/2, (a[1] + b[1])/2)
        draw.text((m[0] + 14, m[1] + 10), name, font=label, fill=INK, stroke_width=3, stroke_fill=PAPER)
    # North arrow, 100 m scale bar, height key and attribution.
    nx, ny = width - 56, top + 64
    draw.ellipse([nx - 34, ny - 54, nx + 34, ny + 32], fill=PAPER, outline=INK)
    draw.polygon([(nx, ny - 44), (nx - 13, ny - 4), (nx + 13, ny - 4)], fill=INK); draw.text((nx - 7, ny), 'N', font=label, fill=INK)
    bx, by = 30, height - bottom + 18
    draw.rectangle([bx, by, bx + 10000*s, by + 8], fill=INK); draw.text((bx + 10000*s + 10, by - 6), '100 m', font=small, fill=INK)
    for i in range(41):
        draw.rectangle([400 + i*8, by, 408 + i*8, by + 14], fill=ramp(i*100))
    draw.text((400, by + 18), '0 m', font=small, fill=INK); draw.text((400 + 280, by + 18), '40 m+', font=small, fill=INK)
    draw.text((400 + 90, by + 18), 'roof height', font=small, fill=INK)
    for i, (color, text) in enumerate([(TRAM, '506 / 511 track'), (LAMP, 'street lamp'), (SPAWN, 'spawn'), (CAR, 'car'), (DEES, "Sneaky Dee's")]):
        draw.rectangle([800 + i*200, by, 816 + i*200, by + 14], fill=color, outline=INK); draw.text((822 + i*200, by - 2), text, font=small, fill=INK)
    counts = data['counts']
    draw.text((20, 12), 'College St x Bathurst St, Toronto - plan, north up, east right', font=font(24, True), fill=INK)
    draw.text((20, 46), f"{counts['buildings']} buildings, {counts['roads']} road ways, {counts['tram_lines']} tram tracks, "
              f"{counts['lamps']} street lamps, {counts['trees']} trees, bounds {(x1 - x0)/100:.0f} x {(y1 - y0)/100:.0f} m", font=small, fill=INK)
    draw.text((20, height - 30), '  ·  '.join(data['attribution']), font=small, fill=INK)
    return image


def massing(data):
    """Axonometric view from the south-east, looking north-west over the intersection."""
    elevation = math.radians(38); forward, right = (-math.sqrt(.5), math.sqrt(.5)), (math.sqrt(.5), math.sqrt(.5))
    depth = lambda p: p[0]*forward[0] + p[1]*forward[1]
    raw = lambda p, z=0: (p[0]*right[0] + p[1]*right[1], -(depth(p)*math.sin(elevation) + z*math.cos(elevation)))
    cx, cy = data['landmarks']['intersection']['position']; bounds = data['bounds_cm']
    x0, y0, x1, y1 = max(bounds[0], cx - HALF), max(bounds[1], cy - HALF), min(bounds[2], cx + HALF), min(bounds[3], cy + HALF)
    area = rectangle(x0, y0, x1, y1)
    corners = [raw(p, z) for p in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)] for z in (0, 4000)]
    width, margin = 2000, 40
    s = (width - 2*margin)/(max(c[0] for c in corners) - min(c[0] for c in corners))
    ox, oy = min(c[0] for c in corners), min(c[1] for c in corners)
    height = int((max(c[1] for c in corners) - oy)*s) + 2*margin + 40
    P = lambda p, z=0: ((raw(p, z)[0] - ox)*s + margin, (raw(p, z)[1] - oy)*s + margin + 40)
    image = Image.new('RGB', (width, height), PAPER); draw = ImageDraw.Draw(image)
    draw.polygon([P(c) for c in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]], fill=GROUND)
    for line, w in zip(data['roads'], data['road_widths']):
        for part in clipped(line, area): draw.line([P(p) for p in part], fill=(110, 110, 116), width=max(1, round(w*s*.8)))
    for track in data['tram_lines']:
        for part in clipped(track['points'], area): draw.line([P(p) for p in part], fill=TRAM, width=2)
    dees_id = data['landmarks']['sneaky_dees']['osm'].split('/')[1]
    shown = [b for b in data['buildings'] if area.contains(Polygon(b['footprint']).centroid)]
    # Painter's order: farthest footprints first, each building's camera-facing walls then its roof.
    for b in sorted(shown, key=lambda b: -max(depth(p) for p in b['footprint'])):
        p, h = b['footprint'], b['height']
        base = DEES if b['id'] == dees_id else ramp(h)
        walls = []
        for a, c in zip(p, p[1:] + p[:1]):
            length = math.dist(a, c)
            if length < 1: continue
            normal = ((c[1] - a[1])/length, -(c[0] - a[0])/length)
            if normal[0]*forward[0] + normal[1]*forward[1] < 0:
                light = .62 + .3*max(0., normal[0]*-.6 + normal[1]*-.8)
                walls.append((-depth(((a[0] + c[0])/2, (a[1] + c[1])/2)), [P(a), P(c), P(c, h), P(a, h)], shade(base, light)))
        for _, quad, color in sorted(walls, key=lambda w: w[0]): draw.polygon(quad, fill=color, outline=shade(color, .75))
        draw.polygon([P(q, h) for q in p], fill=shade(base, 1.08), outline=shade(base, .7))
    sx, sy = P(data['spawn']); tx, ty = P(data['spawn'], 600)
    draw.line([sx, sy, tx, ty], fill=SPAWN, width=4); draw.ellipse([tx - 9, ty - 9, tx + 9, ty + 9], fill=SPAWN, outline=INK, width=2)
    dees = data['landmarks']['sneaky_dees']; lx, ly = P(dees['centroid'], dees['height'] + 900)
    label = font(20, True)
    draw.line([P(dees['centroid'], dees['height']), (lx, ly)], fill=INK, width=2)
    draw.text((lx - 60, ly - 28), "Sneaky Dee's", font=label, fill=DEES, stroke_width=3, stroke_fill=PAPER)
    for name, along in (('College Street', .2), ('Bathurst Street', .8)):
        line = max((r for r, n in zip(data['roads'], data['road_names']) if n == name), key=len)
        part = max(clipped(line, area), key=lambda q: LineString(q).length)
        q = LineString(part).interpolate(along, normalized=True); tx, ty = P((q.x, q.y))
        draw.text((tx - 80, ty + 14), name, font=label, fill=INK, stroke_width=3, stroke_fill=PAPER)
    draw.text((20, 14), f'College St x Bathurst St - massing within {HALF/100:.0f} m of the intersection, looking north-west',
              font=font(24, True), fill=INK)
    draw.text((20, height - 30), '  ·  '.join(data['attribution']), font=font(15), fill=INK)
    return image


def main():
    data = json.loads((DATA/'layout.json').read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    plan(data).save(OUT/'plan.png', optimize=True)
    massing(data).save(OUT/'massing.png', optimize=True)
    print('NORD_COLLEGE_BATHURST_PREVIEW', OUT/'plan.png', OUT/'massing.png')


if __name__ == '__main__':
    main()
