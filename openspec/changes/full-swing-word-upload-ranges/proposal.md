# Upload only live comic-word records
FX currently marks full16-slot matrix/atlas/tint buffers dirty on spawn and each live update. Bound subsequent GPU uploads to current live population without changing placement, fade, swap removal or rendering. No FPS claim.
