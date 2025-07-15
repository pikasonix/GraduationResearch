# Debug Route Display Issues

## Các bước kiểm tra khi routes không hiển thị

### 1. Kiểm tra Console Logs
- `=== drawSolution called ===` - xác nhận function được gọi
- `Number of routes: X` - xác nhận có routes trong solution
- `=== Processing route: X ===` - theo dõi từng route
- `✓ Added polygon for route X to map` - xác nhận polygon được tạo
- `Total polygons created: X` - đếm tổng số polygons

### 2. Kiểm tra Route Data
- Route có `sequence` hợp lệ (array với ít nhất 2 nodes)
- Route có `color` được định nghĩa
- Instance nodes có coordinates hợp lệ
- Route path không empty hoặc null

### 3. Kiểm tra Map State
- leafletMapRef.current tồn tại
- Map đã được khởi tạo đúng cách
- Zoom level và bounds phù hợp

### 4. Kiểm tra Polygon Style
- fillOpacity: 0.2 (có thể tăng lên 0.5 để rõ hơn)
- opacity: 0.8
- weight: 3
- color từ route.color

### 5. Các lỗi thường gặp
- Infinite loops trong useEffect
- State conflicts giữa polygons và routesPolylines
- Event handlers bị ghi đè
- Map layers bị clear trước khi hiển thị

### 6. Test Commands
```javascript
// Trong browser console
console.log(leafletMapRef.current);
console.log(polygons);
console.log(solution);
```

### 7. Quick Fixes
- Tăng fillOpacity lên 0.5
- Thêm console.log trong addTo() method
- Kiểm tra map bounds có đúng không
- Đảm bảo không có CSS ẩn routes
