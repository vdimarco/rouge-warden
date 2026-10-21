# A needle on the card, a stroke on the radar

No new rendering technique is involved, so none of the usual art references fit. Both marks are the HUD lines the radar already uses for roads and the diamond.

`QuebecRouteLine` is engine-free. Bearing is clockwise from the player's forward: 0 is ahead, positive is right. A zero forward falls back to north, matching the radar. Under 1.5 m the card says here and draws no needle. The radar stroke is inset 12 px from the player and 8 px from the diamond, and it is omitted when that leaves nothing to draw.

`GetNextObjectiveLocation` is the following step of a linear beat: the pond, the court, the show, the convoy, the blank page, the terrace phases, and the next race gate. The rescue mask is any-order, so it has no next stop. Side jobs clear the continuation when they take the card.

When the world pin is outside the safe view, `ViewToScreen` turns camera ahead/right/up into a screen direction (+X right, +Y down) and folds a stop behind the camera downward. `EdgeArrow` places a two-line chevron where that ray leaves the inset view. The on-screen diamond is unchanged.

The line does not change CompletedMissions or the v1 save.
