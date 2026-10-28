# A ring that grows and fades

Sarah Tariq, "Rain" (NVIDIA SDK 10, 2007), draws each impact as a ring that grows and then dies. The streak card in `rain_streak.hlsl` is the drop in the air. It stays as it is, including the wrap and the 3200 cm offset limit.

The ring lives on the wet-ground colour, not on the streak. Cells are 70 cm. About a quarter of them are live, so the street is not a carpet of rings. A live cell starts as a small crown and opens into a ring 3.5 cm thick, which is wide enough to survive the walking camera. Rain intensity scales the ring, and zero rain leaves the ground as it was. The puddle mask is a separate custom node and is not this hash.
