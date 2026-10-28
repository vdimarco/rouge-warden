# Story route

No rendering technique is involved, so none of the art sources fit. The structure follows Marvel's Spider-Man 2 (Insomniac, 2023): after the opening, story missions change verb instead of repeating one activity. The jobs, names and fiction are this game's. The three jobs already exist (a street chase, a falling rescue, a roof fight).

## Decisions

- The route is Stop, Thief!, then Catch!, then Rooftop Brawl. A taxi needs a car the player may not have, so it stays an odd job.
- Each story job is placed near the hero. Catch's clock grows with the distance so there is time to swing there. Walking into a Catch marker still uses the short slip.
- Odd-job markers and crimes wait during the route, so a pizza marker cannot replace the story mission. They return when the route is done.
- `?nocut` and `?skipintro` do not run the route. The training check that flushes one clog still reads FLUSH THE CLOGS.
- The save stores `jobs.route` (0 to 3). An older save that already won the bomb starts at Mission 2.
