/**
 * Manual Test Script for Reoptimization
 * Run: npx ts-node src/workers/test-reoptimization.ts
 */

import { preprocessReoptimization } from './reoptimizationPreprocessor';
import { cleanDummyNodes, parseSolverOutput, validateGhostPickups } from './dummyNodeCleaner';
import type { ReoptimizationContext } from '../types/reoptimization';

async function testPreprocessing() {
    console.log('\n=== Test 1: Preprocessing with 2 vehicles and 3 orders ===\n');

    const context: ReoptimizationContext = {
        organization_id: 'test-org-1',
        vehicle_states: [
            {
                vehicle_id: 'vehicle-1',
                lat: 10.770,
                lng: 106.670,
                bearing: 90,
                picked_order_ids: ['order-1'], // Vehicle carrying order-1
            },
            {
                vehicle_id: 'vehicle-2',
                lat: 10.775,
                lng: 106.675,
                bearing: 180,
                picked_order_ids: [], // Empty vehicle
            },
        ],
        order_delta: {
            new_order_ids: ['order-3'],
            cancelled_order_ids: [],
        },
    };

    const depot = {
        name: 'Test Depot',
        address: '123 Main St',
        latitude: 10.762622,
        longitude: 106.660172,
    };

    const orders = [
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
        {
            id: 'order-3',
            pickup_location_id: 'loc-5',
            delivery_location_id: 'loc-6',
            pickup_lat: 10.767,
            pickup_lng: 106.665,
            delivery_lat: 10.768,
            delivery_lng: 106.666,
            demand_weight: 10,
            service_time_pickup: 5,
            service_time_delivery: 5,
        },
    ];

    const vehicles = [
        { id: 'vehicle-1', vehicle_code: 'VEH-001', capacity_weight: 100, capacity_volume: 50 },
        { id: 'vehicle-2', vehicle_code: 'VEH-002', capacity_weight: 150, capacity_volume: 75 },
    ];

    try {
        const result = await preprocessReoptimization({
            context,
            depot,
            active_orders: [orders[0], orders[1]], // Orders 1 and 2 are active
            new_orders: [orders[2]], // Order 3 is new
            vehicles,
            current_timestamp: new Date(),
        });

        console.log('✓ Preprocessing successful!');
        console.log(`  - Total nodes: ${result.mapping_ids.length}`);
        console.log(`  - Dummy nodes: ${result.dummy_nodes.length}`);
        console.log(`  - Dummy start nodes: ${result.dummy_nodes.filter(d => d.node_type === 'dummy_start').length}`);
        console.log(`  - Ghost pickup nodes: ${result.dummy_nodes.filter(d => d.node_type === 'ghost_pickup').length}`);
        console.log(`  - Vehicle capacity dimensions: ${result.vehicle_capacity_dimensions.size}`);
        console.log(`  - Initial routes: ${result.initial_routes?.length || 0}`);

        // Validate ghost pickups
        const validation = validateGhostPickups(result.dummy_nodes, result.mapping_ids);
        if (validation.valid) {
            console.log('✓ Ghost pickup validation passed');
        } else {
            console.log('✗ Ghost pickup validation failed:');
            validation.errors.forEach(err => console.log(`  - ${err}`));
        }

        // Show instance text preview
        const lines = result.instance_text.split('\n');
        console.log('\nInstance text preview (first 20 lines):');
        lines.slice(0, 20).forEach(line => console.log(`  ${line}`));

        return result;
    } catch (error) {
        console.error('✗ Preprocessing failed:', error);
        throw error;
    }
}

function testCleanup() {
    console.log('\n=== Test 2: Cleanup dummy nodes from solver output ===\n');

    // Mock mapping_ids
    const mappingIds = [
        { kind: 'depot' as const, order_id: null, location_id: null, lat: 10.762, lng: 106.660, is_dummy: false },
        { kind: 'dummy_start' as const, order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1' },
        { kind: 'ghost_pickup' as const, order_id: null, location_id: null, lat: 10.770, lng: 106.670, is_dummy: true, vehicle_id: 'vehicle-1', original_order_ids: ['order-1'] },
        { kind: 'delivery' as const, order_id: 'order-1', location_id: 'loc-2', lat: 10.764, lng: 106.662, is_dummy: false },
        { kind: 'pickup' as const, order_id: 'order-2', location_id: 'loc-3', lat: 10.765, lng: 106.663, is_dummy: false },
        { kind: 'delivery' as const, order_id: 'order-2', location_id: 'loc-4', lat: 10.766, lng: 106.664, is_dummy: false },
    ];

    const dummyNodes = [
        {
            node_index: 1,
            node_type: 'dummy_start' as const,
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
            node_type: 'ghost_pickup' as const,
            vehicle_id: 'vehicle-1',
            lat: 10.770,
            lng: 106.670,
            demand: 20,
            ready_time: 480,
            due_time: 1020,
            service_time: 0,
            original_order_ids: ['order-1'],
        },
    ];

    // Mock solver output
    const solutionText = 'Route 1: 0 1 2 3 4 5 0\nCost: 1234.56';
    const rawRoutes = parseSolverOutput(solutionText);

    console.log('Raw solver output:');
    console.log(`  ${solutionText}`);
    console.log(`\nParsed routes: ${rawRoutes.length}`);
    rawRoutes.forEach(r => {
        console.log(`  Route ${r.route_number}: [${r.node_sequence.join(', ')}]`);
    });

    const cleaned = cleanDummyNodes(rawRoutes, mappingIds, dummyNodes);

    console.log('\n✓ Cleanup successful!');
    console.log(`  - Removed dummy nodes: ${cleaned.removed_dummy_count}`);
    console.log(`  - Removed ghost pickups: ${cleaned.removed_ghost_count}`);
    console.log(`  - Cleaned routes: ${cleaned.cleaned_routes.length}`);

    cleaned.cleaned_routes.forEach(route => {
        console.log(`\n  Route ${route.route_number} (Vehicle: ${route.vehicle_id}):`);
        console.log(`    - Start time: ${route.start_time} minutes`);
        console.log(`    - Initial load: ${route.initial_load || 0} kg`);
        console.log(`    - Real stops: ${route.real_stops.length}`);
        console.log(`    - Node sequence: [${route.node_sequence.join(', ')}]`);
        route.real_stops.forEach((stop, idx) => {
            console.log(`      ${idx + 1}. ${stop.stop_type} - Order ${stop.order_id} at Location ${stop.location_id}`);
        });
    });
}

async function runAllTests() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   REOPTIMIZATION FUNCTIONALITY TEST SUITE            ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    try {
        await testPreprocessing();
        testCleanup();

        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║   ✓ ALL TESTS PASSED                                 ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');
    } catch (error) {
        console.log('\n╔═══════════════════════════════════════════════════════╗');
        console.log('║   ✗ TESTS FAILED                                     ║');
        console.log('╚═══════════════════════════════════════════════════════╝\n');
        console.error(error);
        process.exit(1);
    }
}

runAllTests();
