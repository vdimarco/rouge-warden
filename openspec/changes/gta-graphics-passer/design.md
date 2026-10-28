# Design: use the sidewalk and the lane the game already spawns

## Source

`QuebecTrafficModel.h` puts a moving car 145 cm off the centre. `QuebecGameplay.cpp` puts a sidewalk walker at half the road width plus 150 cm, which is 850 cm on this road. The figure is the hoodie walk. No other placement fit this curb better.

## Choice

The walker is 700 cm past the bag pile along the road, at lateral −850, on walk phase 0.22, facing the camera. The car is 1100 cm past the pile, at lateral −145, the red body, facing the camera. The curb eye stays at 420 cm back and 860 cm toward the props, pitch −14. The opening look stays at pitch −16 and the socket at (0, 70, 110).
