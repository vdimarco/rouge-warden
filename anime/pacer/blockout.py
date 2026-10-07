"""Pacer, stage 1: gray Blender blockout.

Builds the shot from untextured primitives only and renders a silent 1080p
driving video for the video model. Every object uses one neutral-gray material.
There are no empties, textures, emission, faces or scene lights.

Run with the Blender Python module (pip install bpy==5.2.2):
    python anime/pacer/blockout.py <frames-dir> [--preview]
Then encode the frames with encode.sh.

Shots at 24 fps, 360 frames (15 s):
    A   1- 84  Street, km 30. Mika slows from a run to a walk. Other runners pass.
    B  85-144  Wrist insert. The pace gauge needle sweeps down into the red zone.
    C 145-228  App city. Pip runs down the avenue to the tallest tower.
    D 229-300  Tower top. Pip lifts the voice note. Rings spread out over the city.
    E 301-360  Street. Mika runs again. The finish gantry comes into view.
"""

import math
import random
import sys

import bpy
from mathutils import Euler, Matrix, Vector

FPS = 24
FRAMES = 360
SHOTS = {"A": (1, 84), "B": (85, 144), "C": (145, 228), "D": (229, 300), "E": (301, 360)}

STREET = Vector((0, 0, 0))
CITY = Vector((500, 0, 0))
INSERT = Vector((-500, 0, 0))

OBJECT_GRAY = (0.62, 0.62, 0.62, 1)
WORLD_GRAY = (0.32, 0.32, 0.32)

# ---------------------------------------------------------------- scene

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, FRAMES

gray = bpy.data.materials.new("FlatGray")
gray.diffuse_color = OBJECT_GRAY


def finish(obj, name):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(gray)
    return obj


def box(name, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.scale = size
    return finish(obj, name)


def cyl(name, loc, radius, depth, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    return finish(bpy.context.object, name)


def sphere(name, loc, radius):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius, location=loc)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def torus(name, loc, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=12)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def capsule(name, loc, radius, length):
    """A cylinder with round ends, joined into one mesh."""
    parts = [cyl(name + "_c", loc, radius, length),
             sphere(name + "_t", (loc[0], loc[1], loc[2] + length / 2), radius),
             sphere(name + "_b", (loc[0], loc[1], loc[2] - length / 2), radius)]
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def limb(name, parent, pivot, radius, length):
    """A cylinder that hangs down from its pivot, so rotation swings it."""
    obj = cyl(name, (0, 0, 0), radius, length, verts=16)
    obj.data.transform(Matrix.Translation((0, 0, -length / 2)))
    obj.parent = parent
    obj.location = pivot
    return obj


def key(obj, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert("location", frame=frame)
    if rot is not None:
        obj.rotation_euler = rot
        obj.keyframe_insert("rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert("scale", frame=frame)


def look(cam, frame, eye, target, roll=0.0):
    eye, target = Vector(eye), Vector(target)
    quat = (target - eye).to_track_quat("-Z", "Y")
    rot = quat.to_euler()
    if roll:
        rot.rotate(Euler((0, 0, roll)))
    key(cam, frame, loc=eye, rot=rot)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- runners


class Runner:
    """Capsule torso, sphere head, cylinder arms and legs. Runs along +Y."""

    def __init__(self, name, lane, y0, scale=1.0):
        self.lane, self.y, self.phase = lane, y0, random.random() * math.tau
        self.torso = capsule(name, (0, 0, 0), 0.17 * scale, 0.45 * scale)
        self.head = sphere(name + "_head", (0, 0, 0), 0.13 * scale)
        self.head.parent = self.torso
        self.head.location = (0, 0, 0.5 * scale)
        legs, arms = [], []
        for side in (-1, 1):
            legs.append(limb(f"{name}_leg{side}", self.torso, (0.1 * side * scale, 0, -0.38 * scale), 0.07 * scale, 0.88 * scale))
            arms.append(limb(f"{name}_arm{side}", self.torso, (0.24 * side * scale, 0, 0.26 * scale), 0.05 * scale, 0.6 * scale))
        self.legs, self.arms, self.scale = legs, arms, scale

    def step(self, frame, speed):
        """speed in m/s. Stride and swing grow with speed."""
        dt = 1 / FPS
        self.y += speed * dt
        cadence = 0.9 + 0.32 * speed  # steps of each leg per second
        self.phase += math.tau * cadence * dt
        run = min(1.0, speed / 4.0)
        swing = math.radians(lerp(18, 48, run))
        bob = abs(math.sin(self.phase)) * lerp(0.02, 0.07, run) * self.scale
        lean = math.radians(lerp(2, 12, run))
        key(self.torso, frame, loc=(self.lane, self.y, 1.27 * self.scale + bob), rot=(lean, 0, 0))
        for i, leg in enumerate(self.legs):
            s = math.sin(self.phase + i * math.pi)
            key(leg, frame, rot=(swing * s, 0, 0))
        for i, arm in enumerate(self.arms):
            s = math.sin(self.phase + i * math.pi)
            key(arm, frame, rot=(-swing * 1.1 * s - math.radians(25 * run), 0, 0))


random.seed(30)

mika = Runner("Mika", 0.0, 0.0)
pack = [Runner(f"Runner{i}", lane, y) for i, (lane, y) in enumerate([(-1.6, -4), (1.4, -7), (-0.9, -10), (2.2, -13)])]


def mika_speed(f):
    if f < 34:
        return 4.0
    if f < 84:
        return lerp(4.0, 1.1, smooth((f - 34) / 50))
    if f < 301:
        return 1.1
    return lerp(2.2, 4.6, smooth((f - 301) / 22))


mika_y = {}
for f in range(1, FRAMES + 1):
    mika.step(f, mika_speed(f))
    mika_y[f] = mika.y
    for r in pack:
        r.step(f, 4.1)

# Hide the pack after shot A so it does not cross shot E.
for r in pack:
    for obj in [r.torso, r.head, *r.legs, *r.arms]:
        for f, hidden in ((1, False), (300, True)):
            obj.hide_render = hidden
            obj.keyframe_insert("hide_render", frame=f)

# ---------------------------------------------------------------- street set

box("Ground", (0, 120, -0.05), (400, 600, 0.1))
for side in (-1, 1):
    box(f"Curb{side}", (4.2 * side, 120, 0.08), (0.3, 600, 0.16))
for i in range(80):
    y = -40 + i * 6.5
    for side in (-1, 1):
        box(f"Barrier{side}_{i}", (5.6 * side, y, 0.5), (0.12, 5.6, 1.0))
        cyl(f"BarrierFoot{side}_{i}", (5.6 * side, y - 2.6, 0.04), 0.25, 0.08)
for i in range(30):
    y = -40 + i * 18
    for side in (-1, 1):
        cyl(f"Lamp{side}_{i}", (8.5 * side, y, 3.5), 0.1, 7.0)
        box(f"Building{side}_{i}", ((16 + random.random() * 6) * side, y, 0), (8, 14, 10 + random.random() * 22))

# Kilometre 30 marker: a pole with a blank disc.
cyl("MarkerPole", (-4.8, 14, 1.4), 0.06, 2.8)
cyl("MarkerDisc", (-4.8, 14, 2.9), 0.45, 0.06, rot=(math.pi / 2, 0, 0))

# Finish gantry for shot E.
gy = mika_y[FRAMES] + 38
for side in (-1, 1):
    box(f"GantryLeg{side}", (5.2 * side, gy, 3.2), (0.7, 0.7, 6.4))
    cyl(f"GantryFoot{side}", (5.2 * side, gy, 0.15), 0.7, 0.3)
box("GantryBeam", (0, gy, 6.6), (11.2, 0.9, 1.4))
box("GantryBanner", (0, gy - 0.5, 5.6), (9.5, 0.08, 0.9))
for i in range(6):
    cyl(f"GantryStrut{i}", (-4.2 + i * 1.68, gy, 6.6), 0.05, 1.4, rot=(0, math.radians(35), 0))

# ---------------------------------------------------------------- wrist insert set

forearm = cyl("Forearm", INSERT + Vector((-0.9, 0, 0)), 0.32, 1.8, rot=(0, math.pi / 2, 0))
hand = box("Hand", INSERT + Vector((0.28, 0, 0)), (0.6, 0.62, 0.28))
for i in range(4):
    finger = limb(f"Finger{i}", hand, (0.48, -0.22 + i * 0.15, 0.05), 0.055, 0.42)
    finger.rotation_euler = (0, math.radians(-70), 0)
thumb = limb("Thumb", hand, (0.1, 0.34, 0.0), 0.06, 0.34)
thumb.rotation_euler = (math.radians(-60), 0, 0)
gauge = cyl("GaugeDisc", INSERT + Vector((-0.5, 0, 0.36)), 0.25, 0.08)
torus("GaugeBezel", INSERT + Vector((-0.5, 0, 0.4)), 0.26, 0.03)
torus("GaugeTicks", INSERT + Vector((-0.5, 0, 0.41)), 0.19, 0.01)
cyl("GaugeHub", INSERT + Vector((-0.5, 0, 0.43)), 0.035, 0.05)
needle = box("GaugeNeedle", (0, 0, 0), (0.022, 0.2, 0.02))
needle.data.transform(Matrix.Translation((0, 0.08, 0)))
needle.location = INSERT + Vector((-0.5, 0, 0.44))
for f in range(SHOTS["B"][0], SHOTS["B"][1] + 1):
    t = (f - SHOTS["B"][0]) / (SHOTS["B"][1] - SHOTS["B"][0])
    # From a fast pace (right) down past the red zone (far left), with a small shake.
    angle = lerp(math.radians(-65), math.radians(118), smooth(t * 1.15)) + 0.04 * math.sin(f * 1.7) * (1 - t)
    key(needle, f, rot=(0, 0, angle))
    sway = 0.03 * math.sin(f * 0.5) * (1 - t)
    for obj, base in ((forearm, (0, math.pi / 2, 0)), (hand, (0, 0, 0))):
        key(obj, f, rot=(base[0] + sway, base[1], base[2]))

# ---------------------------------------------------------------- app city set

box("CityGround", CITY + Vector((0, 0, -0.05)), (200, 200, 0.1))
tower_top = 42.0
tall = box("TallTower", CITY + Vector((0, 30, tower_top / 2)), (7, 7, tower_top))
box("TallTowerCap", CITY + Vector((0, 30, tower_top + 0.3)), (5, 5, 0.6))
cyl("TallTowerMast", CITY + Vector((2, 32, tower_top + 3)), 0.12, 6)
for gx in range(-6, 7):
    for gy_ in range(-6, 8):
        x, y = gx * 9, gy_ * 9
        if abs(gx) <= 0 or (abs(x) < 6 and abs(y - 30) < 6):
            continue  # keep the avenue and the tall tower clear
        h = 4 + random.random() * 24
        box(f"Tower{gx}_{gy_}", CITY + Vector((x, y, h / 2)), (6, 6, h))
        if random.random() < 0.4:
            cyl(f"Antenna{gx}_{gy_}", CITY + Vector((x + 1.5, y, h + 1)), 0.08, 2)

pip = sphere("Pip", (0, 0, 0), 0.3)
pip_head = sphere("Pip_head", (0, 0, 0), 0.18)
pip_head.parent = pip
pip_head.location = (0, 0, 0.38)
pip_legs = [limb(f"Pip_leg{s}", pip, (0.12 * s, 0, -0.18), 0.05, 0.3) for s in (-1, 1)]
pip_arms = [limb(f"Pip_arm{s}", pip, (0.3 * s, 0, 0.08), 0.04, 0.28) for s in (-1, 1)]
note = cyl("VoiceNote", (0, 0, 0), 0.2, 0.04, rot=(math.pi / 2, 0, 0))
note.parent = pip
note.location = (0, -0.1, 1.0)
note.hide_render = True
note.keyframe_insert("hide_render", frame=1)

c0, c1 = SHOTS["C"]
phase = 0.0
for f in range(c0, c1 + 1):
    t = (f - c0) / (c1 - c0)
    y = lerp(-40, 24, smooth(t * 0.9 + 0.1 * t))
    phase += math.tau * 3.2 / FPS
    key(pip, f, loc=CITY + Vector((0, y, 0.52 + 0.05 * abs(math.sin(phase)))), rot=(math.radians(10), 0, 0))
    for i, leg in enumerate(pip_legs):
        key(leg, f, rot=(math.radians(50) * math.sin(phase + i * math.pi), 0, 0))
    for i, arm in enumerate(pip_arms):
        key(arm, f, rot=(-math.radians(45) * math.sin(phase + i * math.pi), 0, 0))

d0, d1 = SHOTS["D"]
top = CITY + Vector((0, 30, tower_top + 0.6 + 0.52))
for f in range(d0, d1 + 1):
    t = (f - d0) / (d1 - d0)
    lift = smooth(t / 0.3)
    key(pip, f, loc=top, rot=(0, 0, 0))
    for leg in pip_legs:
        key(leg, f, rot=(0, 0, 0))
    for i, arm in enumerate(pip_arms):
        # Both arms rise over the head and hold the note up.
        key(arm, f, rot=(0, (-1 if i == 0 else 1) * math.radians(lerp(10, 160, lift)), 0))
note.hide_render = False
note.keyframe_insert("hide_render", frame=d0 + 12)
note.hide_render = True
note.keyframe_insert("hide_render", frame=d1 + 1)

for i in range(3):
    ring = torus(f"SoundRing{i}", top + Vector((0, 0, 0.5)), 1.0, 0.06)
    start = d0 + 18 + i * 12
    for f, s in ((1, 0.01), (start - 1, 0.01), (start, 0.4), (d1, 40.0 - i * 9)):
        key(ring, f, scale=(s, s, 1.0))
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=1)
    ring.hide_render = False
    ring.keyframe_insert("hide_render", frame=start)
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=d1 + 1)

# ---------------------------------------------------------------- cameras


def camera(name, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 1000
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    return cam


def mika_at(f):
    return Vector((0, mika_y[f], 1.3))


cams = {}

cam = cams["A"] = camera("CamA", 35)
a0, a1 = SHOTS["A"]
cam_y = mika_y[a0] - 1.0
for f in range(a0, a1 + 1):
    # The camera rig keeps the runners' early pace, then eases to Mika's walk.
    cam_y += lerp(4.0, 1.1, smooth((f - 30) / 54)) / FPS
    look(cam, f, (5.0, cam_y + 0.4, 1.45), (0, cam_y + 1.0, 1.15))

cam = cams["B"] = camera("CamB", 50)
b0, b1 = SHOTS["B"]
for f in range(b0, b1 + 1):
    t = (f - b0) / (b1 - b0)
    eye = INSERT + Vector((lerp(0.2, -0.3, t), lerp(-2.6, -1.3, t), lerp(1.9, 1.2, t)))
    look(cam, f, eye, INSERT + Vector((lerp(-0.1, -0.45, t), 0, 0.3)), roll=math.radians(4))

cam = cams["C"] = camera("CamC", 24)
for f in range(c0, c1 + 1):
    t = (f - c0) / (c1 - c0)
    up = smooth((t - 0.55) / 0.45)
    pip_y = lerp(-40, 24, smooth(t * 0.9 + 0.1 * t))
    eye = CITY + Vector((0.9, pip_y - lerp(3.2, 6.0, up), lerp(0.7, 0.5, up)))
    target = CITY + Vector((0, pip_y + lerp(2, 4, up), lerp(0.6, tower_top * 0.85, up)))
    look(cam, f, eye, target)

cam = cams["D"] = camera("CamD", 28)
for f in range(d0, d1 + 1):
    t = smooth((f - d0) / (d1 - d0))
    ang = lerp(math.radians(-120), math.radians(-40), t)
    radius = lerp(4.0, 14.0, t)
    eye = top + Vector((math.cos(ang) * radius, math.sin(ang) * radius, lerp(1.0, 9.0, t)))
    look(cam, f, eye, top + Vector((0, 0, lerp(0.8, -4.0, t))))

cam = cams["E"] = camera("CamE", 24)
e0, e1 = SHOTS["E"]
for f in range(e0, e1 + 1):
    t = smooth((f - e0) / (e1 - e0))
    m = mika_at(f)
    ang = lerp(math.radians(80), math.radians(215), t)  # from in front of Mika round to behind-left
    eye = m + Vector((math.cos(ang) * 4.5, math.sin(ang) * 4.5, lerp(-0.5, 0.6, t)))
    target = m + Vector((0, lerp(0, 4.0, smooth((t - 0.5) / 0.5)), lerp(0.1, 0.5, t)))
    look(cam, f, eye, target)

for shot, (start, _) in SHOTS.items():
    marker = scene.timeline_markers.new(shot, frame=start)
    marker.camera = cams[shot]
scene.camera = cams["A"]

for obj in scene.objects:
    if obj.animation_data and obj.animation_data.action:
        for layer in getattr(obj.animation_data.action, "layers", []):
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"
        for fc in getattr(obj.animation_data.action, "fcurves", []):
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

# ---------------------------------------------------------------- clean and render

assert not [o for o in scene.objects if o.type not in {"MESH", "CAMERA"}], "only meshes and cameras"
for obj in scene.objects:
    if obj.type == "MESH":
        assert [m.name for m in obj.data.materials] == ["FlatGray"], obj.name

world = bpy.data.worlds.new("PlainGray")
world.color = WORLD_GRAY
scene.world = world

scene.render.engine = "BLENDER_WORKBENCH"
shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_shadows = False
shading.show_cavity = False
shading.show_object_outline = False
shading.show_specular_highlight = False
scene.view_settings.view_transform = "Standard"
scene.render.film_transparent = False
scene.render.use_stamp = False

preview = "--preview" in sys.argv
scene.render.resolution_x, scene.render.resolution_y = (1920, 1080)
scene.render.resolution_percentage = 25 if preview else 100
scene.render.image_settings.file_format = "PNG"
out = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "frames"
scene.render.filepath = out.rstrip("/") + "/f_"
if preview:
    for shot, (s, e) in SHOTS.items():
        for f in (s, (s + e) // 2, e):
            scene.frame_set(f)
            scene.render.filepath = f"{out.rstrip('/')}/preview_{shot}_{f:03d}"
            bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
