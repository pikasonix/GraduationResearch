# Kiến trúc MVVM (XML) — Mobile Android

## 1) Tổng quan

Mục tiêu: một kiến trúc **dễ maintain**, **dễ test**, hỗ trợ **offline/online**, và tách bạch rõ ràng:

- Presentation: Activity/Fragment + ViewModel
- Domain: UseCases
- Data: Repositories + (Remote/Local data sources)

> Lưu ý: App hiện tại đang có code Jetpack Compose. Thiết kế mới **không dùng Compose**.

## 2) Cấu trúc package đề xuất

```
mobile/app/src/main/java/com/pikasonix/wayo/
  core/
    result/            # AppResult, AppError
    network/           # ConnectivityObserver, interceptors
    time/              # Clock abstraction
    dispatcher/        # DispatcherProvider
  data/
    local/
      db/              # RoomDatabase
      dao/
      entity/
      mapper/
    remote/
      backend/         # Retrofit service interfaces
      supabase/        # Supabase client wrapper + queries
      map/             # Map provider wrapper (Mapbox/Google)
    repository/        # Repo implementations
  domain/
    model/             # Domain models (pure Kotlin)
    usecase/
  ui/
    navigation/        # NavGraph + Safe Args
    screens/
      login/
      map/
      route_selection/
      route_details/
      profile/
    common/            # base classes, adapters, view states
```

## 3) Data flow chuẩn

### 3.1 Luồng đọc dữ liệu (offline-first)

1. UI (Fragment) observe LiveData/Flow từ ViewModel
2. ViewModel gọi UseCase
3. UseCase gọi Repository
4. Repository:
   - đọc cache từ Room → emit ngay
   - nếu Online: gọi Remote API (Backend/Supabase), cập nhật Room
   - UI tự cập nhật khi Room thay đổi

### 3.2 Luồng ghi dữ liệu (queue + sync)

1. UI phát action (click “Đã giao”, “Bắt đầu”) → ViewModel
2. ViewModel gọi UseCase
3. UseCase gọi Repository
4. Repository:
   - ghi trạng thái vào Room (local state)
   - tạo bản ghi `pending_action` (outbox)
   - enqueue WorkManager sync (constraint: network)

## 4) UI Layer: Activity/Fragment + XML

### 4.1 ViewBinding vs DataBinding

- **Khuyến nghị**:
  - ViewBinding mặc định cho hầu hết màn hình.
  - DataBinding dùng cho màn hình có binding mạnh (Profile, Login) để giảm boilerplate.

### 4.2 State model trong ViewModel

- Dùng `LiveData<UiState>` hoặc `StateFlow<UiState>`.
- UiState nên là data class:
  - `loading: Boolean`
  - `data: ...?`
  - `error: UiError?`
  - `isOffline: Boolean`

## 5) Domain Layer: UseCases

- Mỗi hành động business có một UseCase.
- UseCase không biết Android UI.
- UseCase dễ unit-test.

Ví dụ nhóm UseCase (chi tiết ở [testing.md](./testing.md)):
- Auth: `LoginUseCase`, `SignUpUseCase`, `SignOutUseCase`
- Routes: `GetAssignedRoutesUseCase`, `StartRouteUseCase`, `CompleteRouteUseCase`
- Stops/Orders: `MarkStopCompletedUseCase`, `GetOrderDetailsUseCase`
- Sync: `EnqueueSyncUseCase`, `SyncPendingActionsUseCase`
- Tracking: `SendLocationPingUseCase`

## 6) Data Layer

### 6.1 Remote sources

- **Backend (Node/Express)**: Retrofit + Moshi
- **Supabase**: Supabase Kotlin SDK wrapper (Auth + Postgrest)
- **Map provider**: Mapbox (Directions/Geocoding) qua wrapper, test bằng fake

### 6.2 Local sources

- **Room**: cache entities (routes, stops, orders, vehicles, driver profile)
- **Outbox**: bảng `pending_actions` để đồng bộ.

## 7) Navigation

- Dùng **Navigation Component** + Safe Args (Fragment based).
- Không dùng Navigation Compose.

## 8) Logging/Observability

- OkHttp logging (debug only)
- Structured logs cho sync failures
- Crash reporting (tùy chọn)

## 9) Security

- Auth token lưu trong EncryptedDataStore/EncryptedSharedPreferences.
- Backend calls dùng Bearer token.
- Supabase calls dùng session từ Supabase SDK.

## 10) Liên kết

- API contracts: [api-contracts.md](./api-contracts.md)
- Offline sync: [offline-sync.md](./offline-sync.md)
- Screen specs: [screens.md](./screens.md)
