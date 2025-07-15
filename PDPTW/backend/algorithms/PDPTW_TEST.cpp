#include <bits/stdc++.h>
using namespace std;

int main(int argc, char *argv[]) {
    if (argc < 3) {
        cout << "Usage: " << argv[0] << " input_file output_file [parameters...]" << endl;
        return 1;
    }

    string input_file = argv[1];
    string output_file = argv[2];

    cout << "Using input file: " << input_file << endl;
    cout << "Using output file: " << output_file << endl;

    // Just create a dummy output for now
    ofstream out(output_file);
    out << "Instance name : test" << endl;
    out << "Authors       : Pix" << endl;
    out << "Date          : 2025" << endl;
    out << "Reference     : Test Version" << endl;
    out << "Solution" << endl;
    out << "Route 1 : 1 2" << endl;
    out.close();

    cout << "Test solution written to " << output_file << endl;

    return 0;
}
