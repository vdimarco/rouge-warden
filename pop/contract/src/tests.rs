use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;

const N: u128 = 1_000_000_000_000_000_000_000_000;

fn me() -> AccountId { "pop.near".parse().unwrap() }
fn ctx(pred: &AccountId, ms: u64) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .account_balance(NearToken::from_near(50))
        .block_timestamp(ms * 1_000_000)
        .build());
}
fn setup() -> Contract {
    ctx(&me(), 1);
    Contract::new(accounts(0), U128(2 * N), "wrap.near".parse().unwrap(), "intents.near".parse().unwrap())
}
const MAP_SPEC: &str = r#"{"rooms":3,"cols":4,"rows":3}"#;
const GOOD_MAP: &str = r#"{"rooms":[[0,0],[1,0],[1,1]],"links":[[[0,0],[1,0]],[[1,0],[1,1]]],"entry":[0,0],"exit":[1,1]}"#;
const CUT_MAP: &str = r#"{"rooms":[[0,0],[1,0],[3,2]],"links":[[[0,0],[1,0]]],"entry":[0,0],"exit":[1,0]}"#;

fn post(c: &mut Contract, budget: u128) -> u32 { ctx(&me(), 10); c.post_job("map".into(), "Dock".into(), MAP_SPEC.into(), U128(budget), 30) }

#[test]
fn full_job_pass_pays_and_counts() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    let seller = accounts(1);
    ctx(&seller, 20);
    let b = c.bid(id, U128(N / 2), Rail::Intents, Some("hi".into()));
    ctx(&me(), 30);
    c.counter(id, b, U128(N / 4));
    ctx(&seller, 40);
    c.respond(id, b, "final".into(), Some(U128(N / 3)));
    ctx(&me(), 50);
    c.hire(id, b);
    ctx(&seller, 60);
    assert!(c.deliver(id, GOOD_MAP.into()));
    let r = &c.get_receipts(None, None)[0];
    assert!(r.pass && r.price.0 == N / 3 && r.payout == Payout::Pending);
    assert_eq!(c.spent, N / 3);
    assert_eq!(c.reserved, 0);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Done);
}

#[test]
fn preview_check_matches_deliver() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    assert_eq!(c.preview_check(id, CUT_MAP.into())["reason"], "room cut off");
    assert_eq!(c.preview_check(id, GOOD_MAP.into())["pass"], true);
    assert_eq!(c.preview_check(id, "nope".into())["reason"], "delivery is not JSON");
}

#[test]
fn cut_map_fails_reopens_and_pays_nothing() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    ctx(&accounts(1), 20);
    let b = c.bid(id, U128(N / 5), Rail::Near, None);
    ctx(&me(), 30);
    c.hire(id, b);
    ctx(&accounts(1), 40);
    assert!(!c.deliver(id, CUT_MAP.into()));
    let r = &c.get_receipts(None, None)[0];
    assert_eq!(r.reason, "room cut off");
    assert_eq!(r.payout, Payout::None);
    assert_eq!(c.spent, 0);
    assert_eq!(c.reserved, N / 2);
    assert_eq!(c.get_job(id).unwrap().state, JobState::Open);
}

#[test]
#[should_panic(expected = "over the cap")]
fn cap_holds() {
    let mut c = setup();
    post(&mut c, N);
    post(&mut c, N);
    post(&mut c, 1_000_000_000_000_000_000_000);
}

#[test]
#[should_panic(expected = "one counter per bid")]
fn one_counter() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    ctx(&accounts(1), 20);
    let b = c.bid(id, U128(N / 2), Rail::Near, None);
    ctx(&me(), 30);
    c.counter(id, b, U128(N / 4));
    c.counter(id, b, U128(N / 5));
}

#[test]
#[should_panic(expected = "Warden only")]
fn sellers_cannot_post() {
    let mut c = setup();
    ctx(&accounts(1), 10);
    c.post_job("map".into(), "x".into(), MAP_SPEC.into(), U128(N / 2), 30);
}

#[test]
#[should_panic(expected = "only the hired seller delivers")]
fn only_hired_seller_delivers() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    ctx(&accounts(1), 20);
    let b = c.bid(id, U128(N / 5), Rail::Near, None);
    ctx(&me(), 30);
    c.hire(id, b);
    ctx(&accounts(2), 40);
    c.deliver(id, GOOD_MAP.into());
}

#[test]
fn expire_reopens_and_three_fails_close() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    for (i, who) in [1usize, 2, 3].iter().enumerate() {
        ctx(&accounts(*who), 100 + i as u64 * 10);
        let b = c.bid(id, U128(N / 5), Rail::Near, None);
        ctx(&me(), 101 + i as u64 * 10);
        c.hire(id, b);
        ctx(&accounts(*who), 102 + i as u64 * 10);
        c.deliver(id, CUT_MAP.into());
    }
    assert_eq!(c.get_job(id).unwrap().state, JobState::Closed);
    assert_eq!(c.reserved, 0);
    // a hire that runs past its window can be expired by anyone
    let id2 = post(&mut c, N / 2);
    ctx(&accounts(4), 200);
    let b = c.bid(id2, U128(N / 5), Rail::Near, None);
    ctx(&me(), 201);
    c.hire(id2, b);
    ctx(&accounts(5), 201 + 31 * 60_000);
    c.expire(id2);
    assert_eq!(c.get_job(id2).unwrap().state, JobState::Open);
}

#[test]
#[should_panic(expected = "a seller is hired")]
fn close_waits_for_hired_seller() {
    let mut c = setup();
    let id = post(&mut c, N / 2);
    ctx(&accounts(1), 20);
    let b = c.bid(id, U128(N / 5), Rail::Near, None);
    ctx(&me(), 30);
    c.hire(id, b);
    ctx(&accounts(0), 40);
    let _ = c.close();
}

#[test]
fn checks_match_the_game() {
    use serde_json::json;
    let spec = json!({"lo": 8, "hi": 12, "size": 3});
    assert!(checks::check("roster", &spec, &json!({"critters": [{"name":"Goose","threat":3},{"name":"Bear","threat":5},{"name":"Raccoon","threat":2}]})).pass);
    assert_eq!(checks::check("roster", &spec, &json!({"critters": [{"name":"a","threat":1},{"name":"b","threat":1},{"name":"c","threat":1}]})).reason, "threat 3, too tame (8 to 12)");
    let paint = json!({"contrast_x100": 300});
    assert!(checks::check("paint", &paint, &json!({"floor":"#1a2b3c","wall":"#e0d0b0","accent":"#ff8800"})).pass);
    assert!(!checks::check("paint", &paint, &json!({"floor":"#777777","wall":"#888888","accent":"#ff8800"})).pass);
    assert_eq!(checks::contrast_x100([0, 0, 0], [255, 255, 255]), 2100);
    let tune = json!({"bars": 2, "key": "C major"});
    assert!(checks::check("tune", &tune, &json!({"bars": 2, "notes": [60,62,64,65,67,69,71,72]})).pass);
    assert_eq!(checks::check("tune", &tune, &json!({"bars": 2, "notes": [60,61,64,65,67,69,71,72]})).reason, "1 notes out of C major");
    assert!(checks::valid_spec("map", &json!({"rooms": 30, "cols": 4, "rows": 3})).is_err());
}
