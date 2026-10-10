# Meshy cottage crew

Eight textured humanoid models generated with `meshy/v7.1/image-to-3d` through the user's connected fal account on 2026-10-09. Each character has its own skeleton, painted base colour, normal/roughness/metallic maps, and walking, idle and running clips. The running files were already included in the completed responses and retained locally without new generation. Each rig also has an original locally authored jump clip. The Unreal importer preserves the rig and binds the generated texture atlas; models are approximately 1.82 m tall. Original plungers/PVC props attach to the right hand separately. The lit material retains its exposure-calibrated emission fill, uses BC7 colour compression, and reduces dense generated normal detail to 35%.

The generated base-color atlases contain tiny disconnected UV islands. Reduced mips blend neighboring colors, causing triangle-colored face patches and lost eyes despite intact source pixels; normal/filter changes alone did not fix this. The importer now uses NoMipmaps, NeverStream and zero LOD bias only for base color. Official saved-asset native matrices at both supported sizes pass all eight bodies × six poses; independent [face/pose review](../../Verification/FaceVisualReview.md) accepts all sixteen face close-ups and confirms intact, distinct sampled poses. The lit material, source PNGs, UVs and geometry are retained; unlit shading is not the selected correction.

For already imported atlases, `Scripts/fix_meshy_face_mips.py` with `-NordApplyFaceMips` applies the same three settings outside PIE after backing up the saved packages. [MeshyFaceMipsApplied.json](../../Verification/MeshyFaceMipsApplied.json) passes all eight saved 2048×2048 BC7 atlases, before/after source RGB comparisons and protected asset/source hashes. It now links the completed independent visual review; both official native matrices provide the rendered evidence. Pre-apply 32×32 size readings may be asynchronous default-texture placeholders and do not establish the texture resolution sampled in the earlier native frames.

The eight full-resolution BC7 base-color atlases stay resident, about 32 MiB total, and can alias at distance. Repacking and padding the generated tiny UV islands is the longer-term way to restore safe mips. This fix changes no geometry or source pixels.

| Style | Source folder | Reference identity |
|---|---|---|
| 3 | GreenCap51 | Backwards green cap, navy 51 jersey |
| 4 | Memphis33 | Navy cap, beard, glasses, red Memphis 33 jersey |
| 5 | BlackCap | Black cap, blue glasses, black shirt |
| 6 | WhiteCap | Backwards white cap, beard, glasses, black shirt |
| 7 | RedJersey | Backwards navy cap, blue sunglasses, red baseball jersey |
| 8 | LimeJacket | Black beanie, grey stubble, lime windbreaker, black trousers |
| 9 | CurlyMetalhead | **Revised skull-shirt character:** short tousled hair, short beard, broad smile, teal palm shorts, bare feet |
| 10 | Topknot | Sunglasses, white shirt, navy shorts, crossbody supplies bag |

The `CurlyMetalhead` folder retains its original internal name for style continuity; the displayed resident is now **SKULL SHIRT**. Its `face-reference.png` is the user's new face illustration, unchanged. The earlier long-haired version was never submitted to Meshy. The other supplied illustrations remain unchanged in `Data/ParkComic/References/`.

Each `reference.png` is a clean full-body A-pose illustration generated from the corresponding supplied image. The five portrait-only characters' lower outfits are inferred. Each `request.json` retains the exact submitted Meshy settings and original request ID; `result.json` retains the returned model/texture/animation URLs and seed. URLs can expire; downloaded source files and SHA-256 hashes in `files.json` are retained locally. No API credentials are stored. FBX `.fbm` folders are temporary extracted copies and are excluded from Git.

Reproduce local import without paid regeneration:

1. `python3 Scripts/download_meshy_crew.py` downloads missing files from the retained completed results, if URLs are still live.
2. `/home/von/.cache/nord-geo-venv/bin/python Scripts/prepare_meshy_props.py` rebuilds original handheld prop meshes.
3. `blender --background --factory-startup --python Scripts/prepare_meshy_jump.py` rebuilds the eight original jump FBXs on their retained source rigs without rendering or external service calls. Its round-trip checks preserve skeleton hierarchy and rest transforms; each `jump.json` records source/output hashes and sampled motion.
4. Run `Scripts/import_meshy_crew.py` in Unreal's editor Python. Skeletal assets, materials and `A_Idle`, `A_Walk`, `A_Run` and `A_Jump` are saved under `/Game/ParkComic/Crew/Resident3` through `Resident10`.
5. Run `python3 Scripts/test_meshy_crew.py`, then editor Python `Scripts/verify_meshy_crew.py` in a fresh process. `Scripts/smoke_test.py` also checks visible skeletal bodies, animated foot movement, replicated routes and private E dialogue.
6. `Scripts/capture_meshy_crew.py` renders the lineup, eight individual characters and revised face close-up in PIE.

Generated faces, backs, fingers, clothing lettering and rig weights are approximations. Source face textures and geometry are preserved; material/filter correction improves their presentation without regenerating a likeness. Handheld props stay upright while following the right wrist; fingers do not dynamically close around them. All eight bodies are also playable: C cycles through them, starting with the revised skull-shirt character. Choices replicate independently per player, including changes while driving, and reset on a new connection. The original three park mascots are unchanged.

`A_Run` is the actual 0.667-second Meshy running cycle, rather than accelerated walking. `run.glb` is its small armature-only source, not another copy of the body. `A_Jump` is a 1.2-second, 30 fps local clip: neutral at 0, anticipation at 0.10, takeoff extension at 0.23, leg tuck at 0.47, descending extension at 0.73, landing recoil at 0.93, and neutral at 1.20 seconds. Head/neck local transforms stay unchanged. Actor root motion is disabled; the pelvis lowers 10–11 cm along the rig's Hips-to-Head axis during anticipation/landing, including a few centimetres of balance motion when the rest pose leans. Jump clips intentionally keep `force_root_lock` off; the live capture check independently requires the actor root to stay within 0.5 cm horizontally during a vertical jump. Gameplay selects the airborne and landing phases according to movement state.
