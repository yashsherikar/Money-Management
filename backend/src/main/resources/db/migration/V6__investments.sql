CREATE TABLE investments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
    note VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_investments_user ON investments(user_id);

CREATE TABLE investment_transactions (
    id BIGSERIAL PRIMARY KEY,
    investment_id BIGINT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
    txn_date DATE NOT NULL,
    type VARCHAR(10) NOT NULL,
    amount NUMERIC(14,2) NOT NULL
);
CREATE INDEX idx_investment_txns_investment ON investment_transactions(investment_id);
