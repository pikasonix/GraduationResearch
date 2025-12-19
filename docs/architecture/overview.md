# Architecture Overview

## 🎯 Design Principles

WAYO được thiết kế dựa trên các nguyên tắc:

1. **Separation of Concerns**: Backend (API + Queue) tách biệt với Solver (C++)
2. **Scalability**: Job queue cho phép xử lý nhiều requests
3. **Platform Independence**: Frontend deploy riêng, Backend deploy riêng
4. **Maintainability**: Code tổ chức rõ ràng, dễ extend

---

## 🏗️ System Architecture

### High-Level View

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├────────────────────┬─────────────────────────────────────────┤
│   Mobile App       │         Web App (Next.js)               │
│   (Android)        │    - Dispatch UI                        │
│   - Route tracking │    - Route visualization                │
│   - Navigation     │    - Instance builder                   │
└────────┬───────────┴────────────┬────────────────────────────┘
         │                        │
         │                        │
         ├────────────────────────┤
         │    REST API + Auth     │
         └────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────┐  ┌─────────────┐  ┌──────────┐
│ Supabase│  │   Backend   │  │  CDN     │
│ (Auth + │  │  (Node.js)  │  │ (Static) │
│  Data)  │  │  + Queue    │  │          │
└─────────┘  └──────┬──────┘  └──────────┘
                    │
                    │ spawn
                    ▼
             ┌──────────────┐
             │  C++ Solver  │
             │  (pdptw)     │
             └──────────────┘
```

---

## 🔄 Request Flow

### 1. Job Submission Flow

```
User clicks "Optimize Routes"
         │
         ▼
Frontend validates input
         │
         ├─── Invalid? ──▶ Show error
         │
         ▼ Valid
POST /api/jobs/submit
         │
         ▼
Backend receives request
         │
         ├─── Validate instance format
         │
         ▼
JobQueue.createJob()
         │
         ├─── Generate UUID
         ├─── Set status: pending
         ├─── Add to queue
         │
         ▼
Return jobId to frontend
         │
         ▼
Frontend starts polling GET /api/jobs/:jobId
```

### 2. Job Processing Flow

```
JobQueue emits 'processJob' event
         │
         ▼
SolverWorker.solve(job)
         │
         ├─── Update status: processing
         │
         ▼
Write instance to temp file
(e.g., /tmp/instance_abc123.txt)
         │
         ▼
Build CLI arguments from params
         │
         ▼
Spawn child process:
  pdptw_solver.exe --instance /tmp/instance_abc123.txt ...
         │
         ├─── Monitor stdout/stderr
         ├─── Parse progress (if available)
         │
         ▼
Solver runs (may take seconds to minutes)
         │
         ├─── Construction heuristic
         ├─── LNS optimization
         ├─── Fleet minimization
         │
         ▼
Solver writes solution to file
(e.g., /tmp/solution_abc123.txt)
         │
         ▼
Worker reads solution file
         │
         ├─── Parse routes
         ├─── Parse objective
         ├─── Validate format
         │
         ▼
Update job:
  - status: completed
  - result: { routes, objective, ... }
         │
         ▼
JobQueue emits 'jobCompleted'
         │
         ▼
Cleanup temp files
         │
         ▼
Frontend receives result on next poll
```

---

## 📦 Component Details

### Backend Components

#### 1. API Layer (`src/routes/`)

**Responsibility**: Handle HTTP requests, validate input, return responses

```typescript
// jobRoutes.ts
router.post('/submit', (req, res) => {
  // 1. Validate request body
  // 2. Call JobQueue.createJob()
  // 3. Return jobId
});

router.get('/:jobId', (req, res) => {
  // 1. Get job from queue
  // 2. Return job status + result
});
```

**Design Pattern**: Controller pattern (thin layer)

#### 2. Job Queue (`src/queue/JobQueue.ts`)

**Responsibility**: Manage job lifecycle, ensure sequential processing

**Key Methods**:
- `createJob(instance, params)`: Add job to queue
- `processNext()`: Pick next pending job
- `getJob(id)`: Retrieve job by ID
- `cancelJob(id)`: Cancel/delete job

**Design Pattern**: Event Emitter (Observer pattern)

```typescript
class JobQueue extends EventEmitter {
  // Emit events:
  // - 'processJob': When job ready to process
  // - 'jobCompleted': When job finishes
  // - 'jobFailed': When job errors
}
```

**State Machine**:

```
   createJob()
      │
      ▼
  ┌─────────┐
  │ pending │
  └────┬────┘
       │ processNext()
       ▼
  ┌────────────┐
  │ processing │
  └─┬─────────┬┘
    │         │
    │ success │ error
    ▼         ▼
┌───────────┐ ┌────────┐
│ completed │ │ failed │
└───────────┘ └────────┘
```

#### 3. Solver Worker (`src/workers/SolverWorker.ts`)

**Responsibility**: Execute C++ solver, parse results

**Key Methods**:
- `solve(job, callbacks)`: Main entry point
- `buildCommandArgs(params)`: Convert params to CLI args
- `parseSolution(solutionText)`: Parse solver output

**Design Pattern**: Adapter pattern (wraps C++ executable)

```typescript
class SolverWorker {
  solve(job, callbacks) {
    // 1. Write instance file
    const instancePath = this.writeInstanceFile(job.instance);
    
    // 2. Build command
    const args = this.buildCommandArgs(job.params, instancePath);
    
    // 3. Spawn process
    const process = execFile(this.solverPath, args);
    
    // 4. Handle completion
    process.on('exit', (code) => {
      if (code === 0) {
        const result = this.parseSolution(outputPath);
        callbacks.onComplete(result);
      } else {
        callbacks.onError(new Error('Solver failed'));
      }
    });
  }
}
```

---

### Frontend Components

#### 1. Page Layer (`src/app/`)

**Responsibility**: Routing, layout, data fetching

**Structure** (Next.js App Router):

```
app/
├── layout.tsx           # Root layout
├── page.tsx             # Home page
├── dispatch/
│   └── page.tsx         # Dispatch management
├── route-details/
│   ├── page.tsx         # Route list + detail view
│   └── [id]/
│       └── page.tsx     # Single route detail (dynamic)
└── add-instance/
    └── page.tsx         # Instance builder
```

#### 2. Component Layer (`src/components/`)

**Organization**: Feature-based

```
components/
├── ui/                  # Reusable UI (buttons, inputs, etc.)
├── dispatch/            # Dispatch-specific components
│   ├── DispatchMap.tsx
│   ├── DispatchSidebarLeft.tsx
│   └── DispatchSidebarRight.tsx
└── route-details/       # Route visualization components
    ├── RouteDetailsView.tsx
    ├── RouteChipsBar.tsx
    └── useRouteDetailsData.ts  # Custom hook
```

#### 3. Service Layer (`src/services/`)

**Responsibility**: API communication

```typescript
// backendClient.js
export const api = {
  jobs: {
    submit: (instance, params) => 
      fetch('/api/jobs/submit', { method: 'POST', body: {...} }),
    
    get: (jobId) => 
      fetch(`/api/jobs/${jobId}`),
    
    list: (filters) => 
      fetch('/api/jobs?' + new URLSearchParams(filters))
  }
};
```

---

### Database Schema (Supabase)

#### Core Tables

```sql
-- Users (managed by Supabase Auth)
auth.users
  - id (UUID)
  - email
  - created_at

-- Drivers
public.drivers
  - id (UUID)
  - user_id (references auth.users)
  - name (TEXT)
  - phone (TEXT)
  - vehicle_id (references vehicles)

-- Vehicles
public.vehicles
  - id (UUID)
  - license_plate (TEXT)
  - vehicle_type (TEXT)  -- 'motorcycle', 'van', 'truck_small', etc.
  - capacity (NUMERIC)

-- Assigned Routes
public.assigned_routes
  - id (UUID)
  - driver_id (references drivers)
  - route_data (JSONB)  -- Full solution data
  - status (TEXT)       -- 'pending', 'in_progress', 'completed'
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)
```

#### Row Level Security (RLS)

```sql
-- Example: Drivers can only see their own routes
CREATE POLICY "Drivers see own routes"
  ON assigned_routes
  FOR SELECT
  USING (auth.uid() = (
    SELECT user_id FROM drivers WHERE id = driver_id
  ));
```

---

## 🔐 Security

### Authentication Flow

```
1. User signs up/in via Supabase Auth
   ↓
2. Supabase returns JWT token
   ↓
3. Frontend stores token in localStorage
   ↓
4. Every request includes: Authorization: Bearer <token>
   ↓
5. Supabase validates token via RLS
```

### API Security

```typescript
// Backend CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Future: Add API key authentication
// app.use('/api', validateApiKey);
```

---

## 📊 Data Models

### Job Model

```typescript
interface Job {
  id: string;               // UUID v4
  status: JobStatus;        // 'pending' | 'processing' | 'completed' | 'failed'
  instance: string;         // Instance data (Li&Lim format)
  params: SolverParams;     // Solver configuration
  result?: SolutionResult;  // Output (only when completed)
  progress?: number;        // 0-100 (future)
  queuePosition: number;    // Position in queue
  error?: string;           // Error message (if failed)
  createdAt: number;        // Timestamp
  startedAt?: number;
  completedAt?: number;
}
```

### Solution Result

```typescript
interface SolutionResult {
  routes: Array<{
    vehicle_id: number;
    nodes: number[];        // Node IDs in visit order
    load: number;
    distance: number;
    duration: number;
  }>;
  objective: number;        // Total cost/distance
  num_vehicles: number;
  num_unassigned: number;
  computation_time: number; // Seconds
}
```

---

## 🚀 Deployment Architecture

### Production Setup

```
┌────────────────────┐
│   Users (Global)   │
└─────────┬──────────┘
          │
    ┌─────┴──────┐
    │            │
    ▼            ▼
┌─────────┐  ┌──────────┐
│ Vercel  │  │  Render  │
│  (CDN)  │  │ (Server) │
│         │  │          │
│ Next.js │  │ Node.js  │
│ Static  │  │  + C++   │
└────┬────┘  └────┬─────┘
     │            │
     │            │
     └─────┬──────┘
           │
           ▼
    ┌────────────┐
    │  Supabase  │
    │ (Database) │
    └────────────┘
```

**Benefits**:
- ✅ Frontend on CDN (fast global access)
- ✅ Backend on dedicated server (for C++ solver)
- ✅ Database managed by Supabase (auto-backups, scaling)

---

## 🔄 State Management

### Backend State

**In-Memory Queue**:
- Jobs stored in `Map<string, Job>`
- Lost on restart (future: persist to Redis)

**Future: Redis + BullMQ**:
```typescript
// BullMQ for persistent queue
const queue = new Queue('jobs', {
  connection: { host: 'redis', port: 6379 }
});
```

### Frontend State

**Current**: React hooks + localStorage

**Future**: Zustand or Redux

```typescript
// Zustand store (example)
const useJobStore = create((set) => ({
  jobs: [],
  addJob: (job) => set((state) => ({ jobs: [...state.jobs, job] })),
  updateJob: (id, updates) => set((state) => ({
    jobs: state.jobs.map(j => j.id === id ? { ...j, ...updates } : j)
  }))
}));
```

---

## 🧪 Testing Strategy

### Unit Tests

```
backend/
├── src/
│   ├── queue/
│   │   ├── JobQueue.ts
│   │   └── JobQueue.test.ts      # ← Unit tests
│   └── workers/
│       ├── SolverWorker.ts
│       └── SolverWorker.test.ts
```

### Integration Tests

```typescript
// Test API endpoints
describe('POST /api/jobs/submit', () => {
  it('should create job and return jobId', async () => {
    const response = await request(app)
      .post('/api/jobs/submit')
      .send({ instance: '...', params: {} });
    
    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

```typescript
test('user can submit instance and view result', async ({ page }) => {
  await page.goto('/add-instance');
  await page.fill('[name="instance"]', '...');
  await page.click('button:text("Submit")');
  await expect(page.locator('.job-status')).toHaveText('completed');
});
```

---

## 📈 Scalability Considerations

### Current Limitations

1. **Single worker**: Only 1 solver can run at a time
2. **In-memory queue**: Lost on restart
3. **No load balancing**: Single backend instance

### Future Improvements

**Horizontal Scaling**:

```
┌─────────────┐
│ Load        │
│ Balancer    │
└──────┬──────┘
       │
   ┌───┴───┬───────┬───────┐
   ▼       ▼       ▼       ▼
┌──────┐┌──────┐┌──────┐┌──────┐
│ Node ││ Node ││ Node ││ Node │
│  1   ││  2   ││  3   ││  4   │
└───┬──┘└───┬──┘└───┬──┘└───┬──┘
    │       │       │       │
    └───────┴───┬───┴───────┘
                │
           ┌────┴─────┐
           │  Redis   │
           │  Queue   │
           └──────────┘
```

**Worker Pool**:

```typescript
// Multiple solver workers
const workerPool = [
  new SolverWorker('/path/to/solver1'),
  new SolverWorker('/path/to/solver2'),
  new SolverWorker('/path/to/solver3'),
];

// Distribute jobs
queue.on('processJob', (job) => {
  const availableWorker = workerPool.find(w => !w.isBusy());
  if (availableWorker) {
    availableWorker.solve(job);
  }
});
```

---

## 📚 Related Documents

- [Codebase Overview](../ai-context/codebase-overview.md)
- [Deployment Guide](../guides/deployment.md)
- [API Reference](../api/backend-api.md)

---

**Last Updated**: December 18, 2025
