# Inventory: the city's public trees over the district

`trees_pmr.json` (Le Plateau-Mont-Royal, 4,136 trees) and `trees_vm.json` (Ville-Marie, the 486 trees of the strip south of Sherbrooke inside the box) are a clip of the Ville de Montréal's public tree inventory: every record whose latitude and longitude fall inside the district box of `Scripts/prepare_lafontaine.py` (`BOUNDS`, latitude 45.5208 to 45.5312, longitude −73.5755 to −73.5628). `Scripts/plateau_replica.py` reads them to place every street and park tree the game shows (`ReplicaGeometry/Streets/street_trees.json`).

**Source:** Ville de Montréal, *Arbres publics sur le territoire de la Ville* (the tree inventory), <https://donnees.montreal.ca/dataset/arbres>, datastore resource `64e28fe6-ef37-437a-972d-d1d3f1f7d891`, read through the CKAN `datastore_search` API with a full-text filter on the borough name, then clipped to the box. Retrieved October 2026.

**Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0). Attribution: *Source: Ville de Montréal, données ouvertes (CC BY 4.0).* The clip keeps every field of each record except the API's search ranking (`rank ARROND_NOM`).

## Format

Each file is one JSON object: `source` (dataset, URL, resource, licence, attribution, borough, and the SHA-256 of the raw extracts it was clipped from), `box_lat_lon`, `frame`, `count`, and `trees`, one record per line, sorted by borough and location number (`ARROND`, `EMP_NO`). The fields used:

| Field | Meaning | Used for |
| --- | --- | --- |
| `ARROND`, `EMP_NO` | borough number and the tree's location number in it | the row id `inv:<ARROND>-<EMP_NO>` |
| `Latitude`, `Longitude` | WGS84 position (`Coord_X`, `Coord_Y` are the same point in MTM zone 8) | the trunk, through `prepare_lafontaine.xy` |
| `Essence_latin`, `Essence_fr` | species | the tree kind (`TREE_SPECIES`, `TREE_GENERA` in `plateau_replica.py`) |
| `DHP` | trunk diameter at breast height, cm | the trunk and the height estimate |
| `Emplacement` | where it stands: `TRottoir` (sidewalk pit), `Banquette …` (verge), `Fond de Trottoir`, `Saillie Aménagée` (planted curb extension), `Parterre …`, `PArc`, `Terre-plein …` (median) | pit, extension or left in place |
| `Distance_pave` | distance from the trunk to the edge of the pavement, m | a pit's distance behind the curb, clamped to 65–80 cm |
| `Rue`, `NOM_PARC`, `INV_TYPE` | street or park, street (`R`) or off-street (`H`) tree | the row's street |

## Regenerate

From `games/nord-unreal`, with fresh datastore extracts (JSON lists of records, as `datastore_search` returns them):

```bash
python3 Scripts/plateau_replica.py --clip-trees pmr_extract.json vm_extract.json
```

The clip is deterministic: the same extracts give byte-identical files.
