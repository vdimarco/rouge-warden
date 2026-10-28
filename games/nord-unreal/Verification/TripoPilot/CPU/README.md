# Returned Tripo rig CPU audit

Task `64103a99-91c2-499d-8866-0304e0beceb1`; source and returned files were copied into scratch, then inspected with Blender5.2.2, factory startup, background, four threads. No provider calls, original writes, export, Unreal, GPU or service action. All23 retained source files and provider FBX hashes remain unchanged.

The return preserves all103,544 UV triangles at1e-6 quantization. All310,632 corresponding corners match the original surface after a uniform1.82000085 scale, with maximum1.04micrometre residual. The130,901→51,657 vertex count change is split-vertex merging, not missing triangles. Weld-copy topology metrics also match (including inherited344 open and286 other non-manifold edges). Surface/rest pose remain relaxed; the return has a newly estimated61-bone bind hierarchy and60weighted bones.

All10three-joint finger chains have genuine skin influence:30/30fingerbones weighted. Weights are finite/normalized, at most4pervertex, with no unweighted vertices. Both independently derived anatomical elbow axes move the wrist forward at+35degrees; the opposite sign moves it backward. The six viewed PNGs show matched neutral bodies, each isolated forward elbow flex, and actual left-finger deformation. This is a useful rigging candidate, not art or locomotion acceptance.

The raw provider FBX material is broken: its only embedded image is the unchanged original GLB albedo JPEG, and both base-color and normal-map textures connect to it. Original normal and metallic/roughness maps are absent. `FBX-payloads.json` proves this directly from the binary, independently of Blender's extracted filenames. The preview deliberately reuses the exact original GLB material and packed images on the proven UVMap. It does not repair the provider file. Returned body height is1m; a preview-only parent restores the original1.82m.

Imported corner normals are not preserved: mean difference21.03degrees, p99~99.34degrees, max177.73degrees across corresponding UV corners. This is a separate shading limitation; geometry correspondence does not imply unchanged normals/tangents. No broad normal reconstruction was attempted.

The neutral preview closely retains the original identity and clothing. Elbows flex forward visibly. Fingers visibly curl, but the skin between fingers and approximate diagnostic curl need further review, and no closed grip/prop fit is proven. Raised shoulder motion, retargeted jump/locomotion, face control, native material/import, collision and gameplay are untested.

Evidence:
- `inputs.json`: original23files plus returned FBX hashes.
- `inventory.json`, `Audit.json`, `FBX-payloads.json`: imported inventory, full measurements and raw embedded-payload proof.
- `Visual/Visual.json`: normalization, shared original material/pixel hashes, corner-normal comparison, finger recipe and six PNG hashes.
- `Visual/01-original-neutral-threequarter.png` and `02-tripo-neutral-threequarter.png`: matched camera/light A/B.
- `Visual/03-elbow-l-forward.png`, `04-elbow-r-forward.png`: separate+65degree anatomical elbow flex.
- `Visual/05-hand-left-neutral.png`, `06-hand-left-flex.png`: actual weighted-finger deformation.
- `inventory.py`, `audit.py`, `fbx_payloads.py`, `Visual/preview.py`: exact disposable recipes; logs retained.

Reproduction uses each script's temporary copies. Run `blender --factory-startup --background -t 4 --python <scratch>/audit.py` for measurements and `... --python <scratch>/Visual/preview.py` for the authorized six CPU stills. Provider/material defects stay recorded; no import/adoption is implied.
