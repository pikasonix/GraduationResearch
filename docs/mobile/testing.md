# Testing Strategy (Mobile Android)

Mục tiêu: test được logic quan trọng mà không phụ thuộc UI/network thật.

## 1) Unit tests

### 1.1 Domain (UseCase)

- Test validation, mapping, business rules.
- Mock repository interfaces.

### 1.2 ViewModel

- Test state transitions: Loading → Success/Error.
- Test offline behavior: enqueue outbox.

Khuyến nghị:
- `kotlinx-coroutines-test`
- fake Clock/DispatcherProvider

### 1.3 Data (Repository)

- Test lựa chọn nguồn dữ liệu:
  - offline: Room only
  - online: remote + cache update

### 1.4 Room (Database)

- DAO tests với in-memory Room.
- Migration tests nếu có migration.

## 2) Instrumentation tests

### 2.1 UI tests (Espresso)

- Login flow
- Route list → details navigation
- RecyclerView renders đúng số lượng item
- Offline banner hiển thị khi mất mạng (có thể mock ConnectivityObserver)

### 2.2 WorkManager tests

- Dùng `work-testing` để chạy worker đồng bộ.
- Verify outbox actions được gửi và đánh dấu DONE.

## 3) Test data & fakes

- Fake backend service (MockWebServer)
- Fake Supabase gateway (interface + fake impl)
- Fake map provider

## 4) Coverage checklist

- Auth: login/signup/logout
- Route: list + details
- Stop completion: online + offline queued
- Sync: retry/backoff
- Error mapping: network/401/timeout

