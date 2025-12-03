Dưới đây là nội dung đã được thêm dấu tiếng Việt hoàn chỉnh:

# WAYO Backend

Dự án backend cho hệ thống WAYO, cung cấp API và tích hợp bộ giải thuật tối ưu hóa lộ trình (PDPTW).

## Cấu trúc dự án

Dự án được tổ chức thành các thành phần chính sau:

### 1. Backend Server (Node.js/TypeScript)
Thư mục `src/` chứa mã nguồn của server:
- **server.ts**: Điểm khởi chạy của ứng dụng Express.
- **routes/**: Định nghĩa các API endpoint để frontend gọi đến.
- **queue/**: Hệ thống hàng đợi (Job Queue) để quản lý các tác vụ xử lý lộ trình.
- **workers/**: Các worker thực thi tác vụ, chịu trách nhiệm gọi file thực thi của thuật toán.
- **types/**: Định nghĩa các interface và kiểu dữ liệu TypeScript.

### 2. Solver Module (C++)
Thư mục `pdptw_solver_module/` chứa mã nguồn của thuật toán tối ưu:
- **apps/**: Chứa file `main.cpp`, điểm vào của chương trình C++.
- **src/**: Cài đặt chi tiết các thuật toán:
  - **construction/**: Xây dựng nghiệm ban đầu.
  - **lns/**: Thuật toán Large Neighborhood Search.
  - **ages/**: Tối ưu hóa số lượng xe (Fleet Minimization).
  - **io/**: Đọc ghi dữ liệu.
- **include/**: Các file header tương ứng.
- **instances/**: Các file dữ liệu mẫu (benchmark).
- **solutions/**: Thư mục chứa kết quả đầu ra.

### 3. Các thư mục khác
- **bin/**: Nơi chứa file thực thi (`.exe`) của solver sau khi build.
- **storage/**: Lưu trữ tạm thời các file input/output trong quá trình xử lý.
- **test_output/**: Kết quả chạy test.

## Tính năng

### Quản lý Tác vụ (Job Management)
- Tiếp nhận yêu cầu tối ưu hóa từ Frontend thông qua API.
- Sử dụng cơ chế hàng đợi để xử lý tuần tự các yêu cầu, tránh quá tải hệ thống.
- Theo dõi trạng thái của từng tác vụ (đang chờ, đang xử lý, hoàn thành, thất bại).

### Thuật toán Tối ưu (PDPTW Solver)
- Giải quyết bài toán Pickup and Delivery Problem with Time Windows.
- Hỗ trợ các ràng buộc về thời gian (Time Windows) và tải trọng xe.
- Tối ưu hóa đồng thời hai mục tiêu:
  1. Giảm thiểu số lượng xe sử dụng.
  2. Giảm thiểu tổng quãng đường/chi phí di chuyển.
- Sử dụng kết hợp các kỹ thuật hiện đại: Construction Heuristic, LNS (Large Neighborhood Search).

### Tích hợp hệ thống
- Giao tiếp giữa Node.js và C++ thông qua process spawning.
- Xử lý file input/output tự động.
- Validate dữ liệu đầu vào và kết quả đầu ra.
