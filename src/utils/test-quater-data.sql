-- Test queries for Quater saving functionality
-- Use these in Supabase SQL Editor for testing (READ ONLY)

-- 1) Check if rateation N.36 exists and is marked as Quater
SELECT 
    id, 
    number AS numero, 
    status, 
    is_quater,
    original_total_due_cents,
    quater_total_due_cents,
    total_amount
FROM rateations 
WHERE number = '36';

-- 2) Calculate expected saving for N.36 (in euros)
SELECT
    number AS numero,
    is_quater,
    original_total_due_cents / 100.0 AS original_eur,
    quater_total_due_cents / 100.0 AS quater_eur,
    GREATEST(0, 
        COALESCE(original_total_due_cents, 0) - COALESCE(quater_total_due_cents, 0)
    ) / 100.0 AS saving_expected_eur
FROM rateations
WHERE number = '36';

-- 3) View all Quater rateations and their savings
SELECT 
    number AS numero,
    taxpayer_name AS contribuente,
    status,
    original_total_due_cents / 100.0 AS original_eur,
    quater_total_due_cents / 100.0 AS quater_eur,
    GREATEST(0, 
        COALESCE(original_total_due_cents, 0) - COALESCE(quater_total_due_cents, 0)
    ) / 100.0 AS saving_eur
FROM rateations
WHERE is_quater = TRUE
ORDER BY saving_eur DESC;

-- 4) Total Quater saving across all rateations
SELECT 
    COUNT(*) AS quater_rateations_count,
    SUM(GREATEST(0, 
        COALESCE(original_total_due_cents, 0) - COALESCE(quater_total_due_cents, 0)
    )) / 100.0 AS total_saving_eur
FROM rateations
WHERE is_quater = TRUE;

-- 5) Sample INSERT for testing (DO NOT RUN - just for reference)
-- UPDATE rateations 
-- SET 
--     is_quater = TRUE,
--     original_total_due_cents = 150000, -- €1,500
--     quater_total_due_cents = 120000     -- €1,200 (€300 saving)
-- WHERE number = '36';