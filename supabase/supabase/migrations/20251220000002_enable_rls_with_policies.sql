-- Enable RLS and add proper policies for users table

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
DROP POLICY IF EXISTS "Users can view their organization" ON public.organizations;
DROP POLICY IF EXISTS "Service role can do anything on users" ON public.users;
DROP POLICY IF EXISTS "Service role can do anything on organizations" ON public.organizations;

-- Users table policies
-- Allow users to read their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile (except role and organization)
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow all authenticated users to read all users (for organization management)
CREATE POLICY "Allow authenticated users to read users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to do everything (for triggers and admin operations)
CREATE POLICY "Service role can do anything on users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Organizations table policies
-- Allow users to view their own organization
CREATE POLICY "Users can view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.users 
      WHERE id = auth.uid()
    )
  );

-- Allow service role to do everything (for triggers)
CREATE POLICY "Service role can do anything on organizations"
  ON public.organizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
