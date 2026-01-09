# Phân tích dự án Solver cho bài toán Large-Scale PDPTW

Tài liệu này phân tích cấu trúc, thuật toán và luồng hoạt động của dự án Rust dùng để giải quyết Bài toán Lấy và Giao hàng với Cửa sổ Thời gian quy mô lớn (Large-Scale Pickup and Delivery Problem with Time Windows - PDPTW).

## 1. Tổng quan

- **Mục tiêu:** Dự án này là một bộ giải (solver) hiệu năng cao được viết bằng ngôn ngữ Rust, chuyên để giải quyết các bài toán PDPTW, đặc biệt là các bài toán có quy mô lớn (large-scale) như trong các hệ thống chia sẻ chuyến đi (ride-sharing).
- **Phương pháp chính:** Thuật toán cốt lõi dựa trên một metaheuristic phức tạp kết hợp nhiều kỹ thuật:
    - **Large Neighborhood Search (LNS):** Là thuật toán tìm kiếm cục bộ chính, dùng để cải thiện lời giải một cách lặp đi lặp lại.
    - **Adaptive-Genetic-Evolutionary-Search (AGES):** Một metaheuristic cấp cao hơn, hoạt động như một dạng của Iterated Local Search (ILS), quản lý và điều hướng quá trình tìm kiếm của LNS để tránh bị mắc kẹt ở các điểm tối ưu cục bộ.
    - **Decomposition (Phân rã):** Đối với các bài toán cực lớn, dự án có khả năng phân rã bài toán thành các cụm nhỏ hơn, giải quyết chúng một cách độc lập (hoặc lồng nhau) và sau đó kết hợp lại kết quả.
- **Ngôn ngữ:** Rust được chọn vì hiệu năng vượt trội, khả năng kiểm soát bộ nhớ an toàn và hỗ trợ lập trình song song hiệu quả, rất quan trọng cho các thuật toán tối ưu phức tạp.

## 2. Cấu trúc dự án

Dự án được tổ chức một cách module hóa và rõ ràng:

- `src/`: Chứa toàn bộ mã nguồn của solver.
    - `main.rs`: Điểm khởi đầu của chương trình. Chịu trách nhiệm xử lý các đối số dòng lệnh, khởi tạo môi trường, gọi solver và xuất kết quả.
    - `cli.rs`: Định nghĩa tất cả các tham số dòng lệnh (CLI) sử dụng thư viện `clap`. Điều này cho phép người dùng tùy chỉnh sâu sắc các hành vi của solver.
    - `problem/`: Định nghĩa các cấu trúc dữ liệu cốt lõi của bài toán.
        - `pdptw.rs`: Chứa các struct như `PDPTWInstance`, `Node`, `Vehicle`, định nghĩa đầy đủ một thực thể (instance) của bài toán.
        - `travel_matrix.rs`: Quản lý ma trận khoảng cách và thời gian di chuyển giữa các địa điểm.
    - `io/`: Chịu trách nhiệm đọc dữ liệu đầu vào và ghi kết quả đầu ra.
        - Hỗ trợ nhiều định dạng instance khác nhau (`nyc_reader`, `li_lim_reader`, `sartori_buriol_reader`).
        - `sintef_solution.rs`: Ghi lời giải theo định dạng chuẩn SINTEF.
    - `construction/`: Chứa các thuật toán Heuristic để xây dựng một lời giải ban đầu (initial solution).
    - `lns/` (Large Neighborhood Search): Module cốt lõi của thuật toán.
        - `destroy/`: Chứa các "toán tử phá hủy" (destroy operators) như `WorstRemoval`, `RouteRemoval`, `AdjacentStringRemoval`. Các toán tử này loại bỏ một phần các yêu cầu (requests) ra khỏi lời giải hiện tại.
        - `repair/`: Chứa các "toán tử sửa chữa" (repair operators) như `BestInsertion`, `RegretInsertion`. Các toán tử này chèn các yêu cầu đã bị loại bỏ trở lại vào lời giải.
        - `acceptance_criterion.rs`: Định nghĩa các tiêu chí chấp nhận một lời giải mới (ví dụ: chỉ chấp nhận lời giải tốt hơn, hoặc chấp nhận lời giải tệ hơn với một xác suất nhất định để thoát khỏi tối ưu cục bộ).
    - `ages/` và `lns/largescale/ages.rs`: Triển khai metaheuristic AGES, điều khiển vòng lặp LNS và áp dụng các kỹ thuật "gây nhiễu" (perturbation) mạnh mẽ.
    - `solver/`: Tổ chức và điều khiển toàn bộ quá trình giải quyết.
        - `ls_solver.rs`: Chứa logic chính của solver, thiết lập và chạy vòng lặp AGES-LNS.
    - `solution/`: Định nghĩa cấu trúc dữ liệu của một lời giải (`Solution`, `Route`, ...), và các phương thức để tính toán các chỉ số như tổng chi phí, số xe đã sử dụng.
    - `pooling/` và `clustering/`: Chứa các thuật toán nâng cao để xử lý các bài toán quy mô lớn, bao gồm gom cụm (clustering) và tạo "bể" lời giải (pooling) để kết hợp.
- `libs/`: Chứa các thư viện con do nhóm tự phát triển.
    - `fp_decimal_type`: Một kiểu dữ liệu số thập phân dấu phẩy động để tính toán chính xác.
    - `kdsp`: Triển khai thuật toán tìm k-đường đi ngắn nhất không giao nhau (k-disjoint shortest path), một công cụ mạnh mẽ được sử dụng trong giai đoạn kết hợp lời giải.
- `resources/`: Chứa các tệp dữ liệu.
    - `instances/`: Các bộ dữ liệu bài toán (NYC, pdptw, ...).
    - `parameters/`: Các tệp cấu hình tham số cho solver.
- `Cargo.toml`: Tệp cấu hình của Rust, định nghĩa các dependency, workspace, và các "feature" cho phép biên dịch có điều kiện (ví dụ: `parallel`, `classic-pdptw`, `use-grb`).

## 3. Phân tích thuật toán và luồng hoạt động

Luồng hoạt động của chương trình diễn ra như sau:

1.  **Khởi tạo và Đọc tham số:**
    - Chương trình bắt đầu từ `main.rs`.
    - Sử dụng `clap` và `argfile` để phân tích các tham số từ dòng lệnh và từ các tệp cấu hình (được chỉ định bởi `@`). Các tham số này quyết định mọi khía cạnh của quá trình giải, từ tệp instance, giới hạn thời gian, cho đến các tham số chi tiết của thuật toán LNS/AGES.

2.  **Tải Instance:**
    - Dựa vào tham số `instance` và feature `classic-pdptw`, chương trình sử dụng module `io` để đọc đúng định dạng tệp.
    - Dữ liệu (node, vehicle, ma trận thời gian/khoảng cách) được tải vào struct `PDPTWInstance`.
    - Trong quá trình này, có một bước tiền xử lý để "thắt chặt" (tighten) các cửa sổ thời gian của các yêu cầu, giúp giảm không gian tìm kiếm.

3.  **Xây dựng lời giải ban đầu (Initial Solution Construction):**
    - Trước khi bắt đầu vòng lặp cải thiện, solver cần một lời giải ban đầu.
    - Hàm `solver::construction::construct` được gọi. Dựa vào `cli.rs`, có nhiều chiến lược khác nhau, ví dụ như `parallel-insertion` (chèn song song) hoặc `kdsp_with_single_request_blocks`.
    - Mục tiêu là tạo ra một lời giải khả thi (feasible) một cách nhanh chóng.

4.  **Vòng lặp chính (Main Loop - AGES-LNS):**
    - Đây là trái tim của solver, được triển khai trong `solver::ls_solver::ls_ages_lns` và `lns::largescale::ages::LargeNeighborhoodAGES`.
    - Vòng lặp chạy cho đến khi đạt đến một điều kiện dừng (ví dụ: `time_limit_in_seconds` hoặc `lns_iterations`).
    - **Vòng lặp LNS (cải thiện cục bộ):**
        - **a. Giai đoạn Phá hủy (Destroy):** Một toán tử `destroy` được chọn (ví dụ: `AdjacentStringRemoval`). Nó loại bỏ một số lượng yêu cầu (`num_destroy_range`) khỏi lời giải hiện tại. Các yêu cầu này được đưa vào một "ngân hàng yêu cầu".
        - **b. Giai đoạn Sửa chữa (Repair):** Một toán tử `repair` được chọn (ví dụ: `RegretInsertion`). Nó cố gắng chèn lại các yêu cầu từ "ngân hàng" vào lời giải một cách tối ưu nhất.
        - **c. Tiêu chí chấp nhận (Acceptance):** Lời giải mới được so sánh với lời giải hiện tại. Solver có thể sử dụng chiến lược `RecordToRecord` hoặc `Metropolis` (giống Simulated Annealing) để đôi khi chấp nhận lời giải tệ hơn, giúp nó thoát khỏi các điểm tối ưu cục bộ.
    - **Cơ chế AGES (đa dạng hóa):**
        - Nếu LNS không tìm thấy lời giải tốt hơn sau một số lần lặp, AGES sẽ can thiệp.
        - Nó áp dụng một "sự gây nhiễu" (perturbation) mạnh hơn lên lời giải, ví dụ như thực hiện một chuỗi các thao tác di chuyển (relocate, exchange) để đẩy lời giải sang một vùng hoàn toàn khác trong không gian tìm kiếm.
        - AGES sử dụng các bộ đếm phạt (penalty counters) để khuyến khích việc thay đổi các phần của lời giải ít được thay đổi trước đó, tăng cường sự đa dạng hóa.

5.  **Xử lý quy mô lớn (Decomposition & Recombination):**
    - Khi feature `disable-decomposition` không được bật, solver có thể áp dụng chiến lược phân rã.
    - **Split:** Lời giải hiện tại được chia thành các cụm (cluster) các route.
    - **Nested Search:** Mỗi cụm được giải quyết riêng lẻ bằng một vòng lặp LNS lồng nhau (`nested_iterations`).
    - **Merge/Recombine:** Các lời giải con từ các cụm được kết hợp lại. Đây là lúc thuật toán `kdsp` phát huy tác dụng. Nó được dùng để tìm các cách kết nối các phần của route từ các cụm khác nhau một cách hiệu quả và tối ưu.

6.  **Kết thúc và Xuất kết quả:**
    - Khi điều kiện dừng được thỏa mãn, vòng lặp kết thúc.
    - Lời giải tốt nhất (`best_solution`) tìm được trong suốt quá trình tìm kiếm sẽ được giữ lại.
    - Chương trình ghi lại thời gian thực thi, các chỉ số của lời giải tốt nhất (chi phí, số xe, số yêu cầu chưa được phục vụ).
    - Nếu được yêu cầu, lời giải sẽ được ghi ra tệp theo định dạng SINTEF thông qua `io::sintef_solution`.

## 4. Phân tích các thành phần thuật toán chính

- **LNS (Large Neighborhood Search):** Là một phương pháp tìm kiếm rất hiệu quả cho các bài toán VRP. Ý tưởng là thay vì chỉ thay đổi một phần rất nhỏ của lời giải (như trong local search truyền thống), LNS phá hủy và xây dựng lại một phần lớn (large neighborhood), cho phép nó thực hiện những bước nhảy lớn hơn trong không gian tìm kiếm.
- **AGES (Adaptive-Genetic-Evolutionary-Search):** Đóng vai trò là một metaheuristic cấp cao, điều khiển LNS. Nó "thích ứng" (adaptive) bằng cách sử dụng các bộ đếm phạt để hướng sự phá hủy đến các phần "cứng đầu" của lời giải. Yếu tố "di truyền/tiến hóa" (genetic/evolutionary) thể hiện qua việc nó duy trì một lời giải và liên tục "gây nhiễu" và "cải thiện" nó, tương tự như một chu trình tiến hóa.
- **KDSP (k-Disjoint Shortest Paths):** Một thuật toán đồ thị mạnh mẽ. Trong dự án này, nó không được dùng để tìm route cho xe từ đầu, mà được dùng trong giai đoạn `recombine`. Khi cần nối hai phần của một route (ví dụ, sau khi phân rã và giải quyết các cụm), thay vì chỉ tìm 1 đường đi ngắn nhất, KDSP tìm ra `k` đường đi tốt nhất mà không chia sẻ các node trung gian. Điều này cung cấp nhiều lựa chọn chất lượng cao để tái cấu trúc lời giải.
- **Pooling and Matching:** Đây là một kỹ thuật nâng cao khác. Solver có thể chạy nhiều lần hoặc thu thập các route "tốt" từ các lời giải khác nhau vào một "bể" (pool). Sau đó, nó sử dụng một thuật toán "ghép cặp" (matching) - có thể là một thuật toán tham lam đơn giản (`Greedy`) hoặc giải một bài toán tối ưu phức tạp hơn như Weighted Set Covering (`WSC`) bằng Gurobi - để chọn ra một tập hợp các route từ "bể" để tạo thành một lời giải toàn cục mới và tốt hơn.
