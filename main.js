/**
 * Enhanced Main Application Engine for Physics Formula Collection
 * Optimized for performance, modularity, and extensibility
 */

// --- CONFIGURATION ---
const CONFIG = {
    CHAPTERS_DIRECTORY: 'chapters',
    CHAPTERS_TO_LOAD: ['kinematics.html', 'dynamics.html'],
    LAZY_LOAD_THRESHOLD: 100, // pixels before viewport
    ANIMATION_FPS: 60,
    DEBOUNCE_DELAY: 150,
    ENABLE_DEV_MODE: false, // Set to true to show performance metrics
    CACHE_DURATION: 600000, // 10 minutes in ms
};

// --- GLOBAL STATE MANAGEMENT ---
const STATE = {
    loadedChapters: new Set(),
    activeCharts: new Map(),
    activeAnimations: new Map(),
    observedElements: new WeakMap(),
    chapterCache: new Map(),
    searchIndex: null,
    currentTheme: 'light',
    isLoading: false,
    animationSpeed: 1,
};

// --- PERFORMANCE MONITORING ---
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadStart: performance.now(),
            chaptersLoaded: 0,
            plotsInitialized: 0,
            fps: 0,
            lastFrameTime: performance.now()
        };
        this.fpsUpdateInterval = null;
    }

    startFPSMonitoring() {
        if (this.fpsUpdateInterval) return;

        let frameCount = 0;
        let lastUpdate = performance.now();

        const updateFPS = () => {
            frameCount++;
            const now = performance.now();

            if (now - lastUpdate >= 1000) {
                this.metrics.fps = Math.round(frameCount * 1000 / (now - lastUpdate));
                frameCount = 0;
                lastUpdate = now;

                if (CONFIG.ENABLE_DEV_MODE) {
                    const fpsCounter = document.getElementById('fps-counter');
                    if (fpsCounter) {
                        fpsCounter.textContent = this.metrics.fps;
                    }
                }
            }

            this.fpsUpdateInterval = requestAnimationFrame(updateFPS);
        };

        updateFPS();
    }

    stopFPSMonitoring() {
        if (this.fpsUpdateInterval) {
            cancelAnimationFrame(this.fpsUpdateInterval);
            this.fpsUpdateInterval = null;
        }
    }

    logMetric(name, value) {
        this.metrics[name] = value;
        if (CONFIG.ENABLE_DEV_MODE) {
            console.log(`[Performance] ${name}: ${value}`);
        }
    }
}

const perfMonitor = new PerformanceMonitor();

// --- UTILITY FUNCTIONS ---
const utils = {
    debounce(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    throttle(func, limit) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    async loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    showStatus(message, action = null) {
        const statusBar = document.getElementById('status-bar');
        const statusMessage = document.getElementById('status-message');
        const statusAction = document.getElementById('status-action');

        if (!statusBar || !statusMessage) return;

        statusMessage.textContent = message;
        statusBar.hidden = false;

        if (action && statusAction) {
            statusAction.textContent = action.text;
            statusAction.onclick = action.callback;
            statusAction.hidden = false;
        } else if (statusAction) {
            statusAction.hidden = true;
        }

        setTimeout(() => {
            statusBar.hidden = true;
        }, 5000);
    }
};

// --- PLOT INITIALIZATION ENGINE ---
const PLOT_INITIALIZERS = {
    /**
     * Kinematics 1D Plot with Chart.js
     */
    'kinematics-1d-chartjs': async function(plotContainer) {
        // Lazy load Chart.js zoom plugin
        if (typeof Chart === 'undefined') {
            await utils.loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        }

        const ChartZoom = (await import('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/+esm')).default;
        Chart.register(ChartZoom);

        const canvas = plotContainer.querySelector('.plot-canvas');
        if (!canvas) {
            console.error("Canvas element not found for plot 'kinematics-1d-chartjs'");
            return;
        }
        const ctx = canvas.getContext('2d');

        // Find interactive elements
        const x0Slider = plotContainer.querySelector('#k-x0-slider');
        const v0Slider = plotContainer.querySelector('#k-v0-slider');
        const accSlider = plotContainer.querySelector('#k-acc-slider');
        const x0Val = plotContainer.querySelector('#k-x0-val');
        const v0Val = plotContainer.querySelector('#k-v0-val');
        const accVal = plotContainer.querySelector('#k-acc-val');

        // Create Chart instance
        const motionChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    { label: 'Position (m)', borderColor: 'rgba(0, 119, 182, 0.8)', borderWidth: 3, data: [], fill: false },
                    { label: 'Velocity (m/s)', borderColor: 'rgba(0, 180, 216, 0.8)', borderWidth: 3, data: [], fill: false },
                    { label: 'Acceleration (m/s²)', borderColor: 'rgba(239, 71, 111, 0.8)', borderWidth: 2, data: [], fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 }, // Disable animation for performance
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'Time (s)', font: { size: 14 } },
                        grid: { color: 'rgba(128, 128, 128, 0.2)' }
                    },
                    y: {
                        title: { display: true, text: 'Value', font: { size: 14 } },
                        grid: { color: 'rgba(128, 128, 128, 0.2)' }
                    }
                },
                plugins: {
                    title: { display: true, text: 'Kinematic Quantities vs. Time', font: { size: 16 } },
                    tooltip: { mode: 'index', intersect: false },
                    zoom: {
                        pan: { enabled: true, mode: 'xy' },
                        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' }
                    }
                }
            }
        });

        // Store chart reference for cleanup
        STATE.activeCharts.set(plotContainer.dataset.plotId, motionChart);

        // Debounced update function
        const updateChartData = utils.debounce(() => {
            const x0 = parseFloat(x0Slider.value);
            const v0 = parseFloat(v0Slider.value);
            const a = parseFloat(accSlider.value);

            x0Val.textContent = `${x0.toFixed(1)} m`;
            v0Val.textContent = `${v0.toFixed(1)} m/s`;
            accVal.textContent = `${a.toFixed(1)} m/s²`;

            const timeMax = 10;
            const points = 100;
            const positionData = [], velocityData = [], accelerationData = [];

            for (let i = 0; i <= points; i++) {
                const t = (timeMax / points) * i;
                positionData.push({ x: t, y: x0 + v0 * t + 0.5 * a * t * t });
                velocityData.push({ x: t, y: v0 + a * t });
                accelerationData.push({ x: t, y: a });
            }

            motionChart.data.datasets[0].data = positionData;
            motionChart.data.datasets[1].data = velocityData;
            motionChart.data.datasets[2].data = accelerationData;
            motionChart.update('none');
        }, CONFIG.DEBOUNCE_DELAY);

        // Add event listeners
        [x0Slider, v0Slider, accSlider].forEach(slider => {
            if (slider) {
                slider.addEventListener('input', updateChartData);
            }
        });

        updateChartData(); // Initial draw
        perfMonitor.logMetric('plotsInitialized', perfMonitor.metrics.plotsInitialized + 1);
    },

    /**
     * Force Analysis Simulation (Animated)
     */
    'force-analysis-sim': async function(plotContainer) {
        const canvas = plotContainer.querySelector('#forceCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let animationId;
        let isPlaying = true;

        // Physics state
        const state = {
            mass: 10,
            force: 50,
            friction: 0.2,
            position: 0,
            velocity: 0,
            maxPosition: canvas.width - 50,
            time: 0
        };

        // Get controls
        const forceSlider = plotContainer.querySelector('#force-slider');
        const massSlider = plotContainer.querySelector('#mass-slider');
        const frictionSlider = plotContainer.querySelector('#friction-slider');
        const resetBtn = plotContainer.querySelector('#reset-sim');

        // Update displays
        const updateDisplays = () => {
            const g = 9.81;
            const normalForce = state.mass * g;
            const frictionForce = state.friction * normalForce;
            const netForce = state.force - (state.velocity > 0 ? frictionForce : 0);
            const acceleration = netForce / state.mass;

            const netForceEl = plotContainer.querySelector('#net-force');
            const accelerationEl = plotContainer.querySelector('#acceleration');
            const velocityEl = plotContainer.querySelector('#velocity');
            const positionEl = plotContainer.querySelector('#position');

            if (netForceEl) netForceEl.textContent = `${netForce.toFixed(1)} N`;
            if (accelerationEl) accelerationEl.textContent = `${acceleration.toFixed(2)} m/s²`;
            if (velocityEl) velocityEl.textContent = `${state.velocity.toFixed(2)} m/s`;
            if (positionEl) positionEl.textContent = `${state.position.toFixed(1)} m`;
        };

        // Animation loop
        const animate = () => {
            if (!isPlaying) return;

            const dt = (1 / CONFIG.ANIMATION_FPS) * STATE.animationSpeed;
            const g = 9.81;
            const normalForce = state.mass * g;
            const frictionForce = state.friction * normalForce;
            const netForce = state.force - (state.velocity > 0 ? frictionForce : 0);
            const acceleration = netForce / state.mass;

            // Update physics
            state.velocity += acceleration * dt;
            state.velocity = Math.max(0, state.velocity); // Can't go backward
            state.position += state.velocity * dt * 10; // Scale for visibility

            // Boundary check
            if (state.position > state.maxPosition) {
                state.position = state.maxPosition;
                state.velocity = 0;
            }

            // Draw
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw ground
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height - 30);
            ctx.lineTo(canvas.width, canvas.height - 30);
            ctx.stroke();

            // Draw block
            ctx.fillStyle = '#4a90e2';
            ctx.fillRect(state.position, canvas.height - 80, 50, 50);

            // Draw force vectors
            ctx.strokeStyle = '#00a86b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(state.position + 25, canvas.height - 55);
            ctx.lineTo(state.position + 25 + state.force / 2, canvas.height - 55);
            ctx.stroke();

            // Arrow head
            ctx.beginPath();
            ctx.moveTo(state.position + 25 + state.force / 2, canvas.height - 55);
            ctx.lineTo(state.position + 20 + state.force / 2, canvas.height - 60);
            ctx.lineTo(state.position + 20 + state.force / 2, canvas.height - 50);
            ctx.closePath();
            ctx.fillStyle = '#00a86b';
            ctx.fill();

            updateDisplays();
            state.time += dt;

            animationId = requestAnimationFrame(animate);
        };

        // Control handlers
        const updateParams = utils.debounce(() => {
            state.force = parseFloat(forceSlider.value);
            state.mass = parseFloat(massSlider.value);
            state.friction = parseFloat(frictionSlider.value);

            const forceVal = plotContainer.querySelector('#force-val');
            const massVal = plotContainer.querySelector('#mass-val');
            const frictionVal = plotContainer.querySelector('#friction-val');

            if (forceVal) forceVal.textContent = `${state.force} N`;
            if (massVal) massVal.textContent = `${state.mass} kg`;
            if (frictionVal) frictionVal.textContent = state.friction.toFixed(2);
        }, 50);

        const reset = () => {
            state.position = 0;
            state.velocity = 0;
            state.time = 0;
            updateDisplays();
        };

        // Event listeners
        if (forceSlider) forceSlider.addEventListener('input', updateParams);
        if (massSlider) massSlider.addEventListener('input', updateParams);
        if (frictionSlider) frictionSlider.addEventListener('input', updateParams);
        if (resetBtn) resetBtn.addEventListener('click', reset);

        // Store animation reference
        const animController = {
            start: () => { isPlaying = true; animate(); },
            stop: () => { isPlaying = false; cancelAnimationFrame(animationId); },
            reset: reset
        };

        STATE.activeAnimations.set(plotContainer.dataset.plotId, animController);

        // Start animation
        updateParams();
        animate();
        perfMonitor.startFPSMonitoring();
    }
};

// --- LAZY LOADING WITH INTERSECTION OBSERVER ---
class LazyLoader {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => this.handleIntersection(entries),
            {
                root: null,
                rootMargin: `${CONFIG.LAZY_LOAD_THRESHOLD}px`,
                threshold: 0.01
            }
        );
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting && !STATE.observedElements.has(entry.target)) {
                STATE.observedElements.set(entry.target, true);
                this.initializePlot(entry.target);
            }
        });
    }

    initializePlot(element) {
        const plotId = element.dataset.plotId;
        if (plotId && PLOT_INITIALIZERS[plotId]) {
            PLOT_INITIALIZERS[plotId](element);
        }
    }

    observe(element) {
        this.observer.observe(element);
    }

    disconnect() {
        this.observer.disconnect();
    }
}

const lazyLoader = new LazyLoader();

// --- THEME MANAGEMENT ---
const themeManager = {
    apply(themeName) {
        document.body.className = '';
        if (themeName !== 'light') {
            document.body.classList.add(`theme-${themeName}`);
        }
        localStorage.setItem('physics-theme', themeName);
        STATE.currentTheme = themeName;

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === themeName);
        });
    },

    initialize() {
        const savedTheme = localStorage.getItem('physics-theme') || 'light';
        this.apply(savedTheme);

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => this.apply(btn.dataset.theme));
        });
    }
};

// --- CHAPTER MANAGEMENT ---
class ChapterManager {
    async loadChapters() {
        const container = document.getElementById('formula-collection-container');
        if (!container) return;

        try {
            STATE.isLoading = true;
            const loadingOverlay = document.getElementById('loading-overlay');

            // Check cache first
            const cached = this.getCachedChapters();
            if (cached) {
                container.innerHTML = cached;
                this.onChaptersLoaded();
                if (loadingOverlay) {
                    loadingOverlay.classList.add('fade-out');
                }
                return;
            }

            // Fetch chapters
            const fetchPromises = CONFIG.CHAPTERS_TO_LOAD.map(async (file) => {
                try {
                    const response = await fetch(`${CONFIG.CHAPTERS_DIRECTORY}/${file}`);
                    if (!response.ok) throw new Error(`Failed to load ${file}`);
                    const html = await response.text();
                    STATE.loadedChapters.add(file);
                    perfMonitor.logMetric('chaptersLoaded', STATE.loadedChapters.size);
                    return html;
                } catch (error) {
                    console.error(`Error loading ${file}:`, error);
                    return `<div class="chapter error">Failed to load ${file}</div>`;
                }
            });

            const chapterHtmls = await Promise.all(fetchPromises);
            const content = chapterHtmls.join('');
            container.innerHTML = content;

            // Cache the content
            this.cacheChapters(content);

            // Initialize features
            this.onChaptersLoaded();

            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add('fade-out');
            }

        } catch (error) {
            this.showError(error);
        } finally {
            STATE.isLoading = false;
        }
    }

    onChaptersLoaded() {
        this.initializeCopyButtons();
        this.initializePlots();
        this.initializeChapterToggles();
        this.initializeSubsectionToggles(); // NEW: Initialize subsections
        this.initializeChapterNav();
        this.buildSearchIndex();

        // Update metrics
        const chapterCount = document.getElementById('chapter-count');
        if (chapterCount) {
            chapterCount.textContent = STATE.loadedChapters.size;
        }
        const loadTimeEl = document.getElementById('load-time');
        if (loadTimeEl) {
            const loadTime = performance.now() - perfMonitor.metrics.loadStart;
            loadTimeEl.textContent = loadTime.toFixed(0);
        }
    }

    initializeCopyButtons() {
        document.querySelectorAll('.formula-equation[data-latex]').forEach(block => {
            const latexSource = block.dataset.latex.trim();
            if (!latexSource) return;

            const button = document.createElement('button');
            button.className = 'copy-btn';
            button.title = 'Copy LaTeX to Clipboard';
            button.textContent = 'Copy';
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(latexSource).then(() => {
                    button.textContent = 'Copied!';
                    button.classList.add('copied');
                    setTimeout(() => {
                        button.textContent = 'Copy';
                        button.classList.remove('copied');
                    }, 1500);
                });
            });
            block.appendChild(button);
        });
    }

    initializePlots() {
        document.querySelectorAll('.interactive-plot[data-plot-id]').forEach(container => {
            // Use lazy loading with Intersection Observer
            lazyLoader.observe(container);
        });

        const plotCount = document.getElementById('plot-count');
        if (plotCount) {
            plotCount.textContent = document.querySelectorAll('.interactive-plot[data-plot-id]').length;
        }
    }

    initializeChapterToggles() {
        document.querySelectorAll('.js-chapter-toggle').forEach(button => {
            button.addEventListener('click', () => {
                const chapter = button.closest('.chapter');
                if (chapter) {
                    this.toggleChapter(chapter);
                }
            });
        });
    }

    // NEW: Initialize subsection toggles
    initializeSubsectionToggles() {
        // Initialize individual subsection toggles
        document.querySelectorAll('.js-subsection-toggle').forEach(button => {
            button.addEventListener('click', () => {
                const subsection = button.closest('.subsection');
                if (subsection) {
                    this.toggleSubsection(subsection);
                }
            });
        });

        // Initialize expand all subsections buttons
        document.querySelectorAll('.expand-all-sub').forEach(button => {
            button.addEventListener('click', () => {
                const chapter = button.closest('.chapter-content');
                if (chapter) {
                    chapter.querySelectorAll('.subsection').forEach(subsection => {
                        this.toggleSubsection(subsection, true);
                    });
                    utils.showStatus('All sections expanded');
                }
            });
        });

        // Initialize collapse all subsections buttons
        document.querySelectorAll('.collapse-all-sub').forEach(button => {
            button.addEventListener('click', () => {
                const chapter = button.closest('.chapter-content');
                if (chapter) {
                    chapter.querySelectorAll('.subsection').forEach(subsection => {
                        this.toggleSubsection(subsection, false);
                    });
                    utils.showStatus('All sections collapsed');
                }
            });
        });
    }

    // NEW: Toggle subsection method
    toggleSubsection(subsection, forceState = null) {
        const content = subsection.querySelector('.subsection-content');
        if (!content) return;

        const isActive = forceState !== null ? forceState : !subsection.classList.contains('active');

        if (isActive) {
            subsection.classList.add('active');
            // Calculate and set max-height for animation
            content.style.maxHeight = content.scrollHeight + "px";

            // Update toggle icon if it exists
            const toggleIcon = subsection.querySelector('.toggle-icon');
            if (toggleIcon) {
                toggleIcon.style.transform = 'rotate(45deg)';
            }
        } else {
            subsection.classList.remove('active');
            content.style.maxHeight = null;

            // Update toggle icon if it exists
            const toggleIcon = subsection.querySelector('.toggle-icon');
            if (toggleIcon) {
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        }
    }

    // UPDATED: Toggle chapter method with proper handling for subsections
    toggleChapter(chapter, forceState = null) {
        const content = chapter.querySelector('.chapter-content');
        if (!content) return;

        const isActive = forceState !== null ? forceState : !chapter.classList.contains('active');

        // Check if chapter has subsections and add appropriate class
        const hasSubsections = chapter.querySelectorAll('.subsection').length > 0;
        chapter.classList.toggle('has-subsections', hasSubsections);

        if (isActive) {
            chapter.classList.add('active');

            if (hasSubsections) {
                // For chapters with subsections, remove max-height constraint entirely
                content.style.maxHeight = 'none';
                content.style.overflow = 'visible';
            } else {
                // For regular chapters without subsections, calculate height for smooth animation
                content.style.maxHeight = content.scrollHeight + "px";

                // Recalculate after content settles
                setTimeout(() => {
                    if (chapter.classList.contains('active') && !hasSubsections) {
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                }, 100);
            }
        } else {
            chapter.classList.remove('active');
            content.style.maxHeight = null;
            content.style.overflow = null;

            // Clean up resources when closing
            this.cleanupChapterResources(chapter);
        }
    }

    cleanupChapterResources(chapter) {
        // Clean up charts
        chapter.querySelectorAll('.interactive-plot[data-plot-id]').forEach(plot => {
            const plotId = plot.dataset.plotId;

            if (STATE.activeCharts.has(plotId)) {
                STATE.activeCharts.get(plotId).destroy();
                STATE.activeCharts.delete(plotId);
            }

            if (STATE.activeAnimations.has(plotId)) {
                STATE.activeAnimations.get(plotId).stop();
                STATE.activeAnimations.delete(plotId);
            }

            // Mark as unobserved so it can be re-initialized if opened again
            STATE.observedElements.delete(plot);
        });
    }

    initializeChapterNav() {
        const nav = document.getElementById('chapter-nav');
        if (!nav) return;

        document.querySelectorAll('.chapter').forEach((chapter, index) => {
            const title = chapter.querySelector('h2')?.textContent || `Chapter ${index + 1}`;
            const button = document.createElement('button');
            button.className = 'chapter-nav-btn';
            button.textContent = title.replace('Chapter ', 'Ch. ');
            button.addEventListener('click', () => {
                chapter.scrollIntoView({ behavior: 'smooth' });
                this.toggleChapter(chapter, true);

                // Update active state
                nav.querySelectorAll('.chapter-nav-btn').forEach(btn =>
                    btn.classList.remove('active'));
                button.classList.add('active');
            });
            nav.appendChild(button);
        });
    }

    buildSearchIndex() {
        const index = [];
        document.querySelectorAll('.chapter').forEach(chapter => {
            const chapterTitle = chapter.querySelector('h2')?.textContent || '';

            chapter.querySelectorAll('.formula-item').forEach(item => {
                index.push({
                    element: item,
                    chapter: chapter,
                    chapterTitle: chapterTitle,
                    text: item.textContent.toLowerCase(),
                    title: item.querySelector('h3')?.textContent || ''
                });
            });
        });
        STATE.searchIndex = index;
    }

    getCachedChapters() {
        const cached = STATE.chapterCache.get('chapters');
        if (!cached) return null;

        const { content, timestamp } = cached;
        if (Date.now() - timestamp > CONFIG.CACHE_DURATION) {
            STATE.chapterCache.delete('chapters');
            return null;
        }
        return content;
    }

    cacheChapters(content) {
        STATE.chapterCache.set('chapters', {
            content: content,
            timestamp: Date.now()
        });
    }

    showError(error) {
        const container = document.getElementById('formula-collection-container');
        const errorContainer = document.getElementById('error-container');

        if (container) container.hidden = true;
        if (errorContainer) {
            errorContainer.hidden = false;
            const errorMessage = document.getElementById('error-message');
            if (errorMessage) {
                errorMessage.textContent = error.message;
            }

            const retryBtn = document.getElementById('retry-load');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    errorContainer.hidden = true;
                    if (container) container.hidden = false;
                    this.loadChapters();
                });
            }
        }
    }
}

// --- SEARCH FUNCTIONALITY ---
class SearchManager {
    constructor() {
        this.searchInput = document.getElementById('search-input');
        this.clearButton = document.getElementById('clear-search');
        this.noResultsMessage = document.getElementById('no-results-message');

        if (this.searchInput) {
            this.initialize();
        }
    }

    initialize() {
        // Debounced search
        const debouncedSearch = utils.debounce((e) => this.handleSearch(e), CONFIG.DEBOUNCE_DELAY);
        this.searchInput.addEventListener('input', debouncedSearch);

        // Clear button
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearSearch());
        }
        const clearAlt = document.getElementById('clear-search-alt');
        if (clearAlt) {
            clearAlt.addEventListener('click', () => this.clearSearch());
        }

        // Show/hide clear button
        this.searchInput.addEventListener('input', (e) => {
            if (this.clearButton) {
                this.clearButton.hidden = !e.target.value;
            }
        });
    }

    handleSearch(event) {
        const query = event.target.value.toLowerCase().trim();

        if (!query) {
            this.clearSearch();
            return;
        }

        let hasResults = false;
        const matchedChapters = new Set();

        // Search through index
        if (STATE.searchIndex) {
            STATE.searchIndex.forEach(({ element, chapter, text }) => {
                const matches = text.includes(query);
                element.classList.toggle('hidden', !matches);

                if (matches) {
                    hasResults = true;
                    matchedChapters.add(chapter);

                    // Highlight matches
                    if (!element.dataset.originalContent) {
                        element.dataset.originalContent = element.innerHTML;
                    }

                    const regex = new RegExp(`(${query})`, 'gi');
                    element.innerHTML = element.dataset.originalContent.replace(regex, '<mark class="highlight">$1</mark>');
                } else if (element.dataset.originalContent) {
                    element.innerHTML = element.dataset.originalContent;
                }
            });
        }

        // Show/hide chapters based on matches
        document.querySelectorAll('.chapter').forEach(chapter => {
            const hasMatch = matchedChapters.has(chapter);
            chapter.classList.toggle('hidden', !hasMatch);

            // Auto-expand chapters with matches
            if (hasMatch && query) {
                chapterManager.toggleChapter(chapter, true);
            }
        });

        // Show no results message
        if (this.noResultsMessage) {
            this.noResultsMessage.hidden = hasResults || !query;
        }
    }

    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
        }
        if (this.clearButton) {
            this.clearButton.hidden = true;
        }

        // Reset all elements
        document.querySelectorAll('.formula-item').forEach(item => {
            item.classList.remove('hidden');
            if (item.dataset.originalContent) {
                item.innerHTML = item.dataset.originalContent;
                delete item.dataset.originalContent;
            }
        });

        document.querySelectorAll('.chapter').forEach(chapter => {
            chapter.classList.remove('hidden');
        });

        if (this.noResultsMessage) {
            this.noResultsMessage.hidden = true;
        }
    }
}

// --- ANIMATION CONTROLS ---
class AnimationController {
    constructor() {
        this.controls = document.getElementById('animation-controls');
        this.playPauseBtn = document.getElementById('play-pause');
        this.resetBtn = document.getElementById('reset-anim');
        this.speedControl = document.getElementById('speed-control');

        this.isPlaying = true;

        if (this.controls) {
            this.initialize();
        }
    }

    initialize() {
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.resetAll());
        }
        if (this.speedControl) {
            this.speedControl.addEventListener('change', (e) => {
                STATE.animationSpeed = parseFloat(e.target.value);
            });
        }

        // Show controls when animations are active
        this.checkForAnimations();
    }

    togglePlayPause() {
        this.isPlaying = !this.isPlaying;
        if (this.playPauseBtn) {
            // Use simple ASCII characters to avoid encoding issues
            this.playPauseBtn.textContent = this.isPlaying ? '||' : '>';
        }

        STATE.activeAnimations.forEach(controller => {
            if (this.isPlaying) {
                controller.start();
            } else {
                controller.stop();
            }
        });
    }

    resetAll() {
        STATE.activeAnimations.forEach(controller => {
            if (controller.reset) controller.reset();
        });
    }

    checkForAnimations() {
        // Show controls if there are active animations
        const hasAnimations = STATE.activeAnimations.size > 0;
        if (this.controls) {
            this.controls.hidden = !hasAnimations;
        }
    }
}

// --- GLOBAL CONTROLS ---
class GlobalControls {
    constructor() {
        this.expandAllBtn = document.getElementById('expand-all');
        this.collapseAllBtn = document.getElementById('collapse-all');

        this.initialize();
    }

    initialize() {
        if (this.expandAllBtn) {
            this.expandAllBtn.addEventListener('click', () => this.expandAll());
        }
        if (this.collapseAllBtn) {
            this.collapseAllBtn.addEventListener('click', () => this.collapseAll());
        }
    }

    expandAll() {
        document.querySelectorAll('.chapter').forEach(chapter => {
            chapterManager.toggleChapter(chapter, true);
        });
        utils.showStatus('All chapters expanded');
    }

    collapseAll() {
        document.querySelectorAll('.chapter').forEach(chapter => {
            chapterManager.toggleChapter(chapter, false);
        });
        utils.showStatus('All chapters collapsed');
    }
}

// --- INITIALIZATION ---
const chapterManager = new ChapterManager();
let searchManager, animationController, globalControls;

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Show dev footer if enabled
        if (CONFIG.ENABLE_DEV_MODE) {
            const devFooter = document.getElementById('dev-footer');
            if (devFooter) {
                devFooter.hidden = false;
            }
        }

        // Initialize theme
        themeManager.initialize();

        // Load chapters
        await chapterManager.loadChapters();

        // Initialize managers after content is loaded
        searchManager = new SearchManager();
        animationController = new AnimationController();
        globalControls = new GlobalControls();

        // Set up global animation frame for FPS monitoring
        if (CONFIG.ENABLE_DEV_MODE) {
            perfMonitor.startFPSMonitoring();
        }

        // Log performance
        if (window.performanceMetrics) {
            const totalLoadTime = performance.now() - window.performanceMetrics.startTime;
            console.log(`[Performance] Total load time: ${totalLoadTime.toFixed(2)}ms`);
        }

        // Clean up on page unload
        window.addEventListener('beforeunload', () => {
            STATE.activeCharts.forEach(chart => chart.destroy());
            STATE.activeAnimations.forEach(controller => controller.stop());
            lazyLoader.disconnect();
            perfMonitor.stopFPSMonitoring();
        });
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// Export for potential module usage
export {
    STATE,
    PLOT_INITIALIZERS,
    utils,
    ChapterManager,
    SearchManager,
    AnimationController
};