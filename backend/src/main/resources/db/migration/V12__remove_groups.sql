DROP INDEX IF EXISTS idx_wishlist_items_group;
ALTER TABLE wishlist_items DROP COLUMN group_id;
DROP TABLE group_members;
DROP TABLE groups;
