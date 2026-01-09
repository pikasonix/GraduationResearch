import { Router, Request, Response } from 'express';
import { JobQueue } from '../queue/JobQueue';
import { SolverParams } from '../types';
import { createSupabaseAdminClient, isSupabaseEnabled } from '../supabaseAdmin';
import { preprocessReoptimization } from '../workers/reoptimizationPreprocessor';
import { validateGhostPickups } from '../workers/dummyNodeCleaner';
import type { ReoptimizationContext } from '../types/reoptimization';

interface SubmitJobRequest {
    instance: string;
    params: SolverParams;
    organizationId?: string;
    createdBy?: string;
    inputData?: unknown;
}

interface ReoptimizeJobRequest {
    reoptimizationContext: ReoptimizationContext;
    params: SolverParams;
    createdBy?: string;
}

/**
 * Setup job routes
 */
export function setupJobRoutes(jobQueue: JobQueue): Router {
    const router = Router();

    const supabase = isSupabaseEnabled() ? createSupabaseAdminClient() : null;
    
    /**
     * POST /api/jobs/submit
     * Submit a new job to the queue
     */
    router.post('/submit', async (req: Request<{}, {}, SubmitJobRequest>, res: Response): Promise<void> => {
        try {
            const { instance, params, organizationId, createdBy, inputData } = req.body;

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

            const jobId = jobQueue.createJob(instance, params, {
                organizationId,
                createdBy,
                inputData,
            });

            if (supabase && organizationId && createdBy) {
                const { error } = await supabase
                    .from('optimization_jobs')
                    .insert({
                        id: jobId,
                        organization_id: organizationId,
                        created_by: createdBy,
                        status: 'queued',
                        input_data: inputData ?? null,
                        config_params: params ?? null,
                    });
                if (error) {
                    console.warn('[jobRoutes] Failed to persist optimization_jobs:', error.message);
                }
            }

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

            // If job is pending or processing, treat DELETE as a cancel request.
            if (job.status === 'pending' || job.status === 'processing') {
                const cancelled = jobQueue.cancelJob(jobId);
                if (cancelled) {
                    res.json({
                        success: true,
                        message: 'Job cancelled successfully'
                    });
                } else {
                    res.status(400).json({
                        success: false,
                        error: 'Failed to cancel job'
                    });
                }
                return;
            }

            // Otherwise, allow deletion of finished jobs.
            const deleted = jobQueue.deleteJob(jobId);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Job deleted successfully'
                });
                return;
            }

            res.status(400).json({
                success: false,
                error: 'Failed to delete job'
            });

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
     * POST /api/jobs/reoptimize
     * Submit a reoptimization job with vehicle states and order deltas
     */
    router.post('/reoptimize', async (req: Request<{}, {}, ReoptimizeJobRequest>, res: Response): Promise<void> => {
        try {
            const { reoptimizationContext, params, createdBy } = req.body;

            if (!reoptimizationContext || !params) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: reoptimizationContext and params'
                });
                return;
            }

            const { organization_id, vehicle_states, order_delta, previous_solution_id } = reoptimizationContext;
            
            console.log(`[reoptimize] Request context: organization=${organization_id}, previous_solution_id=${previous_solution_id || 'NONE'}, vehicles=${vehicle_states.length}, new_orders=${order_delta.new_order_ids.length}`);

            if (!organization_id || !vehicle_states || !order_delta) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid reoptimizationContext: missing organization_id, vehicle_states, or order_delta'
                });
                return;
            }

            // Fetch required data from database
            if (!supabase) {
                res.status(503).json({
                    success: false,
                    error: 'Database not configured. Reoptimization requires Supabase.'
                });
                return;
            }

            // Fetch depot for organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .select('name, depot_address, depot_latitude, depot_longitude')
                .eq('id', organization_id)
                .single();

            if (orgError || !org) {
                res.status(404).json({
                    success: false,
                    error: 'Organization not found or missing depot information'
                });
                return;
            }

            const depot = {
                name: org.name,
                address: org.depot_address || '',
                latitude: org.depot_latitude,
                longitude: org.depot_longitude,
            };

            // Fetch active orders only if reoptimizing from previous solution
            // For fresh routing (no previous_solution_id), active orders should be empty
            let activeOrders: any[] = [];
            
            if (previous_solution_id) {
                console.log(`[reoptimize] Fetching orders from previous solution: ${previous_solution_id}`);
                
                // First, get order IDs from the previous solution's route_stops
                const { data: solutionStops, error: stopsError } = await supabase
                    .from('route_stops')
                    .select('order_id, routes!inner(solution_id)')
                    .eq('routes.solution_id', previous_solution_id)
                    .not('order_id', 'is', null);
                
                if (stopsError) {
                    console.warn(`[reoptimize] Failed to fetch solution stops: ${stopsError.message}, falling back to empty active orders`);
                } else if (solutionStops && solutionStops.length > 0) {
                    // Get unique order IDs from the solution
                    const solutionOrderIds = [...new Set(solutionStops.map(s => s.order_id).filter(Boolean))];
                    console.log(`[reoptimize] Found ${solutionOrderIds.length} orders in previous solution`);
                    
                    // Fetch those specific orders (excluding cancelled and new orders)
                    let activeOrdersQuery = supabase
                        .from('orders')
                        .select('*, pickup_location:locations!pickup_location_id(latitude, longitude), delivery_location:locations!delivery_location_id(latitude, longitude)')
                        .in('id', solutionOrderIds)
                        .in('status', ['pending', 'assigned', 'in_transit', 'picked_up']);
                    
                    // Exclude cancelled orders if any
                    if (order_delta.cancelled_order_ids.length > 0) {
                        activeOrdersQuery = activeOrdersQuery.not('id', 'in', `(${order_delta.cancelled_order_ids.join(',')})`);
                    }
                    
                    // Exclude new orders to prevent duplication
                    if (order_delta.new_order_ids.length > 0) {
                        activeOrdersQuery = activeOrdersQuery.not('id', 'in', `(${order_delta.new_order_ids.join(',')})`);
                    }

                    const { data: fetchedActiveOrders, error: activeOrdersError } = await activeOrdersQuery;

                    if (activeOrdersError) {
                        res.status(500).json({
                            success: false,
                            error: `Failed to fetch active orders: ${activeOrdersError.message}`
                        });
                        return;
                    }
                    
                    activeOrders = fetchedActiveOrders || [];
                } else {
                    console.log(`[reoptimize] No orders found in previous solution ${previous_solution_id}`);
                }
            } else {
                // No previous solution - treating as fresh routing with only new orders
                console.log('[reoptimize] No previous_solution_id provided, treating as fresh routing');
            }

            // Fetch new orders
            const { data: newOrders, error: newOrdersError } = order_delta.new_order_ids.length > 0
                ? await supabase
                    .from('orders')
                    .select('*, pickup_location:locations!pickup_location_id(latitude, longitude), delivery_location:locations!delivery_location_id(latitude, longitude)')
                    .in('id', order_delta.new_order_ids)
                : { data: [], error: null };

            if (newOrdersError) {
                res.status(500).json({
                    success: false,
                    error: `Failed to fetch new orders: ${newOrdersError.message}`
                });
                return;
            }
            
            console.log(`[reoptimize] Fetched ${activeOrders.length} active orders, ${newOrders?.length || 0} new orders`);
            console.log(`[reoptimize] New order IDs:`, order_delta.new_order_ids.slice(0, 5), order_delta.new_order_ids.length > 5 ? '...' : '');

            // Fetch vehicles
            const vehicleIds = vehicle_states.map(vs => vs.vehicle_id);
            const { data: vehicles, error: vehiclesError } = await supabase
                .from('vehicles')
                .select('id, license_plate, capacity_weight, capacity_volume')
                .in('id', vehicleIds);

            if (vehiclesError) {
                res.status(500).json({
                    success: false,
                    error: `Failed to fetch vehicles: ${vehiclesError.message}`
                });
                return;
            }

            // Transform orders to expected format
            // Use coordinates directly from orders table (pickup_latitude, delivery_latitude, etc.)
            // instead of from locations table, as order-specific coords may differ from location defaults
            const transformOrder = (o: any) => ({
                id: o.id,
                pickup_location_id: o.pickup_location_id,
                delivery_location_id: o.delivery_location_id,
                pickup_lat: o.pickup_latitude || o.pickup_location?.latitude || 0,
                pickup_lng: o.pickup_longitude || o.pickup_location?.longitude || 0,
                delivery_lat: o.delivery_latitude || o.delivery_location?.latitude || 0,
                delivery_lng: o.delivery_longitude || o.delivery_location?.longitude || 0,
                demand_weight: o.weight || o.demand_weight || 1,
                demand_volume: o.volume || o.demand_volume,
                pickup_time_window_start: o.pickup_time_start || o.pickup_time_window_start,
                pickup_time_window_end: o.pickup_time_end || o.pickup_time_window_end,
                delivery_time_window_start: o.delivery_time_start || o.delivery_time_window_start,
                delivery_time_window_end: o.delivery_time_end || o.delivery_time_window_end,
                service_time_pickup: o.service_time_pickup || 5,
                service_time_delivery: o.service_time_delivery || 5,
            });

            const allActiveOrders = (activeOrders || []).map(transformOrder);
            const allNewOrders = (newOrders || []).map(transformOrder);

            // Validation: Check for unexpected order counts
            const totalOrders = allActiveOrders.length + allNewOrders.length;
            const expectedNewOrders = order_delta.new_order_ids.length;
            
            if (allNewOrders.length !== expectedNewOrders) {
                console.warn(`[reoptimize] WARNING: Requested ${expectedNewOrders} new orders, but fetched ${allNewOrders.length}`);
            }
            
            // Calculate expected node count for validation
            const expectedNodes = 1 + (vehicle_states.length * 2) + (totalOrders * 2); // depot + dummies + order nodes
            console.log(`[reoptimize] Expected ~${expectedNodes} nodes for ${totalOrders} orders and ${vehicle_states.length} vehicles`);

            // Run preprocessing
            console.log(`[reoptimize] Preprocessing for org ${organization_id}: ${vehicle_states.length} vehicles, ${allActiveOrders.length} active orders, ${allNewOrders.length} new orders`);

            const augmented = await preprocessReoptimization({
                context: reoptimizationContext,
                depot,
                active_orders: allActiveOrders,
                new_orders: allNewOrders,
                vehicles: vehicles || [],
                current_timestamp: new Date(),
                end_of_shift: undefined, // TODO: Get from dispatch_settings or request
            });

            // Validate ghost pickups
            const validation = validateGhostPickups(augmented.dummy_nodes, augmented.mapping_ids);
            if (!validation.valid) {
                res.status(400).json({
                    success: false,
                    error: `Ghost pickup validation failed: ${validation.errors.join('; ')}`
                });
                return;
            }

            console.log(`[reoptimize] Generated instance with ${augmented.mapping_ids.length} nodes, ${augmented.dummy_nodes.length} dummy nodes`);

            // Submit job with augmented instance
            const jobId = jobQueue.createJob(augmented.instance_text, params, {
                organizationId: organization_id,
                createdBy,
                inputData: {
                    mapping_ids: augmented.mapping_ids,
                    dummy_nodes: augmented.dummy_nodes,
                    vehicle_capacity_dimensions: Object.fromEntries(augmented.vehicle_capacity_dimensions),
                    initial_routes: augmented.initial_routes,
                    is_reoptimization: true,
                    previous_solution_id: reoptimizationContext.previous_solution_id,
                },
            });

            // Persist optimization job
            const { error: jobInsertError } = await supabase
                .from('optimization_jobs')
                .insert({
                    id: jobId,
                    organization_id: organization_id,
                    created_by: createdBy,
                    status: 'queued',
                    input_data: {
                        reoptimization: true,
                        previous_solution_id: reoptimizationContext.previous_solution_id,
                        vehicle_count: vehicle_states.length,
                        order_count: allActiveOrders.length + allNewOrders.length,
                    },
                    config_params: params,
                });

            if (jobInsertError) {
                console.warn('[reoptimize] Failed to persist optimization_jobs:', jobInsertError.message);
            }

            res.json({
                success: true,
                jobId,
                message: 'Reoptimization job submitted successfully',
                preprocessing_stats: {
                    total_nodes: augmented.mapping_ids.length,
                    dummy_nodes: augmented.dummy_nodes.filter(d => d.node_type === 'dummy_start').length,
                    ghost_pickups: augmented.dummy_nodes.filter(d => d.node_type === 'ghost_pickup').length,
                    active_vehicles: vehicle_states.length,
                }
            });

        } catch (error) {
            console.error('Error submitting reoptimization job:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });

    /**
     * POST /api/jobs/reoptimize-native
     * Submit a reoptimization job using native Rust dynamic mode
     * This uses the solver's built-in dynamic re-optimization instead of preprocessing
     */
    router.post('/reoptimize-native', async (req: Request, res: Response): Promise<void> => {
        try {
            const { 
                instance,
                vehicle_states,
                new_requests,
                params = {},
                organizationId,
                createdBy 
            } = req.body;

            if (!instance) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required field: instance'
                });
                return;
            }

            // Build dynamic params
            const dynamicParams: SolverParams = {
                ...params,
                dynamic: true,
                vehicle_states: vehicle_states || [],
                new_requests: new_requests || [],
            };

            // Set reasonable defaults for dynamic mode
            if (dynamicParams.time_limit === undefined) {
                dynamicParams.time_limit = 30; // 30 seconds default for dynamic
            }
            if (dynamicParams.late_penalty === undefined) {
                dynamicParams.late_penalty = 1000;
            }
            if (dynamicParams.unassigned_penalty === undefined) {
                dynamicParams.unassigned_penalty = 10000;
            }

            console.log(`[reoptimize-native] Submitting dynamic job: ${vehicle_states?.length || 0} vehicles, ${new_requests?.length || 0} new requests`);

            const jobId = jobQueue.createJob(instance, dynamicParams, {
                organizationId,
                createdBy,
                inputData: {
                    is_dynamic_reoptimization: true,
                    vehicle_count: vehicle_states?.length || 0,
                    new_request_count: new_requests?.length || 0,
                },
            });

            // Persist to database if available
            if (supabase && organizationId) {
                const { error: jobInsertError } = await supabase
                    .from('optimization_jobs')
                    .insert({
                        id: jobId,
                        organization_id: organizationId,
                        created_by: createdBy,
                        status: 'queued',
                        input_data: {
                            dynamic_reoptimization: true,
                            vehicle_count: vehicle_states?.length || 0,
                            new_request_count: new_requests?.length || 0,
                        },
                        config_params: params,
                    });

                if (jobInsertError) {
                    console.warn('[reoptimize-native] Failed to persist optimization_jobs:', jobInsertError.message);
                }
            }

            res.json({
                success: true,
                jobId,
                message: 'Native dynamic reoptimization job submitted',
                dynamic_mode: true,
            });

        } catch (error) {
            console.error('Error submitting native reoptimization job:', error);
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
