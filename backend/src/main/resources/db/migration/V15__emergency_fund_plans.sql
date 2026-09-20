CREATE TABLE emergency_fund_plans (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    target_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    day_of_month INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    last_logged_month VARCHAR(7),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_emergency_fund_plans_user ON emergency_fund_plans(user_id);
