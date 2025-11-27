# Queue System Architecture

## Tổng quan

Hệ thống Job Queue được thiết kế để xử lý các request giải PDPTW một cách tuần tự, tránh tình trạng server bị quá tải khi có nhiều request đồng thời.

## Kiến trúc

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                          │
│  (Frontend/API Consumer)                                      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         │ HTTP Request (POST/GET)
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      Express Server                           │
│                       (server.js)                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Routes Layer                         │  │
│  │  /api/jobs/submit  → Create new job                    │  │
│  │  /api/jobs/:id     → Get job status                    │  │
│  │  /api/jobs         → List jobs                         │  │
│  │  /api/jobs/stats   → Queue statistics                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  JobQueue Class                         │  │
│  │            (src/queue/JobQueue.js)                      │  │
│  │                                                          │  │
│  │  State:                                                  │  │
│  │  • jobs: Map<jobId, job>    - All jobs                 │  │
│  │  • queue: Array<jobId>      - Pending jobs             │  │
│  │  • processing: boolean      - Is processing?           │  │
│  │  • currentJobId: string     - Current job              │  │
│  │                                                          │  │
│  │  Methods:                                                │  │
│  │  • createJob()              - Add to queue             │  │
│  │  • processNext()            - Process next job         │  │
│  │  • completeJob()            - Mark as done             │  │
│  │  • failJob()                - Mark as failed           │  │
│  │  • cleanup()                - Remove old jobs          │  │
│  │                                                          │  │
│  │  Events:                                                 │  │
│  │  • processJob               - Job ready to process     │  │
│  │  • jobCompleted             - Job finished             │  │
│  │  • jobFailed                - Job failed               │  │
│  └────────────────────┬───────────────────────────────────┘  │
│                       │                                        │
│                       │ Event: processJob                     │
│                       ▼                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               SolverWorker Class                        │  │
│  │            (src/workers/SolverWorker.js)                │  │
│  │                                                          │  │
│  │  • Create temp directory                                │  │
│  │  • Write instance file                                  │  │
│  │  • Build command arguments                              │  │
│  │  • Execute pdptw_solver.exe                            │  │
│  │  • Read solution file                                   │  │
│  │  • Cleanup temp files                                   │  │
│  │  • Return result via callback                           │  │
│  └────────────────────┬───────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │
                         │ execFile()
                         ▼
              ┌──────────────────────┐
              │  pdptw_solver.exe    │
              │   (bin/pdptw_solver  │
              │        .exe)         │
              └──────────────────────┘
```

## Luồng xử lý (Flow)

### 1. Submit Job

```
Client → POST /api/jobs/submit
         ↓
      Validate request
         ↓
      JobQueue.createJob()
         ↓
      • Generate UUID
      • Create job object
      • Add to queue
      • Emit 'jobCreated'
         ↓
      processNext() if not busy
         ↓
      Return jobId to client (NGAY LẬP TỨC)
```

### 2. Process Job (Sequential)

```
JobQueue checks:
  • Is processing? → Wait
  • Queue empty?  → Do nothing
  • Else → Process next

Processing:
  ↓
  Pop from queue
  ↓
  Set status = 'processing'
  ↓
  Emit 'processJob' event
  ↓
  SolverWorker.solve()
    ↓
    • Create temp dir
    • Write instance file
    • Execute solver
    • Read solution
    • Cleanup
    ↓
  Callback: completeJob() or failJob()
  ↓
  Set processing = false
  ↓
  processNext() → Process next job
```

### 3. Poll Status

```
Client → GET /api/jobs/:jobId (every 2-5 seconds)
         ↓
      Get job from JobQueue
         ↓
      Calculate:
      • Queue position
      • Progress %
      • Duration
         ↓
      Return status to client
```

## Trạng thái Job

```
[pending] → Trong hàng đợi
    ↓
[processing] → Đang xử lý (chỉ 1 job tại 1 thời điểm)
    ↓
    ├─→ [completed] → Thành công (có result)
    └─→ [failed]    → Thất bại (có error)
```

## Đảm bảo không quá tải

### 1. Sequential Processing
- Chỉ xử lý **1 job** tại một thời điểm
- Job khác phải đợi trong queue
- Không có race condition

### 2. Queue Limits
- `MAX_QUEUE_SIZE`: Giới hạn số job trong queue
- Reject request mới nếu queue đầy
- Client phải retry sau

### 3. Timeouts
- `JOB_TIMEOUT`: Tự động fail job chạy quá lâu
- Giải phóng resource cho job khác

### 4. Auto Cleanup
- Định kỳ xóa job cũ (completed/failed)
- Giảm memory usage
- `MAX_JOB_AGE`: Thời gian lưu job

## Ưu điểm

### ✅ Tránh quá tải server
- CPU: Chỉ chạy 1 solver tại 1 thời điểm
- Memory: Giới hạn số job trong queue
- Disk I/O: Cleanup tự động

### ✅ Trải nghiệm người dùng tốt
- Response ngay lập tức (không phải đợi)
- Biết được vị trí trong queue
- Theo dõi progress real-time

### ✅ Dễ scale
- Có thể thêm worker pool sau này
- Có thể chuyển sang distributed queue (Redis, RabbitMQ)
- Architecture rõ ràng, dễ mở rộng

### ✅ Fault tolerance
- Job timeout protection
- Error handling tốt
- Graceful shutdown

## Cấu hình tối ưu

### Production (Server mạnh)
```env
MAX_QUEUE_SIZE=100
JOB_TIMEOUT=7200000      # 2 hours
CLEANUP_INTERVAL=300000   # 5 minutes
MAX_JOB_AGE=86400000     # 24 hours
```

### Development (Server yếu)
```env
MAX_QUEUE_SIZE=10
JOB_TIMEOUT=1800000      # 30 minutes
CLEANUP_INTERVAL=600000   # 10 minutes
MAX_JOB_AGE=3600000      # 1 hour
```

## Monitoring

### Check queue status
```bash
curl http://localhost:3001/api/jobs/stats
```

Response:
```json
{
  "total": 25,
  "pending": 3,
  "processing": 1,
  "completed": 20,
  "failed": 1,
  "queueLength": 3,
  "currentJobId": "uuid-..."
}
```

### View current job
```bash
curl http://localhost:3001/health
```

### View all pending jobs
```bash
curl http://localhost:3001/api/jobs?status=pending
```

## Troubleshooting

### Queue đầy liên tục
**Nguyên nhân:** Jobs xử lý chậm, request đến nhanh

**Giải pháp:**
1. Tăng `MAX_QUEUE_SIZE`
2. Giảm `time_limit` trong params
3. Tăng `JOB_TIMEOUT` để không bị timeout sớm
4. Scale horizontal (thêm server)

### Memory leak
**Nguyên nhân:** Jobs không được cleanup

**Giải pháp:**
1. Giảm `MAX_JOB_AGE`
2. Giảm `CLEANUP_INTERVAL`
3. Xóa jobs cũ thủ công qua API

### Job bị stuck
**Nguyên nhân:** Solver bị treo

**Giải pháp:**
1. Giảm `JOB_TIMEOUT`
2. Restart server
3. Check solver logs

## Future Improvements

### 1. Worker Pool
```javascript
// Multiple workers processing jobs in parallel
const workerPool = new WorkerPool(numWorkers);
```

### 2. Priority Queue
```javascript
// High priority jobs processed first
jobQueue.createJob(instance, params, { priority: 'high' });
```

### 3. Job Persistence
```javascript
// Save jobs to database
// Survive server restarts
jobQueue.saveToDatabase();
```

### 4. Distributed Queue
```javascript
// Use Redis/RabbitMQ for distributed processing
// Scale across multiple servers
```

### 5. WebSocket Support
```javascript
// Real-time updates instead of polling
socket.on('jobProgress', (data) => {...});
```

## Kết luận

Hệ thống Job Queue giúp backend xử lý nhiều request một cách hiệu quả, tránh quá tải và cung cấp trải nghiệm người dùng tốt hơn. Architecture rõ ràng, dễ maintain và có thể mở rộng trong tương lai.
