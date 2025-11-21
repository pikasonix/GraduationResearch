import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrackAsiaTrafficService from '@/services/TrackAsiaTrafficService';
import trackAsiaLoader from '@/utils/TrackAsiaLoader';
import '../../styles/track-asia.css';

interface Props {
    onBack?: () => void;
}

const TrackAsiaTrafficPage: React.FC<Props> = ({ onBack }) => {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const [trafficService, setTrafficService] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCity, setSelectedCity] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [trafficVisible, setTrafficVisible] = useState(true);
    const [routeInfo, setRouteInfo] = useState<any | null>(null);
    const [mapStyle, setMapStyle] = useState('street');
    const [trafficData, setTrafficData] = useState<any | null>(null);

    useEffect(() => {
        if (trafficService && trafficService.map) {
            const handleResize = () => {
                setTimeout(() => {
                    trafficService.map.resize();
                }, 100);
            };

            window.addEventListener('resize', handleResize);
            setTimeout(() => trafficService.map.resize(), 300);

            return () => window.removeEventListener('resize', handleResize);
        }
    }, [trafficService]);

    useEffect(() => {
        let mounted = true;

        const initializeMap = async () => {
            try {
                setIsLoading(true);
                setError(null);

                await trackAsiaLoader.load();

                if (!mounted) return;

                const service = new TrackAsiaTrafficService();
                await service.initializeMap('track-asia-map', { zoom: 11, center: [105.8194, 21.0227] });
                await service.addTrafficLayer();

                setTrafficService(service);
                setTrafficVisible(service.isTrafficVisible());
                setIsLoading(false);

                setTimeout(() => {
                    getTrafficDataForLocation(21.0227, 105.8194);
                }, 1000);
            } catch (err: any) {
                console.error('Failed to initialize Track Asia Map:', err);
                if (mounted) {
                    setError(err?.message || String(err));
                    setIsLoading(false);
                }
            }
        };

        initializeMap();

        return () => {
            mounted = false;
            if (trafficService) trafficService.destroy?.();
        };
    }, []);

    const handleSearch = useCallback(async (query: string) => {
        if (!trafficService || !query.trim()) {
            setSearchResults([]);
            return;
        }
        try {
            const results = await trafficService.searchPlaces(query);
            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        }
    }, [trafficService]);

    useEffect(() => {
        const id = setTimeout(() => {
            if (searchQuery) handleSearch(searchQuery);
            else setSearchResults([]);
        }, 300);
        return () => clearTimeout(id);
    }, [searchQuery, handleSearch]);

    const handleCitySelect = (cityName: string) => {
        if (!trafficService) return;
        const city = trafficService.navigateToCity(cityName);
        if (city) {
            setSelectedCity(cityName);
            getTrafficDataForLocation(city.lat, city.lng);
        }
    };

    const handleSearchResultSelect = (result: any) => {
        if (!trafficService || !result.center) return;
        const [lng, lat] = result.center;
        trafficService.map.flyTo({ center: [lng, lat], zoom: 14, duration: 2000 });
        trafficService.clearMarkers();
        trafficService.addMarker({ lat, lng }, { popup: `<strong>${result.place_name}</strong>` });
        setSearchQuery('');
        setSearchResults([]);
        getTrafficDataForLocation(lat, lng);
    };

    const getTrafficDataForLocation = async (lat: number, lng: number) => {
        if (!trafficService) return;
        try {
            const data = await trafficService.getTrafficConditions(lat, lng);
            setTrafficData(data);
        } catch (err) {
            console.error('Error getting traffic data:', err);
            setTrafficData({ location: { lat, lng }, congestion: 'unknown', speed: { current: 0, freeFlow: 0, ratio: 0 }, travelTime: { current: 0, freeFlow: 0 }, incidents: [{ type: 'error', description: 'Không thể tải dữ liệu giao thông', severity: 'high' }], lastUpdated: new Date().toISOString(), dataSource: 'error' });
        }
    };

    const toggleTraffic = () => {
        if (!trafficService) return;
        const isVisible = trafficService.toggleTrafficLayer();
        setTrafficVisible(isVisible);
    };

    const handleStyleChange = (style: string) => {
        if (!trafficService) return;
        if (!trafficService.isValidStyle || !trafficService.isValidStyle(style)) return;
        try {
            trafficService.switchMapStyle(style);
            setMapStyle(style);
            if (style === 'traffic') setTrafficVisible(true);
        } catch (err) { console.error('Error changing map style:', err); }
    };

    const calculateRoute = async (start: any, end: any) => {
        if (!trafficService) return;
        try {
            const routes = await trafficService.calculateRoute(start, end);
            if (routes.length > 0) {
                const route = routes[0];
                trafficService.displayRoute(route);
                setRouteInfo({ distance: (route.distance / 1000).toFixed(1) + ' km', duration: Math.round(route.duration / 60) + ' phút', summary: route.legs?.[0]?.summary || 'Tuyến đường được tính toán' });
            }
        } catch (err) { console.error('Error calculating route:', err); }
    };

    const formatCongestion = (level: string) => {
        const levels: any = {
            free: { text: 'Thông thoáng', color: 'text-green-600', bg: 'bg-green-100' },
            light: { text: 'Tắc nghẽn nhẹ', color: 'text-yellow-600', bg: 'bg-yellow-100' },
            moderate: { text: 'Tắc nghẽn vừa', color: 'text-orange-600', bg: 'bg-orange-100' },
            heavy: { text: 'Tắc nghẽn nặng', color: 'text-red-600', bg: 'bg-red-100' },
            unknown: { text: 'Không xác định', color: 'text-gray-600', bg: 'bg-gray-100' }
        };
        return levels[level] || levels.unknown;
    };

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-4xl mx-auto pt-20 px-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
                        <div className="bg-red-600 px-6 py-4">
                            <div className="flex items-center">
                                <div className="bg-white bg-opacity-20 p-3 rounded-xl">
                                    <i className="fas fa-exclamation-triangle text-white text-2xl"></i>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-white font-bold text-xl">Lỗi tải Track Asia Maps</h3>
                                    <p className="text-red-100 text-sm">Không thể kết nối đến dịch vụ Track Asia Maps</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <div className="text-sm text-red-700">
                                    <p className="font-medium mb-2">Chi tiết lỗi:</p>
                                    <p className="font-mono text-xs bg-red-100 p-2 rounded">{error}</p>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-yellow-800 mb-3">🔧 Các bước khắc phục:</h4>
                                    <ul className="text-sm text-yellow-700 space-y-2">
                                        <li>• Kiểm tra kết nối internet</li>
                                        <li>• Verify API key trong file .env</li>
                                        <li>• Restart development server</li>
                                        <li>• Xem browser console để biết thêm chi tiết</li>
                                    </ul>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                    <h4 className="font-semibold text-blue-800 mb-3">🇻🇳 Về Track Asia Maps:</h4>
                                    <ul className="text-sm text-blue-700 space-y-2">
                                        <li>• Giải pháp bản đồ số Việt Nam</li>
                                        <li>• Chi phí thấp, dữ liệu chính xác</li>
                                        <li>• API key miễn phí tại track-asia.com</li>
                                        <li>• Tối ưu cho khu vực Đông Nam Á</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="flex justify-center space-x-4 mt-6">
                                <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-all duration-200 flex items-center"><i className="fas fa-redo mr-2"></i>Tải lại trang</button>
                                <a href="https://track-asia.com/" target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 flex items-center"><i className="fas fa-external-link-alt mr-2"></i>Track Asia Website</a>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 bg-green-50 rounded-2xl p-6 border border-green-200">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-gray-800 mb-4"><i className="fas fa-question-circle text-green-600 mr-2"></i>Cần hỗ trợ?</h3>
                            <div className="flex justify-center space-x-6 text-sm">
                                <a href="https://docs.track-asia.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium flex items-center"><i className="fas fa-book mr-1"></i>Tài liệu API</a>
                                <a href="mailto:support@track-asia.com" className="text-green-600 hover:text-green-800 font-medium flex items-center"><i className="fas fa-envelope mr-1"></i>Hỗ trợ kỹ thuật</a>
                                <a href="tel:0931824182" className="text-purple-600 hover:text-purple-800 font-medium flex items-center"><i className="fas fa-phone mr-1"></i>Hotline</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-lg border-b-2 border-blue-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="bg-blue-600 p-3 rounded-xl"><i className="fas fa-map-marked-alt text-white text-2xl"></i></div>
                            <div>
                                <h1 className="text-3xl font-bold text-blue-600"><i className="fas fa-flag mr-2"></i>Track Asia Maps</h1>
                                <p className="text-gray-600 text-sm mt-1">Giải pháp bản đồ số Made in Vietnam - Theo dõi giao thông thời gian thực</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="hidden md:flex items-center space-x-3 text-sm">
                                <div className="flex items-center bg-green-50 px-3 py-1 rounded-full"><div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div><span className="text-green-700 font-medium">API Connected</span></div>
                                <div className="text-gray-500">|</div>
                                <a href="https://track-asia.com/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500">track-asia.com</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="col-span-2">
                        <div className="bg-white rounded-lg shadow p-4 relative">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center h-full bg-gray-50 z-10"><div className="text-center"><div className="relative"><div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div><div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-map-marked-alt text-blue-600 text-lg"></i></div></div><p className="mt-4 text-gray-600 font-medium"><i className="fas fa-flag text-blue-600 mr-2"></i>Đang tải Track Asia Maps...</p><p className="text-sm text-gray-500 mt-2">Đang kết nối đến server Track Asia</p></div></div>
                            )}
                            <div id="track-asia-map" ref={mapContainer} className="w-full h-[600px]" style={{ width: '100%', height: '600px', position: 'relative', overflow: 'hidden', minHeight: '600px' }} />
                        </div>

                        {!isLoading && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-6 text-xs">
                                        <div className="text-gray-600 font-medium mb-1">Chú thích giao thông:</div>
                                        <div className="flex items-center space-x-4">
                                            <div className="flex items-center"><div className="w-4 h-2 bg-green-400 rounded-full mr-2"></div><span className="text-gray-600">Thông thoáng</span></div>
                                            <div className="flex items-center"><div className="w-4 h-2 bg-yellow-500 rounded-full mr-2"></div><span className="text-gray-600">Tắc nhẹ</span></div>
                                            <div className="flex items-center"><div className="w-4 h-2 bg-orange-500 rounded-full mr-2"></div><span className="text-gray-600">Tắc vừa</span></div>
                                            <div className="flex items-center"><div className="w-4 h-2 bg-red-500 rounded-full mr-2"></div><span className="text-gray-600">Tắc nặng</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="col-span-1">
                        <div className="bg-white rounded-lg shadow p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-700">Controls</h3>
                                <div className="text-xs text-gray-500">{trafficVisible ? 'Traffic ON' : 'Traffic OFF'}</div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex space-x-2">
                                    <button onClick={toggleTraffic} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Toggle Traffic</button>
                                    <button onClick={() => handleStyleChange('street')} className="px-3 py-2 bg-gray-100 rounded">Street</button>
                                    <button onClick={() => handleStyleChange('satellite')} className="px-3 py-2 bg-gray-100 rounded">Satellite</button>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-600 mb-1">Search places</label>
                                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Search..." />
                                    {searchResults.length > 0 && (
                                        <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 text-sm">
                                            {searchResults.map((r: any, i: number) => (
                                                <div key={i} className="p-2 hover:bg-gray-50 cursor-pointer" onClick={() => handleSearchResultSelect(r)} dangerouslySetInnerHTML={{ __html: r.place_name }} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {routeInfo && (
                                    <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                                        <div className="text-sm text-gray-700">Distance: {routeInfo.distance}</div>
                                        <div className="text-sm text-gray-700">Duration: {routeInfo.duration}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackAsiaTrafficPage;
