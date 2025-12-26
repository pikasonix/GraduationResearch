-- Add dispatch settings to organizations
-- Stores system-level dispatch eligibility rules per organization.

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS dispatch_settings jsonb NOT NULL
DEFAULT jsonb_build_object(
  'allowed_statuses', jsonb_build_array('WAITING','IN_TRANSIT'),
  'dynamic', jsonb_build_object(
    'lock_completed', true,
    'allow_reorder', true,
    'allow_vehicle_change', false
  )
);
