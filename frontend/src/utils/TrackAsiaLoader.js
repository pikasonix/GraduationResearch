/**
 * Track Asia Loader - Utility để load Track Asia GL JS library
 * 
 * Đây là utility giúp load Track Asia GL JS script và CSS một cách động
 * và đảm bảo chỉ load một lần duy nhất
 */

class TrackAsiaLoader {
    constructor() {
        this.isLoading = false;
        this.isLoaded = false;
        this.loadPromise = null;

        // Track Asia CDN URLs
        this.scriptUrl = 'https://unpkg.com/trackasia-gl@latest/dist/trackasia-gl.js';
        this.cssUrl = 'https://unpkg.com/trackasia-gl@latest/dist/trackasia-gl.css';

        // Timeout for loading scripts
        this.loadTimeout = 30000; // 30 seconds
    }

    /**
     * Load Track Asia GL JS library
     * @returns {Promise} Promise that resolves when library is loaded
     */
    async load() {
        // If already loaded, return immediately
        if (this.isLoaded && window.trackasiagl) {
            return Promise.resolve(window.trackasiagl);
        }

        // If currently loading, return existing promise
        if (this.isLoading && this.loadPromise) {
            return this.loadPromise;
        }

        // Start loading
        this.isLoading = true;
        this.loadPromise = this._loadLibrary();

        try {
            const result = await this.loadPromise;
            this.isLoaded = true;
            this.isLoading = false;
            return result;
        } catch (error) {
            this.isLoading = false;
            this.loadPromise = null;
            throw error;
        }
    }

    /**
     * Internal method to load the library
     */
    async _loadLibrary() {
        try {
            // Load CSS first
            await this._loadCSS();

            // Then load JavaScript
            await this._loadScript();

            // Verify that trackasiagl is available
            if (typeof window.trackasiagl === 'undefined') {
                throw new Error('Track Asia GL JS failed to load properly');
            }

            console.log('Track Asia GL JS loaded successfully');
            // Create a safe alias to support code that expects different global names
            // Some files use `trackAsiaGL` (camelCase) while others use `trackasiagl`.
            // Expose both to avoid runtime "undefined" errors.
            if (typeof window.trackAsiaGL === 'undefined') {
                try { window.trackAsiaGL = window.trackasiagl; } catch (e) { /* ignore */ }
            }

            return window.trackasiagl;

        } catch (error) {
            console.error('Error loading Track Asia GL JS:', error);
            throw new Error(`Failed to load Track Asia GL JS: ${error.message}`);
        }
    }

    /**
     * Load CSS file
     */
    _loadCSS() {
        return new Promise((resolve, reject) => {
            // Check if CSS is already loaded
            const existingLink = document.querySelector(`link[href="${this.cssUrl}"]`);
            if (existingLink) {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = this.cssUrl;

            link.onload = () => {
                console.log('Track Asia CSS loaded successfully');
                resolve();
            };

            link.onerror = () => {
                reject(new Error('Failed to load Track Asia CSS'));
            };

            document.head.appendChild(link);

            // Timeout fallback
            setTimeout(() => {
                reject(new Error('Track Asia CSS load timeout'));
            }, this.loadTimeout);
        });
    }

    /**
     * Load JavaScript file
     */
    _loadScript() {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${this.scriptUrl}"]`);
            if (existingScript && window.trackasiagl) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = this.scriptUrl;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                // Give some time for the library to initialize
                setTimeout(() => {
                    if (window.trackasiagl) {
                        console.log('Track Asia GL JS script loaded successfully');
                        resolve();
                    } else {
                        reject(new Error('Track Asia GL JS not available after script load'));
                    }
                }, 100);
            };

            script.onerror = () => {
                reject(new Error('Failed to load Track Asia GL JS script'));
            };

            document.head.appendChild(script);

            // Timeout fallback
            setTimeout(() => {
                if (!window.trackasiagl) {
                    reject(new Error('Track Asia GL JS script load timeout'));
                }
            }, this.loadTimeout);
        });
    }

    /**
     * Check if Track Asia GL JS is available
     */
    isAvailable() {
        return this.isLoaded && typeof window.trackasiagl !== 'undefined';
    }

    /**
     * Get Track Asia GL JS version
     */
    getVersion() {
        if (this.isAvailable()) {
            return window.trackasiagl.version || 'unknown';
        }
        return null;
    }

    /**
     * Check if loading is in progress
     */
    isLoadingInProgress() {
        return this.isLoading;
    }

    /**
     * Reset loader state (for testing purposes)
     */
    reset() {
        this.isLoading = false;
        this.isLoaded = false;
        this.loadPromise = null;
    }
}

// Create singleton instance
const trackAsiaLoader = new TrackAsiaLoader();

export default trackAsiaLoader;
