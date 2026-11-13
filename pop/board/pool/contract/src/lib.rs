//! A testnet pool. Several accounts fund it. It pays an agent only when the delivery passes
//! the same check the escrow runs. Testnet only. The mainnet contract is not touched.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, Value};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

#[path = "../../../../contract/src/checks.rs"]
mod checks;

const MIN_FUND: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
const MIN_ASK: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
const BUFFER: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
const MAX_FAILS: u8 = 3;
const MAX_DATA: usize = 4096;
const GAS_CB: Gas = Gas::from_tgas(10);

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum JobState { Open, Hired, Done, Closed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "snake_case")]
pub enum Payout { None, Pending, Sent, Failed }

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Job {
    pub id: u32,
    pub kind: String,
    pub title: String,
    pub spec: String,
    pub budget: U128,
    pub posted_ms: u64,
    pub state: JobState,
    pub poster: AccountId,
    pub worker: Option<AccountId>,
    pub fails: u8,
    pub deliverable: Option<String>,
}

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
    pub at_ms: u64,
    pub payout: Payout,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
struct Funder {
    account: AccountId,
    amount: u128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    beneficiary: AccountId,
    pool: u128,
    reserved: u128,
    spent: u128,
    funders: Vector<Funder>,
    funder_index: LookupMap<AccountId, u32>,
    jobs: Vector<Job>,
    receipts: Vector<Receipt>,
}

fn parse_spec(kind: &str, spec: &str) -> Value {
    require!(checks::KINDS.contains(&kind), "unknown kind");
    require!(spec.len() <= 512, "spec too long");
    let parsed: Value = serde_json::from_str(spec).unwrap_or_else(|_| env::panic_str("spec is not JSON"));
    if let Err(e) = checks::valid_spec(kind, &parsed) { env::panic_str(e); }
    parsed
}

#[near]
impl Contract {
    #[init]
    pub fn new(beneficiary: AccountId) -> Self {
        require!(env::predecessor_account_id() == env::current_account_id(), "contract only");
        Self {
            beneficiary,
            pool: 0,
            reserved: 0,
            spent: 0,
            funders: Vector::new(b"f"),
            funder_index: LookupMap::new(b"i"),
            jobs: Vector::new(b"j"),
            receipts: Vector::new(b"r"),
        }
    }

    #[payable]
    pub fn fund(&mut self) {
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount >= MIN_FUND, "fund at least 0.05 NEAR");
        let who = env::predecessor_account_id();
        require!(who != env::current_account_id(), "not the contract");
        self.pool += amount;
        if let Some(i) = self.funder_index.get(&who).copied() {
            self.funders.get_mut(i).unwrap().amount += amount;
        } else {
            let i = self.funders.len();
            self.funders.push(Funder { account: who.clone(), amount });
            self.funder_index.insert(who.clone(), i);
        }
        env::log_str(&format!("fund {who} {amount}"));
    }

    pub fn open_job(&mut self, kind: String, title: String, spec: String, budget: U128) -> u32 {
        let poster = env::predecessor_account_id();
        require!(self.funder_index.contains_key(&poster), "only a funder opens a job");
        require!(title.len() <= 80, "title too long");
        parse_spec(&kind, &spec);
        require!(budget.0 >= MIN_ASK, "budget too small");
        require!(budget.0 <= self.pool, "pool cannot cover this budget");
        let storage = env::storage_byte_cost().as_yoctonear() * env::storage_usage() as u128;
        require!(env::account_balance().as_yoctonear() >= storage + self.reserved + budget.0 + BUFFER, "balance too low for this budget");
        self.pool -= budget.0;
        self.reserved += budget.0;
        let id = self.jobs.len();
        self.jobs.push(Job {
            id, kind, title, spec, budget, posted_ms: env::block_timestamp_ms(), state: JobState::Open,
            poster, worker: None, fails: 0, deliverable: None,
        });
        env::log_str(&format!("open_job {id}"));
        id
    }

    pub fn take(&mut self, job_id: u32) {
        let worker = env::predecessor_account_id();
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Open, "job not open");
        require!(worker != job.poster, "poster cannot take the job");
        require!(worker != env::current_account_id(), "not the contract");
        let job = self.job_mut(job_id);
        job.worker = Some(worker);
        job.state = JobState::Hired;
        env::log_str(&format!("take {job_id}"));
    }

    pub fn deliver(&mut self, job_id: u32, data: String) -> bool {
        let worker = env::predecessor_account_id();
        require!(data.len() <= MAX_DATA, "delivery over 4 KB");
        let job = self.jobs.get(job_id).cloned().unwrap_or_else(|| env::panic_str("no such job"));
        require!(job.state == JobState::Hired, "nobody is hired");
        require!(job.worker.as_ref() == Some(&worker), "only the hired agent delivers");
        let verdict = self.verdict(&job.kind, &job.spec, &data);
        let price = job.budget.0;
        let rid = self.receipts.len();
        self.receipts.push(Receipt {
            id: rid, job: job_id, kind: job.kind.clone(), seller: worker.clone(), price: U128(price),
            pass: verdict.pass, reason: verdict.reason.clone(), at_ms: env::block_timestamp_ms(),
            payout: if verdict.pass { Payout::Pending } else { Payout::None },
        });
        if verdict.pass {
            let job = self.job_mut(job_id);
            job.state = JobState::Done;
            job.deliverable = Some(data);
            self.reserved -= price;
            self.spent += price;
            env::log_str(&format!("pass job {job_id} receipt {rid}: {}", verdict.reason));
            Promise::new(worker).transfer(NearToken::from_yoctonear(price)).then(
                Self::ext(env::current_account_id()).with_static_gas(GAS_CB).on_paid(rid),
            ).detach();
        } else {
            let fails = {
                let job = self.job_mut(job_id);
                job.fails += 1;
                job.fails
            };
            env::log_str(&format!("fail job {job_id} receipt {rid}: {}", verdict.reason));
            if fails >= MAX_FAILS {
                self.job_mut(job_id).state = JobState::Closed;
                self.reserved -= price;
                self.pool += price;
            }
        }
        verdict.pass
    }

    #[private]
    pub fn on_paid(&mut self, rid: u32, #[callback_result] transfer: Result<(), PromiseError>) {
        let Some(r) = self.receipts.get_mut(rid) else { return };
        r.payout = if transfer.is_ok() { Payout::Sent } else { Payout::Failed };
        env::log_str(&format!("payout receipt {rid}: {:?}", r.payout));
    }

    pub fn close(&mut self) -> Promise {
        require!(env::predecessor_account_id() == self.beneficiary, "beneficiary only");
        require!(self.jobs.iter().all(|j| j.state != JobState::Open && j.state != JobState::Hired), "a job is open");
        Promise::new(env::current_account_id()).delete_account(self.beneficiary.clone())
    }

    pub fn preview_check(&self, job_id: u32, data: String) -> Value {
        let job = self.jobs.get(job_id).unwrap_or_else(|| env::panic_str("no such job"));
        let v = self.verdict(&job.kind, &job.spec, &data);
        json!({ "pass": v.pass, "reason": v.reason })
    }

    pub fn get_config(&self) -> Value {
        json!({
            "contract": env::current_account_id(),
            "beneficiary": self.beneficiary,
            "pool": U128(self.pool),
            "reserved": U128(self.reserved),
            "spent": U128(self.spent),
            "funders": self.funders.len(),
            "jobs": self.jobs.len(),
            "receipts": self.receipts.len(),
            "balance": U128(env::account_balance().as_yoctonear()),
        })
    }

    pub fn get_funders(&self) -> Vec<Value> {
        self.funders.iter().map(|f| json!({ "account": f.account, "amount": U128(f.amount) })).collect()
    }

    pub fn get_jobs(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Job> {
        let from = from.unwrap_or(0);
        (from..self.jobs.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.jobs[i].clone()).collect()
    }

    pub fn get_receipts(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Receipt> {
        let from = from.unwrap_or(0);
        (from..self.receipts.len()).take(limit.unwrap_or(20).min(50) as usize).map(|i| self.receipts[i].clone()).collect()
    }
}

impl Contract {
    fn verdict(&self, kind: &str, spec: &str, data: &str) -> checks::Verdict {
        if data.len() > MAX_DATA { return checks::Verdict { pass: false, reason: "delivery over 4 KB".into() }; }
        let spec: Value = serde_json::from_str(spec).unwrap();
        match serde_json::from_str::<Value>(data) {
            Ok(d) => checks::check(kind, &spec, &d),
            Err(_) => checks::Verdict { pass: false, reason: "delivery is not JSON".into() },
        }
    }

    fn job_mut(&mut self, id: u32) -> &mut Job {
        self.jobs.get_mut(id).unwrap_or_else(|| env::panic_str("no such job"))
    }
}

#[cfg(test)]
mod tests;
