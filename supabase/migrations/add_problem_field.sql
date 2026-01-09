-- Add problem field to items_to_pack table
ALTER TABLE items_to_pack 
ADD COLUMN IF NOT EXISTS problem BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_items_to_pack_problem ON items_to_pack(problem);

