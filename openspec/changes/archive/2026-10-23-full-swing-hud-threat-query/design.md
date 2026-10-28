# Design
warnFrame has one caller, hudFrame. combat.threat is a read-only nearest-threatening-goon scan. Pass its current result directly to warnFrame instead of rescanning. Keep independent threat calls outside HUD, no persistentcache. All HUD helpers between prompt and warning inspected: no combat state mutation. Driving still gets warning evaluation.
