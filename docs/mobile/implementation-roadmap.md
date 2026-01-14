# Implementation Roadmap (Compose → XML MVVM)

Mục tiêu: chuyển app hiện tại (Compose) sang **XML + Fragment + MVVM**, không làm “big bang” rủi ro.

## Phase 0 — Guardrails (ngay lập tức)

- Thêm rule “NO COMPOSE” vào code review + CI.
- Tách package mới cho XML UI để tránh đụng Compose trong lúc migrate.

## Phase 1 — Gradle migration (bắt buộc)

### 1) Gỡ Compose khỏi build

Trong [mobile/app/build.gradle.kts](../../mobile/app/build.gradle.kts):

- Xóa plugin:
  - `alias(libs.plugins.kotlin.compose)`
- Trong `buildFeatures`:
  - `compose = true` → **remove**
  - bật `viewBinding = true`
  - (optional) bật `dataBinding = true`

- Xóa dependencies Compose:
  - `androidx.activity:activity-compose`
  - `androidx.compose.*`
  - `androidx.navigation:navigation-compose`
  - `hilt-navigation-compose`
  - `coil-compose`
  - `lifecycle-runtime-compose`

### 2) Thêm dependencies XML stack

- UI:
  - Material Components (`com.google.android.material:material`)
  - ConstraintLayout
  - RecyclerView

- Navigation:
  - `androidx.navigation:navigation-fragment-ktx`
  - `androidx.navigation:navigation-ui-ktx`
  - Safe Args plugin (nếu dùng)

- Image:
  - **Glide** (theo yêu cầu)

- Offline:
  - Room (`room-runtime`, `room-ktx`, ksp for room compiler)
  - WorkManager (`work-runtime-ktx`)

- Network:
  - Retrofit + Moshi (khuyến nghị chuyển từ Gson để consistency)

## Phase 2 — New UI shell (XML)

- Tạo `MainActivity` (XML) với `FragmentContainerView`.
- Tạo `nav_graph.xml` + destinations cho 5 màn hình.

Màn hình:
- LoginFragment
- SignUpFragment
- MapFragment
- RouteSelectionFragment
- RouteDetailsFragment
- ProfileFragment

## Phase 3 — Domain + Repository interfaces

- Tạo `domain/usecase/*` và interfaces `AuthRepository`, `RouteRepository`, `SyncRepository`.
- Cài `AppResult` + `AppError` dùng chung.

## Phase 4 — Room cache + outbox

- Implement Room entities + DAOs.
- Implement outbox pattern (pending_actions).

## Phase 5 — Worker sync + connectivity

- ConnectivityObserver phát hiện online/offline.
- WorkManager worker: `OutboxSyncWorker`.

## Phase 6 — Replace Compose screens

- Tắt/loại bỏ từng screen Compose theo từng PR.
- Khi screen XML hoạt động, xóa code Compose tương ứng.

## Phase 7 — Testing + CI

- Unit tests cho UseCases, ViewModels.
- Room DAO tests.
- Espresso tests cho flow chính.

