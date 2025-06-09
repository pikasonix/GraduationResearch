#include <bits/stdc++.h>
using namespace std;

// Các tham số ACO
int antCount, maxIterations;
double _alpha, _beta, rho, Q;

// Các biến toàn cục
int numNodes;
vector<pair<double, double>> nodeCoords;
vector<vector<double>> distances;
vector<vector<double>> pheromone;
vector<int> best_tour;
double best_distance;

// File output
ofstream iterationFile;
ofstream convergenceFile;

// Tính khoảng cách Euclid giữa hai điểm
double euclideanDistance(int node1_idx, int node2_idx) {
    double dx = nodeCoords[node1_idx].first - nodeCoords[node2_idx].first;
    double dy = nodeCoords[node1_idx].second - nodeCoords[node2_idx].second;
    return sqrt(dx * dx + dy * dy);
}

// Chọn thành phố tiếp theo
int selectNextNode(int current_node_id, const vector<bool> &visited) {
    int current_idx = current_node_id - 1;
    vector<double> probabilities(numNodes, 0.0);
    double sum = 0.0;

    // Tính xác suất
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            double pheromone_level = pheromone[current_idx][next_idx];
            double distance_inv = 1.0 / max(distances[current_idx][next_idx], 1e-9);
            probabilities[next_idx] = pow(pheromone_level, _alpha) * pow(distance_inv, _beta);
            sum += probabilities[next_idx];
        }
    }

    // Nếu tổng xác suất quá nhỏ, chọn ngẫu nhiên
    if (sum <= 1e-9) {
        vector<int> candidates;
        for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
            if (!visited[next_idx]) {
                candidates.push_back(next_idx + 1);
            }
        }
        if (!candidates.empty()) {
            return candidates[rand() % candidates.size()];
        }
        return -1;
    }

    // Chọn theo Roulette wheel
    double r = ((double)rand() / RAND_MAX) * sum;
    double cumulative = 0.0;
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            cumulative += probabilities[next_idx];
            if (r <= cumulative) {
                return next_idx + 1;
            }
        }
    }

    // Fallback: chọn node chưa thăm đầu tiên
    for (int next_idx = 0; next_idx < numNodes; ++next_idx) {
        if (!visited[next_idx]) {
            return next_idx + 1;
        }
    }
    return -1;
}

// Xây dựng tour cho một kiến
vector<int> constructTour() {
    vector<int> tour;
    vector<bool> visited(numNodes, false);

    int start_node_id = 1;
    tour.push_back(start_node_id);
    visited[start_node_id - 1] = true;

    while (tour.size() < numNodes) {
        int current_node_id = tour.back();
        int next_node_id = selectNextNode(current_node_id, visited);
        if (next_node_id == -1) {
            return {};
        }
        tour.push_back(next_node_id);
        visited[next_node_id - 1] = true;
    }

    return tour;
}

// Tính độ dài tour
double calculateTourLength(const vector<int> &tour) {
    if (tour.empty())
        return DBL_MAX;

    double length = 0.0;
    for (size_t i = 0; i < tour.size() - 1; ++i) {
        int u_idx = tour[i] - 1;
        int v_idx = tour[i + 1] - 1;
        length += distances[u_idx][v_idx];
    }

    // Cạnh nối node cuối về node đầu
    int last_node_idx = tour.back() - 1;
    int first_node_idx = tour.front() - 1;
    length += distances[last_node_idx][first_node_idx];

    return length;
}

// Cập nhật mùi
void updatePheromone(const vector<vector<int>> &ant_tours, const vector<double> &ant_distances) {
    // Bay hơi pheromone
    for (int i = 0; i < numNodes; ++i) {
        for (int j = 0; j < numNodes; ++j) {
            pheromone[i][j] *= (1.0 - rho);
            pheromone[i][j] = max(pheromone[i][j], 1e-9);
        }
    }

    // Cộng thêm pheromone mới
    for (size_t k = 0; k < ant_tours.size(); ++k) {
        if (ant_tours[k].empty() || ant_distances[k] <= 0)
            continue;

        double pheromone_deposit = Q / ant_distances[k];
        const vector<int> &tour = ant_tours[k];

        for (size_t i = 0; i < tour.size() - 1; ++i) {
            int u_idx = tour[i] - 1;
            int v_idx = tour[i + 1] - 1;
            pheromone[u_idx][v_idx] += pheromone_deposit;
            pheromone[v_idx][u_idx] += pheromone_deposit; // TSP đối xứng
        }

        // Cạnh nối node cuối về node đầu
        int last_node_idx = tour.back() - 1;
        int first_node_idx = tour.front() - 1;
        pheromone[last_node_idx][first_node_idx] += pheromone_deposit;
        pheromone[first_node_idx][last_node_idx] += pheromone_deposit;
    }
}

void solveACO() {
    srand(time(NULL));
    // Khởi tạo ma trận mùi
    double initial_pheromone = Q / (numNodes * 1.0);
    pheromone.assign(numNodes, vector<double>(numNodes, initial_pheromone));

    best_distance = DBL_MAX;
    best_tour.clear();

    // Vòng lặp chính
    for (int iter = 0; iter < maxIterations; ++iter) {
        vector<vector<int>> ant_tours(antCount);
        vector<double> ant_distances(antCount);

        // Mỗi con kiến xây dựng một tour
#pragma omp parallel for
        for (int k = 0; k < antCount; ++k) {
            ant_tours[k] = constructTour();
            ant_distances[k] = calculateTourLength(ant_tours[k]);

#pragma omp critical
            {
                if (ant_distances[k] < best_distance) {
                    best_distance = ant_distances[k];
                    best_tour = ant_tours[k];
                }
            }
        }

        // Cập nhật ma trận mùi
        updatePheromone(ant_tours, ant_distances);

        // Ghi kết quả lần lặp
        if (iterationFile.is_open()) {
            iterationFile << (iter + 1) << " " << fixed << setprecision(3) << best_distance << " ";
            for (size_t j = 0; j < best_tour.size(); ++j) {
                iterationFile << best_tour[j] << " ";
            }
            iterationFile << best_tour[0] << endl;
        }

        // Ghi vào file hội tụ
        if (convergenceFile.is_open()) {
            convergenceFile << (iter + 1) << " " << fixed << setprecision(3) << best_distance << endl;
        }
    }
}

int main() {
    ifstream inputFile("input.txt");
    ofstream outputFile("output.txt");

    // Initialize the global file objects properly
    iterationFile.open("iteration_paths.txt");
    convergenceFile.open("convergence.txt");

    // Đọc tham số ACO
    inputFile >> antCount >> maxIterations >> _alpha >> _beta >> rho >> Q;

    // Đọc số lượng node
    inputFile >> numNodes;

    // Đọc tọa độ node
    nodeCoords.resize(numNodes);
    for (int i = 0; i < numNodes; ++i) {
        int id;
        double x, y;
        inputFile >> id >> x >> y;
        nodeCoords[id - 1] = {x, y};
    }

    // Tính ma trận khoảng cách
    distances.assign(numNodes, vector<double>(numNodes));
    for (int i = 0; i < numNodes; ++i) {
        distances[i][i] = 0.0;
        for (int j = i + 1; j < numNodes; ++j) {
            distances[i][j] = euclideanDistance(i, j);
            distances[j][i] = distances[i][j];
        }
    }

    // Giải bài toán TSP
    solveACO();

    // Ghi kết quả
    for (size_t i = 0; i < best_tour.size(); ++i) {
        outputFile << best_tour[i] << " ";
    }
    outputFile << best_tour[0] << endl; // Thêm node bắt đầu
    outputFile << fixed << setprecision(3) << best_distance << endl;

    // Đóng file
    inputFile.close();
    outputFile.close();
    iterationFile.close();
    convergenceFile.close();
    return 0;
}