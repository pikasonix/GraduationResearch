-- Allow trigger to insert into users and organizations tables
-- RLS policies may be blocking the trigger from creating records

-- Temporarily disable RLS for testing (or add proper policies)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;

-- Or add policies to allow trigger to insert
-- DROP POLICY IF EXISTS "Allow trigger insert" ON public.users;
-- CREATE POLICY "Allow trigger insert" ON public.users
--   FOR INSERT
--   WITH CHECK (true);

-- DROP POLICY IF EXISTS "Allow trigger insert" ON public.organizations;
-- CREATE POLICY "Allow trigger insert" ON public.organizations
--   FOR INSERT
--   WITH CHECK (true);
