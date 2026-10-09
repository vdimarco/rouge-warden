# Shore: 3D only and visible terrain

## Why
The player reports missing terrain in 3D and requests removal of 2D. Even a 3D URL can silently select 2D when WebGL2 is unavailable. Broad lane flattening also removes much of the visible relief.

## Changes
Use the 3D battlefield for every match. Remove saved/query renderer selection, mode switches and startup fallback. Keep canvas overlays and tactical maps. Explain unsupported graphics or failed model loads and allow reload. Give dry roads rolling elevations, narrow flat terraces and retain safe river crossings.
