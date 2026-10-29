# The brute's charge, baked with MotionBricks

`public/vr/anim/brute-charge.json` is the Gauntlet brute's charge: he plants his feet, drops into a lunge, and runs the hero
down over 6 m. [MotionBricks](https://github.com/NVlabs/motionbricks) (NVIDIA, SIGGRAPH 2026) generated the motion. The scripts
here bake it again. They run on a CPU: the MotionBricks runtime needs TensorRT and an NVIDIA GPU, but only its inference call
does, so `cpu_engine.py` runs that call on ONNX Runtime and keeps the rest of the release's code.

## What goes in

Three poses made in `bake.py` from the SOMA rest pose by joint turns: a stand, the wind-up (the hips down, the left foot
forward, the chest over the knees, the right shoulder drawn back) and the end of the charge (a running stride, the left
shoulder leading) 6 m ahead. A second target pose 1/30 s later gives the arrival speed (14 m/s). No sample clip from the
release goes in: those clips are for internal evaluation only (`assets/motions/LICENSE.txt` in the release).

Two generations: stand to wind-up in place (6 or 7 tokens), then the wind-up's last four poses to the charge's end (6 tokens,
the shortest the model allows).

## What comes out

`to_goon.py` reduces the motion to what the street figure can show (`streetview.js` pose 16): each leg's pitch, each arm's
pitch and raise, the body's lean, the head's pitch and the bob, at 15 Hz. The figure has no knees or elbows. `combat.js` plays
the first 0.73 s over the brute's wind-up and the rest over his lunge.

## Rebuild

Python 3.11 or later with about 2 GB free. The bake was tested on Linux with Python 3.13.

```sh
git clone --depth 1 https://github.com/NVlabs/motionbricks.git mb-src   # outside this repo
# the ONNX model and the skeleton are Git LFS files: take them from GitHub's media host
curl -L -o soma_fp32.onnx https://media.githubusercontent.com/media/NVlabs/motionbricks/main/motionbricks/assets/onnx/soma/mmm_v6_soma_fp32.onnx
curl -L -o soma_skel.usd https://media.githubusercontent.com/media/NVlabs/motionbricks/main/motionbricks/assets/human/soma_base_skel_minimal_no_root.usd
python -m venv venv && venv/bin/pip install onnxruntime numpy scipy warp-lang usd-core matplotlib
venv/bin/python qa/vr/motionbricks/bake.py mb-src soma_fp32.onnx soma_skel.usd out
venv/bin/python qa/vr/motionbricks/sheet.py out 2          # out/frames.png: the generated motion, one frame a cell
venv/bin/python qa/vr/motionbricks/to_goon.py out public/vr/anim/brute-charge.json 15   # and out/goon.png: as the figure shows it
```

The ONNX file's SHA-256 is `856419dc72aeb14e591eebf4dd0ea05734a2506ddb00bcd39dd6dac2ad60f4fb` (758 MB). On a 4-core CPU one
generation takes about a second. The model chooses the timing, so a rebuild can differ a little from the committed clip.

## Licences

- The MotionBricks code is Apache 2.0. `cpu_engine.py` imports it from the clone and changes nothing in it.
- The model is under the [NVIDIA Open Model Agreement](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-agreement/),
  which permits commercial use. NVIDIA claims no ownership of its outputs. The game ships the baked clip, not the model.
