# 🚀 Quick Start - Test Re-optimization

## Chạy Nhanh (Tất Cả Tests)

```powershell
cd D:\CODE\WAYO\backend
.\run-all-tests.ps1
```

Hoặc skip integration test (không cần database):
```powershell
.\run-all-tests.ps1 -SkipIntegration
```

## Chạy Từng Bước

### Bước 1: Unit Tests (Không cần gì)
```powershell
.\test-step-1-unit-tests.ps1
```

### Bước 2: API Tests (Cần backend server chạy)
```powershell
# Terminal 1: Start server
npm run dev

# Terminal 2: Run test
.\test-step-2-api.ps1
```

### Bước 3: Integration Tests (Cần database)
```powershell
.\test-step-3-integration.ps1
```

## 📖 Hướng Dẫn Chi Tiết

Xem file `STEP_BY_STEP_TEST.md` cho:
- Giải thích từng test
- Kết quả mong đợi
- Troubleshooting guide
- Cách lấy organization_id từ database

## ✅ Checklist

- [x] Backend đã compile (TypeScript OK)
- [x] Unit tests PASS
- [x] `.env` có Supabase credentials
- [x] Backend server chạy (port 3001)
- [ ] Database có organization với depot (cần cho bước 3)

## 🎯 Kết Quả Mong Đợi

```
╔═══════════════════════════════════════════════════════╗
║   ✓ TEST SUITE COMPLETED SUCCESSFULLY!                ║
╚═══════════════════════════════════════════════════════╝

Summary:
  ✓ Unit Tests: PASSED
  ✓ API Tests: PASSED
  ✓ Integration Tests: COMPLETED
```

## 🐛 Lỗi Thường Gặp

| Lỗi | Giải pháp |
|------|-----------|
| Server not running | `npm run dev` |
| Organization not found | Nhập org ID đúng hoặc tạo mới |
| Database not configured | Check `.env` có `SUPABASE_URL` |

## 📚 Tài Liệu Đầy Đủ

- `STEP_BY_STEP_TEST.md` - Hướng dẫn chi tiết từng bước
- `TEST_GUIDE.md` - Test cases và troubleshooting
- `../docs/REOPTIMIZATION_IMPLEMENTATION.md` - Architecture docs
