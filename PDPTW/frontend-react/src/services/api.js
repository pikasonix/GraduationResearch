import axios from 'axios'
import toast from 'react-hot-toast'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Create axios instance with default configuration
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 minutes timeout for algorithm execution
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor for loading states and authentication
apiClient.interceptors.request.use(
    (config) => {
        // Add any authentication headers here if needed
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => {
        return response
    },
    (error) => {
        const message = error.response?.data?.error || error.message || 'An error occurred'

        // Don't show toast for certain error codes (let components handle them)
        const silentErrors = [400, 401, 404]
        if (!silentErrors.includes(error.response?.status)) {
            toast.error(message)
        }

        return Promise.reject(error)
    }
)

/**
 * PDPTW API Client Class
 */
class PDPTWApiClient {
    /**
     * Health check endpoint
     */
    async healthCheck() {
        try {
            const response = await apiClient.get('/api/health')
            return response.data
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`)
        }
    }

    /**
     * Get available algorithms
     */
    async getAlgorithms() {
        try {
            const response = await apiClient.get('/api/algorithms')
            return response.data
        } catch (error) {
            throw new Error(`Failed to fetch algorithms: ${error.message}`)
        }
    }

    /**
     * Validate PDPTW instance
     */
    async validateInstance(instanceContent) {
        try {
            const response = await apiClient.post('/api/validate-instance', {
                instance: instanceContent
            })
            return response.data
        } catch (error) {
            throw new Error(`Instance validation failed: ${error.response?.data?.error || error.message}`)
        }
    }

    /**
     * Solve PDPTW problem
     */
    async solveProblem(instanceContent, algorithm, parameters = {}) {
        try {
            const response = await apiClient.post('/api/solve', {
                instance: instanceContent,
                algorithm: algorithm,
                params: parameters
            })
            return response.data
        } catch (error) {
            throw new Error(`Problem solving failed: ${error.response?.data?.error || error.message}`)
        }
    }

    /**
     * Upload instance file
     */
    async uploadInstance(file) {
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await apiClient.post('/api/upload-instance', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(`File upload failed: ${error.response?.data?.error || error.message}`)
        }
    }

    /**
     * Upload solution file
     */
    async uploadSolution(file) {
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await apiClient.post('/api/upload-solution', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(`Solution upload failed: ${error.response?.data?.error || error.message}`)
        }
    }

    /**
     * Get sample instance
     */
    async getSampleInstance() {
        try {
            const response = await apiClient.get('/api/sample-instance')
            return response.data
        } catch (error) {
            throw new Error(`Failed to fetch sample instance: ${error.message}`)
        }
    }

    /**
     * Download file helper
     */
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
    }

    /**
     * Format file size helper
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes'

        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    /**
     * Format execution time helper
     */
    formatExecutionTime(milliseconds) {
        if (milliseconds < 1000) {
            return `${milliseconds}ms`
        } else if (milliseconds < 60000) {
            return `${(milliseconds / 1000).toFixed(2)}s`
        } else {
            const minutes = Math.floor(milliseconds / 60000)
            const seconds = ((milliseconds % 60000) / 1000).toFixed(0)
            return `${minutes}m ${seconds}s`
        }
    }

    /**
     * Validate file type and size
     */
    validateFile(file, maxSizeBytes = 10 * 1024 * 1024, allowedTypes = ['.txt']) {
        const errors = []

        // Check file size
        if (file.size > maxSizeBytes) {
            errors.push(`File size exceeds ${this.formatFileSize(maxSizeBytes)}`)
        }

        // Check file type
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase()
        if (!allowedTypes.includes(fileExtension)) {
            errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`)
        }

        return {
            valid: errors.length === 0,
            errors
        }
    }

    /**
     * Parse solution data for visualization
     */
    parseSolutionData(solutionContent) {
        try {
            const lines = solutionContent.trim().split('\n')
            const routes = []
            let currentRoute = null
            let totalCost = 0
            let totalVehicles = 0

            for (const line of lines) {
                const trimmed = line.trim()

                if (trimmed.startsWith('Route')) {
                    if (currentRoute) {
                        routes.push(currentRoute)
                    }
                    currentRoute = {
                        id: routes.length + 1,
                        nodes: [],
                        cost: 0,
                        load: 0
                    }
                    totalVehicles++
                } else if (trimmed.startsWith('Cost:')) {
                    const cost = parseFloat(trimmed.split(':')[1]?.trim() || 0)
                    if (currentRoute) {
                        currentRoute.cost = cost
                    }
                    totalCost += cost
                } else if (trimmed.includes('->')) {
                    // Parse route nodes
                    const nodes = trimmed.split('->').map(node => node.trim())
                    if (currentRoute) {
                        currentRoute.nodes = nodes
                    }
                }
            }

            if (currentRoute) {
                routes.push(currentRoute)
            }

            return {
                routes,
                totalCost,
                totalVehicles,
                totalCustomers: routes.reduce((sum, route) => sum + Math.max(0, route.nodes.length - 2), 0)
            }
        } catch (error) {
            throw new Error(`Failed to parse solution data: ${error.message}`)
        }
    }
}

// Create and export singleton instance
const apiClient_instance = new PDPTWApiClient()
export default apiClient_instance

// Export class for testing purposes
export { PDPTWApiClient }
