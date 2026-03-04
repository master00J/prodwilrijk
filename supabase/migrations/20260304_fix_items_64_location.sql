-- Fix: "Items (64)" is NAV/BC warehouse code for Willebroek
-- Update existing stock rows so Kanban/Excel correctly recognize them
UPDATE grote_inpak_stock
SET location = 'Willebroek'
WHERE location = 'Items (64)' OR location = 'Items(64)';
