// The committed date file has to match git. Dates are not typed by hand.
import assert from "node:assert/strict";
import { collect, datesFile, readGames, folderFor } from "./game-dates.mjs";

const fresh = collect();
const saved = datesFile();
assert.equal(saved.version, 1);
assert.equal(saved.clock, "committer");
assert.deepEqual(saved.games, fresh.games);
const games = readGames();
assert.deepEqual(Object.keys(saved.games), Array.from(games, (g) => g.id));
for (const game of games) {
  const row = saved.games[game.id];
  assert.equal(row.path, folderFor(game));
  assert.ok(Date.parse(row.added) <= Date.parse(row.updated), game.id);
}
console.log("PASS game dates match git for " + games.length + " games");
