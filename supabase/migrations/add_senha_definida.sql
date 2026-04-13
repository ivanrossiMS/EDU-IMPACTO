-- Add senha_definida column to system_users to track if a user has set their password via primeiro acesso
-- Run this in your Supabase SQL Editor

ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS senha_definida BOOLEAN DEFAULT FALSE;

-- Also add auth_id column if it doesn't exist (to link system_users to auth.users)
ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Update existing users who have already authenticated (last_sign_in_at != null means they already set their password)
-- This prevents them from going through primeiro acesso again
UPDATE system_users su
SET senha_definida = TRUE
FROM auth.users au
WHERE au.email = su.email
  AND au.last_sign_in_at IS NOT NULL;
