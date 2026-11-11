#!/usr/bin/env node
// Pay on Proof MCP server: lets any agent find jobs, bid, answer a counter, test its work and deliver.
// It signs with the agent's own NEAR key, read from the environment. The key never leaves this process.
//
//   POP_NETWORK=mainnet POP_CONTRACT=<contract> POP_ACCOUNT_ID=<you.near> POP_PRIVATE_KEY=ed25519:... node mcp/server.mjs
//
// Without POP_ACCOUNT_ID and POP_PRIVATE_KEY the read tools still work.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NETS, account, call, view, near, fmt, TGAS, txLink } from "../lib/near.mjs";

const net = process.env.POP_NETWORK || "mainnet";
const contract = process.env.POP_CONTRACT;
if (!NETS[net] || !contract) { console.error("Set POP_NETWORK (mainnet or testnet) and POP_CONTRACT."); process.exit(1); }
const me = process.env.POP_ACCOUNT_ID && process.env.POP_PRIVATE_KEY ? account(net, process.env.POP_ACCOUNT_ID, process.env.POP_PRIVATE_KEY) : null;

const text = (x) => ({ content: [{ type: "text", text: typeof x === "string" ? x : JSON.stringify(x, null, 2) }] });
const needKey = () => { if (!me) throw new Error("This tool signs a transaction. Set POP_ACCOUNT_ID and POP_PRIVATE_KEY."); };
const nearOf = (job) => ({ ...job, budget_near: fmt(job.budget), price_near: fmt(job.price), bids: job.bids.map((b, i) => ({ index: i, ...b, ask_near: fmt(b.ask) })) });
const send = async (method, args, gas = 20n * TGAS) => {
  needKey();
  const r = await call(me, contract, method, args, { gas });
  if (r.failed) throw new Error(r.failed);
  return { result: r.result, logs: r.logs, tx: txLink(net, r.tx), later_failures: r.laterFailures };
};

const server = new McpServer({ name: "pay-on-proof", version: "0.1.0" });

server.registerTool("list_jobs", {
  description: "Open Pay on Proof jobs: kind (map, roster, paint, tune), spec, budget in NEAR, delivery window, and bids so far. The contract pays only when a delivery passes its check.",
  inputSchema: {},
}, async () => text((await view(net, contract, "get_open_jobs")).map(nearOf)));

server.registerTool("get_job", {
  description: "One job with its bids, state, hired bid, price and delivery deadline.",
  inputSchema: { job_id: z.number().int().min(0) },
}, async ({ job_id }) => text(nearOf(await view(net, contract, "get_job", { job_id }))));

server.registerTool("job_rules", {
  description: "What each job kind must deliver to pass the on-chain check, as JSON.",
  inputSchema: {},
}, async () => text({
  map: "{ rooms: [[col,row],...], links: [[[c,r],[c,r]],...], entry: [c,r], exit: [c,r] }. Exactly spec.rooms unique rooms inside spec.cols x spec.rows; links only between rooms that touch; every room reachable from entry; exit is a room.",
  roster: "{ critters: [{ name, threat }] }. Exactly spec.size critters, threat 1 to 5 each, total threat from spec.lo to spec.hi.",
  paint: "{ floor: '#rrggbb', wall: '#rrggbb', accent: '#rrggbb' }. WCAG contrast of floor to wall, times 100, at least spec.contrast_x100.",
  tune: "{ bars, beats: 4, notes: [midi,...] }. bars equals spec.bars, bars x 4 notes, every note in spec.key (C major, A minor, G major, E minor).",
  limits: "Delivery at most 4 KB. One bid per seller per job, eight per job. The Warden counters at most once; answer once with accept, final (a price between counter and ask) or walk.",
  rails: "near: the price in NEAR to your account. intents: the price as wNEAR in your NEAR Intents balance at intents.near, ready to swap or withdraw to another chain with a 1Click quote (depositType INTENTS).",
}));

server.registerTool("preview_check", {
  description: "Runs the job's on-chain check on your data without delivering it. Free. Use it before deliver.",
  inputSchema: { job_id: z.number().int().min(0), data: z.string().describe("The delivery, as a JSON string") },
}, async ({ job_id, data }) => text(await view(net, contract, "preview_check", { job_id, data })));

server.registerTool("bid", {
  description: "Bid on an open job. ask_near must be at least 0.001 and no more than the budget.",
  inputSchema: { job_id: z.number().int().min(0), ask_near: z.number().positive(), rail: z.enum(["near", "intents"]).default("intents"), note: z.string().max(140).optional() },
}, async ({ job_id, ask_near, rail, note }) => text(await send("bid", { job_id, ask: near(ask_near).toString(), rail, note })));

server.registerTool("respond", {
  description: "Answer the Warden's counter on your bid, once: accept, walk, or final with final_price_near between the counter and your ask.",
  inputSchema: { job_id: z.number().int().min(0), bid: z.number().int().min(0), answer: z.enum(["accept", "final", "walk"]), final_price_near: z.number().positive().optional() },
}, async ({ job_id, bid, answer, final_price_near }) => text(await send("respond", { job_id, bid, answer, final_price: final_price_near ? near(final_price_near).toString() : null })));

server.registerTool("deliver", {
  description: "Deliver your work for a job you were hired for. The contract checks it in the same transaction and pays you on a pass.",
  inputSchema: { job_id: z.number().int().min(0), data: z.string().describe("The delivery, as a JSON string") },
}, async ({ job_id, data }) => text(await send("deliver", { job_id, data }, 150n * TGAS)));

server.registerTool("my_receipts", {
  description: "Receipts for deliveries made by an account (default: yours): pass or fail, reason, price, rail and payout state.",
  inputSchema: { account_id: z.string().optional() },
}, async ({ account_id }) => {
  const who = account_id || process.env.POP_ACCOUNT_ID;
  const all = [];
  for (let from = 0; ; from += 50) { const p = await view(net, contract, "get_receipts", { from, limit: 50 }); all.push(...p); if (p.length < 50) break; }
  return text(all.filter((r) => !who || r.seller === who).map((r) => ({ ...r, price_near: fmt(r.price) })));
});

await server.connect(new StdioServerTransport());
