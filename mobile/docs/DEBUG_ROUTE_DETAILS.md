# 🔍 HƯỚNG DẪN DEBUG ROUTE DETAILS - MOBILE APP

## 📋 Tổng quan vấn đề

Từ screenshot bạn gửi:
- ✅ Đúng: Route có **0/8 stops** (8 stops total, 0 completed)
- ❌ Sai: Chỉ hiển thị **4 items** thay vì thông tin chính xác

## 🏗️ Kiến trúc dữ liệu

### Database Schema (Supabase)
```
routes
├── id (PK)
├── solution_id (FK)
├── driver_id (FK)
└── ...

route_stops
├── id (PK)
├── route_id (FK) → routes.id
├── order_id (FK) → orders.id  ⚠️ NOT NULL!
├── location_id (FK) → locations.id
├── stop_sequence (int)
├── stop_type ('pickup' | 'delivery')
├── is_completed (boolean)
└── ...

orders
├── id (PK)
├── pickup_location_id (FK)
├── delivery_location_id (FK)
├── pickup_time_start/end
├── delivery_time_start/end
└── ...

locations
├── id (PK)
├── name (string)
├── latitude, longitude
└── ...
```

## 🔄 Flow dữ liệu

### 1️⃣ Solver → Database
```
PDPTW Solver Output
     ↓
persistSolutionSnapshot() [backend/src/persistence/]
     ↓
RPC: persist_solution_snapshot(jsonb) [Supabase function]
     ↓
INSERT INTO routes, route_stops
```

**Quan trọng:** Mỗi `route_stop` PHẢI có `order_id` (NOT NULL constraint)

### 2️⃣ Database → Mobile App
```
Supabase DB
     ↓
GET /api/mobile/routes/:id [backend/src/routes/mobileRoutes.ts]
     ↓  
mapStopToDto() - Map 1 stop → 1 order
     ↓
Mobile App receives JSON:
{
  route: {..., total_stops: 8, completed_stops: 0},
  stops: [
    {
      sequence: 1,
      type: "pickup",
      location_name: "Hoàng Văn E",
      orders: [{...}]  // ⚠️ Array with 1 order
    },
    ...
  ]
}
     ↓
RouteDetailsViewModel.groupStops() [mobile/app/.../RouteDetailsViewModel.kt]
     ↓
Logic: Same location_name AND same type → Group
     ↓
UI: RouteStopsAdapter displays grouped items
```

## 🐛 Debug Steps

### Bước 1: Kiểm tra dữ liệu trong Database

Mở **Supabase SQL Editor** và chạy file `backend/debug-route.sql`:

```sql
-- Copy nội dung từ debug-route.sql và thay route_id
```

**Kiểm tra:**
- ✅ Có đúng 8 stops?
- ✅ Tất cả stops đều có `order_id` (không NULL)?
- ✅ `location_name` có giống nhau không?
- ✅ `stop_type` có đúng không?

### Bước 2: Test Backend API

#### Cách 1: Dùng PowerShell Script
```powershell
cd D:\CODE\WAYO\backend
.\debug-route.ps1 -RouteId "e0aed9cc-f318-495a-9ed5-965a57e09694"
```

Khi chạy, script sẽ yêu cầu auth token. Lấy token từ mobile app:

**Lấy token từ Android Studio:**
1. Mở Android Studio
2. View → Tool Windows → App Inspection
3. Chọn device/emulator đang chạy app
4. Database Inspector → Chọn database
5. Tìm table lưu token (SharedPreferences hoặc DataStore)

**Hoặc thêm log vào app:**
```kotlin
// Thêm vào MainActivity hoặc LoginFragment
val token = // get from auth repository
android.util.Log.d("DEBUG_TOKEN", "Auth Token: $token")
```

#### Cách 2: Dùng curl
```bash
curl -X GET "http://localhost:3001/api/mobile/routes/e0aed9cc-f318-495a-9ed5-965a57e09694" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" | jq
```

### Bước 3: Debug Mobile App

#### Thêm logging vào các file:

**1. BackendRouteRepository.kt** (line ~145):
```kotlin
suspend fun refreshRouteDetails(routeId: String): AppResult<Pair<Route, List<Stop>>> = withContext(dispatchers.io) {
    try {
        android.util.Log.d("DEBUG_ROUTE", "🔍 Fetching route: $routeId")
        val response = backendApi.getRouteDetails(routeId)
        
        if (!response.isSuccessful || response.body() == null) {
            android.util.Log.e("DEBUG_ROUTE", "❌ API failed: ${response.code()}")
            return@withContext AppResult.Error(AppError.ServerError("Failed"))
        }
        
        val responseBody = response.body()!!
        android.util.Log.d("DEBUG_ROUTE", "📦 Received ${responseBody.stops.size} stops")
        
        // Log each stop
        responseBody.stops.forEachIndexed { idx, stopDto ->
            android.util.Log.d("DEBUG_ROUTE", 
                "  [$idx] Seq ${stopDto.sequence}: ${stopDto.type} at ${stopDto.locationName}, orders=${stopDto.orders.size}")
        }
        
        // ... rest of code
```

**2. RouteDetailsViewModel.kt** (line ~102):
```kotlin
when (val res = getRouteDetailsUseCase.refresh(routeId)) {
    is AppResult.Success -> {
        val (route, stops) = res.data
        android.util.Log.d("DEBUG_ROUTE", "✅ Got ${stops.size} stops from use case")
        
        stops.forEach { stop ->
            android.util.Log.d("DEBUG_ROUTE", 
                "  Stop ${stop.sequence}: ${stop.type}, location=${stop.locationName}, orders=${stop.orders.size}")
        }
        
        val grouped = groupStops(stops)
        android.util.Log.d("DEBUG_ROUTE", "📊 After grouping: ${grouped.size} UI items")
        
        grouped.forEachIndexed { idx, item ->
            when (item) {
                is UiRouteStopItem.Single -> {
                    android.util.Log.d("DEBUG_ROUTE", 
                        "  Item ${idx+1}: Single stop ${item.stop.sequence}")
                }
                is UiRouteStopItem.Group -> {
                    android.util.Log.d("DEBUG_ROUTE", 
                        "  Item ${idx+1}: Group ${item.stops.first().sequence}-${item.stops.last().sequence} (${item.stops.size} stops)")
                }
            }
        }
        
        _uiState.value = _uiState.value.copy(
            isLoading = false, 
            route = route, 
            stops = grouped
        )
    }
```

**3. Xem logs:**
- Android Studio → Logcat
- Filter: `DEBUG_ROUTE`
- Clear logs, refresh route trong app
- Xem logs theo thứ tự

## 🔍 Phân tích vấn đề

### Các nguyên nhân có thể:

#### 1. Backend không map đúng orders
**Triệu chứng:** API trả về `orders: []` (array rỗng)

**Nguyên nhân:** 
- `order_id` trong route_stops là NULL
- Order không tồn tại trong database
- Backend query orders thất bại

**Cách fix:** Kiểm tra trong `mapStopToDto()`:
```typescript
const orderDto = order
    ? {
        id: order.id,
        order_number: order.tracking_number ?? order.reference_code ?? order.id,
        // ...
    }
    : null;

return {
    // ...
    orders: orderDto ? [orderDto] : [],  // ⚠️ Nếu order null → []
};
```

#### 2. Grouping logic sai
**Triệu chứng:** Stops không được nhóm đúng

**Nguyên nhân:**
- `location_name` khác nhau (vd: "Hoàng Văn E" vs "Hoàng Văn E ")
- `stop_type` khác nhau
- Logic grouping có bug

**Cách kiểm tra:**
```kotlin
// RouteDetailsViewModel.kt - hàm groupStops()
private fun groupStops(stops: List<Stop>): List<UiRouteStopItem> {
    if (stops.isEmpty()) return emptyList()
    
    val result = mutableListOf<UiRouteStopItem>()
    var currentGroup = mutableListOf<Stop>()
    
    for (stop in stops) {
        if (currentGroup.isEmpty()) {
            currentGroup.add(stop)
            continue
        }
        
        val lastStop = currentGroup.last()
        // ⚠️ Điều kiện group: cùng location_name VÀ cùng type
        if (stop.locationName == lastStop.locationName && stop.type == lastStop.type) {
            currentGroup.add(stop)
        } else {
            addStoppedGroupToResult(currentGroup, result)
            currentGroup = mutableListOf(stop)
        }
    }
    
    if (currentGroup.isNotEmpty()) {
        addStoppedGroupToResult(currentGroup, result)
    }
    
    return result
}
```

#### 3. Orders count sai
**Triệu chứng:** Hiển thị "0 đơn" hoặc số sai

**Nguyên nhân:**
- Backend trả `orders: []`
- Mobile app không load orders từ cache
- Orders bị lọc mất

**Cách fix:** Kiểm tra trong `RouteStopsAdapter`:
```kotlin
private fun bindSingle(stop: Stop) {
    val ordersCount = stop.orders.size  // ⚠️ Đếm orders
    val ordersText = if (ordersCount > 0) 
        "$ordersCount đơn" 
    else 
        "chưa có đơn"
    b.subtitle.text = "${stop.type} • $ordersText • ${stop.status}"
}
```

## ✅ Checklist Debug

- [ ] Chạy SQL query kiểm tra database
- [ ] Verify: Tất cả 8 stops có order_id?
- [ ] Verify: Location names chính xác?
- [ ] Verify: Stop types đúng (pickup/delivery)?
- [ ] Test backend API với token
- [ ] Verify: API response có 8 stops?
- [ ] Verify: Mỗi stop có `orders` array không rỗng?
- [ ] Thêm logs vào mobile app
- [ ] Rebuild app: `gradlew :app:assembleDebug`
- [ ] Xem Logcat khi refresh route
- [ ] So sánh: Database → API → Mobile logs → UI

## 📊 Expected vs Actual

### Expected (8 stops):
```
Stop 1: pickup at Location A    → orders: [{...}]
Stop 2: pickup at Location A    → orders: [{...}]
Stop 3: pickup at Location A    → orders: [{...}]
Stop 4: delivery at Location B  → orders: [{...}]
Stop 5: pickup at Location C    → orders: [{...}]
Stop 6: delivery at Location D  → orders: [{...}]
Stop 7: delivery at Location D  → orders: [{...}]
Stop 8: delivery at Location D  → orders: [{...}]
```

### After Grouping (UI):
```
Item 1: Stop 1-3. Location A  (pickup • 3 đơn • pending)
Item 2: Stop 4. Location B    (delivery • 1 đơn • pending)
Item 3: Stop 5. Location C    (pickup • 1 đơn • pending)
Item 4: Stop 6-8. Location D  (delivery • 3 đơn • pending)
```

## 🎯 Next Actions

1. **Chạy SQL query đầu tiên** → Xác định dữ liệu gốc
2. **Gửi kết quả cho tôi** → Tôi sẽ phân tích
3. **Test API nếu có token** → Xác định backend response
4. **Thêm logs nếu cần** → Debug mobile app logic

Good luck! 🚀
