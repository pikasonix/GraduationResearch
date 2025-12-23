-- Add better error handling and logging to handle_new_user trigger
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
  
  -- Log for debugging
  RAISE NOTICE 'Creating user: email=%, phone=%, fullname=%', user_email, user_phone, user_fullname;

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
    
    RAISE NOTICE 'Created organization: id=%', new_org_id;

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
      is_active
    ) VALUES (
      NEW.id,
      new_org_id,
      split_part(user_email, '@', 1),
      user_email,
      'oauth', -- Mark as OAuth/managed by auth.users
      user_fullname,
      user_phone,
      'user',
      true
    );
    
    RAISE NOTICE 'Created user: id=%', NEW.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user: %', SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$$;
