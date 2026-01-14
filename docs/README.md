# WAYO Documentation

Chào mừng đến với tài liệu hệ thống WAYO!

---

## 📚 Documentation Structure

### 🤖 For AI Assistants

Tài liệu được tối ưu hóa để AI (GitHub Copilot, Cursor, v.v.) dễ đọc hiểu:

- **[Codebase Overview](./ai-context/codebase-overview.md)** ⭐ **Đọc đầu tiên!**
  - Tổng quan hệ thống trong 15 phút
  - Tech stack, architecture, data flow
  - Key components và entry points
  
- **[Common Tasks](./ai-context/common-tasks.md)**
  - Add API endpoint
  - Modify solver parameters
  - Debug common issues
  - Add frontend components

- **[AI Config](./../.ai/config.json)**
  - Project metadata cho AI
  - Conventions và patterns
  - Debug hints

### 🏗️ Architecture

- **[Architecture Overview](./architecture/overview.md)**
  - System design
  - Component details
  - Data models
  - State management

### 📱 Mobile (Android)

- **[Mobile Docs](./mobile/README.md)** ⭐ **MVVM + XML (No Compose)**
  - Architecture, screen specs
  - Offline/online sync
  - API contracts (Supabase + Backend)

### 📖 Developer Guides

- **[Deployment Guide](./guides/deployment.md)** ⭐ **Production deployment**
  - Deploy backend to Render
  - Deploy frontend to Vercel
  - Supabase setup
  - CI/CD configuration

- **[Deployment Options](./guides/deployment-options.md)**
  - Current structure vs Monorepo
  - Pros/cons comparison
  - Migration paths

### 🔌 API Reference

- **Backend API** (coming soon)
  - REST endpoints
  - Request/response formats
  - Error codes

- **Solver Parameters** (coming soon)
  - CLI arguments
  - Configuration options
  - Tuning guide

---

## 🚀 Quick Start Guides

### For New Developers

**Recommended reading order**:

1. [README.md](../README.MD) - Project overview
2. [Codebase Overview](./ai-context/codebase-overview.md) - Understand the system
3. [Architecture Overview](./architecture/overview.md) - Deep dive into design
4. [Common Tasks](./ai-context/common-tasks.md) - Start coding

### For AI Assistants

**When user asks to**:

- **Add feature** → Read [Common Tasks](./ai-context/common-tasks.md) first
- **Fix bug** → Check "Debugging" section in [Codebase Overview](./ai-context/codebase-overview.md)
- **Deploy** → Follow [Deployment Guide](./guides/deployment.md)
- **Understand architecture** → Read [Architecture Overview](./architecture/overview.md)

### For DevOps

**Deployment**:

1. [Deployment Guide](./guides/deployment.md) - Step-by-step instructions
2. [Deployment Options](./guides/deployment-options.md) - Choose deployment strategy

---

## 📂 Documentation Files

```
docs/
├── README.md (this file)           # Documentation index
│
├── ai-context/                     # AI-optimized docs
│   ├── codebase-overview.md       # ⭐ System overview
│   └── common-tasks.md            # ⭐ Task guides
│
├── architecture/                   # System design
│   └── overview.md                # Architecture details

├── mobile/                         # Android mobile docs (MVVM + XML)
│   ├── README.md
│   ├── architecture-mvvm-xml.md
│   ├── screens.md
│   ├── offline-sync.md
│   ├── api-contracts.md
│   ├── rules-and-quality-gates.md
│   ├── testing.md
│   └── implementation-roadmap.md
│
├── guides/                         # How-to guides
│   ├── deployment.md              # ⭐ Deploy to production
│   └── deployment-options.md      # Deployment strategies
│
└── api/                            # API reference (planned)
    ├── backend-api.md
    └── solver-params.md
```

---

## 🎯 Documentation Goals

### For Developers

- ✅ Understand system in < 30 minutes
- ✅ Find code easily
- ✅ Know how to add features
- ✅ Debug issues quickly

### For AI Assistants

- ✅ Accurate code generation
- ✅ Correct bug fixes
- ✅ Follow project conventions
- ✅ Understand context

### For DevOps

- ✅ Deploy without errors
- ✅ Configure environments correctly
- ✅ Monitor system health

---

## 🔍 Finding Information

### "Where is the code for...?"

| What | Where | File |
|------|-------|------|
| API endpoints | Backend | `backend/src/routes/jobRoutes.ts` |
| Job queue | Backend | `backend/src/queue/JobQueue.ts` |
| Solver executor | Backend | `backend/src/workers/SolverWorker.ts` |
| C++ solver entry | Solver | `backend/pdptw_solver_module/apps/main.cpp` |
| Dispatch UI | Frontend | `frontend/src/app/dispatch/page.tsx` |
| Route visualization | Frontend | `frontend/src/app/route-details/page.tsx` |
| Database schema | Supabase | `supabase/supabase/migrations/` |

**Tip**: Use [Codebase Overview](./ai-context/codebase-overview.md) as a map!

### "How do I...?"

| Task | Guide |
|------|-------|
| Add API endpoint | [Common Tasks](./ai-context/common-tasks.md#add-new-api-endpoint) |
| Modify solver params | [Common Tasks](./ai-context/common-tasks.md#modify-solver-parameters) |
| Debug stuck job | [Common Tasks](./ai-context/common-tasks.md#debug-job-stuck-in-queue) |
| Deploy to production | [Deployment Guide](./guides/deployment.md) |
| Understand architecture | [Architecture Overview](./architecture/overview.md) |

### "Why is...?"

| Question | Answer |
|----------|--------|
| Why job queue? | Prevent concurrent solver runs (CPU intensive) |
| Why C++? | High performance for optimization algorithms |
| Why Next.js? | SSR, SEO, modern developer experience |
| Why Supabase? | Open-source, PostgreSQL, built-in auth |
| Why separate FE/BE? | Independent scaling, different deployment targets |

---

## 📝 Contributing to Docs

### Adding New Documentation

1. **Create file** in appropriate folder:
   - `ai-context/` for AI-specific guides
   - `architecture/` for design docs
   - `guides/` for how-to guides
   - `api/` for API reference

2. **Use clear structure**:
   ```markdown
   # Title
   
   ## Overview
   Brief description
   
   ## Details
   Step-by-step or detailed explanation
   
   ## Examples
   Code examples
   
   ## Related
   Links to related docs
   ```

3. **Update this index** (`docs/README.md`)

4. **Link from relevant files**

### Documentation Style Guide

- ✅ **Use emojis** for visual clarity
- ✅ **Code examples** for clarity
- ✅ **Diagrams** (ASCII art OK)
- ✅ **Links** to related docs
- ✅ **Clear headings**
- ❌ **Avoid jargon** without explanation
- ❌ **Don't duplicate** info (link instead)

---

## 🔗 External Resources

### Technologies

- [Node.js Documentation](https://nodejs.org/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Supabase Documentation](https://supabase.com/docs)

### Deployment

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

### Algorithms

- [PDPTW Research Papers](https://github.com/yourusername/wayo/wiki/Papers) (if available)

---

## 📞 Need Help?

1. **Check documentation** (you're here!)
2. **Search codebase** using [Codebase Overview](./ai-context/codebase-overview.md)
3. **Ask AI assistant** (provide context from these docs)
4. **GitHub Issues** for bugs
5. **GitHub Discussions** for questions

---

**Last Updated**: December 18, 2025

**Maintainers**: WAYO Team

**Feedback**: Open an issue or PR to improve docs!
