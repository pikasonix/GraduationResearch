# Kế hoạch Hoàn thiện App - WAYO Driver

**Trạng thái:** App đã migration từ Compose → XML MVVM thành công  
**Vấn đề:** Chưa có simulator để test UI  
**Mục tiêu:** Hoàn thiện code và chuẩn bị sẵn sàng để test khi có simulator

---

## 📊 Trạng thái hiện tại

### ✅ Đã hoàn thành (Phase 1-6)
- ✅ Migration hoàn toàn từ Compose → XML + Fragment + MVVM
- ✅ Clean Architecture: 3 layers (Domain, Data, Presentation)
- ✅ Dependency Injection: Hilt setup hoàn chỉnh
- ✅ Offline-first: Room + Outbox pattern + WorkManager sync
- ✅ Navigation: Safe Args với 6 destinations
- ✅ Network: Retrofit + OkHttp + Moshi + Auth interceptor
- ✅ Security: EncryptedSharedPreferences cho tokens
- ✅ Image loading: Glide 4.16.0
- ✅ Backend: Supabase Auth + Custom REST API
- ✅ Test coverage: ~60% (5 test files, 34 test cases)

### ⚠️ Vấn đề cần xử lý

#### 1. Code Duplication (Critical)
**Vấn đề:** Còn code Compose cũ chưa xóa, gây nhầm lẫn và tăng APK size

**Duplicate Fragments:**
- `ui/auth/LoginFragment.kt` (old) vs `ui/xml/login/LoginFragment.kt` (new) ✅
- `ui/map/MapFragment.kt` (old) vs `ui/xml/map/MapFragment.kt` (new)
- `ui/profile/ProfileFragment.kt` (old) vs `ui/xml/profile/ProfileFragment.kt` (new)
- `ui/routes/RouteDetailsFragment.kt` (old) vs `ui/xml/routes/RouteDetailsFragment.kt` (new)

**Duplicate ViewModels:**
- `ui/auth/LoginViewModel.kt` vs `ui/viewmodel/LoginViewModel.kt` (2 versions)
- `ui/auth/SignUpViewModel.kt` vs `ui/viewmodel/SignUpViewModel.kt` (2 versions)
- `ui/map/MapViewModel.kt` vs `ui/xml/map/MapViewModel.kt` (có thể trùng)
- `ui/profile/ProfileViewModel.kt` vs `ui/xml/profile/ProfileViewModel.kt` (2 versions)
- `ui/routes/RouteDetailsViewModel.kt` vs `ui/xml/routes/RouteDetailsViewModel.kt` (2 versions)

**Action required:** Xóa các file cũ trong `ui/auth/`, `ui/map/`, `ui/profile/`, `ui/routes/` (giữ lại `ui/xml/*`)

#### 2. Test Coverage Gaps
**Hiện tại:** 60% coverage (5 UseCases + 1 Worker tested)

**Chưa test:**
- ViewModels: 0/9 tested (LoginViewModel, SignUpViewModel, AssignedRoutesViewModel, RouteDetailsViewModel, ProfileViewModel, MapViewModel)
- Repositories: 2/10 tested (AuthRepository, RouteRepository chưa có tests)
- DAOs: 0/6 tested (Room database operations)
- Workers: 1/1 tested (OutboxSyncWorker ✅)

**Target:** 80%+ coverage trước khi test UI

#### 3. Build Configuration Issues
- Missing `local.properties` template (developers cần biết keys nào cần set)
- BuildConfig fields chưa có fallback values cho CI/CD
- ProGuard rules chưa được test cho release builds

#### 4. UI Testing Preparation
**Chưa có:**
- Mock data generators cho UI testing
- Debug menu để switch environments/toggle features
- Espresso test base classes
- UI test scenarios documentation

---

## 🎯 Roadmap Hoàn thiện (Không cần simulator)

### Phase 7A: Code Cleanup (30 phút)
**Priority: CRITICAL** - Phải làm trước khi test UI

#### Task 7A.1: Xóa Fragments Compose cũ
```bash
# Xóa các file này:
ui/auth/LoginFragment.kt (old Compose version)
ui/map/MapFragment.kt (old Compose version)  
ui/profile/ProfileFragment.kt (old Compose version)
ui/routes/RouteSelectionFragment.kt (old Compose version)
ui/routes/RouteDetailsFragment.kt (old Compose version)

# Giữ lại:
ui/xml/login/LoginFragment.kt ✅
ui/xml/signup/SignUpFragment.kt ✅
ui/xml/map/MapFragment.kt ✅
ui/xml/profile/ProfileFragment.kt ✅
ui/xml/routes/AssignedRoutesFragment.kt ✅
ui/xml/routes/RouteDetailsFragment.kt ✅
```

#### Task 7A.2: Consolidate ViewModels
**Phân tích cần làm:**
1. So sánh 2 versions của mỗi ViewModel
2. Merge logic tốt nhất vào version XML
3. Xóa version cũ
4. Update imports trong Fragments

**Files cần check:**
- `ui/viewmodel/LoginViewModel.kt` vs `ui/auth/LoginViewModel.kt`
- `ui/viewmodel/SignUpViewModel.kt` vs `ui/auth/SignUpViewModel.kt`
- Compare và giữ version tốt nhất

#### Task 7A.3: Xóa Compose packages rỗng
```bash
ui/screens/ (nếu còn Compose code)
ui/components/ (nếu là Compose components)
ui/theme/ (nếu là Compose theme)
```

**Verification:**
```bash
# Tìm import Compose còn sót lại:
grep -r "androidx.compose" mobile/app/src/main/java/
grep -r "@Composable" mobile/app/src/main/java/

# Phải trả về 0 results
```

---

### Phase 7B: Unit Tests Expansion (2-3 giờ)
**Priority: HIGH** - Tăng coverage lên 80%+ để tự tin code đúng

#### Task 7B.1: ViewModel Tests (quan trọng nhất!)
**File:** `app/src/test/java/com/pikasonix/wayo/ui/xml/`

**1. LoginViewModelTest.kt**
```kotlin
// Test cases:
- login with valid credentials returns success
- login with empty email shows validation error
- login with invalid email shows validation error
- login with empty password shows validation error
- login with network error shows error state
- login with auth error shows proper message
- isLoading state transitions correctly
- successful login saves token and navigates
```

**2. SignUpViewModelTest.kt**
```kotlin
// Test cases:
- signup with valid data returns success
- signup with password mismatch shows error
- signup with short password shows validation error
- signup with duplicate email shows proper error
- phone number validation works correctly
```

**3. AssignedRoutesViewModelTest.kt**
```kotlin
// Test cases:
- observe routes emits data from repository Flow
- refresh triggers repository sync
- route selection updates selectedRoute state
- empty routes shows proper empty state
- network error shows retry option
```

**4. RouteDetailsViewModelTest.kt**
```kotlin
// Test cases:
- loadRouteDetails fetches from repository
- startRoute updates route status
- completeStop validates GPS coordinates
- completeStop queues action when offline
- completeRoute triggers sync
- navigation updates current stop index
```

**5. ProfileViewModelTest.kt**
```kotlin
// Test cases:
- loadProfile fetches driver data
- logout clears tokens and navigates
- profile update validates fields
- profile photo upload handles errors
```

#### Task 7B.2: Repository Tests
**File:** `app/src/test/java/com/pikasonix/wayo/data/repository/`

**1. AuthRepositoryImplTest.kt**
```kotlin
// Test cases:
- login calls Supabase auth and saves token
- signup creates account and auto-login
- logout clears tokens and revokes session
- getCurrentToken returns cached token
- token refresh on 401 error
```

**2. RouteRepositoryImplTest.kt**
```kotlin
// Test cases:
- observeAssignedRoutes returns Room Flow
- fetchAndCacheRoutes syncs from backend
- startRoute updates local + queues API call
- completeRoute marks status completed
- offline operations queue in outbox
```

#### Task 7B.3: DAO Tests (Instrumentation)
**File:** `app/src/androidTest/java/com/pikasonix/wayo/data/local/dao/`

**1. RoutesDaoTest.kt**
```kotlin
// Uses in-memory Room database
// Test cases:
- insert and retrieve route
- observeAssignedRoutes emits on changes
- update route status triggers Flow
- deleteOldCompleted removes by timestamp
- query by routeId returns correct route
```

**2. OutboxDaoTest.kt**
```kotlin
// Test cases:
- insert pending action
- getPendingActions orders by timestamp
- deleteAction removes by id
- retryable actions have retry_count
```

**Target:** 80%+ coverage sau Phase 7B

---

### Phase 7C: Build & CI Configuration (30 phút)
**Priority: MEDIUM** - Cần cho deployment

#### Task 7C.1: local.properties Template
**File:** `mobile/local.properties.example`
```properties
# Copy this to local.properties and fill in your keys

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Backend API
BACKEND_URL=https://api.wayo.com

# Mapbox (for map features)
MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
```

#### Task 7C.2: BuildConfig Fallbacks
**File:** `app/build.gradle.kts`
```kotlin
// Update defaultConfig:
buildConfigField("String", "SUPABASE_URL", 
    "\"${localProperties.getProperty("SUPABASE_URL", "https://demo.supabase.co")}\"")
buildConfigField("String", "BACKEND_URL", 
    "\"${localProperties.getProperty("BACKEND_URL", "https://api-demo.wayo.com")}\"")

// Add debug vs release configs:
buildTypes {
    debug {
        buildConfigField("String", "API_BASE_URL", "\"https://api-dev.wayo.com\"")
        buildConfigField("Boolean", "ENABLE_DEBUG_MENU", "true")
    }
    release {
        buildConfigField("String", "API_BASE_URL", "\"https://api.wayo.com\"")
        buildConfigField("Boolean", "ENABLE_DEBUG_MENU", "false")
    }
}
```

#### Task 7C.3: ProGuard Rules
**File:** `app/proguard-rules.pro`
```proguard
# Retrofit
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

# Moshi
-keep class kotlin.Metadata { *; }
-keep class com.pikasonix.wayo.data.remote.dto.** { *; }
-keep class com.pikasonix.wayo.domain.model.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
```

---

### Phase 7D: Debug & Testing Tools (1 giờ)
**Priority: HIGH** - Giúp testing dễ dàng hơn nhiều

#### Task 7D.1: Mock Data Generators
**File:** `app/src/debug/java/com/pikasonix/wayo/debug/MockDataGenerator.kt`
```kotlin
object MockDataGenerator {
    fun generateMockRoute(routeId: String = "ROUTE-001"): Route {
        return Route(
            routeId = routeId,
            driverId = "DRIVER-001",
            status = RouteStatus.ASSIGNED,
            scheduledDate = LocalDate.now(),
            stops = generateMockStops(5),
            totalDistance = 15.5,
            estimatedDuration = 120
        )
    }
    
    fun generateMockStops(count: Int): List<Stop> { ... }
    
    fun generateCompletedRoute(): Route { ... }
    fun generateRouteWithProblems(): Route { ... }
}
```

#### Task 7D.2: Debug Menu
**File:** `app/src/debug/java/com/pikasonix/wayo/debug/DebugMenuActivity.kt`
```kotlin
// Chức năng:
- Switch API environments (dev/staging/prod)
- Clear all cached data (Room + SharedPreferences)
- Simulate offline mode
- Inject mock routes
- View outbox pending actions
- Trigger manual sync
- View network logs
- Export database for inspection
```

**Kích hoạt:** Long-press logo trên LoginFragment (chỉ debug builds)

#### Task 7D.3: Logging Utilities
**File:** `app/src/main/java/com/pikasonix/wayo/core/utils/Logger.kt`
```kotlin
object Logger {
    fun d(tag: String, message: String) {
        if (BuildConfig.DEBUG) {
            Log.d(tag, message)
        }
    }
    
    fun logNavigation(from: String, to: String, args: Bundle?) { ... }
    fun logApiCall(method: String, url: String, duration: Long) { ... }
    fun logRoomOperation(operation: String, table: String) { ... }
}
```

---

## 🧪 Phase 8: Simulator Testing Preparation

### Pre-Simulator Checklist (Làm ngay bây giờ)

#### ✅ Code Quality
- [ ] Xóa tất cả Compose code cũ
- [ ] Không còn duplicate ViewModels/Fragments
- [ ] Không có unused imports
- [ ] Không có TODO/FIXME trong production code
- [ ] All unit tests passing (80%+ coverage)

#### ✅ Build Configuration
- [ ] `local.properties.example` có sẵn
- [ ] Debug build compiles successfully
- [ ] Release build compiles successfully (with ProGuard)
- [ ] APK size reasonable (<15MB)

#### ✅ Test Infrastructure
- [ ] Unit tests: 80%+ coverage
- [ ] DAO instrumentation tests passing
- [ ] API integration tests passing
- [ ] Mock data generators ready
- [ ] Debug menu functional

---

### Simulator Testing Plan (Khi có simulator)

#### Phase 8A: Smoke Tests (30 phút đầu tiên)
**Mục đích:** Xác nhận app khởi động và navigation cơ bản hoạt động

**Checklist:**
1. **App Launch**
   - [ ] App opens without crash
   - [ ] Splash screen displays correctly
   - [ ] Navigation to LoginFragment successful

2. **Login Flow**
   - [ ] Email validation shows errors correctly
   - [ ] Password visibility toggle works
   - [ ] "Forgot password" link navigates
   - [ ] Login with valid credentials navigates to RouteSelectionFragment
   - [ ] Error messages display properly

3. **Navigation**
   - [ ] Bottom navigation bar visible (after login)
   - [ ] Can navigate between tabs: Routes, Map, Profile
   - [ ] Back button works as expected
   - [ ] Safe Args passing data correctly

4. **Basic Rendering**
   - [ ] All XML layouts render without errors
   - [ ] Images load with Glide
   - [ ] RecyclerViews scroll smoothly
   - [ ] No layout overflow warnings

---

#### Phase 8B: Feature Testing (1-2 giờ)
**Mục đích:** Test từng feature chi tiết

**1. Authentication (30 phút)**
- [ ] **Login:**
  - Valid credentials → Success + navigate
  - Invalid credentials → Error message
  - Empty fields → Validation errors
  - Network error → Retry option
  - Remember me → Token persists

- [ ] **Sign Up:**
  - Valid data → Account created + auto-login
  - Password mismatch → Error
  - Duplicate email → Proper error
  - Phone validation → Accepts +84 format

- [ ] **Logout:**
  - Clears tokens → Returns to login
  - Clears cached data (optional)

**2. Route Management (45 phút)**
- [ ] **Assigned Routes List:**
  - Fetches and displays routes
  - Pull-to-refresh works
  - Empty state shows properly
  - Loading state displays
  - Error state with retry button

- [ ] **Route Details:**
  - Displays route info correctly
  - Shows all stops in order
  - Stop status indicators correct
  - "Start Route" button enables/disables properly
  - Navigation between stops works

- [ ] **Route Actions:**
  - Start route → Status updates
  - Complete stop → GPS validation
  - Complete stop → Status updates in list
  - Complete route → Confirmation dialog
  - Complete route → Sync to backend

**3. Offline Functionality (30 phút)**
- [ ] **Online Mode:**
  - Actions sync immediately
  - Real-time data updates

- [ ] **Offline Mode (Turn off WiFi/Data):**
  - App doesn't crash
  - Route data still visible (cached)
  - Can complete stops → Queued in outbox
  - Offline indicator shows
  - "Sync pending" message displays

- [ ] **Return Online:**
  - Auto-sync triggers
  - Queued actions execute
  - Conflicts resolved (if any)
  - Success notification shows

**4. Map Features (15 phút)**
- [ ] Map loads with Mapbox
- [ ] Driver location marker shows
- [ ] Route polyline renders
- [ ] Stop markers display
- [ ] Zoom/pan works smoothly
- [ ] "Navigate" button opens external maps

**5. Profile (15 phút)**
- [ ] Profile data loads
- [ ] Profile photo displays
- [ ] Stats show correctly
- [ ] Settings accessible
- [ ] Logout works

---

#### Phase 8C: Edge Cases & Error Handling (45 phút)

**Network Scenarios:**
- [ ] Slow network (3G simulation) → Timeouts handled
- [ ] No internet → Offline mode activates
- [ ] Intermittent connection → Retry logic works
- [ ] Backend down (5xx errors) → User-friendly message

**Data Scenarios:**
- [ ] Empty routes list → Empty state
- [ ] Route with no stops → Edge case handled
- [ ] Very long route (50+ stops) → Scrolling smooth
- [ ] Special characters in addresses → Renders correctly

**GPS Scenarios:**
- [ ] GPS disabled → Prompt to enable
- [ ] GPS inaccurate → Warning shown
- [ ] Outside allowed radius → Can't complete stop

**Token Scenarios:**
- [ ] Expired token → Auto-refresh
- [ ] Refresh fails → Logout + return to login
- [ ] Invalid token → Clear and re-authenticate

---

#### Phase 8D: UI/UX Polish (30 phút)

**Visual Checks:**
- [ ] All text readable (not cut off)
- [ ] Colors match design (Material 3)
- [ ] Icons display correctly
- [ ] Spacing/padding consistent
- [ ] Loading states smooth
- [ ] Animations not janky

**Accessibility:**
- [ ] Font scaling works (Settings → Display → Font size)
- [ ] Touch targets ≥48dp
- [ ] Content descriptions on images
- [ ] Error messages readable

**Performance:**
- [ ] App starts <2 seconds
- [ ] Screens transition smoothly
- [ ] No ANR (Application Not Responding)
- [ ] Memory usage reasonable (<100MB)
- [ ] Battery drain acceptable

---

#### Phase 8E: Espresso Automated Tests (2-3 giờ)
**Sau khi manual testing pass, viết automated tests**

**File:** `app/src/androidTest/java/com/pikasonix/wayo/ui/`

**1. LoginFlowTest.kt**
```kotlin
@Test
fun loginWithValidCredentials_navigatesToRouteSelection() {
    onView(withId(R.id.emailEditText)).perform(typeText("driver@wayo.com"))
    onView(withId(R.id.passwordEditText)).perform(typeText("password123"))
    onView(withId(R.id.loginButton)).perform(click())
    
    // Verify navigation
    onView(withId(R.id.assignedRoutesRecyclerView)).check(matches(isDisplayed()))
}

@Test
fun loginWithEmptyEmail_showsValidationError() { ... }
```

**2. RouteFlowTest.kt**
```kotlin
@Test
fun selectRoute_showsRouteDetails() { ... }

@Test
fun completeStop_updatesStopStatus() { ... }
```

**3. OfflineFlowTest.kt**
```kotlin
@Test
fun completeStopOffline_queuesInOutbox() { ... }
```

---

## 📋 Checklist Tổng hợp

### Trước khi có Simulator (Làm ngay)

#### Week 1: Code Cleanup + Testing
- [ ] **Day 1-2:** Phase 7A - Xóa code duplicate (30 phút)
- [ ] **Day 2-3:** Phase 7B - Viết ViewModel tests (2-3 giờ)
- [ ] **Day 3-4:** Phase 7B - Viết Repository tests (1-2 giờ)
- [ ] **Day 4-5:** Phase 7B - Viết DAO tests (1 giờ)
- [ ] **Day 5:** Phase 7C - Build configuration (30 phút)
- [ ] **Day 6-7:** Phase 7D - Debug tools + Mock data (1 giờ)

**Verification:**
```bash
# Run all tests
./gradlew test
./gradlew connectedAndroidTest

# Check coverage
./gradlew jacocoTestReport
# Target: 80%+ coverage

# Build verification
./gradlew assembleDebug assembleRelease
# Both should succeed
```

---

### Khi có Simulator (Testing)

#### Day 1: Smoke Tests
- [ ] Phase 8A (30 phút) - App launch + basic navigation
- [ ] Fix critical issues found
- [ ] Re-test until stable

#### Day 2-3: Feature Testing
- [ ] Phase 8B (2 giờ) - All features end-to-end
- [ ] Document bugs in GitHub Issues
- [ ] Fix P0/P1 bugs

#### Day 4: Edge Cases
- [ ] Phase 8C (45 phút) - Network/GPS/Token scenarios
- [ ] Phase 8D (30 phút) - UI polish
- [ ] Performance profiling

#### Day 5: Automation
- [ ] Phase 8E (2-3 giờ) - Espresso tests
- [ ] CI integration
- [ ] Final verification

---

## 🚀 Success Criteria

### Code Quality (Before Simulator)
- ✅ Zero duplicate code (no Compose remnants)
- ✅ 80%+ unit test coverage
- ✅ All tests passing (unit + instrumentation)
- ✅ Debug build <15MB APK size
- ✅ Release build with ProGuard successful
- ✅ Zero lint errors (critical/high priority)

### Functional (With Simulator)
- ✅ All features work end-to-end
- ✅ Offline mode functional
- ✅ No crashes in normal usage
- ✅ Graceful error handling
- ✅ Data persistence works
- ✅ Background sync reliable

### Performance
- ✅ App launch <2 seconds
- ✅ Smooth scrolling (60fps)
- ✅ Memory usage <100MB
- ✅ No ANRs or freezes

### Ready for Production
- ✅ All Espresso tests passing
- ✅ Manual testing checklist 100% complete
- ✅ Accessibility guidelines met
- ✅ Privacy policy implemented
- ✅ Crashlytics integrated (optional)

---

## 🎯 Ưu tiên Ngay (Top 3)

### 1. Code Cleanup (30 phút) 🔥
**Tại sao:** Duplicate code gây confusion và bugs
**Action:** Delete `ui/auth/`, `ui/map/`, `ui/profile/`, `ui/routes/` (old Compose versions)

### 2. ViewModel Tests (2 giờ) 🔥
**Tại sao:** ViewModels là business logic core, phải test kỹ
**Action:** Write tests for LoginViewModel, AssignedRoutesViewModel, RouteDetailsViewModel

### 3. Mock Data Generator (30 phút) 🔥
**Tại sao:** Giúp testing UI nhanh hơn rất nhiều
**Action:** Create MockDataGenerator.kt with realistic test data

---

## 📞 Support Commands

### Chạy tests
```bash
# Unit tests only
./gradlew test

# Instrumentation tests (cần emulator/device)
./gradlew connectedAndroidTest

# Specific test class
./gradlew test --tests LoginViewModelTest

# With coverage report
./gradlew jacocoTestReport
# Report: build/reports/jacoco/index.html
```

### Build verification
```bash
# Clean build
./gradlew clean

# Debug build
./gradlew assembleDebug

# Release build (with ProGuard)
./gradlew assembleRelease

# Check APK size
ls -lh app/build/outputs/apk/debug/app-debug.apk
```

### Code quality checks
```bash
# Lint check
./gradlew lint
# Report: build/reports/lint-results.html

# Detekt (static analysis)
./gradlew detekt

# Find unused resources
./gradlew lint --check UnusedResources
```

---

## 🎓 Notes

**Tại sao không cần simulator ngay:**
- 80% công việc là business logic → có thể unit test
- ViewModels, UseCases, Repositories → mock dependencies
- Room DAOs → in-memory database testing
- Network layer → mock Retrofit responses

**Khi nào cần simulator:**
- UI layout verification
- Navigation flow testing
- User interaction (clicks, swipes, scroll)
- GPS/sensor features
- Performance profiling

**Estimated timeline:**
- Without simulator: 1 week (code cleanup + comprehensive testing)
- With simulator: 2-3 days (manual testing + automation)
- **Total: ~10 days to production-ready**

---

**Next Step:** Bắt đầu với Phase 7A (Code Cleanup) → Takes only 30 minutes! 🚀
