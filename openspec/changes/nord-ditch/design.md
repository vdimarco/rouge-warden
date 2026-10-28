# Ditch the chase car

No new rendering technique. The line, the clear mark, and the chase car are the same flat cubes the other beats already use. None of the usual art references fit.

The road runs from (46815.398, 34267.636) to (48698.090, 42601.051). The line is 16 m along it. Recover is 14 m back from the line, still on the road and outside the 7 m line. The end is 6 m short of the far end. The clear mark is 20 m off the far end, to the left of the road. The chase car drives at 900 cm/s, between the traffic cruise at 650 and the tail at 1100. A crawl at 400 cm/s is caught. A drive at 1200 cm/s is not. One frame spends at most a quarter of a second. Crossing the line does not also clear the end. Reaching the end does not also clear the mark. The purse is 660, once. The step index is the only saved field. How far the chase car has driven stays in the session, and a reload during the chase puts them at the near end again.
