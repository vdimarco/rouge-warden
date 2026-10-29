"""Bake the brute's charge with MotionBricks (SOMA, CPU): stand -> wind-up crouch -> a shoulder-first lunge 6 m ahead.

Our own poses only (made here from the SOMA rest pose by joint turns), so no sample clip feeds the model. See README.md. Usage:
  python bake.py <motionbricks src> <soma fp32 onnx> <soma skeleton usd> <out dir> [--seed-runs N]
Writes raw.npz (the generated world joints at 30 Hz), sheet.png (stick figures) and goon.json (the goon channels).
"""
import json, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import cpu_engine

SRC, ONNX, USD, OUT = (Path(a) for a in sys.argv[1:5])
OUT.mkdir(parents=True, exist_ok=True)
Engine = cpu_engine.install(SRC)
import warp as wp
from scipy.spatial.transform import Rotation as Rot
from motionbricks.io.usd import load_skeleton_from_usd
from motionbricks.io.utils import SOMA_SKELETON_PRIM_PATH
from motionbricks.model.config import MotionBricksInferenceConfig
from motionbricks.utils.pose_utils import compute_world_poses

skel = load_skeleton_from_usd(str(USD), SOMA_SKELETON_PRIM_PATH)
J = skel.num_joints
REF = skel.reference_local_transforms.numpy().astype(np.float64)  # [J, 7] p, q (x y z w)
PAR = skel.parent_indices.numpy()
ji = skel.joint_index


def fk(local):
    """world [J, 7] of one local pose [J, 7]"""
    w = np.zeros_like(local)
    for j in range(J):
        R = Rot.from_quat(local[j, 3:7])
        if PAR[j] < 0:
            w[j, :3] = local[j, :3]; w[j, 3:7] = R.as_quat()
        else:
            Rp = Rot.from_quat(w[PAR[j], 3:7])
            w[j, :3] = w[PAR[j], :3] + Rp.apply(local[j, :3]); w[j, 3:7] = (Rp * R).as_quat()
    return w


def turn(local, joint, axis, deg):
    """turn joint about a world axis (in the current pose), its children with it"""
    j = ji(joint)
    w = fk(local)
    Rpar = Rot.from_quat(w[PAR[j], 3:7]) if PAR[j] >= 0 else Rot.identity()
    A = Rot.from_rotvec(np.asarray(axis, float) / np.linalg.norm(axis) * np.radians(deg))
    local[j, 3:7] = (Rpar.inv() * A * Rpar * Rot.from_quat(local[j, 3:7])).as_quat()


# SOMA faces +Z, its left is +X, up is +Y. Turns about +X pitch the top of a bone forward (+Y toward +Z).
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def stand():
    p = REF.copy()
    turn(p, "LeftArm", Z, -72); turn(p, "RightArm", Z, 72)          # arms down from the T
    turn(p, "LeftArm", X, -8); turn(p, "RightArm", X, -8)            # (a down bone turned about -X swings forward)
    turn(p, "LeftForeArm", X, -20); turn(p, "RightForeArm", X, -20)  # a little bend at the elbows
    turn(p, "LeftLeg", Z, 3); turn(p, "RightLeg", Z, -3)            # feet a little apart
    return p


def windup():
    """the brute plants his feet, drops his weight and his head, and draws his shoulders in: a bull before the run"""
    p = stand()
    p[0, 1] -= 0.14                                                  # the hips drop
    turn(p, "LeftLeg", X, -34); turn(p, "LeftShin", X, 52)           # the left foot forward, knee bent
    turn(p, "RightLeg", X, 22); turn(p, "RightShin", X, 34)          # the right foot back, pushing
    turn(p, "Spine1", X, 20); turn(p, "Chest", X, 14)                # the chest over the knees
    turn(p, "Neck1", X, -24)                                         # the head up, eyes on the hero
    turn(p, "LeftArm", X, -40); turn(p, "RightArm", X, 25)           # the left arm forward, the right drawn back
    turn(p, "LeftForeArm", X, -60); turn(p, "RightForeArm", X, -75)  # fists in
    turn(p, "Spine1", Y, 18)                                         # the right shoulder turned back, wound up
    return p


def charge(at):
    """the end of the charge: running flat out, the left shoulder leading, at = root offset along +Z"""
    p = stand()
    p[0, 2] += at; p[0, 1] -= 0.06
    turn(p, "LeftLeg", X, -48); turn(p, "LeftShin", X, 50)
    turn(p, "RightLeg", X, 32); turn(p, "RightShin", X, 40)
    turn(p, "Spine1", X, 28); turn(p, "Chest", X, 12)
    turn(p, "Neck1", X, -30)
    turn(p, "Spine1", Y, -22)                                        # the left shoulder leads
    turn(p, "LeftArm", X, -25); turn(p, "LeftArm", Z, 15); turn(p, "LeftForeArm", X, -65)
    turn(p, "RightArm", X, 45); turn(p, "RightForeArm", X, -50)
    return p


def poses_wp(list_):
    return wp.array(np.asarray(list_, np.float32), dtype=wp.transform, device="cpu")


eng = Engine(ONNX, bake_cuda_graph=False)
ctx, tgt, out = eng.create_input(skel), eng.create_input(skel), eng.create_output(skel)


def generate(context4, targets, tokens):
    ctx.update_from_poses(poses_wp(context4))
    tgt.update_from_poses(poses_wp(targets))
    cfg = MotionBricksInferenceConfig(allowed_token_counts=tuple(tokens))
    eng.generate_animation(ctx, tgt, out, config=cfg)
    return out.poses.numpy()[: out.num_frames].astype(np.float64)


S, W = stand(), windup()
# 1: from standing to the wind-up, in place (the shortest the model allows: 6 tokens)
a = generate([S] * 4, [W, W], [6, 7])
# 2: from the last poses of the wind-up to the charge's end 6 m ahead; two target poses 1/30 s apart give its speed
DIST, SPEED = 6.0, 14.0
c1, c2 = charge(DIST), charge(DIST + SPEED / 30.0)
b = generate(list(a[-4:]), [c1, c2], [6])
clip = np.concatenate([a, b[1:]], 0)
split = len(a)
world = np.stack([fk(f) for f in clip])
np.savez(OUT / "raw.npz", world=world, local=clip, split=split, names=np.array([skel.joint_name(i) for i in range(J)]))
print("frames", len(clip), "windup", split, "charge", len(b) - 1, "root z", world[0, 0, 2].round(2), "->", world[-1, 0, 2].round(2))

# ---- the stick-figure sheet: side view (z right, y up), every 3rd frame, with the hand-made poses for reference ----
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
BONES = [(PAR[j], j) for j in range(J) if PAR[j] >= 0 and "Hand" not in skel.joint_name(j)[len("LeftHand"):] and not any(k in skel.joint_name(j) for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw", "HeadEnd", "ToeEnd"))]


def draw(ax, w, dx=0.0, col="k"):
    for p_, c in BONES:
        side = skel.joint_name(c)
        cc = "#c0392b" if side.startswith("Left") else "#2471a3" if side.startswith("Right") else col
        ax.plot([w[p_, 2] + dx, w[c, 2] + dx], [w[p_, 1], w[c, 1]], color=cc, lw=1.6)


fig, axs = plt.subplots(2, 1, figsize=(16, 7))
for k in range(0, len(world), 3):
    draw(axs[0], world[k], dx=0 if k >= split else k * 0.12 * 0 + (k / 3) * 0.55, col="#555" if k < split else "k")
axs[0].set_title("wind-up (grey, spread out) then the charge (black, real root travel)")
for k, (name, p) in enumerate([("stand", S), ("windup", W), ("charge end", c1)]):
    w = fk(p); w[:, 2] -= w[0, 2]
    draw(axs[1], w, dx=k * 1.4); axs[1].text(k * 1.4 - 0.3, 2.0, name)
for ax in axs:
    ax.set_aspect("equal"); ax.axis("off")
fig.savefig(OUT / "sheet.png", dpi=90, bbox_inches="tight")
print("sheet", OUT / "sheet.png")
