import React, { useState } from 'react';

// Function to generate result text for download
const generateResultText = (solution, instance) => {
  let result = '';

  // Header information in the specified format
  const instanceName = instance?.name || 'unknown-instance';
  const currentDate = new Date().getFullYear();

  result += `Instance name : ${instanceName}\n`;
  result += `Authors       : Pix\n`;
  result += `Date          : ${currentDate}\n`;
  result += `Reference     : Simplified Hybrid ACO + Pure Greedy\n`;
  result += `Solution\n`;

  // Route details in the specified format
  solution.routes.forEach((route, index) => {
    const routeNumber = route.id || (index);
    const sequence = route.sequence.join(' ');
    result += `Route ${routeNumber} : ${sequence}\n`;
  });

  return result;
};

const Sidebar = ({
  instance,
  solution,
  readInstanceFile,
  readSolutionFile,
  setInstanceText,
  instanceText,
  params,
  handleParamChange,
  runInstance,
  loading,
  toggleRealRouting,
  showCacheInfo,
  clearRoutingCache,
  useRealRouting,
  // New prop for resetting parameters
  resetParameters,
  // Sample instance loader
  loadSampleInstance,
}) => {
  return (
    <div className="w-80 bg-white shadow-xl border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <h2 className="text-lg font-semibold">Điều khiển</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* Load Instance Section */}
        <div className="p-4 border-b border-gray-200">
          <label htmlFor="load_instance" className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer">
            <i className="fa fa-folder-open text-blue-600"></i>
            <span className="font-medium text-gray-700">Load Instance</span>
          </label>
          <input type="file" id="load_instance" className="hidden" accept=".txt" onChange={readInstanceFile} />
        </div>

        {/* Instance Form */}
        <div className="p-4 border-b border-gray-200">
          <label htmlFor="instance_textarea" className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-2">
            <i className="fas fa-edit text-blue-600"></i>
            <span>Nhập nội dung instance:</span>
          </label>
          <textarea
            id="instance_textarea"
            rows="6"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm font-mono"
            placeholder="Paste nội dung instance.txt hoặc click 'Load ví dụ' để thử..."
            value={instanceText}
            onChange={(e) => setInstanceText(e.target.value)}
          ></textarea>

          {/* Load Sample Button */}
          <button
            type="button"
            onClick={loadSampleInstance}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors duration-200 mt-2"
          >
            <i className="fas fa-download"></i>
            <span>Load ví dụ instance</span>
          </button>

          <h3 className="text-md font-semibold mb-2 mt-4">Tham số thuật toán</h3>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {Object.keys(params).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700">{key}</label>
                <input
                  type="number"
                  name={key}
                  value={params[key]}
                  onChange={handleParamChange}
                  className="w-full p-2 border rounded"
                />
              </div>
            ))}
          </div>
          <button
            className="w-full bg-green-600 hover:bg-green-700 text-white p-2 mt-4 rounded font-medium transition-colors duration-200"
            onClick={runInstance}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Đang chạy...
              </>
            ) : (
              <>
                <i className="fas fa-play mr-2"></i>
                Chạy giải bài toán
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetParameters}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md transition-colors duration-200 mt-2"
          >
            <i className="fas fa-undo"></i>
            <span>Reset tham số mặc định</span>
          </button>
        </div>

        {/* Load Solution Section */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <label htmlFor="load_solution" className="w-full flex items-center space-x-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer">
            <i className="fa fa-file-alt text-blue-600"></i>
            <span className="font-medium text-gray-700">Load Solution</span>
          </label>
          <input type="file" id="load_solution" className="hidden" accept=".txt" onChange={readSolutionFile} />
        </div>

        {/* Real Routing Controls */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <button
            id="toggle_routing_btn"
            onClick={toggleRealRouting}
            className={`w-full flex items-center justify-center space-x-2 px-3 py-2 text-white text-sm rounded transition-colors duration-200 ${useRealRouting ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}`}
          >
            <i className={`fas ${useRealRouting ? 'fa-route' : 'fa-map-marked-alt'}`}></i>
            <span>{useRealRouting ? 'Tắt đường thực tế' : 'Bật đường thực tế'}</span>
          </button>

          {/* Routing Profile Selection */}
          {useRealRouting && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <label className="block text-xs font-medium text-gray-700 mb-2">Loại đường:</label>
              <select
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                defaultValue={localStorage.getItem('routingProfile') || 'walking'}
                onChange={(e) => {
                  // Store routing profile in localStorage
                  localStorage.setItem('routingProfile', e.target.value);
                  // Force refresh routes if solution exists
                  if (solution && solution.routes) {
                    // Trigger a re-render by dispatching a custom event
                    window.dispatchEvent(new CustomEvent('routingProfileChanged'));
                  }
                }}
              >
                <option value="walking">Đi bộ (đường ngắn nhất)</option>
                <option value="driving">Xe hơi (đường lớn)</option>
                <option value="cycling">Xe đạp (cân bằng)</option>
              </select>
              <div className="text-xs text-gray-500 mt-1">
                Đi bộ: Tìm đường ngắn nhất qua mọi loại đường
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={showCacheInfo}
              className="flex-1 flex items-center justify-center space-x-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors duration-200"
            >
              <i className="fas fa-info-circle"></i>
              <span>Cache Info</span>
            </button>
            <button
              onClick={clearRoutingCache}
              className="flex-1 flex items-center justify-center space-x-1 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors duration-200"
            >
              <i className="fas fa-trash"></i>
              <span>Xóa Cache</span>
            </button>
          </div>
        </div>

        {/* Result Download Section */}
        {solution && solution.routes && solution.routes.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="flex items-center space-x-2 text-sm font-medium text-gray-700 mb-3">
              <i className="fas fa-download text-blue-600"></i>
              <span>Kết quả</span>
            </h3>
            <div className="bg-gray-50 p-3 rounded-lg mb-3">
              <div className="text-xs text-gray-600 space-y-1">
                <div>Tổng số routes: <span className="font-medium">{solution.routes.length}</span></div>
                <div>Tổng chi phí: <span className="font-medium">{solution.total_cost}</span></div>
                <div>Thời gian thực hiện: <span className="font-medium">{solution.execution_time}</span></div>
              </div>
            </div>
            <button
              onClick={() => {
                const resultText = generateResultText(solution, instance);
                const blob = new Blob([resultText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'solution_result.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors duration-200"
            >
              <i className="fas fa-file-download"></i>
              <span>Tải xuống kết quả</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;