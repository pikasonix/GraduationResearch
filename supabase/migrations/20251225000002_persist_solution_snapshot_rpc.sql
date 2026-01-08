-- Persist a full optimization solution snapshot (solution + routes + stops) atomically.
-- Called by backend using Supabase service role.

CREATE OR REPLACE FUNCTION public.persist_solution_snapshot(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_solution_id uuid;
    v_job_id uuid := (payload->>'job_id')::uuid;
    v_org_id uuid := (payload->>'organization_id')::uuid;
    v_objective public.optimization_objective := COALESCE((payload->>'optimization_objective')::public.optimization_objective, 'minimize_cost'::public.optimization_objective);
    v_total_vehicles_used integer := COALESCE(NULLIF(payload->>'total_vehicles_used', '')::integer, 0);
    v_total_distance_km numeric(10,2) := COALESCE(NULLIF(payload->>'total_distance_km', '')::numeric(10,2), 0);
    v_total_time_hours numeric(10,2) := COALESCE(NULLIF(payload->>'total_time_hours', '')::numeric(10,2), 0);
    v_total_cost numeric(15,2) := COALESCE(NULLIF(payload->>'total_cost', '')::numeric(15,2), 0);
    v_solution_data jsonb := COALESCE(payload->'solution_data', '{}'::jsonb);
    v_routes jsonb := COALESCE(payload->'routes', '[]'::jsonb);
    v_parent_solution_id uuid := NULLIF((payload->>'parent_solution_id'), '')::uuid;

    v_route jsonb;
    v_stop jsonb;
    v_route_id uuid;
BEGIN
    IF v_job_id IS NULL OR v_org_id IS NULL THEN
        RAISE EXCEPTION 'Missing job_id or organization_id in payload';
    END IF;

    INSERT INTO public.optimization_solutions (
        job_id,
        organization_id,
        optimization_objective,
        total_vehicles_used,
        total_distance_km,
        total_time_hours,
        total_cost,
        solution_data,
        parent_solution_id
    ) VALUES (
        v_job_id,
        v_org_id,
        v_objective,
        v_total_vehicles_used,
        v_total_distance_km,
        v_total_time_hours,
        v_total_cost,
        v_solution_data,
        v_parent_solution_id
    )
    RETURNING id INTO v_solution_id;

    UPDATE public.optimization_jobs
    SET
        status = 'completed'::public.job_status,
        completed_at = now(),
        total_vehicles_used = v_total_vehicles_used,
        total_distance_km = v_total_distance_km,
        total_time_hours = v_total_time_hours,
        total_cost = v_total_cost,
        updated_at = now()
    WHERE id = v_job_id;

    FOR v_route IN
        SELECT value
        FROM jsonb_array_elements(v_routes)
    LOOP
        INSERT INTO public.routes (
            solution_id,
            organization_id,
            route_number,
            route_name,
            planned_distance_km,
            planned_duration_hours,
            planned_cost,
            route_data
        ) VALUES (
            v_solution_id,
            v_org_id,
            NULLIF(v_route->>'route_number', '')::integer,
            v_route->>'route_name',
            COALESCE(NULLIF(v_route->>'planned_distance_km', '')::numeric(10,2), 0),
            COALESCE(NULLIF(v_route->>'planned_duration_hours', '')::numeric(10,2), 0),
            COALESCE(NULLIF(v_route->>'planned_cost', '')::numeric(15,2), 0),
            v_route->'route_data'
        )
        RETURNING id INTO v_route_id;

        FOR v_stop IN
            SELECT value
            FROM jsonb_array_elements(COALESCE(v_route->'stops', '[]'::jsonb))
        LOOP
            INSERT INTO public.route_stops (
                route_id,
                order_id,
                stop_sequence,
                stop_type,
                location_id
            ) VALUES (
                v_route_id,
                (v_stop->>'order_id')::uuid,
                (v_stop->>'stop_sequence')::integer,
                v_stop->>'stop_type',
                (v_stop->>'location_id')::uuid
            );
        END LOOP;
    END LOOP;

    RETURN v_solution_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_solution_snapshot(jsonb) TO service_role;
