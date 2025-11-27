# Backend API Documentation

Backend server với hệ thống Job Queue để giải bài toán PDPTW (Pickup and Delivery Problem with Time Windows).

## Kiến trúc hệ thống

```
┌─────────────┐
│   Client    │
│  (Frontend) │
└──────┬──────┘
       │
       │ POST /api/jobs/submit
       │ GET  /api/jobs/:jobId
       ▼
┌─────────────────────────┐
│    Express Server       │
│                         │
│  ┌──────────────────┐  │
│  │   Job Queue      │  │
│  │   (Sequential)   │  │
│  │                  │  │
│  │ [Job1] → [Job2]  │  │
│  │    ↓              │  │
│  │ Processing        │  │
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼─────────┐   │
│  │  Solver Worker   │   │
│  └────────┬─────────┘   │
└───────────┼─────────────┘
            │
            ▼
    ┌───────────────┐
    │ pdptw_solver  │
    │    (.exe)     │
    └───────────────┘
```

## Đặc điểm

- ✅ **Xử lý tuần tự**: Chỉ chạy 1 job tại một thời điểm
- ✅ **Hàng đợi**: Các request được xếp hàng tự động
- ✅ **Job tracking**: Theo dõi trạng thái real-time
- ✅ **Timeout protection**: Tự động hủy job chạy quá lâu
- ✅ **Auto cleanup**: Tự động xóa job cũ
- ✅ **Graceful shutdown**: Đóng server an toàn

## API Endpoints

### 1. Submit Job (Gửi job mới)

```http
POST /api/jobs/submit
Content-Type: application/json

{
  "instance": "string - nội dung file instance",
  "params": {
    "max_iterations": 100000,
    "max_non_improving": 20000,
    "time_limit": 300,
    "min_destroy": 0.10,
    "max_destroy": 0.40,
    "seed": 42,
    "acceptance": "rtr",
    "log_level": "info",
    "max_vehicles": 0,
    "format": "auto"
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid-string",
  "message": "Job submitted successfully"
}
```

### 2. Get Job Status (Kiểm tra trạng thái)

```http
GET /api/jobs/:jobId
```

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid-string",
    "status": "processing",
    "progress": 45,
    "queuePosition": 0,
    "createdAt": 1234567890,
    "startedAt": 1234567900,
    "completedAt": null,
    "duration": "10.5",
    "error": null,
    "result": null
  }
}
```

**Job Status:**
- `pending`: Đang chờ trong hàng đợi
- `processing`: Đang xử lý
- `completed`: Hoàn thành
- `failed`: Thất bại
- `cancelled`: Đã hủy

### 3. Get All Jobs (Danh sách jobs)

```http
GET /api/jobs?status=completed&limit=10
```

**Query Parameters:**
- `status`: Lọc theo trạng thái (optional)
- `limit`: Giới hạn số lượng (optional)

**Response:**
```json
{
  "success": true,
  "jobs": [...],
  "count": 10
}
```

### 4. Delete Job (Xóa job)

```http
DELETE /api/jobs/:jobId
```

**Response:**
```json
{
  "success": true,
  "message": "Job deleted successfully"
}
```

**Note:** Không thể xóa job đang processing.

### 5. Get Queue Stats (Thống kê)

```http
GET /api/jobs/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 25,
    "pending": 3,
    "processing": 1,
    "completed": 20,
    "failed": 1,
    "queueLength": 3,
    "currentJobId": "uuid-string"
  }
}
```

### 6. Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "queue": { ... },
  "solver": "path/to/solver.exe"
}
```

### 7. Legacy Endpoint (Backward compatibility)

```http
POST /api/solve
```

Endpoint cũ vẫn hoạt động nhưng trả về jobId thay vì kết quả trực tiếp.

## Cách sử dụng

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình

Copy `.env.example` thành `.env` và điều chỉnh:

```bash
copy .env.example .env
```

### 3. Đặt solver vào thư mục bin

```
backend/
├── bin/
│   └── pdptw_solver.exe  👈 Đặt file exe ở đây
├── src/
└── server.js
```

### 4. Chạy server

```bash
npm start
```

## Flow hoạt động

### Khi client gửi request:

1. **Submit**: Client POST `/api/jobs/submit`
2. **Queue**: Job được thêm vào hàng đợi
3. **Response**: Server trả về `jobId` ngay lập tức
4. **Process**: Job được xử lý tuần tự
5. **Poll**: Client dùng `jobId` để kiểm tra status
6. **Complete**: Client lấy kết quả khi status = "completed"

### Ví dụ code client:

```javascript
// 1. Submit job
const response = await fetch('http://localhost:3001/api/jobs/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instance, params })
});
const { jobId } = await response.json();

// 2. Poll status (mỗi 2 giây)
const pollInterval = setInterval(async () => {
  const statusRes = await fetch(`http://localhost:3001/api/jobs/${jobId}`);
  const { job } = await statusRes.json();
  
  console.log(`Status: ${job.status}, Progress: ${job.progress}%`);
  
  if (job.status === 'completed') {
    clearInterval(pollInterval);
    console.log('Solution:', job.result.solution);
  } else if (job.status === 'failed') {
    clearInterval(pollInterval);
    console.error('Error:', job.error);
  }
}, 2000);
```

## Cấu hình nâng cao

### Environment Variables

| Variable | Default | Mô tả |
|----------|---------|-------|
| `PORT` | 3001 | Port của server |
| `HOST` | 0.0.0.0 | Host address |
| `MAX_QUEUE_SIZE` | 100 | Số job tối đa trong queue |
| `JOB_TIMEOUT` | 3600000 | Timeout cho mỗi job (ms) |
| `CLEANUP_INTERVAL` | 300000 | Tần suất dọn dẹp (ms) |
| `MAX_JOB_AGE` | 86400000 | Thời gian lưu job cũ (ms) |
| `PDPTW_SOLVER_PATH` | bin/pdptw_solver.exe | Đường dẫn solver |
| `APP_WORK_DIR` | System temp | Thư mục làm việc |

### Solver Parameters

Tham số được truyền vào field `params`:

- `max_iterations` (int): Số vòng lặp tối đa
- `max_non_improving` (int): Số vòng không cải thiện
- `time_limit` (float): Giới hạn thời gian (giây)
- `min_destroy`, `max_destroy` (float): Tỷ lệ phá hủy
- `seed` (int): Random seed
- `acceptance` (string): "sa", "rtr", hoặc "greedy"
- `log_level` (string): "trace", "debug", "info", "warn", "error"
- `max_vehicles` (int): Số xe tối đa (0 = auto)
- `format` (string): "auto", "lilim", "sartori"

## Troubleshooting

### Queue đầy

```json
{
  "success": false,
  "error": "Queue is full. Please try again later."
}
```

**Giải pháp:** Tăng `MAX_QUEUE_SIZE` hoặc đợi jobs cũ hoàn thành.

### Job timeout

```json
{
  "status": "failed",
  "error": "Job timeout exceeded"
}
```

**Giải pháp:** Tăng `JOB_TIMEOUT` hoặc giảm `time_limit` trong params.

### Solver not found

```
✗ Không tìm thấy pdptw_solver.exe
```

**Giải pháp:** Đảm bảo file `pdptw_solver.exe` có trong thư mục `bin/`.

## Monitoring

### Xem queue stats

```bash
curl http://localhost:3001/api/jobs/stats
```

### Xem danh sách jobs pending

```bash
curl http://localhost:3001/api/jobs?status=pending
```

### Xem job đang chạy

```bash
curl http://localhost:3001/health
```

## Best Practices

1. **Polling interval**: Nên poll mỗi 2-5 giây
2. **Timeout handling**: Luôn xử lý trường hợp timeout
3. **Error handling**: Kiểm tra status failed
4. **Cleanup**: Xóa jobs cũ khi không cần
5. **Queue monitoring**: Theo dõi queue stats

## License

ISC
