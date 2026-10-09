# Meshy cottage crew

Eight textured humanoid models generated with `meshy/v7.1/image-to-3d` through the user's connected fal account on 2026-10-09. Each character has its own skeleton, painted base colour, normal/roughness/metallic maps, walking clip and idle clip. The Unreal importer preserves the rig and binds the generated texture atlas; models are approximately 1.82 m tall. Original plungers/PVC props attach to the right hand separately. The lit material includes a small emission fill so painted faces remain readable in tree shadow.

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
3. Run `Scripts/import_meshy_crew.py` in Unreal's editor Python. Skeletal assets, materials and clips are saved under `/Game/ParkComic/Crew/Resident3` through `Resident10`.
4. Run `python3 Scripts/test_meshy_crew.py`, then editor Python `Scripts/verify_meshy_crew.py` in a fresh process. `Scripts/smoke_test.py` also checks visible skeletal bodies, animated foot movement, replicated routes and private E dialogue.
5. `Scripts/capture_meshy_crew.py` renders the lineup, eight individual characters and revised face close-up in PIE.

Generated faces, backs, fingers, clothing lettering and rig weights are approximations. Handheld props stay upright while following the right wrist; fingers do not dynamically close around them. These are wandering, talkable residents; the playable character remains the existing player model. The original three park mascots are unchanged.
