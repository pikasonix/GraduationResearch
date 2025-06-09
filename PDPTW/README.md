# PDPTW (Pickup and Delivery Problem with Time Windows) Solver

Dự án này cung cấp một bộ giải hoàn chỉnh cho bài toán PDPTW (Pickup and Delivery Problem with Time Windows) sử dụng các thuật toán tối ưu hóa khác nhau như ACO (Ant Colony Optimization), Greedy Insertion, và phương pháp kết hợp Hybrid ACO-Greedy.

## Mục lục

- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Cài đặt](#cài-đặt)
- [Sử dụng](#sử-dụng)
- [Visualizer](#visualizer)
- [Validator](#validator)
- [Dataset](#dataset)
- [Thuật toán](#thuật-toán)


## Cấu trúc dự án

```
PDPTW/
├── README.md                    # File hướng dẫn này
├── input.txt                    # File input mẫu
├── output.txt                   # File output mẫu
├── dataset/                     # Bộ dữ liệu test cases
│   ├── Instances/              # Các instance bài toán
│   │   ├── n100/              # Test cases với 100 nodes
│   │   ├── n200/              # Test cases với 200 nodes
│   │   └── n400/              # Test cases với 400 nodes
│   └── Solutions/             # Các solution tham khảo
├── RELEASE/                    # Các file thực thi và mã nguồn
│   ├── PDPTW_ACO.cpp          # Thuật toán ACO
│   ├── PDPTW_ACO.exe
│   ├── PDPTW_GREEDY_INSERTION.cpp  # Thuật toán Greedy Insertion
│   ├── PDPTW_GREEDY_INSERTION.exe
│   ├── PDPTW_HYBRID_ACO_GREEDY_V3.cpp # Thuật toán Hybrid
│   ├── PDPTW_HYBRID_ACO_GREEDY_V3.exe
│   └── PDPTW_ORTOOLS.py       # Giải pháp sử dụng OR-Tools
├── validator/                  # Công cụ validation
│   └── validator.py
└── visualizer/                # visualizer
    ├── package.json
    ├── server.js
    └── public/
```

## Cài đặt

### 1. Cài đặt Visualizer

```bash
# Di chuyển vào thư mục visualizer
cd visualizer

# Cài đặt dependencies
npm install

# Khởi chạy server
npm start
```

Server sẽ chạy tại `http://localhost:3000`

### 2. Cài đặt Python dependencies (cho OR-Tools và Validator)

```bash
# Cài đặt OR-Tools
pip install ortools

# Không cần cài đặt gì thêm cho validator (chỉ cần Python thuần)
```

## Sử dụng

### 1. Chạy Solver từ Command Line

#### ACO Solver:
```bash
cd RELEASE
PDPTW_ACO.exe input_file.txt output_file.txt
```

#### Greedy Insertion Solver:
```bash
cd RELEASE
PDPTW_GREEDY_INSERTION.exe input_file.txt output_file.txt
```

#### Hybrid ACO-Greedy Solver (Khuyến nghị):
```bash
cd RELEASE
PDPTW_HYBRID_ACO_GREEDY_V3.exe input_file.txt output_file.txt
```

#### OR-Tools Solver:
```bash
cd RELEASE
python PDPTW_ORTOOLS.py input_file.txt output_file.txt
```

### 2. Định dạng Input File

Format của file input (.txt):
```
NAME: instance_name
LOCATION: city_name
COMMENT: description
TYPE: PDPTW
SIZE: number_of_nodes
CAPACITY: vehicle_capacity
NODES (INDEX X Y DEMAND PICKUP/DELIVERY PAIR SERVICE_TIME TIME_WINDOW_START TIME_WINDOW_END):
0 50.0 50.0 0 0 0 0 0 1440
1 10.0 20.0 1 1 11 10 0 200
...
```

### 3. Định dạng Output File

Format của file solution (.txt):
```
Instance: instance_name
Best solution cost: total_cost
Number of routes: route_count
Route 1: 0 -> 1 -> 11 -> 0
Route 2: 0 -> 2 -> 12 -> 0
...
```

## Visualizer

Visualizer cung cấp giao diện web tương tác để:

### Tính năng chính:
- **Load Instance**: Tải instance từ file hoặc nhập trực tiếp
- **Solve Online**: Giải bài toán trực tiếp trên web
- **Visualize Solution**: Hiển thị kết quả trên bản đồ
- **Route Analysis**: Phân tích chi tiết từng route

### Cách sử dụng:

1. **Khởi chạy visualizer**:
   ```bash
   cd visualizer
   npm start
   ```

2. **Truy cập**: Mở browser và vào `http://localhost:3000`

3. **Load Instance**:
   - Click "Load Instance File" để tải từ file
   - Hoặc paste nội dung vào textarea
   - Hoặc click "Load ví dụ" để thử với dữ liệu mẫu

4. **Giải bài toán**:
   - Click "Giải bài toán" để solver tự động
   - Kết quả sẽ hiển thị trên bản đồ


##  Validator

Validator được sử dụng để kiểm tra tính hợp lệ của solution.

### Cách sử dụng:

```bash
cd validator
python validator.py instance_file.txt solution_file.txt
```

### Ví dụ:
```bash
cd validator
python validator.py ../dataset/Instances/n100/bar-n100-1.txt ../dataset/Solutions/n100/bar-n100-1.6_733.txt
```

### Validator sẽ kiểm tra:
- **Capacity constraints**: Ràng buộc tải trọng xe
- **Time window constraints**: Ràng buộc cửa sổ thời gian
- **Pickup-Delivery pairing**: Ràng buộc cặp pickup-delivery
- **Route validity**: Tính hợp lệ của route
- **Cost calculation**: Tính toán cost chính xác


## Dataset

Dataset bao gồm các test cases được chia theo quy mô:

### Instances:
- **n100/**: 100 nodes (nhỏ) - Thích hợp để test nhanh
- **n200/**: 200 nodes (trung bình) - Cân bằng giữa tốc độ và độ phức tạp  
- **n400/**: 400 nodes (lớn) - Test hiệu năng thuật toán

## Thuật toán

### 1. ACO (Ant Colony Optimization)
#### Cách chạy:
```powershell
cd RELEASE
.\PDPTW_ACO.exe input.txt output.txt
```

### 2. Greedy Insertion

#### Cách chạy:
```powershell
cd RELEASE
.\PDPTW_GREEDY_INSERTION.exe input.txt output.txt
```

### 3. Hybrid ACO-Greedy (Khuyến nghị)

#### Cách chạy:
```powershell
cd RELEASE
.\PDPTW_HYBRID_ACO_GREEDY_V3.exe input.txt output.txt
```

### 4. OR-Tools 

#### Cài đặt yêu cầu:
```powershell
pip install ortools
```

#### Cách chạy:
```powershell
cd RELEASE
python PDPTW_ORTOOLS.py input.txt output.txt
```

