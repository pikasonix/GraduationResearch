import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import cors from 'cors';
import { JobQueue } from './queue/JobQueue';
import { SolverWorker } from './workers/SolverWorker';
import { setupJobRoutes } from './routes/jobRoutes';
import { SolverParams } from './types';
import { persistSolutionSnapshot } from './persistence/persistSolutionSnapshot';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '5mb';

/**
 * Resolve pdptw_solver executable path
 */
function resolvePDPTWSolverExecutable(): string {
    const binPath = path.join(__dirname, '..', 'bin', 'pdptw_solver.exe');
    if (fs.existsSync(binPath)) {
        return binPath;
    }

    const oldPath = path.join(__dirname, '..', '..', 'pdptw_solver', 'build', 'apps', 'Release', 'pdptw_solver.exe');
    if (fs.existsSync(oldPath)) {
        return oldPath;
    }
    
    const customPath = process.env.PDPTW_SOLVER_PATH;
    if (customPath && fs.existsSync(customPath)) {
        return customPath;
    }
    
    throw new Error(`Không tìm thấy pdptw_solver.exe. Đã thử: ${[binPath, oldPath, customPath].filter(Boolean).join(', ')}`);
}

// Initialize solver path
let PDPTW_SOLVER_PATH: string;
try {
    PDPTW_SOLVER_PATH = resolvePDPTWSolverExecutable();
    SolverWorker.validateSolver(PDPTW_SOLVER_PATH);
    console.log(`✓ PDPTW Solver found: ${PDPTW_SOLVER_PATH}`);
} catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}

// Initialize Job Queue
const jobQueue = new JobQueue({
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100', 10),
    jobTimeout: parseInt(process.env.JOB_TIMEOUT || '3600000', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '300000', 10),
    maxJobAge: parseInt(process.env.MAX_JOB_AGE || '86400000', 10)
});

// Initialize Solver Worker
const solverWorker = new SolverWorker(PDPTW_SOLVER_PATH, {
    baseWorkDir: process.env.APP_WORK_DIR
});

// Setup job processing
jobQueue.on('processJob', (job, callbacks) => {
    console.log(`[Server] Starting to process job ${job.id}`);

    solverWorker.solve(job, {
        ...callbacks,
        onComplete: (result) => {
            (async () => {
                try {
                    if (job.organizationId && job.createdBy && job.inputData) {
                        const persisted = await persistSolutionSnapshot({
                            jobId: job.id,
                            organizationId: job.organizationId,
                            solutionText: result.solution,
                            solverFilename: result.filename,
                            inputData: job.inputData,
                        });

                        callbacks.onComplete({
                            ...result,
                            persisted: !!persisted,
                            solutionId: persisted?.solutionId,
                        });
                        return;
                    }

                    callbacks.onComplete({
                        ...result,
                        persisted: false,
                    });
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    callbacks.onFail(message);
                }
            })();
        },
    });
});

jobQueue.on('jobCompleted', (job) => {
    console.log(`[Server] Job ${job.id} completed`);
});

jobQueue.on('jobFailed', (job) => {
    console.error(`[Server] Job ${job.id} failed: ${job.error}`);
});

console.log('✓ Job Queue initialized');
console.log(`  Max queue size: ${jobQueue.maxQueueSize}`);
console.log(`  Job timeout: ${(jobQueue.jobTimeout / 60000).toFixed(0)} minutes`);

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: MAX_FILE_SIZE }));

// Routes
app.use('/api/jobs', setupJobRoutes(jobQueue));

// Legacy endpoint for backward compatibility
interface SolveRequest {
    instance: string;
    params: SolverParams;
}

app.post('/api/solve', (req: Request<{}, {}, SolveRequest>, res: Response): void => {
    try {
        const { instance, params } = req.body;

        if (!instance || !params) {
            res.status(400).json({
                success: false,
                error: 'Thiếu dữ liệu instance hoặc tham số.'
            });
            return;
        }

        const jobId = jobQueue.createJob(instance, params);

        res.json({
            success: true,
            jobId: jobId,
            message: 'Job submitted to queue. Use /api/jobs/:jobId to check status.',
            statusUrl: `/api/jobs/${jobId}`
        });

    } catch (error) {
        console.error('Error in /api/solve:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        });
    }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
    const stats = jobQueue.getStats();
    res.json({ 
        status: 'ok',
        queue: stats,
        solver: PDPTW_SOLVER_PATH
    });
});

// 404 handler
app.use((_req: Request, res: Response): void => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, next: NextFunction): void => {
    console.error('Unhandled error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Graceful shutdown
const shutdown = (): void => {
    console.log('\n[Server] Shutting down gracefully...');
    jobQueue.shutdown();
    process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
app.listen(PORT, HOST, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log(`  PDPTW Solver Backend Server`);
    console.log('='.repeat(60));
    console.log(`  URL: http://${HOST}:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  CORS: ${CORS_ORIGIN}`);
    console.log('='.repeat(60));
    console.log('');
});
