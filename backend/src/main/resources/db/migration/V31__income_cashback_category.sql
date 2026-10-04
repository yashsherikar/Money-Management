-- Common income buckets used by SMS cashback / refunds
INSERT INTO categories (user_id, name, essential, is_default)
SELECT NULL, 'Cashback', true, true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Cashback' AND is_default = true AND user_id IS NULL
);

INSERT INTO categories (user_id, name, essential, is_default)
SELECT NULL, 'Refund', true, true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Refund' AND is_default = true AND user_id IS NULL
);

INSERT INTO categories (user_id, name, essential, is_default)
SELECT NULL, 'Interest', true, true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Interest' AND is_default = true AND user_id IS NULL
);
