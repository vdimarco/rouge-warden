// Waits until an account holds at least `min` NEAR, checking every 15 seconds. Exits 0 when it does.
//   node scripts/wait-funding.mjs mainnet <account> <min>
import { accountState, fmt } from "../lib/near.mjs";
const [net, id, min] = [process.argv[2], process.argv[3], Number(process.argv[4] || "1")];
let last = null;
for (;;) {
  const s = await accountState(net, id);
  const have = s ? Number(fmt(s.amount, 6)) : 0;
  if (have !== last) { console.log(new Date().toISOString().slice(11, 19), id.slice(0, 12) + "…", "balance", have.toFixed(4), "NEAR"); last = have; }
  if (have >= min) process.exit(0);
  await new Promise((r) => setTimeout(r, 15000));
}
