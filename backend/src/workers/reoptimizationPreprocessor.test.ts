/**
 * Unit Tests for Reoptimization Preprocessing and Dummy Node Cleanup
 * 
 * Tests cover:
 * 1. Dummy Node Generation - Correct vehicle position placement
 * 2. Ghost Pickup Logic - Positive demand for picked orders
 * 3. Zero-Cost Matrix - Depot to dummy nodes distance validation
 * 4. Post-processing - Dummy node removal and metadata extraction
 */

import { describe, it, expect } from '@jest/globals';
import { preprocessReoptimization } from './reoptimizationPreprocessor';
import { cleanDummyNodes, parseSolverOutput, validateGhostPickups } from './dummyNodeCleaner';
import type {
    VehicleState,
    ReoptimizationContext,
    MappingIdExtended,
    DummyNode,
} from '../types/reoptimization';

describe('Reoptimization Preprocessor', () => {
    const mockDepot = {
        name: 'Main Depot',
        address: '123 Main St',
        latitude: 10.762622,
        longitude: 106.660172,
    };

    const mockVehicles = [
        { id: 'vehicle-1', vehicle_code: 'VEH-001', capacity_weight: 100, capacity_volume: 50 },
        { id: 'vehicle-2', vehicle_code: 'VEH-002', capacity_weight: 150, capacity_volume: 75 },
    ];

    const mockOrders = [
        {
            id: 'order-1',
            pickup_location_id: 'loc-1',
            delivery_location_id: 'loc-2',
            pickup_lat: 10.763,
            pickup_lng: 106.661,
            delivery_lat: 10.764,
            delivery_lng: 106.662,
            demand_weight: 20,
            service_time_pickup: 5,
            service_time_delivery: 5,
        },
        {
            id: 'order-2',
            pickup_location_id: 'loc-3',
            delivery_location_id: 'loc-4',
            pickup_lat: 10.765,
            pickup_lng: 106.663,
            delivery_lat: 10.766,
            delivery_lng: 106.664,
            demand_weight: 15,
            service_time_pickup: 5,
            service_time_delivery: 5,
        },
    ];

    describe('Test 1: Dummy Node Generation', () => {
        it('should create dummy start nodes at correct vehicle positions', async () => {
            const vehicleStates: VehicleState[] = [
                {
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    bearing: 90,
                    picked_order_ids: [],
                },
                {
                    vehicle_id: 'vehicle-2',
                    lat: 10.775,
                    lng: 106.675,
                    bearing: 180,
                    picked_order_ids: [],
                },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: mockOrders,
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            // Verify dummy nodes were created
            const dummyStartNodes = result.dummy_nodes.filter(d => d.node_type === 'dummy_start');
            expect(dummyStartNodes).toHaveLength(2);

            // Verify positions
            const vehicle1Dummy = dummyStartNodes.find(d => d.vehicle_id === 'vehicle-1');
            const vehicle2Dummy = dummyStartNodes.find(d => d.vehicle_id === 'vehicle-2');

            expect(vehicle1Dummy).toBeDefined();
            expect(vehicle2Dummy).toBeDefined();

            // Positions should be close to vehicle GPS (may be snapped to road)
            expect(Math.abs(vehicle1Dummy!.lat - 10.770)).toBeLessThan(0.01);
            expect(Math.abs(vehicle1Dummy!.lng - 106.670)).toBeLessThan(0.01);
            expect(Math.abs(vehicle2Dummy!.lat - 10.775)).toBeLessThan(0.01);
            expect(Math.abs(vehicle2Dummy!.lng - 106.675)).toBeLessThan(0.01);

            // Verify mapping_ids includes dummy nodes with correct flags
            const dummyMappings = result.mapping_ids.filter(m => m.kind === 'dummy_start');
            expect(dummyMappings).toHaveLength(2);
            expect(dummyMappings.every(m => m.is_dummy === true)).toBe(true);
            expect(dummyMappings.every(m => m.vehicle_id !== undefined)).toBe(true);

            console.log('✓ Test 1 Passed: Dummy nodes generated at correct vehicle positions');
        });

        it('should assign unique capacity dimensions to prevent vehicle swapping', async () => {
            const vehicleStates: VehicleState[] = [
                { vehicle_id: 'vehicle-1', lat: 10.770, lng: 106.670, picked_order_ids: [] },
                { vehicle_id: 'vehicle-2', lat: 10.775, lng: 106.675, picked_order_ids: [] },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: [],
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            // Verify unique capacity dimensions
            expect(result.vehicle_capacity_dimensions.size).toBe(2);
            
            const dim1 = result.vehicle_capacity_dimensions.get('vehicle-1');
            const dim2 = result.vehicle_capacity_dimensions.get('vehicle-2');
            
            expect(dim1).toBeDefined();
            expect(dim2).toBeDefined();
            expect(dim1).not.toBe(dim2); // Must be different

            console.log('✓ Test 1b Passed: Unique capacity dimensions assigned');
        });
    });

    describe('Test 2: Ghost Pickup Logic', () => {
        it('should create ghost pickup nodes with positive demand for picked orders', async () => {
            const vehicleStates: VehicleState[] = [
                {
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    picked_order_ids: ['order-1'], // Vehicle carrying order-1 (weight: 20)
                },
                {
                    vehicle_id: 'vehicle-2',
                    lat: 10.775,
                    lng: 106.675,
                    picked_order_ids: ['order-2'], // Vehicle carrying order-2 (weight: 15)
                },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: mockOrders,
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            // Verify ghost pickup nodes were created
            const ghostPickups = result.dummy_nodes.filter(d => d.node_type === 'ghost_pickup');
            expect(ghostPickups).toHaveLength(2);

            // Verify demands
            const vehicle1Ghost = ghostPickups.find(g => g.vehicle_id === 'vehicle-1');
            const vehicle2Ghost = ghostPickups.find(g => g.vehicle_id === 'vehicle-2');

            expect(vehicle1Ghost).toBeDefined();
            expect(vehicle2Ghost).toBeDefined();
            expect(vehicle1Ghost!.demand).toBe(20); // order-1 weight
            expect(vehicle2Ghost!.demand).toBe(15); // order-2 weight

            // Verify service time is 0
            expect(vehicle1Ghost!.service_time).toBe(0);
            expect(vehicle2Ghost!.service_time).toBe(0);

            // Verify original_order_ids tracking
            expect(vehicle1Ghost!.original_order_ids).toEqual(['order-1']);
            expect(vehicle2Ghost!.original_order_ids).toEqual(['order-2']);

            console.log('✓ Test 2 Passed: Ghost pickup nodes with correct positive demand');
        });

        it('should not create ghost pickup if vehicle has no picked orders', async () => {
            const vehicleStates: VehicleState[] = [
                {
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    picked_order_ids: [], // Empty vehicle
                },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: mockOrders,
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            const ghostPickups = result.dummy_nodes.filter(d => d.node_type === 'ghost_pickup');
            expect(ghostPickups).toHaveLength(0);

            console.log('✓ Test 2b Passed: No ghost pickup for empty vehicle');
        });
    });

    describe('Test 3: Zero-Cost Matrix (Conceptual)', () => {
        it('should have dummy nodes in mapping_ids after depot', async () => {
            const vehicleStates: VehicleState[] = [
                { vehicle_id: 'vehicle-1', lat: 10.770, lng: 106.670, picked_order_ids: [] },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: [],
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            // Verify structure: Node 0 is depot, then dummy nodes
            expect(result.mapping_ids[0].kind).toBe('depot');
            
            const firstDummyIndex = result.mapping_ids.findIndex(m => m.kind === 'dummy_start');
            expect(firstDummyIndex).toBe(1); // Should be right after depot

            // Note: Actual zero-cost edge implementation would be in distance matrix generation
            // This test verifies the structure is correct for zero-cost edge setup
            console.log('✓ Test 3 Passed: Dummy nodes positioned after depot for zero-cost edges');
        });

        it('should include instance text with dummy nodes as customers', async () => {
            const vehicleStates: VehicleState[] = [
                { vehicle_id: 'vehicle-1', lat: 10.770, lng: 106.670, picked_order_ids: ['order-1'] },
            ];

            const context: ReoptimizationContext = {
                organization_id: 'org-1',
                vehicle_states: vehicleStates,
                order_delta: { new_order_ids: [], cancelled_order_ids: [] },
            };

            const result = await preprocessReoptimization({
                context,
                depot: mockDepot,
                active_orders: mockOrders,
                new_orders: [],
                vehicles: mockVehicles,
                current_timestamp: new Date(),
            });

            // Verify instance text contains dummy nodes
            expect(result.instance_text).toContain('CUSTOMER');
            expect(result.instance_text).toContain('106.670'); // Dummy node lng
            expect(result.instance_text).toContain('10.770'); // Dummy node lat

            console.log('✓ Test 3b Passed: Instance text includes dummy nodes');
        });
    });

    describe('Test 4: Post-processing Cleanup', () => {
        it('should remove dummy and ghost nodes from solver output', () => {
            // Mock mapping_ids with depot, dummy, ghost, and real nodes
            const mappingIds: MappingIdExtended[] = [
                { kind: 'depot', order_id: null, location_id: null, lat: 10.762, lng: 106.660, is_dummy: false },
                { kind: 'dummy_start', order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1' },
                { kind: 'ghost_pickup', order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1', original_order_ids: ['order-1'] },
                { kind: 'pickup', order_id: 'order-2', location_id: 'loc-3', lat: 10.765, lng: 106.663, is_dummy: false },
                { kind: 'delivery', order_id: 'order-1', location_id: 'loc-2', lat: 10.764, lng: 106.662, is_dummy: false },
                { kind: 'delivery', order_id: 'order-2', location_id: 'loc-4', lat: 10.766, lng: 106.664, is_dummy: false },
            ];

            const dummyNodes: DummyNode[] = [
                {
                    node_index: 1,
                    node_type: 'dummy_start',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 0,
                    ready_time: 100,
                    due_time: 500,
                    service_time: 0,
                },
                {
                    node_index: 2,
                    node_type: 'ghost_pickup',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 20,
                    ready_time: 100,
                    due_time: 500,
                    service_time: 0,
                    original_order_ids: ['order-1'],
                },
            ];

            // Mock solver output: Route starts at depot (0), goes through dummy (1), ghost (2), then real stops (3, 4, 5)
            const rawRoutes = [
                { route_number: 1, node_sequence: [0, 1, 2, 3, 4, 5, 0] },
            ];

            const result = cleanDummyNodes(rawRoutes, mappingIds, dummyNodes);

            // Verify dummy nodes removed
            expect(result.removed_dummy_count).toBe(1);
            expect(result.removed_ghost_count).toBe(1);

            // Verify cleaned route
            expect(result.cleaned_routes).toHaveLength(1);
            const cleanedRoute = result.cleaned_routes[0];

            // Should only have real customer stops (nodes 3, 4, 5)
            expect(cleanedRoute.real_stops).toHaveLength(3);
            expect(cleanedRoute.real_stops[0].node_index).toBe(3);
            expect(cleanedRoute.real_stops[1].node_index).toBe(4);
            expect(cleanedRoute.real_stops[2].node_index).toBe(5);

            // Verify no dummy/ghost in node_sequence
            expect(cleanedRoute.node_sequence).not.toContain(0); // Depot removed
            expect(cleanedRoute.node_sequence).not.toContain(1); // Dummy removed
            expect(cleanedRoute.node_sequence).not.toContain(2); // Ghost removed

            console.log('✓ Test 4 Passed: Dummy and ghost nodes removed from output');
        });

        it('should extract start_time from dummy node', () => {
            const mappingIds: MappingIdExtended[] = [
                { kind: 'depot', order_id: null, location_id: null, lat: 10.762, lng: 106.660, is_dummy: false },
                { kind: 'dummy_start', order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1' },
                { kind: 'pickup', order_id: 'order-1', location_id: 'loc-1', lat: 10.763, lng: 106.661, is_dummy: false },
                { kind: 'delivery', order_id: 'order-1', location_id: 'loc-2', lat: 10.764, lng: 106.662, is_dummy: false },
            ];

            const dummyNodes: DummyNode[] = [
                {
                    node_index: 1,
                    node_type: 'dummy_start',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 0,
                    ready_time: 480, // 8:00 AM in minutes from start of day
                    due_time: 1020, // 5:00 PM
                    service_time: 0,
                },
            ];

            const rawRoutes = [{ route_number: 1, node_sequence: [0, 1, 2, 3, 0] }];
            const result = cleanDummyNodes(rawRoutes, mappingIds, dummyNodes);

            const cleanedRoute = result.cleaned_routes[0];
            expect(cleanedRoute.start_time).toBe(480); // Extracted from dummy node
            expect(cleanedRoute.vehicle_id).toBe('vehicle-1');

            console.log('✓ Test 4b Passed: start_time extracted from dummy node');
        });

        it('should extract initial_load from ghost pickup', () => {
            const mappingIds: MappingIdExtended[] = [
                { kind: 'depot', order_id: null, location_id: null, lat: 10.762, lng: 106.660, is_dummy: false },
                { kind: 'dummy_start', order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1' },
                { kind: 'ghost_pickup', order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1' },
                { kind: 'delivery', order_id: 'order-1', location_id: 'loc-2', lat: 10.764, lng: 106.662, is_dummy: false },
            ];

            const dummyNodes: DummyNode[] = [
                {
                    node_index: 1,
                    node_type: 'dummy_start',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 0,
                    ready_time: 480,
                    due_time: 1020,
                    service_time: 0,
                },
                {
                    node_index: 2,
                    node_type: 'ghost_pickup',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 35, // Current vehicle load
                    ready_time: 480,
                    due_time: 1020,
                    service_time: 0,
                    original_order_ids: ['order-1'],
                },
            ];

            const rawRoutes = [{ route_number: 1, node_sequence: [0, 1, 2, 3, 0] }];
            const result = cleanDummyNodes(rawRoutes, mappingIds, dummyNodes);

            const cleanedRoute = result.cleaned_routes[0];
            expect(cleanedRoute.initial_load).toBe(35); // Extracted from ghost pickup

            console.log('✓ Test 4c Passed: initial_load extracted from ghost pickup');
        });

        it('should validate ghost pickups have corresponding deliveries', () => {
            const mappingIds: MappingIdExtended[] = [
                { kind: 'depot', order_id: null, location_id: null, lat: 10.762, lng: 106.660 },
                { kind: 'delivery', order_id: 'order-1', location_id: 'loc-2', lat: 10.764, lng: 106.662 },
            ];

            const dummyNodes: DummyNode[] = [
                {
                    node_index: 2,
                    node_type: 'ghost_pickup',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 20,
                    ready_time: 100,
                    due_time: 500,
                    service_time: 0,
                    original_order_ids: ['order-1'], // Has delivery
                },
            ];

            const validation = validateGhostPickups(dummyNodes, mappingIds);
            expect(validation.valid).toBe(true);
            expect(validation.errors).toHaveLength(0);

            console.log('✓ Test 4d Passed: Ghost pickup validation with delivery');
        });

        it('should detect orphaned ghost pickups (no delivery)', () => {
            const mappingIds: MappingIdExtended[] = [
                { kind: 'depot', order_id: null, location_id: null, lat: 10.762, lng: 106.660 },
                // Missing delivery for order-1
            ];

            const dummyNodes: DummyNode[] = [
                {
                    node_index: 2,
                    node_type: 'ghost_pickup',
                    vehicle_id: 'vehicle-1',
                    lat: 10.770,
                    lng: 106.670,
                    demand: 20,
                    ready_time: 100,
                    due_time: 500,
                    service_time: 0,
                    original_order_ids: ['order-1'], // No delivery node exists
                },
            ];

            const validation = validateGhostPickups(dummyNodes, mappingIds);
            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
            expect(validation.errors[0]).toContain('order-1');

            console.log('✓ Test 4e Passed: Orphaned ghost pickup detected');
        });
    });

    describe('Test 5: Solver Output Parsing', () => {
        it('should parse solver text output correctly', () => {
            const solutionText = `
Route 1: 0 49 50 1 2 3 0
Route 2: 0 51 4 5 6 0
Cost: 1234.56
            `.trim();

            const routes = parseSolverOutput(solutionText);
            
            expect(routes).toHaveLength(2);
            expect(routes[0].route_number).toBe(1);
            expect(routes[0].node_sequence).toEqual([0, 49, 50, 1, 2, 3, 0]);
            expect(routes[1].route_number).toBe(2);
            expect(routes[1].node_sequence).toEqual([0, 51, 4, 5, 6, 0]);

            console.log('✓ Test 5 Passed: Solver output parsed correctly');
        });
    });
});

// Run all tests
console.log('\n=== Running Reoptimization Unit Tests ===\n');
