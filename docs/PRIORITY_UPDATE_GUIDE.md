# Hướng dẫn cập nhật Priority Levels

## Thay đổi đã thực hiện

### 1. Database Migration
Đã tạo file migration: `supabase/migrations/20251224000001_update_priority_to_two_levels.sql`

**Chạy migration:**
```bash
cd supabase
supabase db push
```

Hoặc chạy trực tiếp SQL trong Supabase Dashboard.

### 2. Code Changes

#### Frontend
- ✅ `orderApi.ts` - Cập nhật type `PriorityLevel` từ 4 cấp → 2 cấp (normal, urgent)
- ✅ `OrderForm.tsx` - Cập nhật dropdown chỉ hiển thị "Thường" và "Hoả tốc"
- ✅ `OrdersTable.tsx` - Cập nhật helper functions `getPriorityColor` và `getPriorityLabel`
- ✅ `OrdersStats.tsx` - Cập nhật logic thống kê và UI mới (card-based layout)
- ✅ `orders/page.tsx` - Xoá tab "Mẫu đơn hàng" và cải thiện layout

#### UI Improvements
- **Xoá tabs không cần thiết**: Tab "Mẫu đơn hàng" đã bị xoá
- **Thống kê mới**: Hiện thị dạng cards với icons và màu sắc theo từng trạng thái
- **Layout cải tiến**: Header đơn giản hơn, stats nổi bật hơn

### 3. Priority Levels

**Trước:**
- low (Thấp)
- normal (Bình thường)  
- high (Cao)
- urgent (Khẩn cấp)

**Sau:**
- normal (Thường) - Màu xanh
- urgent (Hoả tốc) - Màu đỏ

### 4. Data Migration
Migration sẽ tự động chuyển đổi:
- `low`, `normal` → `normal`
- `high`, `urgent` → `urgent`

## Kiểm tra sau khi cập nhật

1. ✅ Chạy migration thành công
2. ✅ Tạo đơn hàng mới chỉ có 2 lựa chọn priority
3. ✅ Đơn hàng cũ vẫn hiển thị đúng sau khi convert
4. ✅ Statistics hiển thị đúng số lượng "Hoả tốc"
5. ✅ Bảng orders hiển thị badge priority đúng màu sắc

## Rollback (nếu cần)

Nếu cần rollback, tạo migration mới:
```sql
-- Recreate old enum
CREATE TYPE public.priority_level_old AS ENUM ('low', 'normal', 'high', 'urgent');

ALTER TABLE public.orders 
    ALTER COLUMN priority TYPE public.priority_level_old 
    USING priority::text::public.priority_level_old;

DROP TYPE public.priority_level;
ALTER TYPE public.priority_level_old RENAME TO priority_level;
```
