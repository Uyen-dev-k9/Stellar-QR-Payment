#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol, IntoVal,
};

#[contracttype]
#[derive(Clone)]
pub struct PaymentRecord {
    pub id: u64,
    pub merchant: Address,
    pub payer: Address,
    pub token: Address,
    pub amount: i128,
    pub currency: String,
    pub paid: bool,
}

#[contracttype]
pub enum DataKey {
    Payment(u64),
    Count,
}

#[contract]
pub struct StellarQrPayment;

#[contractimpl]
impl StellarQrPayment {
    pub fn project_name(env: Env) -> String {
        String::from_str(&env, "Stellar QR Pay Level 4")
    }

    pub fn pay_with_token(
        env: Env,
        merchant: Address,
        payer: Address,
        token: Address,
        amount: i128,
        currency: String,
    ) -> u64 {
        payer.require_auth();

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        let transfer_fn = Symbol::new(&env, "transfer");

        let transfer_result: bool = env.invoke_contract(
            &token,
            &transfer_fn,
            (payer.clone(), merchant.clone(), amount).into_val(&env),
        );

        if !transfer_result {
            panic!("Token transfer failed");
        }

        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::Count)
            .unwrap_or(0);

        count += 1;

        let payment = PaymentRecord {
            id: count,
            merchant: merchant.clone(),
            payer: payer.clone(),
            token: token.clone(),
            amount,
            currency: currency.clone(),
            paid: true,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Payment(count), &payment);

        env.storage()
            .persistent()
            .set(&DataKey::Count, &count);

        env.events().publish(
            (symbol_short!("paid"), count),
            (merchant, payer, token, amount, currency),
        );

        count
    }

    pub fn get_payment(env: Env, payment_id: u64) -> PaymentRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Payment(payment_id))
            .expect("Payment not found")
    }

    pub fn is_paid(env: Env, payment_id: u64) -> bool {
        let payment: PaymentRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Payment(payment_id))
            .expect("Payment not found");

        payment.paid
    }

    pub fn total_payments(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::Count)
            .unwrap_or(0)
    }
}