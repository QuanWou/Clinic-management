-- payOS and manually verified transfer can describe the same incoming bank transaction.
CREATE UNIQUE INDEX one_incoming_bank_reference ON billing_v2.payments(clinic_id,branch_id,external_ref)
WHERE method IN ('PAYOS','BANK_TRANSFER');
