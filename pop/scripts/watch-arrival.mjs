// Watches an account for NEAR or wNEAR to arrive, every 10 seconds. Exits when either is above zero.
//   node scripts/watch-arrival.mjs <account>
import { accountState, view, fmt } from "../lib/near.mjs";
const id = process.argv[2];
for (;;) {
  const s = await accountState("mainnet", id);
  const w = await view("mainnet", "wrap.near", "ft_balance_of", { account_id: id }).catch(() => "0");
  if (s || BigInt(w) > 0n) { console.log(new Date().toISOString().slice(11, 19), "native", s ? fmt(s.amount) : "none (account not created)", "wNEAR", fmt(w)); process.exit(0); }
  await new Promise((r) => setTimeout(r, 10000));
}
