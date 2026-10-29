"""A contact sheet of raw.npz: one cell per frame (side view, root at the cell middle), the root speed under each."""
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
d = np.load(Path(sys.argv[1]) / "raw.npz")
W, names, split = d["world"], list(d["names"]), int(d["split"])
step = int(sys.argv[2]) if len(sys.argv) > 2 else 2
keep = [i for i, n in enumerate(names) if not any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw", "End"))]
par = {"Spine1": "Hips", "Spine2": "Spine1", "Chest": "Spine2", "Neck1": "Chest", "Neck2": "Neck1", "Head": "Neck2",
       "LeftShoulder": "Chest", "LeftArm": "LeftShoulder", "LeftForeArm": "LeftArm", "LeftHand": "LeftForeArm",
       "RightShoulder": "Chest", "RightArm": "RightShoulder", "RightForeArm": "RightArm", "RightHand": "RightForeArm",
       "LeftLeg": "Hips", "LeftShin": "LeftLeg", "LeftFoot": "LeftShin", "LeftToeBase": "LeftFoot",
       "RightLeg": "Hips", "RightShin": "RightLeg", "RightFoot": "RightShin", "RightToeBase": "RightFoot"}
ix = {n: i for i, n in enumerate(names)}
frames = list(range(0, len(W), step))
cols = 10
rows = (len(frames) + cols - 1) // cols
fig, axs = plt.subplots(rows, cols, figsize=(cols * 1.6, rows * 2.3))
for a in axs.flat: a.axis("off")
for k, f in enumerate(frames):
    ax = axs.flat[k]; w = W[f]; z0 = w[0, 2]
    for c, p in par.items():
        col = "#c0392b" if c.startswith("Left") else "#2471a3" if c.startswith("Right") else ("#555" if f < split else "k")
        ax.plot([w[ix[p], 2] - z0, w[ix[c], 2] - z0], [w[ix[p], 1], w[ix[c], 1]], color=col, lw=1.8)
    ax.plot([-0.9, 0.9], [0, 0], color="#aaa", lw=0.8)
    v = (W[min(f + 1, len(W) - 1), 0, 2] - W[max(f - 1, 0), 0, 2]) * 15
    ax.set_title(f"{f}  {'WIND' if f < split else 'RUN'}  {v:.1f} m/s", fontsize=7)
    ax.set_xlim(-0.9, 0.9); ax.set_ylim(-0.05, 1.9); ax.set_aspect("equal")
fig.savefig(Path(sys.argv[1]) / "frames.png", dpi=80, bbox_inches="tight")
