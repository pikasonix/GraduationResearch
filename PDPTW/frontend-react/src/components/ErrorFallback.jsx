import React from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

function ErrorFallback({ error, resetErrorBoundary }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Oops! Something went wrong
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        We encountered an unexpected error. Please try refreshing the page.
                    </p>
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <h3 className="text-sm font-medium text-red-800 mb-2">Error details:</h3>
                        <p className="text-sm text-red-700 font-mono">{error.message}</p>
                    </div>
                )}

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={resetErrorBoundary}
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <ArrowPathIcon className="h-5 w-5 mr-2" />
                        Try again
                    </button>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Go to homepage
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        If this problem persists, please contact support with the error details above.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default ErrorFallback
