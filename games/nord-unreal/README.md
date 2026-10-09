# NORD — Parc La Fontaine, Montréal

A playable Unreal Engine 5.8.3 neighborhood centered on Parc La Fontaine and **1334 Rue Sherbrooke Est**. Walk, drive, and complete three shared park exploration objectives with friends.

The map uses OpenStreetMap geography: 1,663 building footprints, two ponds, 157 road ways, 1,209 pedestrian/cycle path ways, and 4,571 mapped trees across approximately 1.1 km². Spawn is on the pedestrian path nearest the address, with the car on Rue Sherbrooke Est. The minimap, objectives, and recovery points use the same coordinates.

The graphics pass adds CC0 asphalt/brick/grass/paving textures, Lumen lighting/reflections, virtual shadow maps, reflective car finishes, moving water normals, 215 Nanite broadleaf trees near the starting address, and 40 mapped benches. More distant trees remain simple autumn models. It requires a Vulkan SM6-capable GPU.

This is a geographically grounded first pass with procedural façades, estimated building heights and street widths, and flat terrain. It does not reproduce the building interior, player likeness, or personal ambitions. Ponds are visual surfaces; swimming is not implemented. No Grand Theft Auto source or Google imagery is included. See [geographic sources and limitations](Data/LaFontaine/README.md).

## Play

Run from the project directory:

```bash
./Scripts/launch.sh play
./Scripts/launch.sh editor
./Scripts/launch.sh host
./Scripts/launch.sh join 127.0.0.1:7777
```

The launcher uses `Builds/Linux/Quebec.sh` when a Linux package exists, otherwise the installed Unreal Editor in game mode. Editor mode starts this project's MCP service on port 8001.

| Control | Action |
| --- | --- |
| WASD | Walk; drive and steer while in a car |
| Mouse | Look around |
| Left Shift | Sprint on foot |
| Space | Jump on foot; hold handbrake while driving |
| E | Enter/exit a nearby car; interact with a mission marker within 5 m |
| S in car | Brake/reverse |

Follow the on-screen mission objective. Progress is shared for the current server session and resets when the host restarts the map.

The driving camera follows turns after two seconds without mouse input and widens slightly with speed. Wheels steer and spin; bumpers, mirrors, and rims add detail to the car. The HUD includes a road map, parked-car markers, a nearby-car prompt, handbrake status, and a shared mission-completion notification.

## Friends joining

The host runs `./Scripts/launch.sh host`. Friends run the same build with `./Scripts/launch.sh join HOST:7777`, replacing `HOST` with the host's reachable IPv4 address or hostname. Use a LAN address for local play or a reachable public address for internet play. The host must accept incoming UDP traffic on port 7777; router/NAT and firewall configuration may be required. The launcher does not change network settings.

This is direct-IP listen-server support. Matchmaking, accounts, invite links, relay/NAT traversal, persistent servers, and public deployment are not implemented. A local test does not verify internet connectivity. The session ends when the host exits.

## Build and regenerate the map

The engine is installed at `/home/von/.local/share/Epic/UE_5.8.3`. Build the editor module before launching:

```bash
ue_root=/home/von/.local/share/Epic/UE_5.8.3
"$ue_root/Engine/Build/BatchFiles/Linux/Build.sh" QuebecEditor Linux Development "$(pwd)/Quebec.uproject" -WaitMutex -NoUBA -NoHotReloadFromIDE
```

The active map is `/Game/Maps/LaFontaine`; the original blockout remains at `/Game/Maps/Quebec`. Source/config recovery copies are in `Saved/Recovery/pre-lafontaine`. To regenerate the geographic map, first preserve the current LaFontaine map and close this project's editor. Run `python3 Scripts/prepare_lafontaine.py`, rebuild the editor module (the generated header contains gameplay coordinates), then run:

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" -ExecutePythonScript="$(pwd)/Scripts/create_lafontaine.py" -unattended -nop4 -NullRHI
```

Next run `Scripts/upgrade_lafontaine_graphics.py` with `/Game/Maps/LaFontaine` loaded to apply textures, detailed foreground trees, and furniture. Sources are documented in [Data/Art/README.md](Data/Art/README.md).

The generator refuses to overwrite an existing map. The original generator `Scripts/create_world.py` is retained only for prototype recovery. Duplicate or move the existing map before rebuilding. To distribute a build, package the project for your friends' operating systems through Unreal's Platforms menu. Each friend needs the matching packaged build; the source project alone is not a standalone download.

## Visual fidelity and personalization

The Google pin was used to identify the address. Geometry comes from the checked-in OpenStreetMap snapshot, not Google Earth extraction. Geographic source and derived map data are provided under ODbL 1.0, with attribution visible below the in-game minimap. [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

Google photorealistic streaming through [Cesium for Unreal](https://cesium.com/learn/unreal/unreal-photorealistic-3d-tiles/) remains an optional future visual layer requiring an account connection. It is not installed or active. Ground-level fidelity and interiors require further reference data. The three objectives are public park exploration prompts; no personal aspirations were invented.

## Testing

The editor and Linux package build successfully. Map generation checks confirm four player starts; source validation checks both ponds, the address, and geographic feature counts. The mission proximity automation test and launcher checks pass. All 23 two-player listen-server smoke checks pass, including host/client entry and exit, replicated driving, camera follow/FOV, handbrake hold/release, mission progression, and fall recovery; the report is saved to `Saved/Tests/Smoke.json`. Separate packaged host/client processes also connected successfully on loopback.

All 13 vehicle collision checks pass: the car crosses an existing street marking, a colliding 2 cm strip, and an 18 cm curb forward and in reverse, while a tall wall still blocks it. Results are saved to `Saved/Tests/CarCollision.json`. Decorative meshes use explicit collision profiles so loading the map preserves their settings. The arcade car can step onto low surfaces with a 30 cm trial lift.

Run the gameplay smoke test with this project's editor closed:

```bash
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -RenderOffscreen -unattended -ExecutePythonScript="$(pwd)/Scripts/smoke_test.py" -nosound
"$ue_root/Engine/Binaries/Linux/UnrealEditor-Cmd" "$(pwd)/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -RenderOffscreen -unattended -ExecutePythonScript="$(pwd)/Scripts/car_collision_test.py" -nosound
python3 Scripts/test_launcher.py
```

Internet connectivity, latency/packet loss, late join, and disconnect/reconnect have not been verified. Only Linux is packaged. The arcade car uses server movement without client prediction, so driving may feel delayed over a high-latency connection. The upgraded renderer requires Vulkan SM6; performance on other computers has not been verified. Scripts/verify_lafontaine.py validates map orientation, scale, and actual collision at the spawn, car, and address building; its report is Saved/Tests/LaFontaine.json.
