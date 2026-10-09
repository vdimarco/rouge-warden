# Design

Expand existing geographic data rather than regenerate gameplay. Use the cached municipal LOD2 tiles and mapped park outlines; retain attribution and explicitly estimated façades. Prefer instanced shared meshes for trees and furniture. Original resident and car meshes share the existing comic palette. Keep server authority for movement and interactions. Back up the saved map/source before edits.


The cottage crew has eight original six-part 3D models, matched to the user's supplied clothing/hair/props. Unchanged supplied PNGs act as face texture atlases. This gives recognizable illustrated faces within the available time; it does not sculpt photorealistic heads. Names remain descriptive until the user assigns them. Eleven total styles cover the crew and three mascots. Fourteen server-authoritative residents move on genuine mapped path segments, with held poses and private client dialogue. Outdoor emissive inks/text/lamps use daylight-scale values because unit emissive intensity disappears under EV12.5 exposure.

Unmeasured park buildings under 100 m² and service/shed/garage/roof types default to one 3.2 m storey. Explicit source heights/levels still take priority. Other unmeasured buildings retain the three-storey default. A roof collision probe checks the theatre service building.

The expanded survey's park-wide feature 2316936 is excluded: its 404 ground surfaces mix elevations and obsolete facilities. The final scene retains 1,161 individually usable municipal models and replaces 1,299 OSM footprints. The mapped current landmarks remain visible. Source geometry/roof atlases are intentionally retained for offline reimport; regenerated base OSM batches, builds and caches stay excluded. Linux packaged host/client checks verify 66 loaded resident parts, all 1,161 surveyed models, the composite's absence and rendered captures.
