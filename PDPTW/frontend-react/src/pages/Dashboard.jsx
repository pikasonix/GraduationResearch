import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    PlayIcon,
    DocumentTextIcon,
    ChartBarIcon,
    CpuChipIcon,
    ClockIcon,
    CheckCircleIcon,
    ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import LoadingSpinner from '@components/LoadingSpinner'
import apiClient from '@services/api'
import toast from 'react-hot-toast'

function Dashboard() {
    const [loading, setLoading] = useState(true)
    const [systemStatus, setSystemStatus] = useState(null)
    const [algorithms, setAlgorithms] = useState([])

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            setLoading(true)

            // Load system health and algorithms in parallel
            const [healthResponse, algorithmsResponse] = await Promise.all([
                apiClient.healthCheck(),
                apiClient.getAlgorithms()
            ])

            setSystemStatus(healthResponse)
            setAlgorithms(algorithmsResponse.algorithms || [])
        } catch (error) {
            toast.error('Failed to load dashboard data')
            console.error('Dashboard load error:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <LoadingSpinner size="lg" message="Loading dashboard..." />
    }

    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return `${hours}h ${minutes}m`
    }

    const formatMemory = (bytes) => {
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    const availableAlgorithms = algorithms.filter(alg => alg.available)
    const unavailableAlgorithms = algorithms.filter(alg => !alg.available)

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Welcome to PDPTW Solver</h1>
                        <p className="text-primary-100 text-lg">
                            Advanced algorithms for Pickup and Delivery Problem with Time Windows
                        </p>
                    </div>
                    <div className="hidden md:block">
                        <CpuChipIcon className="h-16 w-16 text-primary-200" />
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link
                    to="/solver"
                    className="group bg-white p-6 rounded-lg shadow-soft border border-gray-200 hover:shadow-strong transition-all duration-200 hover:border-primary-300"
                >
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <PlayIcon className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-700">
                                Start Solving
                            </h3>
                            <p className="text-sm text-gray-500">
                                Upload instances and run algorithms
                            </p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/results"
                    className="group bg-white p-6 rounded-lg shadow-soft border border-gray-200 hover:shadow-strong transition-all duration-200 hover:border-primary-300"
                >
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <ChartBarIcon className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-700">
                                View Results
                            </h3>
                            <p className="text-sm text-gray-500">
                                Analyze and visualize solutions
                            </p>
                        </div>
                    </div>
                </Link>

                <Link
                    to="/about"
                    className="group bg-white p-6 rounded-lg shadow-soft border border-gray-200 hover:shadow-strong transition-all duration-200 hover:border-primary-300"
                >
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <DocumentTextIcon className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-lg font-medium text-gray-900 group-hover:text-primary-700">
                                Documentation
                            </h3>
                            <p className="text-sm text-gray-500">
                                Learn about algorithms and usage
                            </p>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Status */}
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                            System Status
                        </h3>
                    </div>
                    <div className="p-6">
                        {systemStatus ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-500">Status</span>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {systemStatus.status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-500">Uptime</span>
                                    <span className="text-sm text-gray-900">{formatUptime(systemStatus.uptime)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-500">Memory Usage</span>
                                    <span className="text-sm text-gray-900">{formatMemory(systemStatus.memory.used)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-500">Environment</span>
                                    <span className="text-sm text-gray-900 capitalize">{systemStatus.environment}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-500">Version</span>
                                    <span className="text-sm text-gray-900">{systemStatus.version}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <ExclamationCircleIcon className="h-8 w-8 text-red-500 mx-auto mb-2" />
                                <p className="text-sm text-red-600">Unable to fetch system status</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Algorithm Status */}
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <CpuChipIcon className="h-5 w-5 text-primary-500 mr-2" />
                            Available Algorithms
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-3">
                            {availableAlgorithms.map((algorithm) => (
                                <div key={algorithm.id} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{algorithm.name}</p>
                                            <p className="text-xs text-gray-500">{algorithm.executable}</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Available
                                    </span>
                                </div>
                            ))}

                            {unavailableAlgorithms.map((algorithm) => (
                                <div key={algorithm.id} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{algorithm.name}</p>
                                            <p className="text-xs text-gray-500">{algorithm.executable}</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        Unavailable
                                    </span>
                                </div>
                            ))}

                            {algorithms.length === 0 && (
                                <div className="text-center py-4">
                                    <CpuChipIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No algorithms found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity / Statistics */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center">
                        <ClockIcon className="h-5 w-5 text-primary-500 mr-2" />
                        Getting Started
                    </h3>
                </div>
                <div className="p-6">
                    <div className="prose prose-sm max-w-none text-gray-600">
                        <p className="mb-4">
                            Welcome to the PDPTW (Pickup and Delivery Problem with Time Windows) solver.
                            This application provides advanced optimization algorithms to solve complex routing problems.
                        </p>

                        <h4 className="text-gray-900 font-medium mb-2">Quick Start Guide:</h4>
                        <ol className="list-decimal list-inside space-y-2 ml-4">
                            <li>Navigate to the <strong>Solver</strong> page</li>
                            <li>Upload a PDPTW instance file or use the sample instance</li>
                            <li>Select an algorithm and configure parameters</li>
                            <li>Click "Solve Problem" to run the optimization</li>
                            <li>View and analyze results in the <strong>Results</strong> page</li>
                        </ol>

                        <p className="mt-4">
                            For more detailed information about algorithms and file formats,
                            visit the <Link to="/about" className="text-primary-600 hover:text-primary-700">documentation</Link> page.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
