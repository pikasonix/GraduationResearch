export interface SolverParams {
    // LNS parameters
    iterations?: number;                    // --iterations (default: 100000)
    max_non_improving?: number;             // --max-non-improving (default: 20000)
    time_limit?: number;                    // --time-limit (default: 0.0 - no limit)
    min_destroy?: number;                   // --min-destroy (default: 0.1)
    max_destroy?: number;                   // --max-destroy (default: 0.4)
    min_destroy_count?: number;             // --min-destroy-count (default: -1)
    max_destroy_count?: number;             // --max-destroy-count (default: -1)
    acceptance?: 'sa' | 'rtr' | 'greedy';   // --acceptance (default: rtr)
    
    // General configuration
    seed?: number;                          // --seed (default: 42)
    max_vehicles?: number;                  // --max-vehicles (default: 0 - use max from instance)
    log_level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';  // --log-level (default: info)
    authors?: string;                       // --authors (default: "PDPTW Solver")
    reference?: string;                     // --reference (default: "LNS with SA/RTR")
    
    // Instance format
    format?: 'lilim' | 'sartori';           // --format (default: lilim)
}

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Job {
    id: string;
    instance: string;
    params: SolverParams;
    organizationId?: string;
    createdBy?: string;
    inputData?: unknown;
    status: JobStatus;
    createdAt: number;
    startedAt: number | null;
    completedAt: number | null;
    result: SolutionResult | null;
    error: string | null;
    progress: number;
    queuePosition: number;
}

export interface SolutionResult {
    solution: string;
    filename: string;
    stdout: string;
    workDir: string;
    persisted?: boolean;
    solutionId?: string;
}

export interface JobQueueStats {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    queueLength: number;
    currentJobId: string | null;
}

export interface JobQueueOptions {
    maxQueueSize?: number;
    jobTimeout?: number;
    cleanupInterval?: number;
    maxJobAge?: number;
}

export interface SolverWorkerOptions {
    baseWorkDir?: string;
    maxBuffer?: number;
}

export interface JobCallbacks {
    onComplete: (result: SolutionResult) => void;
    onFail: (error: string) => void;
    onProgress: (progress: number) => void;
}
