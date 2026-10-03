# Loon Echo: rescue run

A free-swimming rescue game at `/echo` and `/echo/`. Swim around the lake to collect chicks. They follow you in a line. Lead the line back to the nest, and choose when to bank it. A small group is safe, but a bigger group scores more: `100 × group²`. Each bank restores one energy, up to three.

Each day has its own lake. The date at the cottage in Ontario sets the lake number (Lake #1 is 1 January 2026), and the number sets the rocks (two to four), the six fish, the three boat lanes and the chick spots of every clutch. So the whole crew swims the same lake each day. A link with `#lake=N` opens lake N. The end card shows a line such as "Lake #278 · 3 clutches · 21 home · 2:14", and COPY puts it on the clipboard with your score and a link to the lake.

The run has no last level. When all eight chicks of a clutch are home, the nest is full. You get all your energy back, and the next clutch hatches at new spots. Each clutch makes the lake more dangerous. The eel swims faster, reaches further and rests less between lunges. A second eel joins at clutch 3, and one more comes every three clutches, up to six. Boats come more often, use a third lane from clutch 2, and cross in pairs from clutch 4. The run ends when your energy is gone.

- Click or tap a point, drag, or use the arrows or WASD to swim. The line keeps its spacing when you stop or honk. The loon has a light ring, so you can find it at a glance.
- DIVE (Space) is a toggle. Three seconds of breath let the whole line pass under rocks, boats and eels. Surface to rescue or bank chicks. When the breath runs out, you come up and must wait a moment before the next dive.
- HONK (E) pulls near chicks to you and stops a near eel for a moment. It has a seven-second cooldown and does not work under the water.
- An eel hunts your line. If it touches a chick, it takes that chick out of the line and drops it on the lake. That costs no energy, but you must go back for the chick. When the eel is near enough, it winds up: a dashed line, a "!" and a tone show where it will strike. The warning lasts 0.85 s in the first clutches and never less than 0.55 s. Only the lunge costs energy. The eels take turns, so two strikes never come at once. Eels stay away from the nest.
- Rocks block the loon at the surface and do no damage. If you aim behind a rock, the loon slides round the rim toward the target, with a soft bonk. A target inside a rock stops the loon at the rim.
- Boat lanes flash for 1.5 s before a boat crosses. A boat hit or an eel lunge costs one energy and scatters up to two chicks from the line. They stay on the lake for rescue. Chicks at the nest stay safe.
- The banked chicks hop into the nest one by one. A bank of four or more is a big moment: the lake goes to slow motion for at least 0.6 s, each chick lands on the next note of a rising scale, and "+100 × n²" counts up. Eight at once also sets off fireworks.
- When your energy is gone, the loon spins down, the lake dims and three notes fall. Then the end card shows your score against your best, and how many more chicks would have hatched the next clutch.
- Fish under the water give points and shorten the honk cooldown. The best score stays in local storage.
- Pause with P, Escape, or the button. Switching away pauses automatically. Blocked storage or audio does not stop play.

The alien lake and six original sprites were previously generated through Higgsfield in the requested cartoon direction and are reused here. `art/provenance.json` records those generations. The loon ring, the eels, the fish and the effects are drawn in code.

Serve `public/` with a static server. `crossing.js` holds the run logic, with no DOM, audio or clock. `main.js` handles drawing, input, sound and the cards. Tests:

- `node --test qa/echo/crossing.test.mjs` checks the run logic.
- `node qa/echo/echo.sim.mjs` lets four bots play 200 seeded runs each, and checks the run length and the score spread.
- `LAB_URL=http://localhost:8787/lab/ NODE_PATH=$(npm root -g) node qa/echo/echo.e2e.mjs` plays the game in a browser at a phone size and a desktop size. It stops the frame clock and moves game time by hand through `window.__echo`, so a slow machine gives the same result. Set `SHOTS=<folder>` to save screenshots.
