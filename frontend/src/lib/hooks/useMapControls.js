import { useState, useCallback, useRef } from 'react';

export function useMapControls() {
  const [useRealRouting, setUseRealRouting] = useState(false);
  const routingCacheRef = useRef(new Map()); // Use ref for mutable cache

  const generateCacheKey = useCallback((startCoord, endCoord) => {
    return `${startCoord[0].toFixed(6)},${startCoord[1].toFixed(6)}-${endCoord[0].toFixed(6)},${endCoord[1].toFixed(6)}`;
  }, []);

  const loadCacheFromStorage = useCallback(() => {
    try {
      const cached = localStorage.getItem('pdptw_routing_cache');
      if (cached) {
        const data = JSON.parse(cached);
        routingCacheRef.current = new Map(data);
        console.log(`Loaded ${routingCacheRef.current.size} cached routes from storage`);
      }
    } catch (error) {
      console.warn('Error loading cache from storage:', error);
      routingCacheRef.current = new Map();
    }
  }, []);

  const saveCacheToStorage = useCallback(() => {
    try {
      const data = Array.from(routingCacheRef.current.entries());
      localStorage.setItem('pdptw_routing_cache', JSON.stringify(data));
      console.log(`Saved ${routingCacheRef.current.size} routes to cache`);
    } catch (error) {
      console.warn('Error saving cache to storage:', error);
    }
  }, []);

  const getCacheStats = useCallback(() => {
    const cacheSize = routingCacheRef.current.size;
    let storageSize = 0;
    try {
      const cached = localStorage.getItem('pdptw_routing_cache');
      storageSize = cached ? (cached.length * 2) / 1024 : 0; // Approximate size in KB
    } catch (error) {
      // Ignore errors
    }
    return { entries: cacheSize, sizeKB: storageSize.toFixed(1) };
  }, []);

  const showCacheInfo = useCallback(() => {
    const stats = getCacheStats();
    const cacheSize = (JSON.stringify(Array.from(routingCacheRef.current.entries())).length / 1024).toFixed(2);

    const info = `
Thông tin Cache:
• Số tuyến đường đã lưu: ${stats.entries}
• Kích thước cache: ${cacheSize} KB
• Cache trong localStorage: ${localStorage.getItem('pdptw_routing_cache') ? 'Có' : 'Không'}
    `.trim();

    alert(info);
  }, [getCacheStats]);

  const clearRoutingCache = useCallback(() => {
    routingCacheRef.current.clear();
    localStorage.removeItem('pdptw_routing_cache');
    console.log('Routing cache cleared');
  }, []);

  const toggleRealRouting = useCallback(() => {
    setUseRealRouting(prev => !prev);
  }, []);

  return {
    useRealRouting,
    setUseRealRouting,
    routingCacheRef,
    generateCacheKey,
    loadCacheFromStorage,
    saveCacheToStorage,
    getCacheStats,
    showCacheInfo,
    clearRoutingCache,
    toggleRealRouting,
  };
}
