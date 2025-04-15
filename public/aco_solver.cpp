#include <bits/stdc++.h>
#include <cmath>   // Thêm thư viện toán học
#include <fstream> // Thêm thư viện file stream
#include <iomanip> // Thêm thư viện để định dạng output
#include <limits>  // Để dùng DBL_MAX
#include <vector>

using namespace std;

// Các tham số ACO (sẽ được đọc từ file)
int antCount;
int maxIterations;
double _alpha;
double _beta;
double rho;
double Q;

// Các biến toàn cục
int numNodes;                            // Số thành phố
vector<pair<double, double>> nodeCoords; // Lưu trữ tọa độ (x, y)
vector<vector<double>> distances;        // Ma trận khoảng cách
vector<vector<double>> pheromone;        // Ma trận mùi
vector<int> best_tour;                   // Tour tốt nhất toàn cục
double best_distance;                    // Quãng đường của tour tốt nhất toàn cục

// Biến ofstream toàn cục để ghi file iteration_paths.txt và convergence.txt
ofstream iterationFile;
ofstream convergenceFile; // Thêm file stream cho convergence.txt

// Tính khoảng cách Euclid giữa hai điểm (index 0-based)
double euclideanDistance(int node1_idx, int node2_idx) {
    double dx = nodeCoords[node1_idx].first - nodeCoords[node2_idx].first;
    double dy = nodeCoords[node1_idx].second - nodeCoords[node2_idx].second;
    return sqrt(dx * dx + dy * dy);
}

// Chọn thành phố tiếp theo (input: ID node hiện tại 1-based)
int selectNextNode(int current_node_id, const vector<bool> &visited) {
    int current_idx = current_node_id - 1; // Chuyển đổi ID (1-based) sang index (0-based)
    vector<double> probabilities(numNodes, 0.0);
    double sum = 0.0;

    // Tính xác suất cho mỗi thành phố chưa thăm
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            // distances và pheromone dùng index (0-based)
            double pheromone_level = pheromone[current_idx][next_idx];
            // Đảm bảo khoảng cách không quá nhỏ để tránh chia cho 0 hoặc số rất nhỏ
            double distance_inv = 1.0 / max(distances[current_idx][next_idx], 1e-9); // Tăng độ chính xác nhỏ
            probabilities[next_idx] = pow(pheromone_level, _alpha) * pow(distance_inv, _beta);
            // Kiểm tra giá trị NaN hoặc Infinity (có thể xảy ra nếu alpha/beta lớn và pheromone/distance cực nhỏ/lớn)
            if (isnan(probabilities[next_idx]) || isinf(probabilities[next_idx])) {
                probabilities[next_idx] = 0.0; // Coi như không thể đi nếu tính toán lỗi
            }
            sum += probabilities[next_idx];
        }
    }

    // Nếu tổng xác suất bằng 0 (có thể xảy ra ở lần lặp đầu hoặc nếu mùi quá thấp/lỗi tính toán)
    // Chọn ngẫu nhiên một node chưa thăm
    if (sum <= 1e-9) { // So sánh với số rất nhỏ thay vì 0
        vector<int> candidates;
        for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
            if (!visited[next_idx]) {
                candidates.push_back(next_idx + 1); // Lưu ID (1-based)
            }
        }
        if (!candidates.empty()) {
            // cout << "Warning: Sum of probabilities is near zero. Selecting randomly." << endl; // Debug
            return candidates[rand() % candidates.size()];
        } else {
            // Trường hợp không còn node nào để chọn (lỗi logic?)
            cerr << "Error: No unvisited nodes left to select randomly!" << endl;
            return -1;
        }
    }

    // Chọn theo phương pháp bánh xe Roulette
    double r = ((double)rand() / RAND_MAX) * sum; // Nhân với sum để tránh lỗi chia cho sum rất nhỏ
    double cumulative = 0.0;
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            cumulative += probabilities[next_idx];
            if (r <= cumulative) {
                return next_idx + 1; // Trả về ID (1-based)
            }
        }
    }

    // Trường hợp dự phòng (do lỗi làm tròn số thực) - chọn node chưa thăm đầu tiên tìm thấy
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            // cout << "Warning: Roulette wheel failed (rounding error?). Selecting first available." << endl; // Debug
            return next_idx + 1; // Trả về ID (1-based)
        }
    }
    cerr << "Error: Could not select next node even with fallback!" << endl;
    return -1; // Không tìm thấy node tiếp theo (lỗi)
}

// Xây dựng tour cho một kiến
vector<int> constructTour() {
    vector<int> tour;
    vector<bool> visited(numNodes, false); // visited dùng index (0-based)

    // *** THAY ĐỔI: Bắt đầu từ node ID 1 ***
    int start_node_id = 1;
    tour.push_back(start_node_id);
    visited[start_node_id - 1] = true; // Index là 0

    // Xây dựng phần còn lại của tour
    while (tour.size() < numNodes) {
        int current_node_id = tour.back();
        int next_node_id = selectNextNode(current_node_id, visited);
        if (next_node_id == -1) {
            cerr << "Error: Could not select next node during tour construction!" << endl;
            // Có thể xử lý lỗi ở đây, ví dụ: trả về tour rỗng hoặc tour chưa hoàn chỉnh
            return {}; // Trả về tour rỗng nếu lỗi
        }
        tour.push_back(next_node_id);
        visited[next_node_id - 1] = true;
    }

    return tour; // Tour chứa các ID (1-based)
}

// Tính độ dài tour (tour chứa ID 1-based)
double calculateTourLength(const vector<int> &tour) {
    if (tour.size() != numNodes) {
        cerr << "Error: Trying to calculate length of incomplete or invalid tour. Size: " << tour.size() << endl;
        return DBL_MAX; // Trả về giá trị lớn nếu tour không hợp lệ
    }
    double length = 0.0;
    for (size_t i = 0; i < tour.size() - 1; ++i) {
        int u_idx = tour[i] - 1;     // Chuyển ID sang index
        int v_idx = tour[i + 1] - 1; // Chuyển ID sang index
        if (u_idx < 0 || u_idx >= numNodes || v_idx < 0 || v_idx >= numNodes) {
            cerr << "Error: Invalid node ID in tour during length calculation." << endl;
            return DBL_MAX;
        }
        length += distances[u_idx][v_idx];
    }
    // Thêm cạnh nối node cuối về node đầu
    int last_node_idx = tour.back() - 1;
    int first_node_idx = tour.front() - 1;
    if (last_node_idx < 0 || last_node_idx >= numNodes || first_node_idx < 0 || first_node_idx >= numNodes) {
        cerr << "Error: Invalid first/last node ID in tour during length calculation." << endl;
        return DBL_MAX;
    }
    length += distances[last_node_idx][first_node_idx];
    return length;
}

// Cập nhật mùi
void updatePheromone(const vector<vector<int>> &ant_tours, const vector<double> &ant_distances) {
    // 1. Bay hơi pheromone
    for (int i = 0; i < numNodes; ++i) {
        for (int j = 0; j < numNodes; ++j) {
            pheromone[i][j] *= (1.0 - rho);
            // Đặt mức pheromone tối thiểu để tránh bị kẹt quá sớm hoặc giá trị quá nhỏ
            pheromone[i][j] = max(pheromone[i][j], 1e-9); // Có thể điều chỉnh giá trị tối thiểu này
        }
    }

    // 2. Cộng thêm pheromone mới từ các kiến
    for (size_t k = 0; k < ant_tours.size(); ++k) {
        // Chỉ cập nhật pheromone từ các tour hợp lệ và có độ dài hữu hạn, dương
        if (ant_tours[k].size() != numNodes || ant_distances[k] <= 0 || ant_distances[k] == DBL_MAX)
            continue;

        double pheromone_deposit = Q / ant_distances[k];
        const vector<int> &tour = ant_tours[k];
        for (size_t i = 0; i < tour.size() - 1; ++i) {
            int u_idx = tour[i] - 1;     // Chuyển ID sang index
            int v_idx = tour[i + 1] - 1; // Chuyển ID sang index
            // Kiểm tra index hợp lệ trước khi truy cập pheromone
            if (u_idx >= 0 && u_idx < numNodes && v_idx >= 0 && v_idx < numNodes) {
                pheromone[u_idx][v_idx] += pheromone_deposit;
                pheromone[v_idx][u_idx] += pheromone_deposit; // TSP đối xứng
            } else {
                cerr << "Warning: Invalid node index in tour during pheromone update." << endl;
            }
        }
        // Cạnh nối node cuối về node đầu
        int last_node_idx = tour.back() - 1;
        int first_node_idx = tour.front() - 1;
        // Kiểm tra index hợp lệ
        if (last_node_idx >= 0 && last_node_idx < numNodes && first_node_idx >= 0 && first_node_idx < numNodes) {
            pheromone[last_node_idx][first_node_idx] += pheromone_deposit;
            pheromone[first_node_idx][last_node_idx] += pheromone_deposit;
        } else {
            cerr << "Warning: Invalid first/last node index during pheromone update." << endl;
        }
    }
}

// Giải bài toán TSP bằng ACO
void solveACO() {
    // Khởi tạo seed cho số ngẫu nhiên
    srand(time(NULL));

    // Khởi tạo ma trận mùi với giá trị ban đầu
    // Có thể dùng 1.0 hoặc giá trị dựa trên ước lượng (ví dụ Q/Lnn, Lnn là độ dài tour hàng xóm gần nhất)
    double initial_pheromone = Q / (numNodes * 1.0); // Ví dụ khởi tạo đơn giản khác
    pheromone.assign(numNodes, vector<double>(numNodes, initial_pheromone));

    best_distance = DBL_MAX; // Khởi tạo khoảng cách tốt nhất là vô cùng lớn
    best_tour.clear();       // Xóa tour tốt nhất cũ (nếu có)

    // Vòng lặp chính của ACO
    for (int iter = 0; iter < maxIterations; ++iter) {
        vector<vector<int>> ant_tours(antCount);
        vector<double> ant_distances(antCount); // Khởi tạo mặc định (0.0)

        bool found_better_in_iter = false; // Cờ để xem có tour nào tốt hơn best_distance trong lần lặp này không

// Mỗi con kiến xây dựng một tour
#pragma omp parallel for // Nếu muốn tăng tốc bằng OpenMP (cần flag -fopenmp khi biên dịch)
        for (int k = 0; k < antCount; ++k) {
            ant_tours[k] = constructTour();
            if (!ant_tours[k].empty() && ant_tours[k].size() == numNodes) { // Kiểm tra tour có hợp lệ không
                ant_distances[k] = calculateTourLength(ant_tours[k]);

// Cập nhật tour tốt nhất toàn cục (cần critical section nếu dùng OpenMP)
#pragma omp critical
                {
                    if (ant_distances[k] < best_distance) {
                        best_distance = ant_distances[k];
                        best_tour = ant_tours[k];
                        found_better_in_iter = true;
                        // Tùy chọn: In ra khi tìm thấy giải pháp tốt hơn
                        // cout << "Iter " << iter + 1 << ", Ant " << k << ": New best distance = "
                        //      << fixed << setprecision(3) << best_distance << endl;
                    }
                }
            } else {
                // Xử lý trường hợp tour không hợp lệ
                ant_distances[k] = DBL_MAX; // Gán khoảng cách vô cùng lớn
#pragma omp critical
                {
                    if (ant_tours[k].empty()) {
                        // cerr << "Warning: Ant " << k << " in iteration " << iter + 1 << " failed to construct a tour." << endl;
                    } else {
                        // cerr << "Warning: Ant " << k << " in iteration " << iter + 1 << " constructed an incomplete tour (size " << ant_tours[k].size() << ")." << endl;
                    }
                }
            }
        }

        // Cập nhật ma trận mùi dựa trên các tour của kiến
        updatePheromone(ant_tours, ant_distances);

        // --- Ghi kết quả của lần lặp này vào iteration_paths.txt ---
        // Ghi lại best_tour toàn cục hiện tại sau mỗi lần lặp
        if (iterationFile.is_open() && !best_tour.empty()) {
            iterationFile << (iter + 1) << " " << fixed << setprecision(3) << best_distance << " ";
            for (size_t j = 0; j < best_tour.size(); ++j) {
                iterationFile << best_tour[j] << (j == best_tour.size() - 1 ? "" : " ");
            }
            // Thêm lại node bắt đầu vào cuối để dễ nhìn tour khép kín
            iterationFile << " " << best_tour[0];
            iterationFile << endl;
        }
        // --- Kết thúc ghi iteration_paths.txt ---

        // --- Ghi vào convergence.txt ---
        // Ghi lại best_distance toàn cục hiện tại sau mỗi lần lặp
        if (convergenceFile.is_open()) {
            // Đảm bảo rằng best_distance có giá trị hợp lệ trước khi ghi
            if (best_distance == DBL_MAX) {
                // Nếu chưa tìm thấy tour nào, có thể ghi một giá trị đặc biệt hoặc bỏ qua
                // Ví dụ: ghi giá trị lớn hoặc không ghi gì cả cho đến khi có tour đầu tiên
                // convergenceFile << (iter + 1) << " " << "inf" << endl; // Hoặc bỏ qua
            } else {
                convergenceFile << (iter + 1) << " " << fixed << setprecision(3) << best_distance << endl;
            }
        }
        // --- Kết thúc ghi convergence.txt ---

        // Tùy chọn: In tiến trình ra console
        // if ((iter + 1) % 10 == 0 || found_better_in_iter) { // In mỗi 10 lần lặp hoặc khi có cải thiện
        //    cout << "Iteration " << setw(4) << (iter + 1) << ": Best Distance = " << fixed << setprecision(3) << best_distance << endl;
        // }

    } // Kết thúc vòng lặp chính
}

int main() {
    // --- Mở file input và output ---
    ifstream inputFile("input.txt");
    ofstream outputFile("output.txt");
    iterationFile.open("iteration_paths.txt");
    convergenceFile.open("convergence.txt"); // Mở file convergence.txt

    if (!inputFile.is_open()) {
        cerr << "Error: Could not open input.txt" << endl;
        return 1;
    }
    if (!outputFile.is_open()) {
        cerr << "Error: Could not open output.txt" << endl;
        if (inputFile.is_open())
            inputFile.close();
        return 1;
    }
    if (!iterationFile.is_open()) {
        cerr << "Error: Could not open iteration_paths.txt" << endl;
        if (inputFile.is_open())
            inputFile.close();
        if (outputFile.is_open())
            outputFile.close();
        return 1;
    }
    // Kiểm tra mở file convergence.txt
    if (!convergenceFile.is_open()) {
        cerr << "Error: Could not open convergence.txt" << endl;
        if (inputFile.is_open())
            inputFile.close();
        if (outputFile.is_open())
            outputFile.close();
        if (iterationFile.is_open())
            iterationFile.close();
        return 1;
    }

    // --- Đọc các tham số ACO ---
    inputFile >> antCount >> maxIterations >> _alpha >> _beta >> rho >> Q;
    if (inputFile.fail()) {
        cerr << "Error reading ACO parameters from input.txt" << endl;
        // Đóng file trước khi thoát
        inputFile.close();
        outputFile.close();
        iterationFile.close();
        convergenceFile.close();
        return 1;
    }
    // Kiểm tra sơ bộ giá trị tham số
    if (antCount <= 0 || maxIterations <= 0 || _alpha < 0 || _beta < 0 || rho < 0 || rho > 1 || Q <= 0) {
        cerr << "Warning: Invalid ACO parameter values read from input.txt." << endl;
        // Có thể quyết định dừng hoặc tiếp tục với cảnh báo
    }

    // --- Đọc số lượng node ---
    inputFile >> numNodes;
    if (inputFile.fail() || numNodes <= 1) { // Cần ít nhất 2 node
        cerr << "Error reading or invalid number of nodes (must be > 1) from input.txt" << endl;
        inputFile.close();
        outputFile.close();
        iterationFile.close();
        convergenceFile.close();
        return 1;
    }

    // --- Đọc tọa độ các node ---
    nodeCoords.resize(numNodes);
    vector<int> nodeIdsRead(numNodes, 0); // Dùng để kiểm tra ID duy nhất
    bool ids_ok = true;
    int nodes_read_count = 0;
    for (int i = 0; i < numNodes; ++i) {
        int id;
        double x, y;
        inputFile >> id >> x >> y;
        if (inputFile.fail()) {
            cerr << "Error reading node data line " << (i + 1) << " from input.txt. Expected ID X Y." << endl;
            ids_ok = false;
            break; // Dừng đọc nếu có lỗi
        }
        nodes_read_count++;
        // Kiểm tra ID có hợp lệ và duy nhất không (giả sử ID từ 1 đến numNodes)
        if (id < 1 || id > numNodes) {
            cerr << "Error: Invalid node ID " << id << " found in input.txt. IDs must be between 1 and " << numNodes << "." << endl;
            ids_ok = false;
        } else if (nodeIdsRead[id - 1] != 0) { // Kiểm tra ID đã được đọc chưa
            cerr << "Error: Duplicate node ID " << id << " found in input.txt." << endl;
            ids_ok = false;
        } else {
            // Lưu tọa độ vào vị trí tương ứng với ID (index = id - 1)
            nodeCoords[id - 1] = {x, y};
            nodeIdsRead[id - 1] = id; // Đánh dấu ID này đã đọc
        }
        if (!ids_ok)
            break; // Dừng nếu phát hiện lỗi ID
    }
    // Kiểm tra xem có đọc đủ số lượng node như đã khai báo không
    if (nodes_read_count < numNodes && ids_ok) {
        cerr << "Error: Input file contains data for only " << nodes_read_count << " nodes, but expected " << numNodes << "." << endl;
        ids_ok = false;
    }
    // Kiểm tra xem tất cả ID từ 1 đến numNodes đã xuất hiện chưa
    if (ids_ok) {
        for (int i = 0; i < numNodes; ++i) {
            if (nodeIdsRead[i] == 0) {
                cerr << "Error: Node ID " << (i + 1) << " is missing from input.txt." << endl;
                ids_ok = false;
                break;
            }
        }
    }

    if (!ids_ok) { // Thoát nếu có lỗi đọc hoặc lỗi ID
        inputFile.close();
        outputFile.close();
        iterationFile.close();
        convergenceFile.close();
        return 1;
    }

    // --- Tính toán ma trận khoảng cách ---
    distances.assign(numNodes, vector<double>(numNodes));
    for (int i = 0; i < numNodes; ++i) {
        for (int j = i; j < numNodes; ++j) { // Chỉ cần tính nửa trên (hoặc dưới) vì đối xứng
            if (i == j) {
                distances[i][j] = 0.0;
            } else {
                distances[i][j] = euclideanDistance(i, j);
                // Kiểm tra khoảng cách hợp lệ (không âm)
                if (distances[i][j] < 0) {
                    cerr << "Error: Calculated negative distance between node " << (i + 1) << " and " << (j + 1) << endl;
                    // Xử lý lỗi, ví dụ: thoát chương trình
                    inputFile.close();
                    outputFile.close();
                    iterationFile.close();
                    convergenceFile.close();
                    return 1;
                }
                distances[j][i] = distances[i][j]; // Ma trận đối xứng
            }
        }
    }

    // --- Giải bài toán TSP bằng ACO ---
    cout << "Starting ACO Solver..." << endl;
    cout << "Parameters: Ants=" << antCount << ", Iterations=" << maxIterations
         << ", Alpha=" << _alpha << ", Beta=" << _beta << ", Rho=" << rho << ", Q=" << Q << endl;
    cout << "Number of nodes: " << numNodes << endl;

    solveACO();

    // --- Ghi kết quả cuối cùng vào output.txt ---
    if (!best_tour.empty()) {
        for (size_t i = 0; i < best_tour.size(); ++i) {
            outputFile << best_tour[i] << (i == best_tour.size() - 1 ? "" : " ");
        }
        // Thêm node bắt đầu vào cuối để thể hiện tour đóng
        outputFile << " " << best_tour[0];
        outputFile << endl;
        outputFile << fixed << setprecision(3) << best_distance << endl;
    } else {
        outputFile << "No solution found." << endl;
        cerr << "Warning: ACO finished without finding a valid tour." << endl;
    }

    // --- Đóng file ---
    inputFile.close();
    outputFile.close();
    iterationFile.close();
    convergenceFile.close(); // Đóng file convergence.txt

    cout << "ACO finished. Best distance found: " << fixed << setprecision(3) << best_distance << endl;
    cout << "Results saved to output.txt, iteration_paths.txt, and convergence.txt" << endl;

    return 0;
}