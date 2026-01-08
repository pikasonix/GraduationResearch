-- Migration: Add parent_solution_id to track re-optimization chain
-- Purpose: Preserve driver-vehicle assignments across re-optimization solutions

-- Add parent_solution_id column to link solutions in re-optimization chain
ALTER TABLE optimization_solutions 
ADD COLUMN parent_solution_id UUID REFERENCES optimization_solutions(id);

-- Index for performance - query parent/child solutions frequently
CREATE INDEX idx_optimization_solutions_parent_id 
ON optimization_solutions(parent_solution_id);

-- Comment to document the column
COMMENT ON COLUMN optimization_solutions.parent_solution_id IS 
'References the previous solution in re-optimization chain. NULL for initial optimization.';

-- SQL Function to copy driver assignments from parent to child solution
-- Preserves driver_id, auto-updates status to assigned, and sets timestamps
CREATE OR REPLACE FUNCTION copy_driver_assignments(
  p_parent_solution_id UUID,
  p_new_solution_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Update routes of new solution based on parent solution
  UPDATE routes new_routes
  SET 
    driver_id = old_routes.driver_id,
    -- If driver copied, set status to assigned, otherwise keep current status
    status = CASE 
        WHEN old_routes.driver_id IS NOT NULL THEN 'assigned'::route_status
        ELSE new_routes.status
    END,
    -- Update assigned_at timestamp when driver is assigned
    assigned_at = CASE
        WHEN old_routes.driver_id IS NOT NULL THEN NOW()
        ELSE new_routes.assigned_at
    END,
    updated_at = NOW()
  FROM routes old_routes
  WHERE 
    -- Join condition: Same vehicle, parent -> child solution
    old_routes.solution_id = p_parent_solution_id
    AND new_routes.solution_id = p_new_solution_id
    AND new_routes.vehicle_id = old_routes.vehicle_id
    
    -- Only copy when parent route has driver
    AND old_routes.driver_id IS NOT NULL
    
    -- Only update if new route doesn't have driver yet (safety check)
    AND new_routes.driver_id IS NULL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION copy_driver_assignments IS 
'Preserves driver assignments from parent solution to child solution during re-optimization. Returns number of routes updated.';
