-- Debug Route Query
-- Chạy trong Supabase SQL Editor

-- Thay route_id này bằng route ID bạn muốn debug
\set route_id 'e0aed9cc-f318-495a-9ed5-965a57e09694'

-- =====================================================================
-- 1. ROUTE INFO
-- =====================================================================
SELECT 
    '🚗 ROUTE INFO' as section,
    id,
    route_number,
    driver_id,
    vehicle_id,
    status,
    solution_id
FROM routes
WHERE id = :'route_id';

-- =====================================================================
-- 2. ROUTE STOPS với Orders và Locations
-- =====================================================================
SELECT 
    '📍 STOP DETAILS' as section,
    rs.stop_sequence AS "Seq",
    rs.stop_type AS "Type",
    l.name AS "Location Name",
    CASE 
        WHEN rs.order_id IS NOT NULL THEN '✅'
        ELSE '❌ NULL'
    END AS "Has Order",
    o.tracking_number AS "Order #",
    o.reference_code AS "Ref Code",
    CASE 
        WHEN rs.stop_type = 'pickup' THEN 
            COALESCE(o.pickup_time_start::text, 'NULL')
        ELSE 
            COALESCE(o.delivery_time_start::text, 'NULL')
    END AS "TW Start",
    CASE 
        WHEN rs.stop_type = 'pickup' THEN 
            COALESCE(o.pickup_time_end::text, 'NULL')
        ELSE 
            COALESCE(o.delivery_time_end::text, 'NULL')
    END AS "TW End",
    rs.is_completed AS "Completed"
FROM route_stops rs
LEFT JOIN locations l ON l.id = rs.location_id
LEFT JOIN orders o ON o.id = rs.order_id
WHERE rs.route_id = :'route_id'
ORDER BY rs.stop_sequence;

-- =====================================================================
-- 3. GROUPING PREVIEW (simulating mobile app logic)
-- =====================================================================
WITH ordered_stops AS (
    SELECT 
        rs.stop_sequence,
        rs.stop_type,
        l.name AS location_name,
        rs.order_id,
        rs.is_completed,
        LAG(l.name) OVER (ORDER BY rs.stop_sequence) AS prev_location,
        LAG(rs.stop_type) OVER (ORDER BY rs.stop_sequence) AS prev_type
    FROM route_stops rs
    LEFT JOIN locations l ON l.id = rs.location_id
    WHERE rs.route_id = :'route_id'
    ORDER BY rs.stop_sequence
),
grouped AS (
    SELECT 
        *,
        CASE 
            WHEN location_name = prev_location AND stop_type = prev_type THEN 0
            ELSE 1
        END AS is_new_group
    FROM ordered_stops
),
group_numbers AS (
    SELECT 
        *,
        SUM(is_new_group) OVER (ORDER BY stop_sequence) AS group_num
    FROM grouped
)
SELECT 
    '📊 GROUPING PREVIEW' as section,
    group_num AS "Group",
    MIN(stop_sequence) || CASE 
        WHEN COUNT(*) > 1 THEN '-' || MAX(stop_sequence)
        ELSE ''
    END AS "Seq Range",
    location_name AS "Location",
    stop_type AS "Type",
    COUNT(*) AS "# Stops",
    SUM(CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END) AS "# Orders",
    CASE 
        WHEN BOOL_AND(is_completed) THEN 'completed'
        ELSE 'pending'
    END AS "Status"
FROM group_numbers
GROUP BY group_num, location_name, stop_type
ORDER BY group_num;

-- =====================================================================
-- 4. SUMMARY
-- =====================================================================
SELECT 
    '📈 SUMMARY' as section,
    COUNT(*) AS "Total Stops",
    COUNT(DISTINCT CASE WHEN rs.stop_type = 'pickup' THEN rs.location_id END) AS "Pickup Locations",
    COUNT(DISTINCT CASE WHEN rs.stop_type = 'delivery' THEN rs.location_id END) AS "Delivery Locations",
    COUNT(DISTINCT rs.order_id) AS "Unique Orders",
    SUM(CASE WHEN rs.is_completed THEN 1 ELSE 0 END) AS "Completed Stops",
    SUM(CASE WHEN rs.order_id IS NULL THEN 1 ELSE 0 END) AS "⚠️ Stops with NULL order_id"
FROM route_stops rs
WHERE rs.route_id = :'route_id';
