# Depth fade

Naty Hoffman and Arcot J. Preetham, "Rendering Outdoor Light Scattering in Real-Time" (2002), fade a surface toward the sky colour with distance. The comic node already has scene depth and cannot add a fog volume, so the fade is a smoothstep from 25 m to 140 m, mixed at most halfway. The sky pixel is skipped. The clear 15:00 fog density and start scales stay at 1.
