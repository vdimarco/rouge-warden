# Plateau replica streetscape

Not yet imported or verified on the host. Everything here was generated and checked on the CPU, without Unreal and without a GPU. The host import, the fresh-load verify, the curb-parking, car-collision and traffic checks, the captures and the frame-time profile are all still open.

This folder holds the layers that make the La Fontaine map read as the Plateau at street level. Every layer sits in its own folder with a `manifest.json` that uses one schema: `layer`, `generator`, `frame`, `batches[]` (`file`, `mesh`, `material`, `collision`, `triangles`, `bounds_cm`, `sha256`), `materials{}` (`base_color_srgb`, `roughness`, `metallic`, optional `texture` and `emissive_*`), `counts` and `source_sha256`. The frame is the existing map frame: x east, y north, z up, centimetres (`prepare_lafontaine.xy`). The world is mirrored (see `openspec/changes/nord-gta-level-up/design.md`), and these layers keep that frame so they line up with gameplay.

| Layer | Generator | What it is |
| --- | --- | --- |
| `Streets/` | `Scripts/plateau_replica.py` | Carriageways cut to curb lines measured from the mapped sidewalks, Québec paint, grey concrete sidewalks with an 18 cm curb, parterres with low iron fences, tree pits, ruelle surfaces, bike-track bollards |
| `Furniture/` | `Scripts/plateau_replica.py` | `placements.json` only: lamps, hydrants, ARRÊT signs, white street-name signs, one-way and parking signs, BIXI docks with bikes, benches, bins, mail boxes |
| `Soul/` | `Scripts/plateau_replica.py` | Seeded wear and life: asphalt patches, sealed cracks, potholes, leaf drifts, weeds, rust streaks, original colour-block murals, ruelle wires and laundry, plus `placements.json` for cones, the chantier fence, utility poles, curb bins and locked bikes |
| `Plex/` | `Scripts/plateau_plex.py` | Plex fronts on the plain buildings (see `Plex/` files) |
| `Props/` | `Scripts/blender/plateau_props.py` | The prop meshes that Furniture and Soul instance (see `Props/README.md`) |

The OBJ files are generated and git-ignored (`ReplicaGeometry/**/*.obj` in `games/nord-unreal/.gitignore`). The manifests, placements and READMEs are committed. Generation is deterministic: two builds are byte-identical, and every OBJ hash is in its manifest.

## Regenerate and check (any machine, stdlib Python)

From `games/nord-unreal`:

```bash
python3 Scripts/plateau_replica.py         # about 15 s: Streets, Furniture, Soul
python3 Scripts/test_plateau_replica.py    # about 40 s: builds twice into temp dirs, then checks
python3 Scripts/apply_plateau_replica.py --dry-run   # the import plan, from the manifests only
```

Run `plateau_plex.py` and the Blender props build first if those layers are missing; the replica layers read `Props/manifest.json` for the BIXI slot positions, the utility-pole wire anchors and the locked-bike lean point, and fall back to the agreed defaults when it is absent.

`test_plateau_replica.py` checks: byte-identical output across two builds; the manifest schema and every OBJ hash, triangle count and bound; no triangle that collapses in float32; asphalt at z 7.0 and paint 0.1–0.2 cm above it; sidewalk tops at 18 cm (ramps and dropped curbs aside); no collision within 300 cm of any of the 663 traffic segments; traffic curbs at least 540 cm from their centreline; measured curb-to-curb widths per street; one stop bar and one ARRÊT sign per mapped stop on the network; painted crosswalks against the styled OSM crossings; lamps and hydrants one-to-one with the OSM nodes; street-name text from OSM names; BIXI bikes exactly in the MAP-PROPS slots; emissive prop materials in the apply plan; every Soul ingredient present and no repeated bin arrangement between blocks; triangle and batch budgets.

## Import on the host (editor Python)

`Scripts/apply_plateau_replica.py` is additive and refuses to run twice: it stops if any actor label starts with `Plateau replica ` or if `/Game/Plateau/Replica` exists. Run it in a fresh `-NullRHI` editor with the saved map loaded and no unsaved packages:

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
cd games/nord-unreal
python3 Scripts/plateau_replica.py && python3 Scripts/test_plateau_replica.py
backup="$(pwd)/Saved/Recovery/plateau-replica-$(date +%Y%m%d-%H%M%S)"
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine \
  -NullRHI -Unattended -NoP4 -NoSound -ExecutePythonScript="$(pwd)/Scripts/apply_plateau_replica.py" \
  -NordPlateauReplicaBackup="$backup"
# Verify in a new process with the same backup path:
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine \
  -NullRHI -Unattended -NoP4 -NoSound -ExecutePythonScript="$(pwd)/Scripts/apply_plateau_replica.py" \
  -NordPlateauReplicaBackup="$backup" -NordPlateauReplicaVerify
```

Add `-NordPlateauReplicaDryRun` (no backup needed) to log the plan without changing anything. The log lines to look for are `PLATEAU_REPLICA_OK` and `PLATEAU_REPLICA_PLAN`.

What the apply step does:

- **Preflight.** Checks the OBJ hashes against the manifests, the OSM source hash, the base materials, the required editor APIs and the fresh backup path inside `Saved/Recovery`.
- **Backup.** Copies `Content/Maps/LaFontaine.umap` and its sidecars into the backup folder, with `original-actors.json` and `backup-manifest.json`.
- **Materials.** It never rebuilds an existing `M_*`; rebuilding strips the NordSky wet-street and night wrappers. Each manifest material becomes `/Game/Plateau/Replica/Materials/M_Replica_<Layer>_<key>`, a duplicate of an existing parent with its single tint set:
  - Asphalt duplicates `M_Asphalt`, keeping the world-space texture and the wet wrapper. Its tint is the target colour divided by the texture mean.
  - Ground surfaces (sidewalk, curb, yard, patches) duplicate `M_ConcreteDark`, which keeps the wet wrapper.
  - Brick duplicates `M_BrickRed`.
  - Emissive prop materials (`emissive_srgb`, `emissive_strength` in `Props/manifest.json`: the 3000 K lamp lens, the park globe, the BIXI screen, the amber flasher and the light-bar lenses) duplicate the emissive-capable `M_Glow`. The duplicate gets emissive = colour × an `EmissiveStrength` scalar parameter.
  - Everything else duplicates `M_Trim`.
  - If a parent does not have exactly one tint node, a fresh constant material with the same colour, roughness and metallic is created instead.
- **Meshes.** Each batch is imported with the `upgrade_plateau.import_mesh` options into `/Game/Plateau/Replica/<Layer>/SM_<batch>`, with Nanite on (exact fallback), 64 Lumen cards, and complex-as-simple collision on collision batches. Props land in `/Game/Plateau/Replica/Props`, where `QuebecLife.cpp` looks for the companions.
- **Actors.** One `StaticMeshActor` per batch, labelled `Plateau replica <Layer> <batch>`, in the `Replica/<Layer>` folder, at identity. Collision batches get `BlockAll`; the others get `NoCollision`. Paint, decals and flats have shadows off.
- **Instances.** Furniture and Soul placements become one `HierarchicalInstancedStaticMeshComponent` per prop part and collision class. Each component sits on a plain actor added through the `SubobjectDataSubsystem`, with cull distance 90–120 m. The editor path for adding components was not tested here.
- **Street names.** Black `TextRenderActor`s on both faces of each blade, at the `text_slots` of `Props/manifest.json`, with the small generic over the large specific. If a text renders mirrored, turn it 180° about Z (see `Props/README.md`).
- **One existing actor changes.** `OSM Marking` is hidden in game, because its old centre dashes would poke through the new asphalt. Its collision and transform are unchanged, and the change is recorded in `apply-report.json`.
- **Save and report.** Saves the level and writes `apply-report.json` to the backup folder. `verify` reloads in a fresh process and writes `verify-report.json`. It checks every actor's mesh path, triangle count, Nanite, collision profile and material, every HISM instance count, the street-name text count, the emissive parameters and the hidden `OSM Marking`.

### Recovery

1. Close the editor.
2. Copy `<backup>/Content/Maps/LaFontaine.*` back over `Content/Maps/`.
3. Delete `Content/Plateau/Replica/`.
4. Confirm with `Scripts/verify_plateau.py` on a fresh load.

A failed apply leaves its partial state and `apply-report.json` with the error in the backup folder. Restore before retrying, because the script refuses to run over existing replica actors or assets.

### Host checks still owed

- `verify_plateau.py` and this layer's `-NordPlateauReplicaVerify`.
- `car_collision_test.py` (`18cm_curb_*`, `CurbParking`).
- `population_test.py` and `test_race_drive.py`. District-wide curbs move where the 32 runtime parked cars land.
- Captures from the manifest cameras: Mentana, Fabre, Rachel at the park, Papineau and Sherbrooke.
- `profile_package.py`, where p95 must stay under 16.67 ms.
- Cook.

## Rules the Streets layer keeps (runtime couplings)

- **Road meshes.** Road surfaces are `SM_Asphalt_Replica_*` (carriageways) and `SM_Asphalt_Replica_Alley_*` (ruelles), with no collision. `QuebecGameplay.cpp` promotes `SM_Asphalt*` to Visibility-only at BeginPlay, so cars and people still stand on the z 0 floor. The asphalt is at z 7.0, 1 cm over `OSM Road`; ruelles are at z 6.8.
- **Sidewalks.** Sidewalks and corner rings are `SM_Concrete_Collision_Replica_*` with complex collision and the top at 18.0 cm, inside the 17–25 cm curb-parking window. Curb ramps drop to 9 cm within 1.1 m of each crossing.
- **Curb distance.** The nearest curb of every traffic segment is at least 550 cm from its centreline; runtime parking needs 540 cm. Measured offsets are clamped up to that, so Mentana is 11.0 m from curb to curb instead of about 10 m.
- **Traffic band.** No collision lies within 300 cm of any traffic segment. Sidewalk pieces that would intrude, for example at driveways or at ruelles in the traffic graph, become visual-only dropped-curb aprons at z 9. Props with collision inside the band keep their position but lose collision; the 56 that sat in a carriageway are moved to the curb.
- **Visual-only geometry.** Paint, bollards (flexible, as on the real street), fences, tree pits and every Soul mesh have no collision. Parterre yards are collision slabs at 18 cm, so feet do not sink into the lawn.

## Method and sources

- **Curb lines.** Every drive way inside the district is clipped to the boundary. Junctions are kept, and the polylines between them are simplified, because OSM splits ways at every crossing node. Every 6 m a perpendicular ray finds the parallel `footway=sidewalk` and the nearest façade. The curb offset per way side is the median sidewalk-centre offset minus half the sidewalk width: 1.9 m residential, 2.6–3.2 m arterial. The offset is capped by class, so a park promenade is not taken for roadway. Unmeasured sides use class defaults. Results: Rachel 14.0 m, Papineau 17.1, Sherbrooke 21.0, Fabre 12.9, Garnier 13.4, Mentana 11.0.
- **Junctions.** Arms are sorted by angle. Each corner gets a curb fillet: 3.6 m on residential corners and 5.2 m on arterials, shortened on short arms. The sidewalk fills to the sharp property corner. Near-straight joins use a mitre. Junction pavement is a star polygon around the node.
- **Paint** (Québec, *Marques sur la chaussée*):
  - Yellow centre line on two-way streets, double where there are 4 or more lanes; white lane lines.
  - White parking edge lines where OSM tags parking lanes and on arterials.
  - White 40 cm stop bars at the mapped `highway=stop` nodes and on signalised approaches.
  - Crosswalks: white blocks or two white lines where signals or stops control the crossing, yellow blocks on uncontrolled marked crossings. A two-line crosswalk is generated at a mapped stop with no crossing mapped near it.
  - Green conflict zones and white bike symbols on on-street cycle tracks. 1.16 m green `VC-BA-1` bollards every 4 m on the traffic side of the Rachel, Brébeuf and Cherrier tracks.
  - Dash lengths and widths are estimates, because MTQ Tome V was not retrieved.
- **Ground detail.** Sidewalks have 1.5 m saw-cut joints and a light 15 cm curb band. Manholes and storm drains are placed per block. Parterres are cut per 7.6 m lot, and their depth stops 3 cm short of the façade. Each lot gets lawn or a soil bed and a walkway; plex streets get low picket fences with a gate gap. Lawn edges spill jittered grass over the sidewalk edge, so the seam is not a ruler line. Tree pits sit at the OSM tree nodes that fall on a sidewalk, with an iron frame and a low hooped fence on some.
- **Seeds.** Every choice is seeded by SHA-256 of stable OSM ids through SplitMix64, so neighbouring blocks differ and every run repeats exactly.
- **Soul layer.** It follows the owner's reference, Alex Lingris, "City building games have a Soul Problem pt.2" (Radical Elements, 2026): wear, clutter and traces of life produced by procedural rules. One chantier zone sits in a parking lane. The murals are original compositions (split colour grids, a disc, triangles), one per 150 m at most, on exposed side walls; no existing artwork is copied. Rust streaks hang below the balcony line on street-facing walls; the plex stair positions were not known when they were generated.
- **Technique sources.** OSM2World's tag-driven road markings and Streets GL's procedural roads were adapted as ideas only; no code was taken. Junction fillets are standard curb-return geometry. The existing `plateau_streets.py` route kit was the model for the slabs, ramps and alley treatment.
- **Data.** `Data/LaFontaine/osm.xml` (© OpenStreetMap contributors, ODbL 1.0) and the read-only traffic graph in `Data/LaFontaine/layout.json`. Dimensions and palette come from `research-plateau.md` (Plateau heritage sheets, the Ville de Montréal sign inventory, Québec marking rules).

## Limits

- **Mapped stops only.** OSM maps only 26 stop nodes inside the district (21 on the replica network), not the 77 of the whole snapshot. Most Plateau junctions are all-way stops in reality, but only mapped stops get ARRÊT signs and bars.
- **Missing props.** There is no traffic-signal prop yet, so the 236 signal nodes have no poles. Parking-sign text is part of the prop mesh; it is not per pole.
- **The Panet/Visitation route is skipped.** The route within 64 m of `prepare_plateau.ROUTE` keeps its own detailed streets.
- **Avenue du Parc-La Fontaine.** It has few mapped sidewalk samples, so most of its sides use the clamped default.
- **No terrain.** The ground is flat; curb faces drop to z 0.
- **Mirror fix.** When the mirror fix lands, negate y in every batch and placement. For prop instances, negate only position y and yaw, never scale (see `Props/README.md`).
- **Text only in the editor.** The street-name `TextRender`s are not visible in the top-down CPU previews.
