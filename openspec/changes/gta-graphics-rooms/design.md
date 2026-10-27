# Design: per-pane light

## Source

None fit. There is no interior mesh to map, and the editor is not here to light a room. A hash per pane is the whole technique.

## Choice

`pane_light(column, row, salt)` mixes the wall salt with the column and the row. About one pane in five is dark and not emissive. A lit pane lerps from a warm amber toward a cooler occupied room, and its brightness is not fixed. The same inputs return the same colour. A wall under five metres, or a wall while the street lamps are off, still has no panes.

The frame, the sash, the muntin and the mullion stay. The opening look stays at pitch −16 and yaw from the Sherbrooke width, with the socket at (0, 70, 110).
