# 🧪 HƯỚNG DẪN TEST TỪNG BƯỚC - RE-OPTIMIZATION

## Tổng quan

Hệ thống re-optimization đã hoàn thiện với 3 tầng test:
1. **Unit Tests** - Test logic core (không cần database)
2. **API Tests** - Test endpoint REST API (cần backend server)
3. **Integration Tests** - Test với dữ liệu thật (cần database)

---

## ✅ Checklist Trước Khi Test

- [x] Backend code đã compile (TypeScript)
- [x] Unit tests đã pass
- [x] `.env` file có Supabase credentials
- [x] Backend server đang chạy (port 3001)
- [ ] Database có organization data (cần cho bước 3)

---

## 📋 BƯỚC 1: TEST UNIT TESTS

### Mục đích
Kiểm tra logic preprocessing và cleanup hoạt động đúng (không cần database/network)

### Cách chạy

```powershell
cd D:\CODE\WAYO\backend
.\test-step-1-unit-tests.ps1
```

**HOẶC chạy thủ công:**
```powershell
npx ts-node src/workers/test-reoptimization.ts
```

### Kết quả mong đợi

```
╔═══════════════════════════════════════════════════════╗
║   REOPTIMIZATION FUNCTIONALITY TEST SUITE            ║
╚═══════════════════════════════════════════════════════╝

=== Test 1: Preprocessing with 2 vehicles and 3 orders ===

✓ Preprocessing successful!
  - Total nodes: 9
  - Dummy nodes: 3
  - Dummy start nodes: 2
  - Ghost pickup nodes: 1
  - Vehicle capacity dimensions: 2
  - Initial routes: 2
✓ Ghost pickup validation passed

=== Test 2: Cleanup dummy nodes from solver output ===

✓ Cleanup successful!
  - Removed dummy nodes: 1
  - Removed ghost pickups: 1
  - Cleaned routes: 1

╔═══════════════════════════════════════════════════════╗
║   ✓ ALL TESTS PASSED                                 ║
╚═══════════════════════════════════════════════════════╝
```

### ✅ Nếu pass → Tiếp tục Bước 2
### ❌ Nếu fail → Fix lỗi trước khi tiếp tục

---

## 📋 BƯỚC 2: TEST BACKEND API

### Mục đích
Kiểm tra backend server và API endpoint `/reoptimize` hoạt động

### Tiên quyết
Backend server phải đang chạy:
```powershell
# Terminal 1
cd D:\CODE\WAYO\backend
npm run dev
```

### Cách chạy

```powershell
# Terminal 2 (mới)
cd D:\CODE\WAYO\backend
.\test-step-2-api.ps1
```

### Kết quả mong đợi

```
╔═══════════════════════════════════════════════════════╗
║  BƯỚC 2: TEST BACKEND SERVER & API ENDPOINT          ║
╚═══════════════════════════════════════════════════════╝

[2.1] Kiểm tra server health...
  ✓ Backend server đang chạy
  Port: 3001
  Queue size: 0
  Active jobs: 0

[2.2] Test reoptimization endpoint...
  ⚠ Expected error: Organization not found
    Endpoint hoạt động đúng!
    Cần organization ID thật để test tiếp

✓ BƯỚC 2 HOÀN THÀNH!
  Backend server hoạt động bình thường
  API endpoint /reoptimize sẵn sàng
```

### Test thủ công với curl

```bash
curl -X GET http://localhost:3001/api/jobs/stats

# Expected: {"success":true,"stats":{...}}
```

### ✅ Nếu pass → Tiếp tục Bước 3
### ❌ Nếu fail "Server not running" → Start backend server

---

## 📋 BƯỚC 3: TEST INTEGRATION (DỮ LIỆU THẬT)

### Mục đích
Test toàn bộ flow với dữ liệu thật từ database

### Tiên quyết

1. **Supabase đã configure** (có trong `.env`):
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   ```

2. **Database có data**:
   - Organizations table có ít nhất 1 organization
   - Organization đó có `depot_latitude`, `depot_longitude`
   - Có vehicles và orders (optional)

### Cách chạy

```powershell
cd D:\CODE\WAYO\backend
.\test-step-3-integration.ps1
```

Script sẽ hỏi bạn nhập `organization_id`:

```
[3.1] Lấy organization_id từ database...
  Mở Supabase Dashboard > SQL Editor và chạy:
    SELECT id, name FROM organizations LIMIT 5;

  Nhập organization_id (hoặc Enter để skip): 
```

### Lấy Organization ID

**Cách 1: Qua Supabase Dashboard**
1. Mở https://supabase.com/dashboard
2. Chọn project WAYO
3. Table Editor > `organizations` table
4. Copy `id` của organization bất kỳ

**Cách 2: Qua SQL Editor**
```sql
SELECT id, name, depot_latitude, depot_longitude 
FROM organizations 
WHERE depot_latitude IS NOT NULL
LIMIT 5;
```

Copy `id` và paste vào terminal.

### Kết quả mong đợi

```
[3.2] Test với organization_id: xxx-xxx-xxx

  Đang gửi request...
  ✓ Job submitted thành công!
    Job ID: yyy-yyy-yyy

  Preprocessing Stats:
    - Total nodes: 8
    - Dummy nodes: 1
    - Ghost pickups: 0
    - Active vehicles: 1

  Đang theo dõi job status...
    [1/30] Status: processing, Progress: 10%
    [2/30] Status: processing, Progress: 45%
    [3/30] Status: completed, Progress: 100%

  ✓ Job completed!
    Solution ID: zzz-zzz-zzz
    Persisted: true

✓ BƯỚC 3 HOÀN THÀNH!
  Integration test với real data thành công
```

### ✅ Nếu pass → ALL TESTS COMPLETE! 🎉
### ❌ Nếu fail → Xem Troubleshooting bên dưới

---

## 🐛 Troubleshooting

### Lỗi: "Organization not found"

**Nguyên nhân:** Organization ID không tồn tại trong database

**Giải pháp:**
1. Kiểm tra lại ID có đúng không
2. Hoặc tạo organization mới:
   ```sql
   INSERT INTO organizations (name, depot_latitude, depot_longitude, depot_address)
   VALUES ('Test Org', 10.762622, 106.660172, 'Test Address');
   ```

### Lỗi: "Organization missing depot information"

**Nguyên nhân:** Organization thiếu `depot_latitude` hoặc `depot_longitude`

**Giải pháp:**
```sql
UPDATE organizations 
SET depot_latitude = 10.762622, 
    depot_longitude = 106.660172,
    depot_address = 'Main Depot'
WHERE id = 'your-org-id';
```

### Lỗi: "Database not configured"

**Nguyên nhân:** File `.env` thiếu Supabase credentials

**Giải pháp:**
1. Mở `backend/.env`
2. Add hoặc update:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
3. Restart backend server

### Lỗi: "Backend server not running"

**Giải pháp:**
```powershell
cd D:\CODE\WAYO\backend
npm run dev
```

### Job status "failed"

**Nguyên nhân:** Có thể do:
- Solver binary không tồn tại
- Instance format không đúng
- Timeout

**Giải pháp:**
1. Check job error message:
   ```bash
   curl http://localhost:3001/api/jobs/{jobId}
   ```
2. Check backend terminal logs
3. Verify solver binary exists: `backend/bin/pdptw_solver.exe`

---

## 📊 Test Coverage Summary

| Test Level | Coverage | Status |
|------------|----------|--------|
| Unit Tests | Logic preprocessing & cleanup | ✅ PASS |
| API Tests | Endpoint availability | ✅ PASS |
| Integration | E2E with real data | ⏳ Pending real org data |

---

## 🎯 Next Steps

Sau khi tất cả tests pass:

1. **Frontend Integration** (chưa implement):
   - Add button "Tái tối ưu" trong dispatch-dynamic page
   - Query vehicle_tracking table
   - Call `solverService.reoptimizeRoutes()`

2. **Production Deployment**:
   - Deploy backend với environment variables
   - Monitor job queue performance
   - Set up logging and alerts

3. **Advanced Features**:
   - Real-time vehicle tracking
   - Automatic re-optimization triggers
   - Partial route locking

---

## 📚 Tài liệu chi tiết

- **Implementation Guide**: `docs/REOPTIMIZATION_IMPLEMENTATION.md`
- **Full Test Guide**: `backend/TEST_GUIDE.md`
- **API Documentation**: `docs/api/` (TODO)

---

**Tạo bởi:** AI Assistant  
**Ngày:** 2025-12-26  
**Version:** 1.0.0
