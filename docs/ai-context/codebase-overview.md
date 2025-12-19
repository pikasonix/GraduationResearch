# WAYO Codebase Overview (AI Context)

> **Mục đích**: Giúp AI assistants (GitHub Copilot, Cursor, v.v.) hiểu nhanh codebase để fix bug và thêm features.

---

## 🎯 System Purpose

**WAYO** là nền tảng tối ưu hóa logistics, giải quyết bài toán **Vehicle Routing Problem (PDPTW - Pickup and Delivery Problem with Time Windows)** để giúp doanh nghiệp tối ưu hóa tuyến giao hàng.

**Use Case**: Một công ty vận chuyển có 100 đơn hàng cần giao/nhận hôm nay, WAYO sẽ tính toán:
- Số xe tối thiểu cần dùng
- Tuyến đường tối ưu cho mỗi xe
- Thứ tự pickup/delivery phù hợp time windows
- Tổng chi phí/quãng đường thấp nhất

---

## 🏗️ Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Mobile    │      │   Frontend   │      │  Supabase   │
│  (Kotlin)   │─────▶│  (Next.js)   │◀────▶│ (Postgres)  │
└─────────────┘      └───────┬──────┘      └─────────────┘
                             │
                             │ REST API
                             ▼
                     ┌───────────────┐
                     │    Backend    │
                     │  (Node.js)    │
                     │  + JobQueue   │
                     └───────┬───────┘
                             │
                             │ spawn process
                             ▼
                     ┌───────────────┐
                     │  C++ Solver   │
                     │ pdptw_solver  │
                     │  (LNS+AGES)   │
                     └───────────────┘
```

### Data Flow

```
1. User creates instance (nodes, vehicles, time windows)
   └─▶ Frontend POST /api/jobs/submit
       └─▶ Backend receives instance data
           └─▶ JobQueue.createJob() → generates jobId
               └─▶ Job enters queue (status: pending)
                   └─▶ Worker picks job → status: processing
                       └─▶ SolverWorker spawns C++ solver
                           └─▶ Solver reads instance → runs LNS → outputs solution
                               └─▶ Worker parses solution → Job status: completed
                                   └─▶ Frontend polls GET /api/jobs/:jobId
                                       └─▶ Returns solution (routes, cost, distance)
```

---

## 📂 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend API** | Node.js 20 + Express + TypeScript | REST API server, job queue |
| **Solver** | C++17 + CMake | PDPTW optimization algorithm |
| **Frontend** | Next.js 15 + React 19 + TypeScript | Web UI (dispatch, route viz) |
| **Mobile** | Kotlin + Jetpack Compose | Android driver app |
| **Database** | Supabase (PostgreSQL) | User data, routes, drivers |
| **Map** | Mapbox GL JS / Leaflet | Route visualization |
| **Auth** | Supabase Auth | User authentication |

---

## 🗂️ Directory Structure

```
WAYO/
├── backend/                    # Backend service (Node.js)
│   ├── src/
│   │   ├── server.ts          # 🚪 Entry point - Express app setup
│   │   ├── routes/
│   │   │   └── jobRoutes.ts   # API endpoints (/api/jobs/*)
│   │   ├── queue/
│   │   │   └── JobQueue.ts    # Job queue with event emitter
│   │   ├── workers/
│   │   │   └── SolverWorker.ts # Executes C++ solver via child_process
│   │   └── types/
│   │       └── index.ts       # TypeScript type definitions
│   ├── pdptw_solver_module/   # C++ solver
│   │   ├── apps/main.cpp      # Solver entry point
│   │   ├── src/               # Algorithm implementation
│   │   │   ├── construction/  # Initial solution builder
│   │   │   ├── lns/           # Large Neighborhood Search
│   │   │   ├── ages/          # Fleet minimization
│   │   │   └── io/            # Read/write instances
│   │   └── build/             # CMake build output
│   ├── bin/
│   │   └── pdptw_solver.exe   # Compiled solver (commit for deploy)
│   └── storage/               # Temp files during processing
│
├── frontend/                   # Frontend service (Next.js)
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── dispatch/      # 📍 Route assignment UI
│   │   │   ├── route-details/ # 📍 Route visualization
│   │   │   └── add-instance/  # 📍 Problem instance builder
│   │   ├── components/
│   │   │   ├── dispatch/      # Dispatch-related components
│   │   │   ├── route-details/ # Route detail components
│   │   │   └── ui/            # Reusable UI (shadcn/ui)
│   │   ├── services/
│   │   │   └── backendClient.js # API client for backend
│   │   ├── config/
│   │   │   └── config.ts      # Environment config
│   │   └── utils/
│   │       └── dataModels.ts  # Domain models (Route, Node, etc)
│   └── public/                # Static assets
│
├── mobile/                     # Mobile app (Android)
│   └── app/src/main/java/com/pikasonix/wayo/
│       ├── ui/screens/        # Compose screens
│       ├── ui/viewmodel/      # ViewModels
│       ├── data/repository/   # Data layer
│       └── di/                # Dependency injection (Hilt)
│
├── supabase/                   # Database
│   └── supabase/
│       ├── migrations/        # SQL migrations
│       └── config.toml        # Supabase config
│
└── docs/                       # 📚 Documentation (NEW)
    ├── ai-context/            # AI-specific guides
    ├── architecture/          # System design docs
    ├── guides/                # Development guides
    └── api/                   # API reference
```

---

## 🔑 Key Components Deep Dive

### 1. Backend API (`backend/src`)

**Entry Point**: `server.ts`

```typescript
// server.ts workflow:
1. Load env vars (.env)
2. Resolve PDPTW solver path (bin/pdptw_solver.exe)
3. Initialize JobQueue (in-memory queue)
4. Initialize SolverWorker (C++ executor)
5. Setup routes (/api/jobs)
6. Start Express server (default: port 3001)
```

**Key Files**:

| File | Purpose | Key Functions |
|------|---------|---------------|
| `routes/jobRoutes.ts` | API endpoints | `POST /submit`, `GET /:id`, `DELETE /:id`, `GET /stats` |
| `queue/JobQueue.ts` | Job management | `createJob()`, `processNext()`, `getJob()`, `getStats()` |
| `workers/SolverWorker.ts` | C++ integration | `solve()`, `buildCommandArgs()`, `parseSolution()` |
| `types/index.ts` | Type definitions | `Job`, `SolverParams`, `SolutionResult` |

**Data Models**:

```typescript
// Job lifecycle
interface Job {
  id: string;                    // UUID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  instance: string;              // Instance data (text format)
  params: SolverParams;          // Solver parameters
  result?: SolutionResult;       // Output (routes, cost)
  progress?: number;             // 0-100
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// Solver parameters
interface SolverParams {
  max_iterations?: number;       // Default: 100000
  time_limit_seconds?: number;   // Max runtime
  seed?: number;                 // Random seed
  acceptance?: 'sa' | 'rtr' | 'greedy';
  // ... more params in types/index.ts
}

// Solution result
interface SolutionResult {
  routes: Array<{
    vehicle_id: number;
    nodes: number[];             // Node IDs in visit order
  }>;
  objective: number;             // Total cost
  num_vehicles: number;
  computation_time: number;
}
```

**API Endpoints**:

```bash
# Submit new job
POST /api/jobs/submit
Body: { instance: string, params: SolverParams }
Response: { success: true, jobId: string }

# Get job status
GET /api/jobs/:jobId
Response: { success: true, job: Job }

# List all jobs
GET /api/jobs
Query: ?status=completed&limit=10
Response: { success: true, jobs: Job[] }

# Queue statistics
GET /api/jobs/stats
Response: { success: true, stats: { pending: 2, processing: 1, ... } }

# Cancel job
DELETE /api/jobs/:jobId
Response: { success: true }

# Health check
GET /health
Response: { status: 'ok', queue: {...}, solver: '...' }
```

### 2. C++ Solver (`backend/pdptw_solver_module`)

**Entry Point**: `apps/main.cpp`

**Algorithm**: Large Neighborhood Search (LNS) + Fleet Minimization (AGES)

**Workflow**:

```cpp
1. Parse CLI args (--instance, --time-limit, etc.)
2. Read instance file (Li&Lim or Sartori format)
3. Build initial solution (sequential/regret/binpacking)
4. Optimize with LNS:
   - Destroy: Remove requests from routes
   - Repair: Re-insert with better positions
   - Accept: Simulated Annealing / Record-to-Record Travel
5. Fleet minimization (reduce number of vehicles)
6. Validate solution
7. Write solution to file
```

**Key Modules**:

| Module | Purpose |
|--------|---------|
| `src/construction/` | Build initial feasible solution |
| `src/lns/` | Destroy/repair operators, acceptance criteria |
| `src/ages/` | Fleet minimization (K-ejection, route merging) |
| `src/io/` | Parse instances, write solutions |
| `src/solution/` | Solution data structure |
| `src/problem/` | Problem instance (nodes, time windows, distances) |

**CLI Usage**:

```bash
pdptw_solver.exe \
  --instance instances/lr107.txt \
  --output-dir solutions \
  --time-limit 600 \
  --seed 42 \
  --acceptance rtr \
  --max-iterations 100000
```

### 3. Frontend (`frontend/src`)

**Framework**: Next.js 15 (App Router)

**Key Pages**:

| Route | Purpose | Components |
|-------|---------|------------|
| `/dispatch` | Assign routes to drivers | `DispatchClient.tsx`, `DispatchMap.tsx` |
| `/route-details` | View route details + map | `RouteDetailsView.tsx`, `RouteChipsBar.tsx` |
| `/route-details/[id]` | Single route view | Dynamic route |
| `/add-instance` | Build problem instance | `AddInstanceBuilder.tsx` |

**State Management**: React hooks (useState, useEffect) + localStorage

**API Integration**: `services/backendClient.js`

```javascript
// Example usage
import { db } from '@/services/backendClient';

// Fetch data
const routes = await db.select('routes', { filters: {...} });

// Submit job to backend
const response = await fetch('http://localhost:3001/api/jobs/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instance, params })
});
```

**Configuration**: `config/config.ts`

```typescript
const config = {
  api: {
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    basePath: '/api'
  },
  mapbox: {
    accessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    style: 'mapbox://styles/mapbox/streets-v12'
  },
  // ... solver default params
};
```

### 4. Database (Supabase)

**Tables** (principales):

```sql
-- Drivers
CREATE TABLE drivers (
  id UUID PRIMARY KEY,
  name TEXT,
  phone TEXT,
  vehicle_id UUID REFERENCES vehicles(id)
);

-- Vehicles
CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  license_plate TEXT,
  capacity NUMERIC,
  vehicle_type TEXT
);

-- Assigned Routes
CREATE TABLE assigned_routes (
  id UUID PRIMARY KEY,
  driver_id UUID REFERENCES drivers(id),
  route_data JSONB,          -- Solution data
  status TEXT,
  created_at TIMESTAMP
);
```

**RLS (Row Level Security)**: Enabled

---

## 🛠️ Common Development Tasks

### Add New API Endpoint

**Example**: Add GET `/api/jobs/export/:jobId/pdf`

1. **Define route** in `backend/src/routes/jobRoutes.ts`:

```typescript
router.get('/export/:jobId/pdf', (req, res) => {
  const { jobId } = req.params;
  const job = jobQueue.getJob(jobId);
  
  if (!job || !job.result) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  // Generate PDF logic here
  res.setHeader('Content-Type', 'application/pdf');
  res.send(pdfBuffer);
});
```

2. **Add types** (if needed) in `backend/src/types/index.ts`

3. **Document** in `docs/api/backend-api.md`

### Modify Solver Parameters

**Example**: Add `--max-routes` parameter

1. **Update C++ CLI** in `backend/pdptw_solver_module/apps/main.cpp`:

```cpp
int max_routes = 100;
app.add_option("--max-routes", max_routes, "Maximum routes allowed");
```

2. **Update TypeScript types** in `backend/src/types/index.ts`:

```typescript
export interface SolverParams {
  // ... existing
  max_routes?: number;
}
```

3. **Update SolverWorker** in `backend/src/workers/SolverWorker.ts`:

```typescript
private buildCommandArgs(params: SolverParams): string[] {
  const args: string[] = [];
  
  if (params.max_routes) {
    args.push('--max-routes', params.max_routes.toString());
  }
  
  // ... rest
  return args;
}
```

4. **Update frontend config** in `frontend/src/config/config.ts`

### Debug Job Stuck in Queue

**Symptoms**: Job status stays "pending" forever

**Debug Steps**:

1. **Check backend logs**:
```bash
# Look for: "[Server] Starting to process job <id>"
# If missing, queue is stuck
```

2. **Check solver process**:
```bash
# Windows
tasklist | findstr pdptw_solver

# If running, solver is active
```

3. **Check job queue stats**:
```bash
curl http://localhost:3001/api/jobs/stats
# Returns: { pending: X, processing: Y, ... }
```

4. **Common causes**:
   - Solver crashed → Check `job.error` field
   - Invalid instance → Validate input format
   - Timeout → Check `JOB_TIMEOUT` env var
   - Solver not found → Check `PDPTW_SOLVER_PATH`

### Add New Frontend Component

**Example**: Add "Export Route" button

1. **Create component** in `frontend/src/components/features/export/`:

```tsx
// ExportButton.tsx
'use client';
import { Button } from '@/components/ui/button';

export function ExportButton({ routeId }: { routeId: string }) {
  const handleExport = async () => {
    const res = await fetch(`/api/jobs/export/${routeId}/pdf`);
    const blob = await res.blob();
    // Download logic
  };
  
  return <Button onClick={handleExport}>Export PDF</Button>;
}
```

2. **Use in page**:

```tsx
// app/route-details/[id]/page.tsx
import { ExportButton } from '@/components/features/export/ExportButton';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div>
      <ExportButton routeId={params.id} />
    </div>
  );
}
```

---

## 🐛 Known Issues & Limitations

### Backend

- ❌ **No automated tests**: Unit/integration tests needed
- ❌ **In-memory queue**: Jobs lost on restart (consider Redis + BullMQ)
- ❌ **No distributed processing**: Single worker only
- ❌ **Manual logging**: Use Winston/Pino for structured logs
- ⚠️ **Windows-only**: Solver is .exe (need Linux build for cloud)

### Frontend

- ⚠️ **LocalStorage dependency**: Route data stored client-side
- ❌ **No state management**: Consider Zustand/Redux
- ❌ **No error boundaries**: React errors crash app
- ⚠️ **Type inconsistencies**: FE/BE types not shared

### Solver

- ⚠️ **CPU intensive**: Large instances need 2GB+ RAM
- ⚠️ **Long runtime**: Can take 5-10 minutes for 1000+ nodes
- ❌ **No progress updates**: Can't track solver progress in real-time

### Database

- ⚠️ **No migrations versioning**: Manual migration management
- ⚠️ **No type generation**: Supabase types need manual update

---

## 🎯 Code Patterns & Conventions

### Backend

**Error Handling**:
```typescript
// ✅ Good
try {
  const result = await someAsyncOperation();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : String(error)
  });
}
```

**Async/Await**:
```typescript
// ✅ Prefer async/await over callbacks
async function processJob(job: Job): Promise<void> {
  const result = await solver.solve(job);
  await saveResult(result);
}
```

### Frontend

**Components**:
```tsx
// ✅ Functional components + hooks
'use client'; // For client components

export function MyComponent({ data }: { data: DataType }) {
  const [state, setState] = useState<State>({});
  
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  return <div>{/* JSX */}</div>;
}
```

**Data Fetching**:
```tsx
// ✅ Custom hooks for data
function useRoutes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchRoutes() {
      const data = await fetch('/api/routes').then(r => r.json());
      setRoutes(data);
      setLoading(false);
    }
    fetchRoutes();
  }, []);
  
  return { routes, loading };
}
```

### TypeScript

**Type Safety**:
```typescript
// ✅ Define interfaces for all data structures
interface Route {
  id: number;
  nodes: Node[];
  distance: number;
}

// ✅ Use type guards
function isRoute(obj: unknown): obj is Route {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}
```

---

## 📚 Important Files for AI to Read First

When starting to work on this codebase, read these files in order:

1. **This file** (`docs/ai-context/codebase-overview.md`)
2. `backend/src/server.ts` - Understand backend entry point
3. `backend/src/types/index.ts` - Learn type definitions
4. `backend/src/routes/jobRoutes.ts` - Understand API
5. `frontend/src/config/config.ts` - Frontend configuration
6. `frontend/src/app/dispatch/DispatchClient.tsx` - Main UI logic

---

## 🔗 Related Documentation

- [Common Tasks Guide](./common-tasks.md) - Step-by-step task guides
- [API Reference](../api/backend-api.md) - Complete API documentation
- [Architecture Overview](../architecture/overview.md) - System design
- [Deployment Guide](../guides/deployment.md) - How to deploy

---

**Last Updated**: December 18, 2025
**Maintainer**: WAYO Team
