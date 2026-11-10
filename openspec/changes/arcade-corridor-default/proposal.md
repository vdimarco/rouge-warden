# The corridor as the default view of the arcade

The Cottage Arcade home opens on All Games, a card list. The old arcade hall and the 3D arcade are one click away. The Corridor is a walk-through hall of every game, built as its own page at another address.

Make the Corridor the view a visitor lands on:

- `/corridor/` serves the Corridor from this site, with every cabinet leading to its game here.
- A visitor who opens `/` goes to `/corridor/`.
- The Corridor has an All games control that returns to the list. That choice is remembered, so the next visit to `/` opens the list.
- All Games has a Corridor control that goes back to the walk and forgets the choice.
- Group links such as `/#strategy` keep opening the old arcade hall.
- A browser without WebGL stays on All Games.

Out of scope: the games, the Lab page, the 3D arcade, play counts for games opened from the Corridor, and the in-game switcher.
