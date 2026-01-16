# WAYO Mobile App (Driver App)

## Giới thiệu chung

WAYO Mobile là ứng dụng Android dành cho tài xế giao hàng, được xây dựng bằng Kotlin với kiến trúc Clean Architecture. Ứng dụng cung cấp giao diện để tài xế xem các tuyến đường được gán, theo dõi điểm dừng, cập nhật trạng thái giao hàng và làm việc offline.

Ứng dụng tích hợp với Backend API để đồng bộ dữ liệu, sử dụng Supabase cho authentication, Room Database cho offline storage, và Mapbox Maps cho hiển thị bản đồ và điều hướng.

**Công nghệ sử dụng:**
- Kotlin với Coroutines và Flow
- Clean Architecture (Domain, Data, Presentation layers)
- Hilt (Dependency Injection)
- Retrofit + OkHttp (Network)
- Room Database (Offline storage)
- Supabase Kotlin SDK (Authentication)
- Mapbox Maps SDK (Maps và Navigation)
- ViewBinding (UI)

## Hướng dẫn cài đặt

### Yêu cầu hệ thống

- Android Studio
- JDK 11 trở lên
- Android SDK API 24+ (Android 7.0+)
- Gradle 8.13+
- Kotlin 2.1.0+

### Các bước cài đặt

**1. Clone repository**

```bash
git clone <repository-url>
cd WAYO/mobile
```

**2. Cấu hình local.properties**

Tạo file `local.properties` trong thư mục `mobile/`:

```properties
# Android SDK location (tự động tạo bởi Android Studio)
sdk.dir=C\:\\Users\\YourName\\AppData\\Local\\Android\\Sdk

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Backend API Configuration
# Lưu ý: Android Emulator cần dùng 10.0.2.2 thay cho localhost
BACKEND_URL=http://10.0.2.2:3001

# Mapbox Configuration
MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
MAPBOX_DOWNLOADS_TOKEN=sk.your-downloads-token
```

**3. Sync dependencies**

Mở project trong Android Studio:
```
File → Open → Chọn thư mục mobile/
```

Đợi Gradle sync tự động hoặc chạy:
```bash
./gradlew --refresh-dependencies
```

**4. Build và chạy**

Trong Android Studio:
1. Chọn device/emulator
2. Click Run (Shift+F10) hoặc Debug (Shift+F9)

Hoặc qua command line:
```bash
# Build debug APK
./gradlew assembleDebug

# Install trên device
./gradlew installDebug

# Build và chạy
./gradlew :app:installDebug
adb shell am start -n com.pikasonix.wayo/.MainActivity
```

**5. Kiểm tra kết nối**

Test backend connection từ emulator:
```bash
# Từ Android Device/Emulator browser
http://10.0.2.2:3001/api/mobile/health
```

Response mong đợi:
```json
{
  "status": "ok",
  "supabaseEnabled": true
}
```

### Lưu ý cấu hình

**Android Emulator Network:**
- Sử dụng `10.0.2.2` để truy cập localhost trên máy host
- Physical device cần dùng IP thực của máy host trong cùng mạng

**Permissions:**
- Location permissions cần được grant trong runtime
- Background location cần được grant riêng (Android 10+)
- Foreground service permission cho location tracking

**Network Security:**
- Development cho phép cleartext traffic (HTTP)
- Production cần HTTPS và proper SSL certificates

## Cấu trúc project

```
mobile/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/pikasonix/wayo/
│   │   │   │   ├── core/                    # Core utilities
│   │   │   │   │   ├── network/             # Network monitoring
│   │   │   │   │   ├── dispatcher/          # Coroutine dispatchers
│   │   │   │   │   └── result/              # Result wrappers
│   │   │   │   │
│   │   │   │   ├── data/                    # Data layer
│   │   │   │   │   ├── local/               # Local data sources
│   │   │   │   │   │   ├── dao/             # Room DAOs
│   │   │   │   │   │   ├── entity/          # Room entities
│   │   │   │   │   │   └── db/              # Database setup
│   │   │   │   │   ├── remote/              # Remote data sources
│   │   │   │   │   │   └── backend/         # Backend API service
│   │   │   │   │   ├── repository/          # Repository implementations
│   │   │   │   │   └── model/               # Data models
│   │   │   │   │
│   │   │   │   ├── domain/                  # Domain layer
│   │   │   │   │   └── usecase/             # Use cases (business logic)
│   │   │   │   │       ├── auth/            # Authentication use cases
│   │   │   │   │       ├── route/           # Route management
│   │   │   │   │       ├── stop/            # Stop completion
│   │   │   │   │       ├── tracking/        # Location tracking
│   │   │   │   │       ├── sync/            # Data synchronization
│   │   │   │   │       └── profile/         # Driver profile
│   │   │   │   │
│   │   │   │   ├── ui/                      # Presentation layer
│   │   │   │   │   ├── xml/                 # XML-based UI
│   │   │   │   │   │   ├── login/           # Login screen
│   │   │   │   │   │   ├── signup/          # Sign up screen
│   │   │   │   │   │   ├── routes/          # Routes list và details
│   │   │   │   │   │   ├── map/             # Map view
│   │   │   │   │   │   └── profile/         # Driver profile
│   │   │   │   │   └── viewmodel/           # Shared ViewModels
│   │   │   │   │
│   │   │   │   ├── di/                      # Dependency Injection
│   │   │   │   │   └── AppModule.kt         # Hilt modules
│   │   │   │   │
│   │   │   │   ├── workers/                 # Background workers
│   │   │   │   │   └── OutboxSyncWorker.kt  # Outbox pattern sync
│   │   │   │   │
│   │   │   │   ├── utils/                   # Utilities
│   │   │   │   │   └── Constants.kt         # App constants
│   │   │   │   │
│   │   │   │   ├── WayoApplication.kt       # Application class
│   │   │   │   └── MainActivity.kt          # Main activity
│   │   │   │
│   │   │   ├── res/                         # Resources
│   │   │   │   ├── layout/                  # XML layouts
│   │   │   │   ├── navigation/              # Navigation graphs
│   │   │   │   ├── menu/                    # Bottom navigation menu
│   │   │   │   ├── values/                  # Strings, colors, themes
│   │   │   │   └── drawable/                # Images và icons
│   │   │   │
│   │   │   └── AndroidManifest.xml          # App manifest
│   │   │
│   │   └── test/                            # Unit tests
│   │       └── java/com/pikasonix/wayo/
│   │
│   ├── build.gradle.kts                     # App build configuration
│   └── proguard-rules.pro                   # ProGuard rules
│
├── gradle/                                  # Gradle wrapper
├── build.gradle.kts                         # Project build config
├── settings.gradle.kts                      # Project settings
└── local.properties                         # Local configuration (gitignored)
```

### Kiến trúc Clean Architecture

**Domain Layer:**
- Use Cases: Business logic thuần túy, không phụ thuộc framework
- Interfaces: Repository interfaces

**Data Layer:**
- Repository Implementations: Implement domain interfaces
- Data Sources: Local (Room) và Remote (Retrofit)
- Models: Data transfer objects và entities

**Presentation Layer:**
- Fragments: UI components
- ViewModels: UI logic và state management
- Adapters: RecyclerView adapters

**Dependency Flow:**
- Presentation → Domain → Data
- Dependencies chỉ đi một chiều, không có circular dependencies

## Tính năng chi tiết

### 1. Authentication

**Tính năng:**
- Đăng nhập với email và password
- Đăng ký tài khoản mới (driver)
- Session persistence với EncryptedSharedPreferences
- Auto-refresh token với Supabase
- Logout và clear session

**Flow:**
1. User nhập email/password
2. App gọi Supabase Auth API
3. Lưu session token an toàn
4. Tự động đăng nhập lần sau
5. Token được refresh tự động

**Components:**
- [LoginFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/login/LoginFragment.kt): Login UI
- [SignUpFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/signup/SignUpFragment.kt): Sign up UI
- [AuthRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/AuthRepository.kt): Auth logic
- Use cases: `LoginUseCase`, `SignUpUseCase`, `LogoutUseCase`

**Security:**
- Password được hash trước khi gửi
- Token được lưu trong EncryptedSharedPreferences
- Network requests sử dụng HTTPS (production)

### 2. Quản lý routes (Tuyến đường)

**Tính năng:**
- Xem danh sách routes được gán
- Filter theo date và status
- Xem chi tiết route với stops
- Start route (bắt đầu giao hàng)
- Complete route (hoàn thành tuyến)
- Progress tracking (completed/total stops)
- Offline access với Room Database

**Route States:**
- `planned`: Route đã được tạo, chưa gán driver
- `assigned`: Đã gán cho driver, chưa bắt đầu
- `in_progress`: Đang thực hiện
- `completed`: Đã hoàn thành
- `cancelled`: Đã hủy

**Components:**
- [AssignedRoutesFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/routes/AssignedRoutesFragment.kt): Routes list
- [RouteDetailsFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/routes/RouteDetailsFragment.kt): Route details
- [AssignedRoutesViewModel.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/routes/AssignedRoutesViewModel.kt): Routes ViewModel
- [RouteDetailsViewModel.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/routes/RouteDetailsViewModel.kt): Details ViewModel
- [RouteRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/RouteRepository.kt): Route data management

**Data Flow:**
1. Fetch routes từ Backend API
2. Cache vào Room Database
3. Hiển thị từ local cache
4. Refresh khi có network
5. Sync changes lên server

### 3. Quản lý stops (Điểm dừng)

**Tính năng:**
- Xem danh sách stops trong route
- Stops được sắp xếp theo sequence
- Chi tiết order tại mỗi stop
- Complete stop (đánh dấu hoàn thành)
- Thêm notes khi complete
- Time windows và ETA
- Offline completion với outbox pattern

**Stop Types:**
- `pickup`: Điểm lấy hàng
- `delivery`: Điểm giao hàng

**Stop States:**
- `pending`: Chưa hoàn thành
- `completed`: Đã hoàn thành

**Components:**
- [RouteStopsAdapter.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/routes/RouteStopsAdapter.kt): Stops list UI
- [StopRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/StopRepository.kt): Stop data management
- Use cases: `CompleteStopUseCase`, `GetStopDetailsUseCase`

**Completion Flow:**
1. Driver click "Complete" trên stop
2. Nhập notes (optional)
3. Xác nhận completion
4. Lưu vào pending_actions nếu offline
5. Sync lên server khi online
6. Update order status (picked_up → in_transit → delivered)

### 4. Maps và Navigation

**Tính năng:**
- Hiển thị route trên bản đồ
- Markers cho stops
- Current location tracking
- Turn-by-turn navigation với Mapbox
- Route overview với zoom-to-fit
- Offline maps (nếu đã download)

**Map Features:**
- Multiple map styles (streets, satellite)
- Real-time location updates
- Route geometry rendering
- Stop markers với custom icons
- Distance và duration estimation

**Components:**
- [MapFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/map/MapFragment.kt): Map view
- [MapViewModel.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/map/MapViewModel.kt): Map logic
- Mapbox Maps SDK integration

**Permissions:**
- `ACCESS_FINE_LOCATION`: GPS location
- `ACCESS_COARSE_LOCATION`: Network location
- `ACCESS_BACKGROUND_LOCATION`: Background tracking (Android 10+)

### 5. Location Tracking

**Tính năng:**
- Real-time location tracking
- Background location updates
- Periodic ping tới backend
- Battery-efficient tracking
- Foreground service notification

**Tracking Strategy:**
- Foreground service khi có active route
- Location updates mỗi 30 giây (configurable)
- Batch upload để tiết kiệm battery
- Pause tracking khi không có route active

**Components:**
- Use case: `SendLocationPingUseCase`
- [TrackingRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/TrackingRepository.kt): Tracking logic
- BackendApiService: `/api/mobile/tracking/ping` endpoint

### 6. Offline Support (Outbox Pattern)

**Tính năng:**
- Làm việc hoàn toàn offline
- Tự động queue actions khi offline
- Sync tự động khi online
- Conflict resolution
- Retry với exponential backoff

**Outbox Pattern:**
1. User thực hiện action (complete stop, start route, etc.)
2. Action được lưu vào `pending_actions` table
3. WorkManager schedule sync job
4. Khi có network, sync actions lên server
5. Server trả về kết quả
6. Clean up actions đã sync thành công

**Pending Actions:**
- `COMPLETE_STOP`: Hoàn thành stop
- `START_ROUTE`: Bắt đầu route
- `COMPLETE_ROUTE`: Hoàn thành route
- `TRACKING_PING`: Location update

**Components:**
- [OutboxSyncWorker.kt](app/src/main/java/com/pikasonix/wayo/workers/OutboxSyncWorker.kt): Background sync
- [SyncRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/SyncRepository.kt): Sync logic
- Room Database: `pending_actions` table

**Sync Strategy:**
- Periodic sync: Mỗi 15 phút
- Immediate sync: Khi có network connection
- Manual sync: Pull-to-refresh
- Exponential backoff: 30s, 60s, 120s

### 7. Driver Profile

**Tính năng:**
- Xem thông tin driver
- Avatar upload (future)
- Statistics (total deliveries, rating)
- Account settings
- Logout

**Components:**
- [ProfileFragment.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/profile/ProfileFragment.kt): Profile UI
- [ProfileViewModel.kt](app/src/main/java/com/pikasonix/wayo/ui/xml/profile/ProfileViewModel.kt): Profile logic
- [DriverProfileRepository.kt](app/src/main/java/com/pikasonix/wayo/data/repository/DriverProfileRepository.kt): Profile data

### 8. Network Connectivity Monitoring

**Tính năng:**
- Real-time network status monitoring
- Offline indicator trong UI
- Tự động retry khi online
- Queue requests khi offline

**Components:**
- [ConnectivityObserver.kt](app/src/main/java/com/pikasonix/wayo/core/network/ConnectivityObserver.kt): Network monitoring
- Flow-based connectivity updates
- Integration với all ViewModels

## API Integration

### Backend API Endpoints

**Base URL:** `http://10.0.2.2:3001` (emulator) hoặc `https://api.wayo.com` (production)

**Authentication:**
Tất cả endpoints yêu cầu Bearer token trong header:
```
Authorization: Bearer <supabase-access-token>
```

**Endpoints được sử dụng:**

**1. Driver Profile**
```
GET /api/mobile/driver/me
Response: DriverProfileResponse
```

**2. Assigned Routes**
```
GET /api/mobile/routes/assigned?status=assigned,in_progress
Response: AssignedRoutesResponse
```

**3. Route Details**
```
GET /api/mobile/routes/{id}
Response: RouteDetailsResponse (route + stops)
```

**4. Start Route**
```
POST /api/mobile/routes/{id}/start
Body: { started_at: "2024-01-15T08:00:00Z" }
Response: StartRouteResponse
```

**5. Complete Route**
```
POST /api/mobile/routes/{id}/complete
Body: { completed_at: "2024-01-15T16:00:00Z" }
Response: CompleteRouteResponse
```

**6. Complete Stop**
```
POST /api/mobile/stops/{id}/complete
Body: { 
  completed_at: "2024-01-15T09:15:00Z",
  notes: "Optional notes"
}
Response: CompleteStopResponse
```

**7. Tracking Ping**
```
POST /api/mobile/tracking/ping
Body: {
  latitude: 21.0285,
  longitude: 105.8542,
  timestamp: "2024-01-15T09:30:00Z"
}
Response: { success: true }
```

**8. Sync Outbox**
```
POST /api/mobile/sync/outbox
Header: X-Idempotency-Key: <uuid>
Body: {
  actions: [
    {
      id: "local-uuid",
      type: "COMPLETE_STOP",
      payload: "{...}",
      timestamp: "2024-01-15T09:15:00Z"
    }
  ]
}
Response: SyncOutboxResponse
```

### Supabase Integration

**Authentication:**
- Email/Password sign in
- Session management
- Token refresh
- Sign out

**Supabase Client:**
```kotlin
val supabase = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_ANON_KEY
) {
    install(Auth)
    install(Postgrest)
}
```

## Dependency Injection với Hilt

### Modules

**AppModule** ([di/AppModule.kt](app/src/main/java/com/pikasonix/wayo/di/AppModule.kt))

Provides:
- `SupabaseClient`: Supabase instance
- `Retrofit`: HTTP client
- `BackendApiService`: Backend API interface
- `AppDatabase`: Room database
- Repositories
- Use Cases
- DispatcherProvider

**Scopes:**
- `@Singleton`: Application-wide single instance
- `@ViewModelScoped`: ViewModel lifecycle
- `@ActivityRetainedScoped`: Activity lifecycle

### Injection Points

**ViewModels:**
```kotlin
@HiltViewModel
class RouteDetailsViewModel @Inject constructor(
    private val getRouteDetailsUseCase: GetRouteDetailsUseCase
) : ViewModel()
```

**Fragments:**
```kotlin
@AndroidEntryPoint
class RouteDetailsFragment : Fragment() {
    private val viewModel: RouteDetailsViewModel by viewModels()
}
```

**Workers:**
```kotlin
@HiltWorker
class OutboxSyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncRepository: SyncRepository
) : CoroutineWorker(context, params)
```

## Database Schema (Room)

### Tables

**routes**
- id: String (Primary Key)
- driver_id: String
- vehicle_id: String?
- status: String
- scheduled_date: String
- started_at: String?
- completed_at: String?
- total_stops: Int
- completed_stops: Int

**route_stops**
- id: String (Primary Key)
- route_id: String (Foreign Key)
- sequence: Int
- location_name: String
- latitude: Double
- longitude: Double
- type: String (pickup/delivery)
- status: String (pending/completed)
- scheduled_time: String?
- completed_at: String?

**orders**
- id: String (Primary Key)
- order_number: String
- customer_name: String
- customer_phone: String?
- status: String

**pending_actions**
- id: String (Primary Key)
- action_type: String
- payload: String (JSON)
- created_at: Long
- retry_count: Int
- status: String (pending/syncing/synced/failed)

**driver_profile**
- id: String (Primary Key)
- user_id: String
- full_name: String
- phone: String
- avatar_url: String?
- status: String

### DAOs

Mỗi table có DAO tương ứng:
- `RoutesDao`: CRUD operations cho routes
- `RouteStopsDao`: CRUD operations cho stops
- `OrdersDao`: CRUD operations cho orders
- `PendingActionsDao`: CRUD operations cho pending actions
- `DriverProfileDao`: CRUD operations cho driver profile
