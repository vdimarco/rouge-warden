# A card wide enough to read

Sarah Tariq, "Rain" (NVIDIA SDK 10, 2007), draws each drop as a camera-facing streak with a bright head and a thin tail. The displacement in `rain_streak.hlsl` already follows that wrap, and it stays as it is.

The missing piece was the card. A 1.2 cm quad is smaller than a pixel past a few metres, so the core, the skirt, and the knot land on the same pixel. A 10 cm card is still a streak at street distance, and it is wide enough for the head to be a circle. In UV the card is much longer than it is wide, so the circle is flattened in v: 4 cm is 0.4 of the width and about 0.065 of a 62 cm streak. The city colour is not this material.
