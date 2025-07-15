import React, { useState } from 'react'
import {
    ChartBarIcon,
    DocumentTextIcon,
    ArrowDownTrayIcon,
    EyeIcon,
    MapIcon
} from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'
import apiClient from '@services/api'
import toast from 'react-hot-toast'

function Results() {
    const [solutionData, setSolutionData] = useState(null)
    const [parsedSolution, setParsedSolution] = useState(null)
    const [loading, setLoading] = useState(false)

    const onDrop = async (acceptedFiles) => {
        const file = acceptedFiles[0]
        if (!file) return

        try {
            setLoading(true)
            const response = await apiClient.uploadSolution(file)
            setSolutionData(response.content)

            // Parse solution data for visualization
            const parsed = apiClient.parseSolutionData(response.content)
            setParsedSolution(parsed)

            toast.success('Solution loaded successfully!')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/plain': ['.txt']
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024 // 10MB
    })

    const downloadSolution = () => {
        if (solutionData) {
            apiClient.downloadFile(
                solutionData,
                `solution_analysis_${Date.now()}.txt`,
                'text/plain'
            )
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <ChartBarIcon className="h-8 w-8 text-primary-600 mr-3" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Solution Analysis</h1>
                            <p className="text-gray-600">Upload and analyze PDPTW solution results</p>
                        </div>
                    </div>

                    {solutionData && (
                        <button
                            onClick={downloadSolution}
                            className="btn-secondary flex items-center"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                            Download
                        </button>
                    )}
                </div>
            </div>

            {/* Upload Section */}
            {!solutionData && (
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <DocumentTextIcon className="h-5 w-5 text-primary-500 mr-2" />
                            Upload Solution File
                        </h3>
                    </div>
                    <div className="p-6">
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <input {...getInputProps()} />
                            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            {isDragActive ? (
                                <p className="text-xl text-primary-600">Drop the solution file here...</p>
                            ) : (
                                <div>
                                    <p className="text-xl text-gray-600 mb-2">
                                        Drag & drop a solution file here, or click to select
                                    </p>
                                    <p className="text-gray-500">
                                        Supports .txt files from PDPTW algorithms
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600 mb-4">
                                Or analyze results from a previous solution in the Solver page
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Solution Analysis */}
            {parsedSolution && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Summary Statistics */}
                    <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Summary</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-blue-800">Total Cost</p>
                                <p className="text-2xl font-bold text-blue-900">
                                    {parsedSolution.totalCost.toFixed(2)}
                                </p>
                            </div>

                            <div className="bg-green-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-green-800">Vehicles Used</p>
                                <p className="text-2xl font-bold text-green-900">
                                    {parsedSolution.totalVehicles}
                                </p>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-purple-800">Customers Served</p>
                                <p className="text-2xl font-bold text-purple-900">
                                    {parsedSolution.totalCustomers}
                                </p>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-yellow-800">Average Cost per Route</p>
                                <p className="text-2xl font-bold text-yellow-900">
                                    {(parsedSolution.totalCost / parsedSolution.totalVehicles).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Route Details */}
                    <div className="lg:col-span-2 bg-white rounded-lg shadow-soft border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                <MapIcon className="h-5 w-5 text-primary-500 mr-2" />
                                Route Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4 max-h-96 overflow-y-auto">
                                {parsedSolution.routes.map((route) => (
                                    <div key={route.id} className="border border-gray-200 rounded-md p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-medium text-gray-900">
                                                Route {route.id}
                                            </h4>
                                            <div className="flex space-x-4 text-sm">
                                                <span className="text-gray-600">
                                                    Cost: <span className="font-medium">{route.cost.toFixed(2)}</span>
                                                </span>
                                                <span className="text-gray-600">
                                                    Nodes: <span className="font-medium">{route.nodes.length}</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 p-3 rounded-md">
                                            <p className="text-sm font-mono text-gray-700">
                                                {route.nodes.join(' → ')}
                                            </p>
                                        </div>

                                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                                            <span>Customers: {Math.max(0, route.nodes.length - 2)}</span>
                                            <span>Load: {route.load || 'N/A'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Raw Solution Data */}
            {solutionData && (
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <EyeIcon className="h-5 w-5 text-primary-500 mr-2" />
                            Raw Solution Data
                        </h3>
                    </div>
                    <div className="p-6">
                        <textarea
                            value={solutionData}
                            readOnly
                            rows={15}
                            className="form-textarea font-mono text-xs bg-gray-50 w-full"
                            placeholder="Solution data will appear here..."
                        />
                    </div>
                </div>
            )}

            {/* Help Section */}
            {!solutionData && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start">
                        <ChartBarIcon className="h-6 w-6 text-blue-600 mt-1 mr-3" />
                        <div>
                            <h3 className="text-lg font-medium text-blue-900 mb-2">
                                How to Analyze Solutions
                            </h3>
                            <div className="text-blue-800 space-y-2">
                                <p>1. Upload a solution file generated by any PDPTW algorithm</p>
                                <p>2. View summary statistics including total cost and vehicle usage</p>
                                <p>3. Examine detailed route information and node sequences</p>
                                <p>4. Download the analysis for further processing</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Results
