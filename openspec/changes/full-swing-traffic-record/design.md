# Design
Existing trafficCars returns fresh {n,lane,move,color}; arrays are already live. Use existing optional-output pattern if all consumers permit it. Inspect actionview streetNear, main trafficNear/car update, initialization and tests before code; keep default fresh API and null-before-build behavior. No persistent stale cache, no rendering technique introduced.
