// Drives the MCP server as a client would, against the testnet contract: list, rules, preview, bid.
//   node test/mcp.test.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { keyStore } from "../lib/near.mjs";

const ks = keyStore("testnet"), B = ks.get("seller-b");
const transport = new StdioClientTransport({ command: process.execPath, args: [new URL("../mcp/server.mjs", import.meta.url).pathname],
  env: { ...process.env, POP_NETWORK: "testnet", POP_CONTRACT: ks.get("pop").accountId, POP_ACCOUNT_ID: B.accountId, POP_PRIVATE_KEY: B.secretKey } });
const client = new Client({ name: "pop-test", version: "0.0.1" });
await client.connect(transport);
let fails = 0;
const ok = (n, c, x = "") => { console.log(`${c ? "ok  " : "FAIL"} ${n}${x ? " · " + x : ""}`); if (!c) fails++; };
const tools = (await client.listTools()).tools.map((t) => t.name);
ok("lists the eight tools", ["list_jobs", "get_job", "job_rules", "preview_check", "bid", "respond", "deliver", "my_receipts"].every((t) => tools.includes(t)), tools.join(","));
const parse = (r) => JSON.parse(r.content[0].text);
const rules = parse(await client.callTool({ name: "job_rules", arguments: {} }));
ok("job_rules explains every kind", ["map", "roster", "paint", "tune"].every((k) => rules[k]));
const jobs = parse(await client.callTool({ name: "list_jobs", arguments: {} }));
ok("list_jobs answers", Array.isArray(jobs), `${jobs.length} open`);
// the first map job that is finished; e2e.mjs makes one on a fresh deployment
let job = null;
for (let id = 0; id < 50 && !job; id++) {
  const r = await client.callTool({ name: "get_job", arguments: { job_id: id } });
  if (r.isError) break;
  const j = parse(r);
  if (j && j.kind === "map" && j.state === "done") job = j;
}
ok("get_job finds a finished map job", !!job, job ? `job ${job.id}` : "none");
const jid = job ? job.id : 0;
const prev = parse(await client.callTool({ name: "preview_check", arguments: { job_id: jid, data: "{\"rooms\":[]}" } }));
ok("preview_check runs the on-chain check", prev.pass === false && /rooms/.test(prev.reason), prev.reason);
const bad = await client.callTool({ name: "bid", arguments: { job_id: jid, ask_near: 0.1 } });
ok("bid on a finished job is refused with the contract's reason", bad.isError && /job not open/.test(bad.content[0].text), bad.content[0].text.slice(0, 120));
const mine = parse(await client.callTool({ name: "my_receipts", arguments: {} }));
ok("my_receipts lists this seller's receipts", mine.length > 0 && mine.every((r) => r.seller === B.accountId), `${mine.length} receipts`);
await client.close();
console.log(fails ? `${fails} checks failed` : "all checks passed");
process.exit(fails ? 1 : 0);
