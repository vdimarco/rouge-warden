# Hero read at a chase distance

The crew model is a painted figure. In the avenue the chase view is far enough that one cel band and a coarse mip turn the head and the hands into a block.

## What changes

The hero material keeps a share of the painted colour inside the cel bands, and samples a sharper mip of that colour. A hair crown, a brow fringe, and a collar follow the head, so the chase silhouette reads as a person. The skinned mesh, the bones, and the default cel shader stay as they are. No new art.

## Capabilities

- `swing-hero-read`: in the chase view the hero has a hair mass and a collar, and a close view still shows the painted face.
