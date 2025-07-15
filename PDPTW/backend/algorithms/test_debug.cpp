#include <bits/stdc++.h>
using namespace std;

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

int main() {
    cout << "Starting debug test..." << endl;

    ifstream file("input.txt");
    if (!file.is_open()) {
        cout << "Error: Cannot open file" << endl;
        return 1;
    }

    cout << "File opened successfully" << endl;

    vector<string> lines;
    string line;
    int line_count = 0;

    while (getline(file, line) && line_count < 20) {
        cout << "Read line " << line_count << ": " << line << endl;
        string trimmed = trim(line);
        if (!trimmed.empty()) {
            lines.push_back(trimmed);
        }
        line_count++;
    }
    file.close();

    cout << "Total lines read: " << lines.size() << endl;

    return 0;
}
