// Drives the MCP server as an agent would, against the mainnet contract, with no key.
// The read tools must work; a tool that signs must refuse. Nothing is signed or sent.
//   cd pop && npm ci && node test/mcp-read.test.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const CONTRACT = process.env.POP_CONTRACT || "ee4994a509efa3cc516411e75f2633b2d8eac2d05fc30cc558bfd43329cde827";
const env = { ...process.env, POP_NETWORK: "mainnet", POP_CONTRACT: CONTRACT };
delete env.POP_ACCOUNT_ID; delete env.POP_PRIVATE_KEY;
const transport = new StdioClientTransport({ command: process.execPath, args: [new URL("../mcp/server.mjs", import.meta.url).pathname], env });
const client = new Client({ name: "pop-read-test", version: "0.0.1" });
await client.connect(transport);
let fails = 0;
const ok = (n, c, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${x ? " · " + x : ""}`); if (!c) fails++; };
const parse = (r) => JSON.parse(r.content[0].text);

const tools = (await client.listTools()).tools.map((t) => t.name);
ok("lists the eight tools", ["list_jobs", "get_job", "job_rules", "preview_check", "bid", "respond", "deliver", "my_receipts"].every((t) => tools.includes(t)), tools.join(","));
const rules = parse(await client.callTool({ name: "job_rules", arguments: {} }));
ok("job_rules explains every kind", ["map", "roster", "paint", "tune"].every((k) => rules[k]));
const jobs = parse(await client.callTool({ name: "list_jobs", arguments: {} }));
ok("list_jobs answers with no key", Array.isArray(jobs), `${jobs.length} open`);
const job = parse(await client.callTool({ name: "get_job", arguments: { job_id: 0 } }));
ok("get_job reads job 0 from mainnet", job.id === 0 && typeof job.kind === "string", `${job.kind} · ${job.state}`);
if (job.deliverable) {
  const v = parse(await client.callTool({ name: "preview_check", arguments: { job_id: 0, data: job.deliverable } }));
  ok("preview_check passes the delivery that was paid", v.pass === true, v.reason);
  const broken = JSON.parse(job.deliverable);
  if (Array.isArray(broken.links)) broken.links = broken.links.slice(0, 1);
  const v2 = parse(await client.callTool({ name: "preview_check", arguments: { job_id: 0, data: JSON.stringify(broken) } }));
  ok("preview_check fails the same delivery with its links cut", v2.pass === false, v2.reason);
}
const rec = parse(await client.callTool({ name: "my_receipts", arguments: { account_id: job.bids?.[0]?.seller } }));
ok("my_receipts reads receipts for an account", Array.isArray(rec) && rec.length > 0, `${rec.length} receipt(s)`);
const bid = await client.callTool({ name: "bid", arguments: { job_id: 0, ask_near: 0.01 } });
ok("bid refuses without a key", bid.isError === true || /POP_PRIVATE_KEY/.test(bid.content?.[0]?.text || ""), (bid.content?.[0]?.text || "").slice(0, 80));
await client.close();
console.log(fails ? `${fails} checks failed` : "all checks passed");
process.exit(fails ? 1 : 0);
