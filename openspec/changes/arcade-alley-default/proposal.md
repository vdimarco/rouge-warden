# The Alley is the default view

## Why
The user's words: "make this the default view on arcade.uptick.systems and add the menu to navigate different views". "This" is Riftwalk, the neon alley whose storefronts are portals (`/lab/riftwalk/`).

## What changes
- A visitor who opens `/` with no stored choice arrives at the Alley. Before, they arrived at the Corridor.
- The home has three views: the Alley, the Corridor and All Games. Each view has controls that open the other two.
- The Alley has a Views menu with the three views.
- `arcade.view` stores `classic` or `corridor`. No stored value means the Alley.

## Scope
The Corridor and All Games keep their pages and their behaviour. Only the home's first choice and the links between the views change. `openspec/changes/arcade-corridor-default` describes the Corridor; its "default view" rule is replaced by this change.
