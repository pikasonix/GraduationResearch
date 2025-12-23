-- Ensure all existing auth users have corresponding records in public.users
-- This migration handles users created before the handle_new_user trigger was implemented

DO $$
DECLARE
  auth_user RECORD;
  new_org_id uuid;
  user_fullname text;
BEGIN
  -- Loop through all auth.users that don't have a corresponding public.users record
  FOR auth_user IN 
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.users pu ON au.id = pu.id
    WHERE pu.id IS NULL
  LOOP
    RAISE NOTICE 'Creating user record for auth user: %', auth_user.email;
    
    -- Extract full name
    user_fullname := COALESCE(
      auth_user.raw_user_meta_data->>'full_name',
      auth_user.raw_user_meta_data->>'name',
      split_part(auth_user.email, '@', 1)
    );
    
    BEGIN
      -- Create organization
      INSERT INTO public.organizations (
        name,
        account_type,
        contact_email,
        is_active
      ) VALUES (
        user_fullname || '''s Organization',
        'individual',
        auth_user.email,
        true
      )
      RETURNING id INTO new_org_id;
      
      -- Create user
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
        auth_user.id,
        new_org_id,
        split_part(auth_user.email, '@', 1),
        auth_user.email,
        'oauth',
        user_fullname,
        COALESCE(
          auth_user.raw_user_meta_data->>'phone',
          auth_user.raw_user_meta_data->>'phone_number'
        ),
        'admin',
        true
      );
      
      RAISE NOTICE 'Successfully created user and organization for: %', auth_user.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create records for %: %', auth_user.email, SQLERRM;
    END;
  END LOOP;
END $$;
