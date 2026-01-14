-- Allow drivers to view their own driver record
-- This is needed for mobile app to fetch driver_id from user_id

DROP POLICY IF EXISTS "Drivers can view their own record" ON public.drivers;

CREATE POLICY "Drivers can view their own record"
ON public.drivers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Also allow drivers to update their own profile (except critical fields)
DROP POLICY IF EXISTS "Drivers can update their own profile" ON public.drivers;

CREATE POLICY "Drivers can update their own profile"
ON public.drivers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
    user_id = auth.uid() 
    AND organization_id = (SELECT organization_id FROM public.drivers WHERE user_id = auth.uid())
);
