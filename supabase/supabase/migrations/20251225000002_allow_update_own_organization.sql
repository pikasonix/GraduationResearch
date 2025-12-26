-- Allow authenticated users to update their own organization (e.g. depot settings)
-- Without this, PostgREST updates can affect 0 rows under RLS.

DROP POLICY IF EXISTS "Users can update their organization" ON public.organizations;

CREATE POLICY "Users can update their organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );
