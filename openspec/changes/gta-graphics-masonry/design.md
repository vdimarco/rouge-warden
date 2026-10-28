# Course variation

Scanned brick textures do not fit this shader. It returns one colour from wall position, and the editor pastes that HLSL into the existing facade material. The grain is a hash of the course cell already used for the mortar line, plus a height falloff for dirt. Glass, trim, sash, and cornice still replace that colour, so openings stay clean.
