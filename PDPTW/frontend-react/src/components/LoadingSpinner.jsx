import React from 'react'

function LoadingSpinner({ size = 'md', message = 'Loading...', className = '' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16'
    }

    return (
        <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
            <div className={`animate-spin rounded-full border-4 border-gray-300 border-t-primary-600 ${sizeClasses[size]}`}></div>
            {message && (
                <p className="mt-4 text-sm text-gray-600 animate-pulse">{message}</p>
            )}
        </div>
    )
}

export default LoadingSpinner
