# Deployment Options Summary

## 🎯 Recommended: Keep Current Structure

**Kết luận**: Cấu trúc hiện tại (separate folders) là **TỐT NHẤT** cho deployment lên Render + Vercel.

---

## ✅ OPTION 1: Current Structure (RECOMMENDED)

### Structure

```
WAYO/
├── backend/     ← Deploy to Render (Root Directory: backend/)
├── frontend/    ← Deploy to Vercel (Root Directory: frontend/)
├── mobile/      ← Build APK locally, upload to Play Store
├── supabase/    ← Managed by Supabase Cloud
└── docs/        ← Documentation only (not deployed)
```

### Deployment Flow

```
┌────────────────┐
│  Git Push      │
│  (main branch) │
└────────┬───────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌──────────┐
│ Render  │ │  Vercel  │
│ watches │ │ watches  │
│ backend/│ │ frontend/│
└─────────┘ └──────────┘
```

### Pros ✅

- ✅ **Zero config changes**: Deploy như hiện tại
- ✅ **Auto-deploy**: Git push → Render/Vercel tự build & deploy
- ✅ **Independent scaling**: Scale FE/BE riêng biệt
- ✅ **Clear separation**: Mỗi service tự quản lý dependencies
- ✅ **Easy rollback**: Rollback từng service độc lập

### Cons ❌

- ❌ **No shared code**: Types phải duplicate giữa FE/BE (giải quyết bằng shared-types package sau)
- ❌ **Two repos or monorepo**: Nếu dùng monorepo, cần config root directory

### Configuration

#### Render (Backend)

```yaml
Name: wayo-backend
Environment: Node
Root Directory: backend          # ← KEY: Point to backend/
Build Command: npm install && npm run build
Start Command: npm start
```

#### Vercel (Frontend)

```yaml
Framework: Next.js (auto-detect)
Root Directory: frontend         # ← KEY: Point to frontend/
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**Environment Variables**: Set trong dashboard của từng platform

---

## 🔄 OPTION 2: Monorepo với Turborepo (Advanced)

### Structure (New)

```
WAYO/
├── apps/
│   ├── backend/      ← Render: Root = apps/backend
│   ├── web/          ← Vercel: Root = apps/web
│   └── mobile/
├── packages/
│   ├── shared-types/ ← Shared TypeScript types
│   └── utils/        ← Shared utilities
├── turbo.json
└── package.json      ← Root workspace
```

### Deployment Config

#### Turborepo Config (`turbo.json`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

#### Render

```yaml
Root Directory: apps/backend
Build Command: cd ../.. && npm install && npm run build --filter=backend
Start Command: cd apps/backend && npm start
```

#### Vercel

```yaml
Root Directory: apps/web
Build Command: cd ../.. && npm install && turbo run build --filter=web
Output Directory: apps/web/.next
```

### Pros ✅

- ✅ **Shared code**: `packages/shared-types` dùng chung
- ✅ **Single repo**: Dễ manage versions
- ✅ **Optimized builds**: Turborepo cache builds

### Cons ❌

- ❌ **Complex setup**: Cần config Turborepo, workspace
- ❌ **Deployment complexity**: Build commands dài hơn
- ❌ **Learning curve**: Team cần học Turborepo
- ❌ **Migration effort**: Tốn thời gian migrate

---

## 📊 Comparison Table

| Aspect | Option 1 (Current) | Option 2 (Monorepo) |
|--------|-------------------|---------------------|
| **Setup Complexity** | ⭐ Very Simple | ⭐⭐⭐ Complex |
| **Deployment** | ⭐⭐⭐ Auto | ⭐⭐ Needs config |
| **Shared Code** | ❌ Duplicate types | ✅ Shared packages |
| **Build Speed** | ⭐⭐ Normal | ⭐⭐⭐ Cached |
| **Maintenance** | ⭐⭐⭐ Easy | ⭐⭐ Moderate |
| **Migration Cost** | ✅ Zero | ❌ High (1-2 weeks) |

---

## 🎯 Decision Matrix

### Chọn Option 1 (Current) nếu:

- ✅ Team nhỏ (1-3 người)
- ✅ Cần deploy nhanh (ngay bây giờ)
- ✅ Chưa có nhiều shared code
- ✅ Muốn đơn giản, dễ maintain

### Chọn Option 2 (Monorepo) nếu:

- ✅ Team lớn (5+ người)
- ✅ Có nhiều shared types/utils
- ✅ Cần optimize build pipeline
- ✅ Có thời gian migrate (1-2 tuần)

---

## ✨ Recommended Approach

### Phase 1: Keep Current Structure (NOW)

```bash
# 1. Add docs/ for AI
mkdir docs/
# (already done)

# 2. Deploy as-is
git push

# 3. Configure Render
# Root Directory: backend

# 4. Configure Vercel
# Root Directory: frontend
```

### Phase 2: Add Shared Types (Later, if needed)

```bash
# Create shared package
mkdir -p packages/shared-types
cd packages/shared-types
npm init -y

# Move types
# backend/src/types/index.ts → packages/shared-types/src/
# frontend/src/utils/dataModels.ts → packages/shared-types/src/

# Use in backend
# npm install ../packages/shared-types

# Use in frontend
# npm install ../packages/shared-types
```

### Phase 3: Migrate to Monorepo (Optional, 3-6 months later)

Khi:
- Shared code > 30% codebase
- Team > 5 người
- Cần optimize CI/CD

---

## 🚀 Deployment Checklist (Current Structure)

### Pre-deployment

- [x] ✅ Cấu trúc folders đã có: `backend/`, `frontend/`, `supabase/`
- [x] ✅ Thêm `docs/` cho AI
- [ ] Build C++ solver: `cd backend/pdptw_solver_module && build_and_test.bat`
- [ ] Copy solver: `cp build/.../pdptw_solver.exe backend/bin/`
- [ ] Commit solver: `git add backend/bin/pdptw_solver.exe`
- [ ] Create `.env.example` files

### Backend (Render)

- [ ] Create Web Service on Render
- [ ] Set Root Directory: `backend`
- [ ] Set Build Command: `npm install && npm run build`
- [ ] Set Start Command: `npm start`
- [ ] Add environment variables:
  - `NODE_ENV=production`
  - `PORT=10000`
  - `CORS_ORIGIN=https://your-frontend.vercel.app`
  - `PDPTW_SOLVER_PATH=/app/bin/pdptw_solver.exe`
- [ ] Deploy & verify `/health` endpoint

### Frontend (Vercel)

- [ ] Import project from GitHub
- [ ] Set Root Directory: `frontend`
- [ ] Framework: Next.js (auto-detect)
- [ ] Add environment variables:
  - `NEXT_PUBLIC_API_URL=https://wayo-backend.onrender.com`
  - `NEXT_PUBLIC_SUPABASE_URL=...`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
  - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=...`
- [ ] Deploy & test

### Post-deployment

- [ ] Test full flow: Create instance → Submit → View result
- [ ] Verify CORS works
- [ ] Check logs for errors
- [ ] Set up monitoring

---

## 🔗 References

- [Full Deployment Guide](../guides/deployment.md)
- [Architecture Overview](./overview.md)
- [Turborepo Docs](https://turbo.build/repo/docs) (if migrating to monorepo)

---

## ❓ FAQs

### Q: Cấu trúc hiện tại có ảnh hưởng deployment không?

**A**: **KHÔNG**. Cấu trúc hiện tại (folders riêng biệt) là hoàn hảo cho Render + Vercel. Chỉ cần set **Root Directory** đúng.

### Q: Có cần tổ chức lại thành monorepo không?

**A**: **KHÔNG CẦN** ngay bây giờ. Chỉ cần khi:
- Shared code > 30%
- Team lớn (5+ người)
- Cần optimize builds

### Q: Có cần move `backend/` và `frontend/` vào `services/` không?

**A**: **KHÔNG**. Giữ nguyên cấu trúc hiện tại. Chỉ thêm `docs/` là đủ.

### Q: Nếu sau này muốn chuyển sang monorepo thì sao?

**A**: Migrate từ từ:
1. Giữ nguyên deployment (vẫn deploy từ `backend/` và `frontend/`)
2. Tạo `packages/shared-types` dần dần
3. Khi shared code đủ nhiều, mới setup Turborepo
4. Update deployment configs

---

**Recommendation**: **Giữ nguyên cấu trúc hiện tại, chỉ thêm `docs/` và deploy ngay!**
