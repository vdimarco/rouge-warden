"""The parked cars the corner camera can see on one curb.

The slots are the surveyed spaces in parked_cars.json. The nearest car on
Rue Marie-Anne Est stays, and the next cars on that same curb follow it.
The shade lifts each pivot the same 108 cm the corner car already uses.
"""

import math


def same_curb(slots, anchor_id):
    anchor = next(slot for slot in slots if slot["id"] == anchor_id)
    row = [
        slot for slot in slots
        if slot["street"] == anchor["street"] and slot["way"] == anchor["way"] and slot["side"] == anchor["side"]
    ]
    row.sort(key=lambda slot: math.hypot(slot["x"] - anchor["x"], slot["y"] - anchor["y"]))
    return row


def corner_row(slots, anchor_id=1023, count=3):
    return same_curb(slots, anchor_id)[:count]
