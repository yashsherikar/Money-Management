ALTER TABLE udhar_entries ADD COLUMN contact_email VARCHAR(255);
ALTER TABLE udhar_entries ADD COLUMN contact_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE udhar_entries ADD COLUMN settle_requested_at TIMESTAMP;
CREATE INDEX idx_udhar_contact_user ON udhar_entries(contact_user_id);
