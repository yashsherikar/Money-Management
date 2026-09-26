ALTER TABLE push_subscriptions ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE push_subscriptions ALTER COLUMN auth DROP NOT NULL;
ALTER TABLE push_subscriptions ADD COLUMN fcm_token VARCHAR(500);
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_fcm_token_key UNIQUE (fcm_token);
