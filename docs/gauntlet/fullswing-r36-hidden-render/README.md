# Skip hidden flat-scene draws

Hidden flat pages now skip scene and bloom rendering. The loop and existing physics/visibility policy stay intact; visible rendering resumes and XR takes its existing path.

Synthetic checks at960×540/390×844: baseline2fail/8pass, candidate10pass. Sixty hidden calls per layout enter the flat pipeline60times before and0after. Visible/resume paths and synthetic XR routing pass; no page errors. This is callback/routing evidence, not physical-device, browser throttling, GPU-power or affected-Chrome FPS acceptance.

No rendering quality, controls, real-building anchors or height rules change. No FPS merge gate. Current-head review/CI/deployedpreview/rebase/production checks remain required. Scores unchanged; actual Chrome responsiveness and stability unverified, currenttotalwithheld.
