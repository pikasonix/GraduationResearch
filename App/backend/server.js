require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '5mb';
const ALGORITHM_EXECUTABLE = process.env.ALGORITHM_EXECUTABLE || 'PDPTW_HYBRID_ACO_GREEDY_V3.exe';

app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({ limit: MAX_FILE_SIZE }));

app.post('/api/solve', (req, res) => {
    const { instance, params } = req.body;
    console.log('POST /api/solve called');
    if (!instance || !params) {
        console.log('Missing instance or params');
        return res.status(400).json({ success: false, error: 'Thiếu dữ liệu instance hoặc tham số.' });
    }

    const paramLine = [
        params.num_routes || process.env.DEFAULT_NUM_ROUTES || 10,
        params.ants || process.env.DEFAULT_ANTS || 10,
        params.iterations || process.env.DEFAULT_ITERATIONS || 20,
        params.alpha || process.env.DEFAULT_ALPHA || 2.0,
        params.beta || process.env.DEFAULT_BETA || 5.0,
        params.rho || process.env.DEFAULT_RHO || 0.1,
        params.tau_max || process.env.DEFAULT_TAU_MAX || 50.0,
        params.tau_min || process.env.DEFAULT_TAU_MIN || 0.01,
        params.greedy_bias || process.env.DEFAULT_GREEDY_BIAS || 0.85,
        params.elite_solutions || process.env.DEFAULT_ELITE_SOLUTIONS || 4,
        params.local_search_prob || process.env.DEFAULT_LOCAL_SEARCH_PROB || 0.7,
        params.restart_threshold || process.env.DEFAULT_RESTART_THRESHOLD || 2
    ].join(' ');

    const inputPath = path.join(__dirname, 'input.txt');
    const fullContent = paramLine + '\n' + instance;
    fs.writeFileSync(inputPath, fullContent, 'utf8');
    console.log('Parameters written to input.txt:', paramLine);

    const exePath = path.join(__dirname, ALGORITHM_EXECUTABLE);
    console.log('Running exe:', exePath);
    execFile(exePath, [], { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.log('Error running exe:', error, stderr);
            return res.status(500).json({ success: false, error: stderr || error.message });
        }

        const outputPath = path.join(__dirname, 'output.txt');
        let result = '';
        try {
            result = fs.readFileSync(outputPath, 'utf8');
        } catch (e) {
            console.log('Error reading output.txt:', e);
            return res.status(500).json({ success: false, error: 'Không đọc được file output.txt' });
        }
        res.json({ success: true, result });
    });
});

app.listen(PORT, HOST, () => {
    console.log(`Backend server is running at http://${HOST}:${PORT}`);
    console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
