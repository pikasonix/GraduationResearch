-- Extend organizations.dispatch_settings.dynamic with re-optimization controls
-- Adds defaults and backfills existing rows.

-- 1) Update column default
ALTER TABLE public.organizations
ALTER COLUMN dispatch_settings
SET DEFAULT jsonb_build_object(
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

-- 2) Backfill missing keys for existing orgs (idempotent)
UPDATE public.organizations
SET dispatch_settings = jsonb_set(dispatch_settings, '{dynamic,reopt_interval_minutes}', '5'::jsonb, true)
WHERE dispatch_settings #>> '{dynamic,reopt_interval_minutes}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(dispatch_settings, '{dynamic,reopt_on_new_order}', 'true'::jsonb, true)
WHERE dispatch_settings #>> '{dynamic,reopt_on_new_order}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(dispatch_settings, '{dynamic,reopt_on_delay}', 'true'::jsonb, true)
WHERE dispatch_settings #>> '{dynamic,reopt_on_delay}' IS NULL;

UPDATE public.organizations
SET dispatch_settings = jsonb_set(dispatch_settings, '{dynamic,reopt_on_cancellation}', 'true'::jsonb, true)
WHERE dispatch_settings #>> '{dynamic,reopt_on_cancellation}' IS NULL;
