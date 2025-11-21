# Bộ giải PDPTW

Đây là bộ giải **Pickup and Delivery Problem with Time Windows (PDPTW)**,
nhận dữ liệu đầu vào là các file instance chuẩn Li & Lim hoặc Satori & Buriol và trả về lời giải (tuyến xe, chi phí)

---

## 1. Mô tả tổng quan

- Đầu vào: file instance `.txt` trong thư mục `instances/` (ví dụ: `lr107.txt`, `LC1_10_1.txt`).
- Đầu ra:
  - File solution trong thư mục `solutions/`, ví dụ: `lr107.10_1111.31.txt`.

---

## 2. Cấu trúc project

- `apps/main.cpp`
  - Điểm vào chương trình (entry point).
  - Đọc tham số dòng lệnh bằng CLI11 (`--instance`, `--time-limit`, `--seed`, ...).
  - Khởi tạo log, gọi solver chính, ghi lời giải ra `solutions/`.

- `src/`
  - `src/problem/`: biểu diễn dữ liệu bài toán (request, depot, time window, ma trận quãng đường/thời gian...).
  - `src/solution/`: cấu trúc lưu nghiệm (danh sách tuyến, thứ tự pickup–delivery, chi phí, số xe...).
  - `src/construction/`: heuristic xây dựng nghiệm ban đầu.
  - `src/lns/`: toàn bộ logic Large Neighborhood Search (destroy/repair, acceptance,...).
  - `src/ages/`: tối ưu số xe (fleet minimization) trên nghiệm đã có.
  - `src/io/`: đọc instance Li & Lim, ghi solution dạng SINTEF vào thư mục `solutions/`.
  - `src/utils/`: tiện ích chung (log, số học, validator kiểm tra nghiệm,...).
  - `src/solver/`: ghép các bước construction → LNS → fleet minimization → validation.

- `include/pdptw/`
  - Các file header tương ứng với `src/`, cung cấp API cấp cao cho solver.

- `instances/`
  - Chứa các file bài toán mẫu, ví dụ:
    - `LC1_10_1.txt` – instance lớn.
    - `lr107.txt`, `lc103.txt` – instance vừa/nhỏ.

- `solutions/`
  - Thư mục chứa lời giải mà chương trình sinh ra.

- `tests/`
  - Bộ test dùng GoogleTest kiểm tra các thành phần (destroy/repair, solver, validator, IO,...).

- `CMakeLists.txt`
  - Cấu hình CMake cho toàn project, khai báo các thư viện ngoài (spdlog, CLI11, nlohmann/json,...)
  - Tạo target `pdptw_solver` và target test.

- `build_and_test.bat`
  - Script build trên Windows:
    - Gọi môi trường Visual Studio.
    - Chạy CMake tạo project.
    - Build `Release` và chạy test đơn vị.

---

## 4. Build và chạy chương trình

### 4.1. Yêu cầu môi trường

- Windows,  C++17
- CMake >= 3.15
- Python (tuỳ chọn) nếu dùng script validator

### 4.2. Build bằng script

Từ thư mục gốc project:

```cmd
build_and_test.bat
```

Sau khi build thành công, file thực thi chính nằm tại:

```text
build\apps\Release\pdptw_solver.exe
```

---

## 5. Câu lệnh chạy instance

Giả sử đang ở thư mục gốc project:  
`d:\Docments\20251\GR2\PDPTW Algo\MainAlgo\PDPTW_Cpp\cpp_project\cpp_project`

### 5.1. Chạy instance vừa/nhỏ (ví dụ `lr107.txt`)

```cmd
.build\apps\Release\pdptw_solver.exe --instance .\instances\lr107.txt
```

### 5.2. Chạy instance lớn `LC1_10_1` trong 10 phút

```cmd
.uild\apps\Release\pdptw_solver.exe --instance .\instances\LC1_10_1.txt --time-limit 600
```

### 5.3. Chạy kèm seed cố định (tái lập kết quả)

```cmd
.uild\apps\Release\pdptw_solver.exe --instance .\instances\LC1_10_1.txt --time-limit 600 --seed 42
```

### 5.4. Xem đầy đủ tham số dòng lệnh

```cmd
.uild\apps\Release\pdptw_solver.exe --help
```

Các tham số quan trọng:

- `-i, --instance <FILE>`: (bắt buộc) đường dẫn file instance.
- `--time-limit <SECONDS>`: giới hạn thời gian chạy (0 = không giới hạn).
- `--iterations <N>`: số vòng lặp LNS tối đa.
- `--max-non-improving <N>`: số vòng lặp liên tiếp không cải thiện trước khi dừng.
- `--min-destroy`, `--max-destroy`: tỉ lệ phần tử bị destroy trong mỗi bước LNS.
- `--acceptance {sa,rtr,greedy}`: tiêu chí chấp nhận nghiệm.

---


.\build\apps\Release\pdptw_solver.exe -i instances\bar-n5000-1.txt -f sartori --time-limit 300