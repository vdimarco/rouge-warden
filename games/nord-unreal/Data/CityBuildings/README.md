# Municipal buildings near 1334 Sherbrooke Est

1,161 surveyed LOD2 building models within the playable district (1,000 m selection radius, clipped to map bounds) replace 1,299 overlapping procedural OSM footprints. Models retain roof shapes, setbacks, courtyards and original roof photo UVs. Their bases are individually placed on the game's flat ground; terrain elevation differences are not reconstructed.

Source: **Ville de Montréal, Bâtiments 3D 2016 (Maquette LOD2 avec textures)**, retrieved 2026-10-09. [Dataset and downloads](https://www.donneesquebec.ca/recherche/dataset/vmtl-batiment-3d-2016-maquette-citygml-lod2-avec-textures2). [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Original coordinates use NAD83(CSRS)/MTM zone 8 (EPSG:2950). Attribution appears below the in-game map.

Changes: area selection, geographic conversion into the existing map frame, triangulation including polygon holes, omission of sub-square-centimetre survey slivers, per-building base elevation removal, photo atlas resizing to at most 2048 pixels and JPEG recompression, and a shared 0.7 power correction to lift baked photo shadows. Wall surfaces receive an explicitly estimated CC0 brick finish with regular window spacing, flat colour bands and inked window frames: the aerial wall photos were too distorted for useful street-level rendering. Unphotographed or unusably low-resolution roof/ground surfaces (collapsed UVs, fewer than one texel per 1000 cm², or more than 50 cm per texel along an edge) also use the estimated masonry finish. At most two material sections per building keep the added draw calls bounded. Ground-level details, stairs, balconies and interiors are not separately modelled by this LOD2 source. Aerial photos contain baked shadows and occluding trees. This is a 2016 survey, not a current Street View reconstruction. Google Maps was inspected as a visual reference; no Google imagery or geometry was extracted into the assets.

`manifest.json` records tile hashes, original building identifiers, footprints, elevations, roof collision probes and texture hashes. `Geometry/` and `Textures/` are the small processed source inputs needed to reimport without downloading the full district archives.

To regenerate from the original city downloads, extract PMR03, PMR04, VM13, VM14 and VM15 tile ZIPs from the dataset's PMR 01–11 and Ville-Marie 10–18 GML archives. Use a Python environment with `pyproj`, `numpy`, `mapbox-earcut`, `Pillow`, and `shapely`:

```bash
python Scripts/prepare_city_buildings.py /path/to/PMR03_2016_GML.zip /path/to/PMR04_2016_GML.zip /path/to/VM13_2016_GML.zip /path/to/VM14_2016_GML.zip /path/to/VM15_2016_GML.zip
python Scripts/test_city_buildings.py
python Scripts/prepare_lafontaine.py
```

Close the project's editor, preserve `Content/Maps/LaFontaine.umap`, `Content/LaFontaine/` and any existing `Content/CityBuildings/`, then run `Scripts/import_city_buildings.py` through UnrealEditor-Cmd with `/Game/Maps/LaFontaine` loaded. It imports all municipal models before changing map actors, reimports only the five generic building batches, and preserves roads, trees, lighting, player starts and gameplay actors. Run `Scripts/verify_lafontaine.py` afterwards. Do not run concurrently with another editor for this project.

Initial recovery point: `Saved/Recovery/pre-city-buildings/` (local, excluded from Git).

The illustrated façade shader is original project art in `Scripts/city_facade.hlsl`. Apply material-only changes with `Scripts/apply_city_comic_style.py` through the editor after importing models. The global F2 comic post-process toggle remains separate from this facade artwork.

Municipal feature `2316936` is excluded: its 404 ground surfaces bundle facilities across the park with different terrain elevations and older theatre geometry. Flattening it as one building obscured current landmarks. Its exclusion is recorded in the manifest; mapped park models and remaining OSM buildings replace it.
