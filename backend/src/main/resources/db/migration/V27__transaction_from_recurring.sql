ALTER TABLE transactions
    ADD COLUMN from_recurring BOOLEAN NOT NULL DEFAULT false;
