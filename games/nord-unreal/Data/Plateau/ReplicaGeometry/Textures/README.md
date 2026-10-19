# Textures: greystone and slate

`python3 Scripts/plateau_textures.py` writes this folder: six tileable PNGs and `textures.json` (sizes, tile sizes, UV tiling, mean linear colour, mean roughness, import settings, and two SHA-256 hashes per map). `python3 Scripts/test_plateau_textures.py` checks it, and `python3 Scripts/plateau_textures.py --check` compares the folder with a fresh build. The generator uses only the standard library and writes the same pixels on every run and platform. The compressed PNG bytes can differ with the zlib build, so the apply step checks `raw_sha256`, the hash of the decompressed image stream.

| Set | Maps | Size | Tile | What it is |
| --- | --- | --- | --- | --- |
| `limestone` | `T_Replica_Limestone_{diff,nor_dx,rough}.png` | 1024 x 1024 | 2.56 m | Montréal greystone laid as rock-faced ashlar: 8 courses of 29 to 36 cm, 3 or 4 stones of 52 to 118 cm per course (the generator allows 2 to 4 stones of 45 to 130 cm), joints of neighbouring courses at least 15 cm apart, 1 cm mortar joints. |
| `slate` | `T_Replica_Slate_{diff,nor_dx,rough}.png` | 512 x 1024 | 1 m x 2 m | Fausse-mansarde slate: 20 cm slates laid half-bond in 16 rows of 12.5 cm exposure, blue-grey with some purple and green slates, and a band of three fish-scale rows. |

- `diff` is sRGB base colour. The material multiplies it by the target colour divided by `mean_linear`.
- `nor_dx` is a tangent-space normal map in the DirectX convention (green down), like the Poly Haven `_nor_dx` maps in `Data/Art`.
- `rough` is linear: R is roughness, the channel the brick-style material reads. G is height and B is cavity (1 in joints and gaps).
- Image row 0 is the top of the tile. Replica OBJ UVs are in metres (u along the face, v = z), so the tiling is 1 / tile size.

`Scripts/apply_plateau_replica.py` imports the maps to `/Game/Plateau/Replica/Textures` and gives every material key named `Stone`, `Limestone*`, `Greystone*` or `Slate*` a duplicate of `M_BrickRed` with these maps and tiling. Today those keys are the Plex `Stone` and `Slate` keys. `Stone_Cast` stays a smooth flat colour.

The method follows Larry Gritz's RenderMan shader `stone.sl`: staggered courses, a colour per stone from its index, joint edges perturbed by noise, and a groove profile for the relief. The noise is tileable value noise on an integer hash, and the normals come from the height field by central differences. The textures are generated, not scanned.
