-- Merchant / payee kept separate from the user's own description, so editing the
-- description ("acko activa insurance") never overwrites the merchant from the SMS/QR.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(120);
