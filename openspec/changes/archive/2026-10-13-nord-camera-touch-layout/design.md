## Decisions
Use PlayerCameraManager pitch limits and the existing spring arm. Compensate its world-space target height for upward orbit so the camera never drops below its neutral socket height. Driving position smoothing pauses while the orbit needs lifting; ordinary downward driving views retain smoothing. This follows the installed UE 5.8.3 SpringArmComponent.cpp arm-origin and rotated socket-offset calculation; no rendering technique changes.

The browser launcher identifies touch-compatible HUD layout explicitly. Wide streams move the mission beside the radar and reserve the bottom-right for a 2×2 grid of 76–88 by 56 CSS-pixel buttons. Portrait retains its existing lower control area. Remove look-pad markup/styles; retain shared image-drag input.

## Verification
Native component integration tests exercise extreme pitch, both pawns and collision. Browser checks cover two rows, target sizes, multitouch/gyro and native HUD clearance at portrait and wide/narrow landscape. Fresh package and rendered live media/camera captures are required. Physical phone/sensor acceptance remains separate. No assets or production saves are modified.
