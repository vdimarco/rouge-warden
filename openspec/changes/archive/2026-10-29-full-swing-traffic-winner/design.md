# Design

Store the winning index and distance during the existing scan. After the scan, call `trafficAt` once with fresh output and attach the distance. Keep the shared scan scratch record private. Callers are `main.js`'s `trafficNear` (selection/stealing/diagnostics) and `createCars.update` (collision materialization); neither changes.

Before editing runtime code, freeze the original query and demonstrate repeated result construction with several progressively closer cars. Compare exact results over all four lane headings, clock positions, visibility filters, reach boundaries and ties. Retained results and their paint arrays must remain independent across queries. Check the real stealing/car simulation and compare nonblank before/after rendered cars at 640×360 and 390×844. Focused correctness tests and all six CI jobs, review, authenticated exact-head preview, rebases before and after preview, exact-head merge and production verification remain required. FPS/latency are diagnostic only; the affected Chrome 120 Hz browser remains inaccessible.

This is a CPU query change, not a rendering technique; no external rendering source is needed. Canonical/archive updates follow release. OpenSpec CLI availability must be reported honestly.
