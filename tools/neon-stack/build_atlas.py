#!/usr/bin/env python3
"""
Procedural pixel-art texture atlas generator for Neon Stack.
Outputs to /workspace/art/neon-stack/:
  - neon-atlas.png  (1024x1024 indexed PNG, <= 200 KB, strict 8-colour + alpha palette)
  - neon-atlas.json ({"tile": 16, "frames": {name: {x, y, w, h}}})
  - atlas-preview.png (2x nearest-neighbour atlas + 390px-wide mock heist scene)
"""

import json
from pathlib import Path
from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "neon-stack" / "art"

# Strict palette: index 0 is transparent, indices 1..8 are the 8 allowed colours.
PALETTE_HEX = [
    None,       # 0: '.' transparent
    "#1A1A22",  # 1: 'K' dark ink / shadow / skyline / side_face
    "#2B2A33",  # 2: 'D' dark concrete / asphalt / sky / sign plate
    "#4A4852",  # 3: 'M' mid concrete / curb / frame / trousers
    "#8A8378",  # 4: 'L' light concrete lip / smog / steam
    "#FF3D8B",  # 5: 'P' neon magenta
    "#3DE0E8",  # 6: 'C' neon cyan
    "#B6F23A",  # 7: 'G' neon acid green
    "#F2A33A",  # 8: 'A' neon amber / lit window / hoodie
]

CHAR_TO_IDX = {
    ".": 0,
    "K": 1,
    "D": 2,
    "M": 3,
    "L": 4,
    "P": 5,
    "C": 6,
    "G": 7,
    "A": 8,
}

NEON_INDICES = {5, 6, 7, 8}


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


PALETTE_RGB = [(0, 0, 0)] + [hex_to_rgb(h) for h in PALETTE_HEX[1:]]


def make_indexed_canvas(w, h):
    img = Image.new("P", (w, h), 0)
    flat = []
    for rgb in PALETTE_RGB:
        flat.extend(rgb)
    flat.extend([0] * (768 - len(flat)))
    img.putpalette(flat)
    img.info["transparency"] = 0
    return img


def put_px(img, x, y, ch):
    idx = CHAR_TO_IDX[ch] if isinstance(ch, str) else ch
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), idx)


def fill_rect(img, x0, y0, w, h, ch):
    idx = CHAR_TO_IDX[ch] if isinstance(ch, str) else ch
    for yy in range(y0, y0 + h):
        for xx in range(x0, x0 + w):
            if 0 <= xx < img.width and 0 <= yy < img.height:
                img.putpixel((xx, yy), idx)


def blit_ascii(atlas, ox, oy, rows, remap=None):
    for r, line in enumerate(rows):
        for c, ch in enumerate(line):
            if ch == " ":
                continue
            if remap and ch in remap:
                ch = remap[ch]
            if ch == ".":
                continue
            put_px(atlas, ox + c, oy + r, ch)


def draw_ground(atlas, frames):
    def reg(name, x, y, w=16, h=16):
        frames[name] = {"x": x, "y": y, "w": w, "h": h}

    # Row 0: asphalt_0..3 (mostly flat #2B2A33 with very sparse subtle speckle)
    specks = [
        [(3, 4, "K"), (11, 2, "M"), (7, 11, "K"), (14, 13, "M")],
        [(2, 9, "M"), (9, 5, "K"), (10, 5, "K"), (5, 14, "M"), (13, 3, "K")],
        [(4, 3, "K"), (5, 4, "K"), (6, 5, "K"), (7, 5, "K"), (12, 11, "M"), (2, 13, "M")],
        [(1, 6, "M"), (8, 9, "K"), (13, 8, "M"), (6, 2, "K")],
    ]
    for i, sp in enumerate(specks):
        x = i * 16
        fill_rect(atlas, x, 0, 16, 16, "D")
        for sx, sy, ch in sp:
            put_px(atlas, x + sx, sy, ch)
        reg(f"asphalt_{i}", x, 0)

    # lane_dash (x=64, y=0)
    x = 64
    fill_rect(atlas, x, 0, 16, 16, "D")
    put_px(atlas, x + 7, 3, "M")
    put_px(atlas, x + 8, 3, "M")
    fill_rect(atlas, x + 7, 4, 2, 8, "L")
    put_px(atlas, x + 7, 12, "M")
    put_px(atlas, x + 8, 12, "M")
    put_px(atlas, x + 2, 7, "K")
    put_px(atlas, x + 13, 11, "M")
    reg("lane_dash", x, 0)

    def paint_sidewalk_base(ox, oy):
        fill_rect(atlas, ox, oy, 16, 16, "M")
        for k in range(16):
            put_px(atlas, ox + k, oy, "D")
            put_px(atlas, ox + k, oy + 8, "D")
            put_px(atlas, ox, oy + k, "D")
            put_px(atlas, ox + 8, oy + k, "D")
        for sx, sy in [(1, 1), (2, 1), (1, 2), (9, 1), (10, 1), (9, 2), (1, 9), (2, 9), (9, 9), (10, 9)]:
            put_px(atlas, ox + sx, oy + sy, "L")

    # curb_n
    x = 80
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 0, 16, 3, "D")
    fill_rect(atlas, x, 3, 16, 1, "K")
    fill_rect(atlas, x, 4, 16, 1, "L")
    put_px(atlas, x + 8, 4, "M")
    reg("curb_n", x, 0)

    # curb_s
    x = 96
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 11, 16, 1, "L")
    fill_rect(atlas, x, 12, 16, 1, "M")
    put_px(atlas, x + 8, 11, "M")
    put_px(atlas, x + 8, 12, "D")
    fill_rect(atlas, x, 13, 16, 1, "K")
    fill_rect(atlas, x, 14, 16, 2, "D")
    reg("curb_s", x, 0)

    # curb_e
    x = 112
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x + 11, 0, 1, 16, "L")
    fill_rect(atlas, x + 12, 0, 1, 16, "M")
    put_px(atlas, x + 11, 8, "M")
    put_px(atlas, x + 12, 8, "D")
    fill_rect(atlas, x + 13, 0, 1, 16, "K")
    fill_rect(atlas, x + 14, 0, 2, 16, "D")
    reg("curb_e", x, 0)

    # curb_w
    x = 128
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 0, 3, 16, "D")
    fill_rect(atlas, x + 3, 0, 1, 16, "K")
    fill_rect(atlas, x + 4, 0, 1, 16, "L")
    put_px(atlas, x + 4, 8, "M")
    reg("curb_w", x, 0)

    # curb_ne
    x = 144
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 0, 16, 3, "D")
    fill_rect(atlas, x + 14, 0, 2, 16, "D")
    fill_rect(atlas, x, 3, 13, 1, "K")
    fill_rect(atlas, x + 13, 4, 1, 12, "K")
    put_px(atlas, x + 12, 4, "K")
    fill_rect(atlas, x, 4, 12, 1, "L")
    fill_rect(atlas, x + 11, 5, 1, 11, "L")
    fill_rect(atlas, x + 12, 5, 1, 11, "M")
    put_px(atlas, x + 11, 4, "L")
    reg("curb_ne", x, 0)

    # curb_nw
    x = 160
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 0, 16, 3, "D")
    fill_rect(atlas, x, 0, 3, 16, "D")
    fill_rect(atlas, x + 4, 3, 12, 1, "K")
    fill_rect(atlas, x + 3, 4, 1, 12, "K")
    put_px(atlas, x + 4, 4, "L")
    fill_rect(atlas, x + 4, 4, 12, 1, "L")
    fill_rect(atlas, x + 4, 4, 1, 12, "L")
    reg("curb_nw", x, 0)

    # curb_se
    x = 176
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 14, 16, 2, "D")
    fill_rect(atlas, x + 14, 0, 2, 16, "D")
    fill_rect(atlas, x, 13, 13, 1, "K")
    fill_rect(atlas, x + 13, 0, 1, 13, "K")
    fill_rect(atlas, x, 11, 12, 1, "L")
    fill_rect(atlas, x, 12, 13, 1, "M")
    fill_rect(atlas, x + 11, 0, 1, 12, "L")
    fill_rect(atlas, x + 12, 0, 1, 13, "M")
    reg("curb_se", x, 0)

    # curb_sw
    x = 192
    paint_sidewalk_base(x, 0)
    fill_rect(atlas, x, 14, 16, 2, "D")
    fill_rect(atlas, x, 0, 3, 16, "D")
    fill_rect(atlas, x + 4, 13, 12, 1, "K")
    fill_rect(atlas, x + 3, 0, 1, 13, "K")
    fill_rect(atlas, x + 4, 0, 1, 12, "L")
    fill_rect(atlas, x + 4, 11, 12, 1, "L")
    fill_rect(atlas, x + 4, 12, 12, 1, "M")
    reg("curb_sw", x, 0)

    # sidewalk
    paint_sidewalk_base(208, 0)
    reg("sidewalk", 208, 0)

    # Row 1 (y=16): puddle_0..2 and grate
    puddle_0 = [
        "................",
        "................",
        "................",
        ".....MMMMMM.....",
        "...MMKKKKKKMM...",
        "..MKKKKKKKKKKM..",
        ".MKKKKKKKKKKKKM.",
        ".MKKKKKKKKKKKKM.",
        ".MKKKKKKKKKKKKM.",
        "..MKKKKKKKKKKM..",
        "...MMKKKKKKMM...",
        ".....MMMMMM.....",
        "................",
        "................",
        "................",
        "................",
    ]
    blit_ascii(atlas, 0, 16, puddle_0)
    reg("puddle_0", 0, 16)

    puddle_1 = [
        "................",
        "................",
        "................",
        "................",
        "...MMMMMMM......",
        "..MKKKKKKKMMM...",
        ".MKKKKKKKKKKKM..",
        ".MKKKKKKKKKKKKM.",
        ".MKKKKKKKKKKKKM.",
        "..MKKKKKKKKKKM..",
        "...MMMKKKKKKM...",
        "......MMMMMM....",
        "................",
        "................",
        "................",
        "................",
    ]
    blit_ascii(atlas, 16, 16, puddle_1)
    reg("puddle_1", 16, 16)

    puddle_2 = [
        "................",
        "................",
        "................",
        "....MMMM........",
        "..MMKKKKMM......",
        ".MKKKKKKKKM.....",
        ".MKKKKKKKKKMMM..",
        "..MKKKKKKKKKKKM.",
        "...MMKKKKKKKKKM.",
        ".....MMKKKKKKM..",
        ".......MMMMMM...",
        "................",
        "................",
        "................",
        "................",
        "................",
    ]
    blit_ascii(atlas, 32, 16, puddle_2)
    reg("puddle_2", 32, 16)

    grate = [
        "DDDDDDDDDDDDDDDD",
        "DMMMMMMMMMMMMMMD",
        "DMLLLLLLLLLLLLMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMMDDDDDDDDDDMMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMKDKKDKKDKKDKMD",
        "DMMMMMMMMMMMMMMD",
        "DKKKKKKKKKKKKKKD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
    ]
    blit_ascii(atlas, 48, 16, grate)
    reg("grate", 48, 16)


def draw_facades(atlas, frames):
    def reg(name, x, y, w=16, h=16):
        frames[name] = {"x": x, "y": y, "w": w, "h": h}

    wall_template = [
        "MMMMMMMMMMMMMMMM",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DMMMMDMMMMDMMMMD",
        "DM11MDM22MDM33MD",
        "DM11MDM22MDM33MD",
        "DM11MDM22MDM33MD",
        "DMMMMDMMMMDMMMMD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DMMMMDMMMMDMMMMD",
        "DM44MDM55MDM66MD",
        "DM44MDM55MDM66MD",
        "DM44MDM55MDM66MD",
        "DMMMMDMMMMDMMMMD",
        "KKKKKKKKKKKKKKKK",
    ]
    blit_ascii(atlas, 0, 32, wall_template, {"1": "K", "2": "K", "3": "K", "4": "K", "5": "K", "6": "K"})
    reg("wall_dark", 0, 32)

    blit_ascii(atlas, 16, 32, wall_template, {"1": "K", "2": "K", "3": "A", "4": "K", "5": "K", "6": "K"})
    reg("wall_lit1", 16, 32)

    blit_ascii(atlas, 32, 32, wall_template, {"1": "A", "2": "K", "3": "K", "4": "K", "5": "K", "6": "A"})
    reg("wall_lit2", 32, 32)

    door = [
        "MMMMMMMMMMMMMMMM",
        "DDDDDDDDDDDDDDDD",
        "DDMMMMMMMMMMMMDD",
        "DDMKKKKKKKKKKMDD",
        "DDMKMMMMMMMMKMDD",
        "DDMKDDDDDDDDKMDD",
        "DDMKMMMMMMMMKMDD",
        "DDMKDDDDDDDDKMDD",
        "DDMKMMMMMMMMKMDD",
        "DDMKDDDDDDDDKMDD",
        "DDMKMMMMMMMMKMDD",
        "DDMKDDDDDDDDKMDD",
        "DDMKMMMMMMMMKMDD",
        "DDMKDDDDDDDDKMDD",
        "DDMKMMMMMMMMKMDD",
        "KKMKKKKKKKKKKMKK",
    ]
    blit_ascii(atlas, 48, 32, door)
    put_px(atlas, 48 + 14, 32 + 4, "A")
    reg("door", 48, 32)

    # Sleek storefront: striped concrete awning, display glass with warm interior bar, side entry door
    shopfront = [
        "MMMMMMMMMMMMMMMM",
        "DDDDDDDDDDDDDDDD",
        "DLLLLLLLLLLLLLLD",
        "DMLMLMLMLMLMLMLD",
        "DMMMMMMMMMMMMMMD",
        "DMKKKKKKKKMDKKMD",
        "DMKDDDDDDKMDKKMD",
        "DMKDDDDDDKMDKKMD",
        "DMKAAAAAAKMDDDMD",
        "DMKAAAAAAKMDKKMD",
        "DMKDDDDDDKMDKKMD",
        "DMMMMMMMMMMDKKMD",
        "DDDDDDDDDDMDKKMD",
        "DDDDDDDDDDMDKKMD",
        "DDDDDDDDDDMDKKMD",
        "KKKKKKKKKKKKKKKK",
    ]
    blit_ascii(atlas, 64, 32, shopfront)
    reg("shopfront", 64, 32)

    side_face = [
        "DDDDDDDDDDDDDDDD",
        "KKKKKKKKKKKKKKKD",
        "KKKKKKKKKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "DDDDDDDDDDDDDDDD",
        "KKKKKKKKKKKKKKKD",
        "KKKKKKKKKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKDKKKKKKKD",
        "KKKKKKKKKKKKKKKK",
    ]
    blit_ascii(atlas, 80, 32, side_face)
    reg("side_face", 80, 32)

    # Row 3 (y=48): roof_cap + roof_edge pieces
    roof_cap = [
        "LLLLLLLLLLLLLLLL",
        "LMMMMMMMMMMMMMMD",
        "LMKKKKKKKKKKKKMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMKDDDDDDDDDDDMD",
        "LMMMMMMMMMMMMMMD",
        "LDDDDDDDDDDDDDDD",
    ]
    blit_ascii(atlas, 0, 48, roof_cap)
    reg("roof_cap", 0, 48)

    roof_edge_n = [
        "LLLLLLLLLLLLLLLL",
        "MMMMMMMMMMMMMMMM",
        "KKKKKKKKKKKKKKKK",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
    ]
    blit_ascii(atlas, 16, 48, roof_edge_n)
    reg("roof_edge_n", 16, 48)

    roof_edge_s = [
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "LLLLLLLLLLLLLLLL",
        "MMMMMMMMMMMMMMMM",
        "KKKKKKKKKKKKKKKK",
    ]
    blit_ascii(atlas, 32, 48, roof_edge_s)
    reg("roof_edge_s", 32, 48)

    fill_rect(atlas, 48, 48, 16, 16, "D")
    fill_rect(atlas, 48, 48, 1, 16, "L")
    fill_rect(atlas, 49, 48, 1, 16, "M")
    fill_rect(atlas, 50, 48, 1, 16, "K")
    reg("roof_edge_w", 48, 48)

    fill_rect(atlas, 64, 48, 16, 16, "D")
    fill_rect(atlas, 64 + 13, 48, 1, 16, "L")
    fill_rect(atlas, 64 + 14, 48, 1, 16, "M")
    fill_rect(atlas, 64 + 15, 48, 1, 16, "K")
    reg("roof_edge_e", 64, 48)

    fill_rect(atlas, 80, 48, 16, 16, "D")
    fill_rect(atlas, 80, 48, 16, 1, "L")
    fill_rect(atlas, 80, 48, 1, 16, "L")
    fill_rect(atlas, 80 + 1, 48 + 1, 15, 1, "M")
    fill_rect(atlas, 80 + 1, 48 + 1, 1, 15, "M")
    fill_rect(atlas, 80 + 2, 48 + 2, 14, 1, "K")
    fill_rect(atlas, 80 + 2, 48 + 2, 1, 14, "K")
    reg("roof_edge_nw", 80, 48)

    fill_rect(atlas, 96, 48, 16, 16, "D")
    fill_rect(atlas, 96, 48, 15, 1, "L")
    fill_rect(atlas, 96, 49, 14, 1, "M")
    fill_rect(atlas, 96, 50, 13, 1, "K")
    fill_rect(atlas, 96 + 13, 50, 1, 14, "L")
    fill_rect(atlas, 96 + 14, 49, 1, 15, "M")
    fill_rect(atlas, 96 + 15, 48, 1, 16, "K")
    reg("roof_edge_ne", 96, 48)

    fill_rect(atlas, 112, 48, 16, 16, "D")
    fill_rect(atlas, 112, 48, 1, 15, "L")
    fill_rect(atlas, 113, 48, 1, 14, "M")
    fill_rect(atlas, 114, 48, 1, 13, "K")
    fill_rect(atlas, 114, 48 + 13, 14, 1, "L")
    fill_rect(atlas, 113, 48 + 14, 15, 1, "M")
    fill_rect(atlas, 112, 48 + 15, 16, 1, "K")
    reg("roof_edge_sw", 112, 48)

    fill_rect(atlas, 128, 48, 16, 16, "D")
    fill_rect(atlas, 128, 48 + 13, 14, 1, "L")
    fill_rect(atlas, 128, 48 + 14, 15, 1, "M")
    fill_rect(atlas, 128, 48 + 15, 16, 1, "K")
    fill_rect(atlas, 128 + 13, 48, 1, 14, "L")
    fill_rect(atlas, 128 + 14, 48, 1, 15, "M")
    fill_rect(atlas, 128 + 15, 48, 1, 16, "K")
    reg("roof_edge_se", 128, 48)

    # Row 4 (y=64): roof_interior, wall_plain
    fill_rect(atlas, 0, 64, 16, 16, "D")
    for i in range(16):
        put_px(atlas, i, 64 + 8, "K")
        put_px(atlas, 8, 64 + i, "K")
    put_px(atlas, 3, 64 + 3, "M")
    put_px(atlas, 12, 64 + 12, "M")
    reg("roof_interior", 0, 64)

    wall_plain = [
        "MMMMMMMMMMMMMMMM",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDD",
        "DDDDDDDDDDDDDDDK",
        "DDMMMMDDDDDDDDDK",
        "DDMKKMDDDDDDDDDK",
        "DDMKKMDDDDDDDDDK",
        "DDMMMMDDDDDDDDDK",
        "DDDDDDDDDDDDDDDK",
        "DDDDDDDDDDMMMMDK",
        "DDDDDDDDDDMKKMDK",
        "DDDDDDDDDDMKKMDK",
        "DDDDDDDDDDMMMMDK",
        "DDDDDDDDDDDDDDDK",
        "DDDDDDDDDDDDDDDK",
        "KKKKKKKKKKKKKKKK",
    ]
    blit_ascii(atlas, 16, 64, wall_plain)
    reg("wall_plain", 16, 64)


def draw_roof_props(atlas, frames):
    def reg(name, x, y, w, h):
        frames[name] = {"x": x, "y": y, "w": w, "h": h}

    ac_unit = [
        "................",
        "................",
        "..LLLLLLLLLLLD..",
        "..LMMMMMMMMMMD..",
        "..LMKKKKKKKMMD..",
        "..LMKKMDMKKMMD..",
        "..LMKMDKDMKMMD..",
        "..LMKKDKDKKMMD..",
        "..LMKMDKDMKMMD..",
        "..LMKKMDMKKMMD..",
        "..LMKKKKKKKMMD..",
        "..LMMMMMMMMMMD..",
        "..DDDDDDDDDDDD..",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
    ]
    blit_ascii(atlas, 0, 96, ac_unit)
    reg("ac_unit", 0, 96, 16, 16)

    # Water tank with visible #4A4852 legs + #2B2A33 cross-bracing
    water_tank = [
        "................",
        ".......LL.......",
        "......LLMM......",
        ".....LLMMMM.....",
        "....LLMMMMMM....",
        "...LLMMMMMMMM...",
        "..LLLLMMMMMDDD..",
        "..LLMMLLMMDDDD..",
        "..KKKKKKKKKKKK..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..KKKKKKKKKKKK..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..LLMMLLMMDDDD..",
        "..MMMMMMMMDDDD..",
        "..KKKKKKKKKKKK..",
        "...M........M...",
        "...M.D....D.M...",
        "...M..D..D..M...",
        "...M...DD...M...",
        "...M..D..D..M...",
        "...M.D....D.M...",
        "...M........M...",
        "...M........M...",
        "...MM......MM...",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
    ]
    blit_ascii(atlas, 16, 96, water_tank)
    reg("water_tank", 16, 96, 16, 32)

    antenna = [
        ".......L........",
        ".......L........",
        ".......M........",
        ".......M........",
        "..LLLLLMLMMMMM..",
        ".......M........",
        "......LMK.......",
        "......LMK.......",
        "......LMK.......",
        "....LLLMKMMM....",
        "......LMK.......",
        ".....LMMMK......",
        ".....LMKMK......",
        ".....LM.MK......",
        ".....LMKMK......",
        ".....LM.MK......",
        "....LMM.MMK.....",
        "....LMK.KMK.....",
        "....LM...MK.....",
        "....LMK.KMK.....",
        "....LM...MK.....",
        "...LMM...MMK....",
        "...LMK...KMK....",
        "...LMMMMMMMK....",
        "....LMMMMMD.....",
        "....LMKKKMD.....",
        "....LMMMMMD.....",
        "....DDDDDDD.....",
        "...KKKKKKKKK....",
        "................",
        "................",
        "................",
    ]
    blit_ascii(atlas, 32, 96, antenna)
    reg("antenna", 32, 96, 16, 32)


def draw_street_props(atlas, frames):
    def reg(name, x, y, w=16, h=16):
        frames[name] = {"x": x, "y": y, "w": w, "h": h}

    trash_bag = [
        "................",
        "................",
        "................",
        "......M.........",
        ".....MKM........",
        "......K.........",
        "....MMKKK.......",
        "...MDDDDDK..M...",
        "..MDKDDKDDKMKK..",
        "..MDDDDDDDKDDK..",
        ".MKDDDKDDDDDDDK.",
        ".MDDDDKDDDDKDDK.",
        ".KKKKKKKKKKKKKK.",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
    ]
    blit_ascii(atlas, 0, 128, trash_bag)
    reg("trash_bag", 0, 128)

    bike = [
        "................",
        "................",
        "................",
        "..........LL....",
        "....DD....L.....",
        "....L.....L.....",
        "....LLLLLLL.....",
        ".....L...LL.....",
        "..KK..L.L..KK...",
        ".KMMK..L..KMMK..",
        ".KMKLL.L.L.KMK..",
        ".KMMK.....KMMK..",
        "..KK.......KK...",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
    ]
    blit_ascii(atlas, 16, 128, bike)
    reg("bike", 16, 128)

    vent_base = [
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "....LLLLLLLL....",
        "....MMMMMMMM....",
        "....MKDKKDKM....",
        "....MDDDDDDM....",
        "...KKKKKKKKKK...",
        "................",
    ]
    steam_frames = [
        [
            "................",
            "................",
            "................",
            "................",
            "................",
            ".......L........",
            "......M.L.......",
            ".....L.L.M......",
            "......L.L.......",
            ".....M.L.M......",
        ],
        [
            "................",
            "................",
            ".......L........",
            "......L.M.......",
            ".....L.L.L......",
            "......L.M.L.....",
            ".....M.L.L......",
            "......L.L.M.....",
            ".....L.M.L......",
            "......L.L.......",
        ],
        [
            "......L.........",
            ".....M.L.M......",
            "......L.L.......",
            ".....L.M.L......",
            "......L.L.M.....",
            ".....M.L.L......",
            "......L.M.......",
            ".....L.L........",
            "......M.........",
            "................",
        ],
        [
            ".....M.L........",
            "......L.........",
            ".....L.M........",
            "........L.......",
            ".......M........",
            "................",
            "......L.........",
            ".....M.L........",
            "......L.M.......",
            ".....L.L........",
        ],
    ]
    for i, sf in enumerate(steam_frames):
        ox = 32 + i * 16
        rows = sf + vent_base[10:]
        blit_ascii(atlas, ox, 128, rows)
        reg(f"steam_vent_{i}", ox, 128)

    vending = [
        "................",
        "..LLLLLLLLLLLD..",
        "..LMMMMMMMMMMD..",
        "..LMKKKKKKKKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCKKKKCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCKKKKCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCKKKKCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKKKKKKKKMD..",
        "..LMMMMMMMMMMD..",
        "..LMDDMMMMCKMD..",
        "..LMDDMMMMKKMD..",
        "..LMMMMMMMMMMD..",
        "..LMKKKKKKKKMD..",
        "..LMKDDDDDDKMD..",
        "..LMKDDDDDDKMD..",
        "..LMKKKKKKKKMD..",
        "..LMMMMMMMMMMD..",
        "..LDDDDDDDDDDD..",
        "..LMKKKKKKKKMD..",
        "..KKKKKKKKKKKK..",
        "................",
        "................",
        "................",
        "................",
    ]
    blit_ascii(atlas, 96, 128, vending)
    reg("vending", 96, 128, 16, 32)


def draw_signs(atlas, frames):
    sign_colors = ["P", "C", "G", "A", "P", "C"]

    def plate(strokes):
        # 2 px dark margin. Glyph strokes are 1 px and span about 60% of the plate.
        grid = [["D" for _ in range(32)] for _ in range(48)]
        for y in range(48):
            for x in range(32):
                if x < 2 or x > 29 or y < 2 or y > 45:
                    grid[y][x] = "K"
        def px(x, y):
            if 2 <= x <= 29 and 2 <= y <= 45:
                grid[y][x] = "X"
        def hline(x0, x1, y):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                px(x, y)
        def vline(x, y0, y1):
            for y in range(min(y0, y1), max(y0, y1) + 1):
                px(x, y)
        strokes(hline, vline)
        return ["".join(row) for row in grid]

    # Box x 6..25 (20 px, 62%) and y 9..37 (29 px, 60%).
    def noodle(h, v):
        h(6, 25, 30)
        v(6, 18, 30)
        v(25, 18, 30)
        h(6, 25, 18)
        v(10, 9, 16)
        v(16, 11, 37)
        v(22, 9, 16)
        h(6, 25, 37)
    def bar(h, v):
        v(15, 9, 37)
        h(6, 25, 9)
        h(8, 22, 20)
        h(6, 25, 37)
        v(6, 20, 37)
        v(25, 20, 37)
    def cross(h, v):
        h(6, 25, 23)
        v(15, 9, 37)
        h(6, 25, 14)
        h(6, 25, 32)
        v(9, 9, 37)
        v(21, 9, 37)
    def arrow(h, v):
        v(10, 16, 37)
        h(10, 25, 16)
        h(6, 25, 9)
        h(18, 25, 23)
        v(25, 9, 23)
        h(6, 25, 37)
    def eye(h, v):
        h(6, 25, 18)
        h(6, 25, 28)
        v(6, 18, 28)
        v(25, 18, 28)
        v(15, 9, 37)
        h(12, 18, 23)
    def glyph(h, v):
        h(6, 25, 9)
        h(6, 25, 37)
        v(6, 9, 37)
        v(25, 9, 37)
        h(6, 25, 23)
        v(15, 9, 37)

    all_signs = [plate(fn) for fn in (noodle, bar, cross, arrow, eye, glyph)]

    counts = []
    for rows in all_signs:
        xs, ys = [], []
        n = 0
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == "X":
                    n += 1
                    xs.append(x)
                    ys.append(y)
        counts.append((n, max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
    print("sign strokes", counts)

    for i, (rows, col) in enumerate(zip(all_signs, sign_colors)):
        ox = i * 32
        blit_ascii(atlas, ox, 160, rows, {"X": col})
        frames[f"sign_{i}_on"] = {"x": ox, "y": 160, "w": 32, "h": 48}

        blit_ascii(atlas, ox, 208, rows, {"X": "M"})
        frames[f"sign_{i}_off"] = {"x": ox, "y": 208, "w": 32, "h": 48}


def draw_heist_pieces(atlas, frames):
    def reg(name, x, y):
        frames[name] = {"x": x, "y": y, "w": 16, "h": 16}

    term_0 = [
        "................",
        "..LLLLLLLLLLLD..",
        "..LMMMMMMMMMMD..",
        "..LMKKKKKKKKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCLLCCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKCCLLCCKMD..",
        "..LMKCCCCCCKMD..",
        "..LMKKKKKKKKMD..",
        "..LMMMMMMMMMMD..",
        "..LMKMKMKMKMMD..",
        "..LMDDDDDDDDMD..",
        "..LMMMMMMMMMMD..",
        "..KKKKKKKKKKKK..",
        "................",
    ]
    blit_ascii(atlas, 0, 256, term_0)
    reg("terminal_0", 0, 256)

    term_1 = [
        "................",
        "..LLLLLLLLLLLD..",
        "..LMMMMMMMMMMD..",
        "..LMKKKKKKKKMD..",
        "..LMKCDCDCDKMD..",
        "..LMKDCLLDCKMD..",
        "..LMKCDCDCDKMD..",
        "..LMKDCLLDCKMD..",
        "..LMKCDCDCDKMD..",
        "..LMKKKKKKKKMD..",
        "..LMMMMMMMMMMD..",
        "..LMKMKMKMKMMD..",
        "..LMDDDDDDDDMD..",
        "..LMMMMMMMMMMD..",
        "..KKKKKKKKKKKK..",
        "................",
    ]
    blit_ascii(atlas, 16, 256, term_1)
    reg("terminal_1", 16, 256)

    exit_locked = [
        "................",
        ".MMMMMMMMMMMMMM.",
        ".MCCCCCCCCCCCCM.",
        ".MCCCCCCCCCCCCM.",
        ".MCCCCCCCCCCCCM.",
        ".MCCMMMMMMMMCCM.",
        ".MCCMMCCCCMMCCM.",
        ".MCCMMCCCCMMCCM.",
        ".MCCMMCCCCMMCCM.",
        ".MCCMMCCCCMMCCM.",
        ".MCCMMMMMMMMCCM.",
        ".MCCCCCCCCCCCCM.",
        ".MCCCCCCCCCCCCM.",
        ".MCCCCCCCCCCCCM.",
        ".MMMMMMMMMMMMMM.",
        "................",
    ]
    blit_ascii(atlas, 32, 256, exit_locked)
    reg("exit_locked", 32, 256)

    exit_open = [
        "................",
        ".GGGGGGGGGGGGGG.",
        ".GKKKKKKKKKKKKG.",
        ".GKKKKGGGGKKKKG.",
        ".GKKKGGGGGGKKKG.",
        ".GKKGGGKKGGGKKG.",
        ".GKKGGKKKKGGKKG.",
        ".GKKKKGGGGKKKKG.",
        ".GKKKGGGGGGKKKG.",
        ".GKKGGGKKGGGKKG.",
        ".GKKKKKGGKKKKKG.",
        ".GKKKKKGGKKKKKG.",
        ".GKKKKKKKKKKKKG.",
        ".GGGGGGGGGGGGGG.",
        ".KKKKKKKKKKKKKK.",
        "................",
    ]
    blit_ascii(atlas, 48, 256, exit_open)
    reg("exit_open", 48, 256)


def draw_runner(atlas, frames):
    # Hooded thief (~24px tall in 24x32 cell), facing right, NO baked outer outline.
    # Two distinct cyan visor eyes (KCKCK) inside dark hood opening, backpack with M highlight & 1px antenna.

    runner_idle = [
        "........................",
        "........................",
        "......M.................",
        "......M.................",
        "......M.................",
        "........AAAAA...........",
        ".......AAAAAAA..........",
        "......AAAKKKKKAA........",
        "......AAAKCKCKKA........",
        "......AAAKKKKKKA........",
        "......AAAKKKKKAA........",
        "......AAAAAAAA..........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDADDDDAA..........",
        ".....MDAMMMMA...........",
        ".......MMMMMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......DD..DD...........",
        ".......DDD.DDD..........",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_run_0 = [
        "........................",
        "........................",
        ".....M..................",
        ".....M..................",
        ".....M..................",
        ".........AAAAA..........",
        "........AAAAAAA.........",
        ".......AAAKKKKKAA.......",
        ".......AAAKCKCKKA.......",
        ".......AAAKKKKKKA.......",
        ".......AAAKKKKKAA.......",
        ".......AAAAAAAA.........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAAAM......",
        "....MDDAAADDDAAAAM......",
        "....MDDAAAM.............",
        ".....MDADDDD............",
        ".......MMMMMM...........",
        "......MMMM.MMM..........",
        ".....MMM....MMM.........",
        "....MMM......MMM........",
        "...MMM........MM........",
        "...DD..........DDD......",
        "...DDD..................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_run_1 = [
        "........................",
        "........................",
        "......M.................",
        "......M.................",
        "........AAAAA...........",
        ".......AAAAAAA..........",
        "......AAAKKKKKAA........",
        "......AAAKCKCKKA........",
        "......AAAKKKKKKA........",
        "......AAAKKKKKAA........",
        "......AAAAAAAA..........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDADDDDAA..........",
        ".....MDAMMMMA...........",
        ".......MMMMMM...........",
        ".......MMMMMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MM.MMM...........",
        ".......MM..DD...........",
        ".......DD..DDD..........",
        ".......DDD..............",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_run_2 = [
        "........................",
        "........................",
        ".....M..................",
        ".....M..................",
        ".....M..................",
        ".........AAAAA..........",
        "........AAAAAAA.........",
        ".......AAAKKKKKAA.......",
        ".......AAAKCKCKKA.......",
        ".......AAAKKKKKKA.......",
        ".......AAAKKKKKAA.......",
        ".......AAAAAAAA.........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAADAA........",
        "....MDDAAAAADDAAAM......",
        "....MDDAAAAADDAAAM......",
        ".....MDADDDD............",
        ".......MMMMMM...........",
        "......MMM.MMMM..........",
        ".....MMM...MMM..........",
        "....MMM.....MMM.........",
        "....MM.......MMM........",
        "...DDD........DD........",
        "..............DDD.......",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_run_3 = [
        "........................",
        "........................",
        "......M.................",
        "......M.................",
        "........AAAAA...........",
        ".......AAAAAAA..........",
        "......AAAKKKKKAA........",
        "......AAAKCKCKKA........",
        "......AAAKKKKKKA........",
        "......AAAKKKKKAA........",
        "......AAAAAAAA..........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDAAAAAAAAM........",
        "....MDDADDDDAA..........",
        ".....MDAMMMMA...........",
        ".......MMMMMM...........",
        ".......MMMMMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMM.MM...........",
        ".......DD..MM...........",
        ".......DDD.DD...........",
        "...........DDD..........",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_crouch = [
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        ".....M..................",
        ".....M..................",
        ".....M..................",
        ".........AAAAA..........",
        "........AAAAAAA.........",
        ".......AAAKKKKKAA.......",
        ".......AAAKCKCKKA.......",
        ".....MDAAAKKKKKKA.......",
        "....MDDAAAKKKKKAA.......",
        "....MDDAAAAAAAA.........",
        "....MDDAAAAAAAAM........",
        "....MDDADDDDDD..........",
        ".....MDMMMMMMM..........",
        "......MMMM.MMM..........",
        ".....MMM....MMM.........",
        ".....MMM....MMM.........",
        ".....MM......MM.........",
        "....DDD.....DDD.........",
        "....DDD.....DDD.........",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_hack = [
        "........................",
        "........................",
        "......M.................",
        "......M.................",
        "......M.................",
        "........AAAAA...........",
        ".......AAAAAAA..........",
        "......AAAKKKKKAA........",
        "......AAAKCKCKKA........",
        "......AAAKKKKKKA........",
        "......AAAKKKKKAA........",
        "......AAAAAAAA..........",
        ".....MDAAAAAAA..........",
        "....MDDAAAAAAAAAAMM.DDD.",
        "....MDDAAAAAAAAAAMM.DCCD",
        "....MDDAAAAAA.......DCCD",
        "....MDDAAAAAA.......DDD.",
        "....MDDADDDD............",
        ".....MDAMMMMA...........",
        ".......MMMMMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......MMKKMM...........",
        ".......DD..DD...........",
        ".......DDD.DDD..........",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    runner_spotted = [
        "........................",
        "........................",
        ".....M..................",
        ".....M..................",
        ".....M..................",
        ".......AAAAA............",
        "......AAAAAAA...........",
        ".....AAAKKKKKAA.........",
        ".....AAAKCKCKKA.........",
        ".....AAAKCKCKKA.........",
        ".....AAAKKKKKAA.........",
        ".....AAAAAAAA...........",
        "....MDAAAAAAA......M....",
        "...MDDAAAAAAAAA...MM....",
        "...MDDAAAAAAAAA..AA.....",
        "...MDDAAAAAA..AAAA......",
        "...MDDAAAAAA............",
        "...MDDADDDD.............",
        "....MDAMMMMA............",
        "......MMMMMM............",
        "......MMKKMM............",
        ".....MMM..MMM...........",
        ".....MM....MM...........",
        ".....MM....MM...........",
        ".....MM....MM...........",
        "....DDD....DDD..........",
        "....DDD....DDD..........",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
    ]

    poses = [
        ("runner_idle", runner_idle),
        ("runner_run_0", runner_run_0),
        ("runner_run_1", runner_run_1),
        ("runner_run_2", runner_run_2),
        ("runner_run_3", runner_run_3),
        ("runner_crouch", runner_crouch),
        ("runner_hack", runner_hack),
        ("runner_spotted", runner_spotted),
    ]

    def sharpen(rows):
        # Drop the antenna, close the visor, and put a point on the hood.
        kept = []
        for i, line in enumerate(rows):
            if i < 8 and line.count("M") == 1 and "A" not in line and "K" not in line and "C" not in line:
                continue
            kept.append(line.replace("KCKCK", "KKKKK"))
        for i, line in enumerate(kept):
            if "A" not in line:
                continue
            chars = list(line)
            idxs = [j for j, ch in enumerate(chars) if ch == "A"]
            if len(idxs) < 4:
                break
            mid = idxs[len(idxs) // 2]
            peak = ["."] * len(chars)
            peak[mid] = "A"
            kept.insert(i, "".join(peak))
            break
        return kept

    poses = [(name, sharpen(rows)) for name, rows in poses]

    for i, (name, rows) in enumerate(poses):
        non_empty = [r for r, line in enumerate(rows) if any(ch != "." for ch in line)]
        max_r = max(non_empty)
        shift = 28 - max_r
        ox = i * 32
        oy = 272
        for r, line in enumerate(rows):
            nr = r + shift
            if 0 <= nr < 32:
                for c, ch in enumerate(line):
                    if ch != ".":
                        put_px(atlas, ox + c, oy + nr, ch)
        frames[name] = {"x": ox, "y": oy, "w": 24, "h": 32}


def draw_backdrop(atlas, frames):
    y0 = 768
    w = 1024
    h = 256

    bayer4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5],
    ]

    for y in range(h):
        for x in range(w):
            b = bayer4[y & 3][x & 3]
            if y < 28:
                thresh = int((1.0 - y / 28.0) * 10)
                ch = "K" if b < thresh else "D"
            else:
                ch = "D"
            put_px(atlas, x, y0 + y, ch)

    for y in range(72, 176):
        dist = abs(y - 124) / 52.0
        density = max(0.0, 0.22 * (1.0 - dist * dist))
        for x in range(w):
            b = bayer4[y & 3][x & 3] / 16.0
            if b < density:
                put_px(atlas, x, y0 + y, "L")

    import random
    rng = random.Random(42)

    tx = 0
    while tx < w:
        tw = rng.choice([28, 36, 44, 52])
        th = rng.randint(95, 165)
        top_y = h - th
        for yy in range(top_y, h):
            for xx in range(tx, min(w, tx + tw)):
                if (xx + yy) & 1 == 0:
                    put_px(atlas, xx, y0 + yy, "K")
        tx += tw + rng.randint(4, 14)

    tx = 0
    while tx < w:
        tw = rng.choice([24, 32, 40, 48, 56])
        if tx + tw > w:
            tw = w - tx
        th = rng.randint(70, 148)
        top_y = h - th
        fill_rect(atlas, tx, y0 + top_y, tw, th, "K")

        if tw >= 32 and rng.random() < 0.65:
            sw = tw - rng.choice([8, 12])
            sh = rng.randint(8, 18)
            sx = tx + (tw - sw) // 2
            fill_rect(atlas, sx, y0 + top_y - sh, sw, sh, "K")
            if rng.random() < 0.6:
                ax = sx + sw // 2
                ah = rng.randint(8, 22)
                for ay in range(max(0, top_y - sh - ah), top_y - sh):
                    put_px(atlas, ax, y0 + ay, "K")

        for wy in range(top_y + 8, h - 12, 8):
            for wx in range(tx + 4, tx + tw - 5, 6):
                if rng.random() < 0.085:
                    put_px(atlas, wx, y0 + wy, "A")
                    put_px(atlas, wx + 1, y0 + wy, "A")
        tx += tw + rng.randint(0, 6)

    frames["backdrop"] = {"x": 0, "y": y0, "w": w, "h": h}


def build_mock_composite(atlas, frames):
    W, H = 390, 700
    scene = make_indexed_canvas(W, H)
    fill_rect(scene, 0, 0, W, H, "K")

    def get_tile(name, scale=2):
        r = frames[name]
        crop = atlas.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
        if scale != 1:
            crop = crop.resize((r["w"] * scale, r["h"] * scale), Image.NEAREST)
        return crop

    def paste_tile(name, dx, dy, scale=2):
        tile = get_tile(name, scale=scale)
        mask = tile.point(lambda p: 255 if p != 0 else 0, mode="L")
        scene.paste(tile, (dx, dy), mask)

    # Backdrop at 1x scale shifted up slightly so smog + skyline breathe above the block
    bd = get_tile("backdrop", scale=1).crop((60, 20, 60 + W, 256))
    scene.paste(bd, (0, 0))

    x_off = 3
    tile_px = 32

    for row in range(4, 22):
        gy = 16 + row * tile_px
        for col in range(12):
            gx = x_off + col * tile_px
            if col in (5, 6):
                paste_tile(f"asphalt_{(col + row) % 4}", gx, gy)
            elif col in (2, 9):
                paste_tile("asphalt_1" if (row % 2 == 0) else "asphalt_3", gx, gy)
            else:
                paste_tile("sidewalk", gx, gy)

    for row in range(6, 19, 2):
        paste_tile("lane_dash", x_off + 6 * tile_px - 16, 16 + row * tile_px)

    for row in range(5, 19):
        gy = 16 + row * tile_px
        paste_tile("curb_e", x_off + 4 * tile_px, gy)
        paste_tile("curb_w", x_off + 7 * tile_px, gy)

    for col in range(12):
        gx = x_off + col * tile_px
        paste_tile("asphalt_0", gx, 16 + 20 * tile_px)
        paste_tile("asphalt_2", gx, 16 + 21 * tile_px)

    paste_tile("puddle_0", x_off + 5 * tile_px + 4, 16 + 17 * tile_px)
    paste_tile("puddle_1", x_off + 6 * tile_px + 2, 16 + 16 * tile_px)
    paste_tile("puddle_2", x_off + 5 * tile_px + 6, 16 + 11 * tile_px)
    paste_tile("grate", x_off + 2 * tile_px + 2, 16 + 14 * tile_px)
    paste_tile("steam_vent_1", x_off + 9 * tile_px + 2, 16 + 12 * tile_px)
    paste_tile("trash_bag", x_off + 2 * tile_px + 2, 16 + 16 * tile_px)
    paste_tile("trash_bag", x_off + 9 * tile_px + 2, 16 + 17 * tile_px)
    paste_tile("bike", x_off + 4 * tile_px + 2, 16 + 17 * tile_px)
    paste_tile("bike", x_off + 7 * tile_px + 4, 16 + 17 * tile_px)

    def draw_building(col_start, col_w, roof_y, storeys, facade_rows, roof_props=None, sign=None, sign_dy=0, has_terminal=False):
        bx = x_off + col_start * tile_px
        for c in range(col_w):
            rx = bx + c * tile_px
            if col_w == 1:
                paste_tile("roof_cap", rx, roof_y)
            else:
                if c == 0:
                    paste_tile("roof_edge_nw", rx, roof_y)
                    paste_tile("roof_edge_sw", rx, roof_y + tile_px)
                elif c == col_w - 1:
                    paste_tile("roof_edge_ne", rx, roof_y)
                    paste_tile("roof_edge_se", rx, roof_y + tile_px)
                else:
                    paste_tile("roof_edge_n", rx, roof_y)
                    paste_tile("roof_edge_s", rx, roof_y + tile_px)

        wall_y0 = roof_y + (tile_px if col_w == 1 else tile_px * 2)
        for s in range(storeys):
            sy = wall_y0 + s * tile_px
            row_kind = facade_rows[s % len(facade_rows)]
            for c in range(col_w):
                wx = bx + c * tile_px
                if s == storeys - 1 and c == 0 and row_kind == "ground_shop":
                    paste_tile("shopfront", wx, sy)
                elif s == storeys - 1 and row_kind in ("ground_door", "ground_shop"):
                    paste_tile("door", wx, sy)
                else:
                    paste_tile(row_kind, wx, sy)

        if roof_props:
            for pname, pc, py_off in roof_props:
                paste_tile(pname, bx + pc * tile_px, roof_y + py_off)

        if has_terminal:
            paste_tile("terminal_0", bx + (col_w * tile_px) // 2 - 16, roof_y + 18)

        if sign:
            sx = bx + (col_w * tile_px - 64) // 2
            paste_tile(sign, sx, wall_y0 + sign_dy)

    draw_building(
        3, 2, roof_y=92, storeys=5,
        facade_rows=["wall_dark", "wall_lit1", "wall_dark", "wall_lit2", "ground_door"],
        roof_props=[("antenna", 0, -28), ("ac_unit", 1, 2)],
        has_terminal=True,
    )
    draw_building(
        0, 2, roof_y=164, storeys=3,
        facade_rows=["wall_lit1", "wall_dark", "ground_door"],
        roof_props=[("ac_unit", 0, 4)],
    )
    draw_building(
        7, 2, roof_y=160, storeys=3,
        facade_rows=["wall_lit2", "wall_dark", "ground_shop"],
        roof_props=[("ac_unit", 0, 4), ("water_tank", 1, -18)],
    )
    draw_building(
        10, 2, roof_y=176, storeys=3,
        facade_rows=["wall_lit1", "wall_dark", "ground_door"],
        roof_props=[("ac_unit", 1, 4)],
    )

    draw_building(
        0, 2, roof_y=304, storeys=2,
        facade_rows=["wall_lit1", "ground_door"],
        roof_props=[("ac_unit", 0, 4)],
    )
    draw_building(
        3, 2, roof_y=320, storeys=3,
        facade_rows=["wall_dark", "wall_lit1", "ground_shop"],
        roof_props=[("ac_unit", 0, 4)],
        sign="sign_0_on", sign_dy=-10,
    )
    draw_building(
        7, 2, roof_y=320, storeys=3,
        facade_rows=["wall_dark", "wall_lit2", "ground_door"],
        roof_props=[("ac_unit", 1, 4)],
        sign="sign_2_on", sign_dy=-10,
    )
    draw_building(
        10, 2, roof_y=298, storeys=2,
        facade_rows=["wall_dark", "ground_door"],
        roof_props=[("ac_unit", 0, 4)],
    )

    draw_building(
        0, 2, roof_y=454, storeys=2,
        facade_rows=["wall_lit2", "ground_door"],
        roof_props=[("ac_unit", 1, 4)],
    )
    draw_building(
        3, 2, roof_y=474, storeys=3,
        facade_rows=["wall_dark", "wall_lit1", "ground_shop"],
        roof_props=[("ac_unit", 0, 4)],
        sign="sign_1_on", sign_dy=-10,
    )
    draw_building(
        7, 2, roof_y=474, storeys=3,
        facade_rows=["wall_dark", "wall_lit1", "ground_shop"],
        roof_props=[("ac_unit", 0, 4)],
        sign="sign_3_on", sign_dy=-10,
    )
    draw_building(
        10, 2, roof_y=444, storeys=2,
        facade_rows=["wall_lit1", "ground_door"],
        roof_props=[("ac_unit", 0, 4)],
    )

    paste_tile("vending", x_off + 2 * tile_px + 2, 474 + 60)
    paste_tile("exit_open", x_off + 6 * tile_px + 4, 626)
    paste_tile("runner_idle", x_off + 5 * tile_px + 8, 566)

    return scene


def build_preview(atlas, frames):
    atlas_2x = atlas.resize((2048, 2048), Image.NEAREST)
    mock_1x = build_mock_composite(atlas, frames)
    mock_2x = mock_1x.resize((mock_1x.width * 2, mock_1x.height * 2), Image.NEAREST)

    pad = 24
    right_w = mock_2x.width
    total_w = atlas_2x.width + pad * 3 + right_w
    total_h = max(atlas_2x.height + pad * 2, pad * 3 + mock_1x.height + mock_2x.height)

    preview = Image.new("RGB", (total_w, total_h), hex_to_rgb("#1A1A22"))

    mask_2x = atlas_2x.point(lambda p: 255 if p != 0 else 0, mode="L")
    preview.paste(atlas_2x.convert("RGB"), (pad, pad), mask_2x)

    draw = ImageDraw.Draw(preview)
    draw.rectangle([pad - 1, pad - 1, pad + 2048, pad + 2048], outline=hex_to_rgb("#4A4852"))

    rx = pad * 2 + 2048
    preview.paste(mock_1x.convert("RGB"), (rx, pad))
    draw.rectangle([rx - 1, pad - 1, rx + mock_1x.width, pad + mock_1x.height], outline=hex_to_rgb("#4A4852"))

    my2 = pad * 2 + mock_1x.height
    preview.paste(mock_2x.convert("RGB"), (rx, my2))
    draw.rectangle([rx - 1, my2 - 1, rx + mock_2x.width, my2 + mock_2x.height], outline=hex_to_rgb("#4A4852"))

    return preview


def verify_outputs(atlas, atlas_path, frames):
    assert atlas.size == (1024, 1024), f"Wrong size: {atlas.size}"
    assert atlas.mode == "P", f"Expected indexed mode P, got {atlas.mode}"

    size_bytes = atlas_path.stat().st_size
    assert size_bytes <= 200 * 1024, f"File too large: {size_bytes} bytes"

    used_indices = set(atlas.get_flattened_data())
    assert used_indices.issubset(set(range(9))), f"Unexpected palette indices: {used_indices - set(range(9))}"

    pal = atlas.getpalette()
    for i in range(1, 9):
        got = tuple(pal[i * 3 : i * 3 + 3])
        exp = PALETTE_RGB[i]
        assert got == exp, f"Palette index {i} mismatch: {got} != {exp}"

    for name, rect in frames.items():
        if name.endswith("_off"):
            crop = atlas.crop((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]))
            crop_idx = set(crop.get_flattened_data())
            bad = crop_idx & NEON_INDICES
            assert not bad, f"{name} contains neon pixels: {bad}"

    rects = list(frames.items())
    for name, r in rects:
        assert r["w"] > 0 and r["h"] > 0, f"Invalid dims for {name}: {r}"
        assert 0 <= r["x"] and r["x"] + r["w"] <= 1024, f"X out of bounds for {name}: {r}"
        assert 0 <= r["y"] and r["y"] + r["h"] <= 1024, f"Y out of bounds for {name}: {r}"

    for i in range(len(rects)):
        n1, r1 = rects[i]
        for j in range(i + 1, len(rects)):
            n2, r2 = rects[j]
            overlap_x = r1["x"] < r2["x"] + r2["w"] and r1["x"] + r1["w"] > r2["x"]
            overlap_y = r1["y"] < r2["y"] + r2["h"] and r1["y"] + r1["h"] > r2["y"]
            assert not (overlap_x and overlap_y), f"Overlap between {n1} {r1} and {n2} {r2}"

    return size_bytes, len(frames)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    atlas = make_indexed_canvas(1024, 1024)
    frames = {}

    draw_ground(atlas, frames)
    draw_facades(atlas, frames)
    draw_roof_props(atlas, frames)
    draw_street_props(atlas, frames)
    draw_signs(atlas, frames)
    draw_heist_pieces(atlas, frames)
    draw_runner(atlas, frames)
    draw_backdrop(atlas, frames)

    atlas_path = OUT_DIR / "neon-atlas.png"
    json_path = OUT_DIR / "neon-atlas.json"
    preview_path = OUT_DIR / "atlas-preview.png"

    atlas.save(atlas_path, format="PNG", optimize=True, transparency=0)
    with open(json_path, "w") as f:
        json.dump({"tile": 16, "frames": frames}, f, indent=2)
        f.write("\n")

    size_bytes, frame_count = verify_outputs(atlas, atlas_path, frames)

    preview = build_preview(atlas, frames)
    preview.save(preview_path, format="PNG", optimize=True)

    print(f"Saved {atlas_path} ({size_bytes / 1024:.2f} KB, {frame_count} frames)")
    print(f"Saved {json_path}")
    print(f"Saved {preview_path} ({preview.size[0]}x{preview.size[1]})")


if __name__ == "__main__":
    main()
