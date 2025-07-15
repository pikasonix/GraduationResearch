import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'

// Components
import Layout from '@components/Layout'
import ErrorFallback from '@components/ErrorFallback'
import LoadingSpinner from '@components/LoadingSpinner'

// Pages (lazy loaded for better performance)
const Dashboard = React.lazy(() => import('@pages/Dashboard'))
const Solver = React.lazy(() => import('@pages/Solver'))
const Results = React.lazy(() => import('@pages/Results'))
const About = React.lazy(() => import('@pages/About'))
const NotFound = React.lazy(() => import('@pages/NotFound'))

function App() {
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback}>
            <Layout>
                <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/solver" element={<Solver />} />
                        <Route path="/results" element={<Results />} />
                        <Route path="/about" element={<About />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </Layout>
        </ErrorBoundary>
    )
}

export default App
