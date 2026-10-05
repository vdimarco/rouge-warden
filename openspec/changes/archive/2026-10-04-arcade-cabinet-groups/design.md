# Design

All game cabinets stay in the page markup, so their attract scenes, high-score lines, and credits keep working untouched. Group membership comes from upstream's `GROUPS` table; each entry also carries the group cabinet's colours and two pictures taken from its games. The script builds one group cabinet per entry with the same cabinet parts (marquee, bezel, screen, panel), so they inherit the look and sizing. A group cabinet's coin door lists its games instead of coin slots. A machine missing from `GROUPS` lands in an extra "More" group, which keeps upstream's guarantee that every machine is reachable.

The row shows one view at a time: the hall (group cabinets) or one group (its game cabinets). Hidden cabinets use `hidden`, so they take no space and the sliding-row math (`offsetLeft`) keeps working. `cabs` becomes the list of visible cabinets and is rebuilt on every view change. Code that used fixed indexes (`cabs[0]`, `cabs[1]`, the hover and focus handlers' index) now finds cabinets by `data-game` or position at the time of the event.

The view lives in the address hash (`#cottage`, `#action`, `#strategy`, `#lab`). Opening a group from the hall pushes a history entry, so the browser back button returns to the hall. Before a game loads, the arcade saves that game's id in session storage. On return, the hash restores the group and that game is selected.

The collection buttons under the sign now open their group and stay lit while it is open. LAB ↗ stays a link to the Lab page. The machine picker gains a first entry for the hall; its options are game ids instead of row indexes. The count beside it reads "ACTION · 2 / 6" on wide screens and "2 / 6" on phones, where the sign already names the group and the back control needs the room.

Opening a group plays a short rising jingle and fades the row in. Reduced-motion players skip the fade.

Checks: `qa/arcade/groups.e2e.mjs` covers the scenarios at 1280×800, 390×844 and 844×390 and saves screenshots. `qa/arcade/machines.mjs` walks every group from the hall, runs its layout checks in the hall and in the largest group, and tabs through both. `follow-suit/qa/arcade.e2e.mjs` waits for the hall rather than a hidden Follow Suit cabinet.
