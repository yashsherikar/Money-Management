CREATE TABLE payment_requests (
    id              BIGSERIAL PRIMARY KEY,
    requester_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payer_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          NUMERIC(14,2) NOT NULL,
    note            VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at    TIMESTAMPTZ
);

CREATE INDEX idx_payment_requests_payer ON payment_requests(payer_id);
CREATE INDEX idx_payment_requests_requester ON payment_requests(requester_id);
