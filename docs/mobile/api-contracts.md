# API Contracts (Supabase + Backend) — Mobile

Tài liệu này định nghĩa **những API bắt buộc** để mobile (driver app) hoạt động ổn định (online/offline) và dễ test.

## 0) Quy ước chung

### 0.1 Auth

- Backend: `Authorization: Bearer <access_token>`
- Supabase: session do Supabase SDK quản lý; với REST PostgREST cũng cần Bearer token.

### 0.2 Error format (Backend)

Backend nên trả về cấu trúc lỗi thống nhất:

```json
{
  "error": {
    "code": "VALIDATION_ERROR|UNAUTHORIZED|NOT_FOUND|CONFLICT|RATE_LIMITED|INTERNAL",
    "message": "...",
    "details": { "field": "reason" }
  }
}
```

### 0.3 Idempotency

Các endpoint ghi dữ liệu (start/complete/stop update/tracking) nên hỗ trợ idempotency:
- Header: `Idempotency-Key: <uuid>`

## 1) Supabase (Auth + PostgREST)

### 1.1 Auth flows

- Sign in: email/password
- Sign up: email/password + metadata (full_name, phone)
- Reset password: email

Mobile requirements:
- refresh token handling
- logout

### 1.2 Tables (mobile cần đọc/ghi)

> Tên bảng dựa trên schema hiện tại.

- `users`: thông tin user
- `drivers`: profile tài xế (mapping user_id)
- `vehicles`: thông tin xe + `default_driver_id`
- `routes`: tuyến + trạng thái (assigned/in_progress/completed)
- `route_stops`: danh sách điểm dừng, trạng thái hoàn tất
- `orders`: chi tiết đơn
- `vehicle_tracking`: ping vị trí

### 1.3 RLS policies (bắt buộc)

- Driver chỉ thấy dữ liệu thuộc `organization_id` và/hoặc `driver_id == auth.user_id` (tùy mapping).
- Driver chỉ update các route/stop của chính mình.

### 1.4 RPC (khuyến nghị để giảm round-trip)

1) `rpc_get_driver_home(driver_user_id uuid)`
- Trả về: driver profile + vehicle hiện tại + route active + stops summary.

2) `rpc_mark_stop_completed(stop_id uuid, completed_at timestamptz, lat numeric, lng numeric)`
- Atomic update stop + update order status.

3) `rpc_start_route(route_id uuid, started_at timestamptz)`
- Atomic route status.

## 2) Backend API (đề xuất tối thiểu)

Backend nên cung cấp REST API riêng cho mobile để:
- đồng bộ offline actions (outbox)
- reoptimize / fetch solution artifacts
- thống nhất business rules (tránh client tự quyết)

### 2.1 Driver

#### GET `/api/mobile/driver/me`
Trả về profile driver hiện tại.

Response:
```json
{
  "driver": {
    "id": "uuid",
    "organizationId": "uuid",
    "fullName": "...",
    "phone": "...",
    "vehicle": { "id": "uuid", "licensePlate": "..." }
  }
}
```

### 2.2 Routes

#### GET `/api/mobile/routes/assigned`
Danh sách routes assigned/in_progress của driver.

Response:
```json
{ "routes": [ { "id": "uuid", "status": "ASSIGNED", "totalDistanceKm": 12.3 } ] }
```

#### POST `/api/mobile/routes/{routeId}/start`
Request:
```json
{ "startedAt": "2026-01-12T10:00:00Z" }
```

#### POST `/api/mobile/routes/{routeId}/complete`
Request:
```json
{ "completedAt": "2026-01-12T12:00:00Z" }
```

### 2.3 Stops / Orders

#### GET `/api/mobile/routes/{routeId}`
Trả về route + stops + order summary để render RecyclerView.

#### POST `/api/mobile/stops/{stopId}/complete`
Request:
```json
{
  "completedAt": "2026-01-12T10:30:00Z",
  "proof": { "type": "NONE|PHOTO|SIGNATURE", "url": null },
  "location": { "lat": 10.123, "lng": 106.123 }
}
```

### 2.4 Tracking

#### POST `/api/mobile/tracking/ping`
Request:
```json
{
  "routeId": "uuid",
  "vehicleId": "uuid",
  "lat": 10.123,
  "lng": 106.123,
  "speed": 12.5,
  "recordedAt": "2026-01-12T10:05:00Z"
}
```

### 2.5 Offline sync

#### POST `/api/mobile/sync/outbox`
Mobile gửi danh sách hành động offline đã queue.

Request:
```json
{
  "actions": [
    {
      "id": "uuid",
      "type": "START_ROUTE|COMPLETE_ROUTE|COMPLETE_STOP|TRACKING_PING",
      "createdAt": "2026-01-12T10:00:00Z",
      "payload": { }
    }
  ]
}
```

Response:
```json
{
  "results": [
    { "id": "uuid", "status": "APPLIED|DUPLICATE|REJECTED", "error": null }
  ]
}
```

## 3) Map provider APIs

- Directions: lấy polyline + duration/distance
- Geocoding: address display

Nếu dùng Mapbox:
- Token lưu server-side hoặc remote config (không hardcode).

## 4) Checklist API cho Mobile

- Auth: login/signup/logout/reset
- Driver profile: `me`
- Vehicles: get assigned vehicle, assign/unassign (nếu cần)
- Routes: list assigned, details, start/complete
- Stops: list, complete, optional proof
- Tracking: periodic ping
- Offline sync: outbox bulk endpoint

