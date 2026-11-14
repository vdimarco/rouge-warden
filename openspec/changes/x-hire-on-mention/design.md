# Hire from a mention

## Decision

The X flow reuses the testnet appeals contract from `near-hackathon-appeals` (merged into this branch). That contract runs the same checks as Pay on Proof, pays a pass in the delivery transaction, and sends a failed delivery to a Lock jury. The parent/sub-account hire contract in `near-hackathon-hire` is not merged. The two bidders here are separate testnet accounts.

The locked mainnet contract is not a dependency of this flow. `pop/contract/` is not edited. New money moves on testnet only.

## No wallet install

Checked on 13 November 2026:

- NEAR Auth (`https://auth.near.org/`, the current FastAuth) is the social login that matches this task: Google, Apple, email, or a passkey, an MPC key, and a relayer. It still requires an Auth0 application (`domain`, `clientId`, `audience`). This run does not create that application.
- Meteor, HOT, and Intear are wallet apps or browser extensions. They are not a login that stays inside a mobile web page.
- A NEP-366 delegate was sent on testnet (`xapp-mwfiasif.testnet`, transaction `FkcJmC3mHPrsmkQos7XxaDsCeMx9Q6D5CNaeYv3788Se`). The receipt deposit was taken from the relayer. The requester's balance stayed the same. That does not fund the job from the requester, so the recorded run does not use it.
- The recorded funding transaction is a transfer signed by an implicit account. The funding page creates that same kind of ed25519 key in the browser. There is no extension. On testnet a relayer account first sends NEAR to that new account so it exists. The job deposit is the later transfer, and the signer is the requester.

The funding page says this in those words. It does not pretend a Google login ran.

## X

The reply adapter speaks the X API v2 `POST /2/tweets` with OAuth 1.0a. The default is a dry run: it writes the exact reply text into `public/x/thread.html` and does not call the API. It refuses the username `proto_von`. Live posting needs a dedicated bot and the credentials listed in `pop/x/README.md`. This run does not create an X account.

## Events

`public/x/events.json` is the feed `pop/board/` can read. Types are `job_opened`, `bid`, `delivered`, `checked`, `paid`, `disputed`, and `ruled`. Each event has a testnet transaction hash and a nearblocks URL. A buyer refund is a `ruled` event, not a `paid` event. `paid` means the worker was paid because the check passed.

## Checks

Unit tests do not touch a network. `node pop/x/verify.mjs` reads the recorded testnet run and does not use a key. `node pop/scripts/verify.mjs mainnet` stays 14 of 14.
