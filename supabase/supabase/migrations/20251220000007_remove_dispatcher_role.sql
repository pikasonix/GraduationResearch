-- Remove 'dispatcher' role
-- Step 1: Migrate any existing dispatcher users to 'user' role
UPDATE public.users 
SET role = 'user', updated_at = now()
WHERE role = 'dispatcher';

-- Step 2: Create new enum without 'dispatcher'
ALTER TYPE public.user_role RENAME TO user_role_old;

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'driver',
    'user'
);

-- Step 3: Update users table to use new enum
ALTER TABLE public.users 
  ALTER COLUMN role TYPE public.user_role 
  USING role::text::public.user_role;

-- Step 4: Drop old enum
DROP TYPE public.user_role_old;
