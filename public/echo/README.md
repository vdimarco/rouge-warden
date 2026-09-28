# Loon Echo (lab prototype)

A one-thumb timing toy at `/echo/`. The lead loon steers horizontally. Each bird behind it repeats the lead's position 0.31 seconds later. Rings drift toward the flock. Every bird that passes through earns points; a full flock pass adds a bonus. Blue rings also add time. Rocks remove birds. Runs last up to 60 seconds and the best score stays in local storage.

This is a test of the core move, separate from the Cottage Arcade cabinet list. Watch whether a new player understands the delayed flock and asks for another run. The spawn sequence is random, so score comparisons across runs are informal. A later pass should add a daily seed and real-device playtest before considering a full build.

Serve `public/` with a static server and open `/echo/` on a phone or desktop. Drag or use left/right keys. Sound starts with Play.
