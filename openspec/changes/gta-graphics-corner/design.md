# Corner camera

A new shading model does not fit. The street blades and the parked slots are already in the plateau replica: `Furniture/placements.json` carries the surveyed names, and `Streets/parked_cars.json` carries the curb slots. The opening camera looks down Sherbrooke, and these sit far outside that frame.

The second view stands at the Marie-Anne / De Lanaudière blades and looks toward the nearest parked Car70 on Rue Marie-Anne Est. It uses the same field of view as the opening. It does not change `FrameTheStreet`, the pitch of −16, or the socket at Y 70 and Z 110. The words are the placement's own street names, drawn on the blade faces. Unreal is not installed, so confirming the actors in a viewport is unchecked.
