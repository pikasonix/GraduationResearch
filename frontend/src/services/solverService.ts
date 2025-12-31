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

export interface VehicleState {
    vehicle_id: string;
    lat: number;
    lng: number;
    bearing?: number;
    last_stop_location_id?: string;
    last_stop_time?: string;
    picked_order_ids: string[];
}

export interface ReoptimizationContext {
    previous_solution_id?: string;
    vehicle_states: VehicleState[];
    order_delta: {
        new_order_ids: string[];
        cancelled_order_ids: string[];
    };
    organization_id: string;
    require_depot_return?: boolean;
    end_of_shift?: string;
}

export interface Job {
    jobId: string;
    status: JobStatus;
    progress: number;
    result?: string;
    solutionId?: string;
    persisted?: boolean;
    error?: string;
    cost?: number;
    createdAt: string;
    completedAt?: string;
}

export interface SubmitJobResponse {
    jobId: string;
    status: JobStatus;
}

export interface ReoptimizeJobResponse {
    jobId: string;
    status: JobStatus;
    preprocessing_stats?: {
        total_nodes: number;
        dummy_nodes: number;
        ghost_pickups: number;
        active_vehicles: number;
    };
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
    async submitJob(instance: string, params: SolverParams = {}, meta?: { organizationId?: string; createdBy?: string; inputData?: unknown }): Promise<string> {
        const response = await fetch(`${this.baseURL}/jobs/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instance, params, ...meta }),
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
            solutionId: job.result?.solutionId,
            persisted: job.result?.persisted,
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
     * @param timeout Maximum polling time in milliseconds (default: 3900000 = 65 minutes)
     * @returns Final job result
     */
    async pollJob(
        jobId: string,
        onProgress?: JobProgressCallback,
        pollInterval: number = 1000,
        timeout: number = 65 * 60 * 1000
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
        onProgress?: JobProgressCallback,
        meta?: { organizationId?: string; createdBy?: string; inputData?: unknown }
    ): Promise<{ solutionText: string; solutionId?: string; persisted?: boolean }> {
        console.log('Submitting solver job...');
        const jobId = await this.submitJob(instance, params, meta);
        console.log('Job submitted with ID:', jobId);

        const job = await this.pollJob(jobId, onProgress);
        
        if (!job.result) {
            throw new Error('Job completed but no result returned');
        }

        return { solutionText: job.result, solutionId: job.solutionId, persisted: job.persisted };
    }

    /**
     * Submit a reoptimization job with vehicle states and order deltas
     */
    async submitReoptimizationJob(
        reoptimizationContext: ReoptimizationContext,
        params: SolverParams = {},
        createdBy?: string
    ): Promise<string> {
        const response = await fetch(`${this.baseURL}/jobs/reoptimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reoptimizationContext,
                params,
                createdBy,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to submit reoptimization job: ${response.status}`);
        }

        const data: ReoptimizeJobResponse = await response.json();
        
        if (data.preprocessing_stats) {
            console.log('[Reoptimization] Preprocessing stats:', data.preprocessing_stats);
        }
        
        return data.jobId;
    }

    /**
     * Submit and wait for reoptimization job completion (convenience method)
     */
    async reoptimizeRoutes(
        reoptimizationContext: ReoptimizationContext,
        params: SolverParams = {},
        onProgress?: JobProgressCallback,
        createdBy?: string
    ): Promise<{ solutionText: string; solutionId?: string; persisted?: boolean }> {
        console.log('[Reoptimization] Submitting reoptimization job...');
        const jobId = await this.submitReoptimizationJob(reoptimizationContext, params, createdBy);
        console.log('[Reoptimization] Job submitted with ID:', jobId);

        const job = await this.pollJob(jobId, onProgress);
        
        if (!job.result) {
            throw new Error('Reoptimization job completed but no result returned');
        }

        return { solutionText: job.result, solutionId: job.solutionId, persisted: job.persisted };
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
