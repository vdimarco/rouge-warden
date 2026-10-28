# Design
putWeb is called only by drawWeb for two attached/fading ropes. It reads camera matrices without mutating camera transforms. Hoist camera.updateMatrixWorld immediately after ensureWeb in the 3D branch. Baseline instrument actual camera calls during drawWeb, including one/two/fade/empty/hidden/resume; retain exact nonblank pixels, width/sag/color/fade and building checks.
