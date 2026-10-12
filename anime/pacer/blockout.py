"""Pacer, stage 1: gray Blender blockout.

Builds the shot from untextured primitives only and renders the 360 grayscale
1920x1080 PNG frames of a silent driving video for the video model. Every object
uses one neutral-gray material. There are no empties, textures, emission, facial
features or scene lights.

Run with Blender 5.2, or with the Blender Python module (bpy==5.2.2, which needs Python 3.13):
    blender -b --python-exit-code 1 -P anime/pacer/blockout.py -- <frames-dir> [--preview]
    python3.13 anime/pacer/blockout.py <frames-dir> [--preview]
Then encode the frames with encode.sh.

Shots at 24 fps, 360 frames (15 s):
    A   1- 84  Street, km 30. Mika slows from a run to a walk. Four smaller runners
               overtake her and the km 30 sign slides past.
    B  85-144  Wrist insert. The camera pushes in on the gauge. The needle sweeps from
               the fast end down past the slow end with a small shake, and the arm sways
               less as she slows.
    C 145-228  App city. Pip runs down the avenue. The camera tilts up to the top of
               the tallest tower.
    D 229-300  Tower top. Pip lifts the voice note over its head. Rings spread out over
               the city, and the camera cranes up to a high wide view.
    E 301-360  Street. Mika runs again. The camera circles from her front-left round to
               behind-left, and the finish gantry comes into view ahead.
"""

import math
import random
import sys

import bpy
from mathutils import Matrix, Vector

FPS = 24
FRAMES = 360
SHOTS = {"A": (1, 84), "B": (85, 144), "C": (145, 228), "D": (229, 300), "E": (301, 360)}

# The sets sit 2 km apart, beyond every camera's clip_end, so no set shows in another set's shots.
STREET = Vector((0, 0, 0))
CITY = Vector((2000, 0, 0))
INSERT = Vector((-2000, 0, 0))

OBJECT_GRAY = (0.62, 0.62, 0.62, 1)
WORLD_GRAY = (0.8, 0.8, 0.8)  # renders well above the brightest lit face

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


def cyl(name, loc, radius, depth, rot=(0, 0, 0), verts=24, caps=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot,
                                        end_fill_type="NGON" if caps else "NOTHING")
    return finish(bpy.context.object, name)


def sphere(name, loc, radius, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=loc)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def torus(name, loc, major, minor, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=12)
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def capsule(name, loc, radius, length, segments=24):
    """A cylinder with round ends, joined into one mesh. The cylinder has no caps, so its rims shade evenly."""
    parts = [cyl(name + "_c", loc, radius, length, verts=segments, caps=False),
             sphere(name + "_t", (loc[0], loc[1], loc[2] + length / 2), radius, segments),
             sphere(name + "_b", (loc[0], loc[1], loc[2] - length / 2), radius, segments)]
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.ops.object.shade_smooth()
    return finish(obj, name)


def smooth_sides(obj, angle=40):
    """Smooth a cylinder's curved side and keep its flat caps sharp. This adds no modifier."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))


def limb(name, parent, pivot, radius, length, verts=16):
    """A cylinder that hangs down from its pivot, so rotation swings it. Its sides are smooth, so it does not
    render as a striped prism."""
    obj = cyl(name, (0, 0, 0), radius, length, verts=verts)
    obj.data.transform(Matrix.Translation((0, 0, -length / 2)))
    smooth_sides(obj, 60)  # 60, not 40: an 8-sided limb has 45 degrees between its faces
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


def look(cam, frame, eye, target):
    eye, target = Vector(eye), Vector(target)
    key(cam, frame, loc=eye, rot=(target - eye).to_track_quat("-Z", "Y").to_euler())


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def camera(name, lens):
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.clip_end = 1000
    cam = bpy.data.objects.new(name, data)
    scene.collection.objects.link(cam)
    return cam


cams = {}

# ---------------------------------------------------------------- street: shots A and E

random.seed(30)


class Runner:
    """Capsule torso, sphere head, cylinder arms and legs. Runs along +Y."""

    def __init__(self, name, lane, y0, scale=1.0, segments=24):
        self.lane, self.y, self.phase = lane, y0, random.random() * math.tau
        self.torso = capsule(name, (0, 0, 0), 0.17 * scale, 0.45 * scale, segments)
        self.head = sphere(name + "_head", (0, 0, 0), 0.13 * scale, segments)
        self.head.parent = self.torso
        self.head.location = (0, 0, 0.5 * scale)
        legs, arms = [], []
        verts = max(8, segments * 2 // 3)
        for side in (-1, 1):
            legs.append(limb(f"{name}_leg{side}", self.torso, (0.1 * side * scale, 0, -0.38 * scale), 0.07 * scale, 0.88 * scale, verts))
            arms.append(limb(f"{name}_arm{side}", self.torso, (0.24 * side * scale, 0, 0.26 * scale), 0.05 * scale, 0.6 * scale, verts))
        self.legs, self.arms, self.scale = legs, arms, scale

    def step(self, frame, speed):
        """speed in m/s. Cadence, stride and lean grow with speed. Below about 1.6 m/s the gait is a walk."""
        dt = 1 / FPS
        self.y += speed * dt
        cadence = 0.62 + 0.21 * speed  # strides per second: 175 steps/min at 4 m/s, 102 at 1.1 m/s
        self.phase += math.tau * cadence * dt
        run = min(1.0, speed / 4.0)
        gait = smooth((speed - 1.6) / 1.6)  # 0 walk, 1 run
        arm_swing = math.radians(lerp(12, 36, run))
        # The walk sweeps its legs at a steady rate (a triangle wave) through a stride as long as the ground
        # covered per step, so the stance foot stays planted instead of gliding at full stride.
        # The run swings them like a pendulum.
        walk_swing = math.asin(min(0.9, speed / (4 * 0.88 * self.scale * cadence)))
        swing = lerp(walk_swing, arm_swing, gait)

        def wave(p):
            return lerp(2 / math.pi * math.asin(math.sin(p)), math.sin(p), gait)

        reach = swing * abs(wave(self.phase))
        # The run lifts off at full stride. The walk dips there, so both feet stay on the ground.
        bob = (gait * abs(math.sin(self.phase)) * 0.07 - (1 - gait) * 0.88 * (1 - math.cos(reach))) * self.scale
        lean = math.radians(lerp(2, 10, run))
        # A negative X rotation tips the torso forward, toward +Y. The limbs add the lean back,
        # so they swing about the vertical and not about the leaning torso.
        key(self.torso, frame, loc=(self.lane, self.y, 1.27 * self.scale + bob), rot=(-lean, 0, 0))
        for i, leg in enumerate(self.legs):
            p = self.phase + i * math.pi
            # The swinging leg shortens at mid-swing so its foot lifts clear of the ground: up to 6 cm in the walk, and
            # up to 16 cm in the run, where it stands in for the bent knee, so only one foot is down as the legs cross.
            lift = lerp(0.06, 0.16, gait) * self.scale * max(0.0, math.cos(p))
            key(leg, frame, rot=(swing * wave(p) + lean, 0, 0), scale=(1, 1, 1 - lift / (0.88 * self.scale)))
        for i, arm in enumerate(self.arms):
            s = math.sin(self.phase + i * math.pi)
            key(arm, frame, rot=(-arm_swing * 1.1 * s + lean + math.radians(5 * run), 0, 0))


def mika_speed(f):
    if f < 30:
        return 4.0
    if f <= 84:
        return lerp(4.0, 1.1, smooth((f - 30) / 40))  # walking pace from about frame 56: two full steps
    if f < 301:
        return 1.1 + 1.0875 * FPS / 216  # off screen in B-D: makes up the 1.09 m, so shot E is unchanged
    return lerp(2.2, 4.6, smooth((f - 301) / 22))


def mika_y_at(f):
    """How far down the road Mika is at frame f. She starts at y = 0."""
    return sum(mika_speed(k) for k in range(1, f + 1)) / FPS


# The pack: lane x, speed in m/s, and the frame each runner draws level with Mika. The lanes are on the far
# side of her from CamA, so the runners pass behind her one after another and never cover her. They draw
# level at frames 48-76, while she slows from 2.8 to 1.1 m/s, 2.4-4.0 m/s faster than her, so each pass is
# quick and does not merge into her.
PACK = [(-1.2, 5.2, 48), (-2.0, 5.2, 58), (-2.8, 5.2, 66), (-3.4, 5.0, 76)]
mika = Runner("Mika", 0.0, 0.0)
pack = [Runner(f"Runner{i}", lane, mika_y_at(level) - speed * level / FPS, scale=0.85, segments=12)
        for i, (lane, speed, level) in enumerate(PACK)]

mika_y = {}
for f in range(1, FRAMES + 1):
    if f == SHOTS["E"][0]:
        mika.phase = -math.pi / 2  # shot E opens mid-stride with her right leg forward; the cut hides the jump
    mika.step(f, mika_speed(f))
    mika_y[f] = mika.y
    for r, (_, speed, _) in zip(pack, PACK):
        r.step(f, speed)

# Hide the pack after shot A so it does not cross shot E.
for r in pack:
    for obj in [r.torso, r.head, *r.legs, *r.arms]:
        for f, hidden in ((1, False), (300, True)):
            obj.hide_render = hidden
            obj.keyframe_insert("hide_render", frame=f)

box("Ground", STREET + Vector((0, 120, -0.05)), (400, 600, 0.1))
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
# The street carries on behind the start, so the opening of shot E, which looks back down the road, shows street
# and not an empty plain. These are added after the blocks above, so shot A's buildings keep their random sizes.
for i in range(1, 17):
    y = -40 - i * 6.5
    for side in (-1, 1):
        box(f"Barrier{side}_back{i}", (5.6 * side, y, 0.5), (0.12, 5.6, 1.0))
        cyl(f"BarrierFoot{side}_back{i}", (5.6 * side, y - 2.6, 0.04), 0.25, 0.08)
for i in range(1, 7):
    y = -40 - i * 18
    for side in (-1, 1):
        cyl(f"Lamp{side}_back{i}", (8.5 * side, y, 3.5), 0.1, 7.0)
        box(f"Building{side}_back{i}", ((16 + random.random() * 6) * side, y, 0), (8, 14, 10 + random.random() * 22))

# Kilometre 30 marker: a pole with a blank round sign. CamA passes it at about frame 36, so it slides in from
# the right, passes behind Mika and moves on to her left, still in frame at the cut. The disc faces CamA, tipped
# 30 deg down: a disc facing the lens exactly shades like the facades behind it and disappears. It sits high and
# small enough to clear her head as it passes, and it is hidden after shot A so it does not stand on the finish
# stretch. The post stands just behind the disc's lowest rim, so from CamA it shows only below the disc.
MARKER_Y = 6.7
km_sign = [cyl("MarkerPole", (-5.07, MARKER_Y, 1.55), 0.06, 3.1),
           cyl("MarkerDisc", (-4.8, MARKER_Y, 3.1), 0.34, 0.06, rot=(0, math.radians(120), 0))]
for obj in km_sign:
    for f, hidden in ((1, False), (300, True)):
        obj.hide_render = hidden
        obj.keyframe_insert("hide_render", frame=f)

# Finish gantry for shot E. The banner hangs on short struts below the beam, with sky between, so it reads as
# its own panel.
gy = mika_y[FRAMES] + 38
for side in (-1, 1):
    leg = box(f"GantryLeg{side}", (5.2 * side, gy, 2.95), (0.7, 0.7, 5.9))  # its top is flush with the beam's underside
    # Turned 30 degrees so its faces do not lie parallel to the facades behind it and shade the same gray.
    leg.rotation_euler = (0, 0, math.radians(30 * side))
    cyl(f"GantryFoot{side}", (5.2 * side, gy, 0.15), 0.7, 0.3)
box("GantryBeam", (0, gy, 6.6), (11.2, 0.9, 1.4))
# The banner hangs from its top edge, tipped 20 degrees with its top toward the runners, so its face shades darker than
# the facades behind it. Its top edge stays under the struts.
BANNER_TILT = math.radians(20)
banner = box("GantryBanner", (0, gy - 0.5 + 0.45 * math.sin(BANNER_TILT), 5.35 - 0.45 * math.cos(BANNER_TILT)),
             (9.5, 0.08, 0.9))
banner.rotation_euler = (BANNER_TILT, 0, 0)
for i in range(6):
    cyl(f"GantryStrut{i}", (-4.2 + i * 1.68, gy - 0.5, 5.62), 0.06, 0.56)


def mika_at(f):
    return Vector((0, mika_y[f], 1.3))


cam = cams["A"] = camera("CamA", 35)
a0, a1 = SHOTS["A"]
cam_y = mika_y[a0] - 1.0
for f in range(a0, a1 + 1):
    # The camera rig keeps the runners' early pace, then eases to Mika's walk.
    cam_y += lerp(4.0, 1.1, smooth((f - 26) / 44)) / FPS
    look(cam, f, (5.0, cam_y + 0.4, 1.45), (0, cam_y + 1.0, 1.15))

cam = cams["E"] = camera("CamE", 24)
e0, e1 = SHOTS["E"]
for f in range(e0, e1 + 1):
    u = (f - e0) / (e1 - e0)
    t = smooth(u / 0.85)  # the orbit ends at frame 351, then the camera follows her
    m = mika_at(f)
    ang = lerp(math.radians(115), math.radians(230), t)  # front-left, round her left side, to behind-left
    radius = lerp(4.5, 5.8, smooth((t - 0.45) / 0.55))  # widens only after her side, clear of the barriers
    eye = m + Vector((math.cos(ang) * radius, math.sin(ang) * radius, lerp(-0.5, 0.8, t)))
    # The aim leads her down the road from early on, so the turn is spread out and the gantry settles ahead.
    target = m + Vector((0, 6.0 * smooth((u - 0.2) / 0.8), lerp(0.1, -0.15, t)))
    look(cam, f, eye, target)

# ---------------------------------------------------------------- wrist insert: shot B

b0, b1 = SHOTS["B"]

# The forearm's origin is at the elbow, so its keys swing the whole wrist.
forearm = cyl("Forearm", INSERT + Vector((-1.8, 0, 0)), 0.32, 1.8, rot=(0, math.pi / 2, 0), verts=48)
forearm.data.transform(Matrix.Translation((0, 0, 0.9)))
smooth_sides(forearm)
# The hand's size is in its mesh, so the fingers and thumb keep their own proportions.
hand = box("Hand", INSERT + Vector((0.28, 0, 0.1)), (1, 1, 1))
hand.data.transform(Matrix.Diagonal((0.6, 0.62, 0.28, 1)))
for i in range(4):
    finger = limb(f"Finger{i}", hand, (0.28, -0.21 + i * 0.14, 0.0), 0.05, 0.4)
    finger.rotation_euler = (0, math.radians(-80), 0)
# A left hand, palm down: the thumb comes out of the camera side and points forward, out and down.
thumb = limb("Thumb", hand, (-0.04, -0.28, -0.04), 0.06, 0.32)
thumb.rotation_euler = Vector((0.84, -0.42, -0.34)).to_track_quat("-Z", "Y").to_euler()
dial = cyl("GaugeDisc", INSERT + Vector((-0.5, 0, 0.36)), 0.25, 0.08, verts=48)
hub = cyl("GaugeHub", INSERT + Vector((-0.5, 0, 0.4375)), 0.035, 0.065)  # a cap over the needle's base
for obj in (dial, hub):
    smooth_sides(obj)
gauge = [dial, hub,
         torus("GaugeBezel", INSERT + Vector((-0.5, 0, 0.4)), 0.26, 0.03),
         torus("GaugeTicks", INSERT + Vector((-0.5, 0, 0.41)), 0.19, 0.01)]
# A one-sided pointer. Its tail ends 0.016 behind the pivot, under the hub, and its tip reaches the tick ring.
needle = box("GaugeNeedle", INSERT + Vector((-0.5, 0, 0.444)), (1, 1, 1))
needle.data.transform(Matrix.Translation((0, 0.084, 0)) @ Matrix.Diagonal((0.032, 0.2, 0.03, 1)))

# Hand, gauge and needle ride on the forearm.
bpy.context.view_layer.update()
rest = forearm.matrix_world.copy()
for obj in [hand, *gauge, needle]:
    obj.parent = forearm
    obj.matrix_parent_inverse = rest.inverted()

sway_phase = 0.0
for f in range(b0, b1 + 1):
    t = (f - b0) / (b1 - b0)
    # From the fast end (right) over the top and down past the slow end, to rest at the lower left.
    # A small shake runs through the sweep and the rest.
    angle = lerp(math.radians(-65), math.radians(165), smooth(t / 0.8)) + math.radians(lerp(5, 3, t)) * math.sin(f * 1.1)
    # From the 12 to the 9 o'clock pass the needle's side walls are edge-on or shade like the dial, so mid-sweep
    # it rolls 35 degrees about its length and its top face stops matching the dial. It is flat again from frame 118.
    roll = math.radians(-35) * smooth((f - 96) / 8) * (1 - smooth((f - 110) / 8))
    key(needle, f, rot=(0, roll, angle))
    # The arm swings from the elbow with the stride. The swing gets slower and smaller as she slows.
    sway_phase += lerp(0.42, 0.26, t)
    amp = lerp(1.0, 0.2, smooth(t))
    pitch = math.radians(3.5) * amp * math.sin(sway_phase)
    yaw = math.radians(2.0) * amp * math.sin(sway_phase - 1.2)
    key(forearm, f, rot=(0, math.pi / 2 - pitch, yaw))

cam = cams["B"] = camera("CamB", 50)
for f in range(b0, b1 + 1):
    t = (f - b0) / (b1 - b0)
    # Opens on the whole hand, then pushes in on the gauge.
    eye = INSERT + Vector((lerp(0.5, -0.4, t), lerp(-3.4, -1.0, t), lerp(2.4, 1.55, t)))
    look(cam, f, eye, INSERT + Vector((lerp(0.15, -0.48, t), 0, lerp(0.15, 0.38, t))))

# ---------------------------------------------------------------- app city: shots C and D

random.seed(31)

box("CityGround", CITY + Vector((0, 0, -0.05)), (1200, 1200, 0.1))
tower_top = 48.0  # well above the 4-28 m blocks, so it is the tallest silhouette in the low view at the end of C
tall = box("TallTower", CITY + Vector((0, 30, tower_top / 2)), (7, 7, tower_top))
# The cap is flush with the tower's -X face, where Pip stands in shot D, so the facade drops away beside it.
box("TallTowerCap", CITY + Vector((-1.0, 30, tower_top + 0.3)), (5, 5, 0.6))
# 12 m tall, so it clears the roof edge in the low view at the end of shot C.
cyl("TallTowerMast", CITY + Vector((1.0, 32, tower_top + 0.6 + 6)), 0.15, 12)
for gx in range(-6, 7):
    for gy_ in range(-6, 8):
        x, y = gx * 9, gy_ * 9
        if abs(gx) <= 0 or (abs(x) < 6 and abs(y - 30) < 6):
            continue  # keep the avenue and the tall tower clear
        h = 4 + random.random() * 24
        box(f"Tower{gx}_{gy_}", CITY + Vector((x, y, h / 2)), (6, 6, h))
        if random.random() < 0.4:
            cyl(f"Antenna{gx}_{gy_}", CITY + Vector((x + 1.5, y, h + 1)), 0.08, 2)

# The same grid and avenue carry on out to the edges of shot D's views, so the high wide view shows
# city and not bare ground. These blocks are copies of one cube and one antenna cylinder that share
# their mesh: adding them one by one with bpy.ops takes minutes at this object count.
CITY_EDGE = 24  # grid cells from the centre, 216 m
shared = {}


def copy_of(kind, name, loc, size, build):
    if kind in shared:
        obj = bpy.data.objects.new(name, shared[kind].data)
        scene.collection.objects.link(obj)
    else:
        obj = shared[kind] = build()
    obj.name, obj.location, obj.scale = name, loc, size
    return obj


for gx in range(-CITY_EDGE, CITY_EDGE + 1):
    for gy_ in range(-CITY_EDGE, CITY_EDGE + 1):
        if gx == 0 or (abs(gx) <= 6 and -6 <= gy_ <= 7):
            continue  # the avenue, and the blocks built above
        x, y = gx * 9, gy_ * 9
        h = 4 + random.random() * 24
        copy_of("tower", f"Tower{gx}_{gy_}", CITY + Vector((x, y, h / 2)), (6, 6, h),
                lambda: box("Tower", (0, 0, 0), (1, 1, 1)))
        if random.random() < 0.4:
            copy_of("antenna", f"Antenna{gx}_{gy_}", CITY + Vector((x + 1.5, y, h + 1)), (1, 1, 1),
                    lambda: cyl("Antenna", (0, 0, 0), 0.08, 2))

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
PIP_RUN = 6.0  # m/s, a steady dash from the cut on
PIP_LEAN = math.radians(10)
PIP_HIP = 0.48  # body centre above the ground with the legs straight down, so the feet touch it


def pip_c_y(f):
    return -40 + PIP_RUN * (f - c0) / FPS


phase = 0.0
for f in range(c0, c1 + 1):
    phase += math.tau * 3.2 / FPS
    # A negative X rotation leans Pip forward into the run (+Y). The limbs add the lean back,
    # so they swing about the vertical.
    key(pip, f, loc=CITY + Vector((0, pip_c_y(f), PIP_HIP + 0.05 * abs(math.sin(phase)))), rot=(-PIP_LEAN, 0, 0))
    for i, leg in enumerate(pip_legs):
        key(leg, f, rot=(math.radians(50) * math.sin(phase + i * math.pi) + PIP_LEAN, 0, 0))
    for i, arm in enumerate(pip_arms):
        key(arm, f, rot=(-math.radians(45) * math.sin(phase + i * math.pi) + PIP_LEAN, 0, 0))

d0, d1 = SHOTS["D"]
# Pip stands 0.6 m from the roof's -X edge. The camera holds outside that face, so through the lift it sees
# the dark facade drop away beside Pip instead of a roof that runs on into the city at the same gray.
top = CITY + Vector((-2.9, 30, tower_top + 0.6 + PIP_HIP))
# Pip faces the bulk of the city (-Y), its back square to the camera by the end of the hold, so both arms
# rise beside the head and read the same size.
PIP_TURN = math.radians(200)
# In D the arms sit higher on the body and reach further, which is the least that carries the note
# over the head. The switch is keyed on the cut, while Pip is out of frame, so C keeps its short arms.
D_SHOULDER = Vector((0.24, 0, 0.18))  # right shoulder in Pip space (+Y ahead); the left one mirrors it
D_ARM = 0.42
NOTE_R = 0.2
# Through the lift the note's top leans 30 degrees away from the camera, like a raised plate. Its face then
# catches a lighter shade than the tower faces behind it, so the disc stands out. Once it is overhead it
# straightens to 15 degrees as the camera climbs, so it stays darker than the brightening roof below.
NOTE_TILT, NOTE_TILT_HIGH = math.radians(30), math.radians(15)
CHEST = Vector((0.14, 0.38, 0.0))   # right hand under the note, held in front of the chest
OVER = Vector((0.14, 0.23, 0.513))  # right hand under the note, held over the head
for s, arm in zip((-1, 1), pip_arms):
    key(arm, c1, loc=(0.3 * s, 0, 0.08), scale=(1, 1, 1))


def mirror(v, s):
    return Vector((v.x * s, v.y, v.z))


prev = [None, None]
note_over = None
for f in range(d0, d1 + 1):
    lift = smooth((f - (d0 + 4)) / 20)  # 233-253: from the chest to over the head
    key(pip, f, loc=top, rot=(0, 0, PIP_TURN))
    for leg in pip_legs:
        key(leg, f, rot=(0, 0, 0))
    tips = []
    for i, (s, arm) in enumerate(zip((-1, 1), pip_arms)):
        sh = mirror(D_SHOULDER, s)
        a, b = (mirror(CHEST, s) - sh).normalized(), (mirror(OVER, s) - sh).normalized()
        d = a.slerp(b, lift)
        tips.append(sh + d * D_ARM)
        q = Vector((0, 0, -1)).rotation_difference(d)
        prev[i] = q.to_euler("XYZ", prev[i]) if prev[i] else q.to_euler("XYZ")
        key(arm, f, loc=sh, rot=prev[i], scale=(1, 1, D_ARM / 0.28))
    # The note rests on both hands: its rim passes through the two fingertips.
    mid, half = (tips[0] + tips[1]) / 2, (tips[1] - tips[0]).length / 2
    tilt = lerp(NOTE_TILT, NOTE_TILT_HIGH, smooth((f - (d0 + 24)) / 3))
    note_up = Vector((0, math.sin(tilt), math.cos(tilt)))  # the note's own up, in Pip space
    note_c = mid + note_up * math.sqrt(max(0.0, NOTE_R ** 2 - half ** 2))
    key(note, f, loc=note_c, rot=(math.pi / 2 - tilt, 0, 0))
    if lift >= 1.0 and note_over is None:
        note_over = note_c.copy()
note.hide_render = False
note.keyframe_insert("hide_render", frame=d0)
note.hide_render = True
note.keyframe_insert("hide_render", frame=d1 + 1)

# Three rings of light spread out from the raised note, one after the other. A shape key widens
# each torus, so its tube stays a thin round line instead of scaling into a flat band.
ring_c = top + Matrix.Rotation(PIP_TURN, 3, "Z") @ note_over
RING_RATE = 0.5  # m per frame
RING_R0, RING_T0 = 0.25, 0.025  # radius and tube radius at birth, just outside the note's rim
RING_R1, RING_T1 = RING_R0 + RING_RATE * (d1 - d0 - 24), 0.5  # the first ring on the last frame


def widen(obj):
    obj.shape_key_add(name="Basis")
    wide = obj.shape_key_add(name="Wide", from_mix=False)
    k = RING_T1 / RING_T0
    for v, w in zip(obj.data.vertices, wide.data):
        rho, u = math.hypot(v.co.x, v.co.y), math.atan2(v.co.y, v.co.x)
        rho = RING_R1 + (rho - RING_R0) * k
        w.co = (rho * math.cos(u), rho * math.sin(u), v.co.z * k)
    return wide


for i in range(3):
    ring = torus(f"SoundRing{i}", ring_c, RING_R0, RING_T0)
    wide = widen(ring)
    start = d0 + 24 + i * 12  # 253, 265, 277
    for f in range(start, d1 + 1):
        radius = RING_R0 + RING_RATE * (f - start)
        wide.value = (radius - RING_R0) / (RING_R1 - RING_R0)
        wide.keyframe_insert("value", frame=f)
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=1)
    ring.hide_render = False
    ring.keyframe_insert("hide_render", frame=start)
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=d1 + 1)

cam = cams["C"] = camera("CamC", 24)
TILT_AIM = CITY + Vector((0, 30, 40.0))


def yaw_pitch(v):
    return math.atan2(-v.x, v.y), math.atan2(v.z, math.hypot(v.x, v.y))


for f in range(c0, c1 + 1):
    t = (f - c0) / (c1 - c0)
    up = smooth((t - 0.5) / 0.42)  # the tilt runs over frames 187-221; then the camera keeps pace with Pip
    pip_y = pip_c_y(f)
    eye = CITY + Vector((0.9, pip_y - lerp(3.2, 6.0, up), lerp(0.7, 0.5, up)))
    # Ease the view angles, not the target height, so the tilt turns at an even pace.
    yaw0, pitch0 = yaw_pitch(CITY + Vector((0, pip_y + 2, 0.6)) - eye)
    yaw1, pitch1 = yaw_pitch(TILT_AIM - eye)
    yaw, pitch = lerp(yaw0, yaw1, up), lerp(pitch0, pitch1, up)
    ahead = Vector((-math.sin(yaw) * math.cos(pitch), math.cos(yaw) * math.cos(pitch), math.sin(pitch)))
    look(cam, f, eye, eye + ahead)

cam = cams["D"] = camera("CamD", 28)
CRANE = d0 + 20  # 249: the crane starts as the note reaches the top of the lift
END_ANG = math.radians(165)
end_target = top + Vector((-math.cos(END_ANG) * 10, -math.sin(END_ANG) * 10, -22))
for f in range(d0, d1 + 1):
    # Through the lift the camera holds 4 m behind Pip, moving from 5 degrees to its left to directly
    # behind it, which keeps the mast out of frame. It drifts the same way it will circle, so the move never reverses. Then
    # it cranes up and circles out, rising fast enough to keep all three rings in frame, to a high
    # wide view of the city.
    a = smooth((f - d0) / (CRANE - d0))
    u = smooth((f - CRANE) / (d1 - CRANE)) ** 1.15
    ang = lerp(lerp(math.radians(105), math.radians(110), a), END_ANG, u)
    radius = lerp(lerp(4.0, 4.4, a), 38.0, u)
    h = lerp(lerp(2.0, 2.2, a), 55.0, u)
    look(cam, f, top + Vector((math.cos(ang) * radius, math.sin(ang) * radius, h)), top.lerp(end_target, u))

# ---------------------------------------------------------------- cuts

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
assert not (bpy.data.images or bpy.data.textures or bpy.data.lights), "no images, textures or lights"
assert [m.name for m in bpy.data.materials] == ["FlatGray"], "only the FlatGray material"

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

# Inside the blender binary, the script's own arguments follow "--".
if "--" in sys.argv:
    args = sys.argv[sys.argv.index("--") + 1:]
else:
    args = sys.argv[1:] if sys.argv[0].endswith(".py") else []
preview = "--preview" in args
scene.render.resolution_x, scene.render.resolution_y = (1920, 1080)
scene.render.resolution_percentage = 25 if preview else 100
scene.render.image_settings.file_format = "PNG"
# Grayscale frames: the studio light's fills are slightly tinted, and the blockout must carry no color.
scene.render.image_settings.color_mode = "BW"
paths = [a for a in args if not a.startswith("--")]
out = paths[0] if paths else "frames"
scene.render.filepath = out.rstrip("/") + "/f_"
if preview:
    for shot, (s, e) in SHOTS.items():
        for f in (s, (s + e) // 2, e):
            scene.frame_set(f)
            scene.render.filepath = f"{out.rstrip('/')}/preview_{shot}_{f:03d}"
            bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
