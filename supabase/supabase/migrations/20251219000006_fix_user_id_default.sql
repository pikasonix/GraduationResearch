-- Fix: Make sure users.id doesn't have conflicting DEFAULT
-- The trigger should be able to insert with explicit id from auth.users

ALTER TABLE public.users 
  ALTER COLUMN id DROP DEFAULT;

-- Recreate trigger to ensure it's AFTER INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
