-- Update trigger to save OAuth avatar URL to public.users
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
  user_phone text;
  user_fullname text;
  user_avatar_url text;
BEGIN
  -- Get user email and metadata
  user_email := NEW.email;
  user_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  
  -- Extract phone from metadata
  user_phone := COALESCE(
    user_metadata->>'phone',
    user_metadata->>'phone_number'
  );
  
  -- Extract full name from metadata
  user_fullname := COALESCE(
    user_metadata->>'full_name',
    user_metadata->>'name',
    split_part(user_email, '@', 1)
  );
  
  -- Extract avatar URL from OAuth providers (Google, etc.)
  user_avatar_url := COALESCE(
    user_metadata->>'avatar_url',
    user_metadata->>'picture'
  );

  BEGIN
    -- Create a new organization for the user
    INSERT INTO public.organizations (
      name,
      account_type,
      contact_email,
      contact_phone,
      is_active
    ) VALUES (
      user_fullname || '''s Organization',
      'individual',
      user_email,
      user_phone,
      true
    )
    RETURNING id INTO new_org_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create organization: %', SQLERRM;
    RAISE;
  END;

  BEGIN
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
      is_active,
      avatar_url
    ) VALUES (
      NEW.id,
      new_org_id,
      split_part(user_email, '@', 1),
      user_email,
      'oauth',
      user_fullname,
      user_phone,
      'admin',
      true,
      user_avatar_url
    );

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user: %', SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
