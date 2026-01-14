-- ===================================================================
-- HƯỚNG DẪN: Apply Migration SQL vào Supabase
-- ===================================================================
-- 
-- Bước 1: Đăng nhập vào Supabase Dashboard
-- Bước 2: Vào SQL Editor (biểu tượng Database → SQL Editor)
-- Bước 3: Copy toàn bộ SQL dưới đây và paste vào editor
-- Bước 4: Click "Run" để thực thi
--
-- ===================================================================

-- Function to update order status based on stop completion
CREATE OR REPLACE FUNCTION update_order_status_on_stop_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_id UUID;
    v_pickup_completed BOOLEAN;
    v_delivery_completed BOOLEAN;
    v_completed_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only run when is_completed is set to true
    IF NEW.is_completed = TRUE AND (OLD.is_completed IS NULL OR OLD.is_completed = FALSE) THEN
        v_order_id := NEW.order_id;
        v_completed_at := NEW.actual_departure_time;
        
        -- Get completion status of both pickup and delivery stops for this order
        SELECT 
            MAX(CASE WHEN stop_type = 'pickup' AND is_completed = TRUE THEN TRUE ELSE FALSE END) as pickup_done,
            MAX(CASE WHEN stop_type = 'delivery' AND is_completed = TRUE THEN TRUE ELSE FALSE END) as delivery_done
        INTO v_pickup_completed, v_delivery_completed
        FROM route_stops
        WHERE order_id = v_order_id;
        
        -- Update order status based on stop completion
        IF v_pickup_completed AND v_delivery_completed THEN
            -- Both pickup and delivery completed -> order is completed
            UPDATE orders
            SET 
                status = 'completed',
                delivered_at = v_completed_at,
                updated_at = NOW()
            WHERE id = v_order_id;
            
            RAISE NOTICE 'Order % marked as completed (both stops done)', v_order_id;
            
        ELSIF v_pickup_completed AND NOT v_delivery_completed THEN
            -- Only pickup completed -> order is in transit
            UPDATE orders
            SET 
                status = 'in_transit',
                picked_up_at = v_completed_at,
                updated_at = NOW()
            WHERE id = v_order_id AND status != 'in_transit';
            
            RAISE NOTICE 'Order % marked as in_transit (pickup done)', v_order_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_order_status_on_stop_completion ON route_stops;

-- Create trigger
CREATE TRIGGER trigger_update_order_status_on_stop_completion
    AFTER UPDATE OF is_completed ON route_stops
    FOR EACH ROW
    WHEN (NEW.is_completed = TRUE)
    EXECUTE FUNCTION update_order_status_on_stop_completion();

-- Add comments for documentation
COMMENT ON FUNCTION update_order_status_on_stop_completion() IS 
'Automatically updates order status when stops are completed:
- When pickup stop is completed: order status → in_transit
- When both pickup AND delivery are completed: order status → completed';

COMMENT ON TRIGGER trigger_update_order_status_on_stop_completion ON route_stops IS
'Auto-updates order status based on stop completion';

-- ===================================================================
-- Kiểm tra migration đã được apply thành công
-- ===================================================================

-- Check if function exists
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'update_order_status_on_stop_completion';

-- Check if trigger exists
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'trigger_update_order_status_on_stop_completion';

-- ===================================================================
-- Test manually (OPTIONAL - chỉ để kiểm tra)
-- ===================================================================

-- Uncomment để test:
/*
-- Find a pending order with stops
SELECT o.id, o.tracking_number, o.status,
       rs.id as stop_id, rs.stop_type, rs.is_completed
FROM orders o
JOIN route_stops rs ON rs.order_id = o.id
WHERE o.status = 'assigned'
LIMIT 1;

-- Complete pickup stop (replace with actual stop_id)
UPDATE route_stops 
SET is_completed = true, 
    actual_arrival_time = NOW(),
    actual_departure_time = NOW()
WHERE id = '<stop_id_từ_query_trên>' AND stop_type = 'pickup';

-- Check order status (should be 'in_transit')
SELECT id, tracking_number, status, picked_up_at 
FROM orders 
WHERE id = '<order_id_từ_query_trên>';
*/
