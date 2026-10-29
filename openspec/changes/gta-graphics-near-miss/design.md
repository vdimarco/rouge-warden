# Design: NEAR MISS

## Source

The idea is the near miss of arcade racers such as the Burnout series, where threading past traffic is a reward on its own. No code or numbers were taken from them. The rule here is kept to what the city already measures.

## Rule

`QuebecNearMiss.h` has no Unreal types. Each car step, the player's car takes every other `AQuebecCar` within 15 m and puts it in its own frame: how far ahead, how far to the side. It also steps both cars back along their own velocity to get the same offset one step ago. A pass is when the other car moves from ahead to level or behind. The pass earns NEAR MISS when:

- the player's car does at least 1,500 cm/s, about 54 km/h;
- the other car's centre is at most 330 cm to the side, which leaves about 1.4 m between two 190 cm cars;
- the player's car has touched nothing for 1 s. Any contact that reaches the dent-thud code counts, even one too soft to thud;
- the last near miss was at least 1.5 s ago, so a line of parked cars gives one banner.

Being overtaken does not count, because the other car goes from behind to ahead. Traffic, police, and parked `AQuebecCar`s all count. The detail line gives the speed: "Past at 65 km/h".

## Cost

One loop over the cars for the player's car each step, only above 54 km/h, with a 15 m distance cut before any other math.
