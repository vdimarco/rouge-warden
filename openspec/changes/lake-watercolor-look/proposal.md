# Watercolour look for Breath of the Lake

The user asked to apply the style of [Susurrus](https://susurrus.vercel.app/) to Breath of the Lake. Susurrus is a cream-and-sepia watercolour world. Its single post pass uses a Kuwahara brush, wet edges, paper grain, and a ragged vignette.

Breath of the Lake already has a Kuwahara brush, ink lines and faint grain in `public/wild/js/post.js`. This change adds the rest of the watercolour stages to that pass, as an option in the pause menu. It shipped as the default first. The user found it grey and worse than the bright look, so Bright is the default again.

## Scope

- The final paint pass in `public/wild/js/post.js`.
- A Paint button in the pause menu and a `?paint=` address option in `public/wild/js/main.js` and `public/wild/index.html`.
- The README and `docs/botl-look.md`.

The menus already use cream paper, sepia ink and Cormorant Garamond. They stay as they are. Models, textures, grass and gameplay do not change.
