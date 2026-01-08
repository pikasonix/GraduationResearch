-- Clean up script for testing re-optimization
-- Organization ID: 3de8793f-18f4-4855-80a0-2dd12f9edc6a

BEGIN;

-- 1. Delete route_stops for routes belonging to this org's solutions
DELETE FROM route_stops
WHERE route_id IN (
    SELECT r.id 
    FROM routes r
    JOIN optimization_solutions os ON r.solution_id = os.id
    WHERE os.organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
);

-- 2. Delete routes for this org's solutions
DELETE FROM routes
WHERE solution_id IN (
    SELECT id 
    FROM optimization_solutions 
    WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
);

-- 3. Delete optimization_solutions for this org
DELETE FROM optimization_solutions
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';

-- 4. Reset orders to pending state
UPDATE orders 
SET status = 'pending', 
    assigned_at = NULL,
    picked_up_at = NULL,
    delivered_at = NULL,

    -- Shift time windows to TODAY while preserving the original time-of-day.
    -- This keeps the Sartori-sample hours (e.g. 03:08 -> 03:08 today) so the solver
    -- doesn't see stale timestamps from 2025.
    pickup_time_start = CASE
        WHEN pickup_time_start IS NULL THEN NULL
        ELSE pickup_time_start + ((CURRENT_DATE - (pickup_time_start AT TIME ZONE 'UTC')::date) * INTERVAL '1 day')
    END,
    pickup_time_end = CASE
        WHEN pickup_time_end IS NULL THEN NULL
        ELSE pickup_time_end + ((CURRENT_DATE - (pickup_time_end AT TIME ZONE 'UTC')::date) * INTERVAL '1 day')
    END,
    delivery_time_start = CASE
        WHEN delivery_time_start IS NULL THEN NULL
        ELSE delivery_time_start + ((CURRENT_DATE - (delivery_time_start AT TIME ZONE 'UTC')::date) * INTERVAL '1 day')
    END,
    delivery_time_end = CASE
        WHEN delivery_time_end IS NULL THEN NULL
        ELSE delivery_time_end + ((CURRENT_DATE - (delivery_time_end AT TIME ZONE 'UTC')::date) * INTERVAL '1 day')
    END
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
AND status IN ('pending', 'assigned', 'in_transit', 'picked_up', 'delivered');

-- 5. Optional: Reset driver assignments (if drivers are logged in)
-- UPDATE drivers
-- SET current_vehicle_id = NULL
-- WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';

COMMIT;

-- Verify cleanup
SELECT 'Orders' as table_name, COUNT(*) as pending_count 
FROM orders 
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a' 
AND status = 'pending'
UNION ALL
SELECT 'Solutions', COUNT(*) 
FROM optimization_solutions 
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
UNION ALL
SELECT 'Routes', COUNT(*) 
FROM routes r
JOIN optimization_solutions os ON r.solution_id = os.id
WHERE os.organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
