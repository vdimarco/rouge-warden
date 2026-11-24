# Ink Studio renderer

These files are copied by `games/gloam-downs/vendor.mjs` from [Ink Studio](https://github.com/siliconjungle/shapeshift-labs-ink-studio) at commit 6a8c6225c6ab7a96dd2d33b5a92f9251b13c13e7, under its MIT license (`LICENSE`). Do not edit them here: change the pinned commit in `games/gloam-downs/package.json` and run the script again.

One change is not from Ink Studio. `webgl/uniform-blocks.mjs` is a copy of `games/gloam-downs/uniform-blocks.mjs`, and the script patches `webgl/resources.mjs` to use it. It moves the uniform arrays into uniform blocks, so that each program fits in the 256 uniform vectors that phone GPUs give to each stage. `games/gloam-downs/patch-resources.mjs` has the patch. The checks draw only the programs that Gloam Downs uses (no water, sprites or patterned look): see `games/gloam-downs/README.md` before you use this copy for more.
