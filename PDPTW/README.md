# 🚛 PDPTW Visualizer - Refactored Architecture

> **Modern web-based visualization tool for Pickup and Delivery Problem with Time Windows (PDPTW)**

![Architecture](https://img.shields.io/badge/Architecture-Frontend%2FBackend%20Separated-brightgreen)
![Backend](https://img.shields.io/badge/Backend-Python%20Flask-blue)
![Frontend](https://img.shields.io/badge/Frontend-Vanilla%20JavaScript-yellow)
![API](https://img.shields.io/badge/API-RESTful-orange)

## 🏗️ **Kiến trúc mới (Refactored)**

### **📋 Tổng quan:**
Dự án đã được **refactor hoàn toàn** để tách biệt Frontend và Backend, tạo ra một kiến trúc hiện đại và dễ bảo trì.

```
PDPTW Visualizer
├── 🖥️  Frontend (Client-side)
│   ├── Pure HTML/CSS/JavaScript
│   ├── Interactive map visualization  
│   ├── Real-time API communication
│   └── Responsive user interface
│
├── ⚙️  Backend (Server-side)
│   ├── Python Flask REST API
│   ├── PDPTW algorithm execution
│   ├── File processing & validation
│   └── Data management
│
└── 🔗 Communication via REST API
```

## 📁 **Cấu trúc dự án:**

```
PDPTW/
├── 🎯 run.sh / run.bat          # Quick start scripts
├── 📄 README.md                 # This file
├── 
├── 🖥️ frontend/                 # Client-side application
│   ├── index.html               # Main application page
│   ├── src/
│   │   ├── api.js              # Backend API communication
│   │   ├── app.js              # Main application logic
│   │   ├── styles.css          # Custom styling
│   │   ├── structures.js       # Data structures
│   │   ├── reader.js           # File parsing
│   │   ├── mapper.js           # Map visualization
│   │   ├── timeline.js         # Timeline features
│   │   └── guide.js            # User guide
│   └── README.md
│
├── ⚙️ backend/                  # Server-side API
│   ├── app.py                  # Flask application
│   ├── requirements.txt        # Python dependencies
│   ├── uploads/                # Uploaded files
│   ├── results/                # Generated results
│   └── README.md
│
├── 🔧 RELEASE/                  # Algorithm executables
│   ├── PDPTW_ACO.exe
│   ├── PDPTW_GREEDY_INSERTION.exe
│   ├── PDPTW_HYBRID_ACO_GREEDY_V3.exe
│   └── ...
│
├── 📊 dataset/                  # Test instances and solutions
│   ├── Instances/
│   └── Solutions/
│
├── ✅ validator/                # Solution validation
└── 🗂️ visualizer/              # Legacy files (preserved)
```

## 🚀 **Quick Start**

### **🖱️ Cách dễ nhất - Chạy script tự động:**

**Windows:**
```bash
run.bat
```

**Linux/Mac:**
```bash
chmod +x run.sh
./run.sh
```

Script sẽ tự động:
- ✅ Kiểm tra dependencies
- ✅ Tạo virtual environment
- ✅ Cài đặt packages
- ✅ Khởi động backend (port 5000)
- ✅ Khởi động frontend (port 8080)
- ✅ Mở browser tự động

### **🔧 Cách thủ công:**

**1. Backend Setup:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

**2. Frontend Setup:**
```bash
cd frontend
# Option 1: Node.js http-server
npx http-server -p 8080 --cors

# Option 2: Python simple server
python -m http.server 8080

# Option 3: VS Code Live Server
# Right-click index.html → "Open with Live Server"
```

**3. Access:**
- 🖥️ Frontend: `http://localhost:8080`
- ⚙️ Backend API: `http://localhost:5000`

## ✨ **Tính năng mới:**

### **🔄 API-First Architecture:**
- ✅ RESTful API communication
- ✅ Real-time status monitoring
- ✅ Async/await error handling
- ✅ Health check endpoints

### **🎨 Modern UI/UX:**
- ✅ Responsive design
- ✅ Toast notifications
- ✅ Loading states with progress
- ✅ Interactive feedback
- ✅ Keyboard shortcuts (Ctrl+1,2,3)

### **📊 Enhanced Visualization:**
- ✅ Vertical timeline sidebar
- ✅ Progress bars for time windows
- ✅ Interactive route segments
- ✅ Real-time map updates

### **⚡ Performance Improvements:**
- ✅ Route caching system
- ✅ Lazy loading components
- ✅ Optimized API calls
- ✅ Memory management

## 📈 **Lợi ích của kiến trúc mới:**

### **🔧 Development:**
- ✅ **Separation of Concerns:** Frontend/Backend tách biệt
- ✅ **Maintainability:** Code dễ bảo trì và mở rộng
- ✅ **Scalability:** Có thể scale Frontend/Backend riêng biệt
- ✅ **Testing:** Test API và UI riêng lẻ

### **🎨 User Experience:**
- ✅ **Responsive:** Works on desktop, tablet, mobile
- ✅ **Real-time feedback:** Progress indicators và status
- ✅ **Error handling:** User-friendly error messages
- ✅ **Performance:** Faster loading và smooth interactions

### **🚀 Deployment:**
- ✅ **Flexible hosting:** Frontend/Backend có thể host riêng
- ✅ **CDN support:** Static assets có thể dùng CDN
- ✅ **Container ready:** Easy Docker deployment
- ✅ **Environment configs:** Dev/staging/production environments

---

## 📋 **Legacy Documentation (Original)**

Dự án này cung cấp một bộ giải hoàn chỉnh cho bài toán PDPTW (Pickup and Delivery Problem with Time Windows) sử dụng các thuật toán tối ưu hóa khác nhau như ACO (Ant Colony Optimization), Greedy Insertion, và phương pháp kết hợp Hybrid ACO-Greedy.
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

