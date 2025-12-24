# Bug report: Popup Mapbox không hiển thị (trên /orders)

## Bối cảnh
- Tính năng: Map hiển thị điểm pickup/delivery cho orders trên trang `/orders`.
- Component liên quan: `UniversalMap`.
- Kỳ vọng: Khi click vào marker trên map, popup hiển thị thông tin đơn hàng.

## Triệu chứng
- Click marker có chạy handler và log debug cho thấy popup đã được tạo:
  - Ví dụ: `[UniversalMap] pickup marker activate <orderId> {popups: 1}`
- Nhưng khi kiểm tra DOM ngay sau đó:
  - `document.querySelector('.mapboxgl-popup')?.getBoundingClientRect()` trả về `undefined`
  - Tương đương: `document.querySelector('.mapboxgl-popup')` trả về `null` (không tìm thấy popup trong DOM).

## Nguyên nhân gốc (root cause)
Popup thực tế **được add vào map**, nhưng **bị remove ngay lập tức** do React state update gây re-render.

Cụ thể luồng xảy ra:
1. User click marker → handler gọi `popup.addTo(map)` → popup xuất hiện trong DOM (log thấy `popups: 1`).
2. Ngay sau đó handler gọi `onOrderSelect(order.id)` → cập nhật state selection ở `/orders`.
3. Rerender làm prop `orders` vào `UniversalMap` có thể bị **đổi thứ tự (re-order)** hoặc tạo array instance mới.
4. Trong `UniversalMap`, effect tạo markers dùng một `coordsKey` dựa trên `orders.map(...).join(';')`.
   - Nếu `orders` bị đổi thứ tự thì `coordsKey` đổi (dù dữ liệu lat/lng không đổi).
5. Khi `coordsKey` đổi, effect coi như “dữ liệu tọa độ đã thay đổi” và **recreate markers**:
   - cleanup gọi `popup.remove()` và `marker.remove()`.
6. Kết quả: popup vừa tạo xong bị xoá ngay, nên lúc user chạy query trong console thì `.mapboxgl-popup` không còn.

## Vì sao không phải do `closeOnClick`
Trong popup options đã có `closeOnClick: false`, nên popup không bị đóng bởi click vào map.
Vấn đề xảy ra do logic lifecycle (cleanup/recreate) chứ không phải do Mapbox tự đóng.

## Cách fix
### Thay đổi chính
Làm `coordsKey` **ổn định theo nội dung** và **không phụ thuộc thứ tự `orders`**.

- Trước fix:
  - `coordsKey = orders.map(...).join(';')` (phụ thuộc thứ tự)
- Sau fix:
  - `coordsKey = [...orders].sort((a,b) => String(a.id).localeCompare(String(b.id))).map(...).join(';')`

Điều này đảm bảo:
- Nếu chỉ đổi selection hoặc re-order `orders` mà lat/lng không đổi → `coordsKey` giữ nguyên.
- Markers/popup không bị recreate → popup không bị remove ngay sau click.

### File thay đổi
- `frontend/src/components/map/UniversalMap.tsx`
  - Sửa logic xây dựng `coordsKey` cho order markers thành order-insensitive.

## Cách verify
1. Mở `/orders`.
2. Click một marker pickup/delivery.
3. Popup phải hiển thị và không biến mất ngay.
4. Trong console, chạy:
   - `document.querySelector('.mapboxgl-popup')` phải trả về element (không phải `null`).

## Ghi chú / bài học
- Khi dùng Mapbox Marker/Popup trong React, tránh recreate marker/popup theo những thay đổi UI state (selection) không liên quan đến tọa độ.
- Nếu cần key để quyết định recreate, key phải “stable” theo dữ liệu thật sự thay đổi (lat/lng), không phụ thuộc vào thứ tự array.
