# Proposal: specular on the wet road and the car paint

## What

The wet road reflects the sky with a GGX water film, and the car paint takes a clearcoat lobe. The directional light keeps a full specular scale. The paint material uses roughness 0.22. The wet-ground graph uses roughness 0.15 when the street is wet.

## Why

The curb is flat shaded. The asphalt stays matte and the red paint has no highlight. A water film and a clearcoat are the specular the picture is missing.

## Scope

The shade lobe, the sky light's specular scale, the car paint roughness, the wet-ground roughness, and the scorecard. The curb eye stays. The opening aim stays. The opening weather stays clear. Unreal is not installed, so the editor does not rebuild the materials.
