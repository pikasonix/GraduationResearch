import React from 'react'
import { Link } from 'react-router-dom'
import {
    ExclamationTriangleIcon,
    HomeIcon,
    ArrowLeftIcon
} from '@heroicons/react/24/outline'

function NotFound() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="max-w-md w-full text-center">
                <div className="mb-8">
                    <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 mx-auto mb-4" />
                    <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
                    <p className="text-gray-600 mb-8">
                        The page you're looking for doesn't exist or has been moved.
                    </p>
                </div>

                <div className="space-y-4">
                    <Link
                        to="/"
                        className="btn-primary w-full flex items-center justify-center"
                    >
                        <HomeIcon className="h-5 w-5 mr-2" />
                        Go to Dashboard
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="btn-outline w-full flex items-center justify-center"
                    >
                        <ArrowLeftIcon className="h-5 w-5 mr-2" />
                        Go Back
                    </button>
                </div>

                <div className="mt-8 text-sm text-gray-500">
                    <p>If you believe this is an error, please contact support.</p>
                </div>
            </div>
        </div>
    )
}

export default NotFound
