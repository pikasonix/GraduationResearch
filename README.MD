# 🚀 WAYO - Logistics Route Optimization Platform

> **WAYO** giải quyết bài toán tối ưu hóa lộ trình giao hàng (PDPTW - Pickup and Delivery Problem with Time Windows), giúp doanh nghiệp giảm chi phí vận chuyển và tối ưu số lượng xe.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
[![C++](https://img.shields.io/badge/C++-17-red)](https://isocpp.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com/)

---

## 📋 Mục lục

- [Tổng quan](#-tổng-quan)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Tech Stack](#-tech-stack)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Bắt đầu nhanh](#-bắt-đầu-nhanh)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Contributing](#-contributing)

---

## 🎯 Tổng quan

### Vấn đề giải quyết

Một công ty vận chuyển có:
- **100 đơn hàng** cần giao/nhận hôm nay
- **10 xe** với tải trọng khác nhau
- **Thời gian cửa sổ** (time windows) cho mỗi điểm giao/nhận

**WAYO tối ưu**:
- ✅ Số xe tối thiểu cần sử dụng
- ✅ Tuyến đường ngắn nhất cho mỗi xe
- ✅ Thứ tự pickup/delivery phù hợp
- ✅ Tuân thủ time windows và tải trọng

### Use Cases

- 🚚 **Last-mile delivery** (giao hàng tận nơi)
- 📦 **E-commerce logistics** (Shopee, Lazada, Tiki)
- 🏥 **Healthcare logistics** (giao thuốc, mẫu xét nghiệm)
- 🍕 **Food delivery** (quản lý tài xế, tuyến đường)
- 🏭 **B2B distribution** (phân phối hàng hóa)

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────┐
│   Mobile App    │  ← Tài xế xem route, cập nhật trạng thái
│    (Kotlin)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│   Frontend      │────▶│    Supabase      │  ← Lưu users, routes, drivers
│   (Next.js)     │◀────│   (PostgreSQL)   │
└────────┬────────┘     └──────────────────┘
         │
         │ REST API (/api/jobs/*)
         ▼
┌─────────────────┐
│    Backend      │  ← API server, Job queue
│  (Node.js + TS) │
└────────┬────────┘
         │
         │ spawn process
         ▼
┌─────────────────┐
│  PDPTW Solver   │  ← Thuật toán tối ưu (LNS + Fleet Minimization)
│     (C++)       │
└─────────────────┘
```

### Data Flow

```
User tạo instance → Frontend POST /api/jobs/submit
                         ↓
            Backend nhận request → JobQueue.createJob()
                         ↓
            Job vào hàng đợi (status: pending)
                         ↓
            Worker lấy job → SolverWorker.solve()
                         ↓
            Spawn C++ solver → pdptw_solver.exe
                         ↓
            Solver chạy LNS → tạo solution
                         ↓
            Worker parse kết quả → Job status: completed
                         ↓
            Frontend polling GET /api/jobs/:id
                         ↓
            Hiển thị routes trên bản đồ
```

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js 4
- **Language**: TypeScript 5
- **Queue**: In-memory EventEmitter (sẽ migrate sang BullMQ)
- **Solver**: C++17 + CMake

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Radix UI)
- **Maps**: Mapbox GL JS / Leaflet

### Mobile
- **Language**: Kotlin
- **UI**: Jetpack Compose
- **Architecture**: MVVM + Hilt
- **Maps**: Mapbox Maps SDK

### Database & Auth
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)
- **Storage**: Supabase Storage

---

## 📁 Cấu trúc dự án

```
WAYO/
├── 📂 backend/                  # Backend service (Node.js + Express)
│   ├── src/
│   │   ├── server.ts           # Entry point
│   │   ├── routes/             # API endpoints
│   │   ├── queue/              # Job queue management
│   │   ├── workers/            # Solver executor
│   │   └── types/              # TypeScript types
│   ├── pdptw_solver_module/    # C++ solver
│   │   ├── apps/main.cpp       # Solver entry point
│   │   ├── src/                # Algorithm implementation
│   │   └── build/              # Build output
│   └── bin/
│       └── pdptw_solver.exe    # Compiled solver
│
├── 📂 frontend/                 # Frontend (Next.js)
│   ├── src/
│   │   ├── app/                # Pages (App Router)
│   │   │   ├── dispatch/       # Route assignment UI
│   │   │   ├── route-details/  # Route visualization
│   │   │   └── add-instance/   # Instance builder
│   │   ├── components/         # React components
│   │   ├── services/           # API clients
│   │   └── config/             # Configuration
│   └── public/                 # Static assets
│
├── 📂 mobile/                   # Mobile app (Android)
│   └── app/src/main/java/com/pikasonix/wayo/
│       ├── ui/screens/         # Compose screens
│       ├── ui/viewmodel/       # ViewModels
│       └── data/repository/    # Data layer
│
├── 📂 supabase/                 # Database & Auth
│   └── supabase/
│       └── migrations/         # SQL migrations
│
└── 📂 docs/                     # 📚 Documentation (NEW!)
    ├── ai-context/             # AI-specific guides
    │   ├── codebase-overview.md   # System overview for AI
    │   └── common-tasks.md        # Task guides
    ├── architecture/           # Architecture docs
    ├── guides/                 # Development guides
    │   └── deployment.md       # Deployment instructions
    └── api/                    # API reference
```

---

## 🚀 Bắt đầu nhanh

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **npm** hoặc **yarn**
- **C++ compiler** (MSVC trên Windows hoặc GCC trên Linux)
- **CMake** 3.15+ ([Download](https://cmake.org/))
- **Git** ([Download](https://git-scm.com/))

### 1️⃣ Clone Repository

```bash
git clone https://github.com/yourusername/wayo.git
cd wayo
```

### 2️⃣ Setup Backend

#### Build C++ Solver

```bash
cd backend/pdptw_solver_module

# Windows
build_and_test.bat

# Linux/Mac
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make
```

#### Install Dependencies & Run

```bash
cd ../..  # Quay về backend/
npm install
cp .env.example .env  # Sửa file .env với config của bạn
npm run dev
```

Backend chạy tại: **http://localhost:3001**

### 3️⃣ Setup Frontend

```bash
cd ../frontend
npm install
cp .env.local.example .env.local  # Sửa file .env.local
npm run dev
```

Frontend chạy tại: **http://localhost:3000**

### 4️⃣ Setup Supabase (Optional)

1. Tạo project tại [supabase.com](https://supabase.com)
2. Copy URL và Anon Key
3. Cập nhật `.env.local` (frontend) và `.env` (backend)
4. Run migrations:

```bash
cd supabase
npx supabase db push
```

### 5️⃣ Test hệ thống

1. Mở **http://localhost:3000**
2. Tạo instance mẫu (Add Instance)
3. Submit job → Đợi solver chạy
4. Xem kết quả trên map (Dispatch/Route Details)

---

## 🌐 Deployment

### Production Setup

| Service | Platform | URL |
|---------|----------|-----|
| Backend | **Render** | https://wayo-backend.onrender.com |
| Frontend | **Vercel** | https://wayo.vercel.app |
| Database | **Supabase** | https://xxx.supabase.co |

### Quick Deploy

#### Backend → Render

```bash
# 1. Build solver locally
cd backend/pdptw_solver_module
./build_and_test.bat

# 2. Copy solver to bin/
mkdir -p ../bin
cp build/apps/Release/pdptw_solver.exe ../bin/

# 3. Commit & push
git add backend/bin/pdptw_solver.exe
git commit -m "Add compiled solver"
git push

# 4. Deploy on Render
# - Root Directory: backend
# - Build Command: npm install && npm run build
# - Start Command: npm start
```

#### Frontend → Vercel

```bash
# 1. Push to GitHub
git push

# 2. Import on Vercel
# - Root Directory: frontend
# - Framework: Next.js (auto-detected)
# - Set environment variables (NEXT_PUBLIC_*)
```

📖 **Chi tiết**: Xem [Deployment Guide](./docs/guides/deployment.md)

---

## 📚 Documentation

### For Developers

- **[Codebase Overview](./docs/ai-context/codebase-overview.md)** - Hiểu hệ thống trong 15 phút
- **[Common Tasks](./docs/ai-context/common-tasks.md)** - Hướng dẫn add API, debug, modify solver
- **[Deployment Guide](./docs/guides/deployment.md)** - Deploy lên Render + Vercel

### For AI Assistants

- **[.ai/config.json](./.ai/config.json)** - Project configuration for AI
- **[AI Context Docs](./docs/ai-context/)** - Tài liệu tối ưu cho AI đọc hiểu code

### API Reference

```bash
# Submit job
POST /api/jobs/submit
Body: { instance: string, params: SolverParams }

# Get job status
GET /api/jobs/:jobId

# List jobs
GET /api/jobs?status=completed&limit=10

# Queue stats
GET /api/jobs/stats

# Health check
GET /health
```

📖 **Full API docs**: [backend/README.md](./backend/README.md)

---

## 🧪 Testing

### Run Tests

```bash
# Backend (coming soon)
cd backend
npm test

# Frontend (coming soon)
cd frontend
npm test

# C++ Solver
cd backend/pdptw_solver_module/build
ctest
```

> ⚠️ **Note**: Unit tests đang được phát triển. Xem [issue #TODO]

---

## 🤝 Contributing

### Development Workflow

1. **Fork** repository
2. **Clone** fork của bạn
3. **Create branch**: `git checkout -b feature/amazing-feature`
4. **Make changes** và test kỹ
5. **Commit**: `git commit -m 'Add amazing feature'`
6. **Push**: `git push origin feature/amazing-feature`
7. **Create Pull Request**

### Code Style

- **TypeScript/JavaScript**: Prettier + ESLint (auto-format on save)
- **C++**: Google C++ Style Guide
- **Kotlin**: Kotlin Coding Conventions

### Commit Messages

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Examples:
  feat(backend): add PDF export endpoint
  fix(frontend): resolve map rendering issue
  docs(readme): update deployment instructions
```

---

## 🐛 Troubleshooting

### Backend không khởi động

```bash
# Check Node.js version
node --version  # Phải >= 20

# Xác minh solver path
ls backend/bin/pdptw_solver.exe

# Check logs
npm run dev
```

### Frontend build failed

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run dev
```

### Solver không chạy

```bash
# Test solver trực tiếp
cd backend/bin
./pdptw_solver.exe --instance ../pdptw_solver_module/instances/lr107.txt
```

📖 **More**: [Troubleshooting Guide](./docs/guides/troubleshooting.md)

---

## 📊 Performance

### Solver Benchmarks

| Instance Size | Nodes | Time (avg) | RAM |
|---------------|-------|------------|-----|
| Small | 100 | 5s | 256MB |
| Medium | 400 | 45s | 512MB |
| Large | 1000 | 5min | 2GB |

> Tested on: Intel i7-12700K, 16GB RAM

---

## 🗺️ Roadmap

### ✅ Completed

- [x] C++ PDPTW solver (LNS + Fleet Minimization)
- [x] Backend API với job queue
- [x] Frontend (dispatch, route visualization)
- [x] Mobile app (Android)
- [x] Supabase integration

### 🚧 In Progress

- [ ] Automated testing (Jest, Vitest)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Shared types package
- [ ] Better logging (Winston)

### 📋 Planned

- [ ] Real-time updates (WebSockets)
- [ ] Route optimization suggestions
- [ ] Multi-tenancy support
- [ ] iOS mobile app
- [ ] Analytics dashboard

---

## 📄 License

Dự án này được phân phối dưới giấy phép **MIT License**. Xem file [LICENSE](./LICENSE) để biết thêm chi tiết.

---

## 👥 Team

**WAYO Development Team**

- **Backend & Solver**: [Your Name]
- **Frontend**: [Your Name]
- **Mobile**: [Your Name]

---

## 🙏 Acknowledgments

- [CLI11](https://github.com/CLIUtils/CLI11) - Command-line parsing
- [spdlog](https://github.com/gabime/spdlog) - Fast C++ logging
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Supabase](https://supabase.com/) - Open-source Firebase alternative

---

## 📞 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/wayo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/wayo/discussions)
- **Email**: support@wayo.com (if applicable)

---

**⭐ Nếu project này hữu ích, hãy cho một star nhé!**

[![GitHub stars](https://img.shields.io/github/stars/yourusername/wayo?style=social)](https://github.com/yourusername/wayo)
