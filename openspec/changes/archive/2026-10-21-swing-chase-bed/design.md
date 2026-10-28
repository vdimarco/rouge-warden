# The chase clock

Adapted from the chase music in Marvel's Spider-Man 2 (Insomniac, 2023): the score tightens when the target pulls away and eases when you are gaining. No render paper applies. The sound is a dry high click on the existing groove, not a copied theme.

`audio.chase(0..1)` sets the level. `goalFrame` already names CLOSING and FALLING BEHIND. The play frame passes that to the groove: 1 when falling behind, 0 when closing, 0.4 while a chase holds its distance, and 0 when the chase is held for the first lesson, the crew is out, or nothing is being chased. `playStep` puts the click on the quarter notes, and on the eighths once the level is above 0.7. The fight layer still replaces it.
