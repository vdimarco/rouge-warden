# Design: one curb, three slots

## Source

None fit. The spaces are already in `parked_cars.json`, and the game fills them. The picture was drawing one mesh at the nearest slot.

## Choice

`corner_row` takes the slot nearest the sign (id 1023) and the next two on the same street, way and side, nearest first. Those are 1023, 1024 and 1025. Body and paint come from the slot: a blue wagon, a teal coupe, and a gold wagon. The pivot stays at the slot's road height plus 108 cm, which is the 115 cm height the corner car already uses. Cars on the cross street stay out of this picture because the facade hides them. The opening look stays at pitch −16 and the socket at (0, 70, 110).
