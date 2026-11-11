// Funds a NEAR account from Solana through NEAR Intents 1Click: SOL in, NEAR out to the recipient.
// Prints a Solana deposit address and the exact SOL to send. Nothing moves until someone sends SOL there.
//   node scripts/fund-via-intents.mjs quote <near-recipient> <near-amount> <solana-refund-address>
//   node scripts/fund-via-intents.mjs status <deposit-address>
const API = "https://1click.chaindefuser.com";
const [cmd, a, b, c] = process.argv.slice(2);
if (cmd === "quote") {
  const amount = (BigInt(Math.round(Number(b) * 1e6)) * 10n ** 18n).toString();
  const body = {
    dry: false, swapType: "EXACT_OUTPUT", slippageTolerance: 100,
    originAsset: "nep141:sol.omft.near", depositType: "ORIGIN_CHAIN",
    destinationAsset: "nep141:wrap.near", amount,
    refundTo: c, refundType: "ORIGIN_CHAIN",
    recipient: a, recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
  const r = await fetch(API + "/v0/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!d.quote) { console.error("quote failed:", JSON.stringify(d)); process.exit(1); }
  const q = d.quote;
  console.log(JSON.stringify({ depositAddress: q.depositAddress, sendSol: q.amountInFormatted, minSol: q.minAmountIn ? Number(q.minAmountIn) / 1e9 : undefined, usd: q.amountInUsd, receiveNear: q.amountOutFormatted, deadline: q.deadline || body.deadline, timeEstimate: q.timeEstimate, correlationId: d.correlationId }, null, 2));
} else if (cmd === "status") {
  const r = await fetch(API + "/v0/status?depositAddress=" + encodeURIComponent(a));
  console.log(r.status, (await r.text()).slice(0, 1500));
} else { console.error("usage: quote <recipient> <near> <refundTo> | status <depositAddress>"); process.exit(1); }
