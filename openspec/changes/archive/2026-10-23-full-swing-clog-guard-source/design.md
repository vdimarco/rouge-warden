# Design
Iterate city.clogs and skip IDs in save.clogs. Game initialization normalizes save.clogs into the same completed IDs used by its private clogs; flush updates both synchronously. Private clog positions copy the immutable city positions and never change. Reset clears storage and reloads the page, recreating both sources and the guarded set. No rendering technique, new cache, or FPS claim.
