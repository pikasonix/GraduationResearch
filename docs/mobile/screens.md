# Thiết kế màn hình (XML + MVVM)

Tài liệu này mô tả 5 màn hình theo yêu cầu và cách triển khai chuẩn.

## 1) Screen 1: Đăng nhập & Đăng ký

### UI (XML)
- Root: `ConstraintLayout`
- Input: `TextInputLayout` + `TextInputEditText`
- Buttons: `MaterialButton`
- Error: helper/error text của `TextInputLayout`

### ViewModel
- `LoginViewModel` / `SignUpViewModel`
- State: `loading`, `error`, `isLoggedIn`

### UseCases
- `LoginUseCase(email, password)`
- `SignUpUseCase(email, password, fullName, phone)`

### Notes
- Text dùng `strings.xml` (Việt hóa)
- Validate client-side: email format, password min length

## 2) Screen 2: Trang chính (Bản đồ)

### UI
- `Fragment` chứa map view (Mapbox/Google)
- Top app bar: `MaterialToolbar`
- FAB: “Bắt đầu di chuyển” / “Định vị”

### ViewModel
- `MapViewModel`
- Observe:
  - route active
  - driver location
  - offline state

### UseCases
- `GetActiveRouteUseCase()`
- `ObserveConnectivityUseCase()`
- `SendLocationPingUseCase()` (throttle)

## 3) Screen 3: Chọn đường đi (Route Selection)

### UI
- `RecyclerView`
  - `LinearLayoutManager` (default)
  - hoặc `GridLayoutManager` nếu cần dạng lưới
- Item: `MaterialCardView`
- Optional thumbnail: dùng **Glide**

### Data
- Tải options từ Web Service (Backend) bằng Retrofit

### Navigation
- Dùng **Safe Args** để chuyển `routeId/optionId` sang Route Details

## 4) Screen 4: Lộ trình tuyến đường (Route Details)

### UI
- `RecyclerView` + `ListAdapter` + `DiffUtil`
- Mỗi stop là `MaterialCardView`:
  - tên điểm
  - ETA/Time window
  - trạng thái (chưa/đã hoàn thành)
- FAB: “Bắt đầu” / “Kết thúc”
- Action per stop: “Đã giao”

### ViewModel
- `RouteDetailsViewModel(routeId)`
- Expose:
  - list stops (Room-backed)
  - route status
  - sync status

### UseCases
- `GetRouteDetailsUseCase(routeId)`
- `StartRouteUseCase(routeId)`
- `CompleteRouteUseCase(routeId)`
- `MarkStopCompletedUseCase(stopId)`

### Offline behavior
- Nếu offline vẫn cho mark completed → queue outbox.

## 5) Screen 5: Profile (Hồ sơ)

### UI
- Data Binding để bind trực tiếp driver model:
  - tên
  - số điện thoại
  - đánh giá (nếu có)
- Avatar: ImageView + Glide

### ViewModel
- `ProfileViewModel`

### UseCases
- `GetDriverProfileUseCase()`
- `UpdateDriverProfileUseCase(...)` (optional)

