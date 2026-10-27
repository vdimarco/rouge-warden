# Parked lamps at dusk

A new lamp mesh does not fit. `AQuebecCar` already builds a left and a right headlight, a 100 cm cylinder at scale (0.35, 0.35, 0.08), at local (222, ±58, −20), and paints them with `M_Light`, the emissive lamp material. `AQuebecSky::AssignPools` places the six headlight spots on the nearest driven or traffic cars. The change adds a parked car to that pool only when `bStreetLamps` is set, which `LightingFor` does once the sun is low. Rain by day still requires an occupant or traffic.

The opening shade draws those two lamps on the spawn car in the sunset frame. The taillights at (−222, ±58, −20) fall outside this camera. The street-lamp row and the sunset grade stay.
