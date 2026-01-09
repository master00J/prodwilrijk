-- Import BC codes data from old database
-- This script imports BC codes from the old database dump, filtering out NULL values, duplicates, and cleaning whitespace

-- Insert unique BC codes (filtering NULLs and cleaning data)
-- Using a CTE to clean and deduplicate the data first
WITH cleaned_data AS (
  SELECT DISTINCT
    breedte,
    dikte,
    TRIM(houtsoort) as houtsoort,
    TRIM(REPLACE(REPLACE(REPLACE(bc_code, '\r', ''), '\n', ''), '\r\n', '')) as bc_code
  FROM (
    VALUES
    (100, 16, 'SXT', '100975'),
    (100, 19, 'NHV', '100277'),
    (100, 19, 'SCH', '100984'),
    (100, 19, 'SXT', '101066'),
    (150, 19, 'NHV', '100282'),
    (150, 19, 'SCH', '100986'),
    (75, 19, 'NHV', '100271'),
    (75, 19, 'SXT', '101064'),
    (75, 22, 'NHV', '103110'),
    (75, 22, 'SXT', '101079'),
    (100, 22, 'NHV', '100327'),
    (100, 22, 'SXT', '101083'),
    (150, 22, 'NHV', '100343'),
    (150, 22, 'KD', '101087'),
    (100, 25, 'NHV', '100359'),
    (100, 25, 'SXT', '101093'),
    (200, 75, 'NHV', '100510'),
    (95, 95, 'NHV', '100597'),
    (100, 32, 'NHV', '100377'),
    (100, 32, 'SXT', '101103'),
    (125, 32, 'NHV', '100378'),
    (125, 32, 'SXT', '101104'),
    (150, 32, 'NHV', '100379'),
    (150, 32, 'SXT', '101105'),
    (100, 38, 'NHV', '100407'),
    (100, 38, 'SXT', '101112'),
    (150, 38, 'NHV', '100408'),
    (75, 43, 'NHV', '100418'),
    (75, 50, 'NHV', '100443'),
    (100, 50, 'NHV', '100446'),
    (150, 50, 'NHV', '100448'),
    (100, 75, 'NHV', '100506'),
    (100, 75, 'SXT', '101139'),
    (150, 75, 'NHV', '100509'),
    (150, 75, 'SXT', '101141'),
    (75, 75, 'NHV', '100500'),
    (125, 95, 'NHV', '100600'),
    (150, 95, 'NHV', '100603'),
    (100, 100, 'NHV', '100623'),
    (100, 100, 'SXT', '103204'),
    (150, 150, 'NHV', '100638'),
    (1220, 3, 'HDB', '101853'),
    (1220, 18, 'MPX', '101897'),
    (1220, 12, 'MPX', '101893'),
    (1220, 22, 'MPX', '104724'),
    (1220, 9, 'OSB', '101942'),
    (1250, 9, 'OSB', '101945'),
    (1500, 9, 'OSB', '106606'),
    (1220, 12, 'MEP', '101893'),
    (1220, 15, 'MEP', '101914'),
    (1220, 9, 'MEP', '101892'),
    (1220, 2440, 'HBO', '101855')
  ) AS imported_data(breedte, dikte, houtsoort, bc_code)
  WHERE breedte IS NOT NULL 
    AND dikte IS NOT NULL 
    AND houtsoort IS NOT NULL 
    AND bc_code IS NOT NULL
    AND houtsoort != ''
    AND bc_code != ''
)
INSERT INTO bc_codes (breedte, dikte, houtsoort, bc_code)
SELECT breedte, dikte, houtsoort, bc_code
FROM cleaned_data
ON CONFLICT (breedte, dikte, houtsoort) DO NOTHING;
