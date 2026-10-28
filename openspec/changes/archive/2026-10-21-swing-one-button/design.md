# One button

Adapted from the web-swing in Marvel's Spider-Man 2 (Insomniac, 2023): one button starts the swing, and the stick steers when you hold it. No render paper applies. The walk is the game's own run speed, the same speed the first swing path was built around, so the arc off the start roof does not change.

`physics.step`, while the body is on the ground and the move input is quiet, looks for a flying or attached rope that is not sticky and not a clog, a pipe or the crack. If that web is more than 4 m away horizontally and the body is not already moving toward it at half of run speed, the wish direction becomes the web. Ground friction then walks the body at run speed. A held stick or W replaces that wish, as before.

The words change with the behaviour. The mouse hint is LEFT MOUSE (OR E): SWING. The pad hint is RIGHT TRIGGER: SWING. The first spoken lines and the title note match.
