import React from 'react'
import {
    InformationCircleIcon,
    BeakerIcon,
    CpuChipIcon,
    ClockIcon,
    ChartBarIcon,
    DocumentTextIcon,
    CodeBracketIcon
} from '@heroicons/react/24/outline'

function About() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                <div className="flex items-center">
                    <InformationCircleIcon className="h-8 w-8 mr-3" />
                    <div>
                        <h1 className="text-3xl font-bold mb-2">About PDPTW Solver</h1>
                        <p className="text-primary-100 text-lg">
                            Advanced algorithms for Pickup and Delivery Problem with Time Windows
                        </p>
                    </div>
                </div>
            </div>

            {/* Problem Description */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                        <DocumentTextIcon className="h-6 w-6 text-primary-500 mr-2" />
                        The PDPTW Problem
                    </h2>
                </div>
                <div className="p-6">
                    <div className="prose prose-gray max-w-none">
                        <p className="text-gray-700 leading-relaxed mb-4">
                            The Pickup and Delivery Problem with Time Windows (PDPTW) is a variant of the Vehicle Routing Problem (VRP)
                            where a fleet of vehicles must serve transportation requests. Each request involves picking up goods at one
                            location and delivering them to another location, subject to time window constraints.
                        </p>

                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Characteristics:</h3>
                        <ul className="list-disc list-inside space-y-2 text-gray-700">
                            <li><strong>Pickup and Delivery Pairs:</strong> Each request consists of a pickup location and a corresponding delivery location</li>
                            <li><strong>Time Windows:</strong> Both pickup and delivery locations have specific time windows during which service must occur</li>
                            <li><strong>Vehicle Capacity:</strong> Vehicles have limited capacity constraints</li>
                            <li><strong>Precedence Constraints:</strong> Pickup must occur before delivery for each request</li>
                            <li><strong>Route Optimization:</strong> Minimize total travel cost while satisfying all constraints</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Available Algorithms */}
            <div className="space-y-6">
                {/* Current Algorithm Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <InformationCircleIcon className="h-6 w-6 text-blue-600 mr-3" />
                        <div>
                            <h3 className="text-lg font-medium text-blue-900 mb-1">
                                Available Algorithm
                            </h3>
                            <p className="text-blue-800">
                                Currently, the Hybrid ACO-Greedy algorithm is the only available optimization method in this system.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Hybrid Algorithm Details */}
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                            <CpuChipIcon className="h-6 w-6 text-purple-500 mr-2" />
                            Hybrid ACO-Greedy Algorithm
                        </h3>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-700 mb-4 text-lg">
                            This advanced algorithm combines Ant Colony Optimization (ACO) metaheuristic with greedy construction
                            heuristics to deliver superior performance and solution quality for PDPTW problems.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Core Features:</h4>
                                <ul className="text-gray-600 space-y-2">
                                    <li>• Best of both ACO and Greedy approaches</li>
                                    <li>• Highly configurable parameters</li>
                                    <li>• Local search integration</li>
                                    <li>• Elite solution management</li>
                                    <li>• Adaptive pheromone updates</li>
                                    <li>• Time window constraint handling</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-semibold text-gray-900 mb-3">Algorithm Parameters:</h4>
                                <ul className="text-gray-600 space-y-2">
                                    <li>• <strong>Routes:</strong> Number of vehicle routes (1-20)</li>
                                    <li>• <strong>Ants:</strong> Population size (1-100)</li>
                                    <li>• <strong>Iterations:</strong> Maximum iterations (1-1000)</li>
                                    <li>• <strong>Alpha/Beta:</strong> Pheromone influence (0.1-10)</li>
                                    <li>• <strong>Rho:</strong> Evaporation rate (0.01-1)</li>
                                    <li>• <strong>Greedy Bias:</strong> Construction bias (0.1-1)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6 flex space-x-3">
                            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                                Hybrid Metaheuristic
                            </div>
                            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                High Performance
                            </div>
                            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                Configurable
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* File Format */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                        <CodeBracketIcon className="h-6 w-6 text-primary-500 mr-2" />
                        Instance File Format
                    </h2>
                </div>
                <div className="p-6">
                    <p className="text-gray-700 mb-4">
                        PDPTW instances follow a standardized format with the following sections:
                    </p>

                    <div className="bg-gray-50 rounded-md p-4 font-mono text-sm overflow-x-auto">
                        <pre className="text-gray-800">{`NAME: instance-name
COMMENT: Description of the instance
TYPE: PDPTW
DIMENSION: number-of-nodes
EDGE_WEIGHT_TYPE: EUC_2D
CAPACITY: vehicle-capacity

NODE_COORD_SECTION
node-id x-coord y-coord
...

DEMAND_SECTION
node-id demand
...

TIME_WINDOW_SECTION
node-id earliest-time latest-time
...

SERVICE_TIME_SECTION
node-id service-time
...

PICKUP_AND_DELIVERY_SECTION
pickup-node delivery-node
...

DEPOT_SECTION
depot-node
-1

EOF`}</pre>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Required Sections:</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• NAME: Instance identifier</li>
                                <li>• NODE_COORD_SECTION: Node coordinates</li>
                                <li>• DEMAND_SECTION: Node demands</li>
                                <li>• TIME_WINDOW_SECTION: Time constraints</li>
                                <li>• PICKUP_AND_DELIVERY_SECTION: Request pairs</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-2">Optional Sections:</h4>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• COMMENT: Instance description</li>
                                <li>• SERVICE_TIME_SECTION: Service times</li>
                                <li>• CAPACITY: Vehicle capacity</li>
                                <li>• EDGE_WEIGHT_TYPE: Distance calculation</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage Guide */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                        <ChartBarIcon className="h-6 w-6 text-primary-500 mr-2" />
                        How to Use
                    </h2>
                </div>
                <div className="p-6">
                    <div className="space-y-6">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-primary-600 font-semibold text-sm">1</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">Prepare Instance</h3>
                                <p className="text-gray-600">
                                    Upload a PDPTW instance file in the correct format, or use the provided sample instance to get started.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-primary-600 font-semibold text-sm">2</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">Configure Algorithm</h3>
                                <p className="text-gray-600">
                                    The system uses the advanced Hybrid ACO-Greedy algorithm. Configure the algorithm parameters to optimize performance for your specific problem instance.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-primary-600 font-semibold text-sm">3</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">Optimize Parameters</h3>
                                <p className="text-gray-600">
                                    Fine-tune the Hybrid ACO-Greedy algorithm by adjusting advanced parameters like number of ants, iterations, pheromone settings, and greedy bias to achieve optimal performance.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-4">
                                <span className="text-primary-600 font-semibold text-sm">4</span>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-1">Analyze Results</h3>
                                <p className="text-gray-600">
                                    View the generated solution, download results, and analyze route details and performance metrics in the Results page.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Technical Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start">
                    <InformationCircleIcon className="h-6 w-6 text-blue-600 mt-1 mr-3" />
                    <div>
                        <h3 className="text-lg font-medium text-blue-900 mb-2">
                            Technical Implementation
                        </h3>
                        <div className="text-blue-800 space-y-2">
                            <p>
                                <strong>Backend:</strong> Express.js REST API with Node.js runtime for fast, scalable performance
                            </p>
                            <p>
                                <strong>Frontend:</strong> React.js with TailwindCSS for modern, responsive user interface
                            </p>
                            <p>
                                <strong>Algorithm:</strong> Advanced Hybrid ACO-Greedy implementation in C++ for optimal computational efficiency
                            </p>
                            <p>
                                <strong>Architecture:</strong> Microservices design with clear separation between frontend and backend
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default About
