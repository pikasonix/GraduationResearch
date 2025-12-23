# Báo cáo Kiểm tra Login/Signup và Cấu hình Supabase

## Ngày: 19/12/2025

---

## 1. TÌNH TRẠNG HIỆN TẠI

### 1.1. Login/Signup Frontend ✅

#### Signup Page (`frontend/src/app/signup/page.tsx`)
- **Đã cấu hình:** ✅ Chỉ có Google OAuth signup
- **UI:** Chỉ hiển thị nút "Đăng ký bằng Google", không có form đăng ký thủ công
- **Redirect:** Sau khi đăng ký thành công → `/profile`
- **State:** Sử dụng RTK Query hook `useSignupMutation` (nhưng không được dùng vì không có form)

#### Login Page (`frontend/src/app/login/page.tsx`)
- **Đã cấu hình:** ✅ Có cả email/password và Google OAuth
- **UI:** 
  - Form email/password đầy đủ
  - Nút "Đăng nhập bằng Google"
  - Remember me checkbox
  - Forgot password link
- **Redirect:** Sau khi đăng nhập thành công → `/profile`
- **Error handling:** Hiển thị lỗi khi sai email/password

#### Auth Service (`frontend/src/lib/redux/services/auth.ts`)
- **Login:** ✅ Sử dụng `supabase.auth.signInWithPassword()`
- **Signup:** ✅ Sử dụng `supabase.auth.signUp()` (nhưng không được dùng vì UI chỉ có Google OAuth)
- **OAuth:** ✅ Sử dụng `supabase.auth.signInWithOAuth()` cho Google
- **Logout:** ✅ Sử dụng `supabase.auth.signOut()`

### 1.2. Supabase Config ✅

#### Config File (`supabase/supabase/config.toml`)
```toml
[auth]
enable_signup = true                    # ✅ Cho phép đăng ký
enable_anonymous_sign_ins = false       # ✅ Không cho phép anonymous

[auth.email]
enable_signup = true                    # ✅ Cho phép đăng ký qua email
enable_confirmations = false            # ✅ KHÔNG yêu cầu xác nhận email (quan trọng!)
double_confirm_changes = true
minimum_password_length = 6

[auth.sms]
enable_signup = false                   # ✅ Không cho phép đăng ký qua SMS
```

### 1.3. Database Schema ✅

#### Bảng `public.users`
```sql
- id (uuid, PK) - Liên kết với auth.users.id
- organization_id (uuid, FK → organizations.id) - BẮT BUỘC
- username (varchar, unique)
- email (varchar, unique)
- password_hash (varchar) - KHÔNG SỬ DỤNG (auth.users quản lý)
- full_name (varchar)
- phone (varchar)
- role (user_role enum)
- is_active (boolean)
- created_at, updated_at
```

#### Bảng `public.organizations`
```sql
- id (uuid, PK)
- name (varchar)
- account_type (enum: 'enterprise', 'individual')
- contact_email (varchar)
- contact_phone (varchar)
- address (text)
- is_active (boolean)
- created_at, updated_at
```

---

## 2. VẤN ĐỀ PHÁT HIỆN ❌

### 2.1. THIẾU TRIGGER TỰ ĐỘNG TẠO USER ❌❌❌

**Hiện tại:**
- Khi user đăng ký qua Google OAuth hoặc email/password
- Chỉ tạo record trong `auth.users` (bảng Supabase Auth)
- **KHÔNG** tự động tạo record trong `public.users` và `public.organizations`

**Hậu quả:**
1. User đăng ký thành công nhưng không có data trong `public.users`
2. Không có organization được tạo
3. App sẽ crash hoặc lỗi khi truy cập `/profile` vì không tìm thấy user data
4. Tất cả các query/mutation liên quan đến user sẽ fail

### 2.2. Signup Page Thiếu Form Thủ Công

**Hiện tại:**
- Page chỉ có nút Google OAuth
- Không có form email/password signup
- RTK Query hook `useSignupMutation` không được sử dụng

**Vấn đề:**
- User không thể đăng ký bằng email/password
- Chỉ phụ thuộc vào Google OAuth (single point of failure)

---

## 3. GIẢI PHÁP ĐÃ THỰC HIỆN ✅

### 3.1. Tạo Migration Trigger Auto-create User

**File:** `supabase/supabase/migrations/20251219000000_handle_new_user.sql`

**Chức năng:**
```sql
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Tạo organization mới cho user
  INSERT INTO public.organizations (
    name,
    account_type,
    contact_email,
    is_active
  ) VALUES (
    user_full_name || 's Organization',
    'individual',
    user_email,
    true
  );

  -- 2. Tạo user record trong public.users
  INSERT INTO public.users (
    id,              -- Sử dụng CÙNG ID với auth.users
    organization_id,
    username,
    email,
    full_name,
    phone,
    role,
    is_active
  ) VALUES (...);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Khi nào trigger chạy:**
- ✅ Khi user đăng ký bằng email/password (`supabase.auth.signUp()`)
- ✅ Khi user đăng ký lần đầu bằng Google OAuth
- ✅ Tự động, không cần code frontend

**Data được tạo:**
1. **Organization:**
   - Name: "John Doe's Organization" (từ full_name hoặc email)
   - Type: 'individual'
   - Contact email: user email

2. **User:**
   - ID: Cùng ID với auth.users (UUID)
   - Organization: Link đến org vừa tạo
   - Username: Từ email (phần trước @)
   - Email: Email của user
   - Full name: Từ metadata (Google) hoặc email
   - Phone: Từ metadata nếu có
   - Role: 'user'

---

## 4. CÁCH DEPLOY MIGRATION

### 4.1. Local Development (Supabase CLI)
```bash
cd supabase
supabase db reset  # Reset DB và apply tất cả migrations
# hoặc
supabase migration up  # Apply migrations mới
```

### 4.2. Production (Supabase Dashboard)
1. Vào Supabase Dashboard → SQL Editor
2. Copy nội dung file `20251219000000_handle_new_user.sql`
3. Paste và Run
4. Verify: Check trigger đã được tạo:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

---

## 5. TESTING CHECKLIST

### 5.1. Test Google OAuth Signup
```
1. Vào /signup
2. Click "Đăng ký bằng Google"
3. Chọn Google account
4. Sau khi redirect về /profile:
   - Kiểm tra auth.users có record
   - Kiểm tra public.users có record (cùng ID)
   - Kiểm tra public.organizations có record
   - organization_id trong users trỏ đúng org
```

### 5.2. Test Google OAuth Login (Existing User)
```
1. User đã có account
2. Vào /login
3. Click "Đăng nhập bằng Google"
4. Không tạo duplicate organization/user
5. Redirect về /profile thành công
```

### 5.3. Test Email/Password Signup (Nếu thêm form)
```
1. Fill form email/password/phone
2. Submit
3. Check email confirmation (nếu bật)
4. Verify trigger tạo org + user
```

### 5.4. Test Email/Password Login
```
1. Vào /login
2. Nhập email/password
3. Click "Đăng nhập"
4. Redirect về /profile
5. Verify session và user data
```

---

## 6. KHUYẾN NGHỊ

### 6.1. BẮT BUỘC (Critical) ⚠️
1. **Deploy migration ngay lập tức** - Không có trigger = app không hoạt động
2. **Test signup flow** sau khi deploy migration
3. **Xóa test users** cũ không có org/user data

### 6.2. NÊN LÀM (Recommended) 📋
1. **Thêm form email/password signup** vào `/signup` page
2. **Thêm validation email** khi signup (set `enable_confirmations = true`)
3. **Thêm RLS policies** cho bảng users/organizations:
   ```sql
   -- User chỉ xem được data của mình
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own data"
     ON public.users FOR SELECT
     USING (auth.uid() = id);
   ```

### 6.3. TỐT HƠN (Nice to have) ✨
1. **Profile completion flow** - Sau signup redirect đến page điền thêm thông tin
2. **Email verification** - Gửi email xác nhận sau signup
3. **Phone number collection** - Thu thập SĐT khi signup bằng Google
4. **Organization setup wizard** - Cho user setup org info sau khi đăng ký

---

## 7. CẤU TRÚC FILE QUAN TRỌNG

```
frontend/
├── src/
│   ├── app/
│   │   ├── login/page.tsx          ✅ Có email/password + Google OAuth
│   │   ├── signup/page.tsx         ⚠️ Chỉ có Google OAuth
│   │   └── profile/page.tsx        ⚠️ Cần verify user data tồn tại
│   ├── lib/redux/services/
│   │   └── auth.ts                 ✅ Auth service RTK Query
│   └── supabase/
│       └── client.ts               ✅ Supabase client config

supabase/supabase/
├── config.toml                     ✅ Auth config
└── migrations/
    ├── 20251218095933_remote_schema.sql  ✅ Schema chính
    └── 20251219000000_handle_new_user.sql ✅✅ TRIGGER MỚI (CRITICAL)
```

---

## 8. TÓM TẮT

### ✅ ĐÃ CÓ
- Login page đầy đủ (email/password + Google)
- Google OAuth signup
- Supabase config đúng
- Database schema đầy đủ
- Auth service RTK Query

### ❌ ĐANG THIẾU (ĐÃ FIX)
- ✅ **Trigger tự động tạo organization + user** → ĐÃ TẠO MIGRATION
- ⚠️ Form signup email/password → CẦN BỔ SUNG (Optional)

### 🚀 NEXT STEPS
1. Deploy migration `20251219000000_handle_new_user.sql`
2. Test signup flow (Google OAuth)
3. Verify org + user được tạo tự động
4. (Optional) Thêm form signup thủ công
5. (Optional) Bật email confirmation
6. (Optional) Thêm RLS policies

---

**Prepared by:** AI Assistant  
**Date:** 2025-12-19  
**Status:** ✅ Migration ready to deploy
