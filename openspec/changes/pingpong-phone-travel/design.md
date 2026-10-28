# Design

The current controller reads rotation rate for a stroke and beta/gamma for pose. It ignores linear acceleration and alpha heading. Its unsigned visual push makes both stroke directions move toward the net.

Use gravity-free DeviceMotionEvent.acceleration for a short, damped movement offset. Rotate its axes with screen orientation, and project screen-up/normal acceleration onto table depth using the held pitch. Bound offset and velocity; decay to rest, discard stale samples, and clear on recenter, visibility loss, or screen rotation. This is a responsive stroke control, not absolute six-degree-of-freedom tracking. Source: https://www.w3.org/TR/orientation-event/ and https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/acceleration (checked 2026-10-19). Never integrate accelerationIncludingGravity as travel.

Heading relative to calibration adds a smooth sideways sweep, with wrapped angle differences. Keep tilt for face pose and shot aim. The motion racket is drawn at the same position used for contact; reserve the old visual jab for pointer/swipe. Correct signs for landscape orientations.

Validate signed motion, all screen rotations, still/no sensor input, stale samples, reset, bounds, and actual event handlers with synthetic browser events. A physical phone test remains required for sensor feel.
