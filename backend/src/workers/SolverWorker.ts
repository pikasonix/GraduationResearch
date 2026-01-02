import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Job, SolverParams, SolverWorkerOptions, JobCallbacks } from '../types';

/**
 * PDPTW Solver Worker
 * Xử lý việc chạy pdptw_solver.exe và trả về kết quả
 */
export class SolverWorker {
    private solverPath: string;
    private baseWorkDir: string;
    private maxBuffer: number;
    private runningProcesses: Map<string, ChildProcess>;

    constructor(solverPath: string, options: SolverWorkerOptions = {}) {
        this.solverPath = solverPath;
        // Use backend/storage folder for temp files
        this.baseWorkDir = options.baseWorkDir || path.resolve(__dirname, '../../storage/temp');
        this.maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB
        this.runningProcesses = new Map();

        try {
            fs.mkdirSync(this.baseWorkDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create work directory:', err);
        }
    }

    /**
     * Xử lý job solver
     */
    async solve(job: Job, callbacks: JobCallbacks): Promise<void> {
        const { onComplete, onFail, onProgress } = callbacks;
        const { instance, params } = job;

        let workDir = '';

        try {
            workDir = fs.mkdtempSync(path.join(this.baseWorkDir, `job-${job.id}-`));
            console.log(`[SolverWorker] Job ${job.id}: Work dir created at ${workDir}`);

            const instancePath = path.join(workDir, 'instance.txt');
            fs.writeFileSync(instancePath, instance, 'utf8');

            const solutionsDir = path.join(workDir, 'solutions');
            fs.mkdirSync(solutionsDir, { recursive: true });

            const args = this.buildArguments(instancePath, solutionsDir, params);

            console.log(`[SolverWorker] Job ${job.id}: Running solver with args:`, args.join(' '));

            onProgress(10);

            const result = await this.executeSolver(job.id, args, workDir, (progress) => {
                onProgress(10 + progress * 0.8);
            });

            onProgress(90);

            const solutionContent = this.readSolution(solutionsDir);

            onProgress(100);

            console.log(`[SolverWorker] Job ${job.id}: Completed successfully`);

            this.cleanup(workDir);

            onComplete({
                solution: solutionContent.content,
                filename: solutionContent.filename,
                stdout: result.stdout,
                workDir: workDir
            });

        } catch (error) {
            console.error(`[SolverWorker] Job ${job.id}: Error:`, error instanceof Error ? error.message : String(error));

            // DEBUG: Don't cleanup on failure to inspect instance file
            if (workDir) {
                console.log(`[SolverWorker] DEBUG: Keeping work dir for inspection: ${workDir}`);
                // this.cleanup(workDir);
            }

            onFail(error instanceof Error ? error.message : String(error));
        }
    }

    /**
     * Attempt to cancel a running solver process for a job.
     */
    cancel(jobId: string): boolean {
        const child = this.runningProcesses.get(jobId);
        if (!child) return false;

        try {
            // Try graceful termination first.
            child.kill();
            // If still alive shortly after, force kill.
            setTimeout(() => {
                const stillRunning = this.runningProcesses.get(jobId);
                if (stillRunning && !stillRunning.killed) {
                    try {
                        stillRunning.kill('SIGKILL');
                    } catch {
                        // Ignore; Windows may not support SIGKILL.
                        try {
                            stillRunning.kill();
                        } catch {
                            // ignore
                        }
                    }
                }
            }, 1000);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Build command line arguments
     */
    private buildArguments(instancePath: string, solutionsDir: string, params: SolverParams): string[] {
        const args: string[] = [
            '-i', instancePath,
            '-o', solutionsDir
        ];

        // LNS parameters
        if (params.iterations !== undefined) {
            args.push('--iterations', String(params.iterations));
        }
        if (params.max_non_improving !== undefined) {
            args.push('--max-non-improving', String(params.max_non_improving));
        }
        if (params.time_limit !== undefined) {
            args.push('--time-limit', String(params.time_limit));
        }
        if (params.min_destroy !== undefined) {
            args.push('--min-destroy', String(params.min_destroy));
        }
        if (params.max_destroy !== undefined) {
            args.push('--max-destroy', String(params.max_destroy));
        }
        if (params.min_destroy_count !== undefined && params.min_destroy_count >= 0) {
            args.push('--min-destroy-count', String(params.min_destroy_count));
        }
        if (params.max_destroy_count !== undefined && params.max_destroy_count >= 0) {
            args.push('--max-destroy-count', String(params.max_destroy_count));
        }
        if (params.acceptance) {
            args.push('--acceptance', params.acceptance);
        }

        // General configuration
        if (params.seed !== undefined) {
            args.push('--seed', String(params.seed));
        }
        if (params.max_vehicles !== undefined && params.max_vehicles > 0) {
            args.push('--max-vehicles', String(params.max_vehicles));
        }
        if (params.log_level) {
            args.push('--log-level', params.log_level);
        }
        if (params.authors) {
            args.push('--authors', params.authors);
        }
        if (params.reference) {
            args.push('--reference', params.reference);
        }

        // Instance format
        if (params.format) {
            args.push('--format', params.format);
        }

        return args;
    }

    /**
     * Execute solver
     */
    private executeSolver(jobId: string, args: string[], workDir: string, onProgress: (progress: number) => void): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const child = spawn(this.solverPath, args, {
                cwd: workDir
            });

            this.runningProcesses.set(jobId, child);

            if (child.stdout) {
                child.stdout.on('data', (data: Buffer) => {
                    const output = data.toString();
                    stdout += output;
                    
                    // Check buffer size limit
                    if (stdout.length > this.maxBuffer) {
                        child.kill();
                        reject(new Error(`Output exceeded maximum buffer size (${this.maxBuffer} bytes)`));
                        return;
                    }
                    
                    const match = output.match(/Progress:\s*(\d+)%/);
                    if (match) {
                        const progress = parseInt(match[1], 10);
                        onProgress(progress / 100);
                    }
                });
            }

            if (child.stderr) {
                child.stderr.on('data', (data: Buffer) => {
                    stderr += data.toString();
                    
                    // Check buffer size limit
                    if (stderr.length > this.maxBuffer) {
                        child.kill();
                        reject(new Error(`Error output exceeded maximum buffer size (${this.maxBuffer} bytes)`));
                        return;
                    }
                });
            }

            child.on('error', (error) => {
                reject(new Error(`Failed to start solver: ${error.message}`));
            });

            child.on('close', (code, signal) => {
                this.runningProcesses.delete(jobId);
                if (code !== 0) {
                    const details = [
                        `Solver failed${code !== null ? ` (code: ${code})` : ''}${signal ? ` (signal: ${signal})` : ''}`,
                        `Command: ${this.solverPath} ${args.join(' ')}`,
                        stdout ? `--- stdout ---\n${stdout}` : '',
                        stderr ? `--- stderr ---\n${stderr}` : '',
                    ].filter(Boolean).join('\n\n');

                    reject(new Error(details));
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }

    /**
     * Read solution file from solutions directory
     */
    private readSolution(solutionsDir: string): { content: string; filename: string } {
        const files = fs.readdirSync(solutionsDir);

        if (files.length === 0) {
            throw new Error('No solution file generated');
        }

        const filename = files[0];
        const solutionPath = path.join(solutionsDir, filename);
        const content = fs.readFileSync(solutionPath, 'utf8');

        return { content, filename };
    }

    /**
     * Cleanup work directory
     */
    private cleanup(workDir: string): void {
        if (!workDir) return;

        try {
            fs.rmSync(workDir, { recursive: true, force: true });
            console.log(`[SolverWorker] Cleaned up ${workDir}`);
        } catch (err) {
            console.warn(`[SolverWorker] Failed to cleanup ${workDir}:`, err instanceof Error ? err.message : String(err));
        }
    }

    /**
     * Validate solver executable
     */
    static validateSolver(solverPath: string): boolean {
        if (!fs.existsSync(solverPath)) {
            throw new Error(`Solver executable not found: ${solverPath}`);
        }

        const stat = fs.statSync(solverPath);
        if (!stat.isFile()) {
            throw new Error(`Solver path is not a file: ${solverPath}`);
        }

        return true;
    }
}
