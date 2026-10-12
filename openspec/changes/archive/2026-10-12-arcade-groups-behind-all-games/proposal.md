# Arcade groups behind All Games

The group hall (`2026-10-04-arcade-cabinet-groups`) was built when the arcade home opened straight onto its machines. Before it was published, `main` made the home page open on All Games (the `arcade-hall` change): a ranked list of every game, with an Old arcade button that closes it and shows the machines. The merge that brought the hall to `main` (#316) added the fifth group, ASCII Scenes, and pointed the groups test at `/?machines`, but left All Games opening over every arcade address.

This change fits the hall into that home page:

- All Games stays the default at `/`. Old arcade, and `/?machines`, show the hall of group cabinets.
- A group in the address skips All Games: a group link such as `/#action`, and coming back from one of the group's games with the browser's back button, open that group with nothing over it.
- The specs, the README and the arcade QA say so, and `qa/arcade/machines.mjs` tests the machine room rather than the All Games list over it.

Out of scope: an ASCII button under the sign (the sign keeps upstream's COTTAGE, ACTION, STRATEGY and LAB ↗), and returns through a game's own link to `/`, which land on All Games as before.
