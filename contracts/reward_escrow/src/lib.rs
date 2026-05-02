#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String};

const INSTANCE_BUMP_THRESHOLD: u32 = 100;
const INSTANCE_LIFETIME_THRESHOLD: u32 = 518_400;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardTask {
    pub id: u64,
    pub parent: Address,
    pub child: Address,
    pub token: Address,
    pub amount: i128,
    pub title: String,
    pub funded: bool,
    pub paid: bool,
    pub refunded: bool,
}

#[contracttype]
pub enum DataKey {
    NextTaskId,
    Task(u64),
}

#[contract]
pub struct RewardEscrowContract;

#[contractimpl]
impl RewardEscrowContract {
    pub fn create_task(
        env: Env,
        parent: Address,
        child: Address,
        token: Address,
        amount: i128,
        title: String,
    ) -> u64 {
        parent.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let id = Self::next_task_id(&env);
        let task = RewardTask {
            id,
            parent,
            child,
            token,
            amount,
            title,
            funded: false,
            paid: false,
            refunded: false,
        };

        env.storage().persistent().set(&DataKey::Task(id), &task);
        Self::bump(&env);
        id
    }

    pub fn create_and_fund_task(
        env: Env,
        parent: Address,
        child: Address,
        token: Address,
        amount: i128,
        title: String,
    ) -> u64 {
        parent.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let id = Self::next_task_id(&env);
        let task = RewardTask {
            id,
            parent: parent.clone(),
            child,
            token: token.clone(),
            amount,
            title,
            funded: true,
            paid: false,
            refunded: false,
        };

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&parent, &env.current_contract_address(), &amount);

        env.storage().persistent().set(&DataKey::Task(id), &task);
        Self::bump(&env);
        id
    }

    pub fn fund_task(env: Env, task_id: u64) {
        let mut task = Self::read_task(&env, task_id);
        task.parent.require_auth();

        if task.funded {
            panic!("already funded");
        }
        if task.paid || task.refunded {
            panic!("task closed");
        }

        let token_client = token::Client::new(&env, &task.token);
        token_client.transfer(
            &task.parent,
            &env.current_contract_address(),
            &task.amount,
        );

        task.funded = true;
        env.storage().persistent().set(&DataKey::Task(task_id), &task);
        Self::bump(&env);
    }

    pub fn approve_and_pay(env: Env, task_id: u64) {
        let mut task = Self::read_task(&env, task_id);
        task.parent.require_auth();

        if !task.funded {
            panic!("task not funded");
        }
        if task.paid || task.refunded {
            panic!("task closed");
        }

        let token_client = token::Client::new(&env, &task.token);
        token_client.transfer(
            &env.current_contract_address(),
            &task.child,
            &task.amount,
        );

        task.paid = true;
        env.storage().persistent().set(&DataKey::Task(task_id), &task);
        Self::bump(&env);
    }

    pub fn refund(env: Env, task_id: u64) {
        let mut task = Self::read_task(&env, task_id);
        task.parent.require_auth();

        if !task.funded {
            panic!("task not funded");
        }
        if task.paid || task.refunded {
            panic!("task closed");
        }

        let token_client = token::Client::new(&env, &task.token);
        token_client.transfer(
            &env.current_contract_address(),
            &task.parent,
            &task.amount,
        );

        task.refunded = true;
        env.storage().persistent().set(&DataKey::Task(task_id), &task);
        Self::bump(&env);
    }

    pub fn get_task(env: Env, task_id: u64) -> RewardTask {
        Self::read_task(&env, task_id)
    }

    fn next_task_id(env: &Env) -> u64 {
        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextTaskId)
            .unwrap_or(1);
        env.storage()
            .instance()
            .set(&DataKey::NextTaskId, &(id + 1));
        id
    }

    fn read_task(env: &Env, task_id: u64) -> RewardTask {
        env.storage()
            .persistent()
            .get(&DataKey::Task(task_id))
            .unwrap_or_else(|| panic!("task not found"))
    }

    fn bump(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_BUMP_THRESHOLD, INSTANCE_LIFETIME_THRESHOLD);
    }
}
