# WAYO Backend

## Giới thiệu chung

WAYO Backend là hệ thống backend API cho nền tảng quản lý và tối ưu hóa lộ trình giao hàng. Dự án được xây dựng bằng Node.js với Express framework, tích hợp bộ giải thuật tối ưu hóa lộ trình PDPTW được viết bằng Rust.

Hệ thống cung cấp các API RESTful để quản lý tác vụ tối ưu hóa, theo dõi trạng thái công việc, và hỗ trợ ứng dụng mobile cho tài xế. Backend kết nối với Supabase để quản lý dữ liệu tổ chức, đơn hàng, lộ trình và tài xế.

## Hướng dẫn cài đặt

### Yêu cầu hệ thống

- Node.js phiên bản 18 trở lên
- npm hoặc yarn
- Bộ giải PDPTW Solver đã được build (pdptw_solver_rust.exe (rust - ưu tiên) hoặc pdptw_solver.exe (c++))

### Các bước cài đặt

**1. Cài đặt dependencies**

```powershell
cd backend
npm install
```

**2. Cấu hình biến môi trường**

Tạo file `.env` trong thư mục `backend/`:

```properties
# Cấu hình server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Supabase (bắt buộc cho mobile API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# CORS (tùy chọn)
CORS_ORIGIN=*

# Job Queue (tùy chọn)
MAX_QUEUE_SIZE=100
JOB_TIMEOUT=3600000
CLEANUP_INTERVAL=300000
MAX_JOB_AGE=86400000

# Solver
PDPTW_SOLVER_PATH=D:\path\to\pdptw_solver.exe

# File upload (tùy chọn)
MAX_FILE_SIZE=5mb
```

**3. Chuẩn bị Solver executable**

Đảm bảo có một trong các file sau trong thư mục `backend/bin/`:
- `pdptw_solver_rust.exe` (ưu tiên)
- `pdptw_solver.exe` (C++ version)

Thiết lập biến môi trường `PDPTW_SOLVER_PATH` để trỏ đến file thực thi.

**4. Khởi chạy server**

Chế độ development (với hot-reload):

```powershell
npm run dev
```

Build và chạy production:

```powershell
npm run build
npm start
```

**5. Kiểm tra server**

Truy cập endpoint health check:

```
GET http://localhost:3001/api/mobile/health
```

Kết quả mong đợi:
```json
{
  "status": "ok",
  "supabaseEnabled": true
}
```

Lưu ý: Android Emulator sử dụng `http://10.0.2.2:3001` để kết nối tới server trên máy host.

## Cấu trúc project

```
backend/
├── src/                          # Mã nguồn chính
│   ├── server.ts                 # Entry point, khởi tạo Express server
│   ├── supabaseAdmin.ts          # Supabase admin client
│   ├── routes/                   # API routes
│   │   ├── jobRoutes.ts          # API quản lý job tối ưu hóa
│   │   └── mobileRoutes.ts       # API cho ứng dụng mobile
│   ├── queue/                    # Job queue management
│   │   └── JobQueue.ts           # Hàng đợi xử lý job FIFO
│   ├── workers/                  # Solver workers
│   │   ├── SolverWorker.ts       # Xử lý chạy PDPTW solver
│   │   ├── dummyNodeCleaner.ts   # Xử lý dummy nodes
│   │   └── reoptimizationPreprocessor.ts  # Tiền xử lý reoptimization
│   ├── persistence/              # Lưu trữ dữ liệu
│   │   ├── persistSolutionSnapshot.ts  # Lưu solution vào DB
│   │   ├── parseSolverSolution.ts      # Parse kết quả solver
│   │   └── cleanMappingIds.ts          # Xử lý mapping IDs
│   ├── enrichment/               # Data enrichment
│   │   └── enrichmentClient.ts   # Client cho external services
│   └── types/                    # TypeScript type definitions
│       └── index.ts              # Interface và type definitions
├── bin/                          # Solver executables
│   ├── pdptw_solver_rust.exe     # Rust solver (ưu tiên)
│   └── pdptw_solver.exe          # C++ solver
├── storage/                      # Thư mục lưu trữ tạm
│   ├── temp/                     # Temp files cho solver
│   ├── input.txt                 # Input instance
│   └── output.txt                # Output solution
├── test_output/                  # Kết quả test
├── pdptw_solver_module/          # C++ solver source code
├── pdptw_solver_module_v2/       # Rust solver v2
├── pdptw_solver_module_v2_origin/# Rust solver v2 origin
├── pdptw_solver_module_v2.1/     # Rust solver v2.1
├── scripts/                      # Utility scripts
├── package.json                  # NPM dependencies
├── tsconfig.json                 # TypeScript configuration
└── .env                          # Environment variables
```

### Mô tả chi tiết các thành phần

**server.ts**
- Entry point của ứng dụng
- Khởi tạo Express server với middleware (CORS, JSON parser)
- Tự động detect và validate PDPTW solver executable
- Khởi tạo JobQueue và SolverWorker
- Thiết lập các route handlers
- Xử lý lifecycle của job (onComplete, onFail, onProgress)

**JobQueue (queue/JobQueue.ts)**
- Quản lý hàng đợi job theo cơ chế FIFO
- Xử lý tuần tự từng job một để tránh quá tải
- Theo dõi trạng thái job: pending, processing, completed, failed, cancelled
- Tự động cleanup các job cũ
- Event emitter để thông báo trạng thái job

**SolverWorker (workers/SolverWorker.ts)**
- Spawn và quản lý process của PDPTW solver
- Tạo thư mục làm việc tạm thời cho mỗi job
- Xây dựng arguments cho solver từ SolverParams
- Capture stdout/stderr từ solver process
- Xử lý cả static mode (file output) và dynamic mode (JSON output)
- Cleanup resources sau khi hoàn thành

**Routes**
- jobRoutes.ts: API cho việc submit, theo dõi, và quản lý các job tối ưu hóa
- mobileRoutes.ts: API cho ứng dụng mobile (driver app), bao gồm xác thực, quản lý route, và tracking

**Persistence**
- Lưu trữ solution snapshots vào database
- Parse và validate kết quả từ solver
- Quản lý mapping giữa internal IDs và database IDs
- Hỗ trợ reoptimization với previous solution reference

## Tính năng và API

### 1. Job Management API

Base path: `/api/jobs`

#### POST /api/jobs/submit
Submit một job tối ưu hóa mới vào hàng đợi.

**Request Body:**
```json
{
  "instance": "string",           // Instance data theo format Lilim hoặc Sartori
  "params": {                     // Solver parameters (xem phần SolverParams)
    "iterations": 100000,
    "time_limit": 300,
    "acceptance": "rtr"
  },
  "organizationId": "uuid",       // Optional: Organization ID
  "createdBy": "uuid",            // Optional: User ID
  "inputData": {}                 // Optional: Metadata
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

#### GET /api/jobs/:jobId
Lấy thông tin chi tiết và trạng thái của một job.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "status": "processing",       // pending | processing | completed | failed | cancelled
    "progress": 45,               // 0-100
    "queuePosition": 0,           // Vị trí trong hàng đợi (nếu pending)
    "createdAt": 1234567890,
    "startedAt": 1234567900,
    "completedAt": null,
    "duration": "10.50",          // Thời gian xử lý (giây)
    "error": null,
    "result": {                   // Chỉ có khi status = completed
      "solution": "...",
      "filename": "...",
      "stdout": "...",
      "persisted": true,
      "solutionId": "uuid"
    }
  }
}
```

#### DELETE /api/jobs/:jobId
Hủy hoặc xóa một job.

- Nếu job đang pending hoặc processing: job sẽ bị cancel
- Nếu job đã completed hoặc failed: job sẽ bị xóa khỏi hệ thống

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

#### GET /api/jobs
Lấy danh sách tất cả các job.

**Query Parameters:**
- `status`: Filter theo trạng thái (pending, processing, completed, failed)
- `limit`: Giới hạn số lượng kết quả

**Response:**
```json
{
  "success": true,
  "jobs": [...],
  "count": 10
}
```

#### POST /api/jobs/reoptimize
Submit một job reoptimization với vehicle states và order deltas.

**Request Body:**
```json
{
  "reoptimizationContext": {
    "organization_id": "uuid",
    "previous_solution_id": "uuid",   // Optional: Previous solution reference
    "vehicle_states": [
      {
        "vehicle_id": "uuid",
        "route_id": "uuid",
        "current_location_id": "uuid",
        "current_time": "2024-01-15T10:30:00Z",
        "completed_stops": [...]
      }
    ],
    "order_delta": {
      "new_order_ids": ["uuid1", "uuid2"],
      "cancelled_order_ids": ["uuid3"]
    }
  },
  "params": {
    "dynamic": true,
    "iterations": 50000,
    "time_limit": 60
  },
  "createdBy": "uuid"
}
```

**Response:** Tương tự POST /api/jobs/submit

### 2. Mobile API (Driver App)

Base path: `/api/mobile`

Tất cả các endpoint yêu cầu xác thực qua Bearer token trong header `Authorization: Bearer <token>`.

#### GET /api/mobile/health
Health check endpoint, không yêu cầu authentication.

**Response:**
```json
{
  "status": "ok",
  "supabaseEnabled": true
}
```

#### GET /api/mobile/driver/me
Lấy thông tin profile của driver hiện tại.

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "full_name": "Nguyễn Văn A",
  "phone": "0123456789",
  "avatar_url": null,
  "rating": null,
  "total_deliveries": null,
  "status": "active",           // active | inactive
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z"
}
```

#### GET /api/mobile/routes/assigned
Lấy danh sách routes được giao cho driver.

**Query Parameters:**
- `status`: Filter theo trạng thái (planned, assigned, in_progress, completed)

**Response:**
```json
{
  "routes": [
    {
      "id": "uuid",
      "driver_id": "uuid",
      "vehicle_id": "uuid",
      "status": "assigned",
      "scheduled_date": "2024-01-15",
      "started_at": null,
      "completed_at": null,
      "total_stops": 10,
      "completed_stops": 0,
      "created_at": "2024-01-15T00:00:00Z",
      "updated_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

#### GET /api/mobile/routes/:id
Lấy chi tiết một route cụ thể và danh sách stops.

**Response:**
```json
{
  "route": {
    "id": "uuid",
    "status": "in_progress",
    "total_stops": 10,
    "completed_stops": 3,
    ...
  },
  "stops": [
    {
      "id": "uuid",
      "route_id": "uuid",
      "sequence": 1,
      "location_name": "123 Nguyễn Huệ",
      "latitude": 21.0285,
      "longitude": 105.8542,
      "type": "pickup",           // pickup | delivery
      "status": "completed",      // pending | completed
      "scheduled_time": "2024-01-15T09:00:00Z",
      "time_window_start": "2024-01-15T08:00:00Z",
      "time_window_end": "2024-01-15T10:00:00Z",
      "completed_at": "2024-01-15T09:15:00Z",
      "orders": [
        {
          "id": "uuid",
          "order_number": "ORD-001",
          "customer_name": "Nguyễn Văn B",
          "customer_phone": "0987654321",
          "items_count": 1,
          "status": "in_transit"
        }
      ]
    }
  ]
}
```

#### POST /api/mobile/routes/:id/start
Bắt đầu thực hiện một route.

**Request Body:**
```json
{
  "started_at": "2024-01-15T08:00:00Z"
}
```

**Response:**
```json
{
  "route": {...},
  "message": "Route started"
}
```

#### POST /api/mobile/routes/:id/complete
Hoàn thành một route.

**Request Body:**
```json
{
  "completed_at": "2024-01-15T16:00:00Z"
}
```

**Response:**
```json
{
  "route": {...},
  "message": "Route completed"
}
```

#### POST /api/mobile/stops/:id/complete
Đánh dấu hoàn thành một stop.

**Request Body:**
```json
{
  "completed_at": "2024-01-15T09:15:00Z",
  "notes": "Giao hàng thành công"    // Optional
}
```

**Response:**
```json
{
  "stop": {...},
  "message": "Stop completed"
}
```

Logic xử lý:
- Khi complete pickup stop: Order status chuyển thành "in_transit"
- Khi complete cả pickup và delivery stop: Order status chuyển thành "completed"

#### POST /api/mobile/tracking/ping
Gửi location ping từ mobile app.

**Request Body:**
```json
{
  "latitude": 21.0285,
  "longitude": 105.8542,
  "timestamp": "2024-01-15T09:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ok"
}
```

#### POST /api/mobile/sync/outbox
Đồng bộ các actions từ mobile offline queue.

**Request Body:**
```json
{
  "actions": [
    {
      "id": "local-uuid-1",
      "type": "COMPLETE_STOP",
      "payload": "{...}",
      "timestamp": "2024-01-15T09:15:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "processed": [
    {
      "id": "local-uuid-1",
      "success": true,
      "error": null
    }
  ]
}
```

### 3. Solver Parameters

Interface `SolverParams` định nghĩa các tham số có thể truyền cho PDPTW solver:

**LNS Parameters:**
- `iterations`: Số vòng lặp tối đa (mặc định: 100000)
- `max_non_improving`: Số vòng không cải thiện trước khi dừng (mặc định: 20000)
- `time_limit`: Giới hạn thời gian tính bằng giây (mặc định: 0 - không giới hạn)
- `min_destroy`: Tỷ lệ phá hủy tối thiểu (mặc định: 0.1)
- `max_destroy`: Tỷ lệ phá hủy tối đa (mặc định: 0.4)
- `min_destroy_count`: Số lượng request phá hủy tối thiểu
- `max_destroy_count`: Số lượng request phá hủy tối đa
- `acceptance`: Chiến lược chấp nhận nghiệm ('sa' | 'rtr' | 'greedy')

**General Configuration:**
- `seed`: Random seed (mặc định: 42)
- `max_vehicles`: Số xe tối đa (mặc định: 0 - dùng max từ instance)
- `log_level`: Mức độ log ('trace' | 'debug' | 'info' | 'warn' | 'error')
- `format`: Format của instance ('lilim' | 'sartori')

**Dynamic Re-optimization:**
- `dynamic`: Bật chế độ dynamic reoptimization
- `vehicle_states`: Trạng thái hiện tại của các xe
- `new_requests`: Các request mới cần gán vào lộ trình
- `late_penalty`: Phạt khi đến muộn (mặc định: 1000)
- `unassigned_penalty`: Phạt khi không gán được request (mặc định: 10000)
- `lock_committed`: Khóa các request đã cam kết
- `lock_time_threshold`: Ngưỡng thời gian để khóa request (giây)

### 4. Job Queue System

Hệ thống Job Queue quản lý các tác vụ tối ưu hóa theo cơ chế:

**Đặc điểm:**
- Xử lý tuần tự (FIFO) - chỉ 1 job được xử lý tại một thời điểm
- Tự động cleanup các job cũ sau thời gian cấu hình
- Timeout protection cho các job chạy quá lâu
- Event-driven architecture để tracking lifecycle

**Job States:**
- `pending`: Job đang chờ trong hàng đợi
- `processing`: Job đang được xử lý bởi solver
- `completed`: Job hoàn thành thành công
- `failed`: Job thất bại do lỗi
- `cancelled`: Job bị hủy bởi người dùng

**Events:**
- `jobCreated`: Phát ra khi job mới được tạo
- `processJob`: Phát ra khi job bắt đầu được xử lý
- `jobCompleted`: Phát ra khi job hoàn thành
- `jobFailed`: Phát ra khi job thất bại
- `jobCancelled`: Phát ra khi job bị hủy

### 5. Persistence và Database Integration

Backend tích hợp với Supabase để lưu trữ và quản lý dữ liệu:

**Các bảng chính:**
- `organizations`: Thông tin tổ chức, depot
- `drivers`: Thông tin tài xế
- `vehicles`: Thông tin phương tiện
- `orders`: Đơn hàng cần giao
- `locations`: Địa điểm pickup/delivery
- `optimization_jobs`: Lịch sử các job tối ưu hóa
- `solutions`: Các solution đã tạo
- `routes`: Lộ trình cho xe
- `route_stops`: Các điểm dừng trong lộ trình

**Persistence Flow:**
1. Job được submit qua API
2. JobQueue xếp job vào hàng đợi
3. SolverWorker chạy solver executable
4. Kết quả được parse và validate
5. Solution được lưu vào database
6. Routes và stops được tạo từ solution
7. Notification gửi đến drivers liên quan

### 6. Reoptimization

Hệ thống hỗ trợ tái tối ưu hóa lộ trình khi có thay đổi:

**Trigger scenarios:**
- Có đơn hàng mới
- Đơn hàng bị hủy
- Xe gặp sự cố
- Thay đổi ưu tiên

**Process:**
1. Lấy vehicle states hiện tại từ database
2. Xác định completed stops không thể thay đổi
3. Lấy danh sách orders mới và cancelled
4. Gọi solver với dynamic mode
5. Parse kết quả và cleanup dummy nodes
6. Cập nhật routes và stops trong database
7. Notify drivers về thay đổi

## Scripts và Utilities

Thư mục `scripts/` chứa các utility scripts hỗ trợ:

- `analyze-instance.ts`: Phân tích instance file
- `check-orders-solver-feasibility.ts`: Kiểm tra tính khả thi của orders
- `check-orders-timewindows.ts`: Validate time windows
- `check-solution-coords.ts`: Validate coordinates trong solution
- `debug-rust-indexing.ts`: Debug indexing issues
- `simulate-rust-solver.ts`: Mô phỏng chạy solver
- `test-instance-generation.ts`: Generate test instances

## Lưu ý

**Performance Considerations:**
- Job queue xử lý tuần tự để tránh CPU overload
- Solver có thể chạy lâu (hàng phút đến giờ) tùy thuộc kích thước instance
- Cần cleanup temp files định kỳ trong `storage/temp/`
- Database connection pool cần cấu hình phù hợp với load

**Security:**
- Mobile API yêu cầu Bearer token authentication
- Supabase RLS policies bảo vệ dữ liệu organization-level
- Service role key chỉ được dùng trên server-side
- CORS cần cấu hình chính xác cho production

**Error Handling:**
- Solver errors được capture từ stdout/stderr
- Job timeout protection
- Graceful degradation khi Supabase không available
- Comprehensive logging cho debugging
