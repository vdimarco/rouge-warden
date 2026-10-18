# BlackCap — original Tripo H3.1 source-body review

**Decision:** suitable for a bounded Tripo rig trial after root's free compatibility check. This is source-body readiness only. The actual returned rig, deformation, relaxed idle, native appearance and final art remain unreviewed. Reviewer: `tripo_surface_prepare`; all eight images here and the pinned current reference were inspected.

The source is `Data/GraphicNovel/Crew/BlackCap/tripo-h31-body-20261017/body.glb`, SHA256 `ff4d393b98d5fba212295305b714ab7fce04229e34b14196c7e2f4c210467d70`. The current reference remains SHA256 `baed5a933fd2c7bcd6e2979836caeb92f7233beb4125ceb6eac2c920822cc3a9`. Neither input was edited. Earlier Meshy body reviews/topology diagnosis remain separate comparison evidence.

## Actual views

| Views | Finding and limit |
| --- | --- |
| Front / three-quarter | Recognizable mature bearded face, medium-brown complexion, black cap, glasses, broad adult frame, black tee, charcoal cargo shorts and dark sneakers. The body has coherent shoulder/elbow/wrist orientation in this static open-palm source pose. It is still an A-like source pose, not a demonstrated natural idle. |
| Side / back | Head, neck, shoulders, shirt volume, cargo pockets and legs remain coherent; feet are visible without floor occlusion. Back folds, shoes and cap seam/panel details are inferred from the one reference. This does not check pose changes or contact. |
| Face front / three-quarter | The long downward cheek/frame branches seen in the Meshy comparison are not apparent in these actual views or the side view. Frames remain rounded rectangles with an ordinary temple arm, and the closed mouth avoids the earlier exaggerated grin. Eye/lens texture detail is soft with blue highlights; brows, beard edge and small facial features are simplified. The source has one opaque PBR material and no transmission extension or separate lens material, so rendered eye visibility is not evidence of transparent lens behavior or a separate eye rig. |
| Left / right hands | Both close-ups show a thumb and four long digits, with visible background gaps between distal fingers. This is a materially clearer source silhouette than the coarse Meshy comparison. Tips remain rounded, basal webs broad, central gaps narrow and some joints abrupt; thumb silhouettes are broad near the palm. These views do not establish five correctly mapped finger chains, closed grasp, skin weights or freedom from motion intersections. |

These are 16-sample CPU images without denoising; visible render grain limits fine-surface judgments. The original generated PBR look remains a source candidate for NORD's art direction, not acceptance of graphic-novel lighting/shading in the game.

## Measured preservation and execution

`Review.json` records Blender 5.2.2 LTS, four CPU threads, Cycles CPU, 16 samples, no denoising/GPU denoising, eight 512×640 PNGs, and clean completion in 21.74 seconds. `render.log` retains normal Blender exit. The full copied input/output remains in ignored `Saved/Tests/TripoBodyReview-BlackCap-H31-20261017-v1/`.

The actual static source has **one mesh, zero skins/armatures/animations, 53,249 vertices and 96,140 triangles**. The 100k request is not a topology or performance acceptance claim. Its measured world-Z height is **0.9794251918792725 source units**; no meter/1.82m assumption or source scaling was applied. The original node matrix, including the approximately −0.849195° world-Z yaw, is retained. The actual front/face renders confirm the measured local-positive-X front direction in `Anchors.json`. Face/hand crop counts are 5,964 / 1,332 / 1,310 vertices respectively.

All three embedded image payloads match their imported packed bytes, with original 4096×4096 dimensions: Color JPEG in sRGB, ORM JPEG in Non-Color and NormalGL PNG in Non-Color. `Review.json` retains the exact payload and decoded-pixel hashes, original GLB material properties and imported node graph/links. Geometry, object transforms, corner normals, UV loops, material slot indices and the original material/image state were hashed before and after every render. All remained unchanged; every PNG's dimensions and hash were read back. Source bytes still match the input pin.

The separately added `Scripts/test_review_tripo_body.py` passes source/output boundary checks for this actual static body, including tampered source, wrong pin, invalid basis/crops and unexpected mesh inventory. The existing Meshy fixture and previous receipts were not changed. No provider, GPU, Unreal or service operation was performed by this reviewer.

Root should independently inspect a subset before any paid rig. Retain these source views as the before-rig reference; compare a returned rig against this exact Tripo GLB rather than the unrelated Meshy surface.
