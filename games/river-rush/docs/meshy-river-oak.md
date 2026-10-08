# Native Meshy river oak

The shoreline obstacle uses a complete rooted oak section whose broad collar
flows into a crooked lateral limb, an unequal upper Y-fork, smaller sideways
and downward twigs, sparse broadleaf sprays and hanging strands. It replaces
the old flattened branch prop and its procedural rail/leaf overlays.

The source concept was generated with fal's current text-to-image recommendation,
`google/nano-banana-2.1`, then reviewed by the root agent and an independent
reference reviewer. Meshy 7.1 image-to-3D converted that exact approved concept
into a textured 10,590-triangle tree. Its actual native preview was accepted
before packing. An earlier text-only umbrella-tree result was rejected and
never became a runtime asset. Complete inputs, jobs, source URLs, estimates,
local source-image digest and final asset digests are recorded in
`meshy-river-oak-sources.json`.

## Native geometry

Packing bakes the source node world transforms and applies one positive
uniform scale, horizontal rotation and translation. The root becomes the
origin and the main reach points along +X. Native dimensions were
1.830 × 0.707 × 0.595; the rooted packed envelope is approximately
X −0.115..1, Y 0..0.430, Z −0.221..0.163. No stem baseline is subtracted,
no canopy or wood is sliced into a plane, and no outer X interval is collapsed
onto a tip. The full mesh retains the complete original triangle count.

`meshy-river-oak-native.json` records the exact transform and measured lower
woody triangle-plane sections. Their centers and bounds follow the actual
main sag, rising right fork and thin terminal twig network rather than the
upper canopy median. `nativeOakAnatomy` is also embedded in scene and mesh-node
extras for GLTFLoader. The lower terminal path naturally becomes fine twigs
near X 0.94–0.98; the Lite pack locks 182 nearby vertices to keep that network,
without inflating it or inventing a new terminal shape.

Runtime placement uses one affine body transform and root-only ground seating.
Covered contacts use the measured shaft descriptor. Native trees replace the
entire old procedural obstacle wood and foliage; the separate organic fallback
remains for missing models and canvas rendering. Runtime clearance, covered
lanes and actual phone/desktop appearance are checked independently of source
asset acceptance.

The river projects local course distance into world negative Z. Prepared mesh
clones reverse triangle winding and tangent handedness once to account for
that reflection. Their positions, UVs and original source geometry remain
unchanged. This keeps double-sided Lambert and PBR lighting oriented outward;
without it the visible bark was incorrectly shaded almost black.

## Prepared web assets

| Asset | Triangles | Bytes | Embedded maps |
| --- | ---: | ---: | --- |
| `meshy-river-oak.glb` | 10,590 | 2,004,232 | 2048 albedo, 1024 normal and surface maps |
| `meshy-river-oak-lite.glb` | 2,915 | 207,516 | 512 albedo, 256 normal and surface maps |

Both use local embedded WebP maps and meshopt compression. Generated albedo,
normal and surface-map detail remain; material colors receive no arbitrary
tint. Wood/leaf metalness is zero. Materials use matte roughness (0.92 packed, 0.93
in the runtime clone), with the generated roughness detail map retained.
No upstream generation URL is needed during gameplay. Source concept and
native preview PNGs are kept in `docs/` for future review; they are not runtime
loads.

`scripts/pack-river-oak.mjs` is the authoritative packer. With the downloaded
source GLB, reproduce the documented full/Lite packs using:

```sh
node scripts/pack-river-oak.mjs source.glb public/models/meshy-river-oak.glb 12000 2048 docs/meshy-river-oak-native.json
node scripts/pack-river-oak.mjs source.glb public/models/meshy-river-oak-lite.glb 3000 512 docs/meshy-river-oak-native.json
```

The historical `pack-bough.mjs` is explicitly retired. Its archived flattened
asset bytes/provenance remain, but its old runtime normalization helper no
longer describes the native tree pipeline.
