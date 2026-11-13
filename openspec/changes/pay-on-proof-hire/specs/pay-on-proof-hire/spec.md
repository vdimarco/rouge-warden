## ADDED Requirements

### Requirement: A hired parent can pay a sub-agent from its budget

A parent hired on a job can post one sub-job whose budget fits in the hire price that is still unspent and not already reserved for another sub-job. Only a sub-account of that parent can bid. When the sub-agent delivers and the on-chain check passes, the contract pays the sub-agent and counts that price against the parent's cap. The parent can then deliver. When the parent's check passes, the contract pays the parent what remains of the hire price.

#### Scenario: Sub-agent then parent

- **WHEN** a parent hired at 0.5 NEAR posts a 0.2 NEAR sub-job, its sub-account delivers work that passes, and the parent delivers work that passes
- **THEN** the sub-agent is paid 0.2 NEAR, the parent is paid 0.3 NEAR, and spent rises by 0.5 NEAR while that job's reserve returns to zero

#### Scenario: A stranger cannot take the sub-job

- **WHEN** an account that is not a sub-account of the hired parent bids on the sub-job
- **THEN** the contract refuses the bid and pays nothing

#### Scenario: A failed sub delivery pays nothing

- **WHEN** the hired sub-agent delivers work that fails the check
- **THEN** the receipt is a fail, payout is none, and spent does not change

### Requirement: The parent's cap is enforced by the contract

The hire price is a hard cap for that parent. Posting a sub-job that would take paid plus reserved sub budgets plus the new budget over the hire price panics. The global cap still refuses a new parent job that would take spent plus reserved over the contract cap.

#### Scenario: An overspend is refused

- **WHEN** a parent hired at 0.5 NEAR posts a sub-job with a budget of 0.6 NEAR
- **THEN** the transaction fails with "over the cap" and the job's reserve does not change

### Requirement: The parent key cannot spend outside the contract

After setup, the parent account has no full-access key. Its only key is a function-call key whose receiver is the hire contract and whose methods are bid, post_subjob, hire_sub, cancel_subjob, and deliver. A transfer signed with that key is refused by the protocol.

#### Scenario: The locked parent key

- **WHEN** the hire run has finished
- **THEN** a view of the parent account shows one function-call key for the hire contract and no full-access key

#### Scenario: A transfer is refused

- **WHEN** the parent key signs a NEAR transfer to another account
- **THEN** the transaction is refused and no NEAR leaves the parent by that transfer
