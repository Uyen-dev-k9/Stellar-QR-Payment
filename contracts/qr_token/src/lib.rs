#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Balance(Address),
    Name,
    Symbol,
}

#[contract]
pub struct QrUsdToken;

#[contractimpl]
impl QrUsdToken {
    pub fn initialize(env: Env, admin: Address) -> bool {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Token already initialized");
        }

        admin.require_auth();

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Name, &String::from_str(&env, "QR Pay USD"));
        env.storage()
            .persistent()
            .set(&DataKey::Symbol, &String::from_str(&env, "QRUSD"));

        true
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::Name)
            .unwrap_or(String::from_str(&env, "QR Pay USD"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::Symbol)
            .unwrap_or(String::from_str(&env, "QRUSD"))
    }

    pub fn mint(env: Env, to: Address, amount: i128) -> bool {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Token not initialized");

        admin.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        let new_balance = current_balance + amount;

        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &new_balance);

        env.events()
            .publish((symbol_short!("mint"), to), amount);

        true
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> bool {
        from.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        if from_balance < amount {
            panic!("Insufficient token balance");
        }

        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_balance - amount));

        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_balance + amount));

        env.events()
            .publish((symbol_short!("transfer"), from, to), amount);

        true
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }
}