# Design

One early return in render(), after checking XR presentation and before scene/postprocessing work. Existing loop, visibility, simulation and frame-metric handling remain unchanged. Scope: main render entry, focused lifecycle browser test/CI. Reuse existing document.hidden policy. Synthetic60hidden calls demonstrate zero flat pipeline entries; visible resume and synthetic XR routing are checked. No physical headset, affected-user Chrome or browser throttling claim.
