import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    PlayIcon,
    DocumentArrowUpIcon,
    CogIcon,
    BeakerIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon
} from '@heroicons/react/24/outline'
import { useDropzone } from 'react-dropzone'
import LoadingSpinner from '@components/LoadingSpinner'
import apiClient from '@services/api'
import toast from 'react-hot-toast'

// Validation schema
const solverSchema = z.object({
    algorithm: z.enum(['hybrid']).default('hybrid'),
    instance: z.string().min(1, 'Instance content is required'),
    // Hybrid algorithm parameters
    num_routes: z.number().min(1).max(20).optional(),
    ants: z.number().min(1).max(100).optional(),
    iterations: z.number().min(1).max(1000).optional(),
    alpha: z.number().min(0.1).max(10).optional(),
    beta: z.number().min(0.1).max(10).optional(),
    rho: z.number().min(0.01).max(1).optional(),
    tau_max: z.number().min(1).max(100).optional(),
    tau_min: z.number().min(0.001).max(1).optional(),
    greedy_bias: z.number().min(0.1).max(1).optional(),
    elite_solutions: z.number().min(1).max(10).optional(),
    local_search_prob: z.number().min(0.1).max(1).optional(),
    restart_threshold: z.number().min(1).max(10).optional(),
})

function Solver() {
    const [loading, setLoading] = useState(false)
    const [algorithms, setAlgorithms] = useState([])
    const [solution, setSolution] = useState(null)
    const [instanceInfo, setInstanceInfo] = useState(null)
    const [showAdvanced, setShowAdvanced] = useState(false)

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(solverSchema),
        mode: 'onChange',
        defaultValues: {
            algorithm: 'hybrid',
            instance: '',
            num_routes: 7,
            ants: 10,
            iterations: 20,
            alpha: 2.0,
            beta: 5.0,
            rho: 0.1,
            tau_max: 50.0,
            tau_min: 0.01,
            greedy_bias: 0.85,
            elite_solutions: 4,
            local_search_prob: 0.7,
            restart_threshold: 2
        }
    })

    const selectedAlgorithm = watch('algorithm')
    const instanceContent = watch('instance')

    useEffect(() => {
        loadAlgorithms()
        loadSampleInstance()
        // Ensure algorithm is set to hybrid
        setValue('algorithm', 'hybrid')
    }, [])

    useEffect(() => {
        if (instanceContent) {
            validateInstance()
        }
    }, [instanceContent])

    const loadAlgorithms = async () => {
        try {
            const response = await apiClient.getAlgorithms()
            setAlgorithms(response.algorithms || [])
        } catch (error) {
            toast.error('Failed to load algorithms')
        }
    }

    const loadSampleInstance = async () => {
        try {
            const response = await apiClient.getSampleInstance()
            setValue('instance', response.content)
        } catch (error) {
            console.error('Failed to load sample instance:', error)
        }
    }

    const validateInstance = async () => {
        try {
            const response = await apiClient.validateInstance(instanceContent)
            if (response.valid) {
                setInstanceInfo({
                    name: response.name,
                    info: response.info,
                    valid: true
                })
            } else {
                setInstanceInfo({
                    error: response.error,
                    valid: false
                })
            }
        } catch (error) {
            setInstanceInfo({
                error: error.message,
                valid: false
            })
        }
    }

    const onDrop = async (acceptedFiles) => {
        const file = acceptedFiles[0]
        if (!file) return

        try {
            setLoading(true)
            const response = await apiClient.uploadInstance(file)
            setValue('instance', response.content)
            toast.success(`Instance loaded: ${response.name}`)
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

    const onSubmit = async (data) => {
        try {
            setLoading(true)
            setSolution(null)

            // Prepare parameters for hybrid algorithm
            const params = {}
            if (data.algorithm === 'hybrid') {
                params.num_routes = data.num_routes
                params.ants = data.ants
                params.iterations = data.iterations
                params.alpha = data.alpha
                params.beta = data.beta
                params.rho = data.rho
                params.tau_max = data.tau_max
                params.tau_min = data.tau_min
                params.greedy_bias = data.greedy_bias
                params.elite_solutions = data.elite_solutions
                params.local_search_prob = data.local_search_prob
                params.restart_threshold = data.restart_threshold
            }

            const response = await apiClient.solveProblem(data.instance, data.algorithm, params)
            setSolution(response)
            toast.success('Problem solved successfully!')
        } catch (error) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const downloadSolution = () => {
        if (solution) {
            apiClient.downloadFile(
                solution.solution,
                `solution_${solution.algorithm}_${Date.now()}.txt`,
                'text/plain'
            )
        }
    }

    const availableAlgorithms = algorithms.filter(alg => alg.available)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-soft border border-gray-200 p-6">
                <div className="flex items-center">
                    <BeakerIcon className="h-8 w-8 text-primary-600 mr-3" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">PDPTW Problem Solver</h1>
                        <p className="text-gray-600">Configure parameters and solve optimization problems</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Panel */}
                <div className="space-y-6">
                    {/* Instance Upload */}
                    <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                <DocumentArrowUpIcon className="h-5 w-5 text-primary-500 mr-2" />
                                Problem Instance
                            </h3>
                        </div>
                        <div className="p-6">
                            {/* File Drop Zone */}
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive
                                    ? 'border-primary-400 bg-primary-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <DocumentArrowUpIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                                {isDragActive ? (
                                    <p className="text-primary-600">Drop the instance file here...</p>
                                ) : (
                                    <div>
                                        <p className="text-gray-600 mb-1">
                                            Drag & drop an instance file here, or click to select
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Supports .txt files up to 10MB
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Instance Info */}
                            {instanceInfo && (
                                <div className={`mt-4 p-3 rounded-md ${instanceInfo.valid
                                    ? 'bg-green-50 border border-green-200'
                                    : 'bg-red-50 border border-red-200'
                                    }`}>
                                    <div className="flex items-center">
                                        {instanceInfo.valid ? (
                                            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                                        ) : (
                                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
                                        )}
                                        <div className="flex-1">
                                            {instanceInfo.valid ? (
                                                <div>
                                                    <p className="text-sm font-medium text-green-800">
                                                        Valid instance: {instanceInfo.name}
                                                    </p>
                                                    {instanceInfo.info && (
                                                        <p className="text-xs text-green-600 mt-1">
                                                            Nodes: {instanceInfo.info.hasNodes ? '✓' : '✗'} |
                                                            Demands: {instanceInfo.info.hasDemands ? '✓' : '✗'} |
                                                            Time Windows: {instanceInfo.info.hasTimeWindows ? '✓' : '✗'}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm font-medium text-red-800">
                                                    {instanceInfo.error}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Instance Text Area */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Instance Content
                                </label>
                                <textarea
                                    {...register('instance')}
                                    rows={8}
                                    className="form-textarea font-mono text-xs"
                                    placeholder="Paste or load PDPTW instance content here..."
                                />
                                {errors.instance && (
                                    <p className="form-error">{errors.instance.message}</p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={loadSampleInstance}
                                className="btn-outline btn-sm mt-2"
                            >
                                Load Sample Instance
                            </button>
                        </div>
                    </div>

                    {/* Algorithm Configuration */}
                    <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                <CogIcon className="h-5 w-5 text-primary-500 mr-2" />
                                Algorithm Configuration
                            </h3>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                {/* Algorithm Information */}
                                <div className="form-group">
                                    <label className="form-label">Algorithm</label>
                                    <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-900">Hybrid ACO-Greedy V3</p>
                                                <p className="text-sm text-gray-600">Advanced metaheuristic combining ACO with Greedy Construction</p>
                                            </div>
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                    <input type="hidden" {...register('algorithm')} value="hybrid" />
                                </div>

                                {/* Advanced Parameters for Hybrid Algorithm */}
                                {selectedAlgorithm === 'hybrid' && (
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="btn-ghost btn-sm mb-4"
                                        >
                                            {showAdvanced ? 'Hide' : 'Show'} Advanced Parameters
                                        </button>

                                        {showAdvanced && (
                                            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                                                <div>
                                                    <label className="form-label">Routes</label>
                                                    <input
                                                        type="number"
                                                        {...register('num_routes', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="1"
                                                        max="20"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">Ants</label>
                                                    <input
                                                        type="number"
                                                        {...register('ants', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="1"
                                                        max="100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">Iterations</label>
                                                    <input
                                                        type="number"
                                                        {...register('iterations', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="1"
                                                        max="1000"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">Alpha</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        {...register('alpha', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="0.1"
                                                        max="10"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">Beta</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        {...register('beta', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="0.1"
                                                        max="10"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label">Rho</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        {...register('rho', { valueAsNumber: true })}
                                                        className="form-input"
                                                        min="0.01"
                                                        max="1"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Solve Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || loading || !instanceInfo?.valid}
                                    className="btn-primary w-full flex items-center justify-center"
                                >
                                    {(isSubmitting || loading) ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                                            Solving...
                                        </>
                                    ) : (
                                        <>
                                            <PlayIcon className="h-4 w-4 mr-2" />
                                            Solve Problem
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Results Panel */}
                <div className="bg-white rounded-lg shadow-soft border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">Solution Results</h3>
                    </div>
                    <div className="p-6">
                        {loading && (
                            <LoadingSpinner message="Solving problem..." />
                        )}

                        {solution && !loading && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-green-50 p-3 rounded-md">
                                        <p className="text-sm font-medium text-green-800">Algorithm</p>
                                        <p className="text-lg font-bold text-green-900 uppercase">
                                            {solution.algorithm}
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-3 rounded-md">
                                        <p className="text-sm font-medium text-blue-800">Execution Time</p>
                                        <p className="text-lg font-bold text-blue-900">
                                            {apiClient.formatExecutionTime(solution.execution_time)}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="form-label">Solution Output</label>
                                    <textarea
                                        value={solution.solution}
                                        readOnly
                                        rows={12}
                                        className="form-textarea font-mono text-xs bg-gray-50"
                                    />
                                </div>

                                <button
                                    onClick={downloadSolution}
                                    className="btn-secondary w-full"
                                >
                                    Download Solution
                                </button>
                            </div>
                        )}

                        {!solution && !loading && (
                            <div className="text-center py-12">
                                <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-500">
                                    Configure the problem instance and algorithm parameters, then click "Solve Problem" to generate a solution.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Solver
