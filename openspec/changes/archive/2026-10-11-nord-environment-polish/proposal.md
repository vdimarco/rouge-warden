# NORD environment appearance polish

Improve the trees and buildings in the integrated Montréal game from checkpoint `31e7ed09`, retaining the comic-book direction. Current packaged views show dense black leaf stipple, repeated sparse crown silhouettes and large generic background wall/window patterns. Close Sherbrooke brickwork, trim and exterior stairs are stronger and must remain intact.

## Scope

- Improve the existing mapped foliage's material, cutout and distant coverage. Limit comic-filter changes to foliage readability and observed sky/smooth pond-reflection banding; preserve comic treatment on crew, buildings, roads and vertical glass.
- Improve supported street and perimeter façade appearance using the existing surveyed shells and bounded nonblocking illustrated detail. Preserve the underlying source building footprints, roof geometry and height data.
- Correct Le Neuville at 1101 Rachel Est: replace its fallback 9.6 m visual massing with the retained municipal model `2317003`, whose measured survey extent is 57.44 m. Preserve the original OSM record `355385456` and gameplay collider; exclude this building from the generic low-rise façade candidates so a duplicate three-storey front is not layered onto the corrected exterior.
- Correct École Le Plateau's exterior using retained municipal model `2316935`: approximately 20.88 m main walls and 24.02 m maximum roof extent, in place of the 9.6 m fallback visual massing. Preserve OSM `27395533`, the original municipal assets and existing gameplay collider; keep classroom/masonry artwork explicitly estimated.
- Remove duplicate rendered fallback shells/window cards only for those two landmark OSM IDs using filtered owned visual copies. Hide only precisely recorded original NoCollision rendering components; keep their source assets, old gameplay colliders and all unaffected faces/materials/poses unchanged.
- Close observed cornice support gaps with bounded nonblocking fascia/endcaps and cover four confirmed exposed sides across OSM `356350796`, `345835052` and `356350765` using the existing decorative material batches.
- Compare walking-height Sherbrooke, tree close-ups, park/pond/chalet context, residential façades, Rachel/Le Neuville skyline and modern façade, École Le Plateau exterior, and both closed street boundaries using fresh native comic/F2 views.
- Preserve the current gameplay, HUD, crew, cars, population, saved progress, road graph, 4,571 mapped tree transforms and geographic attribution. Rebuild both matching packages and restore the existing browser host after meaningful QA.

This pass does not promise Street View identity, surveyed façade artwork, new terrain/cascade geometry, interiors, new missions, new character animation, a replacement renderer or a new deployment. Existing trailer/title media remain outside this pass. Any retained tree species/crown repetition, estimated façade detail, flat terrain and map-boundary limits must be reported honestly.

## Acceptance

Fresh matched views must show an observable improvement in foliage readability and the affected building surfaces, without checkerboard fallback, missing leaf masks, floating façade art, depth flicker or new route obstruction. Source/collision preservation, current package inventory, the unchanged six-scene Epic/100% p95 frame budget and real two-player browser media/input checks are separate gates. Compilation and screenshot creation alone do not establish visual quality.
