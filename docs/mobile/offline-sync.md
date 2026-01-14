# Offline/Online & Đồng bộ (Room + WorkManager)

## 1) Mục tiêu offline

- Driver vẫn xem được route/stops đã tải gần nhất khi mất mạng.
- Driver vẫn có thể thao tác “bắt đầu tuyến”, “đã giao” trong offline.
- Khi có mạng lại, app tự đồng bộ an toàn (idempotent).

## 2) Thành phần

- Room database: cache read model + outbox actions
- ConnectivityObserver: phát hiện online/offline
- WorkManager: background sync (constraints: `NetworkType.CONNECTED`)

## 3) Room schema đề xuất

### 3.1 Cache tables

- `driver_profile`
- `vehicles`
- `routes`
- `route_stops`
- `orders` (tối thiểu fields để hiển thị)

### 3.2 Outbox table

`pending_actions`:
- `id: UUID`
- `type: String`
- `payloadJson: String`
- `createdAt: Instant`
- `attemptCount: Int`
- `lastError: String?`
- `status: PENDING|IN_FLIGHT|DONE|FAILED`

## 4) Sync strategy

### 4.1 Read path

- UI luôn render từ Room (Flow/Livedata).
- Khi online:
  - fetch remote
  - upsert Room

### 4.2 Write path

Ví dụ: complete stop
- Update Room ngay (optimistic)
- Insert `pending_actions`
- Enqueue WorkManager

### 4.3 Worker

- Lấy batch `pending_actions`
- Gọi `/api/mobile/sync/outbox`
- Mark DONE những action thành công
- Với lỗi recoverable: retry (exponential)
- Với lỗi validation/permanent: FAILED + hiển thị warning

## 5) UI offline indicator

- Khi offline: hiển thị banner/snackbar “Bạn đang ở chế độ ngoại tuyến”.
- Khi online trở lại: hiển thị “Đang đồng bộ…” rồi “Đồng bộ xong”.

## 6) Conflict resolution

Nguyên tắc:
- Server là source of truth.
- Client chỉ gửi action; server quyết định hợp lệ.

Chiến lược:
- Mọi update cần `updated_at`/`version`.
- Server trả về state mới nhất sau khi apply action.
- Client upsert lại Room theo response.

