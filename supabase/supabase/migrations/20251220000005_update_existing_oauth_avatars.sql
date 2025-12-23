-- Update existing users to have avatar_url from OAuth providers if not already set
DO $$
DECLARE
  auth_user RECORD;
  oauth_avatar text;
BEGIN
  -- Loop through users who don't have custom avatar but have OAuth avatar in auth.users
  FOR auth_user IN 
    SELECT au.id, au.raw_user_meta_data, pu.avatar_url
    FROM auth.users au
    JOIN public.users pu ON au.id = pu.id
    WHERE pu.avatar_url IS NULL  -- No custom avatar set
    AND (
      au.raw_user_meta_data->>'avatar_url' IS NOT NULL 
      OR au.raw_user_meta_data->>'picture' IS NOT NULL
    )
  LOOP
    -- Extract OAuth avatar
    oauth_avatar := COALESCE(
      auth_user.raw_user_meta_data->>'avatar_url',
      auth_user.raw_user_meta_data->>'picture'
    );
    
    IF oauth_avatar IS NOT NULL THEN
      BEGIN
        UPDATE public.users
        SET avatar_url = oauth_avatar,
            updated_at = now()
        WHERE id = auth_user.id;
        
        RAISE NOTICE 'Updated avatar for user: %', auth_user.id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to update avatar for user %: %', auth_user.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
