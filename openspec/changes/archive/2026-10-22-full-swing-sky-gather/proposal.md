# Avoid zero-contribution sun-shaft gathers

The post-process shader executes16radial samples even on fully sky pixels, then multiplies their result by zero. Skip that gather when its existing weight is exactly zero. Preserve partial sky-edge weights, city shafts, effects, resolution and XR behavior. Target GPU headroom without another quality reduction.
