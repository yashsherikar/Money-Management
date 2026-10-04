-- Coffee, chai, juice, soft drinks — separate from Snacks / Dining Out
INSERT INTO categories (user_id, name, essential, is_default)
SELECT NULL, 'Drinks', false, true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Drinks' AND is_default = true AND user_id IS NULL
);
