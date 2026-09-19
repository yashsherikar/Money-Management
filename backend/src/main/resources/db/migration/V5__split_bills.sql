CREATE TABLE split_bills (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL,
    bill_date DATE NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_split_bills_user ON split_bills(user_id);

CREATE TABLE split_bill_participants (
    id BIGSERIAL PRIMARY KEY,
    split_bill_id BIGINT NOT NULL REFERENCES split_bills(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    share_amount NUMERIC(14,2) NOT NULL,
    paid BOOLEAN NOT NULL DEFAULT false,
    paid_date DATE
);
CREATE INDEX idx_split_participants_bill ON split_bill_participants(split_bill_id);
