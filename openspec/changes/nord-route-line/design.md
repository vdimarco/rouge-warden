# A needle on the card, a stroke on the radar

No new rendering technique is involved, so none of the usual art references fit. Both marks are the HUD lines the radar already uses for roads and the diamond.

`QuebecRouteLine` is engine-free. Bearing is clockwise from the forward the player actually travels: 0 is ahead, positive is right. On foot that forward is the camera yaw, because walk input uses that yaw and the body only turns once you move. In a car it is the nose. A zero forward falls back to north, matching the radar. Under 1.5 m the card says here and draws no needle. The radar stroke is inset 12 px from the player and 8 px from the diamond, and it is omitted when that leaves nothing to draw. The world chevron still uses the full camera, including pitch, so looking at the ground can put the chevron on a different edge than the walk word.

`GetNextObjectiveLocation` is the following step of a linear beat: the pond, the court, the convoy, the blank page, the terrace phases, and the next race gate. The ovation's choice has two legal stations, so it has no next stop. After either station, the next stop is the curtain, not the station that is already set. The rescue mask is any-order, so it has no next stop. Side jobs clear the continuation when they take the card.

When the world pin is outside the safe view, `ViewToScreen` turns camera ahead/right/up into a screen direction (+X right, +Y down) and folds a stop behind the camera downward. `EdgeArrow` places a two-line chevron where that ray leaves the inset view. The on-screen diamond is unchanged.

The line does not change CompletedMissions or the v1 save.
