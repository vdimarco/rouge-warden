# Opening aim

Joseph V. Mascelli, *The Five C's of Cinematography* (1965), says the eye follows a line. The park start already faces along Sherbrooke, parallel to the curb, so the avenue sits in the side of the frame and the lawn fills the foreground. Aiming at a point 18 m down that avenue turns the look toward the lane. A Dutch tilt does not fit: the street stays level. The spring-arm socket and the −16 pitch are already locked, so the yaw is the remaining lever.

The nearest avenue is the nearest segment at least 9 m wide within 25 m. Nine metres is the width the radar already treats as an avenue. The direction nearer the authored yaw wins, so a start that already faces down the street does not spin around. No avenue in reach keeps the authored yaw. A narrower street underfoot does not count.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −16, horizontal FOV 90) at the surveyed sidewalk spawn. The before frame uses the authored yaw, parallel to Sherbrooke. The after frame uses the aim yaw. Buildings, the avenue, and a stand-in of the parked car are surveyed positions. It is not an engine capture.

`FinishRestartPlayer` writes the yaw after possess. A respawn on foot uses the same aim, with an unset yaw of 0 as the fallback. Getting out of a car, a side-job recovery, the car's −12 possess pitch, and the drive look stay. `QuebecGameplay.cpp` and `QuebecCombat.cpp` were not compiled.
