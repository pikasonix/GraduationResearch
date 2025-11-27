import { Router, Request, Response } from 'express';
import { JobQueue } from '../queue/JobQueue';
import { SolverParams } from '../types';

interface SubmitJobRequest {
    instance: string;
    params: SolverParams;
}

/**
 * Setup job routes
 */
export function setupJobRoutes(jobQueue: JobQueue): Router {
    const router = Router();
    
    /**
     * POST /api/jobs/submit
     * Submit a new job to the queue
     */
    router.post('/submit', (req: Request<{}, {}, SubmitJobRequest>, res: Response): void => {
        try {
            const { instance, params } = req.body;

            if (!instance || !params) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: instance and params'
                });
                return;
            }

            if (typeof instance !== 'string' || instance.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Instance must be a non-empty string'
                });
                return;
            }

            const jobId = jobQueue.createJob(instance, params);

            res.json({
                success: true,
                jobId: jobId,
                message: 'Job submitted successfully'
            });

        } catch (error) {
            console.error('Error submitting job:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * GET /api/jobs/:jobId
     * Get job status and result
     */
    router.get('/:jobId', (req: Request, res: Response): void => {
        try {
            const { jobId } = req.params;
            const job = jobQueue.getJob(jobId);

            if (!job) {
                res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
                return;
            }

            const response: any = {
                success: true,
                job: {
                    id: job.id,
                    status: job.status,
                    progress: job.progress,
                    queuePosition: job.queuePosition,
                    createdAt: job.createdAt,
                    startedAt: job.startedAt,
                    completedAt: job.completedAt,
                    error: job.error
                }
            };

            if (job.status === 'completed' && job.result) {
                response.job.result = job.result;
            }

            if (job.startedAt) {
                const endTime = job.completedAt || Date.now();
                response.job.duration = ((endTime - job.startedAt) / 1000).toFixed(2);
            }

            if (job.status === 'pending' && job.queuePosition > 0) {
                response.job.estimatedWaitTime = `Position ${job.queuePosition} in queue`;
            }

            res.json(response);

        } catch (error) {
            console.error('Error getting job:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * DELETE /api/jobs/:jobId
     * Cancel or delete a job
     */
    router.delete('/:jobId', (req: Request, res: Response): void => {
        try {
            const { jobId } = req.params;
            const job = jobQueue.getJob(jobId);

            if (!job) {
                res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
                return;
            }

            if (job.status === 'processing') {
                res.status(400).json({
                    success: false,
                    error: 'Cannot cancel job that is currently processing'
                });
                return;
            }

            const deleted = jobQueue.deleteJob(jobId);

            if (deleted) {
                res.json({
                    success: true,
                    message: 'Job deleted successfully'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Failed to delete job'
                });
            }

        } catch (error) {
            console.error('Error deleting job:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * GET /api/jobs
     * Get all jobs or filtered jobs
     */
    router.get('/', (req: Request, res: Response) => {
        try {
            const { status, limit } = req.query;
            let jobs = jobQueue.getAllJobs();

            if (status && typeof status === 'string') {
                jobs = jobs.filter(job => job.status === status);
            }

            jobs.sort((a, b) => b.createdAt - a.createdAt);

            if (limit && typeof limit === 'string') {
                const limitNum = parseInt(limit, 10);
                jobs = jobs.slice(0, limitNum);
            }

            const jobsSummary = jobs.map(job => ({
                id: job.id,
                status: job.status,
                progress: job.progress,
                queuePosition: job.queuePosition,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
                error: job.error,
                hasResult: !!job.result
            }));

            res.json({
                success: true,
                jobs: jobsSummary,
                count: jobsSummary.length
            });

        } catch (error) {
            console.error('Error listing jobs:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * GET /api/jobs/stats
     * Get queue statistics
     */
    router.get('/stats', (_req: Request, res: Response): void => {
        try {
            const stats = jobQueue.getStats();
            res.json({
                success: true,
                stats: stats
            });
        } catch (error) {
            console.error('Error getting stats:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    return router;
}
