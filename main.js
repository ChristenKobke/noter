/**
 * Enhanced Main Application Engine for Physics Formula Collection
 * Part 1/5: Configuration, State Management, and Utility Functions
 * UPDATED: Simplified for Chapter Manager integration
 */

// --- CONFIGURATION ---
const CONFIG = {
    DEFAULT_CHAPTERS_DIRECTORY: 'chapters',
    AUTO_DISCOVER_CHAPTERS: true,
    LAZY_LOAD_THRESHOLD: 100,
    ANIMATION_FPS: 60,
    DEBOUNCE_DELAY: 150,
    ENABLE_DEV_MODE: true,
    CACHE_DURATION: 600000,
    MAX_TABS: 10,
    ANIMATION_DURATION: 500 // Duration for expand/collapse animations
};

// --- GLOBAL STATE MANAGEMENT ---
const STATE = {
    tabs: new Map(),
    activeTabId: null,
    tabCounter: 1,
    loadedChapters: new Set(),
    activeCharts: new Map(),
    activeAnimations: new Map(),
    observedElements: new WeakMap(),
    chapterCache: new Map(),
    localFileCache: new Map(), // Cache for imported HTML content
    currentTheme: 'light',
    isLoading: false,
    animationSpeed: 1,
    expandedChapters: new Set() // Track expanded chapters for animation
};

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

    generateId() {
        return 'import-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
};

// --- HELPER FUNCTION FOR EXTRACTING TITLES FROM HTML ---
/**
 * Extracts the chapter title from HTML content or file.
 */
async function extractTitleFromContent(htmlContent, filename) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Priority 1: The specific <h2> inside the chapter header
        const specificHeader = doc.querySelector('.chapter-header h2');
        if (specificHeader && specificHeader.textContent.trim()) {
            return specificHeader.textContent.trim();
        }

        // Priority 2: Any <h1> as a fallback
        const h1 = doc.querySelector('h1');
        if (h1 && h1.textContent.trim()) {
            return h1.textContent.trim();
        }

        // Priority 3: Any <h2> as a broader fallback
        const h2 = doc.querySelector('h2');
        if (h2 && h2.textContent.trim()) {
            return h2.textContent.trim();
        }

        // Priority 4: Generate a title from the filename
        const fallbackTitle = filename.replace(/\.html$/i, '').replace(/[-_]/g, ' ');
        return fallbackTitle.charAt(0).toUpperCase() + fallbackTitle.slice(1);

    } catch (e) {
        console.error(`Could not process content for ${filename}:`, e);
        return null;
    }
}

// --- HELPER FUNCTION FOR EXTRACTING TITLES FROM FILES ---
async function extractTitleFromFile(folderPath, filename) {
    // Check if this is imported content first
    const cacheKey = `${folderPath}/${filename}`;
    if (STATE.localFileCache.has(cacheKey)) {
        const localContent = STATE.localFileCache.get(cacheKey);
        return extractTitleFromContent(localContent, filename);
    }

    // Otherwise, fetch from server
    try {
        const response = await fetch(`${folderPath}/${filename}`);
        if (!response.ok) return null;
        const html = await response.text();
        return extractTitleFromContent(html, filename);
    } catch (e) {
        console.error(`Could not fetch file ${filename}:`, e);
        return null;
    }
}

// --- LOCAL FILE MANAGER (Simplified for Chapter Manager) ---
class LocalFileManager {
    constructor() {
        this.importedFolders = new Map(); // Map of folder ID to metadata
    }

    /**
     * Store content from Chapter Manager
     * @param {Object} data - Data from Chapter Manager
     * @returns {Object} Folder info
     */
    storeImportedContent(data) {
        const folderId = data.folder || utils.generateId();

        // Store metadata
        this.importedFolders.set(folderId, {
            name: data.title,
            chapters: data.chapters || [],
            timestamp: Date.now(),
            isLocal: true
        });

        // Store file content if provided
        if (data.content) {
            Object.entries(data.content).forEach(([filename, content]) => {
                const cacheKey = `${folderId}/${filename}`;
                STATE.localFileCache.set(cacheKey, content);
            });
        }

        return {
            folderId,
            folderName: data.title,
            chapters: data.chapters || []
        };
    }

    /**
     * Check if a folder path is imported content
     */
    isImportedFolder(folderPath) {
        return this.importedFolders.has(folderPath);
    }

    /**
     * Get imported folder info
     */
    getImportedFolder(folderId) {
        return this.importedFolders.get(folderId);
    }

    /**
     * Clear imported content for a specific folder
     */
    clearImportedFolder(folderId) {
        if (this.importedFolders.has(folderId)) {
            // Clear file cache
            const folder = this.importedFolders.get(folderId);
            folder.chapters.forEach(filename => {
                STATE.localFileCache.delete(`${folderId}/${filename}`);
            });

            // Remove folder info
            this.importedFolders.delete(folderId);
        }
    }
}

// Create global instance
const localFileManager = new LocalFileManager();

// --- TAB MANAGEMENT SYSTEM (Simplified for Chapter Manager) ---
class TabManager {
    constructor() {
        this.tabsContainer = document.querySelector('.tabs-container');
        this.newTabBtn = document.querySelector('.new-tab-btn');
        this.tabContentArea = document.querySelector('.tab-content-area');

        this.initialize();
        this.createInitialTab();
    }

    initialize() {
        console.log('TabManager initializing...');
        console.log('New tab button found:', !!this.newTabBtn);

        // Setup new tab button to open Chapter Manager
        if (this.newTabBtn) {
            this.newTabBtn.addEventListener('click', () => {
                console.log('Opening Chapter Manager');
                this.showFolderSelection();
            });
        }

        // Tab interactions
        this.tabsContainer.addEventListener('click', (e) => this.handleTabClick(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // Expose TabManager globally for Chapter Manager communication
        window.tabManager = this;
    }

    /**
     * Show Chapter Manager (replaces old folder selection modal)
     */
    showFolderSelection() {
        // Opens Chapter Manager instead of old modal
        if (window.chapterManagerModal) {
            window.chapterManagerModal.open();
        } else {
            console.error('Chapter Manager Modal not initialized');
        }
    }

    /**
     * Create tab from Chapter Manager data
     * @param {Object} data - Data from Chapter Manager
     * data format: {
     *   type: 'create-tab',
     *   folder: 'imported-123456',
     *   title: 'Custom Physics',
     *   chapters: ['file1.html', 'file2.html'],
     *   isLocal: true,
     *   content: { 'file1.html': '<html>', 'file2.html': '<html>' }
     * }
     */
    createFromChapterManager(data) {
        console.log('Creating tab from Chapter Manager:', data);

        let folderId = data.folder;
        let chapters = data.chapters || [];

        // Process imported content
        if (data.isLocal && data.content) {
            const folderInfo = localFileManager.storeImportedContent(data);
            folderId = folderInfo.folderId;
            chapters = folderInfo.chapters;
        }

        // Create the new tab
        this.createNewTab(folderId, data.title, chapters, data.isLocal);
    }

    createInitialTab() {
        const initialTab = {
            id: 'tab-1',
            title: 'Physics Basics',
            folder: 'chapters',
            chapters: ['kinematics.html', 'dynamics.html'],
            chapterManager: null,
            searchManager: null,
            lazyLoader: null,
            isActive: true,
            isLocal: false
        };

        STATE.tabs.set('tab-1', initialTab);
        STATE.activeTabId = 'tab-1';
        STATE.tabCounter = 2;

        this.initializeTabContent('tab-1');
    }

    async createNewTab(folderPath, folderName, chapters = [], isLocal = false) {
        if (STATE.tabs.size >= CONFIG.MAX_TABS) {
            this.showStatus('Maximum number of tabs reached', 'error');
            return;
        }

        const tabId = `tab-${STATE.tabCounter++}`;
        const tabTitle = folderName || folderPath;

        const newTab = {
            id: tabId,
            title: tabTitle,
            folder: folderPath,
            chapters: chapters,
            chapterManager: null,
            searchManager: null,
            lazyLoader: null,
            isActive: false,
            isLocal: isLocal
        };

        STATE.tabs.set(tabId, newTab);
        this.createTabElement(newTab);
        this.createTabContent(newTab);
        this.switchToTab(tabId);
        await this.initializeTabContent(tabId);
    }

    createTabElement(tab) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tab.id;

        // Add indicator for imported content
        const indicator = tab.isLocal ? '📁 ' : '';

        tabElement.innerHTML = `
            <span class="tab-title" contenteditable="true">${indicator}${tab.title}</span>
            <span class="tab-folder">${tab.isLocal ? 'imported' : tab.folder}/</span>
            <button class="tab-close" aria-label="Close tab">&times;</button>
        `;

        const titleElement = tabElement.querySelector('.tab-title');
        titleElement.addEventListener('blur', (e) => {
            const newTitle = e.target.textContent.trim().replace('📁 ', '');
            if (newTitle) {
                tab.title = newTitle;
                e.target.textContent = (tab.isLocal ? '📁 ' : '') + newTitle;
            } else {
                e.target.textContent = (tab.isLocal ? '📁 ' : '') + tab.title;
            }
        });

        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleElement.blur();
            }
        });

        const newTabBtn = this.tabsContainer.querySelector('.new-tab-btn');
        if (newTabBtn) {
            this.tabsContainer.insertBefore(tabElement, newTabBtn);
        } else {
            this.tabsContainer.appendChild(tabElement);
        }
    }

    createTabContent(tab) {
        const contentElement = document.createElement('div');
        contentElement.className = 'tab-content';
        contentElement.dataset.tabId = tab.id;

        const folderDisplay = tab.isLocal ? 'imported content' : `${tab.folder}/`;

        contentElement.innerHTML = `
            <header class="main-header">
                <h1>${tab.title}</h1>
                <p class="subtitle">Loading content from ${folderDisplay}</p>

                <div class="header-controls">
                    <div class="theme-switcher">
                        <button class="theme-btn ${STATE.currentTheme === 'light' ? 'active' : ''}" data-theme="light">Light</button>
                        <button class="theme-btn ${STATE.currentTheme === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
                        <button class="theme-btn ${STATE.currentTheme === 'contrast' ? 'active' : ''}" data-theme="contrast">High Contrast</button>
                    </div>
                    <div class="search-container">
                        <input type="search" class="search-input" placeholder="Search formulas..." autocomplete="off">
                        <button class="clear-search" hidden>&times;</button>
                    </div>
                    <div class="view-controls">
                        <button class="control-btn expand-all">⊕ Expand All</button>
                        <button class="control-btn collapse-all">⊖ Collapse All</button>
                    </div>
                </div>

                <nav class="chapter-nav"></nav>
            </header>

            <main class="formula-collection">
                <div class="status-bar" hidden>
                    <span class="status-message"></span>
                </div>
                <div class="formula-collection-container"></div>
                <div class="no-results-message" hidden>
                    <p>No matching formulas found.</p>
                    <button class="control-btn clear-search-alt">Clear Search</button>
                </div>
                <div class="error-container" hidden>
                    <h3>Unable to Load Content</h3>
                    <p class="error-message"></p>
                    <button class="control-btn retry-load">Retry</button>
                </div>
            </main>
        `;

        this.tabContentArea.appendChild(contentElement);
    }

    async initializeTabContent(tabId) {
        const tab = STATE.tabs.get(tabId);
        if (!tab) return;

        const tabContent = document.querySelector(`.tab-content[data-tab-id="${tabId}"]`);
        if (!tabContent) return;

        tab.chapterManager = new ChapterManager(tabId, tab.folder, tab.isLocal);
        tab.searchManager = new SearchManager(tabId);
        tab.lazyLoader = new LazyLoader(tabId);

        await tab.chapterManager.loadChapters();
        tab.searchManager.buildSearchIndex();

        const subtitle = tabContent.querySelector('.subtitle');
        if (subtitle) {
            subtitle.textContent = `${tab.chapterManager.chapters.size} chapters loaded`;
        }
    }

    switchToTab(tabId) {
        STATE.tabs.forEach(tab => tab.isActive = false);
        const newActiveTab = STATE.tabs.get(tabId);
        if (newActiveTab) {
            newActiveTab.isActive = true;
            STATE.activeTabId = tabId;
        }

        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tabId === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabId === tabId);
        });
    }

    closeTab(tabId) {
        const tab = STATE.tabs.get(tabId);
        if (!tab) return;

        if (STATE.tabs.size === 1) {
            this.showStatus('Cannot close the last tab', 'warning');
            return;
        }

        // Clean up imported content if needed
        if (tab.isLocal && tab.folder) {
            localFileManager.clearImportedFolder(tab.folder);
        }

        if (tab.chapterManager) tab.chapterManager.cleanup();
        if (tab.searchManager) tab.searchManager.cleanup();
        if (tab.lazyLoader) tab.lazyLoader.disconnect();

        const tabElement = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        const contentElement = document.querySelector(`.tab-content[data-tab-id="${tabId}"]`);
        if (tabElement) tabElement.remove();
        if (contentElement) contentElement.remove();

        STATE.tabs.delete(tabId);

        if (STATE.activeTabId === tabId) {
            const remainingTabs = Array.from(STATE.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[remainingTabs.length - 1]);
            }
        }
    }

    handleTabClick(e) {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        const tabId = tab.dataset.tabId;

        if (e.target.classList.contains('tab-close')) {
            this.closeTab(tabId);
        } else if (!e.target.classList.contains('tab-title')) {
            this.switchToTab(tabId);
        }
    }

    handleKeyboardShortcuts(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 't') {
            e.preventDefault();
            this.showFolderSelection();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
            e.preventDefault();
            if (STATE.activeTabId) {
                this.closeTab(STATE.activeTabId);
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            this.switchToNextTab();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            this.switchToPreviousTab();
        }
    }

    switchToNextTab() {
        const tabIds = Array.from(STATE.tabs.keys());
        const currentIndex = tabIds.indexOf(STATE.activeTabId);
        const nextIndex = (currentIndex + 1) % tabIds.length;
        this.switchToTab(tabIds[nextIndex]);
    }

    switchToPreviousTab() {
        const tabIds = Array.from(STATE.tabs.keys());
        const currentIndex = tabIds.indexOf(STATE.activeTabId);
        const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
        this.switchToTab(tabIds[prevIndex]);
    }

    showStatus(message, type = 'info') {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) {
            console.log(message);
            return;
        }

        const statusBar = activeTab.querySelector('.status-bar');
        const statusMessage = activeTab.querySelector('.status-message');

        if (statusBar && statusMessage) {
            statusMessage.textContent = message;
            statusBar.hidden = false;

            setTimeout(() => {
                statusBar.hidden = true;
            }, 3000);
        }
    }
}
// --- CHAPTER MANAGEMENT WITH FIXED ANIMATIONS ---
class ChapterManager {
    constructor(tabId, folderPath, isLocal = false) {
        this.tabId = tabId;
        this.folderPath = folderPath;
        this.isLocal = isLocal; // Track if using imported files
        this.chapters = new Map();
        this.activeCharts = new Map();
        this.activeAnimations = new Map();
        this.container = null;
        this.chapterFiles = [];
    }

    async loadChapters() {
        const tabContent = document.querySelector(`.tab-content[data-tab-id="${this.tabId}"]`);
        if (!tabContent) return;

        this.container = tabContent.querySelector('.formula-collection-container');
        if (!this.container) return;

        const tab = STATE.tabs.get(this.tabId);
        if (tab && tab.chapters && tab.chapters.length > 0) {
            this.chapterFiles = tab.chapters;
        } else {
            this.chapterFiles = await this.discoverChapters();
        }

        let loadedCount = 0;
        let failedCount = 0;

        for (const chapterFile of this.chapterFiles) {
            const success = await this.loadChapter(chapterFile);
            if (success) {
                loadedCount++;
            } else {
                failedCount++;
            }
        }

        if (failedCount > 0 && loadedCount === 0) {
            this.showNoChaptersMessage();
        } else if (failedCount > 0) {
            this.showPartialLoadMessage(loadedCount, failedCount);
        }

        this.setupChapterNavigation();
    }

    async discoverChapters() {
        // Imported folders already have their chapters listed
        if (this.isLocal) {
            const folderInfo = localFileManager.getImportedFolder(this.folderPath);
            return folderInfo ? folderInfo.chapters : [];
        }

        // Remote folder discovery
        const commonFiles = [
            'index.html',
            'kinematics.html',
            'dynamics.html',
            'energy.html',
            'momentum.html'
        ];

        const availableChapters = [];
        for (const file of commonFiles) {
            try {
                const response = await fetch(`${this.folderPath}/${file}`, { method: 'HEAD' });
                if (response.ok) {
                    availableChapters.push(file);
                }
            } catch (e) {
                // File doesn't exist
            }
        }

        return availableChapters.length > 0 ? availableChapters : ['index.html'];
    }

    async loadChapter(filename) {
        const chapterPath = `${this.folderPath}/${filename}`;

        try {
            let html;

            // Check if this is imported content
            if (this.isLocal && STATE.localFileCache.has(chapterPath)) {
                html = STATE.localFileCache.get(chapterPath);
            } else {
                const response = await fetch(chapterPath);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                html = await response.text();
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const chapterElement = doc.querySelector('.chapter');
            if (chapterElement) {
                this.container.appendChild(chapterElement);
                const chapterId = chapterElement.id || `chapter-${this.chapters.size + 1}`;
                this.chapters.set(chapterId, chapterElement);
                this.setupChapterInteractions(chapterElement);
                this.initializeChapterPlots(chapterElement);
                return true;
            } else {
                const bodyContent = doc.body ? doc.body.innerHTML : html;
                if (bodyContent.trim()) {
                    const wrappedChapter = this.wrapContentAsChapter(filename, bodyContent);
                    this.container.appendChild(wrappedChapter);
                    const chapterId = `chapter-${this.chapters.size + 1}`;
                    this.chapters.set(chapterId, wrappedChapter);
                    this.setupChapterInteractions(wrappedChapter);
                    return true;
                }
            }

            throw new Error('No content found in file');
        } catch (error) {
            console.error(`Error loading chapter ${filename}:`, error);
            this.showChapterError(filename, error.message);
            return false;
        }
    }

    wrapContentAsChapter(filename, content) {
        const chapter = document.createElement('div');
        chapter.className = 'chapter';
        chapter.id = `chapter-${this.chapters.size + 1}`;

        const title = filename.replace('.html', '').replace(/-/g, ' ').replace(/_/g, ' ');
        const titleCase = title.charAt(0).toUpperCase() + title.slice(1);

        // Create empty toggle icon span - CSS will handle the display
        chapter.innerHTML = `
            <button class="chapter-header">
                <h2>${titleCase}</h2>
                <span class="toggle-icon"></span>
            </button>
            <div class="chapter-content">
                ${content}
            </div>
        `;

        return chapter;
    }

    showChapterError(filename, errorMessage) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chapter-error';
        const folderDisplay = this.isLocal ? 'imported content' : `"${this.folderPath}/" folder`;

        errorDiv.innerHTML = `
            <div style="padding: 20px; background: #fff5f5; border: 1px solid #ffcccc; border-radius: 8px; margin: 10px 0;">
                <h3 style="color: #d93025; margin-bottom: 8px;">⚠️ Failed to load: ${filename}</h3>
                <p style="color: #5f6368; margin-bottom: 12px;">${errorMessage}</p>
                <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; color: #1a73e8;">Troubleshooting tips</summary>
                    <ul style="margin-top: 8px; padding-left: 20px; color: #5f6368;">
                        ${this.isLocal ?
            `<li>Ensure the file was properly imported through Chapter Manager</li>
                             <li>Try re-importing the file</li>` :
            `<li>Check if the file exists in the ${folderDisplay}</li>
                             <li>Check browser console for CORS errors if loading from a different domain</li>`
        }
                        <li>Ensure the file has a .html extension</li>
                        <li>Verify the file contains valid HTML</li>
                    </ul>
                </details>
            </div>
        `;
        if (this.container) {
            this.container.appendChild(errorDiv);
        }
    }

    showNoChaptersMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'no-chapters-message';
        const folderDisplay = this.isLocal ? 'the imported content' : `the "${this.folderPath}/" folder`;

        messageDiv.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #5f6368;">
                <h3>No chapters could be loaded</h3>
                <p>Please check that the HTML files exist in ${folderDisplay}.</p>
                <p style="margin-top: 10px;">You can close this tab and create a new one with the correct chapter files.</p>
            </div>
        `;
        if (this.container) {
            this.container.appendChild(messageDiv);
        }
    }

    showPartialLoadMessage(loadedCount, failedCount) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'partial-load-message';
        messageDiv.innerHTML = `
            <div style="padding: 12px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; margin-bottom: 20px;">
                <p style="color: #f57c00; margin: 0;">
                    ⚠️ Loaded ${loadedCount} chapter${loadedCount !== 1 ? 's' : ''} successfully. 
                    ${failedCount} file${failedCount !== 1 ? 's' : ''} could not be loaded.
                </p>
            </div>
        `;
        if (this.container) {
            this.container.insertBefore(messageDiv, this.container.firstChild);
        }
    }

    // Enhanced chapter interactions with CSS-only toggle icons
    setupChapterInteractions(chapter) {
        const header = chapter.querySelector('.chapter-header');
        if (header) {
            // Ensure toggle icon exists and is empty
            let toggleIcon = header.querySelector('.toggle-icon');
            if (!toggleIcon) {
                toggleIcon = document.createElement('span');
                toggleIcon.className = 'toggle-icon';
                header.appendChild(toggleIcon);
            }
            // Keep icon empty - CSS pseudo-elements will handle display
            toggleIcon.textContent = '';

            header.removeAttribute('onclick');
            header.addEventListener('click', () => this.toggleChapter(chapter));
        }

        const subsections = chapter.querySelectorAll('.subsection');
        if (subsections.length > 0) {
            chapter.classList.add('has-subsections');

            subsections.forEach(subsection => {
                const subHeader = subsection.querySelector('.subsection-header');
                if (subHeader) {
                    // Add toggle icon if missing
                    let toggleIcon = subHeader.querySelector('.toggle-icon');
                    if (!toggleIcon) {
                        toggleIcon = document.createElement('span');
                        toggleIcon.className = 'toggle-icon';
                        subHeader.appendChild(toggleIcon);
                    }
                    // Keep icon empty - CSS pseudo-elements will handle display
                    toggleIcon.textContent = '';

                    subHeader.removeAttribute('onclick');
                    subHeader.addEventListener('click', () => this.toggleSubsection(subsection));
                }
            });

            this.setupSubsectionControls(chapter);
        }
    }

    setupSubsectionControls(chapter) {
        const controls = chapter.querySelector('.subsection-controls');
        if (!controls) return;

        const expandAllBtn = controls.querySelector('.expand-all-subsections');
        const collapseAllBtn = controls.querySelector('.collapse-all-subsections');

        if (expandAllBtn) {
            expandAllBtn.addEventListener('click', () => {
                chapter.querySelectorAll('.subsection').forEach(sub => {
                    this.toggleSubsection(sub, true);
                });
            });
        }

        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => {
                chapter.querySelectorAll('.subsection').forEach(sub => {
                    this.toggleSubsection(sub, false);
                });
            });
        }
    }

    setupChapterNavigation() {
        const tabContent = document.querySelector(`.tab-content[data-tab-id="${this.tabId}"]`);
        if (!tabContent) return;

        const nav = tabContent.querySelector('.chapter-nav');
        if (!nav) return;

        nav.innerHTML = '';
        this.chapters.forEach((chapter, id) => {
            const title = chapter.querySelector('.chapter-header h2')?.textContent || id;
            const navBtn = document.createElement('button');
            navBtn.className = 'chapter-nav-btn';
            navBtn.textContent = title;
            navBtn.addEventListener('click', () => {
                chapter.scrollIntoView({ behavior: 'smooth', block: 'start' });
                this.toggleChapter(chapter, true);
            });
            nav.appendChild(navBtn);
        });
    }

    // Toggle without manipulating icon text content
    toggleChapter(chapter, forceState = null) {
        const isActive = chapter.classList.contains('active');
        const shouldOpen = forceState !== null ? forceState : !isActive;

        if (shouldOpen) {
            chapter.classList.add('active');
            // Add expanded-complete class after animation
            setTimeout(() => {
                if (chapter.classList.contains('active')) {
                    chapter.classList.add('expanded-complete');
                }
            }, CONFIG.ANIMATION_DURATION);
        } else {
            chapter.classList.remove('active', 'expanded-complete');
        }
    }

    toggleSubsection(subsection, forceState = null) {
        const isActive = subsection.classList.contains('active');
        const shouldOpen = forceState !== null ? forceState : !isActive;

        if (shouldOpen) {
            subsection.classList.add('active');
            // Add expanded-complete class after animation
            setTimeout(() => {
                if (subsection.classList.contains('active')) {
                    subsection.classList.add('expanded-complete');
                }
            }, CONFIG.ANIMATION_DURATION);
        } else {
            subsection.classList.remove('active', 'expanded-complete');
        }
    }

    initializeChapterPlots(chapter) {
        const plots = chapter.querySelectorAll('[data-plot-id]');
        const tab = STATE.tabs.get(this.tabId);

        if (tab && tab.lazyLoader) {
            plots.forEach(plot => {
                tab.lazyLoader.observe(plot);
            });
        }
    }

    cleanup() {
        this.activeCharts.forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.activeCharts.clear();

        this.activeAnimations.forEach(animation => {
            if (animation && animation.stop) {
                animation.stop();
            }
        });
        this.activeAnimations.clear();
    }
}

// --- SEARCH MANAGER CLASS ---
class SearchManager {
    constructor(tabId) {
        this.tabId = tabId;
        this.tabContent = document.querySelector(`.tab-content[data-tab-id="${tabId}"]`);
        this.searchInput = this.tabContent?.querySelector('.search-input');
        this.clearButton = this.tabContent?.querySelector('.clear-search');
        this.noResultsMessage = this.tabContent?.querySelector('.no-results-message');
        this.searchIndex = [];

        this.initialize();
    }

    initialize() {
        if (!this.searchInput) return;

        const debouncedSearch = utils.debounce((e) => {
            this.performSearch(e.target.value);
        }, CONFIG.DEBOUNCE_DELAY);

        this.searchInput.addEventListener('input', debouncedSearch);

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.clearSearch());
        }

        const clearSearchAlt = this.tabContent?.querySelector('.clear-search-alt');
        if (clearSearchAlt) {
            clearSearchAlt.addEventListener('click', () => this.clearSearch());
        }
    }

    buildSearchIndex() {
        const tab = STATE.tabs.get(this.tabId);
        if (!tab) return;

        this.searchIndex = [];
        const formulaItems = this.tabContent.querySelectorAll('.formula-item');

        formulaItems.forEach(item => {
            const chapter = item.closest('.chapter');
            const text = item.textContent.toLowerCase();
            this.searchIndex.push({ element: item, chapter, text });
        });

        tab.searchIndex = this.searchIndex;
    }

    performSearch(query) {
        query = query.toLowerCase().trim();

        if (this.clearButton) {
            this.clearButton.hidden = !query;
        }

        if (!query) {
            this.clearSearch();
            return;
        }

        const tab = STATE.tabs.get(this.tabId);
        if (!tab || !tab.searchIndex) return;

        let hasResults = false;
        const matchedChapters = new Set();

        tab.searchIndex.forEach(({ element, chapter, text }) => {
            const matches = text.includes(query);
            element.classList.toggle('hidden', !matches);

            if (matches) {
                hasResults = true;
                matchedChapters.add(chapter);

                if (!element.dataset.originalContent) {
                    element.dataset.originalContent = element.innerHTML;
                }

                const regex = new RegExp(`(${query})`, 'gi');
                element.innerHTML = element.dataset.originalContent.replace(regex, '<mark class="highlight">$1</mark>');
            } else if (element.dataset.originalContent) {
                element.innerHTML = element.dataset.originalContent;
            }
        });

        this.tabContent.querySelectorAll('.chapter').forEach(chapter => {
            const hasMatch = matchedChapters.has(chapter);
            chapter.classList.toggle('hidden', !hasMatch);

            if (hasMatch && query && tab.chapterManager) {
                tab.chapterManager.toggleChapter(chapter, true);
            }
        });

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

        this.tabContent.querySelectorAll('.formula-item').forEach(item => {
            item.classList.remove('hidden');
            if (item.dataset.originalContent) {
                item.innerHTML = item.dataset.originalContent;
                delete item.dataset.originalContent;
            }
        });

        this.tabContent.querySelectorAll('.chapter').forEach(chapter => {
            chapter.classList.remove('hidden');
        });

        if (this.noResultsMessage) {
            this.noResultsMessage.hidden = true;
        }
    }

    cleanup() {
        // Remove event listeners if needed
    }
}

// --- LAZY LOADING WITH INTERSECTION OBSERVER ---
class LazyLoader {
    constructor(tabId) {
        this.tabId = tabId;
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
            PLOT_INITIALIZERS[plotId](element, this.tabId);
        }
    }

    observe(element) {
        this.observer.observe(element);
    }

    disconnect() {
        this.observer.disconnect();
    }
}

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

// --- PLOT INITIALIZATION ENGINE ---
const PLOT_INITIALIZERS = {
    'kinematics-1d-chartjs': async function(plotContainer, tabId) {
        if (typeof Chart === 'undefined') {
            await utils.loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        }

        const canvas = plotContainer.querySelector('.plot-canvas');
        if (!canvas) {
            console.error("Canvas element not found for plot 'kinematics-1d-chartjs'");
            return;
        }
        const ctx = canvas.getContext('2d');

        const x0Slider = plotContainer.querySelector('#k-x0-slider');
        const v0Slider = plotContainer.querySelector('#k-v0-slider');
        const accSlider = plotContainer.querySelector('#k-acc-slider');
        const x0Val = plotContainer.querySelector('#k-x0-val');
        const v0Val = plotContainer.querySelector('#k-v0-val');
        const accVal = plotContainer.querySelector('#k-acc-val');

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
                animation: { duration: 0 },
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
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });

        const tab = STATE.tabs.get(tabId);
        if (tab && tab.chapterManager) {
            const plotKey = `${tabId}-${plotContainer.dataset.plotId}`;
            tab.chapterManager.activeCharts.set(plotKey, motionChart);
        }

        const updateChartData = utils.debounce(() => {
            const x0 = parseFloat(x0Slider?.value || 0);
            const v0 = parseFloat(v0Slider?.value || 0);
            const a = parseFloat(accSlider?.value || 0);

            if (x0Val) x0Val.textContent = `${x0.toFixed(1)} m`;
            if (v0Val) v0Val.textContent = `${v0.toFixed(1)} m/s`;
            if (accVal) accVal.textContent = `${a.toFixed(1)} m/s²`;

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

        [x0Slider, v0Slider, accSlider].forEach(slider => {
            if (slider) {
                slider.addEventListener('input', updateChartData);
            }
        });

        updateChartData();
        perfMonitor.logMetric('plotsInitialized', perfMonitor.metrics.plotsInitialized + 1);
    },

    // Add more plot initializers as needed
};

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

        document.addEventListener('click', (e) => {
            if (e.target.matches('.theme-btn')) {
                this.apply(e.target.dataset.theme);
            }
        });
    }
};

// --- GLOBAL CONTROLS ---
class GlobalControls {
    constructor() {
        this.initialize();
    }

    initialize() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('.expand-all')) {
                this.expandAll();
            } else if (e.target.matches('.collapse-all')) {
                this.collapseAll();
            } else if (e.target.matches('.copy-btn')) {
                this.handleCopyButton(e.target);
            }
        });
    }

    expandAll() {
        const activeTab = STATE.tabs.get(STATE.activeTabId);
        if (activeTab && activeTab.chapterManager) {
            const tabContent = document.querySelector(`.tab-content[data-tab-id="${STATE.activeTabId}"]`);
            if (tabContent) {
                tabContent.querySelectorAll('.chapter').forEach(chapter => {
                    activeTab.chapterManager.toggleChapter(chapter, true);
                });
            }
        }
    }

    collapseAll() {
        const activeTab = STATE.tabs.get(STATE.activeTabId);
        if (activeTab && activeTab.chapterManager) {
            const tabContent = document.querySelector(`.tab-content[data-tab-id="${STATE.activeTabId}"]`);
            if (tabContent) {
                tabContent.querySelectorAll('.chapter').forEach(chapter => {
                    activeTab.chapterManager.toggleChapter(chapter, false);
                });
            }
        }
    }

    handleCopyButton(button) {
        const formulaEquation = button.closest('.formula-equation');
        if (!formulaEquation) return;

        const textToCopy = formulaEquation.textContent.replace('Copy', '').trim();

        navigator.clipboard.writeText(textToCopy).then(() => {
            button.classList.add('copied');
            button.textContent = 'Copied!';

            setTimeout(() => {
                button.classList.remove('copied');
                button.textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
}

// --- INITIALIZATION ---
let tabManager, globalControls;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOM Content Loaded - Starting initialization');

        // Show dev footer if enabled
        if (CONFIG.ENABLE_DEV_MODE) {
            const devFooter = document.getElementById('dev-footer');
            if (devFooter) {
                devFooter.hidden = false;
            }
        }

        // Initialize theme
        themeManager.initialize();

        // Initialize tab manager
        tabManager = new TabManager();

        // Initialize global controls
        globalControls = new GlobalControls();

        // Set up performance monitoring
        if (CONFIG.ENABLE_DEV_MODE) {
            perfMonitor.startFPSMonitoring();

            // Update chapter count display
            const updateChapterCount = () => {
                const chapterCount = document.getElementById('chapter-count');
                if (chapterCount) {
                    const activeTab = STATE.tabs.get(STATE.activeTabId);
                    if (activeTab && activeTab.chapterManager) {
                        chapterCount.textContent = activeTab.chapterManager.chapters.size;
                    }
                }
            };

            setInterval(updateChapterCount, 1000);
        }

        // Hide loading overlay with smooth fade
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }, 500);
        }

        // Log performance metrics
        if (window.performanceMetrics) {
            const totalLoadTime = performance.now() - window.performanceMetrics.startTime;
            console.log(`[Performance] Total load time: ${totalLoadTime.toFixed(2)}ms`);

            const loadTimeElement = document.getElementById('load-time');
            if (loadTimeElement) {
                loadTimeElement.textContent = totalLoadTime.toFixed(0);
            }
        }

        // Handle window resize for responsive adjustments
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Recalculate any responsive elements if needed
                console.log('Window resized');
            }, 250);
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            STATE.tabs.forEach(tab => {
                // Clean up imported content if needed
                if (tab.isLocal && tab.folder) {
                    localFileManager.clearImportedFolder(tab.folder);
                }
                if (tab.chapterManager) {
                    tab.chapterManager.cleanup();
                }
                if (tab.lazyLoader) {
                    tab.lazyLoader.disconnect();
                }
            });
            perfMonitor.stopFPSMonitoring();
        });

        console.log('Initialization complete');

    } catch (error) {
        console.error('Error during initialization:', error);

        // Show error to user
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            const loader = loadingOverlay.querySelector('.loader');
            if (loader) {
                loader.innerHTML = `
                    <div style="color: #d93025;">
                        <h3>Initialization Error</h3>
                        <p>${error.message}</p>
                        <button onclick="location.reload()" style="
                            margin-top: 10px;
                            padding: 8px 16px;
                            background: #1a73e8;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Reload Page</button>
                    </div>
                `;
            }
        }
    }
});

// Export for potential module usage
export {
    STATE,
    CONFIG,
    PLOT_INITIALIZERS,
    utils,
    TabManager,
    ChapterManager,
    SearchManager,
    LazyLoader,
    GlobalControls,
    PerformanceMonitor,
    themeManager,
    perfMonitor,
    localFileManager,
    LocalFileManager
};



