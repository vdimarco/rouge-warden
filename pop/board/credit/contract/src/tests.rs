use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use serde_json::Value;

fn me() -> AccountId { "credit.testnet".parse().unwrap() }

fn ctx(pred: &AccountId, deposit: u128) {
    testing_env!(VMContextBuilder::new()
        .current_account_id(me())
        .predecessor_account_id(pred.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(20))
        .prepaid_gas(near_sdk::Gas::from_tgas(200))
        .build());
}

fn setup() -> Contract {
    ctx(&me(), 0);
    Contract::new()
}

fn receipt(seller: &str, pass: bool, payout: &str, price: u128) -> InReceipt {
    InReceipt { seller: seller.parse().unwrap(), price: U128(price), pass, payout: payout.into() }
}

fn limits_json() -> Value {
    serde_json::from_str(include_str!("../../../test/vectors.json")).unwrap()
}

#[test]
fn vectors_match_the_formula() {
    let v = limits_json();
    assert_eq!(v["weights"]["pass"], PASS_W);
    assert_eq!(v["weights"]["fail"], FAIL_W);
    assert_eq!(v["weights"]["juryWin"], WIN_W);
    assert_eq!(v["weights"]["juryLoss"], LOSS_W);
    assert_eq!(v["baseBudget"], BASE_BUDGET.to_string());
    assert_eq!(v["stepBudget"], STEP_BUDGET.to_string());
    assert_eq!(v["negBudget"], NEG_BUDGET.to_string());
    assert_eq!(v["depositAtZero"], DEPOSIT_ZERO.to_string());
    assert_eq!(v["depositStep"], DEPOSIT_STEP.to_string());
    assert_eq!(v["depositFloor"], DEPOSIT_FLOOR.to_string());
    for case in v["cases"].as_array().unwrap() {
        let (max_b, min_d) = if let Some(score) = case.get("scoreOnly").and_then(|s| s.as_i64()) {
            limits_from_score(score)
        } else {
            let t = Totals {
                passes: case["passes"].as_u64().unwrap() as u32,
                fails: case["fails"].as_u64().unwrap() as u32,
                jury_wins: case["juryWins"].as_u64().unwrap() as u32,
                jury_losses: case["juryLosses"].as_u64().unwrap() as u32,
                earned: 0,
            };
            assert_eq!(score_of(&t), case["score"].as_i64().unwrap());
            limits_from_score(score_of(&t))
        };
        assert_eq!(max_b.to_string(), case["max"].as_str().unwrap(), "{case}");
        assert_eq!(min_d.to_string(), case["min"].as_str().unwrap(), "{case}");
    }
}

#[test]
fn a_second_pull_does_not_double() {
    let mut c = setup();
    let row = receipt("crew.testnet", true, "sent", BASE_BUDGET);
    c.apply_hire(0, vec![row]);
    c.apply_hire(0, vec![receipt("crew.testnet", true, "sent", BASE_BUDGET)]);
    let view = c.get_limits("crew.testnet".parse().unwrap());
    assert_eq!(view["passes"], 1);
    assert_eq!(view["score"], 10);
    assert_eq!(view["earned"].as_str().unwrap(), BASE_BUDGET.to_string());
    assert_eq!(view["max_budget"].as_str().unwrap(), (BASE_BUDGET + 10 * STEP_BUDGET).to_string());
}

#[test]
fn jury_win_and_loss_share_one_worker() {
    let mut c = setup();
    c.apply_appeals(0, vec![
        receipt("worker.testnet", false, "sent", DEPOSIT_ZERO),
        receipt("worker.testnet", false, "refunded", DEPOSIT_ZERO),
    ]);
    c.disputes.push(StoredDispute { id: 0, worker: "worker.testnet".parse().unwrap(), price: DEPOSIT_ZERO, status: "paid".into() });
    c.disputes.push(StoredDispute { id: 1, worker: "worker.testnet".parse().unwrap(), price: DEPOSIT_ZERO, status: "refunded".into() });
    c.recompute_jury();
    let view = c.get_limits("worker.testnet".parse().unwrap());
    assert_eq!(view["passes"], 0);
    assert_eq!(view["fails"], 2);
    assert_eq!(view["jury_wins"], 1);
    assert_eq!(view["jury_losses"], 1);
    assert_eq!(view["score"], -13);
    assert_eq!(view["earned"].as_str().unwrap(), DEPOSIT_ZERO.to_string());
}

#[test]
fn stake_at_the_cap_and_refund_marks_the_row() {
    let mut c = setup();
    let novice: AccountId = "novice.testnet".parse().unwrap();
    ctx(&novice, DEPOSIT_ZERO);
    c.stake(U128(BASE_BUDGET));
    assert_eq!(c.stakes.len(), 1);
    assert!(!c.stakes.get(0).unwrap().refunded);
    let _ = c.refund();
    assert!(c.stakes.get(0).unwrap().refunded);
}

#[test]
#[should_panic(expected = "score too low for this budget")]
fn a_new_account_cannot_take_a_large_job() {
    let mut c = setup();
    let novice: AccountId = "novice.testnet".parse().unwrap();
    ctx(&novice, DEPOSIT_ZERO);
    c.stake(U128(BASE_BUDGET + 1));
}

#[test]
#[should_panic(expected = "deposit too small for this score")]
fn a_short_deposit_is_refused() {
    let mut c = setup();
    let novice: AccountId = "novice.testnet".parse().unwrap();
    ctx(&novice, DEPOSIT_ZERO - 1);
    c.stake(U128(BASE_BUDGET));
}

#[test]
fn a_pass_can_probe_a_larger_budget() {
    let mut c = setup();
    c.apply_hire(0, vec![receipt("crew.testnet", true, "sent", 1)]);
    c.probe("crew.testnet".parse().unwrap(), U128(BASE_BUDGET + 10 * STEP_BUDGET), U128(DEPOSIT_ZERO - 10 * DEPOSIT_STEP));
    assert_eq!(c.probes, 1);
}

#[test]
#[should_panic(expected = "pull hire pages in order")]
fn a_skipped_page_is_refused() {
    let mut c = setup();
    c.apply_hire(50, vec![receipt("crew.testnet", true, "sent", 1)]);
}
