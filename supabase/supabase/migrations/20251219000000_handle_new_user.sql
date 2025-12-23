-- Migration to handle new user signup
-- This creates an organization and user record when a new auth.users record is created

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  user_email text;
  user_metadata jsonb;
BEGIN
  -- Get user email and metadata
  user_email := NEW.email;
  user_metadata := NEW.raw_user_meta_data;

  -- Create a new organization for the user
  INSERT INTO public.organizations (
    name,
    account_type,
    contact_email,
    is_active
  ) VALUES (
    COALESCE(user_metadata->>'full_name', split_part(user_email, '@', 1)) || '''s Organization',
    'individual',
    user_email,
    true
  )
  RETURNING id INTO new_org_id;

  -- Create user record in public.users table
  INSERT INTO public.users (
    id,
    organization_id,
    username,
    email,
    password_hash,
    full_name,
    phone,
    role,
    is_active
  ) VALUES (
    NEW.id,
    new_org_id,
    split_part(user_email, '@', 1),
    user_email,
    'oauth', -- Mark as OAuth user (password managed by auth.users)
    COALESCE(
      user_metadata->>'full_name',
      user_metadata->>'name',
      split_part(user_email, '@', 1)
    ),
    COALESCE(user_metadata->>'phone', user_metadata->>'phone_number'),
    'user',
    true
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
