#include <bits/stdc++.h>
using namespace std;

struct Node {
    int id;
    double lat;
    double lon;
    int demand;
    int early_time;
    int late_time;
    int service_duration;
    int pickup_pair;
    int delivery_pair;

    bool is_depot() const {
        return id == 0;
    }

    bool is_pickup() const {
        return demand > 0;
    }

    bool is_delivery() const {
        return demand < 0;
    }
};

struct Instance {
    string name;
    string location;
    int size;
    int capacity;
    int route_time;
    vector<Node> nodes;
    vector<vector<int>> travel_times;
};

// Global variables instead of class members
Instance instance;
Node depot;
vector<Node> pickup_nodes;
vector<Node> delivery_nodes;

string trim(const string &str) {
    size_t first = str.find_first_not_of(' ');
    if (string::npos == first) {
        return str;
    }
    size_t last = str.find_last_not_of(' ');
    return str.substr(first, (last - first + 1));
}

vector<string> split(const string &str, char delimiter) {
    vector<string> tokens;
    stringstream ss(str);
    string token;

    while (getline(ss, token, delimiter)) {
        tokens.push_back(trim(token));
    }
    return tokens;
}

Instance parse_input(const string &filename) {
    ifstream file(filename);

    vector<string> lines;
    string line;
    while (getline(file, line)) {
        lines.push_back(trim(line));
    }
    file.close();

    // Read header information
    map<string, string> info;
    int i = 0;
    while (i < lines.size() && lines[i] != "NODES") {
        if (lines[i].find(':') != string::npos) {
            size_t pos = lines[i].find(':');
            string key = trim(lines[i].substr(0, pos));
            string value = trim(lines[i].substr(pos + 1));
            info[key] = value;
        }
        i++;
    }

    i++; // Skip "NODES" line
    vector<Node> nodes;
    int size = stoi(info["SIZE"]);

    for (int j = 0; j < size; j++) {
        vector<string> parts = split(lines[i + j], ' ');
        Node node;
        node.id = stoi(parts[0]);
        node.lat = stod(parts[1]);
        node.lon = stod(parts[2]);
        node.demand = stoi(parts[3]);
        node.early_time = stoi(parts[4]);
        node.late_time = stoi(parts[5]);
        node.service_duration = stoi(parts[6]);
        node.pickup_pair = stoi(parts[7]);
        node.delivery_pair = stoi(parts[8]);
        nodes.push_back(node);
    }

    i += size;

    // Skip to "EDGES" line
    while (i < lines.size() && lines[i] != "EDGES") {
        i++;
    }
    i++; // Skip "EDGES" line

    // Read travel times matrix
    vector<vector<int>> travel_times(size, vector<int>(size));
    for (int j = 0; j < size; j++) {
        vector<string> row = split(lines[i + j], ' ');
        for (int k = 0; k < size; k++) {
            travel_times[j][k] = stoi(row[k]);
        }
    }

    Instance inst;
    inst.name = info.count("NAME") ? info["NAME"] : "";
    inst.location = info.count("LOCATION") ? info["LOCATION"] : "";
    inst.size = size;
    inst.capacity = info.count("CAPACITY") ? stoi(info["CAPACITY"]) : 0;
    inst.route_time = info.count("ROUTE-TIME") ? stoi(info["ROUTE-TIME"]) : 0;
    inst.nodes = nodes;
    inst.travel_times = travel_times;

    return inst;
}

bool is_feasible_insertion(const vector<int> &route, int pickup_idx,
                           int delivery_idx, int pickup_pos, int delivery_pos) {
    if (pickup_pos > delivery_pos) {
        return false;
    }

    // Create new route
    vector<int> new_route = route;
    new_route.insert(new_route.begin() + delivery_pos, delivery_idx);
    new_route.insert(new_route.begin() + pickup_pos, pickup_idx);

    // Check capacity and time windows
    int current_time = 0;
    int current_load = 0;

    for (int i = 0; i < new_route.size(); i++) {
        if (i > 0) {
            int prev_node_id = new_route[i - 1];
            current_time += instance.travel_times[prev_node_id][new_route[i]];
        } else {
            // Travel time from depot to first node
            current_time += instance.travel_times[0][new_route[i]];
        }

        const Node &node = instance.nodes[new_route[i]];

        // Check time window
        if (current_time > node.late_time) {
            return false;
        }

        // Adjust time if arriving early
        current_time = max(current_time, node.early_time);
        current_time += node.service_duration;

        // Check capacity
        current_load += node.demand;
        if (current_load > instance.capacity || current_load < 0) {
            return false;
        }
    }

    // Check return time to depot
    if (!new_route.empty()) {
        int return_time = current_time + instance.travel_times[new_route.back()][0];
        const Node &depot_node = instance.nodes[0];
        if (return_time > depot_node.late_time) {
            return false;
        }
    }

    return true;
}

int calculate_route_cost(const vector<int> &route) {
    if (route.empty()) {
        return 0;
    }

    int total_time = instance.travel_times[0][route[0]]; // Depot to first node

    for (int i = 0; i < route.size() - 1; i++) {
        total_time += instance.travel_times[route[i]][route[i + 1]];
    }

    total_time += instance.travel_times[route.back()][0]; // Last node to depot

    return total_time;
}

vector<vector<int>> greedy_insertion(int num_routes) {
    vector<vector<int>> routes(num_routes);
    set<int> unvisited_pairs;

    // Initialize unvisited pairs with pickup node IDs
    for (const Node &node : pickup_nodes) {
        unvisited_pairs.insert(node.id);
    }

    while (!unvisited_pairs.empty()) {
        struct Insertion {
            int route_idx;
            int pickup_id;
            int delivery_id;
            int pickup_pos;
            int delivery_pos;
            int cost_increase;
        };

        Insertion best_insertion;
        best_insertion.cost_increase = numeric_limits<int>::max();
        bool found_insertion = false;

        for (int pickup_id : unvisited_pairs) {
            const Node &pickup_node = instance.nodes[pickup_id];
            int delivery_id = pickup_node.delivery_pair;

            for (int route_idx = 0; route_idx < num_routes; route_idx++) {
                const vector<int> &route = routes[route_idx];

                // Try all possible positions for pickup and delivery
                for (int pickup_pos = 0; pickup_pos <= route.size(); pickup_pos++) {
                    for (int delivery_pos = pickup_pos; delivery_pos <= route.size(); delivery_pos++) {
                        if (is_feasible_insertion(route, pickup_id, delivery_id,
                                                  pickup_pos, delivery_pos)) {
                            // Calculate cost increase
                            int old_cost = calculate_route_cost(route);

                            vector<int> new_route = route;
                            new_route.insert(new_route.begin() + delivery_pos, delivery_id);
                            new_route.insert(new_route.begin() + pickup_pos, pickup_id);

                            int new_cost = calculate_route_cost(new_route);
                            int cost_increase = new_cost - old_cost;

                            if (cost_increase < best_insertion.cost_increase) {
                                best_insertion.cost_increase = cost_increase;
                                best_insertion.route_idx = route_idx;
                                best_insertion.pickup_id = pickup_id;
                                best_insertion.delivery_id = delivery_id;
                                best_insertion.pickup_pos = pickup_pos;
                                best_insertion.delivery_pos = delivery_pos;
                                found_insertion = true;
                            }
                        }
                    }
                }
            }
        }

        if (!found_insertion) {
            cout << "Không thể chèn thêm cặp pickup-delivery nào!" << endl;
            break;
        }

        // Perform best insertion
        routes[best_insertion.route_idx].insert(
            routes[best_insertion.route_idx].begin() + best_insertion.delivery_pos,
            best_insertion.delivery_id);
        routes[best_insertion.route_idx].insert(
            routes[best_insertion.route_idx].begin() + best_insertion.pickup_pos,
            best_insertion.pickup_id);
        unvisited_pairs.erase(best_insertion.pickup_id);
    }

    return routes;
}

void write_output(const string &filename, const vector<vector<int>> &routes) {
    ofstream file(filename);

    // Write header information
    file << "Instance name : " << instance.name << endl;
    file << "Authors       : PDPTW Solver" << endl;
    file << "Date          : 2025" << endl;
    file << "Reference     : Greedy Insertion Algorithm" << endl;
    file << "Solution" << endl;

    // Write routes
    int route_num = 1;
    for (const auto &route : routes) {
        if (!route.empty()) {
            file << "Route " << route_num << " : ";
            for (int i = 0; i < route.size(); i++) {
                if (i > 0)
                    file << " ";
                file << route[i];
            }
            file << " " << endl;
            route_num++;
        }
    }

    file.close();
}

void solve(const string &input_file, const string &output_file, int num_routes) {
    instance = parse_input(input_file);
    depot = instance.nodes[0];
    pickup_nodes.clear();
    delivery_nodes.clear();

    for (const Node &node : instance.nodes) {
        if (node.is_pickup()) {
            pickup_nodes.push_back(node);
        } else if (node.is_delivery()) {
            delivery_nodes.push_back(node);
        }
    }

    vector<vector<int>> routes = greedy_insertion(num_routes);

    // Calculate statistics
    int total_cost = 0;
    int used_routes = 0;
    int total_nodes_visited = 0;

    for (const auto &route : routes) {
        total_cost += calculate_route_cost(route);
        if (!route.empty()) {
            used_routes++;
        }
        total_nodes_visited += route.size();
    }

    cout << "served_node: " << total_nodes_visited << endl;
    cout << "cost: " << total_cost << endl;

    write_output(output_file, routes);
}

int main() {
    string input_file = "input.txt";
    string output_file = "output.txt";

    int num_routes;
    cout << "Number of routes: ";
    cin >> num_routes;

    solve(input_file, output_file, num_routes);
    return 0;
}