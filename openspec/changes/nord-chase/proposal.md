# Lose a car that follows you

## Why
The short way is a clock on a fixed road. The lap ghost does not follow the player. Nothing in the day is a car you have to outrun.

## What changes
- Mission 15 opens once the short way is banked. Get in a real car on the seat. A tail waits behind that seat and follows the car.
- A drive down the straight road reaches the hide and pays 640 session cash once. A crawl is caught. Standing still is caught. Getting out does not stop the tail, and a walker, a bike, a pedalo, or a scooter cannot take the seat or the hide.
- When they catch you, including a tie on the hide, the seat is back and nothing is paid.
- A frame longer than a quarter of a second only moves the tail for that quarter.
- The seven story banks stay seven. The lap ghost and the police chase stay as they are. No extra car is spawned.
- Version 8 of the campaign slot stores the chase step. Version 7 still loads and starts this beat over. Version 1 still loads and starts the pond over. Version 2 stays unread and is not overwritten. The tail's place on the road is not saved. A reload during the chase puts them back behind the seat and leaves the step.
- Recover stands beside the seat, outside the seat and outside the hide. It does not put the tail back. A race replay does not rewind the chase and does not write the slot.

## Out of scope
An eighth chain link, a phone button, another follower, another lit path, another fixed clock, a second copy of the short way, and any change to the police pursuit.
