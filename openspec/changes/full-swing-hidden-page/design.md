# Design

Reuse main.js's existing input-visibility guard that freezes simulation while continuing the render loop. Desktop input also serves phone flat play; derive its visibility from document.hidden. Keep XR session visibility separate. The existing visibility listener continues to save and suspend audio. Test with a controlled document.hidden getter and explicit simulation steps; label this synthetic lifecycle evidence, not actual browser throttling, physical-device or hardware performance validation.
