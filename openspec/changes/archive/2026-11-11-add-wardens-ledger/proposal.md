## Why
The user entered the NEAR Hackathon Agent Economy track: agents that earn, spend, negotiate, hire other agents, and pay for APIs, compute or data, directly or through NEAR Intents. The track prompt asks for a general contractor agent that splits a job, hires sellers, makes one counter-offer, checks the work, pays within budget, and keeps a receipt for each task.

## What Changes
Add Warden's Ledger at `/ledger/`, a Lab game. The player is the Warden, a contractor agent with a wNEAR wallet. Each day a client posts a commission with a budget. The Warden posts its tasks, reads bids from cottage agents, makes one counter-offer per bid, hires, checks each delivery with a real check on the delivered data, and pays the seller through a NEAR Intents 1Click quote in the seller's own token and chain. Agents spend part of their fee on paid APIs and can hire other agents. An Auto switch lets the Warden play itself. Each task writes a receipt that the player can export as JSON.

Payment is a dry run. The page holds no keys and moves no funds. It asks 1Click for real signed `dry: true` quotes, and falls back to a bundled price list when the API is out of reach.

## Impact
New static folder `public/ledger/`, a cabinet screen `public/arcade/ledger.webp`, a Lab cabinet in `public/index.html`, a Lab-only entry in `public/arcade/switch.js`, a link in `public/lab/index.html`, checks under `qa/ledger/`, and a line in `AGENTS.md`. No other game changes. The page makes no sound.
