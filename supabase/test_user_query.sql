-- Test query to check if user can read their own data
-- Run this in Supabase SQL Editor with an authenticated user session

-- Check current auth user
SELECT auth.uid() as current_user_id;

-- Check if user exists in public.users
SELECT * FROM public.users WHERE id = auth.uid();

-- Check user's organization
SELECT o.* 
FROM public.organizations o
WHERE o.id IN (
  SELECT organization_id 
  FROM public.users 
  WHERE id = auth.uid()
);

-- Test RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename IN ('users', 'organizations')
ORDER BY tablename, policyname;
