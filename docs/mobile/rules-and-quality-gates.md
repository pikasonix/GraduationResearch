# Rules & Quality Gates (Mobile Android)

## 1) Rules bắt buộc

### 1.1 Không được sử dụng Jetpack Compose

- **Cấm** tất cả dependency Compose và UI viết bằng `@Composable`.
- **Cấm** `navigation-compose`, `activity-compose`, `compose-bom`, `material3-compose`.
- UI chỉ dùng **XML** với **Activity/Fragment**.

Enforcement (khuyến nghị):
- Gradle: không apply `org.jetbrains.kotlin.plugin.compose`.
- `buildFeatures { compose = false }` (hoặc không khai báo compose).
- CI/Pre-commit: grep `androidx.compose` và fail build nếu xuất hiện.

### 1.2 Kiến trúc bắt buộc: MVVM + Clean-ish layering

- **Presentation**: Activity/Fragment + ViewModel + UI State.
- **Domain**: UseCase (business logic).
- **Data**: Repository + data sources (Retrofit/Supabase/Room).

Quy tắc:
- UI không gọi trực tiếp network/db.
- ViewModel không biết chi tiết Retrofit/Supabase/Room implementation.
- Repository quyết định lấy dữ liệu từ network hay cache.

### 1.3 Dependency Injection

- Dùng **Hilt** cho toàn bộ dependencies.
- Không tạo repository/service bằng `new`/constructor trực tiếp trong UI.

### 1.4 Threading / Coroutines

- Không chạy IO trên main thread.
- ViewModel dùng `viewModelScope`.
- Repository dùng `withContext(Dispatchers.IO)` hoặc inject dispatcher.

### 1.5 Error handling chuẩn

- Thống nhất wrapper: `AppResult<T>` hoặc `Result<T>` + `AppError`.
- Không throw exception xuyên tầng UI (UI chỉ hiển thị trạng thái).

### 1.6 Internationalization

- Tất cả text hiển thị UI phải nằm trong `res/values/strings.xml`.
- Chuẩn bị `values-vi/strings.xml` nếu muốn tách riêng tiếng Việt.

### 1.7 Permissions

- `INTERNET`, `ACCESS_NETWORK_STATE` bắt buộc.
- Nếu dùng location: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.

## 2) Quality gates

### 2.1 Static checks

- Kotlin: `ktlint` hoặc `detekt` (khuyến nghị bật trong CI).
- Lint Android: chạy `./gradlew lint` trong pipeline.

### 2.2 Test gates

- Unit tests phải cover:
  - UseCase: mapping, validation, decision logic.
  - Repository: online/offline path.
  - Room: DAO, migrations.
- Instrumentation tests:
  - Navigation flow chính.
  - RecyclerView list rendering.

### 2.3 Anti-patterns (cấm)

- UI giữ mutable state thay cho ViewModel.
- `GlobalScope`.
- Network calls trong Fragment/Activity.
- Hardcode strings.
- Truy cập trực tiếp Supabase client trong UI.

## 3) Definition of Done (DoD) cho feature

- Có UseCase + ViewModel state.
- Có Repository method + tests.
- Có UI layout XML + Fragment.
- Có error/loading/empty state.
- Có xử lý offline tối thiểu (cache read + banner offline).
- API contract cập nhật trong [api-contracts.md](./api-contracts.md).
