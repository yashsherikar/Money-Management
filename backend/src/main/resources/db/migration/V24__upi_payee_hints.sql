CREATE TABLE upi_payee_hints (
    id              BIGSERIAL PRIMARY KEY,
    upi_id          VARCHAR(255) NOT NULL,
    category_name   VARCHAR(100) NOT NULL,
    is_personal     BOOLEAN NOT NULL DEFAULT FALSE,
    display_name    VARCHAR(255),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_upi_payee_hints_upi_id UNIQUE (upi_id)
);

CREATE INDEX idx_upi_payee_hints_upi_id ON upi_payee_hints (upi_id);
