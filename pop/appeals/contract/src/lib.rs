//! Testnet appeal escrow for Pay on Proof.
//!
//! A delivery that fails the on-chain check can be appealed by the hired worker.
//! This contract opens a case on a Lock Before You Talk jury, then reads that case
//! back with a cross-contract call. A private callback pays the worker or refunds
//! the buyer only when the jury decided this delivery. The jury names an option.
//! This contract chooses the account. The mainnet Pay on Proof contract is a
//! different program and is not modified here.
use near_sdk::json_types::U128;
use near_sdk::serde::Deserialize;
use near_sdk::serde_json::json;
use near_sdk::store::Vector;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

#[path = "../../../contract/src/checks.rs"]
mod checks;

const MAX_BIDS: usize = 8;
const MAX_DATA: usize = 4096;
const MIN_ASK: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const STORAGE_BUFFER: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
const PHASE_SECS: u64 = 7_200;
const GAS_OPEN: Gas = Gas::from_tgas(50);
const GAS_ON_OPENED: Gas = Gas::from_tgas(30);
const GAS_VIEW: Gas = Gas::from_tgas(50);
const GAS_ON_RULING: Gas = Gas::from_tgas(80);
const GAS_ON_PAID: Gas = Gas::from_tgas(20);

/// The policy string hashed into every case. Jurors commit to this hash.
pub const POLICY: &str = "Pay on Proof appeal v1. Options are worker and buyer. A decided ruling for worker pays the hired price to the worker. A decided ruling for buyer refunds that price to the buyer. Any other outcome holds the funds. The evidence is the failed delivery, the spec, and the check's reason.";

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum BidState { Open, Hired, Passed, Failed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bid {
    pub seller: AccountId,
    pub ask: U128,
    pub state: BidState,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum JobState { Open, Hired, Appealable, Opening, Disputed, Done, Refunded, Cancelled }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Job {
    pub id: u32,
    pub kind: String,
    pub title: String,
    pub spec: String,
    pub budget: U128,
    pub window_ms: u64,
    pub posted_ms: u64,
    pub state: JobState,
    pub bids: Vec<Bid>,
    pub hired: Option<u8>,
    pub price: U128,
    pub due_ms: u64,
    pub appeal_until: u64,
    pub fail_receipt: Option<u32>,
    pub dispute: Option<u32>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Payout { None, Pending, Sent, Refunded, Failed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Receipt {
    pub id: u32,
    pub job: u32,
    pub kind: String,
    pub seller: AccountId,
    pub price: U128,
    pub pass: bool,
    pub reason: String,
    pub data: String,
    pub at_ms: u64,
    pub payout: Payout,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum DisputeStatus { Opening, Ready, Settling, Paid, Refunded, Abandoned }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Dispute {
    pub id: u32,
    pub job: u32,
    pub receipt: u32,
    pub worker: AccountId,
    pub buyer: AccountId,
    pub price: U128,
    pub evidence_hash: String,
    pub case_id: Option<u64>,
    pub status: DisputeStatus,
    pub outcome: Option<String>,
    pub ruling: Option<u32>,
    /// Set while a transfer is in flight. True pays the worker.
    pub pay_worker: Option<bool>,
}

/// Fields read from the jury's `get_case`. Unknown fields are ignored.
#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct JuryCase {
    pub outcome: String,
    pub ruling: Option<u32>,
    pub evidence_hash: String,
    pub policy_hash: String,
    pub options: Vec<String>,
    pub opener: AccountId,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    buyer: AccountId,
    jury: AccountId,
    cap: u128,
    spent: u128,
    refunded: u128,
    reserved: u128,
    jobs: Vector<Job>,
    receipts: Vector<Receipt>,
    disputes: Vector<Dispute>,
}

fn warden_only() { require!(env::predecessor_account_id() == env::current_account_id(), "Warden only"); }

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[(b >> 4) as usize] as char);
        out.push(DIGITS[(b & 15) as usize] as char);
    }
    out
}

fn push_lp(out: &mut Vec<u8>, s: &str) {
    let b = s.as_bytes();
    out.extend_from_slice(&(b.len() as u32).to_le_bytes());
    out.extend_from_slice(b);
}

/// SHA-256 of the failed delivery. The jury case stores this hash, and settle refuses any other case.
pub fn evidence_hash(job_id: u32, receipt_id: u32, kind: &str, worker: &str, buyer: &str, price: u128, spec: &str, reason: &str, data: &str) -> String {
    let mut out = Vec::new();
    out.extend_from_slice(b"pay-on-proof-appeal/v1");
    out.extend_from_slice(&job_id.to_le_bytes());
    out.extend_from_slice(&receipt_id.to_le_bytes());
    push_lp(&mut out, kind);
    push_lp(&mut out, worker);
    push_lp(&mut out, buyer);
    out.extend_from_slice(&price.to_le_bytes());
    push_lp(&mut out, spec);
    push_lp(&mut out, reason);
    push_lp(&mut out, data);
    hex(&env::sha256(&out))
}

pub fn policy_hash() -> String { hex(&env::sha256(POLICY.as_bytes())) }

#[near]
impl Contract {
    #[init]
    pub fn new(buyer: AccountId, cap: U128, jury: AccountId) -> Self {
        warden_only();
        require!(cap.0 > 0, "cap must be above zero");
        require!(buyer != env::current_account_id(), "buyer is not this contract");
        require!(jury != env::current_account_id() && jury != buyer, "jury must be a separate account");
        Self {
            buyer, jury, cap: cap.0, spent: 0, refunded: 0, reserved: 0,
            jobs: Vector::new(b"j"), receipts: Vector::new(b"r"), disputes: Vector::new(b"d"),
        }
    }

    pub fn post_job(&mut self, kind: String, title: String, spec: String, budget: U128, window_mins: u32) -> u32 {
        warden_only();
        require!(checks::KINDS.contains(&kind.as_str()), "unknown kind");
        require!(title.len() <= 80 && spec.len() <= 512, "title or spec too long");
        let parsed: serde_json::Value = serde_json::from_str(&spec).unwrap_or_else(|_| env::panic_str("spec is not JSON"));
        if let Err(e) = checks::valid_spec(&kind, &parsed) { env::panic_str(e); }
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!((5..=1440).contains(&window_mins), "window must be 5 to 1440 minutes");
        require!(self.spent + self.refunded + self.reserved + budget.0 <= self.cap, "over the cap");
        let storage = env::storage_byte_cost().as_yoctonear() * env::storage_usage() as u128;
        require!(env::account_balance().as_yoctonear() >= storage + self.reserved + budget.0 + STORAGE_BUFFER, "balance too low for this budget");
        self.reserved += budget.0;
        let id = self.jobs.len();
        self.jobs.push(Job {
            id, kind, title, spec, budget, window_ms: window_mins as u64 * 60_000, posted_ms: env::block_timestamp_ms(),
            state: JobState::Open, bids: Vec::new(), hired: None, price: U128(0), due_ms: 0, appeal_until: 0,
            fail_receipt: None, dispute: None,
        });
        env::log_str(&format!("post_job {id}"));
        id
    }

    pub fn cancel_job(&mut self, job_id: u32) {
        warden_only();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "only an open job can be cancelled");
        let budget = job.budget.0;
        job.state = JobState::Cancelled;
        self.reserved -= budget;
    }

    pub fn bid(&mut self, job_id: u32, ask: U128) -> u8 {
        let seller = env::predecessor_account_id();
        require!(seller != env::current_account_id(), "the Warden cannot bid");
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        require!(job.bids.len() < MAX_BIDS, "job has all its bids");
        require!(!job.bids.iter().any(|b| b.seller == seller), "one bid per seller");
        require!(ask.0 >= MIN_ASK && ask.0 <= job.budget.0, "ask must be 0.001 NEAR to the budget");
        job.bids.push(Bid { seller, ask, state: BidState::Open });
        (job.bids.len() - 1) as u8
    }

    pub fn hire(&mut self, job_id: u32, bid: u8) {
        warden_only();
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Open, "job not open");
        let b = job.bids.get_mut(bid as usize).unwrap_or_else(|| env::panic_str("no such bid"));
        require!(b.state == BidState::Open, "bid cannot be hired");
        require!(b.ask.0 <= job.budget.0, "price over budget");
        let price = b.ask;
        b.state = BidState::Hired;
        job.hired = Some(bid);
        job.price = price;
        job.due_ms = now + job.window_ms;
        job.state = JobState::Hired;
    }

    /// The hired worker delivers. A pass pays at once. A fail opens an appeal window and pays nothing.
    pub fn deliver(&mut self, job_id: u32, data: String) -> bool {
        let seller = env::predecessor_account_id();
        require!(data.len() <= MAX_DATA, "delivery over 4 KB");
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired, "nobody is hired");
        let bi = job.hired.unwrap() as usize;
        require!(job.bids[bi].seller == seller, "only the hired worker delivers");
        require!(now <= job.due_ms, "window closed");
        let spec: serde_json::Value = serde_json::from_str(&job.spec).unwrap();
        let verdict = match serde_json::from_str::<serde_json::Value>(&data) {
            Ok(v) => checks::check(&job.kind, &spec, &v),
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        };
        let price = job.price;
        let rid = self.receipts.len();
        self.receipts.push(Receipt {
            id: rid, job: job_id, kind: job.kind.clone(), seller: seller.clone(), price,
            pass: verdict.pass, reason: verdict.reason.clone(), data: data.clone(), at_ms: now,
            payout: if verdict.pass { Payout::Pending } else { Payout::None },
        });
        let j = self.jobs.get_mut(job_id).unwrap();
        if verdict.pass {
            j.bids[bi].state = BidState::Passed;
            j.state = JobState::Done;
            j.hired = None;
            self.reserved -= j.budget.0;
            self.spent += price.0;
            env::log_str(&format!("pass job {job_id} receipt {rid}: {}", verdict.reason));
            Promise::new(seller)
                .transfer(NearToken::from_yoctonear(price.0))
                .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_PAID).on_pass_paid(rid))
                .detach();
        } else {
            j.bids[bi].state = BidState::Failed;
            j.state = JobState::Appealable;
            j.appeal_until = now + j.window_ms;
            j.fail_receipt = Some(rid);
            env::log_str(&format!("fail job {job_id} receipt {rid}: {}", verdict.reason));
        }
        verdict.pass
    }

    /// Anyone may reopen a failed job after the appeal window if the worker did not dispute.
    pub fn release_fail(&mut self, job_id: u32) {
        let now = env::block_timestamp_ms();
        let job = self.job_mut(job_id);
        require!(job.state == JobState::Appealable && now > job.appeal_until, "appeal window is still open");
        let bi = job.hired.unwrap() as usize;
        job.bids[bi].state = BidState::Failed;
        job.hired = None;
        job.fail_receipt = None;
        job.state = JobState::Open;
        env::log_str(&format!("release job {job_id}"));
    }

    /// The hired worker asks the jury to rule on the failed delivery.
    /// This contract, not the worker, is the case opener, and it sets the evidence hash.
    pub fn dispute(&mut self, job_id: u32) -> Promise {
        let seller = env::predecessor_account_id();
        let now = env::block_timestamp_ms();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Appealable, "no appeal is open");
        require!(now <= job.appeal_until, "appeal window closed");
        let bi = job.hired.unwrap() as usize;
        require!(job.bids[bi].seller == seller, "only the hired worker can appeal");
        let rid = job.fail_receipt.unwrap_or_else(|| env::panic_str("no failed receipt"));
        let receipt = self.receipts.get(rid).cloned().unwrap();
        require!(!receipt.pass, "the delivery passed");
        let hash = evidence_hash(job_id, rid, &receipt.kind, receipt.seller.as_str(), self.buyer.as_str(), receipt.price.0, &job.spec, &receipt.reason, &receipt.data);
        let id = self.disputes.len();
        self.disputes.push(Dispute {
            id, job: job_id, receipt: rid, worker: seller, buyer: self.buyer.clone(), price: receipt.price,
            evidence_hash: hash.clone(), case_id: None, status: DisputeStatus::Opening,
            outcome: None, ruling: None, pay_worker: None,
        });
        let j = self.jobs.get_mut(job_id).unwrap();
        j.state = JobState::Opening;
        j.dispute = Some(id);
        env::log_str(&format!("dispute job {job_id} receipt {rid}"));
        let args = json!({
            "case_key": format!("pop-appeal-{job_id}-{rid}"),
            "evidence_hash": hash,
            "policy_hash": policy_hash(),
            "options": ["worker", "buyer"],
            "commit_secs": PHASE_SECS,
            "audit_secs": PHASE_SECS,
            "reveal_secs": PHASE_SECS,
        });
        Promise::new(self.jury.clone())
            .function_call("open_case", args.to_string().into_bytes(), NearToken::from_yoctonear(0), GAS_OPEN)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_OPENED).on_opened(job_id))
    }

    #[private]
    pub fn on_opened(&mut self, job_id: u32, #[callback_result] opened: Result<u64, PromiseError>) {
        let Some(job) = self.jobs.get(job_id).cloned() else { return };
        let Some(did) = job.dispute else { return };
        if job.state != JobState::Opening { return; }
        match opened {
            Ok(case_id) => {
                let hash = self.disputes.get(did).unwrap().evidence_hash.clone();
                let d = self.disputes.get_mut(did).unwrap();
                d.case_id = Some(case_id);
                d.status = DisputeStatus::Ready;
                self.jobs.get_mut(job_id).unwrap().state = JobState::Disputed;
                env::log_str(&format!("dispute job {job_id} case {case_id} evidence {hash}"));
            }
            Err(_) => {
                self.disputes.get_mut(did).unwrap().status = DisputeStatus::Abandoned;
                let j = self.jobs.get_mut(job_id).unwrap();
                j.state = JobState::Appealable;
                j.dispute = None;
                env::log_str(&format!("dispute job {job_id} jury did not open"));
            }
        }
    }

    /// Anyone may ask the contract to read the jury and pay or refund.
    pub fn settle(&mut self, job_id: u32) -> Promise {
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Disputed, "job is not in dispute");
        let did = job.dispute.unwrap_or_else(|| env::panic_str("no dispute"));
        let d = self.disputes.get_mut(did).unwrap();
        require!(d.status == DisputeStatus::Ready, "settle in progress or already finished");
        let case_id = d.case_id.unwrap_or_else(|| env::panic_str("jury case is not open"));
        d.status = DisputeStatus::Settling;
        Promise::new(self.jury.clone())
            .function_call("get_case", json!({ "case_id": case_id }).to_string().into_bytes(), NearToken::from_yoctonear(0), GAS_VIEW)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_ON_RULING).on_ruling(job_id))
    }

    #[private]
    pub fn on_ruling(&mut self, job_id: u32, #[callback_result] case: Result<JuryCase, PromiseError>) -> Option<Promise> {
        let decision = self.decide(job_id, case);
        let Some((pay_worker, amount, to)) = decision else { return None };
        Some(Promise::new(to).transfer(NearToken::from_yoctonear(amount)).then(
            Self::ext(env::current_account_id()).with_static_gas(GAS_ON_PAID).on_appeal_paid(job_id, pay_worker),
        ))
    }

    #[private]
    pub fn on_appeal_paid(&mut self, job_id: u32, pay_worker: bool, #[callback_result] transfer: Result<(), PromiseError>) {
        let Some(job) = self.jobs.get(job_id).cloned() else { return };
        let Some(did) = job.dispute else { return };
        if transfer.is_err() {
            self.disputes.get_mut(did).unwrap().status = DisputeStatus::Ready;
            self.disputes.get_mut(did).unwrap().pay_worker = None;
            env::log_str(&format!("appeal transfer failed job {job_id}"));
            return;
        }
        let price = self.disputes.get(did).unwrap().price.0;
        let receipt_id = self.disputes.get(did).unwrap().receipt;
        let budget = job.budget.0;
        {
            let d = self.disputes.get_mut(did).unwrap();
            d.pay_worker = None;
            d.status = if pay_worker { DisputeStatus::Paid } else { DisputeStatus::Refunded };
        }
        self.reserved -= budget;
        if pay_worker { self.spent += price; } else { self.refunded += price; }
        self.jobs.get_mut(job_id).unwrap().state = if pay_worker { JobState::Done } else { JobState::Refunded };
        self.receipts.get_mut(receipt_id).unwrap().payout = if pay_worker { Payout::Sent } else { Payout::Refunded };
        let who = if pay_worker { "worker" } else { "buyer" };
        env::log_str(&format!("appeal {who} job {job_id} amount {price}"));
    }

    #[private]
    pub fn on_pass_paid(&mut self, receipt_id: u32, #[callback_result] transfer: Result<(), PromiseError>) {
        let Some(r) = self.receipts.get_mut(receipt_id) else { return };
        r.payout = if transfer.is_ok() { Payout::Sent } else { Payout::Failed };
        env::log_str(&format!("payout receipt {receipt_id}: {:?}", r.payout));
    }

    pub fn get_config(&self) -> serde_json::Value {
        json!({
            "contract": env::current_account_id(), "buyer": self.buyer, "jury": self.jury,
            "cap": U128(self.cap), "spent": U128(self.spent), "refunded": U128(self.refunded),
            "reserved": U128(self.reserved), "jobs": self.jobs.len(), "receipts": self.receipts.len(),
            "disputes": self.disputes.len(), "policy": POLICY, "policy_hash": policy_hash(),
            "balance": U128(env::account_balance().as_yoctonear()),
        })
    }

    pub fn preview_check(&self, job_id: u32, data: String) -> serde_json::Value {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let spec: serde_json::Value = serde_json::from_str(&job.spec).unwrap();
        let v = match serde_json::from_str::<serde_json::Value>(&data) {
            Ok(d) if data.len() <= MAX_DATA => checks::check(&job.kind, &spec, &d),
            Ok(_) => checks::Verdict { pass: false, reason: "delivery over 4 KB".into() },
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        };
        json!({ "pass": v.pass, "reason": v.reason })
    }

    /// Recomputes the evidence hash from the stored delivery. A reader can check it against the jury case.
    pub fn evidence_of(&self, job_id: u32) -> String {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let rid = job.fail_receipt.unwrap_or_else(|| env::panic_str("no failed receipt"));
        let r = self.receipts.get(rid).unwrap();
        evidence_hash(job_id, rid, &r.kind, r.seller.as_str(), self.buyer.as_str(), r.price.0, &job.spec, &r.reason, &r.data)
    }

    pub fn get_job(&self, job_id: u32) -> Option<Job> { self.jobs.get(job_id).cloned() }
    pub fn get_receipt(&self, receipt_id: u32) -> Option<Receipt> { self.receipts.get(receipt_id).cloned() }
    pub fn get_dispute(&self, dispute_id: u32) -> Option<Dispute> { self.disputes.get(dispute_id).cloned() }
    pub fn get_receipts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Receipt> {
        let from = from.unwrap_or(0);
        (from..self.receipts.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.receipts[i].clone()).collect()
    }

    fn job_mut(&mut self, id: u32) -> &mut Job { self.jobs.get_mut(id).unwrap_or_else(|| env::panic_str("no such job")) }

    /// Maps a jury result to a payment. None means the funds stay reserved.
    fn decide(&mut self, job_id: u32, case: Result<JuryCase, PromiseError>) -> Option<(bool, u128, AccountId)> {
        let Some(job) = self.jobs.get(job_id).cloned() else {
            env::log_str("appeal hold: no job");
            return None;
        };
        let Some(did) = job.dispute else {
            env::log_str("appeal hold: no dispute");
            return None;
        };
        let hold = |this: &mut Self, reason: &str| {
            this.disputes.get_mut(did).unwrap().status = DisputeStatus::Ready;
            env::log_str(&format!("appeal hold job {job_id}: {reason}"));
        };
        let Ok(case) = case else { hold(self, "jury did not answer"); return None; };
        {
            let d = self.disputes.get_mut(did).unwrap();
            d.outcome = Some(case.outcome.clone());
            d.ruling = case.ruling;
        }
        let d = self.disputes.get(did).unwrap().clone();
        if d.status != DisputeStatus::Settling { hold(self, "not settling"); return None; }
        if case.opener != env::current_account_id() { hold(self, "opener is not this contract"); return None; }
        if case.evidence_hash != d.evidence_hash { hold(self, "evidence hash mismatch"); return None; }
        if case.policy_hash != policy_hash() { hold(self, "policy hash mismatch"); return None; }
        if case.options != ["worker".to_string(), "buyer".to_string()] { hold(self, "options are not worker and buyer"); return None; }
        let pay_worker = match (case.outcome.as_str(), case.ruling) {
            ("Decided", Some(0)) => Some(true),
            ("Decided", Some(1)) => Some(false),
            _ => None,
        };
        let Some(pay_worker) = pay_worker else { hold(self, &format!("outcome {}", case.outcome)); return None; };
        self.disputes.get_mut(did).unwrap().pay_worker = Some(pay_worker);
        let to = if pay_worker { d.worker.clone() } else { d.buyer.clone() };
        let word = if pay_worker { "pay" } else { "refund" };
        env::log_str(&format!("appeal {word} job {job_id} {to} {}", d.price.0));
        Some((pay_worker, d.price.0, to))
    }
}

#[cfg(test)]
mod tests;
