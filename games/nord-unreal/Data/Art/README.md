# Surface and vegetation assets

Downloaded from Poly Haven on 2026-10-09. These assets are CC0: https://polyhaven.com/license

- Asphalt 02: https://polyhaven.com/a/asphalt_02 (Rob Tuytel)
- Brick Wall 001: https://polyhaven.com/a/brick_wall_001 (Dimitrios Savva / Rob Tuytel)
- Grass Ground: https://polyhaven.com/a/grass_ground
- Concrete Pavement: https://polyhaven.com/a/concrete_pavement
- Tree Small 02: https://polyhaven.com/a/tree_small_02

`sources.json` and `tree_small_02/source.json` preserve the provider download URLs and hashes. Textures are 2K, tree textures are 1K. The tree model is shared by all detailed tree actors, with Nanite enabled. An explicit source leaf alpha mask replaces the glTF's blended JPEG leaf material. These assets illustrate Montréal surfaces/trees; they are not scans of the supplied address or the park.

After generating the map, run `Scripts/upgrade_lafontaine_graphics.py` inside Unreal with LaFontaine loaded, then save/package. It imports the sources, applies surface materials, improves car paint/glass and water, and places detailed trees within 140 m of the address. `Scripts/prepare_lafontaine.py` reserves that area for detailed crowns while preserving trunk collision. Run both map generation and graphics steps when regenerating.
