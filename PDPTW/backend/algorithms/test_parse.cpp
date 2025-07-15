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

    bool is_depot() const { return id == 0; }
    bool is_pickup() const { return demand > 0; }
    bool is_delivery() const { return demand < 0; }
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

string trim(const string &str) {
    size_t first = str.find_first_not_of(' ');
    if (string::npos == first)
        return str;
    size_t last = str.find_last_not_of(' ');
    return str.substr(first, (last - first + 1));
}

vector<string> split(const string &str, char delimiter) {
    vector<string> tokens;
    stringstream ss(str);
    string token;
    while (getline(ss, token, delimiter)) {
        string trimmed = trim(token);
        if (!trimmed.empty()) {
            tokens.push_back(trimmed);
        }
    }
    return tokens;
}

int safe_stoi(const string &str, int default_value = 0) {
    try {
        if (str.empty())
            return default_value;
        return stoi(str);
    } catch (const std::exception &e) {
        return default_value;
    }
}

double safe_stod(const string &str, double default_value = 0.0) {
    try {
        if (str.empty())
            return default_value;
        return stod(str);
    } catch (const std::exception &e) {
        return default_value;
    }
}

Instance parse_input_simple(const string &filename) {
    cout << "Opening file: " << filename << endl;
    ifstream file(filename);
    if (!file.is_open()) {
        cout << "Error: Cannot open file " << filename << endl;
        exit(1);
    }

    vector<string> lines;
    string line;
    bool first_line = true;

    cout << "Reading lines..." << endl;
    while (getline(file, line)) {
        string trimmed = trim(line);
        if (!trimmed.empty()) {
            // Skip first line if it contains parameters (starts with numbers)
            if (first_line && (isdigit(trimmed[0]) || trimmed[0] == '.')) {
                cout << "Skipping parameter line: " << trimmed << endl;
                first_line = false;
                continue;
            }
            lines.push_back(trimmed);
            first_line = false;
        }
    }
    file.close();

    cout << "Total lines read: " << lines.size() << endl;

    if (lines.empty()) {
        cout << "Error: Input file is empty or contains no valid data" << endl;
        exit(1);
    }

    map<string, string> info;
    int i = 0;
    cout << "Parsing header..." << endl;
    while (i < lines.size() && lines[i] != "NODES") {
        cout << "Processing header line: " << lines[i] << endl;
        if (lines[i].find(':') != string::npos) {
            size_t pos = lines[i].find(':');
            string key = trim(lines[i].substr(0, pos));
            string value = trim(lines[i].substr(pos + 1));
            info[key] = value;
            cout << "  " << key << " = " << value << endl;
        }
        i++;
    }

    if (i >= lines.size()) {
        cout << "Error: NODES section not found in input file" << endl;
        exit(1);
    }

    cout << "Found NODES section at line " << i << endl;
    i++; // Skip "NODES" line

    int size = safe_stoi(info["SIZE"], 0);
    cout << "Instance size: " << size << endl;

    if (size <= 0) {
        cout << "Error: Invalid or missing SIZE in input file" << endl;
        exit(1);
    }

    if (i + size > lines.size()) {
        cout << "Error: Not enough node data in input file. Expected " << size << " nodes, have " << (lines.size() - i) << " lines" << endl;
        exit(1);
    }

    vector<Node> nodes;
    cout << "Parsing " << size << " nodes..." << endl;
    for (int j = 0; j < size; j++) {
        if (i + j >= lines.size()) {
            cout << "Error: Running out of lines at node " << j << endl;
            exit(1);
        }
        vector<string> parts = split(lines[i + j], ' ');
        if (parts.size() < 9) {
            cout << "Error: Invalid node data at line " << (i + j + 1) << ". Expected 9 fields, got " << parts.size() << endl;
            cout << "Line content: " << lines[i + j] << endl;
            exit(1);
        }
        Node node;
        node.id = safe_stoi(parts[0], j);
        node.lat = safe_stod(parts[1], 0.0);
        node.lon = safe_stod(parts[2], 0.0);
        node.demand = safe_stoi(parts[3], 0);
        node.early_time = safe_stoi(parts[4], 0);
        node.late_time = safe_stoi(parts[5], 1440);
        node.service_duration = safe_stoi(parts[6], 0);
        node.pickup_pair = safe_stoi(parts[7], -1);
        node.delivery_pair = safe_stoi(parts[8], -1);
        nodes.push_back(node);

        if (j < 5) { // Print first 5 nodes for debug
            cout << "Node " << j << ": id=" << node.id << " demand=" << node.demand << endl;
        }
    }

    cout << "Successfully parsed " << nodes.size() << " nodes" << endl;

    Instance inst;
    inst.name = info.count("NAME") ? info["NAME"] : "Unknown";
    inst.location = info.count("LOCATION") ? info["LOCATION"] : "Unknown";
    inst.size = size;
    inst.capacity = info.count("CAPACITY") ? safe_stoi(info["CAPACITY"], 100) : 100;
    inst.route_time = info.count("ROUTE-TIME") ? safe_stoi(info["ROUTE-TIME"], 1440) : 1440;
    inst.nodes = nodes;

    cout << "Instance created successfully:" << endl;
    cout << "  Name: " << inst.name << endl;
    cout << "  Size: " << inst.size << " nodes" << endl;
    cout << "  Capacity: " << inst.capacity << endl;

    return inst;
}

int main() {
    cout << "Starting simple parse test..." << endl;

    try {
        Instance instance = parse_input_simple("input.txt");
        cout << "Parse completed successfully!" << endl;

        // Count pickup nodes
        int pickup_count = 0;
        for (const Node &node : instance.nodes) {
            if (node.is_pickup()) {
                pickup_count++;
            }
        }
        cout << "Pickup nodes found: " << pickup_count << endl;

    } catch (const exception &e) {
        cout << "Exception caught: " << e.what() << endl;
    } catch (...) {
        cout << "Unknown exception caught" << endl;
    }

    return 0;
}
