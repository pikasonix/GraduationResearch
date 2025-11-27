# Backend Server - PDPTW Solver API

Backend API server với **Job Queue System** để giải bài toán Pickup and Delivery Problem with Time Windows (PDPTW).

## ✨ Đặc điểm

- 🔄 **Job Queue**: Xử lý tuần tự, tránh quá tải
- 📊 **Real-time Status**: Theo dõi tiến trình job
- ⏱️ **Timeout Protection**: Tự động hủy job quá thời gian
- 🧹 **Auto Cleanup**: Dọn dẹp job cũ tự động
- 🚀 **Graceful Shutdown**: Đóng server an toàn
- 📝 **RESTful API**: API rõ ràng, dễ sử dụng

## 🏗️ Kiến trúc

```
Client → Express Server → Job Queue → Solver Worker → pdptw_solver.exe
          ↓                  ↓
      API Routes         Sequential
                        Processing
```

**Lợi ích:**
- Chỉ chạy 1 solver tại một thời điểm → Tránh treo server
- Request được xếp hàng tự động → Không mất request
- Client nhận jobId ngay lập tức → Không phải đợi
- Poll status để biết tiến độ → Trải nghiệm tốt hơn

## 📦 Cài đặt

### 1. Install dependencies

```bash
npm install
```

### 2. Setup solver

Đặt `pdptw_solver.exe` vào thư mục `bin/`:

```
backend/
├── bin/
│   └── pdptw_solver.exe  👈 Đặt file exe ở đây
├── src/
└── server.js
```

### 3. Configure

Copy `.env.example` thành `.env`:

```bash
copy .env.example .env
```

## 🚀 Chạy server

```bash
npm start
```

Server sẽ chạy tại `http://localhost:3001`

## 📡 API Endpoints

### Submit Job

```http
POST /api/jobs/submit
Content-Type: application/json

{
  "instance": "string - nội dung file instance",
  "params": {
    "max_iterations": 100000,
    "time_limit": 300,
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "message": "Job submitted successfully"
}
```

### Get Job Status

```http
GET /api/jobs/:jobId
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "processing",
    "progress": 45,
    "queuePosition": 0,
    "result": null
  }
}
```

### Other Endpoints

- `GET /api/jobs` - List all jobs
- `GET /api/jobs/stats` - Queue statistics
- `DELETE /api/jobs/:jobId` - Delete job
- `GET /health` - Health check
- `POST /api/solve` - Legacy endpoint (for backward compatibility)

📖 **Chi tiết API**: Xem [API.md](./API.md)

## 🧪 Test

### Test với script có sẵn:

```bash
node test_queue.js
```

### Test thủ công:

```bash
# 1. Submit job
curl -X POST http://localhost:3001/api/jobs/submit \
  -H "Content-Type: application/json" \
  -d '{"instance":"...","params":{...}}'

# 2. Check status
curl http://localhost:3001/api/jobs/{jobId}

# 3. View queue stats
curl http://localhost:3001/api/jobs/stats
```

## ⚙️ Cấu hình

### Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PORT` | 3001 | Port server |
| `HOST` | 0.0.0.0 | Host address |
| `MAX_QUEUE_SIZE` | 100 | Số job tối đa trong queue |
| `JOB_TIMEOUT` | 3600000 | Timeout mỗi job (1 hour) |
| `CLEANUP_INTERVAL` | 300000 | Tần suất dọn dẹp (5 mins) |
| `MAX_JOB_AGE` | 86400000 | Thời gian lưu job (24 hours) |

### Solver Parameters

```json
{
  "max_iterations": 100000,
  "max_non_improving": 20000,
  "time_limit": 0,
  "min_destroy": 0.10,
  "max_destroy": 0.40,
  "seed": 42,
  "acceptance": "rtr",
  "log_level": "info",
  "max_vehicles": 0,
  "format": "auto"
}
```

## 📂 Cấu trúc Project

```
backend/
├── bin/
│   └── pdptw_solver.exe       # Solver executable
├── src/
│   ├── queue/
│   │   └── JobQueue.js        # Job queue manager
│   ├── workers/
│   │   ├── SolverWorker.js    # Solver worker
│   │   └── pdptwSolverWorker.ts  # (TypeScript version)
│   └── routes/
│       └── jobRoutes.js       # API routes
├── server.js                  # Main server
├── test_queue.js              # Test script
├── package.json
├── .env
└── README.md
```

## 🔄 Flow hoạt động

```
1. Client POST /api/jobs/submit
   ↓
2. Server tạo job, thêm vào queue
   ↓
3. Server trả về jobId ngay lập tức
   ↓
4. Queue xử lý job tuần tự (1 tại 1 thời điểm)
   ↓
5. Client poll GET /api/jobs/:jobId (mỗi 2-5s)
   ↓
6. Job hoàn thành, client lấy kết quả
```

## 🎯 Ví dụ sử dụng

### JavaScript/Node.js

```javascript
// Submit job
const response = await fetch('http://localhost:3001/api/jobs/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instance, params })
});
const { jobId } = await response.json();

// Poll status
const poll = setInterval(async () => {
  const res = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
  const { job } = await res.json();
  
  if (job.status === 'completed') {
    clearInterval(poll);
    console.log('Solution:', job.result.solution);
  }
}, 2000);
```

### Python

```python
import requests
import time

# Submit job
response = requests.post('http://localhost:3001/api/jobs/submit', 
  json={'instance': instance, 'params': params})
job_id = response.json()['jobId']

# Poll status
while True:
    response = requests.get(f'http://localhost:3001/api/jobs/{job_id}')
    job = response.json()['job']
    
    if job['status'] == 'completed':
        print(f"Solution: {job['result']['solution']}")
        break
    
    time.sleep(2)
```

## 🐛 Troubleshooting

### Queue đầy
```
Error: Queue is full. Please try again later.
```
→ Tăng `MAX_QUEUE_SIZE` hoặc đợi jobs cũ hoàn thành

### Job timeout
```
Error: Job timeout exceeded
```
→ Tăng `JOB_TIMEOUT` hoặc giảm `time_limit` trong params

### Solver not found
```
✗ Không tìm thấy pdptw_solver.exe
```
→ Đảm bảo file exe có trong `bin/` directory

## 📊 Monitoring

```bash
# View queue stats
curl http://localhost:3001/api/jobs/stats

# View pending jobs
curl http://localhost:3001/api/jobs?status=pending

# Health check
curl http://localhost:3001/health
```

## 🔐 Best Practices

1. **Polling**: Poll mỗi 2-5 giây (không quá thường xuyên)
2. **Timeout**: Luôn xử lý trường hợp timeout
3. **Error Handling**: Kiểm tra status failed
4. **Cleanup**: Xóa jobs cũ khi không cần
5. **Monitoring**: Theo dõi queue stats thường xuyên

## 📝 License

ISC

