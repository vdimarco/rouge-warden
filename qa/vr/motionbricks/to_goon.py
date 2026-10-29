"""Reduce a baked SOMA motion (raw.npz) to the street figure's channels (streetview.js PEOPLE_VS), and draw them back.

The figure has no knees or elbows: each leg is one pitch about the hip, each arm a pitch and a raise about the shoulder, the
body a lean about the hips, the head a pitch, and a bob of the whole body. SOMA faces +Z with its left at +X; the figure
faces -Z with its right at +X, so the figure's frame is SOMA turned half round about up: x_f = -x, z_f = -z.
Per frame (15 Hz): legR, legL, lean, headP, armRp, armRr, armLp, armLr, bob, travel (m along the facing).
Usage: python to_goon.py <dir with raw.npz> <out json> [hz]
"""
import json, sys
from pathlib import Path
import numpy as np

D = Path(sys.argv[1]); OUTF = Path(sys.argv[2]); HZ = int(sys.argv[3]) if len(sys.argv) > 3 else 15
d = np.load(D / "raw.npz")
W, names, split = d["world"], list(d["names"]), int(d["split"])
ix = {n: i for i, n in enumerate(names)}
F = np.array([-1.0, 1.0, -1.0])  # SOMA to figure
FIG_HIP = 0.86  # the figure's hip pivot height at scale 1 (streetview.js)


def at(w, n):
    return w[ix[n], :3] * F


hip0 = W[0, ix["Hips"], 1]
rows = []
for w in W:
    hips = at(w, "Hips")
    leg = lambda s: at(w, s + "Foot") - at(w, s + "Leg")
    pitch_down = lambda v: np.arctan2(-v[2], -v[1])  # a down bone swung forward (-z) is +
    t = at(w, "Neck1") - hips
    lean = np.arctan2(-t[2], t[1])
    h = at(w, "HeadEnd") - at(w, "Neck1") if "HeadEnd" in ix else at(w, "Head") - at(w, "Neck1")
    headP = -(np.arctan2(-h[2], h[1]) - lean)

    def arm(s, side):
        v = at(w, s + "Hand") - at(w, s + "Arm")
        # undo the lean (the figure leans its arms with the body): turn v about x by -lean... the lean tips +y toward -z
        c, sn = np.cos(-lean), np.sin(-lean)
        v = np.array([v[0], c * v[1] + sn * v[2], -sn * v[1] + c * v[2]])
        v = v / np.linalg.norm(v)
        # the pitch in the side plane (past level when the arm swings up), the raise out of it (+ is toward +x)
        p = np.arctan2(-v[2], -v[1])
        r = np.arcsin(np.clip(v[0], -1, 1))
        return p, r

    rp, rr = arm("Right", 1); lp, lr = arm("Left", -1)
    bob = (w[ix["Hips"], 1] - hip0) * FIG_HIP / hip0
    travel = -hips[2]
    rows.append([pitch_down(leg("Right")), pitch_down(leg("Left")), lean, headP, rp, rr, lp, lr, bob, travel])
rows = np.array(rows)
# resample 30 Hz -> HZ by linear interpolation
t30 = np.arange(len(rows)) / 30.0
n = int(np.floor(t30[-1] * HZ)) + 1
th = np.arange(n) / HZ
out = np.stack([np.interp(th, t30, rows[:, k]) for k in range(rows.shape[1])], 1)
wind = split / 30.0
data = {
    "source": "MotionBricks-SOMA-RP-v1 (NVIDIA), CPU ONNX Runtime; poses authored in qa/vr/motionbricks/bake.py",
    "hz": HZ, "wind": round(wind, 4), "length": round(t30[-1], 4),
    "channels": ["legR", "legL", "lean", "headP", "armRp", "armRr", "armLp", "armLr", "bob", "travel"],
    "frames": [[round(float(x), 3) for x in r] for r in out],
}
OUTF.write_text(json.dumps(data, separators=(",", ":")) + "\n")
print("frames", n, "at", HZ, "Hz; wind", round(wind, 2), "s; run", round(t30[-1] - wind, 2), "s; travel", round(out[-1, 9], 2), "m")
print("ranges", {c: (round(float(out[:, k].min()), 2), round(float(out[:, k].max()), 2)) for k, c in enumerate(data["channels"])})

# the figure's own read of the channels: the same shader rules, as a stick figure (side view, facing right)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
cols = 10; rws = (n + cols - 1) // cols
fig, axs = plt.subplots(rws, cols, figsize=(cols * 1.4, rws * 2.1))
for a in axs.flat: a.axis("off")
for k, r in enumerate(out):
    legR, legL, lean, headP, rp, rr, lp, lr, bob, _ = r
    ax = axs.flat[k]
    # side view: forward (-z) is drawn to the right
    fwd = lambda v: (-v[2], v[1])
    hipc = np.array([0, 0.86 + bob, 0])
    for a_, col in ((legR, "#2471a3"), (legL, "#c0392b")):
        foot = hipc + 0.86 * np.array([0, -np.cos(a_), -np.sin(a_)])
        ax.plot(*zip(fwd(hipc), fwd(foot)), color=col, lw=2.2)
    up = np.array([0, np.cos(lean), -np.sin(lean)])
    sh = hipc + 0.52 * up; head = sh + 0.3 * np.array([0, np.cos(lean - headP), -np.sin(lean - headP)])
    ax.plot(*zip(fwd(hipc), fwd(sh)), color="k", lw=2.6); ax.plot(*zip(fwd(sh), fwd(head)), color="#555", lw=4)
    for p_, col in ((rp, "#2471a3"), (lp, "#c0392b")):
        a_ = p_ + lean  # the figure leans its arms with the body
        hand = sh + 0.62 * np.array([0, -np.cos(a_), -np.sin(a_)])
        ax.plot(*zip(fwd(sh), fwd(hand)), color=col, lw=1.6)
    ax.plot([-0.9, 0.9], [0, 0], color="#aaa", lw=0.8)
    ax.set_title(f"{k / HZ:.2f}s {'WIND' if k / HZ < wind else 'RUN'}", fontsize=7)
    ax.set_xlim(-0.9, 0.9); ax.set_ylim(-0.05, 1.9); ax.set_aspect("equal")
fig.savefig(D / "goon.png", dpi=80, bbox_inches="tight")
