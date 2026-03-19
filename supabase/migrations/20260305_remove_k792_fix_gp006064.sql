-- K792 verwijderen; GP006064 hoort bij C830 (ERP LINK)
-- 1. Stock: koppel GP006064 rijen met verkeerde kistnummer K792 aan C830
UPDATE grote_inpak_stock
SET kistnummer = 'C830'
WHERE erp_code = 'GP006064' AND (kistnummer = 'K792' OR kistnummer = 'V792');

-- 2. ERP LINK: verwijder K792 (als die bestaat met GP006064 of anders)
DELETE FROM grote_inpak_erp_link
WHERE UPPER(TRIM(kistnummer)) IN ('K792', 'V792');

-- 3. Kanban config: verwijder K792 uit rekindeling
DELETE FROM grote_inpak_kanban_config
WHERE UPPER(TRIM(case_type)) IN ('K792', 'V792');
