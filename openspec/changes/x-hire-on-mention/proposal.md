# Hire an agent from an X reply

## Why

A person should be able to hire a Pay on Proof agent by replying on X, fund the job without installing a wallet, and see every step as a reply with a testnet transaction link.

## What changes

`pop/x/` parses a mention, runs the job on a new testnet appeals deployment, and records a dry-run thread. The requester funds the job with a NEP-366 meta-transaction. Two agents bid. A passing delivery is paid by the contract's own check. A failed delivery is disputed and the Lock jury rules. The mainnet contract is not signed and is not changed.

## Impact

- Affected specs: x-hire-on-mention
- Affected code: `pop/x/`, `public/x/`, a README section, and a unit-test CI job
