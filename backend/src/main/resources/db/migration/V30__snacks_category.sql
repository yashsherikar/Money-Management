-- Small eats / street food / tea-burger runs — separate from full Dining Out meals
INSERT INTO categories (user_id, name, essential, is_default)
SELECT NULL, 'Snacks', false, true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Snacks' AND is_default = true AND user_id IS NULL
);
