use super::*;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const N: u128 = 1_000_000_000_000_000_000_000_000;
const MAP_SPEC: &str = r#"{"rooms":3,"cols":4,"rows":3}"#;

fn me() -> AccountId { "pop.near".parse().unwrap() }

fn ctx(pred: &AccountId, ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .account_balance(NearToken::from_near(50))
        .block_timestamp(ms * 1_000_000)
        .build());
}

fn signer() -> SigningKey { SigningKey::from_bytes(&[9u8; 32]) }
fn pk_hex(sk: &SigningKey) -> String { hex::encode(sk.verifying_key().to_bytes()) }
fn sig_hex(sk: &SigningKey, msg: &[u8]) -> String { hex::encode(sk.sign(msg).to_bytes()) }

fn setup() -> Contract {
    ctx(&me(), 1);
    Contract::new(accounts(0), U128(2 * N), "outlayer.testnet".parse().unwrap(), "ab".repeat(32), "https://example.com/checker.wasm".into())
}

fn arm(c: &mut Contract) {
    let sk = signer();
    let box_pk = "cd".repeat(32);
    let message = init_message(&box_pk).unwrap();
    let body = serde_json::json!({
        "op": "init",
        "sign_pk": pk_hex(&sk),
        "box_pk": box_pk,
        "sealed": "AAAA",
        "signature": sig_hex(&sk, &message),
    });
    c.inflight = Some(Inflight::Init);
    ctx(&me(), 2);
    c.settle_init(Some(body.to_string().into_bytes()));
    assert!(c.ready, "{}", c.tee_error);
}

fn hire_one(c: &mut Contract, ask: u128) -> (u32, AccountId) {
    ctx(&me(), 10);
    let id = c.post_job("map".into(), "Dock".into(), MAP_SPEC.into(), U128(ask), 30);
    let seller = accounts(1);
    ctx(&seller, 20);
    let b = c.bid(id, U128(ask));
    ctx(&me(), 30);
    c.hire(id, b);
    (id, seller)
}

fn verdict(sk: &SigningKey, job: u32, pass: bool, reason: &str) -> Vec<u8> {
    let delivery = "11".repeat(32);
    let input = "22".repeat(32);
    let message = verdict_message(job, &delivery, &input, pass, reason).unwrap();
    serde_json::json!({
        "op": "check",
        "job": job,
        "pass": pass,
        "reason": reason,
        "delivery": delivery,
        "input": input,
        "sign_pk": pk_hex(sk),
        "signature": sig_hex(sk, &message),
    }).to_string().into_bytes()
}

#[test]
fn pass_pays_and_a_bad_signature_pays_nothing() {
    let mut c = setup();
    arm(&mut c);
    let (id, seller) = hire_one(&mut c, N / 2);
    let sk = signer();
    c.inflight = Some(Inflight::Check { job: id, input_hash: "22".repeat(32) });
    c.jobs.get_mut(id).unwrap().awaiting = true;
    ctx(&me(), 40);
    let pay = c.settle_check(Some(verdict(&sk, id, true, "all 3 rooms reach the entry, exit found")));
    assert!(pay.is_some());
    let r = &c.get_receipts(None, None)[0];
    assert!(r.pass && r.price.0 == N / 2 && r.payout == Payout::Pending && r.seller == seller);
    assert_eq!(c.spent, N / 2);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Done);
    assert!(!r.reason.contains("rooms\":"));

    let (id2, _) = hire_one(&mut c, N / 5);
    c.inflight = Some(Inflight::Check { job: id2, input_hash: "22".repeat(32) });
    let mut bad: serde_json::Value = serde_json::from_slice(&verdict(&sk, id2, true, "forged")).unwrap();
    let mut sig = bad["signature"].as_str().unwrap().to_string();
    sig.replace_range(0..1, if sig.starts_with('a') { "b" } else { "a" });
    bad["signature"] = serde_json::Value::String(sig);
    ctx(&me(), 50);
    assert!(c.settle_check(Some(bad.to_string().into_bytes())).is_none());
    assert_eq!(c.spent, N / 2);
    assert_eq!(c.tee_error, "bad signature");
    assert_eq!(c.get_job(id2).unwrap().state, JobState::Hired);
    assert!(!c.get_job(id2).unwrap().awaiting);
}

#[test]
fn failed_check_reopens_and_pays_nothing() {
    let mut c = setup();
    arm(&mut c);
    let (id, _) = hire_one(&mut c, N / 5);
    c.inflight = Some(Inflight::Check { job: id, input_hash: "22".repeat(32) });
    ctx(&me(), 40);
    assert!(c.settle_check(Some(verdict(&signer(), id, false, "room cut off"))).is_none());
    let r = &c.get_receipts(None, None)[0];
    assert_eq!(r.reason, "room cut off");
    assert_eq!(r.payout, Payout::None);
    assert_eq!(c.spent, 0);
    assert_eq!(c.reserved, N / 5);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Open);
}

#[test]
fn input_hash_mismatch_is_not_a_paid_delivery() {
    let mut c = setup();
    arm(&mut c);
    let (id, _) = hire_one(&mut c, N / 5);
    c.inflight = Some(Inflight::Check { job: id, input_hash: "33".repeat(32) });
    ctx(&me(), 40);
    assert!(c.settle_check(Some(verdict(&signer(), id, true, "ok"))).is_none());
    assert_eq!(c.tee_error, "input hash mismatch");
    assert!(c.get_receipts(None, None).is_empty());
    assert_eq!(c.spent, 0);
}

#[test]
#[should_panic(expected = "over the cap")]
fn cap_holds() {
    let mut c = setup();
    arm(&mut c);
    ctx(&me(), 10);
    c.post_job("map".into(), "a".into(), MAP_SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "b".into(), MAP_SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "c".into(), MAP_SPEC.into(), U128(N), 30);
}

#[test]
fn init_rejects_a_signature_from_another_key() {
    let mut c = setup();
    let sk = signer();
    let other = SigningKey::from_bytes(&[4u8; 32]);
    let box_pk = "cd".repeat(32);
    let message = init_message(&box_pk).unwrap();
    let body = serde_json::json!({
        "op": "init", "sign_pk": pk_hex(&sk), "box_pk": box_pk, "sealed": "AAAA",
        "signature": sig_hex(&other, &message),
    });
    c.inflight = Some(Inflight::Init);
    ctx(&me(), 2);
    c.settle_init(Some(body.to_string().into_bytes()));
    assert!(!c.ready);
    assert_eq!(c.tee_error, "init signature");
}
