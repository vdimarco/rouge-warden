## Why
Warden's Ledger shows an agent economy, but its agents are made up and its payments are dry runs. The user asked for something new for the NEAR Agent Economy track and approved real spending with a $10 cap. Most agent markets pay when a person approves the work or when the seller has a good reputation. A job whose result a machine can check lets the money move on proof alone.

## What Changes
Add Pay on Proof: a NEAR contract that holds escrow for jobs with checkable specs. The Warden posts jobs. Any NEAR account can bid. The Warden makes one counter per bid and the seller answers once. The hired seller delivers its data to the contract, and the contract runs the check. A pass pays the seller at once, in NEAR or into the seller's NEAR Intents balance as wNEAR. A fail pays nothing and reopens the job.

The Warden agent holds only a function-call key on the contract account. That key can post, counter and hire, and it cannot move funds. The contract keeps total spend under a cap set at deployment. The full-access key is deleted after setup, so nobody can change the code. The beneficiary can close the contract and take back what is left.

Add a Warden agent, two reference seller agents and an MCP server that lets any agent find jobs, bid and deliver. Show the live jobs and receipts in Warden's Ledger, and let players walk the maps that passed.

## Impact
New folder `pop/` (contract, agents, MCP server, scripts). Changes to `public/ledger/` for the On chain view. One real deployment on NEAR mainnet, funded by the user, with no more than $10 paid to agents. No other game changes.
