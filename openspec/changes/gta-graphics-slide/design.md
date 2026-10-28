# Design: one banner per handbrake slide

## Source

No tire model was adapted. The car is kinematic. Its slide is the momentum split already in `SimulateDrive`: the handbrake brakes at 2,300 cm/s², `QuebecSteer::YawRateFor` scales yaw by 1.4 above 450 cm/s, and sideways grip falls from 8 to 1.15. The banner uses `QuebecNotice`, the channel that stays off the resident caption, so a story line is left alone.

## Rule

`QuebecSlide` pays when the handbrake is held, speed is at least 450 cm/s, and the sideways speed stays at least 180 cm/s for 0.35 s. One pay per gesture. Another pay waits 1.5 s, which is the notice channel's repeat gap. A failsafe stop and a car with no driver do not pay.

## Session

The test drives the same step at 60 Hz, without collision. Gas for 3 s, then the handbrake and a full turn. One banner at 3.57 s. A straight run, a 0.45 s tap, and a turn without the handbrake pay nothing. Getting back up to speed and sliding again pays a second time. A second shove inside 1.5 s does not.
