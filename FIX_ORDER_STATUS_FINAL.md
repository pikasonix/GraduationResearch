# FIX: Order Status Không Cập Nhật - GIẢI PHÁP CUỐI CÙNG

## VẤN ĐỀ ĐÃ XÁC ĐỊNH

Mobile app dùng **offline-first strategy**:
- Complete stop → Chỉ lưu local database
- Action được queue để sync SAU qua BackgroundWorker
- **API KHÔNG được gọi ngay** → Order status không update

## GIẢI PHÁP

Đã sửa `StopRepository.completeStop()` để:
1. ✅ Update local database (optimistic)
2. ✅ **GỌI API NGAY LẬP TỨC** (immediate sync)
3. ✅ Nếu thành công → update orders từ server response
4. ✅ Nếu thất bại → queue cho background sync

## FILES ĐÃ SỬA

### 1. Backend - [mobileRoutes.ts](d:\CODE\WAYO\backend\src\routes\mobileRoutes.ts)
✅ Đã thêm logic update order status khi complete stop

### 2. Mobile - [StopRepository.kt](d:\CODE\WAYO\mobile\app\src\main\java\com\pikasonix\wayo\data\repository\StopRepository.kt)
✅ Đã thêm immediate sync thay vì chỉ queue

### 3. Database - [Migration SQL](d:\CODE\WAYO\supabase\APPLY_MIGRATION_MANUALLY.sql)
⚠️ **CẦN APPLY VÀO SUPABASE**

## HƯỚNG DẪN TRIỂN KHAI

### BƯỚC 1: Apply Migration vào Supabase (BẮT BUỘC)

1. Mở **Supabase Dashboard**: https://supabase.com/dashboard
2. Chọn project → **SQL Editor**
3. Copy toàn bộ nội dung file: `supabase/APPLY_MIGRATION_MANUALLY.sql`
4. Paste và **Run**

**Kiểm tra:**
```sql
SELECT proname FROM pg_proc 
WHERE proname = 'update_order_status_on_stop_completion';
-- Phải có 1 kết quả trả về
```

### BƯỚC 2: Rebuild Mobile App (BẮT BUỘC)

```bash
cd mobile

# Clean build
./gradlew clean

# Build lại
./gradlew assembleDebug

# Hoặc trong Android Studio:
# Build → Clean Project
# Build → Rebuild Project
```

### BƯỚC 3: Restart Backend

Backend đã chạy rồi (port 3001) nhưng để chắc chắn:

```powershell
# Kiểm tra
Test-NetConnection localhost -Port 3001

# Nếu cần restart:
cd backend
npm run dev
```

### BƯỚC 4: Test

#### Test trên Mobile App:

1. **Uninstall app cũ** (để xóa local database cũ)
2. **Install app mới** từ APK vừa build
3. Đăng nhập → Chọn route
4. Click vào **pickup stop** → "Đã xong"
5. **Xem logcat** (phải thấy):
   ```
   StopRepository: ✅ Stop marked completed locally
   StopRepository: 📡 Attempting immediate sync to server...
   StopRepository: ✅ Successfully synced to server
   StopRepository: ✅ Updated order: xxx status=in_transit
   ```
6. **Kiểm tra web:** Order status phải = `in_transit` ✅

#### Test Delivery Stop:

1. Click vào **delivery stop** → "Đã xong"
2. **Xem logcat** (phải thấy status=completed)
3. **Kiểm tra web:** Order status phải = `completed` ✅

## LOGS ĐỂ DEBUG

### Logcat (Android Studio)

Filter: `StopRepository|MapViewModel|okhttp`

**Success logs:**
```
StopRepository: ✅ Stop marked completed locally: <stop-id>
StopRepository: 📡 Attempting immediate sync to server...
okhttp: --> POST http://192.168.0.105:3001/api/mobile/stops/<stop-id>/complete
okhttp: <-- 200 OK
StopRepository: ✅ Successfully synced to server
StopRepository: ✅ Updated order: <order-id> status=in_transit
```

**Offline/Error logs:**
```
StopRepository: ⚠️ Immediate sync failed: <error>, will queue for background sync
StopRepository: 📝 Queued for background sync
```

### Backend logs

Khi mobile gọi API, backend sẽ log:
```
POST /api/mobile/stops/:id/complete
→ Completing stop...
→ Checking order <order-id>
→ Pickup completed: true, Delivery completed: false
→ Updating order status to: in_transit
```

## TROUBLESHOOTING

### ❌ Vẫn không thấy API được gọi

**Kiểm tra:**
1. App có kết nối internet không?
2. Backend có đang chạy không? → http://localhost:3001/health
3. IP backend đúng không? → Check trong Constants.kt

**Sửa IP backend nếu cần:**
File: `mobile/app/src/main/java/com/pikasonix/wayo/utils/Constants.kt`
```kotlin
// Thay đổi IP nếu backend chạy ở máy khác
const val BASE_URL = "http://192.168.0.105:3001"
```

### ❌ API gọi nhưng order status không đổi

**Kiểm tra migration đã apply:**
```sql
-- Trong Supabase SQL Editor
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_update_order_status_on_stop_completion';

-- Phải có kết quả
```

**Nếu không có → Apply lại migration**

### ❌ Log hiển thị "Queued for background sync"

Nghĩa là immediate sync failed. Check:
1. Backend có chạy không?
2. Network có vấn đề không?
3. Auth token còn valid không?

## KẾT QUẢ MONG ĐỢI

**Khi complete pickup stop:**
- Mobile: Hiển thị "Đã đánh dấu hoàn thành"
- Logcat: Thấy logs sync success ✅
- Web: Order status = `in_transit` (refresh page)
- Database: `orders.status = 'in_transit'`, `orders.picked_up_at` có giá trị

**Khi complete delivery stop:**
- Mobile: Hiển thị "Đã đánh dấu hoàn thành"
- Logcat: Thấy logs sync success ✅
- Web: Order status = `completed` (refresh page)
- Database: `orders.status = 'completed'`, `orders.delivered_at` có giá trị

---

**Nếu vẫn lỗi sau khi làm theo hướng dẫn, gửi cho tôi:**
1. Logcat logs (filter: StopRepository)
2. Backend console logs
3. Screenshot web order status
