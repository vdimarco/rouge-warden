// The feed pop/board/ reads. One JSON object, append-only events, testnet transaction links.
export const TYPES = ["job_opened", "bid", "delivered", "checked", "paid", "disputed", "ruled"];
const TX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export function createFeed(contract) {
  return { version: 1, network: "testnet", contract, events: [] };
}

export function addEvent(feed, event) {
  const row = {
    id: `${event.type}:${event.job_id}:${feed.events.length}`,
    at: event.at || new Date().toISOString(),
    type: event.type,
    job_id: event.job_id,
    tx: event.tx,
    tx_url: event.tx_url,
    account: event.account || null,
    data: event.data || {},
  };
  feed.events.push(row);
  return row;
}

export function feedErrors(feed) {
  const errors = [];
  if (!feed || feed.version !== 1) errors.push("version must be 1");
  if (!feed || feed.network !== "testnet") errors.push("network must be testnet");
  if (!Array.isArray(feed?.events)) return errors.concat("events must be a list");
  const seen = new Set(feed.events.map((e) => e.type));
  for (const t of TYPES) if (!seen.has(t)) errors.push("missing " + t);
  for (const e of feed.events) {
    if (!TYPES.includes(e.type)) errors.push("unknown type " + e.type);
    if (!TX.test(e.tx || "")) errors.push("bad tx on " + e.id);
    if (!String(e.tx_url || "").startsWith("https://testnet.nearblocks.io/txns/" + e.tx)) errors.push("bad tx_url on " + e.id);
    if (String(e.tx_url).includes("://nearblocks.io/")) errors.push("mainnet url on " + e.id);
  }
  return errors;
}
