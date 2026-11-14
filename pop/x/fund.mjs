// Testnet funding without a wallet install.
// The requester holds an ed25519 key, the same kind the funding page creates in the browser.
// The requester signs a transfer to the contract. That key is not a wallet extension.
//
// A NEP-366 delegate was tried on testnet (xapp-mwfiasif.testnet, tx FkcJmC3mHPrsmkQos7XxaDsCeMx9Q6D5CNaeYv3788Se).
// The delegate receipt's deposit was taken from the relayer. The requester's balance did not move.
// That is not the requester funding the job, so the recorded run does not use it.
// NEAR Auth (auth.near.org) is the social login that signs with MPC and a relayer. It needs an Auth0
// application. This module does not create one, and it does not sign on mainnet.
import { actions } from "near-api-js";
import { account } from "../lib/near.mjs";

export function assertTestnet(net) {
  if (net !== "testnet") throw new Error("X hire signs on testnet only");
}

// The recorded run funds 0.6 NEAR once. That covers two 0.2 NEAR budgets and leaves headroom for storage.
export const FUND_NEAR = "0.6";

export async function fundJob({ net, requester, contractId, amount, send }) {
  assertTestnet(net);
  const user = account(net, requester.accountId, requester.secretKey);
  return send(user, contractId, [actions.transfer(BigInt(amount))]);
}
