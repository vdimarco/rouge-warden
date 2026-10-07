# Pacer

A 15-second anime test. On the morning of a city marathon, a small AI agent named Pip runs through a city made of apps to get its runner, Mika, past kilometre 30.

The film uses a three-stage process: a gray Blender blockout, a Seedance re-render, and a film-look grade.

## Stage 1: gray blockout

`blockout.py` builds the shot from untextured primitives only:

- Mika is a capsule torso with a sphere head and cylinder limbs.
- The pace gauge is a disc with a needle.
- Pip is a sphere robot.
- The app city and the finish gantry are boxes and cylinders.

Every object uses one flat gray material on a plain gray background. The scene has no empties, textures, emission, faces or scene lights, and the script stops if it finds any of them.

This test used the `bpy` Python module in place of the Blender MCP server.

```sh
python3 -m venv .venv && .venv/bin/pip install bpy==5.2.2
# On a headless Linux machine, also install libegl1 and libgl1, and set EGL_PLATFORM=surfaceless.
.venv/bin/python anime/pacer/blockout.py /tmp/pacer-frames            # 360 frames, 1920x1080
.venv/bin/python anime/pacer/blockout.py /tmp/pacer-preview --preview  # 3 stills per shot, 480x270
anime/pacer/encode.sh /tmp/pacer-frames anime/pacer/pacer-blockout.mp4
```

The output is `pacer-blockout.mp4`: silent, 1920x1080, 24 fps, 15 s.

| Shot | Frames | Action |
| --- | --- | --- |
| A | 1–84 | Street at km 30. Mika slows from a run to a walk, and other runners pass her. |
| B | 85–144 | Wrist insert. The gauge needle sweeps down into the slow end. |
| C | 145–228 | App city. Pip runs down the avenue, and the camera tilts up to the tallest tower. |
| D | 229–300 | Tower top. Pip lifts the voice note, and rings spread out over the city. |
| E | 301–360 | Street. Mika runs again, and the camera circles to show the finish gantry. |

## Stage 2: Seedance re-render

Use the prompt in `seedance-prompt.md`, with `pacer-blockout.mp4` as @Video 1.

## Stage 3: grade

Add grain, dust and the tape look to the Seedance output only after generation. Not done yet.
