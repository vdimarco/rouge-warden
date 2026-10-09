# Current verification — 2026-10-09

Checked in the Warden project on Linux, Unreal 5.8.3, RTX 4090 / Vulkan SM6.

- Editor C++ module builds successfully, including the native resident and instancing actors.
- 27 two-player listen-server smoke checks pass: existing car entry/exit, driving, camera, handbrake, missions and recovery; all 14 residents and eight crew styles replicate, resident movement replicates, and client E dialogue reaches only that player without changing completed missions. `Smoke.json`.
- 13 collision regressions pass: actual street marking, a colliding 2 cm strip, 18 cm curb forward/reverse, and tall-wall blocking. `CarCollision.json`.
- 1,161 municipal building models replace 1,299 generic footprints. All imported model positions, source bounds, surveyed heights and material-section counts pass; spawn, car, address and a surveyed roof pass actual collision traces. The park-wide municipal composite 2316936 is excluded so current landmarks remain visible. One survey wall skirt extends 14.857 cm below its ground footprint; its imported bounds match the source. `LaFontaine.json`, `CityBuildings.json`.
- A fresh saved-map check verifies 4,586 trunk instances, 4,586 crown instances, 14 resident actors, all 66 resident part assets, disabled old tree batches and the parked fleet. Chalet, cultural-centre, theatre and single-storey service-building roof collision probes pass. `Park.json`, `ParkBuild.json`.
- Geographic source checks verify unique inventory IDs, 2,409 park trees, 14 distinct routes covered by actual OSM paths, 73 finite triangulated original meshes and valid UV references. City triangulation checks cover courtyard holes, vertical surfaces, degenerate rings, geographic origin and material batching.
- Launcher validation, Python syntax checks and whitespace checks pass.

Rendered checks use actual PIE at 1600×900: car, eleven resident styles, theatre, chalet, cultural centre, courts, pond and overview (18 images in `Preview/ParkComic*.png`). The original comic pass also checked 1280×720 views. The renderer uses daylight-scale emissive lamps, text, illustration faces and white ink. The final crop pass corrects the five poster faces and gives labels room above the character.

The Linux Development package builds successfully (2.1 GiB in local `Builds/Linux/`). Separate packaged host/client processes connect over loopback. Console inspection confirms all 66 resident parts and exactly 1,161 surveyed models load; excluded composite 2316936 is absent. Seven packaged render captures complete without missing park assets or cached shader warnings. `Package.json`. The package is excluded from Git.

OpenSpec CLI is unavailable; proposal/design/tasks/delta structure and WHEN/THEN scenarios are checked directly. Internet connectivity, latency/packet loss, late join, disconnect/reconnect, other GPUs/OSes, phone/browser/audio and two-person manual F2 play are unverified. This is a desktop Unreal game; there is no browser build. Trees/crown heights, façade details and landmark heights are estimates; illustrated face atlases are not sculpted heads. No Street View parity is claimed.
