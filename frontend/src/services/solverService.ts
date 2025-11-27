/**
 * Service for interacting with the PDPTW Solver backend API
 * Handles job submission and polling for results
 */

import config from '@/config/config';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface SolverParams {
    // LNS parameters
    iterations?: number;
    max_non_improving?: number;
    time_limit?: number;
    min_destroy?: number;
    max_destroy?: number;
    min_destroy_count?: number;
    max_destroy_count?: number;
    acceptance?: 'sa' | 'rtr' | 'greedy';
    
    // General configuration
    seed?: number;
    max_vehicles?: number;
    log_level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    authors?: string;
    reference?: string;
    
    // Instance format
    format?: 'lilim' | 'sartori';
}

export interface Job {
    jobId: string;
    status: JobStatus;
    progress: number;
    result?: string;
    error?: string;
    cost?: number;
    createdAt: string;
    completedAt?: string;
}

export interface SubmitJobResponse {
    jobId: string;
    status: JobStatus;
}

export interface JobProgressCallback {
    (job: Job): void;
}

class SolverService {
    private baseURL: string;

    constructor() {
        this.baseURL = `${config.api.baseURL}${config.api.basePath}`;
    }

    /**
     * Submit a new solver job
     */
    async submitJob(instance: string, params: SolverParams = {}): Promise<string> {
        const response = await fetch(`${this.baseURL}/jobs/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance, params }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to submit job: ${response.status}`);
        }

        const data: SubmitJobResponse = await response.json();
        return data.jobId;
    }

    /**
     * Get job status and result
     */
    async getJob(jobId: string): Promise<Job> {
        const response = await fetch(`${this.baseURL}/jobs/${jobId}`);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get job: ${response.status}`);
        }

        const data = await response.json();
        
        // Backend returns { success: true, job: {...} }
        // Extract the job object
        const job = data.job || data;
        
        return {
            jobId: job.id,
            status: job.status,
            progress: job.progress || 0,
            result: job.result?.solution,
            error: job.error,
            cost: job.result?.cost,
            createdAt: job.createdAt,
            completedAt: job.completedAt
        };
    }

    /**
     * Poll job status until completion
     * @param jobId Job ID to poll
     * @param onProgress Callback for progress updates
     * @param pollInterval Polling interval in milliseconds (default: 1000)
     * @param timeout Maximum polling time in milliseconds (default: 600000 = 10 minutes)
     * @returns Final job result
     */
    async pollJob(
        jobId: string,
        onProgress?: JobProgressCallback,
        pollInterval: number = 1000,
        timeout: number = 600000
    ): Promise<Job> {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    // Check timeout
                    if (Date.now() - startTime > timeout) {
                        reject(new Error('Polling timeout: Job took too long to complete'));
                        return;
                    }

                    const job = await this.getJob(jobId);
                    
                    // Call progress callback
                    if (onProgress) {
                        onProgress(job);
                    }

                    // Check if job is complete
                    if (job.status === 'completed') {
                        resolve(job);
                        return;
                    }

                    if (job.status === 'failed') {
                        reject(new Error(job.error || 'Job failed'));
                        return;
                    }

                    if (job.status === 'cancelled') {
                        reject(new Error('Job was cancelled'));
                        return;
                    }

                    // Continue polling
                    setTimeout(poll, pollInterval);
                } catch (error) {
                    reject(error);
                }
            };

            poll();
        });
    }

    /**
     * Submit and wait for job completion (convenience method)
     */
    async solveInstance(
        instance: string,
        params: SolverParams = {},
        onProgress?: JobProgressCallback
    ): Promise<string> {
        console.log('Submitting solver job...');
        const jobId = await this.submitJob(instance, params);
        console.log('Job submitted with ID:', jobId);

        const job = await this.pollJob(jobId, onProgress);
        
        if (!job.result) {
            throw new Error('Job completed but no result returned');
        }

        return job.result;
    }

    /**
     * Cancel a job
     */
    async cancelJob(jobId: string): Promise<void> {
        const response = await fetch(`${this.baseURL}/jobs/${jobId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to cancel job: ${response.status}`);
        }
    }

    /**
     * Get queue statistics
     */
    async getStats(): Promise<any> {
        const response = await fetch(`${this.baseURL}/jobs/stats`);

        if (!response.ok) {
            throw new Error(`Failed to get stats: ${response.status}`);
        }

        return await response.json();
    }
}

export const solverService = new SolverService();
export default solverService;
