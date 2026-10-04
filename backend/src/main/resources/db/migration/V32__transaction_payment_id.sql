-- UPI / payment reference kept separate from human description
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_id VARCHAR(120);

-- Stop duplicate Cashback/Refund/etc. from user-created copies of defaults:
-- re-point txns to the default category, then drop the user duplicate.
UPDATE transactions t
SET category_id = d.id
FROM categories u
JOIN categories d ON lower(d.name) = lower(u.name) AND d.is_default = true AND d.user_id IS NULL
WHERE t.category_id = u.id
  AND u.is_default = false
  AND u.user_id IS NOT NULL;

DELETE FROM categories u
WHERE u.is_default = false
  AND u.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM categories d
    WHERE d.is_default = true AND d.user_id IS NULL AND lower(d.name) = lower(u.name)
  );
