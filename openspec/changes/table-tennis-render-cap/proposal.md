# Cap the table-tennis canvas at 1920 px

A 2560-wide Table Tennis view paints a backing store as wide as the CSS layout times `devicePixelRatio`. Under 4x CPU throttling that view runs at about 17 to 25 fps. Cap the backing-store width at 1920 px so the same rally stays at 50 fps or better, without moving the CSS layout, the pointer, or the hit tests.

## What changes

- When the view sizes the canvas, the scale is `min(devicePixelRatio, 1920 / cssWidth)`, and still no higher than the existing device-pixel cap.
- The CSS size of the canvas stays the layout size. Drawing, pointer aim, and contact stay in CSS pixels.

Out of scope: a new renderer, a quality setting, and any change to the phone tilt path or the shot rules.
