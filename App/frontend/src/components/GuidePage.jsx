import React from 'react';

const GuidePage = ({ onBack }) => {
    return (
        <div className="flex flex-col h-screen">
            {/* Header with back button */}
            <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 mr-4"
                    >
                        <i className="fas fa-arrow-left mr-2"></i>
                        Quay lại Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">Hướng dẫn sử dụng</h1>
                </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-6">
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        {/* Guide Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
                            <div className="flex items-center space-x-3">
                                <i className="fas fa-map text-2xl"></i>
                                <h1 className="text-2xl font-bold">Hướng dẫn sử dụng PDPTW Visualizer</h1>
                            </div>
                        </div>

                        {/* Guide Content */}
                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Getting Started */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-blue-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-play-circle text-blue-500 mr-2"></i>
                                            Bắt đầu
                                        </h2>
                                        <ol className="space-y-3 text-gray-700">
                                            <li className="flex items-start space-x-2">
                                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">1</span>
                                                <div>
                                                    <strong>Load Instance:</strong> Click "Load Instance" để tải file dữ liệu bài toán PDPTW hoặc nhập trực tiếp vào textarea.
                                                </div>
                                            </li>
                                            <li className="flex items-start space-x-2">
                                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">2</span>
                                                <div>
                                                    <strong>Tùy chỉnh tham số:</strong> Điều chỉnh các tham số thuật toán ACO trong panel bên trái (alpha, beta, số lần lặp, v.v.).
                                                </div>
                                            </li>
                                            <li className="flex items-start space-x-2">
                                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">3</span>
                                                <div>
                                                    <strong>Run Algorithm:</strong> Click "Run" để chạy thuật toán và tìm giải pháp tối ưu.
                                                </div>
                                            </li>
                                            <li className="flex items-start space-x-2">
                                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5">4</span>
                                                <div>
                                                    <strong>Visualize:</strong> Xem kết quả trên bản đồ và phân tích các route được tạo.
                                                </div>
                                            </li>
                                        </ol>
                                    </div>
                                </div>

                                {/* Dashboard Features */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-green-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-chart-line text-green-500 mr-2"></i>
                                            Tính năng Dashboard
                                        </h2>
                                        <div className="space-y-3 text-gray-700">
                                            <div className="flex items-start space-x-2">
                                                <i className="fas fa-map-marker-alt text-blue-500 mt-1"></i>
                                                <div>
                                                    <strong>Interactive Map:</strong> Bản đồ tương tác hiển thị các depot, pickup và delivery points với màu sắc phân biệt.
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <i className="fas fa-route text-green-500 mt-1"></i>
                                                <div>
                                                    <strong>Route Visualization:</strong> Hiển thị các tuyến đường với màu sắc khác nhau, có thể toggle on/off từng route.
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <i className="fas fa-info-circle text-purple-500 mt-1"></i>
                                                <div>
                                                    <strong>Node Details:</strong> Click vào các node để xem thông tin chi tiết (demand, time window, coordinates).
                                                </div>
                                            </div>
                                            <div className="flex items-start space-x-2">
                                                <i className="fas fa-chart-bar text-orange-500 mt-1"></i>
                                                <div>
                                                    <strong>Route Analysis:</strong> Phân tích hiệu quả của từng route với các metrics chi tiết.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-purple-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-cogs text-purple-500 mr-2"></i>
                                            Điều khiển
                                        </h2>
                                        <div className="space-y-3 text-gray-700">
                                            <div className="bg-gray-50 p-3 rounded">
                                                <strong className="text-blue-600">File Operations:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Load Instance: Tải file dữ liệu bài toán</li>
                                                    <li>• Load Solution: Tải file kết quả có sẵn</li>
                                                    <li>• Sample Instance: Tải dữ liệu mẫu</li>
                                                </ul>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded">
                                                <strong className="text-green-600">Algorithm Parameters:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Alpha/Beta: Trọng số pheromone và heuristic</li>
                                                    <li>• Iterations: Số lần lặp thuật toán</li>
                                                    <li>• Ants: Số lượng kiến trong colony</li>
                                                    <li>• Local Search: Xác suất thực hiện local search</li>
                                                </ul>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded">
                                                <strong className="text-purple-600">Map Controls:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Zoom: Sử dụng scroll hoặc nút +/-</li>
                                                    <li>• Pan: Kéo để di chuyển bản đồ</li>
                                                    <li>• Real Routing: Toggle between direct và road routing</li>
                                                    <li>• Route Toggle: Bật/tắt hiển thị từng route</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Algorithm Info */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-orange-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-robot text-orange-500 mr-2"></i>
                                            Thuật toán ACO
                                        </h2>
                                        <div className="space-y-3 text-gray-700">
                                            <p>
                                                <strong>Ant Colony Optimization (ACO)</strong> là thuật toán metaheuristic
                                                dựa trên hành vi tìm kiếm thức ăn của loài kiến trong tự nhiên.
                                            </p>
                                            <div className="bg-orange-50 p-3 rounded">
                                                <strong>Đặc điểm chính:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Sử dụng pheromone trail để ghi nhớ đường đi tốt</li>
                                                    <li>• Kết hợp exploration và exploitation</li>
                                                    <li>• Tích hợp greedy heuristic để cải thiện hiệu quả</li>
                                                    <li>• Local search để tối ưu hóa solution</li>
                                                </ul>
                                            </div>
                                            <div className="bg-orange-50 p-3 rounded">
                                                <strong>Hybrid với Greedy:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Greedy bias điều khiển mức độ exploit</li>
                                                    <li>• Elite solutions được update pheromone mạnh hơn</li>
                                                    <li>• Restart mechanism tránh local optimum</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tips */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-red-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-lightbulb text-red-500 mr-2"></i>
                                            Tips & Tricks
                                        </h2>
                                        <div className="space-y-3 text-gray-700">
                                            <div className="bg-red-50 p-3 rounded">
                                                <strong>Performance:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Tăng số iterations cho bài toán phức tạp</li>
                                                    <li>• Điều chỉnh alpha/beta để balance exploration/exploitation</li>
                                                    <li>• Sử dụng elite solutions để tập trung vào giải pháp tốt</li>
                                                </ul>
                                            </div>
                                            <div className="bg-red-50 p-3 rounded">
                                                <strong>Visualization:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Sử dụng real routing để xem đường đi thực tế</li>
                                                    <li>• Toggle routes để so sánh hiệu quả</li>
                                                    <li>• Xem route analysis để hiểu chất lượng solution</li>
                                                </ul>
                                            </div>
                                            <div className="bg-red-50 p-3 rounded">
                                                <strong>Troubleshooting:</strong>
                                                <ul className="mt-2 space-y-1 text-sm">
                                                    <li>• Nếu không tìm được solution, tăng iterations hoặc ants</li>
                                                    <li>• Real routing có thể chậm với instance lớn</li>
                                                    <li>• Cache routing được lưu để tăng tốc độ</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* FAQ */}
                                <div className="space-y-6">
                                    <div className="border-l-4 border-indigo-500 pl-4">
                                        <h2 className="text-xl font-semibold text-gray-800 mb-3">
                                            <i className="fas fa-question-circle text-indigo-500 mr-2"></i>
                                            FAQ
                                        </h2>
                                        <div className="space-y-4 text-gray-700">
                                            <div className="bg-indigo-50 p-3 rounded">
                                                <strong className="text-indigo-800">Q: Làm sao để tải dữ liệu mẫu?</strong>
                                                <p className="mt-1 text-sm">A: Click nút "Load Sample Instance" trong panel điều khiển bên trái.</p>
                                            </div>
                                            <div className="bg-indigo-50 p-3 rounded">
                                                <strong className="text-indigo-800">Q: Tại sao real routing chậm?</strong>
                                                <p className="mt-1 text-sm">A: Lần đầu sử dụng real routing sẽ chậm hơn vì phải gọi OSRM API. Kết quả sẽ được cache nên những lần sau sẽ nhanh hơn.</p>
                                            </div>
                                            <div className="bg-indigo-50 p-3 rounded">
                                                <strong className="text-indigo-800">Q: Thuật toán không tìm được solution?</strong>
                                                <p className="mt-1 text-sm">A: Thử tăng số iterations, số ants, hoặc giảm greedy bias để tăng exploration.</p>
                                            </div>
                                            <div className="bg-indigo-50 p-3 rounded">
                                                <strong className="text-indigo-800">Q: Làm sao để so sánh các route?</strong>
                                                <p className="mt-1 text-sm">A: Sử dụng Route Analysis panel để xem metrics chi tiết của từng route, hoặc vào trang Route Details để xem timeline.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-gray-500">
                                <p className="text-sm">
                                    PDPTW Visualizer - Pickup and Delivery Problem with Time Windows
                                </p>
                                <p className="text-xs mt-1">
                                    Powered by Hybrid ACO-Greedy Algorithm
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuidePage;
