ALTER TABLE push_subscriptions ADD COLUMN device_id VARCHAR(100);
CREATE INDEX idx_push_subscriptions_device_id ON push_subscriptions(device_id);
