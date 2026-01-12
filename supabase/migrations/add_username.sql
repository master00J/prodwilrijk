-- Add username column to user_roles table
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS username VARCHAR(255) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_username ON user_roles(username);



