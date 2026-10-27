# Proposal: soft shadows and contact occlusion

## What

The sun and the moon use a three-degree disk and a 45 cm contact shadow. The view applies ambient occlusion at 0.65. The offline curb picture shows the same penumbra and the same contact darkening.

## Why

The curb was lit by a flat sun term. Nothing on the ground threw a shadow. A soft edge and a dark contact are what make the hydrant, the bags, and the building sit on the grass.

## Scope

The shade constants, the sky light, the view occlusion, and the scorecard. The curb eye stays. The opening aim stays. Unreal is not installed, so the editor does not rebuild the lights.
