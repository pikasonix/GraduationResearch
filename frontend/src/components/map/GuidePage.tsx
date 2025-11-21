import React from 'react';

interface GuidePageProps {
    onBack: () => void;
}

const GuidePage: React.FC<GuidePageProps> = ({ onBack }) => {
    return (
        <div className="h-full bg-gray-50 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Hướng dẫn sử dụng PDPTW Visualizer</h1>
                    <button
                        onClick={onBack}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>Quay lại bản đồ</span>
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Introduction */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4 text-blue-600">
                            <i className="fas fa-info-circle mr-2"></i>
                            Giới thiệu
                        </h2>
                        <p className="text-gray-700 leading-relaxed">
                            PDPTW Visualizer là công cụ trực quan hóa và giải quyết bài toán
                            Pickup and Delivery Problem with Time Windows (PDPTW). Công cụ này
                            giúp bạn tải lên các instance, visualize trên bản đồ, và xem kết quả
                            giải thuật.
                        </p>
                    </div>

                    {/* Getting Started */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4 text-green-600">
                            <i className="fas fa-play-circle mr-2"></i>
                            Bắt đầu
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-semibold">
                                    1
                                </div>
                                <div>
                                    <h3 className="font-medium">Tải Instance</h3>
                                    <p className="text-gray-600">Sử dụng nút "Load Instance" để tải file .txt chứa dữ liệu bài toán</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-semibold">
                                    2
                                </div>
                                <div>
                                    <h3 className="font-medium">Xem trên bản đồ</h3>
                                    <p className="text-gray-600">Các nodes sẽ hiển thị trên bản đồ với màu sắc khác nhau</p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-semibold">
                                    3
                                </div>
                                <div>
                                    <h3 className="font-medium">Tải Solution</h3>
                                    <p className="text-gray-600">Tải file solution để xem các tuyến đường được giải</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4 text-purple-600">
                            <i className="fas fa-star mr-2"></i>
                            Tính năng
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <h3 className="font-medium text-blue-800 mb-2">
                                    <i className="fas fa-map-marked-alt mr-2"></i>
                                    Visualization trên bản đồ
                                </h3>
                                <p className="text-blue-700 text-sm">
                                    Hiển thị các nodes và routes trên bản đồ thực tế với Leaflet
                                </p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <h3 className="font-medium text-green-800 mb-2">
                                    <i className="fas fa-route mr-2"></i>
                                    Real routing
                                </h3>
                                <p className="text-green-700 text-sm">
                                    Sử dụng OSRM để tính toán đường đi thực tế trên đường phố
                                </p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg">
                                <h3 className="font-medium text-red-800 mb-2">
                                    <i className="fas fa-download mr-2"></i>
                                    Export kết quả
                                </h3>
                                <p className="text-red-700 text-sm">
                                    Tải xuống solution dưới dạng file text
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* File Format */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4 text-red-600">
                            <i className="fas fa-file-alt mr-2"></i>
                            Định dạng File
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">Instance File (.txt)</h3>
                                <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                                    <div>NAME: example-instance</div>
                                    <div>TYPE: PDPTW</div>
                                    <div>SIZE: 10</div>
                                    <div>CAPACITY: 100</div>
                                    <div>NODES</div>
                                    <div>0 lat lng demand tw1 tw2 service pickup delivery</div>
                                    <div>...</div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium mb-2">Solution File (.txt)</h3>
                                <div className="bg-gray-100 p-3 rounded font-mono text-sm">
                                    <div>Instance name : example-instance</div>
                                    <div>Authors : Your Name</div>
                                    <div>Date : 2024</div>
                                    <div>Solution</div>
                                    <div>Route 1 : 0 1 2 0</div>
                                    <div>Route 2 : 0 3 4 0</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h2 className="text-xl font-semibold mb-4 text-yellow-600">
                            <i className="fas fa-lightbulb mr-2"></i>
                            Mẹo sử dụng
                        </h2>
                        <ul className="space-y-2 text-gray-700">
                            <li className="flex items-start space-x-2">
                                <i className="fas fa-check-circle text-green-500 mt-1"></i>
                                <span>Sử dụng "Load ví dụ instance" để thử nghiệm nhanh</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <i className="fas fa-check-circle text-green-500 mt-1"></i>
                                <span>Bật "Real routing" để xem đường đi thực tế trên phố</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <i className="fas fa-check-circle text-green-500 mt-1"></i>
                                <span>Click vào nodes trên bản đồ để xem thông tin chi tiết</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <i className="fas fa-check-circle text-green-500 mt-1"></i>
                                <span>Sử dụng Debug tools để kiểm tra dữ liệu</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuidePage;
