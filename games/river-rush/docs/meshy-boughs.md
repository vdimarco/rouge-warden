# Meshy shoreline boughs

The shoreline duck tree now has a real Meshy 7.1 generated branch prop: a thick
knotted core, irregular connected secondary forks, broken stubs and sparse
leaf sprays. Its native cut end is on the right; packing reverses the stem
axis so that the thick end attaches to the visible midriver reach. Its main
core curves into the exact duck contact, with thin native offshoots confined
to that lane. Geometry keeps the generated topology, UVs and PBR maps.

The full prop has 4,907 triangles and the software variant 1,458. Both embed
WebP textures and meshopt compression in local GLBs (about 380 and 110 KiB).
The original generated model was 8.3 MB. No expiring generation URL is used
during play. The complete request, prompt, source URLs and runtime SHA-256
digests are in `meshy-bough-sources.json`.

One fixed instanced batch holds up to 32 boughs, in addition to the existing
shared trunk/leaf batches. Loading and shader preparation finish before play.
The original thick bank connector joins the fitted generated reach. Broad
upper forks replace tubular offshoots in the visible river portion. The Meshy
prop is the complete low limb; the previous cylindrical terminal is removed.
A shorter fitted span gives the knotted core real presence. The curve stays
high over clear lanes and descends into the exact x/y/d duck contact. Depth
offsets taper smoothly toward the low limb; compact native underside offsets
preserve duck clearance without flat clipping planes. No surface slicing or
second overlapping low tip is used.
The contact samples the prop's dense halfway core; thinner outer twigs extend
at most 1.5 units within the same lane. Measured central cross sections have
at least 0.35 units of woody thickness in both variants.
The model shader transforms normals with its stem deformation and the same
course field as the river. Materials use generated albedo, normal and surface
maps, with zero metalness for wood and leaves.

Checks sample every actual installed full/lite GLB vertex after the encoded
node transforms, across 72 shoreline/seed/lane combinations per variant,
including all three map profiles.
They verify duck clearance, safe lanes, exact low contact registration,
surviving upper forks, embedded
PBR resources, topology budgets, and fixed batch/resource identity across
100 pool updates. Existing curved tree anatomy checks also pass. Browser and
live verification are recorded with the wildlife-assault OpenSpec change.

If the generated model cannot load, the existing curved, locally textured tree
remains playable. The canvas fallback keeps the shared rooted branch shape.
