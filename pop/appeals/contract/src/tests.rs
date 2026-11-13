use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use near_sdk::Gas;

const N: u128 = 1_000_000_000_000_000_000_000_000;
const PRICE: u128 = 150_000_000_000_000_000_000_000;

fn me() -> AccountId { "appeal.near".parse().unwrap() }
fn buyer() -> AccountId { "buyer.near".parse().unwrap() }
fn worker() -> AccountId { "worker.near".parse().unwrap() }
fn jury() -> AccountId { "jury.near".parse().unwrap() }

fn ctx(pred: &AccountId, ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .account_balance(NearToken::from_near(50))
        .block_timestamp(ms * 1_000_000)
        .prepaid_gas(Gas::from_tgas(300))
        .build());
}

fn setup() -> Contract {
    ctx(&me(), 1);
    Contract::new(buyer(), U128(2 * N), jury())
}

const SPEC: &str = r#"{"rooms":3,"cols":4,"rows":3}"#;
const GOOD: &str = r#"{"rooms":[[0,0],[1,0],[1,1]],"links":[[[0,0],[1,0]],[[1,0],[1,1]]],"entry":[0,0],"exit":[1,1]}"#;
const CUT: &str = r#"{"rooms":[[0,0],[1,0],[3,2]],"links":[[[0,0],[1,0]]],"entry":[0,0],"exit":[1,0]}"#;

fn hire_worker(c: &mut Contract) -> u32 {
    ctx(&me(), 10);
    let id = c.post_job("map".into(), "Dock".into(), SPEC.into(), U128(N / 2), 30);
    ctx(&worker(), 20);
    let b = c.bid(id, U128(PRICE));
    ctx(&me(), 30);
    c.hire(id, b);
    id
}

fn fail_delivery(c: &mut Contract) -> u32 {
    let id = hire_worker(c);
    ctx(&worker(), 40);
    assert!(!c.deliver(id, CUT.into()));
    id
}

fn jury_case(outcome: &str, ruling: Option<u32>, evidence: &str) -> JuryCase {
    JuryCase {
        outcome: outcome.into(),
        ruling,
        evidence_hash: evidence.into(),
        policy_hash: policy_hash(),
        options: vec!["worker".into(), "buyer".into()],
        opener: me(),
    }
}

fn open_dispute(c: &mut Contract, job: u32) -> (u32, String) {
    ctx(&worker(), 50);
    let _ = c.dispute(job);
    let hash = c.evidence_of(job);
    ctx(&me(), 51);
    c.on_opened(job, Ok(7));
    (job, hash)
}

#[test]
fn evidence_hash_matches_the_js_vector() {
    ctx(&me(), 1);
    let h = evidence_hash(1, 2, "map", "worker.near", "buyer.near", PRICE, SPEC, "room cut off", r#"{"rooms":[[0,0]]}"#);
    assert_eq!(h, "4c0c2a031f631c5af4e7e110a777dc2da42bc2dabf4ae8723f5b8bc852940f15");
    assert_eq!(policy_hash(), "23ed5e255785f07b0741cd473f2f40ffbcc0624c88bcd29209db0078d2d86b91");
}

#[test]
fn pass_pays_and_cannot_be_appealed() {
    let mut c = setup();
    let id = hire_worker(&mut c);
    ctx(&worker(), 40);
    assert!(c.deliver(id, GOOD.into()));
    let r = c.get_receipt(0).unwrap();
    assert!(r.pass && r.payout == Payout::Pending && r.price.0 == PRICE);
    assert_eq!(c.spent, PRICE);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Done);
    ctx(&worker(), 50);
    let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.dispute(id)));
    assert!(err.is_err());
}

#[test]
fn failed_map_pays_nothing_and_stays_appealable() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    let r = c.get_receipt(0).unwrap();
    assert_eq!(r.reason, "room cut off");
    assert_eq!(r.payout, Payout::None);
    assert_eq!(r.data, CUT);
    assert_eq!(c.spent, 0);
    assert_eq!(c.reserved, N / 2);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Appealable);
    assert_eq!(c.preview_check(id, CUT.into())["reason"], "room cut off");
}

#[test]
fn only_the_hired_worker_can_dispute() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    ctx(&buyer(), 50);
    let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = c.dispute(id); }));
    assert!(err.is_err());
    assert_eq!(c.get_job(id).unwrap().state, JobState::Appealable);
}

#[test]
fn worker_ruling_pays_the_worker_and_keeps_the_books() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    let (_, hash) = open_dispute(&mut c, id);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Disputed);
    assert_eq!(c.get_dispute(0).unwrap().case_id, Some(7));
    assert_eq!(c.get_dispute(0).unwrap().status, DisputeStatus::Ready);
    ctx(&buyer(), 60);
    let _ = c.settle(id);
    assert_eq!(c.get_dispute(0).unwrap().status, DisputeStatus::Settling);
    ctx(&me(), 61);
    let pay = c.on_ruling(id, Ok(jury_case("Decided", Some(0), &hash)));
    assert!(pay.is_some());
    c.on_appeal_paid(id, true, Ok(()));
    assert_eq!(c.spent, PRICE);
    assert_eq!(c.refunded, 0);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Done);
    assert_eq!(c.get_receipt(0).unwrap().payout, Payout::Sent);
    assert_eq!(c.get_dispute(0).unwrap().status, DisputeStatus::Paid);
}

#[test]
fn buyer_ruling_refunds_the_buyer() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    let (_, hash) = open_dispute(&mut c, id);
    ctx(&buyer(), 60);
    let _ = c.settle(id);
    ctx(&me(), 61);
    assert!(c.on_ruling(id, Ok(jury_case("Decided", Some(1), &hash))).is_some());
    c.on_appeal_paid(id, false, Ok(()));
    assert_eq!(c.spent, 0);
    assert_eq!(c.refunded, PRICE);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Refunded);
    assert_eq!(c.get_receipt(0).unwrap().payout, Payout::Refunded);
}

#[test]
fn inconclusive_and_a_mismatched_case_hold_the_funds() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    let (_, hash) = open_dispute(&mut c, id);
    ctx(&buyer(), 60);
    let _ = c.settle(id);
    ctx(&me(), 61);
    assert!(c.on_ruling(id, Ok(jury_case("Inconclusive", None, &hash))).is_none());
    assert_eq!(c.reserved, N / 2);
    assert_eq!(c.spent, 0);
    assert_eq!(c.get_dispute(0).unwrap().status, DisputeStatus::Ready);

    ctx(&buyer(), 70);
    let _ = c.settle(id);
    ctx(&me(), 71);
    let mut wrong = jury_case("Decided", Some(0), &hash);
    wrong.evidence_hash = "ab".repeat(32);
    assert!(c.on_ruling(id, Ok(wrong)).is_none());
    assert_eq!(c.spent, 0);
    assert_eq!(c.get_dispute(0).unwrap().status, DisputeStatus::Ready);

    ctx(&buyer(), 80);
    let _ = c.settle(id);
    ctx(&me(), 81);
    let mut other = jury_case("Decided", Some(0), &hash);
    other.opener = buyer();
    assert!(c.on_ruling(id, Ok(other)).is_none());
    assert_eq!(c.reserved, N / 2);
}

#[test]
fn release_after_the_window_reopens_the_job() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    ctx(&buyer(), 40 + 30 * 60_000 + 1);
    c.release_fail(id);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Open);
    assert_eq!(c.reserved, N / 2);
    ctx(&worker(), 40 + 30 * 60_000 + 2);
    let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let _ = c.dispute(id); }));
    assert!(err.is_err());
}

#[test]
#[should_panic(expected = "over the cap")]
fn cap_holds() {
    let mut c = setup();
    ctx(&me(), 10);
    c.post_job("map".into(), "A".into(), SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "B".into(), SPEC.into(), U128(N), 30);
    c.post_job("map".into(), "C".into(), SPEC.into(), U128(N), 30);
}

#[test]
#[should_panic(expected = "settle in progress")]
fn second_settle_while_the_first_is_in_flight_fails() {
    let mut c = setup();
    let id = fail_delivery(&mut c);
    open_dispute(&mut c, id);
    ctx(&buyer(), 60);
    let _ = c.settle(id);
    let _ = c.settle(id);
}
