# Design

## The rule at `/`
The script at the top of `public/index.html` decides before the page draws:

| Case | Result |
| --- | --- |
| `?view=classic` | store `classic`, stay on All Games |
| `?view=corridor` or the older `?view=walk` | store `corridor`, go to `/corridor/` |
| `?view=alley` | clear the stored choice, go to `/lab/riftwalk/` |
| stored `classic`, a hash such as `#strategy`, or an automated browser | stay on All Games |
| no WebGL | stay on All Games |
| stored `corridor`, or WebGL without WebGL2 | go to `/corridor/` |
| all other visitors | go to `/lab/riftwalk/` |

The Alley needs WebGL2, so a browser with the older WebGL gets the Corridor. `location.replace` keeps `/` out of the history, as before.

## The controls
- Alley: a Views button in the top bar opens a menu of three links with a line of text each. The Alley is marked as the current view. A press outside the menu, or Esc, closes it. The menu draws over the start card, so a visitor can change the view before the world loads.
- Corridor: an Alley link beside All games in the bar, and an Alley pill before the All games pill in the category strip at 760 px and narrower.
- All Games: an Alley link after the Corridor link in the bar, and an Alley line after the Corridor line in Menu.
- The Corridor control now stores `corridor`. Before, it cleared the stored choice, which was the same thing while the Corridor was the default.

## Cost of the default
The Alley downloads its world before a visitor can enter: 29 MB on a desktop and 14 MB on a touch device. The Corridor needed no such file. The start card shows the progress, and the Views menu works during the load.

## Rendering sources
None. This change adds no drawing technique.
