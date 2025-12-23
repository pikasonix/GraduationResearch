-- Backfill teams for existing managers
INSERT INTO public.teams (name, manager_id, organization_id)
SELECT 
    COALESCE(full_name, username) || ' - Đội 1',
    id,
    organization_id
FROM public.users 
WHERE role = 'manager' 
AND NOT EXISTS (
    SELECT 1 FROM public.teams WHERE manager_id = users.id
);
