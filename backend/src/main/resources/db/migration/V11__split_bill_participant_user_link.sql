ALTER TABLE split_bill_participants ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_split_participants_user ON split_bill_participants(user_id);
