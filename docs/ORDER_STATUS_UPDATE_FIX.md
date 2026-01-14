# Cập nhật Logic Trạng thái Order - 14/01/2026

## Tổng quan

Đã sửa lỗi logic cập nhật trạng thái order và cải thiện UI hiển thị danh sách điểm trên mobile app.

## Các thay đổi chính

### 1. UI - Hiển thị thông tin điểm rõ ràng hơn

**File thay đổi:** `mobile/app/src/main/res/layout/item_map_stop.xml`

**Cải thiện:**
- ✅ Tăng chiều rộng card từ 140dp → 180dp
- ✅ Tăng padding từ 12dp → 16dp
- ✅ Tăng kích thước font và icon cho dễ đọc
- ✅ Cải thiện spacing giữa các phần tử
- ✅ Hiển thị đầy đủ địa chỉ với 3 dòng

### 2. Logic trạng thái Order

**Vấn đề cũ:**
- Khi driver đánh dấu hoàn thành 1 stop (pickup hoặc delivery), order status không được cập nhật đúng

**Logic mới:**
- Order chỉ `completed` khi **CẢ 2 stops** (pickup VÀ delivery) đều `is_completed = true`
- Khi chỉ pickup completed → order status = `in_transit`
- Khi cả pickup và delivery completed → order status = `completed`

### 3. Các file đã sửa

#### Backend API (`backend/src/routes/mobileRoutes.ts`)

**Endpoint: POST `/stops/:id/complete`**
- Thêm logic kiểm tra tất cả stops của order
- Tự động cập nhật order status dựa trên stop completion

**Endpoint: POST `/sync/outbox`**
- Cập nhật logic tương tự cho offline sync

#### Database Trigger (`supabase/migrations/20260114_auto_update_order_status_on_stop_completion.sql`)

Tạo trigger tự động trong Supabase:
- Function: `update_order_status_on_stop_completion()`
- Trigger: `trigger_update_order_status_on_stop_completion`
- Tự động cập nhật order status khi stop được complete

## Hướng dẫn triển khai

### ⚠️ LƯU Ý QUAN TRỌNG

**VẤN ĐỀ:** Nếu sau khi complete stop mà order status không đổi, có nghĩa là:
1. ❌ Migration chưa được apply vào database
2. ❌ Backend chưa được restart sau khi sửa code

### Bước 1: Apply Database Migration (BẮT BUỘC)

**Cách 1: Chạy SQL trực tiếp trong Supabase Dashboard (KHUYẾN NGHỊ)**

1. Mở [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Click vào **SQL Editor** (biểu tượng Database ở sidebar trái)
4. Mở file: `supabase/APPLY_MIGRATION_MANUALLY.sql`
5. Copy **TOÀN BỘ** nội dung và paste vào SQL Editor
6. Click **Run** (hoặc Ctrl+Enter)
7. Đợi cho đến khi thấy "Success" ✅

**Kiểm tra migration đã apply thành công:**
```sql
-- Chạy query này trong SQL Editor để kiểm tra
SELECT proname FROM pg_proc WHERE proname = 'update_order_status_on_stop_completion';
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_update_order_status_on_stop_completion';

-- Nếu có kết quả trả về → Migration đã apply thành công
```

**Cách 2: Dùng Supabase CLI (nếu CLI đã setup)**

```bash
cd supabase
supabase db push
```

### Bước 2: Restart Backend (BẮT BUỘC)

Backend cần được restart để load code mới:

**Windows:**
```bash
# Dừng process node đang chạy (nếu có)
# Ctrl+C trong terminal đang chạy npm run dev

# Hoặc dùng PowerShell:
Get-Process -Name node | Stop-Process -Force

# Khởi động lại
cd backend
npm run dev
```

**Linux/Mac:**
```bash
# Dừng process
pkill -f "npm run dev"

# Khởi động lại
cd backend
npm run dev
```

**Kiểm tra backend đã chạy:**
- Terminal phải hiển thị: `PDPTW Solver Backend Server` và `URL: http://0.0.0.0:3001`
- Mở browser: http://localhost:3001/health (phải trả về status OK)

### Bước 3: Build lại Mobile App

```bash
cd mobile
# Android
./gradlew assembleDebug

# Hoặc build trong Android Studio
```

## Kiểm tra

### Test Case 1: Complete Pickup Stop
1. Driver mở app, xem route với stops
2. Click vào pickup stop → Complete
3. **Kết quả mong đợi:**
   - Stop status = `completed`
   - Order status = `in_transit` (chưa phải completed)

### Test Case 2: Complete Delivery Stop (sau khi pickup đã done)
1. Driver complete delivery stop
2. **Kết quả mong đợi:**
   - Stop status = `completed`
   - Order status = `completed` (cả 2 stops đều done)
   - `delivered_at` được cập nhật

### Test Case 3: UI Display
1. Mở map view
2. Xem danh sách điểm ở bottom
3. **Kết quả mong đợi:**
   - Thông tin điểm hiển thị rõ ràng
   - Địa chỉ đầy đủ
   - Badge status dễ nhìn
   - Card rộng hơn, dễ tap

## Lợi ích

✅ **Chính xác:** Order chỉ completed khi cả pickup VÀ delivery hoàn thành
✅ **Tự động:** Database trigger đảm bảo consistency
✅ **Trực quan:** UI cải thiện, driver dễ theo dõi
✅ **Offline-ready:** Logic áp dụng cho cả online và offline sync

## Troubleshooting

### ❌ Vấn đề: Order status không thay đổi sau khi complete stop

**Triệu chứng:**
- Mobile app: Click "Đã xong" trên stop
- Web: Order vẫn hiển thị "assigned" hoặc "pending"
- Không chuyển thành "in_transit" hoặc "completed"

**Nguyên nhân và giải pháp:**

#### 1. Migration chưa được apply ❌

**Kiểm tra:**
```sql
-- Chạy trong Supabase SQL Editor
SELECT proname FROM pg_proc 
WHERE proname = 'update_order_status_on_stop_completion';
```

**Nếu không có kết quả:**
- ➡️ Migration chưa apply
- ➡️ Làm lại **Bước 1** (Apply Migration)

#### 2. Backend chưa restart ❌

**Kiểm tra:**
- Mở http://localhost:3001/health
- Nếu không kết nối được → Backend không chạy

**Giải pháp:**
```bash
cd backend
npm run dev
```

#### 3. Mobile app chưa sync ❌

**Giải pháp:**
- Đóng và mở lại app
- Pull to refresh ở màn hình routes
- Kiểm tra kết nối internet

#### 4. Stop không thuộc về order đúng ❌

**Kiểm tra trong Supabase:**
```sql
-- Xem stops của một order
SELECT rs.id, rs.stop_type, rs.is_completed, rs.order_id
FROM route_stops rs
WHERE rs.order_id = '<your_order_id>';

-- Phải có 2 stops: 1 pickup + 1 delivery
```

### ❌ Lỗi: supabase db push failed

### ❌ Lỗi: supabase db push failed

**Giải pháp:**
- Dùng **Cách 1** (chạy SQL trực tiếp trong Dashboard) thay vì CLI
- File SQL đã chuẩn bị: `supabase/APPLY_MIGRATION_MANUALLY.sql`

### ✅ Test để xác nhận đã fix

**Test Case đầy đủ:**

1. **Chuẩn bị:**
   - Đảm bảo migration đã apply (check bằng SQL ở trên)
   - Đảm bảo backend đang chạy (check http://localhost:3001/health)

2. **Test Pickup Stop:**
   ```
   Mobile: Click vào pickup stop → "Đã xong"
   Web: Reload page
   Expected: Order status = "in_transit" ✅
   ```

3. **Test Delivery Stop:**
   ```
   Mobile: Click vào delivery stop → "Đã xong"
   Web: Reload page
   Expected: Order status = "completed" ✅
   ```

4. **Check database trực tiếp:**
   ```sql
   -- Xem order status
   SELECT id, tracking_number, status, picked_up_at, delivered_at
   FROM orders
   WHERE id = '<your_order_id>';
   
   -- Xem stops completion
   SELECT id, stop_type, is_completed
   FROM route_stops
   WHERE order_id = '<your_order_id>';
   ```

### 🔍 Debug với Backend Logs

Khi complete một stop, backend sẽ log:
```
POST /api/mobile/stops/:id/complete
→ Checking order stops...
→ Pickup completed: true/false
→ Delivery completed: true/false
→ Updating order status to: in_transit/completed
```

Nếu không thấy logs này → API không được gọi từ mobile

### Nếu order status không tự động cập nhật

1. **Kiểm tra trigger đã được tạo:**
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_order_status_on_stop_completion';
```

2. **Kiểm tra function:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'update_order_status_on_stop_completion';
```

3. **Test manually:**
```sql
-- Complete một pickup stop
UPDATE route_stops 
SET is_completed = true, actual_arrival_time = NOW()
WHERE id = '<stop_id>' AND stop_type = 'pickup';

-- Check order status
SELECT id, status, picked_up_at FROM orders WHERE id = '<order_id>';
```

### Nếu UI không hiển thị đúng

1. Clean build mobile app:
```bash
cd mobile
./gradlew clean
./gradlew assembleDebug
```

2. Kiểm tra resource đã sync:
   - Menu → Build → Clean Project
   - Menu → Build → Rebuild Project

## Notes

- Migration là **idempotent**, có thể chạy nhiều lần an toàn
- Backend có fallback: nếu trigger chưa có, API vẫn xử lý đúng logic
- Mobile UI thay đổi layout, cần rebuild app hoàn toàn

---

**Người thực hiện:** GitHub Copilot  
**Ngày:** 14/01/2026
