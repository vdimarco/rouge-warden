//! Testnet stand-in for intents.near. NEAR Intents has no testnet, so this keeps the one part
//! Pay on Proof uses: ft_on_transfer with msg = receiver account id credits that receiver.
use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract { balances: LookupMap<String, u128> }

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self { Self { balances: LookupMap::new(b"b") } }

    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> U128 {
        let receiver: AccountId = if msg.is_empty() { sender_id } else { msg.parse().unwrap_or_else(|_| env::panic_str("msg is not an account id")) };
        let key = format!("{}:{}", env::predecessor_account_id(), receiver);
        let old = self.balances.get(&key).copied().unwrap_or(0);
        self.balances.insert(key, old + amount.0);
        U128(0)
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        let token = token_id.strip_prefix("nep141:").unwrap_or(&token_id);
        U128(self.balances.get(&format!("{}:{}", token, account_id)).copied().unwrap_or(0))
    }
}
