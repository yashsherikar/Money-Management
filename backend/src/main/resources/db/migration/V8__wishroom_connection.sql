CREATE TABLE wishroom_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    wishroom_user_id VARCHAR(100) NOT NULL,
    wishroom_email VARCHAR(255) NOT NULL,
    wishroom_name VARCHAR(255),
    token TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
