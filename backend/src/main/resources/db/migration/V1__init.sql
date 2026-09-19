CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    balance NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    essential BOOLEAN NOT NULL DEFAULT true,
    is_default BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_categories_user ON categories(user_id);

CREATE TABLE transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    description VARCHAR(500),
    txn_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, txn_date);
CREATE INDEX idx_transactions_account ON transactions(account_id);

CREATE TABLE emis (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    loan_name VARCHAR(255) NOT NULL,
    principal NUMERIC(14,2) NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    tenure_months INT NOT NULL,
    emi_amount NUMERIC(14,2) NOT NULL,
    start_date DATE NOT NULL,
    due_day INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_logged_month VARCHAR(7)
);
CREATE INDEX idx_emis_user ON emis(user_id);

CREATE TABLE fixed_deposits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(255) NOT NULL,
    principal NUMERIC(14,2) NOT NULL,
    interest_rate NUMERIC(5,2) NOT NULL,
    start_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    maturity_amount NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_fd_user ON fixed_deposits(user_id);

CREATE TABLE insurance_policies (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    policy_name VARCHAR(255) NOT NULL,
    premium_amount NUMERIC(14,2) NOT NULL,
    due_date DATE NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_insurance_user ON insurance_policies(user_id);
