-- Add verified column to user_roles table
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_verified ON user_roles(verified);

-- Update existing admins to be verified by default
UPDATE user_roles 
SET verified = TRUE 
WHERE role = 'admin';




