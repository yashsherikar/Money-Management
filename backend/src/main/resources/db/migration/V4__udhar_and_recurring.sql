CREATE TABLE udhar_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    contact_name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    note VARCHAR(500),
    txn_date DATE NOT NULL,
    due_date DATE,
    settled BOOLEAN NOT NULL DEFAULT false,
    settled_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_udhar_user ON udhar_entries(user_id);

CREATE TABLE recurring_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    day_of_month INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_logged_month VARCHAR(7),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_user ON recurring_transactions(user_id);
