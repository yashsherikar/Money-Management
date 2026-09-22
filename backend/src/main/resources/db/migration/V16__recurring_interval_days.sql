ALTER TABLE recurring_transactions ALTER COLUMN day_of_month DROP NOT NULL;
ALTER TABLE recurring_transactions ADD COLUMN recurrence_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE recurring_transactions ADD COLUMN interval_days INT;
ALTER TABLE recurring_transactions ADD COLUMN last_logged_date DATE;
