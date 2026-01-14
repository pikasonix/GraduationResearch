# ⚡ Quick Start - WAYO Driver App

Hướng dẫn nhanh để chạy app trong 5 phút.

---

## ✅ Checklist nhanh

- [ ] Đã cài Android Studio
- [ ] Đã có JDK 11+
- [ ] Clone project xong
- [ ] Tạo `local.properties` với API keys
- [ ] Có emulator hoặc physical device

---

## 🚀 3 bước chạy app

### 1️⃣ Tạo `local.properties`

Tạo file `mobile/local.properties`:

```properties
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-key-here
# Backend Node server mặc định chạy PORT=3001
# Android Emulator phải dùng 10.0.2.2 để trỏ về máy host
BACKEND_URL=http://10.0.2.2:3001
MAPBOX_ACCESS_TOKEN=pk.your-token-here
```

> 💡 **Tip:** Copy từ teammate hoặc dùng `.env` file nếu có

### 2️⃣ Sync Dependencies

```powershell
cd mobile
.\gradlew.bat --refresh-dependencies
```

### 3️⃣ Run trong Android Studio

1. **File → Open** → Chọn thư mục `mobile/`
2. Đợi Gradle sync
3. Chọn device/emulator
4. Click **Run** ▶️

> Nếu backend đang chạy local, bạn có thể sanity-check nhanh:
> - Host machine: `http://localhost:3001/api/mobile/health`
> - Emulator: `http://10.0.2.2:3001/api/mobile/health`

---

## 🧪 Test nhanh

```powershell
# Run all tests (2 phút)
.\gradlew.bat :app:testDebugUnitTest

# Build APK (30 giây)
.\gradlew.bat :app:assembleDebug
```

---

## ❌ Lỗi thường gặp

### "SDK location not found"

Thêm vào `local.properties`:
```properties
sdk.dir=C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

### "BuildConfig fields empty"

→ Kiểm tra API keys trong `local.properties`

### Build chậm

```powershell
.\gradlew.bat --stop
.\gradlew.bat clean
.\gradlew.bat :app:assembleDebug --no-daemon
```

---

## 📖 Đọc thêm

Chi tiết hơn → [SETUP.md](../SETUP.md)

Testing guide → [TEST_GUIDE.md](TEST_GUIDE.md)
