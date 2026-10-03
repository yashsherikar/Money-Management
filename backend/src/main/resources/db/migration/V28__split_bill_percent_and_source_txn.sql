ALTER TABLE split_bills
    ADD COLUMN source_transaction_id BIGINT UNIQUE REFERENCES transactions(id) ON DELETE SET NULL;

ALTER TABLE split_bills
    ADD COLUMN expense_transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL;

ALTER TABLE split_bill_participants
    ADD COLUMN share_percent NUMERIC(6,2);

CREATE INDEX idx_split_bills_source_txn ON split_bills(source_transaction_id);
CREATE INDEX idx_split_bills_expense_txn ON split_bills(expense_transaction_id);
