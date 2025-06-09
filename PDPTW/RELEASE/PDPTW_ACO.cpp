#include <bits/stdc++.h>
using namespace std;

// Tham số ACO
const double ALPHA = 2.0;       // độ ảnh hưởng của pheromone
const double BETA = 3.0;        // độ ảnh hưởng của heuristic
const double RHO = 0.1;         // độ bay hơi pheromone
const double Q = 100.0;         // hằng số điều chỉnh pheromone thêm
const int MAX_ITERATIONS = 500; // số vòng lặp tối đa (chạy tối đa MAX_ITERATIONS lần, dừng sớm nếu tìm thấy solution sau 200 lần)
const int ANT_COUNT = 20;       // số lượng kiến
const bool DEBUG = false;       // debug

// Structure Node
struct Node {
    int id;                         // id node
    double lat, lon;                // vị trí (latitude, longitude)
    int demand;                     // dương: pickup;  âm: delivery
    int earliest_time, latest_time; // khoảng thời gian có thể đến
    int service_duration;           // thời gian dừng tại node
    int pickup_pair, delivery_pair; // id node delivery/pickup tương ứng
};

// Structure Route
struct Route {
    vector<int> nodes;     // danh sách id các node
    double total_distance; // tổng khoảng cách của tuyến
    int total_load;        // tải trọng tối đa cả route
    int total_time;        // tổng thời tiêu tốn
};

// Biến toàn cục
string instance_name;                  // bộ dữ liệu (theo dataset)
int node_count;                        // số lượng node (cả depot)
int capacity;                          // tải trọng tối đa của xe
int route_time;                        // thời gian tối đa của route
vector<Node> nodes;                    // danh sách node
vector<vector<int>> travel_times;      // ma trận thời gian di chuyển giữa các node
vector<vector<double>> pheromones;     // ma trận pheromone giữa các node
vector<vector<double>> heuristic_info; // ma trận heuristic
int required_routes;                   // số lượng route cho phép (nhập từ terminal)
int pickup_count;                      // số lượng node pickup

/* Function */

string trim(const string &str);                                                                                               // Loại bỏ khoảng trắng thừa
int countNodeVisited(const vector<Route> &routes);                                                                            // Đếm số node đã thăm (trừ depot)
bool isRouteFeasible(const Route &route);                                                                                     // Kiểm tra ràng buộc route
bool isInsertionFeasible(const Route &route, int current_node, int current_time, int current_load, int pickup, int delivery); // Kiểm tra ràng buộc khi chèn (pickup-delivery) vào route
int calculateArrivalTime(const Route &route);                                                                                 // Tính toán thời gian đến cho toàn route
int calculateCurrentLoad(const Route &route);                                                                                 // Tính toán load của route
void calculateRouteMetrics(Route &route);                                                                                     // Tính toán các thông số khác của route (tổng khoảng cách, thời gian, tải trọng tối đa)
double calculateSolutionCost(const vector<Route> &routes);                                                                    // Tính khoảng cách toàn bộ các route
void evaporatePheromones();                                                                                                   // Bay hơi pheromone
void depositPheromones(const vector<vector<Route>> &ant_tours);                                                               // Thêm pheromone
vector<Route> constructTour(mt19937 &gen, uniform_real_distribution<> &dis);                                                  // Xây dựng solution
vector<Route> solve();                                                                                                        // Solve PDPTW with ACO
void loadInstance(const string &filename);                                                                                    // Đọc data   <- input.txt
void saveRoutes(const vector<Route> &routes, const string &filename);                                                         // Xuất route -> output.txt

// Loại bỏ khoảng trắng thừa
string trim(const string &str) {
    int first = str.find_first_not_of(" \t");
    int last = str.find_last_not_of(" \t");
    if (string::npos == first)
        return str;
    return str.substr(first, (last - first + 1));
}

// Đếm số node đã thăm (trừ depot)
int countNodeVisited(const vector<Route> &routes) {
    set<int> visited;
    for (const Route &route : routes)
        for (int node : route.nodes)
            if (node != 0)
                visited.insert(node);
    return visited.size();
}

// Kiểm tra ràng buộc route
bool isRouteFeasible(const Route &route) {
    // Tuyến rỗng (hoặc chỉ có depot - điểm đầu và cuối) -> TRUE
    if (route.nodes.empty() || (route.nodes.size() == 2 && route.nodes[0] == 0 && route.nodes[1] == 0)) {
        return true;
    }

    int current_time = 0;
    int current_load = 0;
    unordered_set<int> visited_pickups;    // theo dõi các node pickup đã thăm (sử dụng unordered_set thay vì set để tăng tốc độ tìm kiếm)
    unordered_set<int> visited_deliveries; // theo dõi các node delivery đã thăm (sử dụng unordered_set thay vì set để tăng tốc độ tìm kiếm)

    // Duyệt từng node (kiểm tra TW, Capacity, thứ tự pickup-delivery)
    for (int i = 0; i < route.nodes.size(); i++) {
        int curr_node = route.nodes[i];
        int prev_node = (i > 0) ? route.nodes[i - 1] : 0;

        // Kiểm tra ràng buộc thời gian
        current_time += travel_times[prev_node][curr_node];
        if (current_time > nodes[curr_node].latest_time) { // current_time > latest_time
            if (DEBUG)
                cout << "DEBUG: TW violation at node " << curr_node << ": " << current_time << " > " << nodes[curr_node].latest_time << endl;
            return false;
        }
        if (current_time < nodes[curr_node].earliest_time) // chờ nếu đến sớm hơn earliest_time
            current_time = nodes[curr_node].earliest_time;

        // Kiểm tra ràng buộc sức chứa
        current_load += nodes[curr_node].demand;
        if (current_load > capacity) {
            if (DEBUG)
                cout << "DEBUG: Cp violation at node " << curr_node << ": " << current_load << " > " << capacity << endl;
            return false;
        }

        // Kiểm tra ràng buộc thứ tự (pickup trước delivery)
        if (nodes[curr_node].demand < 0) { // node delivery (nếu chưa có pickup ở trước -> FALSE)
            int pickup_node = nodes[curr_node].pickup_pair;
            if (visited_pickups.find(pickup_node) == visited_pickups.end()) {
                if (DEBUG)
                    cout << "DEBUG: PD violation at delivery " << curr_node << " before pickup " << pickup_node << endl;
                return false;
            }
            visited_deliveries.insert(curr_node);
        } else if (nodes[curr_node].demand > 0) { // node pickup (visited_pickups)
            visited_pickups.insert(curr_node);
        }

        // Update thời gian
        current_time += nodes[curr_node].service_duration;
    }

    // Kiểm tra thiếu delivery cho pickup
    for (int pickup : visited_pickups) {
        int delivery = nodes[pickup].delivery_pair;
        if (visited_deliveries.find(delivery) == visited_deliveries.end()) {
            if (DEBUG)
                cout << "DEBUG: Miss delivery " << delivery << " (for pickup " << pickup << ")" << endl;
            return false;
        }
    }

    // Kiểm tra thời gian hoàn thành route
    if (current_time > route_time) {
        if (DEBUG)
            cout << "DEBUG: Route time violation: " << current_time << " > " << route_time << endl;
        return false;
    }

    return true;
}

// Kiểm tra ràng buộc khi chèn (pickup-delivery) vào route
bool isInsertionFeasible(const Route &route, int current_node, int current_time, int current_load, int pickup, int delivery) {
    // Kiểm tra ràng buộc Capacity
    if (current_load + nodes[pickup].demand > capacity)
        return false; // Capacity violation: sau khi thêm pickup

    if (current_load + nodes[pickup].demand + nodes[delivery].demand > capacity)
        return false; // Capacity violation: sau khi thêm pickup-delivery

    // Kiểm tra ràng buộc TW
    int pickup_arrival = current_time + travel_times[current_node][pickup];
    if (pickup_arrival > nodes[pickup].latest_time)
        return false; // TW violation: đến muộn tại pickup

    pickup_arrival = max(pickup_arrival, nodes[pickup].earliest_time);        // chờ nếu cần tại pickup
    int pickup_departure = pickup_arrival + nodes[pickup].service_duration;   // thêm thời gian dừng tại pickup
    int delivery_arrival = pickup_departure + travel_times[pickup][delivery]; // tính thời gian đến delivery

    if (delivery_arrival > nodes[delivery].latest_time)
        return false; // TW violation: đến muộn tại delivery

    delivery_arrival = max(delivery_arrival, nodes[delivery].earliest_time);      // chờ nếu cần tại delivery
    int delivery_departure = delivery_arrival + nodes[delivery].service_duration; // thêm thời gian dừng tại delivery

    // Kiểm tra ràng buộc route time
    int return_time = delivery_departure + travel_times[delivery][0];
    return return_time <= route_time; // Route time violation: quay về depot muộn
}

// Tính toán thời gian đến cho toàn route
int calculateArrivalTime(const Route &route) {
    if (route.nodes.size() <= 1) // route rỗng hoặc chỉ có kho
        return 0;

    int current_time = 0;

    for (int i = 1; i < route.nodes.size(); i++) {
        int prev_node = route.nodes[i - 1];
        int curr_node = route.nodes[i];
        current_time += travel_times[prev_node][curr_node]; // thêm thời gian di chuyển

        if (current_time < nodes[curr_node].earliest_time) // chờ nếu đến sớm
            current_time = nodes[curr_node].earliest_time;

        current_time += nodes[curr_node].service_duration; // thêm thời gian phục vụ
    }

    return current_time;
}

// Tính toán load của route
int calculateCurrentLoad(const Route &route) {
    int load = 0;
    for (int node : route.nodes)
        load += nodes[node].demand;
    return load;
}

// Tính toán các thông số khác của route (tổng khoảng cách, thời gian, tải trọng tối đa)
void calculateRouteMetrics(Route &route) {
    route.total_load = 0;
    route.total_time = 0;
    route.total_distance = 0;

    int current_time = 0;
    int max_load = 0;

    for (int i = 1; i < route.nodes.size(); i++) {
        int prev_node = route.nodes[i - 1];
        int curr_node = route.nodes[i];

        current_time += travel_times[prev_node][curr_node];         // update current_time
        route.total_distance += travel_times[prev_node][curr_node]; // update total_distance

        if (current_time < nodes[curr_node].earliest_time) // chờ nếu đến sớm
            current_time = nodes[curr_node].earliest_time;

        route.total_load += nodes[curr_node].demand; // update total_load của route
        max_load = max(max_load, route.total_load);

        current_time += nodes[curr_node].service_duration; // update current_time (thời gian dừng ở node)
    }

    route.total_time = current_time;
    route.total_load = max_load;
}

// Tính khoảng cách toàn bộ các route
double calculateSolutionCost(const vector<Route> &routes) {
    double total_distance = 0.0;
    int nodes_served = countNodeVisited(routes);

    for (const Route &route : routes)
        total_distance += route.total_distance;

    if (nodes_served < pickup_count * 2) // với các solution không served tất cả các node -> cho total distance rất lớn
        total_distance += (pickup_count * 2 - nodes_served) * 1000;

    return total_distance;
}

// Bay hơi pheromone
void evaporatePheromones() {
    for (int i = 0; i < node_count; i++) {
        for (int j = 0; j < node_count; j++) {
            pheromones[i][j] *= (1.0 - RHO);
            if (pheromones[i][j] < 0.1)
                pheromones[i][j] = 0.1;
        }
    }
}

// Thêm pheromone
void depositPheromones(const vector<vector<Route>> &ant_tours) {
    for (const auto &solution : ant_tours) {
        int nodes_served = countNodeVisited(solution); // tính số node đã phục vụ
        if (nodes_served == 0)
            continue;

        double solution_cost = calculateSolutionCost(solution);

        // Trọng số dựa trên tỉ lệ coverage (càng nhiều node càng tốt)
        double coverage_ratio = static_cast<double>(nodes_served) / (pickup_count * 2);
        double deposit_base = Q / solution_cost;
        double deposit = deposit_base * (1.0 + coverage_ratio);

        // Thêm pheromone cho mỗi cạnh trong giải pháp
        for (const Route &route : solution) {
            for (int i = 0; i < route.nodes.size() - 1; i++) {
                int from = route.nodes[i];
                int to = route.nodes[i + 1];
                pheromones[from][to] += deposit;

                if (pheromones[from][to] > 10.0) // Giữ ngưỡng trên
                    pheromones[from][to] = 10.0;
            }
        }
    }
}

// Xây dựng solution
vector<Route> constructTour(mt19937 &gen, uniform_real_distribution<> &dis) {
    vector<Route> routes;
    unordered_set<int> unvisited_pickups;

    // #1. Khởi tạo danh sách các pickup chưa visit (trừ depot)
    for (int i = 1; i < node_count; i++)
        if (nodes[i].demand > 0)
            unvisited_pickups.insert(i);

    int max_routes = min(required_routes, pickup_count); // tránh trường hợp có nhiều route nhưng ít pickup

    // #2. Vòng lặp chính: Xây dựng các route cho đến khi hoàn thành hoặc hết route
    while (!unvisited_pickups.empty() && routes.size() < max_routes) {
        // Xây dựng 1 route
        Route route;
        route.nodes.push_back(0);

        // #2.1. Khởi tạo
        int current_node = 0;
        int current_time = 0;
        int current_load = 0;
        unordered_set<int> failed_pickups; // Danh sách pickup không thể thêm (tránh kiểm tra đi kiểm tra lại)
        // #2.2. Vòng lặp chính: thêm pickup-delivery cho đến khi không thể thêm được nữa
        bool added_node;
        do {
            added_node = false;
            // #2.2.1. Tính điểm cho pickup-delivery nếu có thể thêm vào route
            vector<pair<int, double>> candidates; // Danh sách pickup tiềm năng <pickup_id, điểm pheromone>
            for (int pickup : unvisited_pickups) {
                if (failed_pickups.find(pickup) != failed_pickups.end())
                    continue;

                int delivery = nodes[pickup].delivery_pair;
                bool feasible = isInsertionFeasible(route, current_node, current_time, current_load, pickup, delivery);
                if (feasible) {
                    // Tính điểm: score = pheromone^alpha * heuristic^beta
                    double pheromone = pow(pheromones[current_node][pickup], ALPHA);
                    double heuristic = pow(heuristic_info[current_node][pickup], BETA);
                    double score = pheromone * heuristic;
                    candidates.push_back({pickup, score});
                }
            }

            // Lựa chọn pickup-delivery dựa vào score (Roulette Wheel Selection)
            if (!candidates.empty()) {
                // Tính tổng xác suất: total_prob = sum(score) = sum(pheromone^alpha * heuristic^beta)
                double total_prob = 0.0;
                for (const auto &candidate : candidates)
                    total_prob += candidate.second;

                // Chọn pickup dựa trên xác suất (chọn cặp đầu tiên thoả mãn cumulative_prob >= rand_val)
                int selected_pickup;
                if (total_prob > 0.0) {
                    double rand_val = dis(gen) * total_prob;
                    double cumulative_prob = 0.0;

                    selected_pickup = candidates[0].first;
                    for (const auto &candidate : candidates) {
                        cumulative_prob += candidate.second;
                        if (cumulative_prob >= rand_val) {
                            selected_pickup = candidate.first;
                            break;
                        }
                    }
                } else {
                    // Nếu sum(score) == 0 -> chọn ngẫu nhiên
                    uniform_int_distribution<> rand_idx(0, candidates.size() - 1);
                    selected_pickup = candidates[rand_idx(gen)].first;
                }

                int selected_delivery = nodes[selected_pickup].delivery_pair;

                // Update route với pickup-delivery vừa chọn
                route.nodes.push_back(selected_pickup);
                route.nodes.push_back(selected_delivery);

                current_time = calculateArrivalTime(route);
                current_load = calculateCurrentLoad(route);
                current_node = selected_delivery;

                unvisited_pickups.erase(selected_pickup);

                added_node = true;
            } else {
                //  Cố gắng thêm 1 pickup-delivery vào route cuối: chỉ kiểm tra ràng buộc capacity (bỏ qua TW, route_time)
                // -> tối đa pickup-delivery được xử lí (sau sẽ check lại ràng buộc và phạt solution này)
                if (routes.size() == max_routes - 1 && !unvisited_pickups.empty()) {
                    for (int pickup : unvisited_pickups) {
                        if (failed_pickups.find(pickup) != failed_pickups.end())
                            continue;

                        int delivery = nodes[pickup].delivery_pair;
                        // Kiểm tra ràng buộc Capacity
                        if (current_load + nodes[pickup].demand <= capacity && current_load + nodes[pickup].demand + nodes[delivery].demand <= capacity) {
                            // Update route với pickup-delivery vừa chọn
                            route.nodes.push_back(pickup);
                            route.nodes.push_back(delivery);

                            current_time = calculateArrivalTime(route);
                            current_load = calculateCurrentLoad(route);
                            current_node = delivery;

                            unvisited_pickups.erase(pickup);
                            added_node = true;
                            break;
                        } else {
                            failed_pickups.insert(pickup);
                        }
                    }
                }
            }
        } while (added_node && !unvisited_pickups.empty());

        // Quay trở lại kho
        route.nodes.push_back(0);
        calculateRouteMetrics(route);

        // thêm route
        if (route.nodes.size() > 2) {
            routes.push_back(route);
        } else {
            // Nếu không có node nào -> chọn ngẫu nhiên một node chưa thăm
            if (!unvisited_pickups.empty() && routes.size() < max_routes - 1) {
                uniform_int_distribution<> rand_idx(0, unvisited_pickups.size() - 1);
                auto it = unvisited_pickups.begin();
                advance(it, rand_idx(gen) % unvisited_pickups.size());
                int forced_pickup = *it;
                int forced_delivery = nodes[forced_pickup].delivery_pair;

                // Xây dựng route: depot -> pickup -> delivery -> depot
                Route forced_route;
                forced_route.nodes.push_back(0);
                forced_route.nodes.push_back(forced_pickup);
                forced_route.nodes.push_back(forced_delivery);
                forced_route.nodes.push_back(0);

                calculateRouteMetrics(forced_route);

                if (isRouteFeasible(forced_route)) {
                    routes.push_back(forced_route);
                    unvisited_pickups.erase(forced_pickup);
                }
            }
        }
    }

    // Thêm route rỗng nếu chưa đủ required_routes
    while (routes.size() < required_routes) {
        Route empty_route;
        empty_route.nodes.push_back(0);
        empty_route.nodes.push_back(0);
        empty_route.total_distance = 0;
        empty_route.total_load = 0;
        empty_route.total_time = 0;
        routes.push_back(empty_route);
    }

    // Debug output
    if (DEBUG) {
        int total_nodes = countNodeVisited(routes);
        cout << "DEBUG: Total nodes visited: " << total_nodes << " out of " << (pickup_count * 2) << endl;
    }

    return routes;
}

// load instance từ input file
void loadInstance(const string &filename) {
    ifstream file(filename);

    node_count = 0;
    capacity = 0;
    route_time = 0;
    pickup_count = 0;

    string line;
    while (getline(file, line)) {
        if (line.find("NAME:") != string::npos) {
            instance_name = line.substr(line.find(":") + 1);
            instance_name = trim(instance_name);
        } else if (line.find("SIZE:") != string::npos) {
            node_count = stoi(trim(line.substr(line.find(":") + 1)));
        } else if (line.find("CAPACITY:") != string::npos) {
            capacity = stoi(trim(line.substr(line.find(":") + 1)));
        } else if (line.find("ROUTE-TIME:") != string::npos) {
            route_time = stoi(trim(line.substr(line.find(":") + 1)));
        } else if (line == "NODES") {
            nodes.resize(node_count);
            for (int i = 0; i < node_count; i++) {
                file >> nodes[i].id >> nodes[i].lat >> nodes[i].lon >> nodes[i].demand >> nodes[i].earliest_time >> nodes[i].latest_time >> nodes[i].service_duration >> nodes[i].pickup_pair >> nodes[i].delivery_pair;
                if (i > 0 && nodes[i].demand > 0) // đếm số node pickup
                    pickup_count++;
            }
        } else if (line == "EDGES") {
            travel_times.resize(node_count, vector<int>(node_count));
            for (int i = 0; i < node_count; i++)
                for (int j = 0; j < node_count; j++)
                    file >> travel_times[i][j];

            // Debug output for NODES and EDGES
            if (DEBUG) {
                cout << "NODES:" << endl;
                for (const auto &node : nodes)
                    cout << "ID: " << node.id << ", Lat: " << node.lat << ", Lon: " << node.lon << ", Demand: " << node.demand << ", Earliest: " << node.earliest_time << ", Latest: " << node.latest_time << ", Service: " << node.service_duration << ", Pickup Pair: " << node.pickup_pair << ", Delivery Pair: " << node.delivery_pair << endl;

                cout << "EDGES (Travel Times):" << endl;
                for (int i = 0; i < node_count; i++) {
                    for (int j = 0; j < node_count; j++)
                        cout << travel_times[i][j] << " ";
                    cout << endl;
                }
            }
            break;
        }
    }

    pheromones.resize(node_count, vector<double>(node_count, 1.0));
    heuristic_info.resize(node_count, vector<double>(node_count, 0.0));

    // Tính heuristic (=1/travel_time)
    for (int i = 0; i < node_count; i++)
        for (int j = 0; j < node_count; j++)
            if (i != j && travel_times[i][j] > 0)
                heuristic_info[i][j] = 1.0 / travel_times[i][j];
            else
                heuristic_info[i][j] = 0.0;
    // DEBUG
    if (DEBUG) {
        cout << "Instance loaded: " << instance_name << endl;
        cout << "Size (number of nodes): " << node_count << endl;
        cout << "Pickup nodes: " << pickup_count << endl;
        cout << "Capacity: " << capacity << endl;
        cout << "Route time limit: " << route_time << endl;
    }
}

// Solve PDPTW with ACO
vector<Route> solve() {
    // Random
    random_device rd;
    mt19937 gen(rd());
    uniform_real_distribution<> dis(0.0, 1.0);

    vector<Route> best_solution;
    double best_solution_cost = DBL_MAX;
    int best_pickup_count = 0;

    // Vòng lặp chính của ACO
    for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
        vector<vector<Route>> ant_tours(ANT_COUNT);

        for (int ant = 0; ant < ANT_COUNT; ant++) {
            ant_tours[ant] = constructTour(gen, dis);

            double solution_cost = calculateSolutionCost(ant_tours[ant]);

            int nodes_visited = countNodeVisited(ant_tours[ant]);
            int pickups_served = nodes_visited / 2; // Mỗi pickup có một delivery

            // Kiểm tra ràng buộc với tour có routes <= required_routes
            if (ant_tours[ant].size() <= required_routes) {
                bool is_feasible = true;

                for (const Route &route : ant_tours[ant]) {
                    if (!isRouteFeasible(route)) {
                        is_feasible = false;
                        break;
                    }
                }

                if (is_feasible) {
                    // Ưu tiên solution nhiều node hơn (nếu bằng nhau thì ưu tiên solution có cost thấp hơn)
                    if (pickups_served > best_pickup_count || (pickups_served == best_pickup_count && solution_cost < best_solution_cost)) {
                        best_solution_cost = solution_cost;
                        best_solution = ant_tours[ant];
                        best_pickup_count = pickups_served;

                        // Thêm route rỗng nếu chưa đủ required_routes
                        while (best_solution.size() < required_routes) {
                            Route empty_route;
                            empty_route.nodes.push_back(0);
                            empty_route.nodes.push_back(0);
                            best_solution.push_back(empty_route);
                        }
                    }
                }
            }
        }

        // Cập nhật pheromone
        evaporatePheromones();
        depositPheromones(ant_tours);

        // In kết quả định kỳ
        if (iter % 50 == 0 || iter == MAX_ITERATIONS - 1)
            cout << "Iteration " << iter << ", Best cost: " << best_solution_cost << ", Pickups served: " << best_pickup_count << " out of " << pickup_count << endl;

        // Dừng sớm nếu đã đến hết các node
        if (iter >= 200 && best_pickup_count >= pickup_count) {
            cout << "Complete! End at iteration " << iter << endl;
            break;
        }
    }

    // Kiểm tra ràng buộc best solution (do có phần nới lỏng ràng buộc trong constructTour)
    if (!best_solution.empty()) {
        bool is_feasible = true;
        int total_visited = countNodeVisited(best_solution);

        for (const Route &route : best_solution) {
            if (!isRouteFeasible(route)) {
                is_feasible = false;
                cout << "Route is infeasible!" << endl;
                break;
            }
        }

        if (total_visited < pickup_count * 2)
            cout << "WARNING: Only visited " << total_visited << " nodes out of " << (pickup_count * 2) << " required nodes" << endl;

        if (is_feasible)
            cout << "Solution is OK with " << total_visited << " nodes" << endl;
    }

    return best_solution;
}

// Xuất route -> output.txt
void saveRoutes(const vector<Route> &routes, const string &filename) {
    ofstream file(filename);

    file << "Instance name : bar-n100-1" << endl;
    file << "Authors       : Pix" << endl;
    file << "Date          : 2025" << endl;
    file << "Reference     : PDPTW ACO solver" << endl;
    file << "Solution" << endl;
    for (int i = 0; i < routes.size(); i++) {
        file << "Route " << (i + 1) << " : ";
        // Skip depot nodes (0) at the start and end
        for (int j = 1; j < routes[i].nodes.size() - 1; j++) {
            file << routes[i].nodes[j] << " ";
        }
        file << endl;
    }
    file.close();
}

int main() {
    string input_file;

    // cout << "input filename: ";
    // cin >> input_file;
    input_file = "input.txt";
    loadInstance(input_file);

    cout << "Number of routes: ";
    cin >> required_routes;

    // Solve PDPTW with ACO
    auto start_time = chrono::high_resolution_clock::now();
    vector<Route> solution = solve();
    auto end_time = chrono::high_resolution_clock::now();
    chrono::duration<double> elapsed = end_time - start_time;

    cout << "Solution found in " << elapsed.count() << " seconds" << endl;
    cout << "Number of routes: " << solution.size() << endl;

    saveRoutes(solution, "output.txt");
    return 0;
}