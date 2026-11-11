## Sources
- NEAR Intents verifier source (`github.com/near/intents`, `contracts/defuse/src/contract/tokens/nep141/deposit.rs` and `src/tokens/mod.rs`): `ft_on_transfer` credits the account named in `msg` (a plain account id, or JSON `{ "receiver_id": ... }`). So `wrap.near.ft_transfer_call(intents.near, amount, msg = seller)` puts wNEAR in the seller's Intents balance, and the seller can then swap or withdraw to any chain with a 1Click quote that uses `depositType: INTENTS`.
- NEAR access keys (nomicon, "Access Keys"): a function-call key names one receiver and a list of methods and cannot attach deposits. This gives a policy-bound agent wallet with no extra service.
- near-sdk 5 for the contract, cargo-near to build it. near-api-js for the agents.
- MCP specification (modelcontextprotocol.io) for the seller server, stdio transport.
- No rendering technique is involved. The playable map reuses the Ledger's own map drawing.

## Custody and the cap
- The contract lives on a fresh NEAR implicit account. Its key is made in the build session and is used only to deploy, set up and add the Warden key. Then the full-access key is deleted. After that the code cannot change and no key can send funds out.
- The Warden key is a function-call key on the contract account for `post_job`, `counter`, `hire`, `cancel_job` and `retry_payout`, with a gas allowance. A leaked Warden key can hire an attacker's account and pay it for a forged pass, so the most it can lose is what is left under the cap.
- `cap` is set at init in yoctoNEAR, worth $10 at that moment by the 1Click price. `spent + reserved` never passes it. Storage stake and gas are not spent on agents and come back on `close`.
- `beneficiary` is the user's own account. Only it can call `close`, which deletes the contract account and sends all its NEAR to the beneficiary. `close` is refused while a seller is hired, so a seller who is working is never cut off.

## Checks on chain
Checks are integer math, the same rules as `public/ledger/economy.js`, but stricter on shape: rooms inside the grid and unique, links only between neighbours, exit is a room; roster size exact and threats 1 to 5; colours must be `#rrggbb`, and contrast uses a 256-entry sRGB table in parts per million; tune note count is bars × 4 and every note in the key. Deliveries over 4 KB are refused.

## Negotiation on chain
A bid has an ask. The Warden can counter once. The seller answers once: accept (price becomes the counter), a final price between the counter and the ask, or walk. The Warden hires an open bid at its ask, an accepted counter at the counter, or a final at the final price.

## Limits against spam
One bid per seller per job, eight bids per job, 4 KB per delivery. Delivery windows come from the job; after the window anyone may call `expire`, which reopens the job. A job closes after three failed deliveries and frees its reserve.
