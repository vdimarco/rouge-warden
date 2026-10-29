# Street props

## Source

None of the city-dressing papers fit a three-band comic street. The shapes are original boxes and low cylinders on the instanced prop draw already in `cityview.js`. Placement follows the lamp runs in that file: both sidewalks, clear of parks, carriageways, the Needle plaza, and the Dome.

## Decisions

- One mesh per kind. The bin, the bollard, and the hydrant are three instanced meshes, so a spot draws only its own shape. (The first version put all three shapes in one mesh and collapsed two of them in the vertex shader. Each spot then still sent 132 triangles, and all 2,446 spots in the city sent 323k triangles in every view.)
- An end cull distance. Each spot stays on the CPU. Once the camera has moved 8 m, `nearProps` sends the GPU only the spots within the fade distance plus those 8 m, so the far ones cost no triangles. The same set serves the street lamps (the shader shrinks them to nothing by 240 m) and the sidewalk steam (it fades out by 110 m). The source is the end cull distance of Unreal's instanced meshes: a fade starts at one distance, and past the end distance the instances are not drawn ([SetCullDistances](https://dev.epicgames.com/documentation/unreal-engine/BlueprintAPI/Components/InstancedStaticMesh/SetCullDistances)).
- The distance is in 3D from `camPos`, the position that `view.update` gets, as the shader measures it from `cameraPosition` and as `nearLamps` uses it.
- The lamp distance shrink stays on the lamp pole and head only. A curb part does not use it.
- Furniture sits further onto the walk than the lamp pole, and it is visual only. People may overlap it.
- Props fade between 70 m and 110 m. Past that they are not drawn, and past 118 m they are not sent to the GPU.
- Colours stay in the comic inks: a dark green bin, a dark bollard with a pale band, a red hydrant. They go through the existing `comicCel`.
