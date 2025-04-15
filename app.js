const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to run the ACO algorithm
app.post('/run-aco', (req, res) => {
    try {
        const { nodes, parameters } = req.body;

        // Create input file
        const inputContent = createInputFile(nodes, parameters);
        fs.writeFileSync(path.join(__dirname, 'temp', 'input.txt'), inputContent);

        // Compile and run the C++ program
        compileAndRunCpp();

        // Read the output file
        const outputContent = fs.readFileSync(path.join(__dirname, 'temp', 'output.txt'), 'utf8');
        const result = parseOutputFile(outputContent);

        // Read convergence data if available
        let convergenceData = [];
        try {
            const convergenceContent = fs.readFileSync(path.join(__dirname, 'temp', 'convergence.txt'), 'utf8');
            convergenceData = parseConvergenceData(convergenceContent);
        } catch (error) {
            console.error('Error reading convergence data:', error);
        }

        res.json({
            success: true,
            result,
            convergenceData
        });
    } catch (error) {
        console.error('Error running ACO algorithm:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Function to create input file
function createInputFile(nodes, parameters) {
    const { antCount, maxIterations, alpha, beta, rho, Q } = parameters;
    let content = `${antCount} ${maxIterations} ${alpha} ${beta} ${rho} ${Q}\n`;
    content += `${nodes.length}\n`;

    nodes.forEach(node => {
        content += `${node.id} ${node.x} ${node.y}\n`;
    });

    return content;
}

// Function to compile and run the C++ program
function compileAndRunCpp() {
    const compilePath = path.join(__dirname, 'public', 'aco_solver.cpp');
    const outputExePath = path.join(__dirname, 'temp', 'aco_solver');

    try {
        // Compile the C++ program
        const compileCommand = process.platform === 'win32'
            ? `g++ "${compilePath}" -o "${outputExePath}.exe" -std=c++11`
            : `g++ "${compilePath}" -o "${outputExePath}" -std=c++11`;

        execSync(compileCommand);

        // Run the compiled program
        const runCommand = process.platform === 'win32'
            ? `cd "${path.join(__dirname, 'temp')}" && "${outputExePath}.exe"`
            : `cd "${path.join(__dirname, 'temp')}" && "${outputExePath}"`;

        execSync(runCommand);
    } catch (error) {
        console.error('Error compiling or running C++ program:', error);
        throw new Error('Failed to execute ACO algorithm');
    }
}

// Function to parse output file
function parseOutputFile(content) {
    const lines = content.trim().split('\n');
    const path = lines[0].split(' ').map(id => parseInt(id));
    const distance = parseFloat(lines[1]);

    return { path, distance };
}

// Function to parse convergence data
function parseConvergenceData(content) {
    const lines = content.trim().split('\n');
    return lines.map(line => {
        const [iteration, distance] = line.split(' ').map(Number);
        return { iteration, distance };
    });
}

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Start the server
app.listen(port, () => {
    console.log(`ACO Demo app listening at http://localhost:${port}`);
});