import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Job, SolverParams, JobQueueStats, JobQueueOptions, JobCallbacks } from '../types';

/**
 * Job Queue Manager
 * Quản lý hàng đợi xử lý các job solver theo thứ tự FIFO
 * Chỉ xử lý 1 job tại một thời điểm để tránh quá tải
 */
export class JobQueue extends EventEmitter {
    private jobs: Map<string, Job>;
    private queue: string[];
    private processing: boolean;
    private currentJobId: string | null;
    
    // Configuration
    public readonly maxQueueSize: number;
    public readonly jobTimeout: number;
    public readonly cleanupInterval: number;
    public readonly maxJobAge: number;
    
    private cleanupTimer?: NodeJS.Timeout;

    constructor(options: JobQueueOptions = {}) {
        super();
        this.jobs = new Map();
        this.queue = [];
        this.processing = false;
        this.currentJobId = null;
        
        this.maxQueueSize = options.maxQueueSize || 100;
        this.jobTimeout = options.jobTimeout || 3600000; // 1 hour default
        this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
        this.maxJobAge = options.maxJobAge || 86400000; // 24 hours
        
        this.startCleanupTimer();
    }

    /**
     * Tạo job mới và thêm vào queue
     */
    createJob(instance: string, params: SolverParams): string {
        if (this.queue.length >= this.maxQueueSize) {
            throw new Error('Queue is full. Please try again later.');
        }

        const jobId = uuidv4();
        const job: Job = {
            id: jobId,
            instance,
            params,
            status: 'pending',
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            result: null,
            error: null,
            progress: 0,
            queuePosition: this.queue.length + 1
        };

        this.jobs.set(jobId, job);
        this.queue.push(jobId);

        console.log(`[JobQueue] Job ${jobId} created, position: ${job.queuePosition}`);
        
        this.emit('jobCreated', job);
        this.processNext();

        return jobId;
    }

    /**
     * Lấy thông tin job
     */
    getJob(jobId: string): Job | null {
        const job = this.jobs.get(jobId);
        if (!job) {
            return null;
        }

        if (job.status === 'pending') {
            job.queuePosition = this.queue.indexOf(jobId) + 1;
        }

        return job;
    }

    /**
     * Lấy tất cả jobs
     */
    getAllJobs(): Job[] {
        return Array.from(this.jobs.values());
    }

    /**
     * Lấy thống kê queue
     */
    getStats(): JobQueueStats {
        const jobs = Array.from(this.jobs.values());
        return {
            total: jobs.length,
            pending: jobs.filter(j => j.status === 'pending').length,
            processing: jobs.filter(j => j.status === 'processing').length,
            completed: jobs.filter(j => j.status === 'completed').length,
            failed: jobs.filter(j => j.status === 'failed').length,
            queueLength: this.queue.length,
            currentJobId: this.currentJobId
        };
    }

    /**
     * Xử lý job tiếp theo trong queue
     */
    private async processNext(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;
        const jobId = this.queue.shift();
        if (!jobId) {
            this.processing = false;
            return;
        }

        const job = this.jobs.get(jobId);
        if (!job) {
            this.processing = false;
            return this.processNext();
        }

        this.currentJobId = jobId;
        job.status = 'processing';
        job.startedAt = Date.now();
        job.queuePosition = 0;

        console.log(`[JobQueue] Processing job ${jobId}`);
        this.emit('jobStarted', job);

        const timeout = setTimeout(() => {
            this.failJob(jobId, 'Job timeout exceeded');
        }, this.jobTimeout);

        try {
            this.emit('processJob', job, {
                onComplete: (result) => {
                    clearTimeout(timeout);
                    this.completeJob(jobId, result);
                },
                onFail: (error) => {
                    clearTimeout(timeout);
                    this.failJob(jobId, error);
                },
                onProgress: (progress) => {
                    this.updateProgress(jobId, progress);
                }
            } as JobCallbacks);
        } catch (error) {
            clearTimeout(timeout);
            this.failJob(jobId, error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Đánh dấu job hoàn thành
     */
    completeJob(jobId: string, result: any): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'completed';
        job.completedAt = Date.now();
        job.result = result;
        job.progress = 100;

        const duration = job.startedAt ? ((job.completedAt - job.startedAt) / 1000).toFixed(2) : '0';
        console.log(`[JobQueue] Job ${jobId} completed in ${duration}s`);

        this.emit('jobCompleted', job);
        
        this.processing = false;
        this.currentJobId = null;
        this.processNext();
    }

    /**
     * Đánh dấu job thất bại
     */
    failJob(jobId: string, error: string): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.status = 'failed';
        job.completedAt = Date.now();
        job.error = error;

        console.error(`[JobQueue] Job ${jobId} failed: ${job.error}`);

        this.emit('jobFailed', job);
        
        this.processing = false;
        this.currentJobId = null;
        this.processNext();
    }

    /**
     * Cập nhật tiến trình job
     */
    updateProgress(jobId: string, progress: number): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.progress = progress;
        this.emit('jobProgress', job);
    }

    /**
     * Hủy job
     */
    cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }

        if (job.status === 'processing') {
            return false;
        }

        if (job.status === 'pending') {
            const index = this.queue.indexOf(jobId);
            if (index > -1) {
                this.queue.splice(index, 1);
            }
        }

        job.status = 'cancelled';
        job.completedAt = Date.now();

        console.log(`[JobQueue] Job ${jobId} cancelled`);
        this.emit('jobCancelled', job);

        return true;
    }

    /**
     * Xóa job
     */
    deleteJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job) return false;

        if (job.status === 'processing') {
            return false;
        }

        if (job.status === 'pending') {
            const index = this.queue.indexOf(jobId);
            if (index > -1) {
                this.queue.splice(index, 1);
            }
        }

        this.jobs.delete(jobId);
        console.log(`[JobQueue] Job ${jobId} deleted`);
        return true;
    }

    /**
     * Dọn dẹp các job cũ
     */
    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [jobId, job] of this.jobs.entries()) {
            if (
                (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
                job.completedAt &&
                now - job.completedAt > this.maxJobAge
            ) {
                this.jobs.delete(jobId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[JobQueue] Cleaned up ${cleaned} old jobs`);
        }
    }

    /**
     * Start cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Stop cleanup timer
     */
    private stopCleanupTimer(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }

    /**
     * Shutdown queue
     */
    shutdown(): void {
        this.stopCleanupTimer();
        this.removeAllListeners();
        console.log('[JobQueue] Shutdown complete');
    }
}
