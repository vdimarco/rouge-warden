# A wider stroke for a wider road

Jacques Bertin, *Semiology of Graphics* (1983), treats size as the visual variable that orders a quantity. A 9 m avenue and a 4 m street are ordered, so their radar strokes are ordered. The avenue is drawn in two passes: an ink casing, then a warm paper center, so the light line stays readable on the dark disc. That casing is the ordinary topographic road sign. No lighting or material paper fit a HUD map.

The width arrays already exist. On the expanded Montréal radar the original park segments keep `LaFontaine::RoadSegmentWidths`, and the surveyed suffix keeps `LaFontaineExtension::RoadSegmentWidths`. Toronto uses `CollegeBathurst::RoadSegmentWidths`. An unmatched index stays 400 cm, which is under the 9 m gate, so it stays a side street. The 9 m gate is the same gate as the broken center line. `ClipHUDRadarSegment` is unchanged.

Unreal is not installed. The offline picture is the landscape HUD radar (160 px, scale 1) centered on the park spawn. The before frame uses one grey stroke. The after frame cases the avenues. It is not an engine capture.
