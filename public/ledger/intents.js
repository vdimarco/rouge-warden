// NEAR Intents 1Click client for Warden's Ledger. Works in the browser and in node.
// The page holds no keys. Every quote is dry (dry: true): it is real and signed, but returns no deposit address and moves no funds.
import { SNAPSHOT } from "./prices.js";

export const ONECLICK = "https://1click.chaindefuser.com";
// The Warden's refund address: a NEAR implicit account id made from a hash, owned by nobody. Dry quotes never use it.
export const WARDEN_ACCOUNT = "8e7168fd5f2a356b0b374117b90a423a49cc7985237af97ecf79591a55c9cde1";

// The tokens the Warden pays in. `sample` is a recipient the snapshot script quotes to.
export const ASSETS = {
  wnear: { id: "nep141:wrap.near", symbol: "wNEAR", chain: "near", decimals: 24, sample: "0f5575d338f52a212b786850991ef3d848552d52072fc362d38472de6be646ce" },
  "usdc-near": { id: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", symbol: "USDC", chain: "near", decimals: 6, sample: "0f5575d338f52a212b786850991ef3d848552d52072fc362d38472de6be646ce" },
  "usdt-near": { id: "nep141:usdt.tether-token.near", symbol: "USDT", chain: "near", decimals: 6, sample: "0f5575d338f52a212b786850991ef3d848552d52072fc362d38472de6be646ce" },
  "usdc-base": { id: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", symbol: "USDC", chain: "base", decimals: 6, sample: "0x1111111111111111111111111111111111111111" },
  "usdc-arb": { id: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", symbol: "USDC", chain: "arbitrum", decimals: 6, sample: "0x2222222222222222222222222222222222222222" },
  "usdc-sol": { id: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near", symbol: "USDC", chain: "solana", decimals: 6, sample: "22rhRY1znpo1dAkoY41MuMCZv9kXonA3kSgVakVtCxZj" },
  "usdt-tron": { id: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near", symbol: "USDT", chain: "tron", decimals: 6, sample: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb" },
};
export const CHAIN_NAMES = { near: "NEAR", base: "Base", arbitrum: "Arbitrum", solana: "Solana", tron: "Tron" };

// Decimal amount to integer units, as a string. Amounts carry at most 6 decimals.
export function toUnits(amount, decimals) {
  const micro = BigInt(Math.round(amount * 1e6));
  return decimals >= 6 ? (micro * 10n ** BigInt(decimals - 6)).toString() : (micro / 10n ** BigInt(6 - decimals)).toString();
}
export function fromUnits(units, decimals) {
  const s = String(units).padStart(decimals + 1, "0");
  return Number(s.slice(0, s.length - decimals) + "." + s.slice(s.length - decimals));
}

// Live prices replace the snapshot when /v0/tokens answers.
const live = { nearUsd: null, usd: {} };
export const nearUsd = () => live.nearUsd || SNAPSHOT.nearUsd;
export const assetUsd = (key) => live.usd[key] || SNAPSHOT.assets[key].usd;

// wNEAR the Warden needs to deliver `amount` of `key`, from the snapshot's fitted fees.
export function estimate(key, amount) {
  if (key === "wnear") return amount * (1 + SNAPSHOT.assets.wnear.pct) + SNAPSHOT.assets.wnear.fixed / nearUsd();
  const f = SNAPSHOT.assets[key];
  return (amount * assetUsd(key) * (1 + f.pct) + f.fixed) / nearUsd();
}

function withTimeout(fetchImpl, url, opts, ms) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = ctl && setTimeout(() => ctl.abort(), ms);
  return fetchImpl(url, { ...opts, signal: ctl?.signal }).finally(() => t && clearTimeout(t));
}

export async function loadPrices({ fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  const res = await withTimeout(fetchImpl, ONECLICK + "/v0/tokens", {}, timeoutMs);
  if (!res.ok) throw new Error("tokens HTTP " + res.status);
  const list = await res.json();
  for (const [key, a] of Object.entries(ASSETS)) {
    const t = list.find((x) => x.assetId === a.id);
    if (t && t.price > 0) live.usd[key] = t.price;
  }
  if (live.usd.wnear) live.nearUsd = live.usd.wnear;
  return { nearUsd: nearUsd(), count: list.length };
}

// A dry EXACT_OUTPUT quote: the seller gets exactly `amount` of `asset`; the quote says how much wNEAR goes in.
export async function quotePay({ asset, amount, recipient, refundTo = WARDEN_ACCOUNT, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  const a = ASSETS[asset];
  if (!a) throw new Error("unknown asset " + asset);
  const body = {
    dry: true,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: ASSETS.wnear.id,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: a.id,
    amount: toUnits(amount, a.decimals),
    refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
  const res = await withTimeout(fetchImpl, ONECLICK + "/v0/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, timeoutMs);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.quote) throw new Error(data.message || "quote HTTP " + res.status);
  const q = data.quote;
  return {
    source: "1click",
    dry: true,
    asset, symbol: a.symbol, chain: a.chain, recipient,
    amountOut: fromUnits(q.amountOut, a.decimals),
    nearIn: fromUnits(q.amountIn, 24),
    usdIn: Number(q.amountInUsd),
    timeEstimate: q.timeEstimate,
    correlationId: data.correlationId,
    signature: data.signature,
    quotedAt: data.timestamp,
  };
}

// The payment the page records: a live dry quote, or the snapshot estimate when the API is out of reach.
export async function pay({ asset, amount, recipient, online = true, fetchImpl, timeoutMs }) {
  if (online) {
    try { return await quotePay({ asset, amount, recipient, fetchImpl, timeoutMs }); }
    catch (e) { return { ...offline(asset, amount, recipient), error: String(e.message || e) }; }
  }
  return offline(asset, amount, recipient);
}
function offline(asset, amount, recipient) {
  const a = ASSETS[asset], nearIn = estimate(asset, amount);
  return { source: "offline", dry: true, asset, symbol: a.symbol, chain: a.chain, recipient, amountOut: amount, nearIn, usdIn: nearIn * nearUsd(), snapshotAt: SNAPSHOT.at };
}
