import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
    HomeIcon,
    BeakerIcon,
    ChartBarIcon,
    InformationCircleIcon,
    Bars3Icon,
    XMarkIcon
} from '@heroicons/react/24/outline'
import { useState } from 'react'

const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon },
    { name: 'Solver', href: '/solver', icon: BeakerIcon },
    { name: 'Results', href: '/results', icon: ChartBarIcon },
    { name: 'About', href: '/about', icon: InformationCircleIcon },
]

function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()

    const currentPage = navigation.find(item => item.href === location.pathname)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } transition-transform duration-300 ease-in-out lg:hidden`}>
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">P</span>
                        </div>
                        <span className="ml-2 text-lg font-semibold text-gray-900">PDPTW</span>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
                <nav className="mt-8 px-4">
                    {navigation.map((item) => {
                        const Icon = item.icon
                        return (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 ${isActive
                                        ? 'bg-primary-100 text-primary-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                            >
                                <Icon className="mr-3 h-5 w-5" />
                                {item.name}
                            </NavLink>
                        )
                    })}
                </nav>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
                    <div className="flex flex-1 flex-col pt-5 pb-4 overflow-y-auto">
                        <div className="flex items-center flex-shrink-0 px-4">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">P</span>
                            </div>
                            <span className="ml-2 text-xl font-semibold text-gray-900">PDPTW Solver</span>
                        </div>
                        <nav className="mt-8 flex-1 px-4 space-y-1">
                            {navigation.map((item) => {
                                const Icon = item.icon
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.href}
                                        className={({ isActive }) =>
                                            `group flex items-center px-3 py-2 text-sm font-medium rounded-md ${isActive
                                                ? 'bg-primary-100 text-primary-700'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`
                                        }
                                    >
                                        <Icon className="mr-3 h-5 w-5" />
                                        {item.name}
                                    </NavLink>
                                )
                            })}
                        </nav>
                    </div>
                    <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                        <div className="text-xs text-gray-500">
                            <p className="font-medium">PDPTW Solver v2.0</p>
                            <p>Advanced route optimization</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="lg:pl-64 flex flex-col flex-1">
                {/* Top bar */}
                <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow border-b border-gray-200">
                    {/* Mobile menu button */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>

                    {/* Page title and breadcrumb */}
                    <div className="flex-1 px-4 flex items-center justify-between">
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold text-gray-900">
                                {currentPage?.name || 'PDPTW Solver'}
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                {location.pathname === '/' && 'Welcome to the PDPTW problem solver dashboard'}
                                {location.pathname === '/solver' && 'Configure and solve PDPTW instances'}
                                {location.pathname === '/results' && 'View and analyze solution results'}
                                {location.pathname === '/about' && 'Learn about PDPTW algorithms and implementation'}
                            </p>
                        </div>

                        {/* Status indicator */}
                        <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                <span className="ml-2 text-sm text-gray-500">Online</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Page content */}
                <main className="flex-1">
                    <div className="py-6">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            {children}
                        </div>
                    </div>
                </main>

                {/* Footer */}
                <footer className="bg-white border-t border-gray-200 py-4">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                © 2024 PDPTW Solver. Advanced algorithms for route optimization.
                            </div>
                            <div className="flex space-x-4 text-sm text-gray-500">
                                <span>Built with React.js + Express.js</span>
                                <span>•</span>
                                <span>TailwindCSS</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    )
}

export default Layout
