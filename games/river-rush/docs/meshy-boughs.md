# Meshy shoreline boughs

The duck obstacles use a real Meshy 7.1 generated hardwood prop, including its
knotted core, irregular connected forks, broken stubs, sparse leaf sprays,
UVs and PBR maps. The same local assets now fit one coherent bank-grown tree
across one, two or three contiguous river lanes. `branch-spans.js` defines
coverage for the renderer and engine; the representative reward lane does not
change the tree's orientation or physical extent.

The low supporting shaft runs predominantly across the river with gentle sag,
rather than dropping from a high attachment into one hanging tip. The bank
attachment is only 1–1.8 units from the crossing station. Its prepared curved
bark core follows the same center curve as the generated knots, providing
substantial continuous wood at every covered lane center. Native underside
and depth offsets preserve duck clearance without surface clipping or flat
planes. The native halfway core reaches the far covered lane; outer twigs
extend at most another 0.65 units within the covered region.

Three, four or five asymmetrically spaced secondary forks grow from shared
main-shaft nodes for the respective span widths. They begin diagonally, fan
in both depth directions, split into smaller connected twigs, and support
foliage at their woody ends. The bank connector, trunk and low shaft share
endpoints. The generated prop adds its own irregular branching relief and
bark detail; the rounded supporting wood remains visible in the model-loading
fallback. Legacy center-only fixtures use an overhead connector to keep the
uncovered outer lanes clear.

The full prop has 4,907 triangles and the software variant 1,458. Both embed
WebP textures and meshopt compression in local GLBs (about 380 and 110 KiB).
The original generated model was 8.3 MB. No expiring generation URL is used
during play. The complete request, prompt, source URLs and unchanged runtime
SHA-256 digests are in `meshy-bough-sources.json`.

Fixed instanced batches hold at most 32 trees and 48 prepared wood/leaf parts
per tree, plus 32 generated boughs. Current span shapes use at most 43 woody
segments and 33 leaf clusters. Loading and shader preparation finish before
play; geometry, materials and instance buffers are recycled. The model shader
transforms normals with its stem deformation and the same course field as the
river. Materials use generated albedo, normal and surface maps with zero wood
and leaf metalness.

The geometry checks sample actual installed full/lite GLB vertices after
encoded node transforms, across six layouts, both banks, six seed/map profiles
and four course positions. They verify native wood at every covered center,
duck clearance, clear lanes, surviving fork relief, unchanged asset hashes,
embedded PBR resources and topology budgets. Shared tree checks verify shallow
sag, substantial connected shaft cross sections, diagonal secondary forks,
tertiary twigs, rooted foliage and reward-lane-independent orientation. Pool
checks verify fixed resource identity across repeated full-capacity updates.
Browser and release validation are recorded with the branch-spans OpenSpec
change.

The canvas renderer uses the same rooted tree anatomy and span contacts. The
3D loading fallback keeps the shared curved bark and connected leafy forks
playable if a generated model cannot load.
