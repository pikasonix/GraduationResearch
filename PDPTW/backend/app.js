#!/usr/bin/env node

/**
 * PDPTW Express.js Backend API Server
 * Provides REST endpoints for PDPTW problem solving and visualization
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import winston from 'winston';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configure logging
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// Configuration
const config = {
    port: process.env.PORT || 5000,
    uploadFolder: 'uploads',
    resultsFolder: 'results',
    logsFolder: 'logs',
    algorithmsFolder: path.resolve(__dirname, 'algorithms'),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['.txt'],
    algorithms: {
        hybrid: 'PDPTW_TEST.exe'
    }
};

// Ensure directories exist
await Promise.all([
    fs.ensureDir(config.uploadFolder),
    fs.ensureDir(config.resultsFolder),
    fs.ensureDir(config.logsFolder)
]);

// Ensure required directories exist
const createDirectories = async () => {
    const directories = [
        config.uploadFolder,
        config.resultsFolder,
        config.logsFolder,
        config.algorithmsFolder
    ];

    for (const dir of directories) {
        try {
            await fs.ensureDir(dir);
            logger.info(`📁 Directory ensured: ${dir}`);
        } catch (error) {
            logger.error(`❌ Failed to create directory ${dir}:`, error.message);
        }
    }
};

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.uploadFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: config.maxFileSize
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (config.allowedFileTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Only ${config.allowedFileTypes.join(', ')} files are allowed`));
        }
    }
});

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

/**
 * PDPTW Backend Class
 */
class PDPTWBackend {
    constructor() {
        this.algorithms = config.algorithms;
        this.findAlgorithmExecutable();
    }    /**
     * Find algorithm executable in algorithms folder
     */
    findAlgorithmExecutable() {
        const executableName = config.algorithms.hybrid;
        const algorithmPath = path.join(config.algorithmsFolder, executableName);

        logger.info('🔍 Checking algorithm executable...');
        logger.info(`   Algorithm folder: ${config.algorithmsFolder}`);
        logger.info(`   Executable name: ${executableName}`);
        logger.info(`   Full path: ${algorithmPath}`);

        if (fs.existsSync(algorithmPath)) {
            logger.info(`✅ Algorithm executable found at: ${algorithmPath}`);
        } else {
            logger.error(`❌ Algorithm executable not found at: ${algorithmPath}`);
            logger.error('Please ensure the algorithm executable is in the backend/algorithms directory.');
        }
    }

    /**
     * Validate PDPTW instance format
     */
    validateInstance(instanceContent) {
        try {
            const lines = instanceContent.trim().split('\n');

            if (lines.length < 2) {
                return { valid: false, error: 'Instance too short' };
            }

            // Basic format validation
            const nameLine = lines[0].trim();
            if (!nameLine.startsWith('NAME:')) {
                return { valid: false, error: 'Missing NAME header' };
            }

            // Extract instance name
            const name = nameLine.split(':', 2)[1]?.trim();
            if (!name) {
                return { valid: false, error: 'Invalid NAME format' };
            }

            // Additional validation can be added here
            let hasNodes = false;
            let hasDemands = false;
            let hasTimeWindows = false;

            for (const line of lines) {
                const trimmed = line.trim().toUpperCase();
                if (trimmed.includes('NODE_COORD_SECTION') || trimmed.includes('NODES')) {
                    hasNodes = true;
                }
                if (trimmed.includes('DEMAND_SECTION')) {
                    hasDemands = true;
                }
                if (trimmed.includes('TIME_WINDOW_SECTION')) {
                    hasTimeWindows = true;
                }
            }

            return {
                valid: true,
                name,
                info: {
                    hasNodes,
                    hasDemands,
                    hasTimeWindows
                }
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Execute algorithm and solve PDPTW instance
     */
    async solveInstance(instanceContent, algorithm, params = {}) {
        try {
            // Validate instance
            const validation = this.validateInstance(instanceContent);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            // Check if algorithm exists
            if (!this.algorithms[algorithm]) {
                return { success: false, error: `Unknown algorithm: ${algorithm}` };
            }

            const exePath = path.join(config.algorithmsFolder, this.algorithms[algorithm]);

            // Debug logging
            logger.info(`Checking algorithm executable at: ${exePath}`);
            logger.info(`Algorithms folder: ${config.algorithmsFolder}`);
            logger.info(`Executable name: ${this.algorithms[algorithm]}`);

            // Check if executable exists
            if (!await fs.pathExists(exePath)) {
                return {
                    success: false,
                    error: `Algorithm executable not found: ${this.algorithms[algorithm]} at path: ${exePath}`
                };
            }

            // Create temporary files
            const jobId = uuidv4();
            const instancePath = path.join(config.uploadFolder, `instance-${jobId}.txt`);
            const solutionPath = path.join(config.resultsFolder, `solution-${jobId}.txt`);

            try {
                // Write instance to file
                await fs.writeFile(instancePath, instanceContent, 'utf8');

                // Build command arguments
                const args = [instancePath, solutionPath];

                // Add algorithm-specific parameters
                if (algorithm === 'hybrid') {
                    args.push(
                        String(params.num_routes || 7),
                        String(params.ants || 10),
                        String(params.iterations || 20),
                        String(params.alpha || 2.0),
                        String(params.beta || 5.0),
                        String(params.rho || 0.1),
                        String(params.tau_max || 50.0),
                        String(params.tau_min || 0.01),
                        String(params.greedy_bias || 0.85),
                        String(params.elite_solutions || 4),
                        String(params.local_search_prob || 0.7),
                        String(params.restart_threshold || 2)
                    );
                }

                logger.info(`Executing algorithm: ${exePath} ${args.join(' ')}`);

                // Execute algorithm
                const result = await this.executeCommand(exePath, args, 300000); // 5 minutes timeout

                if (result.code !== 0) {
                    return {
                        success: false,
                        error: `Algorithm failed: ${result.stderr || result.stdout}`
                    };
                }

                // Read solution file
                if (await fs.pathExists(solutionPath)) {
                    const solutionContent = await fs.readFile(solutionPath, 'utf8');

                    return {
                        success: true,
                        solution: solutionContent,
                        algorithm,
                        parameters: params,
                        execution_time: result.executionTime,
                        job_id: jobId
                    };
                } else {
                    return { success: false, error: 'No solution file generated' };
                }

            } finally {
                // Cleanup temporary files
                await Promise.all([
                    fs.remove(instancePath).catch(() => { }),
                    fs.remove(solutionPath).catch(() => { })
                ]);
            }

        } catch (error) {
            logger.error(`Error solving instance: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute external command with timeout
     */
    executeCommand(command, args, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const child = spawn(command, args);

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                const executionTime = Date.now() - startTime;
                resolve({
                    code,
                    stdout,
                    stderr,
                    executionTime
                });
            });

            child.on('error', (error) => {
                reject(error);
            });

            // Set timeout
            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('Command execution timeout'));
            }, timeout);

            child.on('close', () => {
                clearTimeout(timer);
            });
        });
    }

    /**
     * Get available algorithms with their status
     */
    async getAlgorithms() {
        const algorithms = [];

        for (const [key, exe] of Object.entries(this.algorithms)) {
            const exePath = path.join(config.algorithmsFolder, exe);
            const available = await fs.pathExists(exePath);

            algorithms.push({
                id: key,
                name: key.toUpperCase(),
                executable: exe,
                available,
                path: exePath
            });
        }

        return algorithms;
    }
}

// Initialize backend
const pdptwBackend = new PDPTWBackend();

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

/**
 * Get available algorithms
 */
app.get('/api/algorithms', async (req, res) => {
    try {
        const algorithms = await pdptwBackend.getAlgorithms();
        res.json({ success: true, algorithms });
    } catch (error) {
        logger.error(`Error getting algorithms: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Validate instance format
 */
app.post('/api/validate-instance', [
    body('instance').notEmpty().withMessage('Instance content is required')
], handleValidationErrors, (req, res) => {
    try {
        const { instance } = req.body;
        const validation = pdptwBackend.validateInstance(instance);
        res.json(validation);
    } catch (error) {
        logger.error(`Error validating instance: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Solve PDPTW problem
 */
app.post('/api/solve', [
    body('instance').notEmpty().withMessage('Instance content is required'),
    body('algorithm').isIn(['aco', 'greedy', 'hybrid']).withMessage('Invalid algorithm')
], handleValidationErrors, async (req, res) => {
    try {
        const { instance, algorithm, params = {} } = req.body;

        logger.info(`Solving problem with algorithm: ${algorithm}`);
        const result = await pdptwBackend.solveInstance(instance, algorithm, params);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        logger.error(`Error solving problem: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Upload instance file
 */
app.post('/api/upload-instance', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const content = await fs.readFile(req.file.path, 'utf8');

        // Validate instance
        const validation = pdptwBackend.validateInstance(content);
        if (!validation.valid) {
            await fs.remove(req.file.path); // Cleanup
            return res.status(400).json({
                success: false,
                error: `Invalid instance: ${validation.error}`
            });
        }

        // Cleanup uploaded file
        await fs.remove(req.file.path);

        res.json({
            success: true,
            content,
            name: validation.name,
            info: validation.info
        });

    } catch (error) {
        logger.error(`Error uploading instance: ${error.message}`);
        if (req.file) {
            await fs.remove(req.file.path).catch(() => { });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Upload solution file
 */
app.post('/api/upload-solution', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const content = await fs.readFile(req.file.path, 'utf8');

        // Cleanup uploaded file
        await fs.remove(req.file.path);

        res.json({
            success: true,
            content
        });

    } catch (error) {
        logger.error(`Error uploading solution: ${error.message}`);
        if (req.file) {
            await fs.remove(req.file.path).catch(() => { });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Get sample instance
 */
app.get('/api/sample-instance', (req, res) => {
    const sampleInstance = `NAME: bar-n100-1
COMMENT: Generated by Gehring & Homberger
TYPE: PDPTW
DIMENSION: 201
EDGE_WEIGHT_TYPE: EUC_2D
CAPACITY: 200

NODE_COORD_SECTION
0 35 35
1 41 49
2 35 17
3 55 45
4 55 20
5 15 30
6 25 30
7 20 50
8 10 43
9 55 60
10 30 60

DEMAND_SECTION
0 0
1 10
2 7
3 13
4 19
5 26
6 3
7 5
8 9
9 16
10 16

TIME_WINDOW_SECTION
0 0 1000
1 161 171
2 50 60
3 116 126
4 149 159
5 34 44
6 99 109
7 81 91
8 95 105
9 97 107
10 124 134

SERVICE_TIME_SECTION
0 0
1 10
2 10
3 10
4 10
5 10
6 10
7 10
8 10
9 10
10 10

PICKUP_AND_DELIVERY_SECTION
1 6
2 7
3 8
4 9
5 10

DEPOT_SECTION
0
-1

EOF`;

    res.json({
        success: true,
        content: sampleInstance,
        name: 'bar-n100-1'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error(`Unhandled error: ${error.message}`);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force close server after 30secs
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Start server
const server = app.listen(config.port, '0.0.0.0', async () => {
    logger.info(`🚀 PDPTW Backend Server started on port ${config.port}`);

    // Create required directories
    await createDirectories();

    logger.info(`📁 Algorithms folder: ${config.algorithmsFolder}`);
    logger.info(`🧮 Available algorithms: ${Object.keys(config.algorithms).join(', ')}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Check if algorithm executable exists on startup
    const hybridPath = path.join(config.algorithmsFolder, config.algorithms.hybrid);
    const exists = await fs.pathExists(hybridPath);
    logger.info(`🔍 Algorithm executable check: ${hybridPath} - ${exists ? 'EXISTS' : 'NOT FOUND'}`);

    if (!exists) {
        logger.error(`❌ Algorithm executable not found at startup!`);
        logger.info(`📂 Current working directory: ${process.cwd()}`);
        logger.info(`📂 __dirname: ${__dirname}`);
        logger.info(`💡 Please copy PDPTW_HYBRID_ACO_GREEDY_V3.exe to ${config.algorithmsFolder}`);
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
