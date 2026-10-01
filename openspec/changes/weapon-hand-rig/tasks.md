# Tasks
- [x] Implement measured two-bone arm aiming and fixed weapon grips.
- [x] Verify barrel direction, grip stability and visible character pose.
- [ ] Validate/archive with OpenSpec CLI when available.

Browser assertions pass for pistol, Golden Eagle, AK-47 and spray at three vertical aiming angles: fixed hand-local prop orientation and barrel-direction dot product above 0.999. Existing arsenal desktop/touch suite passes. Inspected `/tmp/crimson-hand-rig.png`. This upgrades the existing 24-bone skeleton behavior; it does not replace character meshes or add articulated finger bones. Physical gamepad and hardware performance unverified. OpenSpec CLI unavailable.
