# Design

Move the base centers inward so the larger buildings fit the map edge. Paint broad paved courts and use a green shrine for the Moonwell Sanctuary and a violet abbey for Thornkeep Citadel. Keep the three lane wardstones distinct. Share the healing radius between simulation and rendering. Landscape decoration must leave the courts open.

A creature cycles through three basic attacks against one target. Only a landed hit advances the sequence; a missed hit, death, a new target or a two-second gap resets it. Average damage over three hits stays equal to the previous damage. Each attack has its own name, timing, motion direction and impact shape. Existing skills and automatic targeting remain usable with current touch and keyboard controls.

Verify simulation scenarios, all existing MOBA suites and the actual Canvas renderer at phone, landscape and desktop sizes. Browser interaction and physical phone checks are separate and must be reported if blocked. OpenSpec CLI is absent; inspect Markdown structure directly.
