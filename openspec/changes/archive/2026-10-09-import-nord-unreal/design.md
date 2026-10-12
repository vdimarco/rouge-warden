# Design

Use a standalone Unreal Engine 5.8.3 subdirectory so Warden's web deployment is unaffected. Keep cooked assets needed to open/build the project; source geographic and CC0 art inputs retain their provenance. Generated OBJ geometry can be recreated from the checked-in OSM snapshot. Local builds, caches, recovery files, and the generated Android file-server token are excluded. The unused AndroidFileServer plugin is explicitly disabled to prevent token regeneration.

The active map is LaFontaine. Its spawn is near 1334 Rue Sherbrooke Est. The current render uses Vulkan SM6, Lumen, virtual shadows, procedural façades, and detailed foreground trees. It is an open-data geographic reconstruction, not a Street View-identical scene. Multiplayer uses direct-IP listen-server sessions.

Verification reports copied from the source project record the previously completed 23 multiplayer checks, 13 collision checks, and map validation. Re-run launcher/data checks and build the editor from the imported path. Verify the saved map from that path. No internet, other OS/GPU, or web deployment claim is made.
