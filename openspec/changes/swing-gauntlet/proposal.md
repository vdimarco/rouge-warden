# Swing: the Gauntlet

In Full Swing (`public/vr/`) has Spider-Man-style fights: punch, punch, kick, the zip strike, the dodge, the rope pull, the
finisher, hit-stop, shake and impact frames. The user asked for a gauntlet loop to improve the combat and the look of the fights.

A loop here has two sides. For the player it is the Gauntlet: one roof, round after round of the Sludge Gang until the hero is
knocked out. For the work it is a test loop: a bot plays the Gauntlet with no browser and reports balance numbers, and a browser
run plays it with the real inputs, measures the fight marks in pixels and saves screenshots of every state. Each pass of the loop
showed a problem, and this change fixes the ones it found.

## Why

- **A fight has no long form.** A brawl is two waves and done. There is no place to practise the moves or to test them.
- **Every goon is the same.** Nothing asks for a dodge more than a punch does, so the dodge rarely matters.
- **A wind-up is hard to see.** The red mark floats over the goon's head; the goon himself does not change. In a crowd it is not
  clear which one is about to hit.
- **A blow on a goon does not read on the goon.** The word and the shake show it; his body does not flash.
- **The first loop pass found more:** the training card and its lines covered a fight; the goal beam stood over the goon it
  pointed at and hid him; the first arena roof had a plant room and air-conditioner boxes the camera sat inside; the round banner
  covered the goons; a kick cancelled the brute's charge, so he never landed a blow; an early dodge beat the charge too.

## What changes

- **The Gauntlet** (`jobs.js gauntlet`, `gauntletRound`, `gauntletPay`): a marker that is always offered (after Mission 1) on one
  open roof near the start (`city.js pickArena`, `city.arena`). Round n brings 2 + n goons (at most 8), a brute from round 3 (two
  from round 6), a gang that walks faster and winds up shorter each round. Between rounds: a 4 s rest and two hearts back. A
  knock-out ends it and pays 5 × n Loonies for each round n cleared. The best round is kept (`save.best.gauntlet`). `?gauntlet` in
  the URL starts play in it.
- **The brute** (`combat.js FIGHT.brute`): 6 points, a purple hoodie, 1.4 times the size. A punch hurts him but does not stop him,
  and nothing stops his wind-up or his charge. From 3.2 to 8 m he winds up for 0.85 s and lunges at 15 m/s; his blow takes two
  hearts. A dodge beats it only if it is still on when he arrives: a dodge in his lunge is perfect, one early in his wind-up is
  over too soon. A rope staggers him but cannot yank him.
- **Fight marks on the goons** (`streetview.js`): a goon on his way to a blow has a red rim and a thicker red outline that pulse; a
  goon hit flashes paper white for 0.07 s and fades back over 0.07 s.
- **The fight ring** (`actionview.js`): a hazard-striped ring and a sludge splat painted on the arena roof; it lights up and its
  stripes crawl while the Gauntlet runs. Roof props keep off the arena (`cityview.js` keep-out).
- **Banners** (`actionhud.js banner`): ROUND n with the gang it brings, a yellow CLEARED! stamp, and the end with the rounds and
  the best.
- **Feel:** a brute's blow is a heavy impact (0.1 s hit-stop, a big shake, an impact frame, a red THUCK); a punch on a brute is a
  grey THUCK; his charge starts with a red WHOOSH and a shake.
- **Quiet training:** while the Gauntlet runs the training checklist folds away and says nothing (`game.hush`).
- **The test loop:** `qa/vr/gauntlet-bot.mjs` (balance runs), `qa/vr/gauntlet.test.mjs` (unit), `qa/vr/gauntlet.e2e.mjs`
  (browser, two layouts, pixel checks, screenshots and `gauntlet-report.json`).
- The version goes to 1.25.0 (Quest APK code 32).

## Out of scope

- The headset keeps its fights as they are. The Gauntlet is a flat-play mode (as all the city action is).
- New comic word art (the atlas has nine words; the new uses tint the ones there).
- A ranged goon, a shield goon, and a leaderboard.
