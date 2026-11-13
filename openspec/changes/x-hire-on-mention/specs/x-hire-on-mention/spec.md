## ADDED Requirements

### Requirement: A mention becomes a job

The parser reads one X mention into a Pay on Proof kind, a spec the contract already checks, and a NEAR budget.

#### Scenario: A logo mention

- **WHEN** the text is `@payonproof make me a logo, 5 NEAR`
- **THEN** the kind is paint, the spec asks for contrast 450, the budget is 5 NEAR, and the handle is payonproof

#### Scenario: A map mention

- **WHEN** the text is `@payonproof a 3 room map, 0.2 NEAR`
- **THEN** the kind is map, the spec asks for 3 rooms, and the budget is 0.2 NEAR

#### Scenario: No amount

- **WHEN** the text has a handle and a logo but no NEAR amount
- **THEN** the parser refuses it

### Requirement: Replies stay a dry run unless a bot is configured

The reply adapter writes the thread it would post. It does not post to X without credentials, and it never posts as proto_von.

#### Scenario: Dry run

- **WHEN** the adapter is asked to reply and no live flag is set
- **THEN** the thread HTML contains that reply text and the testnet transaction link, and the X API is not called

#### Scenario: The owner's account

- **WHEN** the bot username is proto_von
- **THEN** the adapter refuses, including when live credentials are present

#### Scenario: Live credentials missing

- **WHEN** live posting is requested and a credential is missing
- **THEN** the adapter names the missing credential and does not call the X API

### Requirement: Funding is testnet and does not install a wallet

The requester account is an implicit account. A relayer submits the requester's signed delegate. The relayer pays gas. The requester pays the deposit. Signing on mainnet is refused.

#### Scenario: Mainnet

- **WHEN** the fund module is asked to sign for mainnet
- **THEN** it refuses before sending

### Requirement: The event feed lists the job lifecycle

The feed is JSON. Each event has a type, a job id, a time, a transaction hash, and a testnet nearblocks URL.

#### Scenario: The seven types

- **WHEN** a feed from a finished run is checked
- **THEN** it contains job_opened, bid, delivered, checked, paid, disputed, and ruled, and none of the URLs point at mainnet

### Requirement: A passing check pays and a failed check can be appealed

On testnet, two agents bid. The hired agent's delivery is checked by the appeals contract. A pass pays in that transaction. A fail can be disputed, and the jury's ruling pays the worker or refunds the buyer.

#### Scenario: Read the run

- **WHEN** `node pop/x/verify.mjs` runs after the recorded testnet run
- **THEN** it reports every check passed and prints the funding, payment, and ruling transaction links
