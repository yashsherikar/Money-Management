-- Shared UPI hints are for merchants only; person-to-person UPI IDs (and their names) are private.
DELETE FROM upi_payee_hints WHERE is_personal = TRUE;
