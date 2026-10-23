# Design
Add an optional output array to cars.hazards. Fill existing entries by index and trim to the active count. main.streetFrame owns the scratch array; street.update consumes it synchronously and does not retain it. Default calls still create independent arrays/records. Shrink then growth may allocate new tail records; no extra pool. No rendering technique or FPS claim.
