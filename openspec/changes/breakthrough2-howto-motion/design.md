# Design

The sheet keeps one scrolling panel. A stage sits under the title, then scene dots, then the existing rules.

Each scene is an inline SVG plus a caption. Only the active scene is visible. CSS animates that scene (a year token, cards, mercury, a path, race bars, a pathway dot). The resting pose is the end of the move, so a disabled animation still shows a readable frame.

`motionOn()` already means not `fast=1` and not reduced motion. The stage advances every few seconds only in that case. A dot or a tap on the stage jumps to a scene. The close control stays at least 44px.
