# Design: Sherbrooke and Rachel

## Source

The sidewalk offset is the same relationship the Sherbrooke spawn already has to its avenue: past the curb, short of the wall. Rachel uses road segment 389 in `LaFontaineMap.h` (Rue Rachel Est, 620 cm wide) and stands 490 cm toward the surveyed building at that block. The look aims at a point further down the lane, the lead Joseph V. Mascelli describes in The Five C's of Cinematography (1965), which `QuebecStreetLook` already uses for the opening. No outside map fitted.

## Choice

`QuebecPlace.h` lists the two starts and has no Unreal types. Place 0 is the opening spawn and keeps the opening aim. Place 1 is Rachel and carries its own yaw, because that street is narrower than the avenue the opening aim searches for.

`-NordPlace=rachel` moves the pawn there before the first look. Keys 9 and 0, and the Sherbrooke and Rachel buttons in the browser menu, ask the server to begin on that sidewalk. A player who is in a car or knocked down is left where they are. Toronto is left on its own start. An unknown name stays on Sherbrooke.
