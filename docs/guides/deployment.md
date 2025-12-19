# Deployment Guide

Hướng dẫn deploy hệ thống WAYO lên production.

## 🏗️ Kiến trúc Deployment

```
Frontend (Vercel)  ←→  Backend (Render)  ←→  Supabase (Cloud)
    Next.js              Node.js + C++         PostgreSQL
```

---

## 🚀 Backend Deployment (Render)

### Prerequisites

1. **GitHub Repository** với code backend
2. **Render Account** (https://render.com)
3. **Build C++ Solver** trước khi deploy

### Step 1: Chuẩn bị Backend

#### 1.1. Build C++ Solver trên Windows

```bash
cd backend/pdptw_solver_module
./build_and_test.bat
```

Sau khi build, copy file `pdptw_solver.exe`:

```bash
# Copy solver vào thư mục bin
mkdir -p backend/bin
cp pdptw_solver_module/build/apps/Release/pdptw_solver.exe backend/bin/
```

#### 1.2. Thêm solver vào Git

Tạo/sửa `backend/.gitignore`:

```gitignore
# Node
node_modules/
dist/
*.log

# Environment
.env
.env.local

# Storage
storage/temp/*
!storage/temp/.gitkeep

# Build artifacts (KEEP bin/)
# bin/  # ← Bỏ comment này để commit solver.exe
```

**Commit solver:**

```bash
git add backend/bin/pdptw_solver.exe
git commit -m "Add compiled PDPTW solver"
git push
```

> ⚠️ **Lưu ý**: File .exe ~5-10MB, đảm bảo GitHub repository cho phép file size này.

### Step 2: Deploy lên Render

#### 2.1. Tạo Web Service mới

1. Đăng nhập Render → **New** → **Web Service**
2. Connect GitHub repository
3. Chọn branch `main` (hoặc `production`)

#### 2.2. Cấu hình Build & Deploy

**Basic Settings:**

```yaml
Name: wayo-backend
Environment: Node
Region: Singapore (hoặc gần nhất)
Branch: main
Root Directory: backend        # ← QUAN TRỌNG
```

**Build Command:**

```bash
npm install && npm run build
```

**Start Command:**

```bash
npm start
```

**Instance Type:**

- **Development**: Free tier (512MB RAM)
- **Production**: Starter ($7/month, 512MB RAM) hoặc Standard (2GB RAM)

> ⚠️ **C++ Solver cần RAM**: Instance ít nhất 512MB, khuyên dùng 1-2GB cho instances lớn.

#### 2.3. Environment Variables

Thêm trong Render dashboard → Environment:

```bash
# Server Config
NODE_ENV=production
PORT=10000              # Render default port
HOST=0.0.0.0

# CORS
CORS_ORIGIN=https://your-frontend.vercel.app

# Solver
PDPTW_SOLVER_PATH=/app/bin/pdptw_solver.exe

# Queue Settings
MAX_QUEUE_SIZE=50
JOB_TIMEOUT=600000      # 10 minutes
CLEANUP_INTERVAL=300000
MAX_JOB_AGE=86400000

# File Size
MAX_FILE_SIZE=10mb
```

#### 2.4. Deploy

Click **Create Web Service** → Render sẽ:

1. Pull code từ GitHub
2. Run `npm install && npm run build`
3. Start server với `npm start`
4. Expose tại `https://wayo-backend.onrender.com`

### Step 3: Verify Backend

Test endpoints:

```bash
# Health check
curl https://wayo-backend.onrender.com/health

# Submit job
curl -X POST https://wayo-backend.onrender.com/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{"instance": "...", "params": {...}}'
```

---

## 🌐 Frontend Deployment (Vercel)

### Prerequisites

1. **GitHub Repository**
2. **Vercel Account** (https://vercel.com)
3. **Supabase Project**

### Step 1: Cấu hình Frontend

#### 1.1. Environment Variables

Tạo `frontend/.env.production`:

```bash
# Backend API
NEXT_PUBLIC_API_URL=https://wayo-backend.onrender.com
NEXT_PUBLIC_API_BASE_PATH=/api

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
NEXT_PUBLIC_MAPBOX_STYLE=mapbox://styles/mapbox/streets-v12

# Map Config
NEXT_PUBLIC_DEFAULT_CENTER_LAT=21.0227
NEXT_PUBLIC_DEFAULT_CENTER_LNG=105.8194
NEXT_PUBLIC_DEFAULT_ZOOM=12
```

> ⚠️ **Không commit file này!** Sẽ set trong Vercel dashboard.

### Step 2: Deploy lên Vercel

#### 2.1. Import Project

1. Đăng nhập Vercel → **Add New** → **Project**
2. Import từ GitHub repository
3. Chọn `frontend` folder

#### 2.2. Project Settings

**Framework Preset:** Next.js (auto-detect)

**Root Directory:** `frontend`  ← **QUAN TRỌNG**

**Build Settings:**

```yaml
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

#### 2.3. Environment Variables

Trong Vercel dashboard → Settings → Environment Variables, thêm:

```
NEXT_PUBLIC_API_URL=https://wayo-backend.onrender.com
NEXT_PUBLIC_API_BASE_PATH=/api
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
(... các biến khác)
```

**Apply to:** Production, Preview, Development

#### 2.4. Deploy

Click **Deploy** → Vercel sẽ:

1. Pull code
2. Install dependencies
3. Build Next.js app
4. Deploy tới CDN
5. Assign URL: `https://wayo.vercel.app`

### Step 3: Custom Domain (Optional)

Vercel → Settings → Domains → Add `wayo.yourdomain.com`

---

## 🗄️ Supabase Setup

### Deploy Database

1. Tạo project tại https://supabase.com
2. Run migrations:

```bash
cd supabase
supabase db push --project-ref xxx
```

3. Copy URL và Anon Key vào environment variables

---

## ⚙️ CI/CD (Tự động deploy khi push code)

### Vercel

✅ **Auto-deploy** mặc định:
- Push to `main` → Deploy production
- Push to PR → Deploy preview

### Render

✅ **Auto-deploy** mặc định:
- Push to `main` → Rebuild & redeploy backend

### Custom Workflow (GitHub Actions)

Tạo `.github/workflows/deploy.yml` (Optional):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Render Deploy
        run: |
          curl -X POST ${{ secrets.RENDER_DEPLOY_HOOK }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Trigger Vercel Deploy
        run: |
          curl -X POST ${{ secrets.VERCEL_DEPLOY_HOOK }}
```

---

## 🐛 Troubleshooting

### Backend (Render)

**Problem:** Solver không chạy

**Fix:**
```bash
# Check logs
render logs --tail

# Verify solver path
ls -la /app/bin/pdptw_solver.exe

# Test solver
./bin/pdptw_solver.exe --version
```

**Problem:** Out of Memory

**Fix:** Upgrade instance to 2GB RAM

### Frontend (Vercel)

**Problem:** API calls fail (CORS)

**Fix:** Kiểm tra `CORS_ORIGIN` trong backend env vars

**Problem:** Build fails

**Fix:** Check build logs, verify environment variables

---

## 📊 Monitoring

### Backend (Render)

- **Logs**: Render dashboard → Logs
- **Metrics**: CPU, Memory usage
- **Alerts**: Set up notifications

### Frontend (Vercel)

- **Analytics**: Vercel Analytics (built-in)
- **Logs**: Vercel dashboard → Deployments → Logs

### Supabase

- **Dashboard**: Database size, API calls
- **Logs**: SQL logs, API logs

---

## 💰 Cost Estimate

| Service | Plan | Cost |
|---------|------|------|
| Render Backend | Starter | $7/month |
| Vercel Frontend | Hobby | Free (Pro $20/month) |
| Supabase | Free | Free (Pro $25/month) |
| **Total** | | **$7-52/month** |

---

## 🔐 Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS properly
- [ ] Use HTTPS only
- [ ] Set Supabase RLS policies
- [ ] Rotate API keys regularly
- [ ] Enable Vercel/Render auth
- [ ] Set rate limiting on backend
- [ ] Monitor error logs

---

## 📝 Deployment Checklist

### Pre-deployment

- [ ] Build C++ solver locally
- [ ] Test locally: backend + frontend + Supabase
- [ ] Update environment variables
- [ ] Create `.env.production` files
- [ ] Commit solver binary to Git

### Backend (Render)

- [ ] Create Render web service
- [ ] Set root directory to `backend`
- [ ] Configure environment variables
- [ ] Set build & start commands
- [ ] Deploy & verify health endpoint

### Frontend (Vercel)

- [ ] Import project from GitHub
- [ ] Set root directory to `frontend`
- [ ] Configure environment variables
- [ ] Deploy & test functionality

### Post-deployment

- [ ] Test full flow: create job → process → view results
- [ ] Verify CORS between FE ↔ BE
- [ ] Check logs for errors
- [ ] Set up monitoring/alerts
- [ ] Document production URLs

---

## 🚀 Quick Commands

```bash
# Build backend locally
cd backend
npm install
npm run build
npm start

# Build frontend locally
cd frontend
npm install
npm run build
npm start

# Test production build locally
# Backend
cd backend && npm start

# Frontend (với production API)
cd frontend && NEXT_PUBLIC_API_URL=https://wayo-backend.onrender.com npm run build && npm start
```
