ALTER TABLE app_notifications
    ADD COLUMN related_type VARCHAR(40),
    ADD COLUMN related_id BIGINT;

CREATE INDEX idx_app_notifications_related
    ON app_notifications(related_type, related_id);
