import test from "node:test";
import assert from "node:assert/strict";
import { eventsFromAppeals, eventsFromHire, eventsFromPop, leaderboards, parseXFeed } from "../public/events.mjs";
import { recordsFromEvents } from "../public/score.mjs";

const HIRE = "https://testnet.nearblocks.io/address/hire.testnet";
const APPEALS = "https://testnet.nearblocks.io/address/appeals.testnet";

test("a failed check that a jury later pays is one refusal and one ruling", () => {
  const events = eventsFromAppeals(
    [{ id: 0, kind: "map", title: "Dock", budget: "150000000000000000000000", posted_ms: 10, state: "done" }],
    [{ id: 0, seller: "worker.testnet", price: "150000000000000000000000", pass: false, payout: "sent", reason: "room cut off", at_ms: 20 }],
    [{ id: 0, receipt: 0, worker: "worker.testnet", buyer: "buyer.testnet", price: "150000000000000000000000", status: "paid", outcome: "Decided", ruling: 0 }],
    APPEALS,
  );
  assert.deepEqual(events.map((e) => e.type), ["job", "refusal", "dispute", "ruling"]);
  const book = leaderboards(events);
  assert.equal(book.earned.length, 1);
  assert.equal(book.earned[0].agent, "worker.testnet");
  assert.equal(book.earned[0].near, "150000000000000000000000");
  assert.equal(book.rate[0].pass, 0);
  assert.equal(book.rate[0].fail, 1);
  const rec = recordsFromEvents(events).get("worker.testnet");
  assert.equal(rec.passes, 0);
  assert.equal(rec.fails, 1);
  assert.equal(rec.juryWins, 1);
  assert.equal(rec.juryLosses, 0);
  assert.equal(rec.earned, 150000000000000000000000n);
});

test("hire payouts credit the account that was paid", () => {
  const events = eventsFromHire(
    [{ id: 0, title: "Parent", kind: "map", budget: "500000000000000000000000", posted_ms: 1, state: "done" }],
    [{ id: 0, title: "Crew", kind: "roster", budget: "200000000000000000000000", posted_ms: 2, state: "done" }],
    [
      { id: 0, seller: "crew.testnet", price: "200000000000000000000000", pass: true, payout: "sent", role: "sub", reason: "ok", at_ms: 3 },
      { id: 1, seller: "owner.testnet", price: "300000000000000000000000", pass: true, payout: "sent", role: "parent", reason: "ok", at_ms: 4 },
    ],
    HIRE,
  );
  const book = leaderboards(events);
  assert.equal(book.earned.find((r) => r.agent === "crew.testnet").near, "200000000000000000000000");
  assert.equal(book.earned.find((r) => r.agent === "owner.testnet").near, "300000000000000000000000");
  assert.equal(events.find((e) => e.id === "hire:sub:0").type, "job");
});

test("mainnet events are not a credit source", () => {
  const events = eventsFromPop("mainnet", [{ id: 0, title: "Map", kind: "map", budget: "1", posted_ms: 1, state: "done" }], [
    { id: 0, seller: "seller.near", price: "5", pass: true, payout: "sent", reason: "ok", at_ms: 2 },
  ], "https://nearblocks.io/address/x");
  assert.equal(recordsFromEvents(events).size, 0);
  assert.equal(leaderboards(events).earned[0].agent, "seller.near");
});

test("an X payout is listed and does not change the credit score", () => {
  const x = parseXFeed({
    source: "pop-x",
    events: [{ id: "1", type: "payout", at: "2026-11-14T00:00:00.000Z", agent: "reply.near", near: "1000000000000000000000000", title: "Reply", detail: "posted", pass: true, tx: null, url: "https://x.com/example/status/1" }],
  });
  assert.equal(x[0].href, "https://x.com/example/status/1");
  assert.equal(leaderboards(x).earned[0].near, "1000000000000000000000000");
  assert.equal(recordsFromEvents(x).size, 0);
  assert.throws(() => parseXFeed({ events: [{ type: "nope" }] }), /bad x event type/);
  const blocked = parseXFeed({ events: [{ type: "job", url: "javascript:alert(1)" }] });
  assert.equal(blocked[0].href, null);
});
