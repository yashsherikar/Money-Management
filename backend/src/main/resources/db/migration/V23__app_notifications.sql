CREATE TABLE app_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body VARCHAR(1000) NOT NULL,
    url VARCHAR(255) NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    pay_url VARCHAR(1000),
    viewed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_notifications_user ON app_notifications(user_id, created_at DESC);
