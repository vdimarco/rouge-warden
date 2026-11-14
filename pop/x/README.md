# Hire from a reply

Testnet only. A person replies on X. The parser accepts `@payonproof make me a logo, 5 NEAR`. This deployment's cap is 1 NEAR, so the recorded jobs are 0.2 NEAR each. The mention becomes a job. The person funds it in the browser. Two agents bid. The appeals contract checks the delivery. A pass pays in that transaction. A fail can be disputed, and the Lock jury rules.

The appeal contract is in `pop/appeals/`. `pop/hire/` is the parent and sub-account contract from main. The X bidders are separate accounts, not that parent and sub-account.

The mainnet contract is not signed and its code is not changed.

## Do this, see this

| Do this | See this |
| --- | --- |
| Open the thread replay at `public/x/thread.html` | The mention, then each reply the bot would post, with a testnet transaction link. The page says it is a dry run. |
| Open the funding page at `public/x/index.html` | A phone-width page. Create a key in the browser. The recorded funding transaction is on the page. |
| `node pop/x/verify.mjs` | Every line starts with `ok`, then `all checks passed`, then three transaction links: funding, payment, ruling. No key. |
| `node pop/x/test/all.mjs` | The parser, the dry run, the refusal of `proto_von`, and the mainnet refusal. No network. |
| `node pop/scripts/verify.mjs mainnet` | `all 14 checks passed`. |

`node pop/x/run.mjs` repeats the live testnet run with new faucet accounts. It refuses `mainnet`. Secrets stay in `pop/x/.keys/`, which git ignores.

## This run

Recorded on 13 November 2026. `node pop/x/verify.mjs` reads these from the chain.

| | |
| --- | --- |
| Contract | [`xapp-mwfil00j.testnet`](https://testnet.nearblocks.io/address/xapp-mwfil00j.testnet) |
| Jury | [`xjur-mwfil4ar.testnet`](https://testnet.nearblocks.io/address/xjur-mwfil4ar.testnet) |
| Requester | `bda3be3a43610a19943fb49f5037af23e4dcd57ca668d70b08ba1ff4aa7c0cd6` |
| Ink | `xink-mwfil8ha.testnet` |
| Clay | `xclay-mwfilcm0.testnet` |
| Post before funding, failed | [2tF5hFjL…](https://testnet.nearblocks.io/txns/2tF5hFjLbhtH2C55jLSJ8MePNHUyqSgjoCvG1qWK4bpL) |
| Requester paid 0.6 NEAR | [CheMxrh7…](https://testnet.nearblocks.io/txns/CheMxrh738vqBJ2L1iX5xmRqQRN5E1Ng7XV8qwyZvnX1) |
| Ink paid 0.16 NEAR for the logo | [BPv5jiz9…](https://testnet.nearblocks.io/txns/BPv5jiz9FYSuW4YP6wEaGX2tBcSu8t3fngQh6qi5ZZab) |
| Clay disputed the failed map | [89iAxbxS…](https://testnet.nearblocks.io/txns/89iAxbxS7v7gxCzjPxyrvud84MdgiJCJYFS7UPSTQsCj) |
| Jury ruled for the buyer, 0.11 NEAR refunded | [ENMZX6cD…](https://testnet.nearblocks.io/txns/ENMZX6cDMqTsjtnq2pzzTfgfdi1Pkxrkkd4w8p6yQgou) |

## What the no-wallet login is

NEAR Auth (`https://auth.near.org/`) is the social login that works today. It was FastAuth. A person signs in with Google, Apple, email, or a passkey. NEAR's MPC network holds the key.

NEAR Auth still needs an Auth0 application: a domain, a client id, and an audience. This run does not create an Auth0 application, so it does not complete that login.

Meteor, HOT, and Intear are wallet apps or extensions. A person would have to install one. They are not used here.

A NEP-366 delegate was sent on testnet to `xapp-mwfiasif.testnet` in [FkcJmC3m…](https://testnet.nearblocks.io/txns/FkcJmC3mHPrsmkQos7XxaDsCeMx9Q6D5CNaeYv3788Se). The receipt deposit was taken from the relayer. The requester's balance did not change. That transaction is not the funding step.

The recorded funding transaction is a transfer signed by the requester:

1. The funding page can create an ed25519 key in the browser. The recorded requester is an implicit account (64 hex characters), which is the account id of that kind of key.
2. On testnet, a relayer account sends NEAR to that new account so it exists. That first transfer is not the job payment.
3. The requester signs a transfer to the contract. The signer is the requester. The NEAR leaves the requester's account.
4. Before that transfer, `post_job` fails and the job count stays 0. After it, the same call opens the job. This wasm records a passing or failing check in a log. A `require!` failure does not, because the binary does not import `panic_utf8`, so the receipt says the call trapped.

## What live X posting needs

The run does not post to X. `pop/x/reply.mjs` will post only when it is called with `dryRun: false` and all of these are set for a dedicated bot account. Do not use `proto_von`. This run does not create the bot.

- `X_API_KEY`: the app's consumer key
- `X_API_SECRET`: the app's consumer secret
- `X_ACCESS_TOKEN`: the bot user's access token
- `X_ACCESS_TOKEN_SECRET`: the bot user's access token secret
- `X_BOT_USERNAME`: the bot's handle, not `proto_von`
- `X_REPLY_TO_TWEET_ID`: the mention the replies answer

The app needs OAuth 1.0a with read and write on the bot user. The call is `POST https://api.x.com/2/tweets`.

## Event feed

`public/x/events.json` is the feed for `pop/board/`. The field list is in `EVENTS.md`.

## Demo

`DEMO.md` is the 60-second script for a recording. It follows the thread replay and the funding page.
