-- Add avatar_url column to users table
ALTER TABLE public.users 
ADD COLUMN avatar_url text;

COMMENT ON COLUMN public.users.avatar_url IS 'URL to user avatar image';
