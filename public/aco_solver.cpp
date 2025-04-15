// Giải quyết bài toán VRP cho 1 xe tải thuật toán ACO (input: EUC_2D)
#include <bits/stdc++.h>
using namespace std;

struct Point {
    int id;
    double x, y;
};

struct IterationData {
    int iteration;
    vector<int> path;
    double distance;
};

int numNodes;                      // Số điểm
vector<Point> nodes;               // Danh sách các điểm
vector<vector<double>> distances;  // Ma trận khoảng cách
vector<vector<double>> pheromones; // Ma trận mùi
int antCount, maxIterations;       // Số kiến, số lần lặp
double _alpha, _beta, rho, Q;      // Các hệ số

// Tính khoảng cách giữa 2 điểm
double calculateDistance(const Point &p1, const Point &p2) {
    return sqrt(pow(p1.x - p2.x, 2) + pow(p1.y - p2.y, 2));
}

// Tạo ma trận khoảng cách
void initializeDistances() {
    distances.assign(numNodes, vector<double>(numNodes));
    for (int i = 0; i < numNodes; i++)
        for (int j = 0; j < numNodes; j++)
            distances[i][j] = calculateDistance(nodes[i], nodes[j]);
}

// Chọn điểm tiếp theo theo ROULETTE WHEEL SELECTION
int selectNextNode(int current, const vector<bool> &visited) {
    int n = visited.size();
    vector<double> probabilities(n, 0.0);
    double sum = 0.0;

    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            probabilities[i] = pow(pheromones[current][i], _alpha) * pow(1.0 / distances[current][i], _beta);
            sum += probabilities[i];
        }
    }

    if (sum == 0)
        return -1;

    double r = (double)rand() / RAND_MAX;
    double cumulative = 0.0;
    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            cumulative += probabilities[i] / sum;
            if (r <= cumulative)
                return i;
        }
    }
    return -1;
}

// Tạo tour cho 1 kiến
vector<int> constructTour() {
    int n = distances.size();
    vector<bool> visited(n, false);
    vector<int> tour = {0};
    visited[0] = true;

    for (int i = 1; i < n; i++) {
        int next = selectNextNode(tour.back(), visited);
        if (next == -1)
            break;
        tour.push_back(next);
        visited[next] = true;
    }
    tour.push_back(0);
    return tour;
}

// Tính quãng đường tour
double calculateTourLength(const vector<int> &tour) {
    double length = 0.0;
    for (int i = 0; i < tour.size() - 1; i++)
        length += distances[tour[i]][tour[i + 1]];
    return length;
}

// Cập nhật mùi
void updatePheromones(const vector<vector<int>> &antTours, const vector<double> &antTourLengths) {
    int n = pheromones.size();
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            pheromones[i][j] *= (1 - rho);

    for (int k = 0; k < antTours.size(); k++) {
        double contribution = Q / antTourLengths[k];
        for (int i = 0; i < antTours[k].size() - 1; i++) {
            int from = antTours[k][i], to = antTours[k][i + 1];
            pheromones[from][to] += contribution;
            pheromones[to][from] += contribution;
        }
    }
}

// ACO
vector<int> solveACO() {
    double initialPheromone = 1.0 / (numNodes * 100.0);
    pheromones.assign(numNodes, vector<double>(numNodes, initialPheromone));

    vector<int> bestTour;
    double bestTourLength = DBL_MAX;

    // For storing convergence data
    vector<double> convergenceData;

    // For storing iteration paths
    vector<IterationData> iterationPaths;

    for (int iter = 0; iter < maxIterations; iter++) {
        vector<vector<int>> antTours(antCount);
        vector<double> antTourLengths(antCount);

        for (int k = 0; k < antCount; k++) {
            antTours[k] = constructTour();
            antTourLengths[k] = calculateTourLength(antTours[k]);
            if (antTourLengths[k] < bestTourLength) {
                bestTourLength = antTourLengths[k];
                bestTour = antTours[k];
            }
        }

        // Store best tour length for this iteration
        convergenceData.push_back(bestTourLength);

        // Store iteration path
        IterationData iterData;
        iterData.iteration = iter + 1;
        iterData.path = bestTour;
        iterData.distance = bestTourLength;
        iterationPaths.push_back(iterData);

        updatePheromones(antTours, antTourLengths);
    }

    // Write convergence data to a file
    ofstream convergenceFile("convergence.txt");
    for (int i = 0; i < convergenceData.size(); i++) {
        convergenceFile << i + 1 << " " << convergenceData[i] << endl;
    }
    convergenceFile.close();

    // Write iteration paths to a file
    ofstream iterPathsFile("iteration_paths.txt");
    for (const auto &iterData : iterationPaths) {
        iterPathsFile << iterData.iteration << " " << iterData.distance << " ";
        for (int i = 0; i < iterData.path.size(); i++) {
            iterPathsFile << nodes[iterData.path[i]].id;
            if (i < iterData.path.size() - 1)
                iterPathsFile << " ";
        }
        iterPathsFile << endl;
    }
    iterPathsFile.close();

    return bestTour;
}

// Đọc file input
void readInputFile() {
    ifstream inputFile("input.txt");
    if (!inputFile) {
        cerr << "Không thể mở file input.txt\n";
        exit(1);
    }

    // Đọc tham số ACO
    inputFile >> antCount >> maxIterations >> _alpha >> _beta >> rho >> Q;

    // Đọc số node
    inputFile >> numNodes;

    // Đọc danh sách các điểm
    nodes.resize(numNodes);
    for (int i = 0; i < numNodes; i++) {
        inputFile >> nodes[i].id >> nodes[i].x >> nodes[i].y;
    }

    inputFile.close();
}

// Ghi file output
void writeOutputFile(const vector<int> &bestTour, double bestTourLength) {
    ofstream outputFile("output.txt");

    // Ghi ra đường đi
    for (int i = 0; i < bestTour.size(); i++) {
        outputFile << nodes[bestTour[i]].id;
        if (i < bestTour.size() - 1)
            outputFile << " ";
    }
    outputFile << endl;

    // Ghi ra độ dài đường đi
    outputFile << bestTourLength << endl;

    outputFile.close();
}

int main() {
    readInputFile();
    srand(time(NULL));
    initializeDistances();

    vector<int> bestTour = solveACO();
    double bestTourLength = calculateTourLength(bestTour);

    writeOutputFile(bestTour, bestTourLength);

    return 0;
}