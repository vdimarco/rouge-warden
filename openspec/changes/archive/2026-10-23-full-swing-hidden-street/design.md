# Design
Reuse root.visible, already set by setWorldVisible. Return at the start of the visual update only; street simulation remains in streetFrame. Do not update signAt while hidden, so showing the street refreshes its list for the current camera. No rendering technique or quality change. FPS unverified; no benchmark gate.
