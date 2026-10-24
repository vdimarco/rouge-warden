# Inventory: the city's public trees, sign poles and parking signs over the district

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

## Sign poles

`sign_poles.json` (1,449 poles carrying 1,311 signs) is a clip of two Ville de Montréal datasets over the same box: every pole of the sign-pole inventory whose latitude and longitude fall inside it, with the signs that hang on it now. `Scripts/plateau_replica.py` reads it for the residential streets' lights and wooden poles and for the poles the junction signs hang on.

**Sources:**
- *Poteaux de signalisation*, <https://donnees.montreal.ca/dataset/poteaux-signalisation>, datastore resource `091a3d3a-716c-44d7-b1c0-3144d6953f66`: one row per pole with its kind (`DESCRIPTION_RTP`). The table has no borough field, so the extract is every record, read through `datastore_search` in pages of 32,000, then clipped to the box.
- *Signalisation routière (excluant le stationnement)*, <https://donnees.montreal.ca/dataset/panneaux-de-signalisation>, datastore resource `1f610cd7-c85d-46d8-9c98-86e3f550ee4c`: one row per sign with its pole, read with a full-text filter on the borough name (`NOM_ARROND`). Parking signs are in another dataset and are not used.
- Retrieved October 2026. The CSV downloads of both datasets go through a storage host the cloud proxy blocks; the datastore API works.

**Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0). Attribution: *Source: Ville de Montréal, données ouvertes (CC BY 4.0).* The clip keeps every field of each pole except the datastore's row id (`_id`), which changes when the city reloads the table.

| Field | Meaning | Used for |
| --- | --- | --- |
| `POTEAU_ID_POT` | pole id | the row's `city_pole` in `Furniture/placements.json` |
| `DESCRIPTION_RTP` | pole kind: `4- Poteau en bois` (wooden utility pole), `3- Fût` (steel standard), `10- Fût et feux` (signal pole), `1-`/`2- Tige` (sign post), and others | wooden poles become utility poles with a cobra head, steel ones cobra-head lights (`POLE_KINDS`) |
| `LATITUDE`, `LONGITUDE` | WGS84 position | the pole, through `prepare_lafontaine.xy` |
| `PAS_SUR_RUE` | `1` for a pole off the street | left out |
| `signs` | the signs on the pole now (`DESCRIPTION_REP` `Réel`): `CODE_RPA` (`NR-U` street name, `RA-A` ARRÊT, `RN-A` one-way, ...), `DESCRIPTION_RPA`, `TOPONYME_PAN` (the street of a street-name sign), `FLECHE_PAN`, `POSITION_POP` (place on the pole), `DESCRIPTION_CAT` | which junction signs hang on the pole |

Regenerate from fresh extracts (JSON lists of records, as `datastore_search` returns them):

```bash
python3 Scripts/plateau_replica.py --clip-sign-poles poteaux_extract.json signalisation_extract.json
```

The clip is deterministic: the same extracts give byte-identical files.

## Parking signs

`park_signs.json` (709 poles carrying 1,158 signs) is a clip of the city's on-street parking-sign inventory over the same box: every sign that stands now (`DESCRIPTION_REP` `Réel`), grouped by its pole, the poles sorted by id and their signs by place on the pole. `Scripts/plateau_park_signs.py` writes and reads it. `Scripts/plateau_replica.py` puts a parking sign at each pole on a street the replica draws, with that pole's codes, texts and arrows, and `Scripts/plateau_parking.py` reads the signs at one moment (a Wednesday at 12:30 in late October) to decide where cars stand.

**Source:** *Signalisation (stationnement sur rue)*, <https://donnees.montreal.ca/dataset/stationnement-sur-rue-signalisation-courant> (also on Données Québec, <https://donneesquebec.ca/recherche/dataset/vmtl-stationnement-sur-rue-signalisation-courant>): one row per parking sign with its pole. The extract is the borough's records as `datastore_search` returns them, read in October 2026; `source.extract_sha256` gives its hash. The city warns that the data may differ from the street in places.

**Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0). Attribution: *Source: Ville de Montréal, données ouvertes (CC BY 4.0).*

| Field | Meaning | Used for |
| --- | --- | --- |
| `POTEAU_ID_POT` | pole id (the same ids as `sign_poles.json`) | the row's `city_pole`; a sign hangs on that pole where the game draws it |
| `DESCRIPTION_RTP` | pole kind | none (the drawn poles come from `sign_poles.json`) |
| `Latitude`, `Longitude` | WGS84 position | the pole, through `prepare_lafontaine.xy` |
| `PAS_SUR_RUE` | `1` for a pole off the street | left out |
| `signs` | `CODE_RPA` (`R-PF` permit parking, `SU-*` street cleaning, `AD-TT` no stopping, `SD-TT` no parking, ...), `DESCRIPTION_RPA` (the text, `\P` for no parking and `\A` for no stopping), `FLECHE_PAN` (0 no arrow, 2 left, 3 right, 8 both), `POSITION_POP`, `PANNEAU_ID_PAN`, `DESCRIPTION_CAT` | the plate's code, text and arrow; the parked cars' rules |

Regenerate from a fresh extract (a JSON list of records):

```bash
python3 Scripts/plateau_park_signs.py --clip stationnement_extract.json
```

The clip is deterministic: the same extract gives a byte-identical file.
