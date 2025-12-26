-- Add depot information to organizations for route planning

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS depot_name text,
ADD COLUMN IF NOT EXISTS depot_address text,
ADD COLUMN IF NOT EXISTS depot_latitude numeric(10,8),
ADD COLUMN IF NOT EXISTS depot_longitude numeric(11,8);

-- Basic sanity checks (allow all NULLs; if one coordinate is set, require the other)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_depot_coords_pair'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_depot_coords_pair
      CHECK (
        (depot_latitude IS NULL AND depot_longitude IS NULL)
        OR (depot_latitude IS NOT NULL AND depot_longitude IS NOT NULL)
      );
  END IF;
END $$;
