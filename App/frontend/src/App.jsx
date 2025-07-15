import { useState, useCallback } from 'react';
import MapComponent from './components/MapComponent';
import Sidebar from './components/Sidebar';
import RouteDetailsPage from './components/RouteDetailsPage';
import GuidePage from './components/GuidePage';
import './App.css';
import { useFileReader } from './hooks/useFileReader';
import { useMapControls } from './hooks/useMapControls';
import sampleInstance from './data/sampleInstance.js';
import config from './config/config';
import { debugSolution, debugInstance } from './utils/debug';

const defaultParams = config.defaultParams;

function App() {
  const { instance, solution, readInstanceFile, readSolutionFile, setInstance, setSolution } = useFileReader();
  const { useRealRouting, setUseRealRouting, routingCacheRef, generateCacheKey, loadCacheFromStorage, saveCacheToStorage, getCacheStats, showCacheInfo, clearRoutingCache, toggleRealRouting } = useMapControls();

  const [params, setParams] = useState(defaultParams);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [instanceText, setInstanceText] = useState(''); // To hold the raw text of the instance file

  // States for selected map elements
  const [selectedNodes, setSelectedNodes] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // State for page navigation
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleParamChange = (e) => {
    setParams({ ...params, [e.target.name]: e.target.value });
  };

  const handleInstanceFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const parsedInstance = await readInstanceFile(file);
        // Read file content to display in textarea
        const reader = new FileReader();
        reader.onload = (e) => setInstanceText(e.target.result);
        reader.readAsText(file);
        console.log('Instance loaded:', parsedInstance);
      } catch (error) {
        console.error('Error reading instance file:', error);
        alert('Error reading instance file: ' + error.message);
      }
    }
  };

  const handleSolutionFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        if (!instance) {
          alert('Please load an instance file first.');
          return;
        }
        const parsedSolution = await readSolutionFile(file, instance);
        console.log('Solution loaded:', parsedSolution);
      } catch (error) {
        console.error('Error reading solution file:', error);
        alert('Error reading solution file: ' + error.message);
      }
    }
  };

  const runInstance = async () => {
    if (!instanceText.trim()) {
      alert('Vui lòng nhập nội dung instance!');
      return;
    }

    setLoading(true);

    try {
      // Parse instance first if not already parsed
      if (!instance) {
        console.log('Instance not parsed yet, parsing now...');
        const blob = new Blob([instanceText], { type: 'text/plain' });
        const file = new File([blob], 'instance.txt', { type: 'text/plain' });
        const parsedInstance = await readInstanceFile(file);
        console.log('Instance parsed successfully:', parsedInstance);
        debugInstance(parsedInstance);
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log('Instance already parsed:');
        debugInstance(instance);
      }

      console.log('Running instance with params:', params);
      const apiUrl = `${config.api.baseURL}${config.api.basePath}/solve`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance: instanceText, params }),
      });

      const data = await response.json();
      console.log('Response from backend:', data);

      setResult(data.result);
      setLoading(false);

      // Auto-load solution if received
      if (data.success && data.result) {
        console.log('Solution received, loading into visualizer...');
        await loadSolutionFromText(data.result);
      } else if (!data.success) {
        console.error('Backend error:', data.error);
        alert('Lỗi từ backend: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
      alert('Lỗi kết nối: ' + error.message);
    }
  };

  const resetParameters = useCallback(() => {
    setParams(defaultParams);
  }, []);

  const loadSampleInstance = useCallback(async () => {
    setInstanceText(sampleInstance);
    try {
      // Parse the sample instance text
      const parsedInstance = await new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          const blob = new Blob([sampleInstance], { type: 'text/plain' });
          const file = new File([blob], 'sample.txt', { type: 'text/plain' });

          readInstanceFile(file).then(resolve).catch(reject);
        } catch (error) {
          reject(error);
        }
      });
      console.log('Sample instance loaded and parsed:', parsedInstance);
    } catch (error) {
      console.error('Error parsing sample instance:', error);
    }
  }, [readInstanceFile]);

  const showPage = useCallback((pageName) => {
    setCurrentPage(pageName);
  }, []);

  const loadSolutionFromText = useCallback(async (solutionText) => {
    try {
      console.log('Loading solution from text:', solutionText);

      // Debug solution format
      debugSolution(solutionText);

      // Wait for instance to be available with retry
      let retries = 5;
      while (!instance && retries > 0) {
        console.log('Waiting for instance to be available, retries left:', retries);
        await new Promise(resolve => setTimeout(resolve, 200));
        retries--;
      }

      if (!instance) {
        console.error('Instance not loaded after retries');
        alert('Vui lòng load instance trước khi load solution!');
        return;
      }

      console.log('Instance available, debugging...');
      debugInstance(instance);

      // Create a blob from the solution text
      const blob = new Blob([solutionText], { type: 'text/plain' });
      const file = new File([blob], 'solution.txt', { type: 'text/plain' });

      // Use readSolutionFile to parse the solution
      const parsedSolution = await readSolutionFile(file, instance);
      console.log('Solution loaded and parsed:', parsedSolution);
      console.log('Number of routes in solution:', parsedSolution?.routes?.length);

      if (parsedSolution && parsedSolution.routes && parsedSolution.routes.length > 0) {
        alert('Giải bài toán thành công! Kết quả đã được hiển thị trên bản đồ.');
      } else {
        console.error('Parsed solution is empty or invalid:', parsedSolution);
        alert('Solution được parse nhưng không có routes hợp lệ.');
      }
    } catch (error) {
      console.error('Error loading solution from text:', error);
      alert('Lỗi khi load solution: ' + error.message);
    }
  }, [instance, readSolutionFile]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center space-x-4">
            <i className="fas fa-route text-2xl text-blue-600"></i>
            <h1 className="text-xl font-bold text-gray-800">PDPTW Visualizer</h1>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1">
            <button
              onClick={() => showPage('dashboard')}
              className={`nav-tab px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${currentPage === 'dashboard' ? 'active' : ''}`}
              id="dashboard-tab"
            >
              <i className="fas fa-tachometer-alt mr-2"></i>Dashboard
            </button>
            <button
              onClick={() => showPage('route-details')}
              className={`nav-tab px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${currentPage === 'route-details' ? 'active' : ''}`}
              id="route-details-tab"
            >
              <i className="fas fa-route mr-2"></i>Chi tiết Routes
            </button>
            <button
              onClick={() => showPage('guide')}
              className={`nav-tab px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${currentPage === 'guide' ? 'active' : ''}`}
              id="guide-tab"
            >
              <i className="fas fa-map mr-2"></i>Hướng dẫn
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {currentPage === 'dashboard' && (
        <div id="dashboard-page" className="page-content flex flex-1">
          <Sidebar
            instance={instance}
            solution={solution}
            readInstanceFile={handleInstanceFileChange}
            readSolutionFile={handleSolutionFileChange}
            setInstanceText={setInstanceText}
            instanceText={instanceText}
            params={params}
            handleParamChange={handleParamChange}
            runInstance={runInstance}
            loading={loading}
            toggleRealRouting={toggleRealRouting}
            showCacheInfo={showCacheInfo}
            clearRoutingCache={clearRoutingCache}
            useRealRouting={useRealRouting}
            selectedNodes={selectedNodes}
            setSelectedNodes={setSelectedNodes}
            selectedRoute={selectedRoute}
            setSelectedRoute={setSelectedRoute}
            resetParameters={resetParameters}
            loadSampleInstance={loadSampleInstance}
          />

          <div className="flex-1 flex flex-col">
            <MapComponent
              instance={instance}
              solution={solution}
              useRealRouting={useRealRouting}
              selectedNodes={selectedNodes}
              setSelectedNodes={setSelectedNodes}
              selectedRoute={selectedRoute}
              setSelectedRoute={setSelectedRoute}
              onToggleRealRouting={toggleRealRouting}
            />
          </div>
        </div>
      )}

      {currentPage === 'route-details' && (
        <RouteDetailsPage
          solution={solution}
          instance={instance}
          useRealRouting={useRealRouting}
          toggleRealRouting={toggleRealRouting}
          onBack={() => setCurrentPage('dashboard')}
        />
      )}

      {currentPage === 'guide' && (
        <GuidePage
          onBack={() => setCurrentPage('dashboard')}
        />
      )}
    </div>
  );
}

export default App;