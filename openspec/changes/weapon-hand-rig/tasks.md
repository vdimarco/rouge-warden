# Tasks
- [x] Smooth visual aim, add physical muzzle origins and preserve Golden Eagle scale; verify regressions.
- [x] Implement measured two-bone arm aiming and fixed weapon grips.
- [x] Verify barrel direction, grip stability and visible character pose.
- [ ] Validate/archive with OpenSpec CLI when available.

Browser assertions pass for pistol, Golden Eagle, AK-47 and spray at three vertical aiming angles: fixed hand-local prop orientation and barrel-direction dot product above 0.999. Existing arsenal desktop/touch suite passes. Inspected `/tmp/crimson-hand-rig.png`. This upgrades the existing 24-bone skeleton behavior; it does not replace character meshes or add articulated finger bones. Physical gamepad and hardware performance unverified. OpenSpec CLI unavailable.

Follow-up browser checks pass: equivalent smoothing at 30/60/120fps, Golden Eagle muzzle distance remains 1.25× the pistol when attached, tracer origin matches the actual muzzle within 1mm, and a collider between chest and muzzle suppresses projectile emission. Arsenal desktop/touch regressions and three arsenal rule tests pass; no browser errors.
