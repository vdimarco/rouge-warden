# Increment58 — populated web uploads and anchor regression restoration

Web matrix/fade uploads use live segment ranges. Actual one6segment web uploads1088→408bytes;two12segments816bytes; exact nonblank reference pixels preserved across shrink/fade/zero/regrow/hidden/resume. Initial allocation unchanged. The isolated test manually sets inkLine states against a real building face; it is a renderer check, not a physics acceptance claim.

Existing building-anchor checks exposed a shipped regression: current-main baseline3fail1pass (invisible sky attachments and no reachable above-roof attachment). Restored prior playerEasy/aimCopy/canHang selector from #632, preserving newer aimAndFire gold-ring/melee priorities and wall/held-rope physics. Existing4buildingchecks nowPASS including149mplayer/147mroof, and51swingchecksPASS. No artificial ceiling.

All20dimensions: Lighting, Color palette, Detail density, Texture/material, Composition/camera, Atmosphere, Character models, Animation smoothness, Particles/VFX, UI polish, Responsiveness/input latency, Controls feel, Mission clarity, Pacing, Fun factor, Difficulty curve, Feedback, Sound design, Variety, Performance stability: no new points awarded. Actual affected Chrome120Hz, physical devices, listening and full playthrough unverified; no FPS claim; total/delta withheld. OpenSpec structure checked manually; CLI unavailable. Review/CI/current authenticated preview/both rebases/exactmerge/production pending.

Fresh CI phone-hold fixture reached a real wall after restoring real anchors: bump→detach→cling overrides the held-rope state. Keep runtime wall/rope semantics; fixture now sets the existing10s wall regrab cooldown to isolate gestures. All11 original assertions pass unchanged; this does not establish held-rope behavior across wall grabs. An exploratory preference for hanging candidates and a lower spawn did not resolve the fixture; neither was retained.

Review found legacy web-line still depended on invisible sky. Fixture now faces a real tall building and moves toward it, preserving all width/color/sag/fade assertions; former sky identity assertion now requires real building tag. All11checksPASS:1–2px widths,20.6px sag,150ms fade. Runtime unchanged.

Fresh mission CI exposed holdchain asserting the removed invisible sky anchor. Updated only that scenario to the explicit real-building-only requirement:240held frames never attach to sky. Other building-hold/release assertions unchanged; all5holdchainchecksPASS. Internal easyAnchor math fixtures remain unchanged because playerEasy rejects their sky fallback.
