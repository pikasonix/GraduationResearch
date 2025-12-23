-- Enhanced version of handle_new_user with better error handling and logging
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
  error_message text;
BEGIN
  -- Log the trigger execution (will appear in Supabase logs)
  RAISE LOG 'handle_new_user trigger started for user: %', NEW.id;

  -- Get user email and metadata
  user_email := NEW.email;
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  RAISE LOG 'User email: %, metadata: %', user_email, user_metadata;

  -- Create a new organization for the user
  BEGIN
    INSERT INTO public.organizations (
      name,
      account_type,
      contact_email,
      is_active
    ) VALUES (
      COALESCE(
        user_metadata->>'full_name',
        user_metadata->>'name',
        split_part(user_email, '@', 1)
      ) || '''s Organization',
      'individual',
      user_email,
      true
    )
    RETURNING id INTO new_org_id;
    
    RAISE LOG 'Created organization: %', new_org_id;
  EXCEPTION WHEN OTHERS THEN
    error_message := SQLERRM;
    RAISE LOG 'Error creating organization: %', error_message;
    RAISE EXCEPTION 'Failed to create organization: %', error_message;
  END;

  -- Create user record in public.users table
  BEGIN
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
    
    RAISE LOG 'Created user record: %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    error_message := SQLERRM;
    RAISE LOG 'Error creating user: %', error_message;
    RAISE EXCEPTION 'Failed to create user: %', error_message;
  END;

  RAISE LOG 'handle_new_user completed successfully';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any uncaught errors
  RAISE LOG 'Unexpected error in handle_new_user: %', SQLERRM;
  -- Re-raise to prevent user creation
  RAISE;
END;
$$;

-- Recreate trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Automatically creates organization and user record when a new auth user is created. Enhanced with error logging.';
