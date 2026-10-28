# A painted apron, not a shadow map

No shadow-map or light-probe paper fits this shader. It returns one colour, and the editor pastes that HLSL into the existing facade material. There is no light vector and no second output for emission.

The lamp is already a hash of the bay and the floor, threshold 0.55. The apron uses that same bit, excludes the glass, and falls off down the brick under the pane and a short way to either side. Dark rooms stay dark. The cornice still replaces the top of the wall.
