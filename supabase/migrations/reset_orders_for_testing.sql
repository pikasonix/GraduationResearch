-- Reset orders for testing dynamic routing
-- Run this SQL in Supabase SQL Editor to reset orders to 'pending' status

-- Option 1: Reset ALL orders for a specific organization
-- Replace 'YOUR_ORG_ID' with actual organization ID
/*
UPDATE orders 
SET status = 'pending', 
    assigned_at = NULL,
    picked_up_at = NULL,
    delivered_at = NULL
WHERE organization_id = 'YOUR_ORG_ID'
AND status IN ('assigned', 'in_transit', 'picked_up');
*/

-- Option 2: Reset specific orders by ID
/*
UPDATE orders 
SET status = 'pending', 
    assigned_at = NULL,
    picked_up_at = NULL,
    delivered_at = NULL
WHERE id IN (
    'order-id-1',
    'order-id-2'
);
*/

-- Option 3: Reset orders for organization "Ngọc Lâm Vũ's Organization" (3de8793f-18f4-4855-80a0-2dd12f9edc6a)
UPDATE orders 
SET status = 'pending', 
    assigned_at = NULL,
    picked_up_at = NULL,
    delivered_at = NULL
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
AND status IN ('assigned', 'in_transit', 'picked_up');

-- Optional: Clear route_stops and routes from previous solutions
-- This will remove historical routing data
/*
DELETE FROM route_stops 
WHERE route_id IN (
    SELECT r.id FROM routes r 
    JOIN solutions s ON r.solution_id = s.id 
    WHERE s.organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
);

DELETE FROM routes 
WHERE solution_id IN (
    SELECT id FROM solutions 
    WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
);

DELETE FROM solutions 
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a';
*/

-- Verify the reset
SELECT status, COUNT(*) as count 
FROM orders 
WHERE organization_id = '3de8793f-18f4-4855-80a0-2dd12f9edc6a'
GROUP BY status;
