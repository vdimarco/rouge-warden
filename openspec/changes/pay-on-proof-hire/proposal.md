# A parent agent hires a sub-agent

## Why

Pay on Proof on mainnet lets one Warden post a job and one seller deliver it. The swarm track asks for a job that hires a second agent, and for that hire to use a sub-account. The security track asks for a spending cap in the contract and a function-call key with no full access.

The mainnet contract is locked. This change does not touch it. The new flow runs on testnet only, in `pop/hire/`.

## What changes

A testnet contract lets a hired parent agent post a sub-job paid from its own budget. The parent account keeps only a function-call key scoped to that contract. The contract refuses a sub-job that would pass the parent's cap. A sub-account of the parent delivers, the same on-chain checks used by Pay on Proof run, and the sub-agent is paid. The parent then delivers and is paid what is left. A transfer signed with the parent's key is refused, because that key cannot move NEAR.

## Impact

- Affected specs: pay-on-proof-hire
- Affected code: `pop/hire/` only, plus a short pointer in `pop/README.md` and a hire unit-test step in the Pay on Proof workflow
- Out of scope: mainnet, `pop/contract/`, `pop/appeals/`, `pop/tee/`
