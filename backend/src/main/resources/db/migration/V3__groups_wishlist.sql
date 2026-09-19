ALTER TABLE users ADD COLUMN upi_id VARCHAR(100);

CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(12) NOT NULL UNIQUE,
    owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE wishlist_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(14,2) NOT NULL,
    product_url VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_wishlist_items_user ON wishlist_items(user_id);
CREATE INDEX idx_wishlist_items_group ON wishlist_items(group_id);

CREATE TABLE contribution_requests (
    id BIGSERIAL PRIMARY KEY,
    wishlist_item_id BIGINT NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    responded_at TIMESTAMP
);
CREATE INDEX idx_contribution_requests_member ON contribution_requests(member_id);
CREATE INDEX idx_contribution_requests_requester ON contribution_requests(requester_id);
