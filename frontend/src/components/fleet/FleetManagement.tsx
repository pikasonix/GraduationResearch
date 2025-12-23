import React, { useState, useEffect } from 'react';
import {
    getManagerTeam,
    getTeamStatistics,
    TeamWithDetails,
    TeamStatistics,
    getDrivers,
    getVehicles
} from '@/services/driverService';
import { useGetSessionQuery } from '@/lib/redux/services/auth';
import { useGetUserQuery } from '@/lib/redux/services/userApi';
import DriverList from './DriverList';
import VehicleList from './VehicleList';
import FleetStatistics from './FleetStatistics';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FleetManagement() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [teamData, setTeamData] = useState<TeamWithDetails | null>(null);
    const [statistics, setStatistics] = useState<TeamStatistics>({
        total_drivers: 0,
        active_drivers: 0,
        total_vehicles: 0,
        active_vehicles: 0
    });
    const [loading, setLoading] = useState(true);

    const activeTab = searchParams.get('tab') === 'vehicles' ? 'vehicles' : 'drivers';

    // Get current session and user
    const { data: session } = useGetSessionQuery();
    const userId = session?.user?.id;
    const { data: currentUser, isLoading: userLoading } = useGetUserQuery(userId ?? "", {
        skip: !userId,
    });

    const handleTabChange = (tab: 'drivers' | 'vehicles') => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`/fleet?${params.toString()}`);
    };

    const fetchData = async () => {
        if (!currentUser?.id) {
            console.log('No current user ID');
            return;
        }

        console.log('Fetching data for user:', currentUser);
        setLoading(true);
        try {
            if (currentUser.role === 'super_admin' || currentUser.role === 'admin') {
                // Admin can see all resources across all organizations
                console.log('User is admin, fetching all resources...');
                const [driversData, vehiclesData] = await Promise.all([
                    getDrivers(undefined, true), // Get all drivers
                    getVehicles(undefined, true) // Get all vehicles
                ]);
                console.log('Admin data:', { drivers: driversData, vehicles: vehiclesData });

                // Create a view for admins showing all resources
                setTeamData({
                    id: 'admin-view',
                    name: 'Quản lý hệ thống',
                    description: 'Admin view of all resources',
                    is_active: true,
                    manager_id: currentUser.id,
                    organization_id: currentUser.organization_id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    drivers: driversData,
                    vehicles: vehiclesData,
                    manager: null
                });
                setStatistics({
                    total_drivers: driversData.length,
                    active_drivers: driversData.filter(d => d.is_active).length,
                    total_vehicles: vehiclesData.length,
                    active_vehicles: vehiclesData.filter(v => v.is_active).length
                });
            } else if (currentUser.role === 'manager') {
                // Manager only sees their own team
                console.log('User is manager, fetching team...');
                const team = await getManagerTeam(currentUser.id);
                console.log('Team data:', team);
                if (team) {
                    setTeamData(team);
                    // Calculate stats directly from fetched data to ensure consistency (and handling if vehicles lack team_id)
                    setStatistics({
                        total_drivers: team.drivers.length,
                        active_drivers: team.drivers.filter(d => d.is_active).length,
                        total_vehicles: team.vehicles.length,
                        active_vehicles: team.vehicles.filter(v => v.is_active).length
                    });
                } else {
                    console.log('No team found for manager');
                    toast.info('Bạn chưa được phân công đội xe nào');
                }
            } else {
                console.log('User role not allowed:', currentUser.role);
                toast.info('Bạn không có quyền truy cập trang này');
            }
        } catch (error) {
            console.error('Error fetching fleet data:', error);
            toast.error('Không thể tải dữ liệu đội xe');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!userLoading && currentUser) {
            fetchData();
        }
    }, [currentUser, userLoading]);

    if (userLoading || loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    if (!teamData) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản lý Đội xe</h1>
                    <p className="text-gray-500">Quản lý tài xế và phương tiện.</p>
                </div>
                <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
                    <div className="text-gray-300 mb-4">
                        <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {currentUser?.role === 'manager' ? 'Chưa có đội xe' : 'Không có quyền truy cập'}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                        {currentUser?.role === 'manager'
                            ? 'Bạn chưa được phân công đội xe. Vui lòng liên hệ quản trị viên.'
                            : 'Trang này dành cho Manager và Admin.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-6 max-w-7xl">
            {/* Minimal Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Quản lý Đội xe</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {teamData.id === 'admin-view'
                            ? 'Hệ thống toàn cục'
                            : `Đội: ${teamData.name}`
                        }
                    </p>
                </div>
                {/* Could add action buttons here later */}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Modern Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button
                                onClick={() => handleTabChange('drivers')}
                                className={`${activeTab === 'drivers'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                `}
                            >
                                Tài xế <span className="ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{teamData.drivers.length}</span>
                            </button>
                            <button
                                onClick={() => handleTabChange('vehicles')}
                                className={`${activeTab === 'vehicles'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                `}
                            >
                                Phương tiện <span className="ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{teamData.vehicles.length}</span>
                            </button>
                        </nav>
                    </div>

                    {/* List Views */}
                    <div className="min-h-[400px] animate-in fade-in duration-300">
                        {activeTab === 'drivers' ? (
                            <DriverList
                                drivers={teamData.drivers}
                                onRefresh={fetchData}
                                teamId={teamData.id}
                                organizationId={teamData.organization_id}
                            />
                        ) : (
                            <VehicleList
                                vehicles={teamData.vehicles}
                                onRefresh={fetchData}
                                teamId={teamData.id}
                                organizationId={teamData.organization_id}
                            />
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Statistics (1/3) */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Thống kê & Phân tích</h3>
                        <FleetStatistics
                            statistics={statistics}
                            className="space-y-4"
                            gridClassName="grid grid-cols-1 gap-4"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

