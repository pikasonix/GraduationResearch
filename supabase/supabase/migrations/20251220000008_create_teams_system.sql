-- Create teams table to manage manager's groups
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    manager_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Unique constraint: team name per organization
    CONSTRAINT teams_name_org_unique UNIQUE (organization_id, name)
);

-- Function to validate manager role for teams
CREATE OR REPLACE FUNCTION public.validate_team_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = NEW.manager_id AND role = 'manager'
    ) THEN
        RAISE EXCEPTION 'User must have manager role to create a team';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to validate manager role
CREATE TRIGGER check_team_manager_role
    BEFORE INSERT OR UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_team_manager();

-- Add team_id to drivers table
ALTER TABLE public.drivers 
ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Add team_id to vehicles table
ALTER TABLE public.vehicles 
ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_teams_manager_id ON public.teams(manager_id);
CREATE INDEX idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX idx_drivers_team_id ON public.drivers(team_id);
CREATE INDEX idx_vehicles_team_id ON public.vehicles(team_id);

-- RLS Policies for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Managers can view their own teams
CREATE POLICY "Managers can view their teams"
ON public.teams
FOR SELECT
TO authenticated
USING (manager_id = auth.uid());

-- Managers can create teams for themselves
CREATE POLICY "Managers can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (
    manager_id = auth.uid() 
    AND (SELECT role FROM public.users WHERE id = auth.uid()) = 'manager'
);

-- Managers can update their own teams
CREATE POLICY "Managers can update their teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

-- Managers can delete their own teams
CREATE POLICY "Managers can delete their teams"
ON public.teams
FOR DELETE
TO authenticated
USING (manager_id = auth.uid());

-- Admins can view all teams in their organization
CREATE POLICY "Admins can view all teams"
ON public.teams
FOR SELECT
TO authenticated
USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
);

-- Service role can do everything
CREATE POLICY "Service role full access on teams"
ON public.teams
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update drivers RLS to include team-based access
DROP POLICY IF EXISTS "Managers can view drivers in their teams" ON public.drivers;
CREATE POLICY "Managers can view drivers in their teams"
ON public.drivers
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT id FROM public.teams WHERE manager_id = auth.uid()
    )
);

-- Update vehicles RLS to include team-based access
DROP POLICY IF EXISTS "Managers can view vehicles in their teams" ON public.vehicles;
CREATE POLICY "Managers can view vehicles in their teams"
ON public.vehicles
FOR SELECT
TO authenticated
USING (
    team_id IN (
        SELECT id FROM public.teams WHERE manager_id = auth.uid()
    )
);

-- Function to auto-create default team for new managers
CREATE OR REPLACE FUNCTION public.create_default_team_for_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only create team if user is manager
    IF NEW.role = 'manager' THEN
        INSERT INTO public.teams (
            organization_id,
            manager_id,
            name,
            description
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            NEW.full_name || '''s Team',
            'Default team for ' || NEW.full_name
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger to create default team when manager is created
DROP TRIGGER IF EXISTS on_manager_created ON public.users;
CREATE TRIGGER on_manager_created
    AFTER INSERT ON public.users
    FOR EACH ROW
    WHEN (NEW.role = 'manager')
    EXECUTE FUNCTION public.create_default_team_for_manager();

-- Comments
COMMENT ON TABLE public.teams IS 'Teams managed by managers to organize drivers and vehicles';
COMMENT ON COLUMN public.teams.manager_id IS 'Manager who owns this team';
COMMENT ON COLUMN public.drivers.team_id IS 'Team this driver belongs to';
COMMENT ON COLUMN public.vehicles.team_id IS 'Team this vehicle belongs to';
