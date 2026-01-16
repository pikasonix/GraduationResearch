# WAYO Frontend

## Giới thiệu chung

WAYO Frontend là ứng dụng web quản lý và giám sát hệ thống giao hàng, được xây dựng bằng Next.js 15 với React 19. Ứng dụng cung cấp giao diện trực quan để quản lý đơn hàng, tối ưu hóa lộ trình, theo dõi tài xế và phương tiện theo thời gian thực.

Hệ thống tích hợp với Supabase cho xác thực và quản lý dữ liệu, sử dụng Redux Toolkit để quản lý state, và Mapbox GL JS để hiển thị bản đồ tương tác. Frontend giao tiếp với backend API để thực hiện các tác vụ tối ưu hóa lộ trình sử dụng thuật toán PDPTW.

**Công nghệ sử dụng:**
- Next.js 15.2.4 (App Router)
- React 19 với TypeScript
- Redux Toolkit với RTK Query
- Supabase (Authentication & Database)
- Mapbox GL JS (Maps & Visualization)
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod (Form validation)
- Chart.js (Data visualization)

## Hướng dẫn cài đặt

### Yêu cầu hệ thống

- Node.js phiên bản 18 trở lên
- npm, yarn, pnpm hoặc bun
- Supabase project (cho authentication và database)
- Mapbox access token (cho bản đồ)
- Backend API đã được cài đặt và chạy

### Các bước cài đặt

**1. Cài đặt dependencies**

```bash
cd frontend
npm install
```

**2. Cấu hình biến môi trường**

Tạo file `.env.local` trong thư mục `frontend/`:

```properties
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API Configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api

# Mapbox Configuration
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your-mapbox-token

# Optional: Branding
NEXT_PUBLIC_LOGO_WAYO=/favicon.svg
```

**3. Generate TypeScript types từ Supabase**

```bash
npm run supabase:typegen
```

Lưu ý: Cần cập nhật project ID trong `package.json` script `supabase:typegen`.

**4. Khởi chạy development server**

```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:3000`

**5. Build cho production**

```bash
npm run build
npm start
```

### Lưu ý cấu hình

**Mapbox Token:**
- Đăng ký tài khoản tại [mapbox.com](https://mapbox.com)
- Tạo access token với scopes: `styles:read`, `fonts:read`, `datasets:read`
- Thêm localhost và domain của bạn vào URL restrictions

**Supabase Setup:**
- Tạo project tại [supabase.com](https://supabase.com)
- Chạy migrations từ folder `supabase/migrations/`
- Cấu hình Row Level Security (RLS) policies
- Enable Email authentication trong Authentication settings

**CORS Configuration:**
- Backend cần cho phép CORS từ frontend origin
- Trong development: `http://localhost:3000`
- Trong production: domain thực tế của frontend

## Cấu trúc project

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Landing page (routing)
│   │   ├── layout.tsx            # Root layout với navigation
│   │   ├── routing/              # Trang tối ưu hóa lộ trình
│   │   ├── orders/               # Quản lý đơn hàng
│   │   ├── fleet/                # Quản lý đội xe và tài xế
│   │   ├── map/                  # Xem bản đồ và lộ trình
│   │   ├── monitor/              # Giám sát theo thời gian thực
│   │   ├── dispatch/             # Console điều phối
│   │   ├── route-details/        # Chi tiết lộ trình
│   │   ├── login/                # Đăng nhập
│   │   ├── signup/               # Đăng ký
│   │   ├── profile/              # Quản lý profile
│   │   └── api/                  # API routes (admin)
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── common/               # Shared components
│   │   ├── routing/              # Routing module components
│   │   ├── orders/               # Orders module components
│   │   ├── fleet/                # Fleet module components
│   │   ├── map/                  # Map components
│   │   ├── monitor/              # Monitor components
│   │   ├── dispatch/             # Dispatch components
│   │   ├── route-details/        # Route details components
│   │   └── profile/              # Profile components
│   │
│   ├── lib/                      # Libraries và utilities
│   │   ├── redux/                # Redux store configuration
│   │   │   ├── store.ts          # Root store
│   │   │   ├── provider.tsx      # Redux Provider
│   │   │   └── services/         # RTK Query API services
│   │   │       ├── auth.ts       # Authentication API
│   │   │       ├── userApi.ts    # User & Organization API
│   │   │       ├── orderApi.ts   # Orders API
│   │   │       ├── profileApi.ts # Profile API
│   │   │       └── adminApi.ts   # Admin API
│   │   ├── utils.ts              # Utility functions
│   │   ├── constants/            # Constants và configurations
│   │   └── dispatchSettings.ts   # Dispatch settings management
│   │
│   ├── services/                 # External service clients
│   │   ├── backendClient.js      # Backend API client
│   │   ├── solverService.ts      # PDPTW Solver service
│   │   ├── driverService.ts      # Driver service
│   │   ├── geocoding.ts          # Geocoding utilities
│   │   └── vehicleStateService.ts # Vehicle state service
│   │
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Utility functions
│   ├── config/                   # Configuration files
│   ├── supabase/                 # Supabase client và types
│   │   ├── client.ts             # Supabase client instance
│   │   └── types.ts              # Generated database types
│   │
│   ├── data/                     # Static data
│   └── styles/                   # Global styles
│
├── public/                       # Static assets
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── components.json               # shadcn/ui configuration
└── package.json                  # Dependencies và scripts
```

### Mô tả các thư mục chính

**app/**: Sử dụng Next.js App Router với file-based routing. Mỗi folder đại diện cho một route, chứa `page.tsx` và các components liên quan.

**components/**: Tổ chức theo module và tính năng. Components trong `ui/` là từ shadcn/ui, có thể tùy chỉnh. Components trong `common/` được dùng chung nhiều nơi.

**lib/redux/**: Redux store với RTK Query để fetch và cache dữ liệu từ Supabase và Backend API. Mỗi service file định nghĩa endpoints và types tương ứng.

**services/**: Client code để giao tiếp với external services (backend solver API, geocoding, etc).

**supabase/**: Supabase client configuration và auto-generated types từ database schema.

## Tính năng chi tiết

### 1. Authentication và Authorization

**Tính năng:**
- Đăng nhập/Đăng ký với email và password
- OAuth với Google (tùy chọn)
- Quên mật khẩu và reset password
- Role-based access control (RBAC)
- Session management với Supabase Auth

**Roles:**
- `admin`: Quản trị organization
- `manager`: Quản lý operations
- `driver`: Tài xế
- `user`: Người dùng (vừa đăng ký chưa xác định role cụ thể)

**Components:**
- [src/app/login/page.tsx](src/app/login/page.tsx): Login form
- [src/app/signup/page.tsx](src/app/signup/page.tsx): Registration form
- [src/app/forgot-password/page.tsx](src/app/forgot-password/page.tsx): Password recovery
- [src/lib/redux/services/auth.ts](src/lib/redux/services/auth.ts): Auth API endpoints

### 2. Quản lý đơn hàng (Orders Management)

**Tính năng:**
- CRUD operations cho orders
- Tìm kiếm và lọc đơn hàng theo status, priority, date range
- Geocoding tự động từ địa chỉ sang tọa độ
- Quản lý locations (pickup và delivery points)
- Time windows cho pickup và delivery
- Priority levels (normal, urgent)
- Bulk operations
- Xem đơn hàng trên bản đồ

**Order States:**
- `pending`: Đơn hàng mới, chưa được gán
- `assigned`: Đã được gán vào route
- `in_transit`: Đã pickup, đang vận chuyển
- `picked_up`: Đã lấy hàng tại điểm pickup
- `delivered`: Đã giao hàng thành công
- `failed`: Giao hàng thất bại
- `cancelled`: Đơn hàng bị hủy

**Components:**
- [src/app/orders/page.tsx](src/app/orders/page.tsx): Main orders page
- [src/components/orders/OrdersTable.tsx](src/components/orders/OrdersTable.tsx): Table view
- [src/components/orders/OrdersMap.tsx](src/components/orders/OrdersMap.tsx): Map view
- [src/components/orders/OrderForm.tsx](src/components/orders/OrderForm.tsx): Create/edit form
- [src/components/orders/OrdersStats.tsx](src/components/orders/OrdersStats.tsx): Statistics
- [src/components/orders/OrdersFilter.tsx](src/components/orders/OrdersFilter.tsx): Filter UI

**API Integration:**
- [src/lib/redux/services/orderApi.ts](src/lib/redux/services/orderApi.ts): Orders CRUD API

### 3. Tối ưu hóa lộ trình (Route Optimization)

**Tính năng:**
- Generate instance từ orders và vehicles
- Submit optimization job tới backend solver
- Theo dõi tiến trình optimization
- Hiển thị kết quả trên bản đồ tương tác
- Xem chi tiết từng route
- Export solution
- Reoptimization khi có thay đổi (new orders, cancellations)
- Dispatch settings configuration

**Flow:**
1. Chọn orders cần tối ưu hóa (status = pending)
2. Chọn vehicles và drivers available
3. Cấu hình solver parameters (iterations, time limit, etc)
4. Generate instance file
5. Submit job tới backend
6. Poll job status định kỳ
7. Hiển thị solution khi hoàn thành
8. Lưu solution và tạo routes trong database

**Solver Parameters:**
- `iterations`: Số vòng lặp tối đa
- `time_limit`: Giới hạn thời gian (giây)
- `max_vehicles`: Số xe tối đa
- `acceptance`: Chiến lược chấp nhận nghiệm (sa, rtr, greedy)
- `format`: Format instance (lilim, sartori)

**Components:**
- [src/app/routing/page.tsx](src/app/routing/page.tsx): Main routing page
- [src/components/routing/RoutingMap.tsx](src/components/routing/RoutingMap.tsx): Interactive map
- [src/services/solverService.ts](src/services/solverService.ts): Solver API client

### 4. Quản lý đội xe (Fleet Management)

**Tính năng:**
- Quản lý vehicles (xe)
- Quản lý drivers (tài xế)
- Gán driver cho vehicle
- Theo dõi trạng thái và availability
- Capacity management
- Vehicle types và specifications

**Vehicle Fields:**
- Biển số xe (license_plate)
- Loại xe (vehicle_type)
- Sức chứa (capacity_weight, capacity_volume)
- Trạng thái (status: active, inactive, maintenance)
- Thông tin bảo hiểm và đăng kiểm

**Driver Fields:**
- Họ tên (full_name)
- Số điện thoại (phone)
- Giấy phép lái xe (license_number)
- Trạng thái (is_active)
- Current location (real-time tracking)

**Components:**
- [src/app/fleet/page.tsx](src/app/fleet/page.tsx): Fleet management page
- [src/components/fleet/FleetManagement.tsx](src/components/fleet/FleetManagement.tsx): Main component

**API Integration:**
- [src/services/driverService.ts](src/services/driverService.ts): Driver và vehicle services

### 5. Xem bản đồ (Map View)

**Tính năng:**
- Hiển thị tất cả routes trên bản đồ
- Màu sắc khác nhau cho mỗi route
- Route sidebar với thông tin tổng hợp
- Click vào route để xem chi tiết
- Markers cho stops (pickup/delivery)
- Directions rendering với Mapbox Directions API
- Zoom to route extent
- Toggle visibility của routes

**Map Features:**
- Base map styles (streets, satellite)
- Real-time vehicle locations
- Geolocation (user location)
- Distance và duration measurement
- Route optimization visualization

**Components:**
- [src/app/map/page.tsx](src/app/map/page.tsx): Map page
- [src/components/map/](src/components/map/): Map-related components

**Technologies:**
- Mapbox GL JS
- Mapbox Directions API
- GeoJSON for route geometries

### 6. Chi tiết lộ trình (Route Details)

**Tính năng:**
- Xem chi tiết một route cụ thể
- Timeline với planned vs actual times
- Danh sách stops theo sequence
- Thông tin orders tại mỗi stop
- Map view của route
- Export route details
- Share route link

**Data Sources:**
- URL query parameter với base64 encoded data
- LocalStorage fallback
- Future: API fetch by route ID

**Components:**
- [src/app/route-details/page.tsx](src/app/route-details/page.tsx): List view
- [src/app/route-details/[routeId]/page.tsx](src/app/route-details/[routeId]/page.tsx): Detail view
- [src/components/route-details/RouteDetailsView.tsx](src/components/route-details/RouteDetailsView.tsx): Shared component
- [src/components/route-details/useRouteDetailsData.ts](src/components/route-details/useRouteDetailsData.ts): Data hook

### 7. Giám sát theo thời gian thực (Monitor)

**Tính năng:**
- Real-time tracking của tất cả vehicles
- Driver status (available, busy, offline)
- Route progress (completed stops / total stops)
- ETA predictions
- Timeline view cho mỗi driver
- Statistics dashboard
- Alerts cho delays và violations

**Realtime Updates:**
- Supabase Realtime subscriptions cho route_stops
- Polling cho vehicle locations
- WebSocket connection cho live updates

**Components:**
- [src/app/monitor/page.tsx](src/app/monitor/page.tsx): Monitor page
- [src/components/monitor/MonitorMap.tsx](src/components/monitor/MonitorMap.tsx): Real-time map
- [src/components/monitor/MonitorSidebar.tsx](src/components/monitor/MonitorSidebar.tsx): Sidebar with drivers
- [src/components/monitor/MonitorTimeline.tsx](src/components/monitor/MonitorTimeline.tsx): Timeline view
- [src/components/monitor/MonitorStats.tsx](src/components/monitor/MonitorStats.tsx): Statistics

### 8. Dispatch Console

**Tính năng:**
- Tổng quan toàn bộ operations
- Gán orders cho routes thủ công
- Drag-and-drop để sắp xếp stops
- Trigger reoptimization
- Communication với drivers
- Incident management

**Components:**
- [src/app/dispatch/page.tsx](src/app/dispatch/page.tsx): Dispatch console

### 9. User Profile Management

**Tính năng:**
- Xem và chỉnh sửa thông tin cá nhân
- Upload avatar
- Đổi mật khẩu
- Quản lý organization settings (admin only)
- Dispatch settings configuration

**Components:**
- [src/app/profile/page.tsx](src/app/profile/page.tsx): Profile page
- [src/components/profile/ProfileUpdater.tsx](src/components/profile/ProfileUpdater.tsx): Auto-sync component

## API và Services

### 1. Redux RTK Query Services

**authApi** ([src/lib/redux/services/auth.ts](src/lib/redux/services/auth.ts))

Endpoints:
- `getSession`: Lấy session hiện tại
- `signUp`: Đăng ký user mới
- `signIn`: Đăng nhập
- `signOut`: Đăng xuất
- `resetPassword`: Reset password
- `updatePassword`: Cập nhật password

**userApi** ([src/lib/redux/services/userApi.ts](src/lib/redux/services/userApi.ts))

Endpoints:
- `getUser`: Lấy thông tin user by ID
- `getUserProfileOverview`: Lấy user + organization
- `updateUserProfile`: Cập nhật profile
- `uploadAvatar`: Upload avatar image
- `updateOrganization`: Cập nhật organization settings

**orderApi** ([src/lib/redux/services/orderApi.ts](src/lib/redux/services/orderApi.ts))

Endpoints:
- `getOrders`: Lấy danh sách orders (có filter)
- `getOrderById`: Lấy order theo ID
- `createOrder`: Tạo order mới
- `updateOrder`: Cập nhật order
- `deleteOrder`: Xóa order
- `bulkUpdateOrderStatus`: Cập nhật status nhiều orders

Types:
- `Order`: Interface cho order object
- `OrderStatus`: Type cho các trạng thái order
- `PriorityLevel`: Type cho priority (normal, urgent)

**profileApi** ([src/lib/redux/services/profileApi.ts](src/lib/redux/services/profileApi.ts))

Endpoints:
- `getVehicles`: Lấy danh sách vehicles
- `createVehicle`: Tạo vehicle mới
- `updateVehicle`: Cập nhật vehicle
- `deleteVehicle`: Xóa vehicle
- `getDrivers`: Lấy danh sách drivers
- `createDriver`: Tạo driver mới
- `updateDriver`: Cập nhật driver
- `deleteDriver`: Xóa driver

**adminApi** ([src/lib/redux/services/adminApi.ts](src/lib/redux/services/adminApi.ts))

Endpoints:
- `getUsers`: Lấy danh sách users (admin only)
- `updateUserRole`: Cập nhật role của user
- `deactivateUser`: Deactivate user

### 2. Backend Solver Service

**solverService** ([src/services/solverService.ts](src/services/solverService.ts))

Functions:
- `submitOptimizationJob`: Submit job tối ưu hóa
- `pollJobStatus`: Poll trạng thái job
- `getJobResult`: Lấy kết quả job
- `cancelJob`: Hủy job
- `submitReoptimizationJob`: Submit reoptimization job

Types:
- `SolverParams`: Parameters cho solver
- `JobStatus`: Trạng thái job
- `VehicleStateInput`: Vehicle state cho dynamic mode
- `NewRequestInput`: New request cho dynamic mode
- `DynamicSolverResult`: Kết quả từ dynamic solver

API Endpoints được gọi:
- `POST /api/jobs/submit`: Submit job mới
- `GET /api/jobs/:jobId`: Lấy trạng thái job
- `DELETE /api/jobs/:jobId`: Hủy job
- `POST /api/jobs/reoptimize`: Submit reoptimization

### 3. Geocoding Service

**geocoding** ([src/services/geocoding.ts](src/services/geocoding.ts))

Functions:
- `geocodeAddress`: Convert địa chỉ thành tọa độ (lat, lng)
- `reverseGeocode`: Convert tọa độ thành địa chỉ

Integration:
- Nominatim OpenStreetMap API
- Mapbox Geocoding API (optional)

### 4. Driver Service

**driverService** ([src/services/driverService.ts](src/services/driverService.ts))

Functions:
- `getDrivers`: Lấy danh sách drivers
- `getVehicles`: Lấy danh sách vehicles
- `getActiveRouteAssignments`: Lấy active routes

### 5. Vehicle State Service

**vehicleStateService** ([src/services/vehicleStateService.ts](src/services/vehicleStateService.ts))

Functions:
- `calculateVehicleStates`: Tính toán vehicle states cho reoptimization
- `getCompletedStops`: Lấy các stops đã completed
- `getCurrentTime`: Lấy current time cho simulation

### 6. Supabase Direct Access

**Supabase Client** ([src/supabase/client.ts](src/supabase/client.ts))

Sử dụng trực tiếp cho:
- Real-time subscriptions
- Complex queries không phù hợp với RTK Query
- Storage operations (file uploads)
- Auth state changes

Tables:
- `users`: User accounts
- `organizations`: Organizations
- `orders`: Orders
- `locations`: Pickup/delivery locations
- `vehicles`: Fleet vehicles
- `drivers`: Drivers
- `routes`: Planned routes
- `route_stops`: Stops in routes
- `solutions`: Optimization solutions
- `optimization_jobs`: Job history

## State Management

### Redux Store Structure

```typescript
{
  auth: {
    session: Session | null,
    user: User | null
  },
  // RTK Query cache
  authApi: { ... },
  userApi: { ... },
  orderApi: { ... },
  profileApi: { ... },
  adminApi: { ... }
}
```

### Caching Strategy

RTK Query tự động cache API responses và invalidate khi cần thiết.

**Tag-based Invalidation:**
- `User`: Invalidate khi update user profile
- `Organization`: Invalidate khi update organization settings
- `Order`: Invalidate khi CRUD operations trên orders
- `Vehicle`: Invalidate khi CRUD operations trên vehicles
- `Driver`: Invalidate khi CRUD operations trên drivers

## Styling và UI

### Tailwind CSS

Sử dụng Tailwind CSS utility-first framework với custom configuration:
- Custom colors theo brand
- Custom spacing và sizing
- Dark mode support (future)
- Responsive breakpoints

### shadcn/ui Components

Bộ components từ shadcn/ui, có thể customize:
- Button, Input, Select, Checkbox, etc.
- Dialog, Alert Dialog, Popover
- Table, Card, Badge
- Form components với React Hook Form
- Toast notifications với Sonner

### Icons

- Lucide React icons
- Font Awesome (loaded via CDN)
- Custom SVG icons

## Performance Optimization

**Code Splitting:**
- Dynamic imports cho heavy components
- Route-based code splitting với Next.js

**Image Optimization:**
- Next.js Image component
- WebP format
- Lazy loading

**Data Fetching:**
- Server-side rendering cho SEO-critical pages
- Client-side fetching với RTK Query
- Caching và deduplication

**Map Optimization:**
- Disable React Strict Mode để tránh double-mount Mapbox
- Lazy load map components
- Debounce map events

## Environment Variables

Tất cả biến môi trường cần thiết:

```properties
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend API (Required)
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_API_BASE_URL=

# Mapbox (Required for map features)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# Branding (Optional)
NEXT_PUBLIC_LOGO_WAYO=
```

## Scripts

```json
{
  "dev": "next dev --turbopack",        // Development server với Turbopack
  "build": "next build",                // Build production
  "start": "next start",                // Start production server
  "lint": "next lint",                  // ESLint check
  "supabase:typegen": "...",            // Generate Supabase types
  "icons:generate": "..."               // Generate icon components
}
```

