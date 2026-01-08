-- Combined migration: Add dispatch_settings and vehicle default_driver_id
-- This replaces migrations 20251226000001 and 20251226000002

-- 1. Add dispatch_settings to organizations (if not exists)
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS dispatch_settings jsonb NOT NULL
DEFAULT jsonb_build_object(
  'allowed_statuses', jsonb_build_array('WAITING','IN_TRANSIT'),
  'dynamic', jsonb_build_object(
    'lock_completed', true,
    'allow_reorder', true,
    'allow_vehicle_change', false,
    'reopt_interval_minutes', 5,
    'reopt_on_new_order', true,
    'reopt_on_delay', true,
    'reopt_on_cancellation', true
  )
);

-- 2. Backfill missing keys for existing orgs (idempotent)
UPDATE public.organizations
SET dispatch_settings = jsonb_set(
  COALESCE(dispatch_settings, '{}'::jsonb), 
  '{dynamic,reopt_interval_minutes}', 
  '5'::jsonb, 
  true
)
WHERE dispatch_settings IS NULL OR dispatch_settings #>> '{dynamic,reopt_interval_minutes}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(
  COALESCE(dispatch_settings, '{}'::jsonb),
  '{dynamic,reopt_on_new_order}', 
  'true'::jsonb, 
  true
)
WHERE dispatch_settings IS NULL OR dispatch_settings #>> '{dynamic,reopt_on_new_order}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(
  COALESCE(dispatch_settings, '{}'::jsonb),
  '{dynamic,reopt_on_delay}', 
  'true'::jsonb, 
  true
)
WHERE dispatch_settings IS NULL OR dispatch_settings #>> '{dynamic,reopt_on_delay}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(
  COALESCE(dispatch_settings, '{}'::jsonb),
  '{dynamic,reopt_on_cancellation}', 
  'true'::jsonb, 
  true
)
WHERE dispatch_settings IS NULL OR dispatch_settings #>> '{dynamic,reopt_on_cancellation}' IS NULL;

-- 3. Add default_driver_id to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN IF NOT EXISTS default_driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL;

-- 4. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_default_driver_id ON vehicles(default_driver_id);

-- 5. Add comments
COMMENT ON COLUMN vehicles.default_driver_id IS 'Default driver assigned to this vehicle (nullable, for assignment suggestions)';
COMMENT ON COLUMN organizations.dispatch_settings IS 'System-level dispatch eligibility rules and re-optimization controls';

-- 6. Create view for vehicle-driver assignments
CREATE OR REPLACE VIEW vehicle_driver_assignments AS
SELECT 
    v.id as vehicle_id,
    v.license_plate,
    v.vehicle_type,
    v.capacity_weight,
    v.is_active as vehicle_active,
    d.id as driver_id,
    d.driver_code,
    d.full_name as driver_name,
    d.phone as driver_phone,
    d.is_active as driver_active
FROM vehicles v
LEFT JOIN drivers d ON v.default_driver_id = d.id;

COMMENT ON VIEW vehicle_driver_assignments IS 'View showing vehicles with their default driver assignments';
