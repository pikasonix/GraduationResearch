require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
// bind to 0.0.0.0 in containers/hosts by default
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '5mb';
const resolveAlgorithmExecutable = () => {
    const configured = process.env.ALGORITHM_EXECUTABLE;
    const defaultBaseName = 'PDPTW_HYBRID_ACO_GREEDY_V3';
    const baseName = configured
        ? configured.replace(/(_LINUX|\.exe)$/i, '')
        : defaultBaseName;

    const candidates = [];
    const addCandidate = (name) => {
        if (name && !candidates.includes(name)) {
            candidates.push(name);
        }
    };

    const hasExplicitSuffix = configured && /(_LINUX|\.exe)$/i.test(configured);
    if (hasExplicitSuffix) {
        addCandidate(configured);
    }

    if (process.platform === 'win32') {
        addCandidate(`${baseName}.exe`);
        addCandidate(baseName);
        addCandidate(`${baseName}_LINUX`);
    } else {
        addCandidate(`${baseName}_LINUX`);
        addCandidate(baseName);
        addCandidate(`${baseName}.exe`);
    }

    if (!hasExplicitSuffix && configured) {
        addCandidate(configured);
    }

    const resolved = candidates.find((candidate) =>
        candidate && fs.existsSync(path.join(__dirname, candidate))
    );

    if (!resolved) {
        throw new Error(`Không tìm thấy file thực thi thuật toán. Đã thử: ${candidates.filter(Boolean).join(', ')}`);
    }

    return resolved;
};

let ALGORITHM_EXECUTABLE;
try {
    ALGORITHM_EXECUTABLE = resolveAlgorithmExecutable();
    console.log(`Đang sử dụng thuật toán: ${ALGORITHM_EXECUTABLE} (platform: ${process.platform})`);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}

const BASE_WORK_DIR = process.env.APP_WORK_DIR || path.join(os.tmpdir(), 'wayo');
try {
    fs.mkdirSync(BASE_WORK_DIR, { recursive: true });
    console.log('Work directory ready at', BASE_WORK_DIR);
} catch (err) {
    console.error('Failed to prepare work directory:', err);
}

// Allow all origins by reflecting the request origin in the response
app.use(cors({
    origin: true,
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

    let workDir = '';
    try {
        workDir = fs.mkdtempSync(path.join(BASE_WORK_DIR, 'job-'));
    } catch (err) {
        console.error('Failed to create work directory:', err);
        return res.status(500).json({ success: false, error: 'Không tạo được thư mục tạm' });
    }

    const cleanup = () => {
        if (workDir) {
            try {
                fs.rmSync(workDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.warn('Failed to clean up work dir', workDir, cleanupErr);
            }
        }
    };

    const inputPath = path.join(workDir, 'input.txt');
    const fullContent = paramLine + '\n' + instance;
    try {
        fs.writeFileSync(inputPath, fullContent, 'utf8');
    } catch (err) {
        console.error('Failed to write input.txt:', err);
        cleanup();
        return res.status(500).json({ success: false, error: 'Không ghi được file input.txt' });
    }
    console.log('Parameters written to', inputPath, paramLine);

    const exePath = path.join(__dirname, ALGORITHM_EXECUTABLE);
    console.log('Running exe:', exePath, 'in', workDir);
    execFile(exePath, [], { cwd: workDir }, (error, stdout, stderr) => {
        if (error) {
            console.log('Error running exe:', error, stderr);
            cleanup();
            return res.status(500).json({ success: false, error: stderr || error.message });
        }

        const outputPath = path.join(workDir, 'output.txt');
        let result = '';
        try {
            result = fs.readFileSync(outputPath, 'utf8');
        } catch (e) {
            console.log('Error reading output.txt:', e);
            cleanup();
            return res.status(500).json({ success: false, error: 'Không đọc được file output.txt' });
        }
        res.json({ success: true, result });
        cleanup();
    });
});

// simple health check for platform probes
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// JSON 404 handler to avoid HTML responses
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Centralized error handler to ensure JSON responses
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ success: false, error: err?.message || 'Internal server error' });
});

app.listen(PORT, HOST, () => {
    console.log(`Backend server is running at http://${HOST}:${PORT}`);
    console.log(`CORS enabled for: ${CORS_ORIGIN}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
