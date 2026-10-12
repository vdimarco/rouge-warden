# Clothed Plateau residents

Six original animated characters by **Quaternius**, distributed under **CC0 1.0**.

Creator's original pack pages:

- https://quaternius.com/packs/ultimatemodularcharacters.html
- https://quaternius.com/packs/ultimatemodularwomen.html

Downloaded 2026-10-10 from the same creator's Poly Pizza profile because the
original Google Drive distribution returned a quota error:

- https://poly.pizza/bundle/Ultimate-Modular-Men-Pack-ZiH8muWqwQ
- https://poly.pizza/bundle/Ultimate-Modular-Women-Pack-aCBDXDdTNN

Every selected model individually states CC0 1.0, including the selected women;
some unselected models on the women's bundle have a different license.
`Source/downloads.json` records each selected model's page, direct file URL,
creator/license metadata, file size, and SHA-256. `Source/CC0-1.0.txt` is the
Creative Commons legal text from https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt.

`Source` preserves the original GLBs. `prepare_civilians.py`, run with Blender
5.2.2 LTS in background mode, joins each character's four skinned body parts and
exports the original neutral idle and walk actions as separate FBXs. It does
not retarget or generate animation. `Prepared/manifest.json` records dimensions,
triangles, rig bone counts, material colors and animation durations. Unreal
materials retain the source colors, with matte skin/cloth instead of the source
pack's metallic setting. Characters are stylized low-poly people, not scanned
or photorealistic humans.

Rebuild the prepared files from the repository root:

```sh
blender --background --python Data/Art/Plateau/Civilians/prepare_civilians.py
```

The map importer creates short authored pedestrian routes on sidewalks and in
the park. The native `QuebecPedestrian` actor moves on the server, pauses at
route endpoints, yields to blocking players/vehicles, and replicates movement
and idle/walking state. These are ambient residents, not a citywide crowd AI.
