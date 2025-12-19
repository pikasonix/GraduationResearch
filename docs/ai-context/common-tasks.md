# Common Development Tasks & Guides

> Step-by-step guides for common development tasks. Copy-paste friendly!

---

## 📋 Table of Contents

- [Adding Features](#adding-features)
  - [Add New API Endpoint](#1-add-new-api-endpoint)
  - [Add Frontend Page](#2-add-frontend-page)
  - [Add Database Table](#3-add-database-table)
  - [Modify Solver Parameters](#4-modify-solver-parameters)
- [Debugging](#debugging)
  - [Job Stuck in Queue](#1-job-stuck-in-queue)
  - [Frontend Not Showing Routes](#2-frontend-not-showing-routes)
  - [Solver Crashes](#3-solver-crashes)
  - [CORS Errors](#4-cors-errors)
- [Testing](#testing)
- [Performance](#performance)

---

## Adding Features

### 1. Add New API Endpoint

**Example**: Add `GET /api/jobs/export/:jobId/pdf` to export route as PDF

#### Step 1: Define Route

**File**: `backend/src/routes/jobRoutes.ts`

```typescript
// Add at the end of setupJobRoutes function, before return router

/**
 * GET /api/jobs/export/:jobId/pdf
 * Export job result as PDF
 */
router.get('/export/:jobId/pdf', async (req: Request, res: Response): Promise<void> => {
    try {
        const { jobId } = req.params;
        const job = jobQueue.getJob(jobId);

        if (!job) {
            res.status(404).json({
                success: false,
                error: 'Job not found'
            });
            return;
        }

        if (!job.result) {
            res.status(400).json({
                success: false,
                error: 'Job has no result yet'
            });
            return;
        }

        // TODO: Generate PDF from job.result
        // For now, return JSON
        res.json({
            success: true,
            message: 'PDF export coming soon',
            data: job.result
        });

    } catch (error) {
        console.error('Error exporting PDF:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});
```

#### Step 2: Add Types (if needed)

**File**: `backend/src/types/index.ts`

```typescript
// Add new interface
export interface PdfExportOptions {
    pageSize?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    includeMap?: boolean;
}
```

#### Step 3: Test

```bash
# Start backend
cd backend
npm run dev

# Test endpoint
curl http://localhost:3001/api/jobs/export/YOUR_JOB_ID/pdf
```

#### Step 4: Update Frontend (optional)

**File**: `frontend/src/services/backendClient.js`

```javascript
export const api = {
    jobs: {
        // ... existing methods
        
        exportPdf: async (jobId) => {
            const response = await fetch(`${config.api.baseURL}/api/jobs/export/${jobId}/pdf`);
            return response.blob(); // For file download
        }
    }
};
```

---

### 2. Add Frontend Page

**Example**: Add `/analytics` page to show job statistics

#### Step 1: Create Page

**File**: `frontend/src/app/analytics/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const response = await fetch('http://localhost:3001/api/jobs/stats');
                const data = await response.json();
                setStats(data.stats);
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        }
        
        fetchStats();
    }, []);

    if (loading) return <div>Loading...</div>;

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Analytics</h1>
            
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold">Total Jobs</h3>
                    <p className="text-4xl">{stats?.total || 0}</p>
                </div>
                
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold">Completed</h3>
                    <p className="text-4xl text-green-600">{stats?.completed || 0}</p>
                </div>
                
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-lg font-semibold">Failed</h3>
                    <p className="text-4xl text-red-600">{stats?.failed || 0}</p>
                </div>
            </div>
        </div>
    );
}
```

#### Step 2: Add to Navigation (optional)

**File**: `frontend/src/components/layout/Navigation.tsx` (if exists)

```tsx
<nav>
    <Link href="/">Home</Link>
    <Link href="/dispatch">Dispatch</Link>
    <Link href="/analytics">Analytics</Link> {/* NEW */}
</nav>
```

#### Step 3: Test

```bash
cd frontend
npm run dev
# Visit http://localhost:3000/analytics
```

---

### 3. Add Database Table

**Example**: Add `notifications` table for user alerts

#### Step 1: Create Migration

**File**: `supabase/supabase/migrations/20231218000000_add_notifications.sql`

```sql
-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own notifications
CREATE POLICY "Users see own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own notifications
CREATE POLICY "Users create own notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own notifications
CREATE POLICY "Users update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### Step 2: Apply Migration

```bash
cd supabase
npx supabase db push

# Or if using local dev
npx supabase migration up
```

#### Step 3: Generate Types (Frontend)

```bash
cd frontend
npm run supabase:typegen
```

This updates `frontend/src/supabase/types.ts` with new table types.

#### Step 4: Use in Code

```typescript
import { supabase } from '@/supabase/client';

// Insert notification
const { data, error } = await supabase
    .from('notifications')
    .insert({
        user_id: userId,
        title: 'New Route Assigned',
        message: 'You have been assigned Route #123'
    });

// Fetch notifications
const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
```

---

### 4. Modify Solver Parameters

**Example**: Add `--max-routes` parameter to limit number of vehicles

#### Step 1: Update C++ CLI

**File**: `backend/pdptw_solver_module/apps/main.cpp`

Find the CLI setup section and add:

```cpp
// Around line 30-50, after existing parameters
int max_routes = -1;  // -1 means unlimited
app.add_option("--max-routes", max_routes, 
    "Maximum number of routes (vehicles) allowed (-1 for unlimited)");
```

Then use it in solver:

```cpp
// Around line 200-250, before running LNS
if (max_routes > 0) {
    // Validate instance can fit in max_routes
    int min_routes_required = estimate_min_routes(instance);
    if (min_routes_required > max_routes) {
        spdlog::warn("Instance requires at least {} routes, but max_routes={}", 
                     min_routes_required, max_routes);
    }
}

// Pass to solver if your algorithm supports it
// (implementation depends on your solver structure)
```

#### Step 2: Rebuild Solver

```bash
cd backend/pdptw_solver_module
./build_and_test.bat

# Copy to bin
cp build/apps/Release/pdptw_solver.exe ../bin/
```

#### Step 3: Update Backend Types

**File**: `backend/src/types/index.ts`

```typescript
export interface SolverParams {
    // ... existing params
    max_routes?: number;  // Add this
}
```

#### Step 4: Update SolverWorker

**File**: `backend/src/workers/SolverWorker.ts`

Find `buildCommandArgs()` method and add:

```typescript
private buildCommandArgs(params: SolverParams, instancePath: string): string[] {
    const args: string[] = [
        '--instance', instancePath,
        '--output-dir', this.outputDir,
        // ... existing args
    ];

    // Add max_routes if provided
    if (params.max_routes !== undefined && params.max_routes > 0) {
        args.push('--max-routes', params.max_routes.toString());
    }

    return args;
}
```

#### Step 5: Update Frontend Config (optional)

**File**: `frontend/src/config/config.ts`

```typescript
export default {
    // ... existing config
    solverDefaults: {
        // ... existing defaults
        max_routes: -1,  // Add default value
    }
};
```

#### Step 6: Test

```bash
# Test solver directly
cd backend/bin
./pdptw_solver.exe --instance ../pdptw_solver_module/instances/lr107.txt --max-routes 5

# Test via API
curl -X POST http://localhost:3001/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{
    "instance": "...",
    "params": { "max_routes": 5 }
  }'
```

---

## Debugging

### 1. Job Stuck in Queue

**Symptoms**: Job status stays "pending" forever

#### Debug Steps

**Step 1**: Check backend logs

```bash
cd backend
npm run dev

# Look for:
# "[Server] Starting to process job <id>" ← Should appear when processing
```

**Step 2**: Check solver process

```bash
# Windows
tasklist | findstr pdptw_solver

# Linux/Mac
ps aux | grep pdptw_solver
```

**Step 3**: Check job queue stats

```bash
curl http://localhost:3001/api/jobs/stats

# Response should show:
# {
#   "stats": {
#     "pending": 1,
#     "processing": 0,  ← Should be 1 if actively processing
#     "completed": 5,
#     "failed": 0
#   }
# }
```

**Step 4**: Check job details

```bash
curl http://localhost:3001/api/jobs/YOUR_JOB_ID

# Look at:
# - status: should change from "pending" to "processing"
# - error: any error messages
# - queuePosition: position in queue
```

#### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Solver not found | Check `PDPTW_SOLVER_PATH` env var, verify `backend/bin/pdptw_solver.exe` exists |
| Solver crashed | Check `job.error` field, validate instance format |
| Timeout exceeded | Increase `JOB_TIMEOUT` in `.env` (default 1 hour) |
| Queue stuck | Restart backend server |

---

### 2. Frontend Not Showing Routes

**Symptoms**: Map is blank or routes don't display

#### Debug Steps

**Step 1**: Check browser console

```javascript
// Press F12 → Console tab
// Look for errors
```

**Step 2**: Verify API response

```javascript
// In browser console
fetch('http://localhost:3001/api/jobs/YOUR_JOB_ID')
    .then(r => r.json())
    .then(console.log);

// Should return job with result field
```

**Step 3**: Check component state

```tsx
// Add debug logging in component
useEffect(() => {
    console.log('Routes data:', routes);
    console.log('Instance data:', instance);
}, [routes, instance]);
```

**Step 4**: Verify map bounds

```javascript
// Check if coordinates are valid
routes.forEach(route => {
    route.nodes.forEach(node => {
        console.log('Node coords:', node.lat, node.lng);
        // Should be valid numbers (e.g., lat: 21.xx, lng: 105.xx)
    });
});
```

#### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| API返回錯誤格式 | Check `SolutionResult` type matches API response |
| Coordinates in wrong format | Should be `[lng, lat]` for Mapbox, `[lat, lng]` for Leaflet |
| Missing data in localStorage | Re-fetch from API or refresh page |
| Mapbox token invalid | Verify `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` |

---

### 3. Solver Crashes

**Symptoms**: Job status changes to "failed" with error message

#### Debug Steps

**Step 1**: Check error message

```bash
curl http://localhost:3001/api/jobs/YOUR_JOB_ID | jq '.job.error'
```

**Step 2**: Run solver manually

```bash
cd backend/bin

# Run with test instance
./pdptw_solver.exe --instance ../pdptw_solver_module/instances/lr107.txt

# If crashes, check output
```

**Step 3**: Validate instance format

```bash
# Check instance file format
head -20 backend/storage/temp/instance_*.txt

# Should match Li&Lim format:
# <vehicle_capacity> <max_routes> <depot_location>
# <num_customers>
# ...
```

**Step 4**: Check solver logs

```bash
# Solver may write logs to stderr
# Check backend console output during job processing
```

#### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Invalid instance format | Validate against Li&Lim or Sartori format spec |
| Time window violations | Ensure pickup time <= delivery time |
| Out of memory | Reduce instance size or increase server RAM |
| Missing nodes | Check instance has all pickup/delivery pairs |

---

### 4. CORS Errors

**Symptoms**: Browser console shows "CORS policy" error

#### Debug Steps

**Step 1**: Check browser error

```
Access to fetch at 'http://localhost:3001/api/jobs/submit' from origin 
'http://localhost:3000' has been blocked by CORS policy
```

**Step 2**: Verify backend CORS config

**File**: `backend/src/server.ts`

```typescript
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
```

**Step 3**: Check environment variable

```bash
# In backend/.env
CORS_ORIGIN=http://localhost:3000

# Or for production
CORS_ORIGIN=https://your-frontend.vercel.app
```

#### Fixes

**Development**:

```bash
# backend/.env
CORS_ORIGIN=http://localhost:3000
```

**Production**:

```bash
# On Render dashboard → Environment
CORS_ORIGIN=https://wayo.vercel.app,https://www.wayo.com
```

**Allow all (NOT recommended for production)**:

```bash
CORS_ORIGIN=*
```

---

## Testing

### Run Tests (when available)

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test

# C++ Solver
cd backend/pdptw_solver_module/build
ctest --verbose
```

### Manual Testing Checklist

- [ ] Submit instance → Job created
- [ ] Job processes → Status changes to "processing"
- [ ] Solver completes → Status changes to "completed"
- [ ] Result displays on map
- [ ] Routes are valid (no overlaps, time windows satisfied)
- [ ] Can assign route to driver
- [ ] Mobile app receives route data

---

## Performance

### Optimize Solver Runtime

```bash
# Reduce max iterations for faster (but less optimal) results
pdptw_solver.exe --instance input.txt --max-iterations 10000

# Use time limit instead
pdptw_solver.exe --instance input.txt --time-limit 60  # 60 seconds

# Use greedy acceptance (faster than SA/RTR)
pdptw_solver.exe --instance input.txt --acceptance greedy
```

### Optimize Frontend

```bash
# Build for production
cd frontend
npm run build

# Analyze bundle size
npm run build -- --analyze
```

---

## 🔗 Related Docs

- [Codebase Overview](./codebase-overview.md) - Understand the system
- [Architecture Overview](../architecture/overview.md) - System design
- [Deployment Guide](../guides/deployment.md) - Deploy to production

---

**Last Updated**: December 18, 2025
