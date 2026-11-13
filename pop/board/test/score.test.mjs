import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FORMULA, limitsFromScore, limitsOf, scoreOf } from "../public/score.mjs";

const vectors = JSON.parse(fs.readFileSync(new URL("./vectors.json", import.meta.url), "utf8"));

test("formula constants match the locked vectors", () => {
  assert.equal(FORMULA.pass, vectors.weights.pass);
  assert.equal(FORMULA.fail, vectors.weights.fail);
  assert.equal(FORMULA.juryWin, vectors.weights.juryWin);
  assert.equal(FORMULA.juryLoss, vectors.weights.juryLoss);
  assert.equal(FORMULA.baseBudget, BigInt(vectors.baseBudget));
  assert.equal(FORMULA.stepBudget, BigInt(vectors.stepBudget));
  assert.equal(FORMULA.negBudget, BigInt(vectors.negBudget));
  assert.equal(FORMULA.depositAtZero, BigInt(vectors.depositAtZero));
  assert.equal(FORMULA.depositStep, BigInt(vectors.depositStep));
  assert.equal(FORMULA.depositFloor, BigInt(vectors.depositFloor));
});

test("score and limits match every vector", () => {
  for (const row of vectors.cases) {
    const got = row.scoreOnly != null
      ? limitsFromScore(row.scoreOnly)
      : limitsOf({ passes: row.passes, fails: row.fails, juryWins: row.juryWins, juryLosses: row.juryLosses });
    assert.equal(got.score, row.score);
    assert.equal(got.maxBudget, BigInt(row.max));
    assert.equal(got.minDeposit, BigInt(row.min));
    if (row.scoreOnly == null) {
      assert.equal(scoreOf({ passes: row.passes, fails: row.fails, juryWins: row.juryWins, juryLosses: row.juryLosses }), row.score);
    }
  }
});
