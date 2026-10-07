# Pacer

A 15-second anime test. On the morning of a city marathon, a small AI agent named Pip runs through a city made of apps to get its runner, Mika, past kilometre 30.

The film uses a three-stage process: a gray Blender blockout, a Seedance re-render, and a film-look grade.

## Stage 1: gray blockout

`blockout.py` builds the shot from untextured primitives only:

- Mika is a capsule torso with a sphere head and cylinder limbs.
- The pace gauge is a disc with a needle.
- Pip is a sphere robot.
- The app city and the finish gantry are boxes and cylinders.

Every object uses one flat gray material on a lighter plain gray background, and the frames are written in grayscale. The script stops if it finds any object other than a mesh or a camera, any material other than FlatGray, or any image, texture or light. The street, the wrist insert and the app city sit 2 km apart, beyond every camera's clip distance, so no set shows up in another set's shots.

This test runs the script in Blender instead of through the Blender MCP server. Use Blender 5.2. The `--` before the script's own arguments is required, and `--python-exit-code 1` must come before `-P`: without it Blender exits 0 even when the script fails. The first command clears old frames first, so a failed render cannot leave a stale set for `encode.sh`.

```sh
rm -rf /tmp/pacer-frames && blender -b --python-exit-code 1 -P anime/pacer/blockout.py -- /tmp/pacer-frames &&
  anime/pacer/encode.sh /tmp/pacer-frames anime/pacer/pacer-blockout.mp4  # 360 frames, 1920x1080
blender -b --python-exit-code 1 -P anime/pacer/blockout.py -- /tmp/pacer-preview --preview  # 3 stills per shot, 480x270
```

The `bpy` module (`pip install bpy==5.2.2`) also runs the script as `python3.13 anime/pacer/blockout.py <dir> [--preview]`; its wheels need Python 3.13. On a headless Linux machine, also install libegl1 and libgl1, and set `EGL_PLATFORM=surfaceless`.

`encode.sh` stops if any of the 360 frames is missing, is not 1920x1080 or does not decode. The output is `pacer-blockout.mp4`: silent, 1920x1080, 24 fps, 15 s.

| Shot | Frames | Action |
| --- | --- | --- |
| A | 1–84 | Street at km 30. A side tracking shot. Mika slows from a run to a walk, four smaller runners overtake her, and the km 30 sign slides past. |
| B | 85–144 | Wrist insert. The camera pushes in on the gauge. The needle sweeps from the fast end down past the slow end with a small shake, and the arm sways less as she slows. |
| C | 145–228 | App city. A low camera follows Pip down the avenue, then tilts up to the top of the tallest tower and its mast. |
| D | 229–300 | Tower top. Pip lifts the voice note over its head with both hands. Three rings spread out over the city one after the other, and the camera cranes up and circles out to a high wide view. |
| E | 301–360 | Street. Mika runs again. The camera circles from her front-left round to behind-left, and the finish gantry comes into view ahead. |

In shot D, Pip's arms are longer than in shot C (0.42 m against 0.28 m), so both hands can carry the note over its head. The change happens on the cut, while Pip is off screen.

## Stage 2: Seedance re-render

Use the prompt in `seedance-prompt.md`, with `pacer-blockout.mp4` as @Video 1.

Some Seedance front ends may cap reference videos at 720p. If the upload rejects the 1080p file, send a 1280x720 copy:

```sh
ffmpeg -i anime/pacer/pacer-blockout.mp4 -vf scale=1280:720:flags=lanczos -an -c:v libx264 -preset slow -crf 16 \
  -pix_fmt yuv420p -movflags +faststart /tmp/pacer-blockout-720p.mp4
```

## Stage 3: grade

Add grain, dust and the tape look to the Seedance output only after generation. Not done yet.
