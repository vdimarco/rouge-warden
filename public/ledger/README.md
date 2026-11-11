# Warden's Ledger

A NEAR Hackathon entry for track 07, Agent Economy. It is a Lab game in the Cottage Arcade at `/ledger/`.

You play the Warden, a general contractor agent with a wallet of wNEAR. Each day a client commissions a new stop for the arcade and gives a budget. The Warden splits the job into tasks, reads bids from other agents, makes one counter-offer per bid, hires inside the budget, checks each delivery, and pays the seller through NEAR Intents in the seller's own token and chain. Every finished task writes a receipt.

## Run it

Serve `public/` with any static server and open `/ledger/`:

```sh
python3 -m http.server 8765 --directory public
# open http://127.0.0.1:8765/ledger/
```

No install, no key and no build step. `?auto=1` starts the autopilot. `?seed=42` replays a season. `?offline=1` uses the bundled prices.

## What the agents do

| Track verb | In the game |
| --- | --- |
| Earn | The client pays the Warden when the day closes, by the share of tasks that passed, less 8% for each failed delivery. Sellers earn their agreed fee. |
| Spend | The Warden pays sellers from its wallet. Some sellers buy API calls (renders, compute, data) behind HTTP 402 paywalls out of their fee. |
| Negotiate | One counter per bid at 90, 80 or 70 percent. The seller accepts, names one final price, or walks away. |
| Hire | The Warden hires sellers. Reed & Reel, a seller, hires Hum, another agent, for the bass line and checks Hum's part. |
| Pay through NEAR Intents | Each pass gets a 1Click `EXACT_OUTPUT` quote from wNEAR to the seller's asset: USDC on NEAR, Base, Arbitrum or Solana, USDT on Tron, or wNEAR. |

Checks run on the delivered data. A map must connect every room to the entry and have an exit. A roster's threat must fall in the day's band. A palette's floor and wall must meet a contrast ratio. A tune must have the asked bars and stay in key. A fail pays nothing and frees the escrow.

The budget is a hard rule. Hiring locks the estimated wNEAR cost plus 3% in escrow. The game refuses a hire that does not fit in the free balance, and it refuses a payment whose quote passes the lock.

## What is real and what is simulated

- **Real:** the 1Click quotes. The page calls `https://1click.chaindefuser.com/v0/tokens` and `POST /v0/quote` with `dry: true` from the browser. Each receipt keeps the quote's correlation id, signature, wNEAR in, amount out, chain and settle time. The fees are real too: a payout on Solana or Tron costs about $0.22 more than one on NEAR or Base, so the seller's chain changes the true price.
- **Real:** the checks, the escrow rule and the one-counter rule. They are plain code in `economy.js`, covered by node tests.
- **Simulated:** the sellers and what they buy. The agents are fictional, and their API purchases and subcontract are marked simulated in each receipt.
- **Not done:** moving funds. Dry quotes return no deposit address. NEAR Intents has no testnet.

## Keys

The page holds no keys and signs nothing. The refund and recipient addresses in the quotes are NEAR implicit account ids made from hashes, or burn and placeholder addresses on other chains. Nobody owns them, and dry quotes never use them.

A live version would keep the key outside the browser. The Warden would hand each quote's deposit address to a policy-bound wallet, such as the NEAR Agent API, that caps spend per task and per day. The Warden would then send `submitDepositTx` and poll `getExecutionStatus` until `SUCCESS` or `REFUNDED` before it writes the receipt.

## The NEAR AI Agent Market

The track asks how jobs on market.near.ai are posted and paid by code. Its OpenAPI spec is at `https://market.near.ai/openapi.json`. `GET /v1/agents` and `GET /v1/platform/stats` are public. The job board, bids, job posts, assignments and wallet need an account or agent token, and jobs are paid from an escrow wallet on the market. The API sends no CORS header for other sites, so a browser page cannot call it directly. The game does not post jobs there.

## The autopilot

The Auto switch lets the Warden play itself. On the live arcade it asks Jev, the arcade's AI director, through `/api/warden` which bid to take. The stand-in policy in `economy.js` keeps the budget rule and the counter, and it decides alone when Jev is out or the page runs locally.

`node qa/ledger/bot.mjs 200` plays 200 seasons with three policies. On seeds 1 to 200: the stand-in makes about 4.1 wNEAR a season with no season in the red. Hiring the cheapest bid makes about 2.1 and ends 15 seasons in the red. Hiring the best reputation makes about 1.1 and ends 18 in the red.

## Files

- `economy.js`: agents, commissions, bids, the counter, escrow, deliveries, checks, payouts, receipts, the stand-in policy. Pure and seeded.
- `intents.js`: the 1Click client and the offline estimate.
- `prices.js`: bundled prices and per-chain fees. `node qa/ledger/snapshot.mjs` rebuilds it from live quotes.
- `warden.js`: the autopilot's call to Jev.
- `app.js`, `index.html`, `style.css`: the page.

## Checks

```sh
node qa/ledger/economy.test.mjs
node qa/ledger/bot.mjs 200
NODE_PATH=qa/browser/node_modules node qa/ledger/smoke.e2e.mjs          # needs the server; 1Click mocked
NODE_PATH=qa/browser/node_modules node qa/ledger/smoke.e2e.mjs --live   # also one real dry quote
```
