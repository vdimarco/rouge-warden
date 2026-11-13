// Credit score shared by the page, the read-only verifier, and the testnet run.
// The contract in credit/contract uses the same weights. test/vectors.json locks both.

export const FORMULA = {
  pass: 10,
  fail: 8,
  juryWin: 15,
  juryLoss: 12,
  baseBudget: 20_000_000_000_000_000_000_000n,
  stepBudget: 20_000_000_000_000_000_000_000n,
  negBudget: 10_000_000_000_000_000_000_000n,
  depositAtZero: 50_000_000_000_000_000_000_000n,
  depositStep: 4_000_000_000_000_000_000_000n,
  depositFloor: 1_000_000_000_000_000_000_000n,
};

export function emptyRecord() {
  return { passes: 0, fails: 0, juryWins: 0, juryLosses: 0, earned: 0n };
}

export function scoreOf(record) {
  return record.passes * FORMULA.pass
    + record.juryWins * FORMULA.juryWin
    - record.fails * FORMULA.fail
    - record.juryLosses * FORMULA.juryLoss;
}

export function limitsFromScore(score) {
  if (score >= 0) {
    const s = BigInt(score);
    const maxBudget = FORMULA.baseBudget + s * FORMULA.stepBudget;
    const cut = s * FORMULA.depositStep;
    let minDeposit = FORMULA.depositAtZero > cut ? FORMULA.depositAtZero - cut : 0n;
    if (minDeposit < FORMULA.depositFloor) minDeposit = FORMULA.depositFloor;
    return { score, maxBudget, minDeposit };
  }
  const n = BigInt(-score);
  return {
    score,
    maxBudget: FORMULA.negBudget,
    minDeposit: FORMULA.depositAtZero + n * FORMULA.depositStep,
  };
}

export function limitsOf(record) {
  return limitsFromScore(scoreOf(record));
}

export function addCheck(record, pass, payout, price) {
  if (pass) record.passes += 1;
  else record.fails += 1;
  if (pass && payout === "sent") record.earned += BigInt(price);
}

export function addRuling(record, status, price) {
  if (status === "paid") {
    record.juryWins += 1;
    record.earned += BigInt(price);
  } else if (status === "refunded") record.juryLosses += 1;
}

// Hire receipts and appeals receipts and rulings. Mainnet, the pool, and the X feed stay out.
export function recordsFromEvents(events) {
  const map = new Map();
  const row = (agent) => {
    if (!map.has(agent)) map.set(agent, emptyRecord());
    return map.get(agent);
  };
  for (const e of events) {
    if (e.source !== "hire" && e.source !== "appeals") continue;
    if ((e.type === "payout" || e.type === "refusal") && e.agent) addCheck(row(e.agent), e.pass === true, e.payout, e.near || 0);
    if (e.type === "ruling" && e.worker) addRuling(row(e.worker), e.rulingStatus, e.near || 0);
  }
  return map;
}

export function fmtNear(y) {
  const n = BigInt(y);
  const neg = n < 0n;
  const v = neg ? -n : n;
  const whole = v / 10n ** 24n;
  const frac = (v / 10n ** 20n) % 10000n;
  return `${neg ? "-" : ""}${whole}.${frac.toString().padStart(4, "0")}`;
}
