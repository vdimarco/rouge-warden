# Shore: rugged terrain and winding routes

The player supplied an elevated forest-and-river reference and asked for much more variable terrain and roads that twist and turn instead of looking predictable.

## Scope
- Replace the flat 3D floor with coherent hills, hollows, rocky rises and lowered river banks, retaining Shore's natural mythic palette.
- Give the fixed lane routes stronger, unevenly spaced bends while preserving mirrored teams, ward stations, clear cover and one river crossing per lane.
- Use a single terrain surface for rendered ground, units, foliage, effects, camera and pointer targeting.
- Keep the 2D fallback and tactical maps using the same lane geometry.
- Clear the desktop play area of the movement pad, its tip and the floating spellbook control; open the book on demand.

## Capabilities
- Modify `moba-combat`: visibly winding routes with bounded travel and safe clearances.
- Add `shore-terrain`: continuous terrain relief, grounded visuals and usable input.
- Modify `moba-ui`: desktop matches start directly, with spellbook access through K and the menu.

No new lanes, heroes or generated assets are needed. Existing gameplay collision remains planar; visual terrain must not introduce misleading impassable routes.
