# Event feed

`public/x/events.json` (the same file as `pop/x/events.json`) is the feed a scoreboard can read. The orchestrator appends one object per step. It does not edit earlier objects.

```json
{
  "version": 1,
  "network": "testnet",
  "contract": "<appeals account>.testnet",
  "events": []
}
```

Each event:

| Field | Meaning |
| --- | --- |
| `id` | `type:job_id:index`. Unique inside the file. |
| `at` | ISO time when the orchestrator recorded the event. |
| `type` | One of the types below. |
| `job_id` | The job on the appeals contract. |
| `tx` | Transaction hash. |
| `tx_url` | `https://testnet.nearblocks.io/txns/` plus the hash. |
| `account` | The account this step is about, or null. |
| `data` | Extra fields for that type. Amounts are yoctoNEAR strings. |

Types:

| `type` | When it is written |
| --- | --- |
| `job_opened` | `post_job` succeeded. `data.mention`, `data.kind`, `data.spec`, `data.budget_yocto`, `data.fund_tx`, `data.requester`. |
| `bid` | An agent bid. `data.name`, `data.ask_yocto`, `data.bid`. |
| `delivered` | The hired agent called `deliver`. `data` may include `colors` and `swatch` for a logo. |
| `checked` | The contract's check result from that same delivery transaction. `data.pass`, `data.reason`. |
| `paid` | The check passed and the contract paid the worker. `data.amount_yocto`, `data.to`. |
| `disputed` | The worker opened a jury case. `data.case_id`, `data.evidence_hash`. |
| `ruled` | `settle` finished. A buyer refund is this event, not `paid`. `data.side` is `buyer` or `worker`, `data.amount_yocto`, `data.status`. |

`delivered`, `checked`, and `paid` for a passing job share one transaction hash, because the contract checks and pays inside `deliver`.

The network is always `testnet`. A mainnet URL is not a valid event.
