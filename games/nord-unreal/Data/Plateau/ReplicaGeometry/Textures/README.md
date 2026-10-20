# Textures: replica surface sets

`python3 Scripts/plateau_textures.py` writes this folder: 16 tileable texture sets of three PNG maps each, and `textures.json` (sizes, tile sizes, UV tiling, mean linear colour, mean roughness, the material each set needs, the shared material keys that take it, import settings, and two SHA-256 hashes per map). `python3 Scripts/test_plateau_textures.py` checks it, and `python3 Scripts/plateau_textures.py --check` compares the folder with a fresh build. The generator uses only the standard library and writes the same pixels on every run and platform: sines and cosines come from a fixed polynomial, not the C library. The sets build in parallel worker processes (about 20 s on four cores, about a minute on one); the output does not depend on it. The compressed PNG bytes can differ with the zlib build, so the apply step checks `raw_sha256`, the hash of the decompressed image stream.

## Sets

| Set | Keys | Size | Tile | Material | What it is |
| --- | --- | --- | --- | --- | --- |
| `limestone` | `Stone` (name rule) | 1024² | 2.56 m | wall | Montréal greystone laid as rock-faced ashlar: 8 courses of 29 to 36 cm, 3 or 4 stones of 52 to 118 cm per course (the generator allows 2 to 4 stones of 45 to 130 cm), joints of neighbouring courses at least 15 cm apart, 1 cm mortar joints. |
| `slate` | `Slate` (name rule) | 512 x 1024 | 1 m x 2 m | wall | Fausse-mansarde slate: 20 cm slates laid half-bond in 16 rows of 12.5 cm exposure, blue-grey with some purple and green slates, and a band of three fish-scale rows. |
| `membrane` | `Roof_Membrane` | 512² | 2.44 m | ground | White single-ply roof: one 8 ft sheet per tile with a 10 cm welded lap (4 cm weld, a bleed-out bead and a dirt line at the step), 4 x 8 ft insulation boards showing through, ponding stains with faint tide lines, grit, one welded repair patch. |
| `ballast` | `Roof_Gravel` | 512² | 1 m | ground | White gravel ballast: two layers of rounded white, cream and light-grey stones of 1.6 to 3 cm over dark grit, about 80% stone. |
| `tar` | `Roof_Tar` | 512² | 1 m | ground | Tar and gravel: black, slightly glossy tar (roughness about 0.4) with small grey, white, tan and dark gravel sunk into it (about 40% shows), dust patches and old shrinkage cracks. |
| `sheet_metal` | `Sheet_Metal` | 512² | 1 m | wall | Corrugated galvanised steel: 14 corrugations per metre, 1.27 cm deep, crests along v; spangle cells, a side lap, screws with neoprene washers on every second crest at two purlins, dull patina, white rust and rust runs below some screws. `textures.json` suggests metallic 0.85; the apply step uses the manifest's metallic. |
| `siding` | `Siding_Lap_Cream`, `Siding_Lap_Grey` | 1024 x 512 | 2.4 m x 1.2 m | wall | Lap siding in neutral off-white for any paint: 12 courses of 10 cm (4 in), each a wedge from 0.3 cm at the top to 1.2 cm at the butt, the lap shadow under every butt, one butt joint per course staggered by 40 cm or more, embossed grain, weathering. |
| `parging` | `Parged` | 512² | 2 m | wall | Parged concrete for rear and lane foundations: sandy cement render with trowel arcs, three repair patches, efflorescence and hairline cracks. |
| `balusters` | `Rail_Baluster` | 512² | 1 m along the run, one card high | cutout | Gallery guard card, drawn for a 107 cm guard: a 5 cm drain gap, a 2x4 bottom rail (5 to 13.9 cm), 2x2 balusters at 12.5 cm centres with 8.7 cm clear between them (under 10 cm), a 2x4 top rail (94.3 to 103.2 cm) and a 2x2 cap; painted, worn at the edges, screw heads at the ends. |
| `lattice` | `Rail_Lattice` | 512² | 1 m along the run, one card high | cutout | Diagonal lattice drawn for a 1 m card: 3.8 cm laths at plus and minus 45 degrees in two layers, 9 per metre along the run (4.1 cm square openings), stapled at the crossings, in a 5 cm frame top and bottom. |
| `fence_boards` | `Fence_Boards` | 1024 x 512 | 2 m along the run, one card high | cutout | Board fence drawn for a 1.8 m card: 12 weathered boards per 2 m (14.6 cm wide, 1.8 to 2.5 cm gaps), uneven tops, boards stopping 1 to 4 cm above the ground, knots, nails with some rust, damp and green algae at the foot, and two 2x4 rails (22 to 31 cm and 149 to 158 cm) seen through the gaps. |
| `creeper` | `Leaf_Creeper` | 1024² | 2 m | foliage | Virginia creeper (vigne vierge) in October, about 80% cover: 900 palmate leaves of five serrated leaflets of 6 to 11 cm on red petioles, over seven woody vines. Scarlet, crimson and wine leaves, some orange, and about 9% still green, reddening from the margin; lower leaves are shaded. The holes show the wall. |
| `lawn` | `Yard_Grass` | 512² | 2 m | ground | An October lawn from above: about 75,000 blades over soil with thin patches, some yellowed and dead blades, clover, and 34 fallen maple leaves. |
| `pavers` | `Yard_Pavers` | 512² | 1.2 m | ground | Concrete pavers (pavé uni), 10 x 20 cm in a 90-degree herringbone, a grey, charcoal and beige blend with 0.7 cm chamfers, sand joints with moss in places, aggregate speckle and stains. |
| `soil` | `Yard_Soil` | 512² | 2 m | ground | Garden-bed soil: crumbly clods, a few pebbles, straw and wood bits, damp patches and nine fallen leaves. |
| `crushed_stone` | `Yard_Gravel` | 512² | 1 m | ground | Grey crushed limestone (3/4 in net): angular chips of 1.4 to 2.6 cm in two layers over dusty fines. |

The keys are the shared material keys of the rear pass. `plateau_plex.py` and `Scripts/apply_plateau_replica.py` use exactly these names (case-sensitive); `Stone` and `Slate` keep the apply step's older name rule. Both siding keys share one set: the material tints it cream or grey.

## Maps and UVs

- `diff` is sRGB base colour. The material multiplies it by the target colour divided by `mean_linear`, capped at 8. The sets made to be painted (siding, parging, sheet metal, balusters, lattice, fence boards, pavers) are near-neutral, so any paint colour works. The others carry their own colour; `base_color_srgb` in `textures.json` is the texture's mean, and a manifest colour near it gives a tint of about 1.
- The cut-out sets (`balusters`, `lattice`, `fence_boards`, `creeper`) have an RGBA `diff`: A is the opacity mask, anti-aliased about the 0.5 clip, and `coverage` in `textures.json` is the share of texels over it. Their means count only those texels. Under the holes the colour is the surface's own, so filtering never pulls a dark halo into an edge.
- `nor_dx` is a tangent-space normal map in the DirectX convention (green down), like the Poly Haven `_nor_dx` maps in `Data/Art`.
- `rough` is linear: R is roughness, the channel the brick-style material reads. G is height and B is cavity (1 in joints, gaps and holes).
- Image row 0 is the top of the tile. Replica OBJ UVs are in metres (u along the face and v = z on walls; u = x and v = y on roofs and the ground), so the tiling is 1 / tile size.
- Cards (`uv: "card"`): u is metres along the run and v runs from 0 at the bottom of the card to 1 at its top, so the v tiling is 1 and the texture spans the card once. `card_height_m` is the height it was drawn for; a much shorter or taller card squashes or stretches the drawing (the lattice diamonds most).
- `sheet_metal`: the crests run along v, so on a roof whose v runs up the slope the corrugations run down it, as they are laid. The rust runs go toward increasing image rows, down the slope.

## In the apply step

`Scripts/apply_plateau_replica.py` imports the sets the manifests use to `/Game/Plateau/Replica/Textures` and gives each key a duplicate of its surface's parent with these maps swapped in, the tiling set and the tint set:

| Surface | Parent | Sets |
| --- | --- | --- |
| wall | `/Game/Plateau/Materials/M_BrickRed` | limestone, slate, sheet_metal, siding, parging |
| ground | `/Game/Plateau/Materials/M_Gravel`, which carries the NordSky wet-ground wrapper, so roofs and yards darken in rain | membrane, ballast, tar, lawn, pavers, soil, crushed_stone |
| cutout | `/Game/Plateau/Replica/Materials/M_Replica_CutoutParent`, built by the apply step: masked, two-sided, clip 0.5, OpacityMask from the `diff` alpha | balusters, lattice, fence_boards |
| foliage | `/Game/Plateau/Replica/Materials/M_Replica_FoliageParent`, built the same way with the two-sided foliage shading model and SubsurfaceColor = base colour x 0.65, as the mapped trees' leaves | creeper |

Content has no masked parent that fits: `M_DetailedAutumnLeaves` is the tree foliage graph with a per-instance tint. The cut-out `diff` textures keep their alpha and get Unreal's alpha-coverage mips (`do_scale_mips_for_alpha_coverage`, threshold 0.5 on A), so the share of texels over the clip stays the same in every mip and thin balusters and laths do not fade away at a distance. Textured duplicates also take the manifest's metallic (galvanised sheet). `verify` checks every texture's colour space, compression, size and alpha-coverage setting, and every material's samples, samplers, tiling, NordSky wrappers, blend mode, sidedness, clip, shading model, OpacityMask source and metallic.

## Methods and sources

- Greystone and slate follow Larry Gritz's RenderMan shader `stone.sl`: staggered courses, a colour per stone from its index, joint edges perturbed by noise, and a groove profile for the relief.
- Gravel, tar and crushed stone are splatted stones, and each texel keeps the highest one, the way Substance Designer's Tile Sampler and Shape Splatter stack pebbles with a max height blend, and the way the Blender Artists "procedural rocks and ground" breakdown builds stones from Voronoi cells with noise. Rounded stones are lumpy ellipses with a dome profile; crushed stone is the intersection of half-planes with bevelled arrises and a tilted top.
- Spangle and tar cracks are Worley cellular noise ("A Cellular Texture Basis Function", 1996): F1 cells for the spangle, F2 − F1 for the crack lines. Inigo Quilez's "Voronoi edges" notes that F2 − F1 is not a true distance to the border; for one-pixel cracks the difference does not show.
- Siding is the sawtooth band profile of Blender's Wave Texture (one wedge per lap), with the lap shadow baked under each butt as a Substance plank graph would bake it.
- The membrane lap follows the TPO installation guides: laps marked on the sheet edge and a welded seam of at least 1.5 in (Johns Manville TPO guide). The tile is one 8 ft sheet; 10 ft is the most common roll.
- The cut-out cards are drawn from signed distances, so the alpha edge is anti-aliased about the clip. The alpha-coverage mips follow Ignacio Castaño, "Computing Alpha Mipmaps": find the per-mip alpha scale that keeps the top mip's coverage at the test value.
- Virginia creeper: five obovate to elliptic, coarsely toothed leaflets of 4 to 12 cm, crimson to purple in autumn (University of Michigan *Parthenocissus quinquefolia* profile; UC Davis IPM). Guard dimensions: a gallery guard of 107 cm with openings under 10 cm (MRC de Coaticook SARP sheet *Les galeries et les balcons*, research-plateau.md §13).
- The noise is tileable value noise on an integer hash, and the normals come from the height field by central differences.

The textures are generated, not scanned. The Blender previews (`Scripts/blender/plateau_replica_preview.py`) wire every set the way the apply step does, including the clipped `diff` alpha of the masked sets and the creeper's transmission (`Preview/Replica/README.md`).
