# Tasks

- [x] Taxi job: offer on a street, starts only from a car, drop across town, tip, walk-off and late fails
- [x] Thief job: runner on a street-grid path with corners, knock him down, or he gets away
- [x] Markers and pins stay on while driving; only a taxi marker starts from a car
- [x] Marker colours and fail lines
- [x] `qa/vr/action.test.mjs`: taxi start rules, success with tip, walked, late, drop placement over 40 seeds; thief caught,
  away, and runs over 60 seeds that keep to the streets and turn corners
- [x] `qa/vr/action.e2e.mjs`: on foot a taxi marker only shouts; driving into it starts the job with a goal pin
- [x] Validate with the OpenSpec CLI
- [x] Recorded device limits: no real phone or pad check of driving into a taxi marker, and no sound check by ear
