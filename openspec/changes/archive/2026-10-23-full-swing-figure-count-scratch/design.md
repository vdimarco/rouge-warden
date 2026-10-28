# Design
createFigures.begin resets n/camera as before and deletes prior count keys instead of allocating an object. add accepts the same arbitrary tags; info still copies counts, so old snapshots remain independent. Production tags are people/goons/jobs. No retained private counts references, graphics technique, buffer or culling change. No FPS claim; deletion costs are not benchmarked.
