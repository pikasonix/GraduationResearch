-- ============================================================================
-- WAYO LOGISTICS - SAMPLE DATA INITIALIZATION
-- Dữ liệu mẫu cho testing và development
-- Run sau khi đã tạo schema
-- Có thể chạy nhiều lần - dùng ON CONFLICT DO NOTHING
-- ============================================================================

-- ============================================================================
-- 1. ORGANIZATION (Tổ chức mẫu)
-- ============================================================================
INSERT INTO organizations (id, name, account_type, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'WAYO Logistics Demo', 'enterprise', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. USERS (Người dùng mẫu - password: password123)
-- ============================================================================
-- Note: password_hash là BCrypt hash của "password123"
-- Bỏ qua nếu username đã tồn tại
INSERT INTO users (id, organization_id, username, email, password_hash, full_name, role, is_active) VALUES
    -- Admin
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 
     'wayo_admin', 'wayo_admin@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Nguyễn Admin', 'admin', true),
    -- Manager
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 
     'wayo_manager', 'wayo_manager@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Trần Manager', 'manager', true),
    -- Dispatcher
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 
     'wayo_dispatcher', 'wayo_dispatcher@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Lê Dispatcher', 'dispatcher', true),
    -- Drivers
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 
     'wayo_driver1', 'wayo_driver1@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Phạm Văn Tài', 'driver', true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 
     'wayo_driver2', 'wayo_driver2@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Hoàng Thị Mai', 'driver', true),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 
     'wayo_driver3', 'wayo_driver3@wayo.vn', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrq4H9Q1JX5K5', 
     'Võ Văn Hùng', 'driver', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. SERVICE ZONES (Khu vực hoạt động) - SKIPPED: table may not exist
-- ============================================================================
-- INSERT INTO service_zones (id, organization_id, name, color) VALUES
--     ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 
--      'Khu vực Nội thành HCM', '#3B82F6'),
--     ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 
--      'Khu vực Ngoại thành HCM', '#10B981'),
--     ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 
--      'Khu vực Bình Dương', '#F59E0B')
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. VEHICLES (Xe) - Basic columns only
-- ============================================================================
INSERT INTO vehicles (id, organization_id, license_plate, vehicle_type, capacity_weight, is_active) VALUES
    ('55555555-5555-5555-5555-555555555551', '11111111-1111-1111-1111-111111111111', 
     '59A1-12345', 'motorcycle', 50, true),
    ('55555555-5555-5555-5555-555555555552', '11111111-1111-1111-1111-111111111111', 
     '59B2-23456', 'motorcycle', 50, true),
    ('55555555-5555-5555-5555-555555555553', '11111111-1111-1111-1111-111111111111', 
     '51A-34567', 'van', 500, true),
    ('55555555-5555-5555-5555-555555555554', '11111111-1111-1111-1111-111111111111', 
     '51B-45678', 'van', 800, true),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 
     '51C-56789', 'truck_small', 1500, true),
    ('55555555-5555-5555-5555-555555555556', '11111111-1111-1111-1111-111111111111', 
     '51D-67890', 'truck_medium', 3000, true),
    ('55555555-5555-5555-5555-555555555557', '11111111-1111-1111-1111-111111111111', 
     '51E-78901', 'truck_large', 5000, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. DRIVERS (Tài xế)
-- ============================================================================
INSERT INTO drivers (id, organization_id, user_id, driver_code, full_name, phone, is_active) VALUES
    ('66666666-6666-6666-6666-666666666661', '11111111-1111-1111-1111-111111111111', 
     'dddddddd-dddd-dddd-dddd-dddddddddddd',
     'DRV001', 'Phạm Văn Tài', '0901234567', true),
    ('66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111111', 
     'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
     'DRV002', 'Hoàng Thị Mai', '0912345678', true),
    ('66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111111', 
     'ffffffff-ffff-ffff-ffff-ffffffffffff',
     'DRV003', 'Võ Văn Hùng', '0923456789', true),
    ('66666666-6666-6666-6666-666666666664', '11111111-1111-1111-1111-111111111111', 
     NULL,
     'DRV004', 'Nguyễn Văn Minh', '0934567890', true),
    ('66666666-6666-6666-6666-666666666665', '11111111-1111-1111-1111-111111111111', 
     NULL,
     'DRV005', 'Trần Thị Lan', '0945678901', true),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 
     NULL,
     'DRV006', 'Lê Văn Đức', '0956789012', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 6. DRIVER WALLETS (Ví tài xế) - SKIPPED: table may not exist
-- ============================================================================
-- INSERT INTO driver_wallets (id, driver_id, organization_id, balance, cod_limit, is_locked) VALUES
--     ('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661', 
--      '11111111-1111-1111-1111-111111111111', 500000, 5000000, false),
--     ('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666662', 
--      '11111111-1111-1111-1111-111111111111', 1200000, 5000000, false),
--     ('77777777-7777-7777-7777-777777777773', '66666666-6666-6666-6666-666666666663', 
--      '11111111-1111-1111-1111-111111111111', -2500000, 5000000, false),
--     ('77777777-7777-7777-7777-777777777774', '66666666-6666-6666-6666-666666666664', 
--      '11111111-1111-1111-1111-111111111111', 0, 5000000, false),
--     ('77777777-7777-7777-7777-777777777775', '66666666-6666-6666-6666-666666666665', 
--      '11111111-1111-1111-1111-111111111111', 800000, 5000000, false)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 7. LOCATIONS (Địa điểm) - SKIPPED: table may not exist
-- ============================================================================
-- INSERT INTO locations (id, organization_id, name, address, latitude, longitude, location_type) VALUES ...
-- (Commented out to avoid errors)

-- ============================================================================
-- 8. ORDERS (Đơn hàng mẫu) - SKIPPED: may reference non-existent tables
-- ============================================================================
-- (Commented out to avoid errors)

-- ============================================================================
-- 9. DRIVER SCHEDULES - SKIPPED: table may not exist
-- ============================================================================
-- (Commented out to avoid errors)

-- ============================================================================
-- DONE! Basic sample data created for: organizations, users, vehicles, drivers
-- ============================================================================
-- Tables seeded: organizations, users, vehicles, drivers
-- Có thể chạy nhiều lần an toàn nhờ ON CONFLICT DO NOTHING
-- ============================================================================
