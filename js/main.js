// ===== MAIN APPLICATION INITIALIZATION =====

// Global state object
const AppState = {
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    prefersReducedMotion: false,
    prefersDarkMode: true, // Мы всегда используем тёмную тему
    isTouchDevice: false,
    networkStatus: 'good', // good, slow, offline
    currentBreakpoint: 'desktop',
    isMenuOpen: false,
    scrollPosition: 0,
    initialized: false
};

// DOM Elements cache
const DOM = {
    body: null,
    html: null,
    header: null,
    mobileMenuToggle: null,
    mobileNav: null,
    mobileMenuOverlay: null
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set up DOM cache
    setupDOMCache();
    
    // Detect device and capabilities
    detectDeviceCapabilities();
    
    // Initialize all core modules with error handling
    try {
        initCoreModules();
        initPerformanceOptimizations();
        initNetworkMonitoring();
        initViewportManagement();
        initTouchOptimizations();
        initScrollManagement();
        initPrintOptimizations();
        
        // Mark as initialized
        AppState.initialized = true;
        
        // Dispatch custom event for other scripts
        document.dispatchEvent(new CustomEvent('app:initialized', {
            detail: { state: AppState }
        }));
        
        console.log('✅ Application initialized successfully');
        console.log('📱 Device:', AppState.currentBreakpoint);
        console.log('🌐 Network:', AppState.networkStatus);
        console.log('🎮 Touch device:', AppState.isTouchDevice);
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        showErrorFallback();
    }
});

// ===== CORE INITIALIZATION =====

function setupDOMCache() {
    DOM.body = document.body;
    DOM.html = document.documentElement;
    DOM.header = document.querySelector('.header');
    DOM.mobileMenuToggle = document.getElementById('mobileMenuToggle');
    DOM.mobileNav = document.getElementById('mobileNav');
    DOM.mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
}

function detectDeviceCapabilities() {
    // Device type detection
    const viewportWidth = window.innerWidth;
    AppState.isMobile = viewportWidth <= 768;
    AppState.isTablet = viewportWidth > 768 && viewportWidth <= 1024;
    AppState.isDesktop = viewportWidth > 1024;
    
    // Breakpoint detection
    if (viewportWidth < 375) AppState.currentBreakpoint = 'xs';
    else if (viewportWidth < 568) AppState.currentBreakpoint = 'sm';
    else if (viewportWidth < 768) AppState.currentBreakpoint = 'md';
    else if (viewportWidth < 1024) AppState.currentBreakpoint = 'lg';
    else if (viewportWidth < 1440) AppState.currentBreakpoint = 'xl';
    else AppState.currentBreakpoint = '2xl';
    
    // Capabilities detection
    AppState.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    AppState.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    // Add body classes based on detection
    if (AppState.isMobile) DOM.body.classList.add('is-mobile');
    if (AppState.isTablet) DOM.body.classList.add('is-tablet');
    if (AppState.isDesktop) DOM.body.classList.add('is-desktop');
    if (AppState.isTouchDevice) DOM.body.classList.add('is-touch-device');
    if (AppState.prefersReducedMotion) DOM.body.classList.add('reduced-motion');
    
    DOM.body.classList.add(`breakpoint-${AppState.currentBreakpoint}`);
}

function initCoreModules() {
    // Initialize modules in order of importance
    initDarkTheme();
    initSmoothScroll();
    initHeaderScroll();
    
    // Conditional module initialization
    if (window.initLangSwitcher) initLangSwitcher();
    if (window.initAnimations && !AppState.prefersReducedMotion) initAnimations();
    if (window.initFleetManager) initFleetManager();
    if (window.initChat) initChat();
    
    // Check admin status (if function exists)
    if (window.checkAdminStatus) checkAdminStatus();
}

// ===== PERFORMANCE OPTIMIZATIONS =====

function initPerformanceOptimizations() {
    // Disable animations if user prefers reduced motion
    if (AppState.prefersReducedMotion) {
        disableAnimations();
    }
    
    // Optimize for touch devices
    if (AppState.isTouchDevice) {
        optimizeForTouch();
    }
    
    // Lazy load non-critical images
    if ('loading' in HTMLImageElement.prototype) {
        lazyLoadImages();
    } else {
        loadPolyfill('lazysizes').then(lazyLoadImages);
    }
    
    // Request Idle Callback for non-critical tasks
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(initNonCriticalModules, { timeout: 2000 });
    } else {
        setTimeout(initNonCriticalModules, 1000);
    }
}

function disableAnimations() {
    // Add class to disable CSS animations
    DOM.body.classList.add('no-animations');
    
    // Disable AOS if it's loaded
    if (window.AOS) {
        AOS.init({
            disable: true
        });
    }
}

function optimizeForTouch() {
    // Increase tap targets for touch devices
    const tapTargets = document.querySelectorAll('.cta-button, .nav-links a, .filter-btn, .video-control-btn');
    tapTargets.forEach(el => {
        el.style.minHeight = '44px';
        el.style.minWidth = '44px';
    });
    
    // Add touch feedback
    document.addEventListener('touchstart', function() {}, { passive: true });
    
    // Prevent double-tap zoom
    document.addEventListener('dblclick', function(e) {
        if (AppState.isTouchDevice) {
            e.preventDefault();
        }
    }, { passive: false });
}

function lazyLoadImages() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

async function loadPolyfill(polyfillName) {
    const polyfills = {
        lazysizes: 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js',
        intersection: 'https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver'
    };
    
    if (polyfills[polyfillName]) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = polyfills[polyfillName];
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

function initNonCriticalModules() {
    // Initialize modules that aren't critical for initial render
    console.log('🔄 Initializing non-critical modules...');
    
    // Example: Load additional fonts, prefetch links, etc.
    if (AppState.networkStatus === 'good') {
        prefetchImportantLinks();
    }
}

// ===== NETWORK MONITORING =====

function initNetworkMonitoring() {
    // Check initial connection
    AppState.networkStatus = navigator.onLine ? 'good' : 'offline';
    updateNetworkStatus();
    
    // Listen for network changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check for slow connections
    if ('connection' in navigator) {
        const connection = navigator.connection;
        if (connection) {
            if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                AppState.networkStatus = 'slow';
                updateNetworkStatus();
            }
            
            connection.addEventListener('change', handleConnectionChange);
        }
    }
}

function handleOnline() {
    AppState.networkStatus = 'good';
    updateNetworkStatus();
    console.log('🌐 Network: Online');
}

function handleOffline() {
    AppState.networkStatus = 'offline';
    updateNetworkStatus();
    console.log('🌐 Network: Offline');
    
    // Show offline notification
    showOfflineNotification();
}

function handleConnectionChange() {
    const connection = navigator.connection;
    if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        AppState.networkStatus = 'slow';
    } else {
        AppState.networkStatus = 'good';
    }
    updateNetworkStatus();
}

function updateNetworkStatus() {
    DOM.body.classList.remove('network-good', 'network-slow', 'network-offline');
    DOM.body.classList.add(`network-${AppState.networkStatus}`);
    
    // Update video quality based on network
    const videoContainer = document.querySelector('.video-hero-container');
    if (videoContainer) {
        if (AppState.networkStatus === 'slow' || AppState.networkStatus === 'offline') {
            videoContainer.classList.add('data-saver', 'slow-connection');
        } else {
            videoContainer.classList.remove('data-saver', 'slow-connection');
        }
    }
}

function showOfflineNotification() {
    // Only show on mobile/tablet
    if (AppState.isMobile || AppState.isTablet) {
        const notification = document.createElement('div');
        notification.className = 'offline-notification';
        notification.innerHTML = `
            <span>📶 Отсутствует подключение к интернету</span>
            <button class="close-notification">×</button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
        
        // Auto-remove when back online
        window.addEventListener('online', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, { once: true });
    }
}

// ===== VIEWPORT MANAGEMENT =====

function initViewportManagement() {
    // Handle viewport orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Handle resize with debounce
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 250);
    });
    
    // Initial viewport setup
    setupViewport();
}

function handleOrientationChange() {
    console.log('🔄 Orientation changed:', screen.orientation.type);
    
    // Add class for orientation
    if (screen.orientation.type.includes('landscape')) {
        DOM.body.classList.add('landscape');
        DOM.body.classList.remove('portrait');
    } else {
        DOM.body.classList.add('portrait');
        DOM.body.classList.remove('landscape');
    }
    
    // Refresh AOS on orientation change
    if (window.AOS) {
        setTimeout(() => AOS.refresh(), 300);
    }
}

function handleResize() {
    const newViewportWidth = window.innerWidth;
    
    // Only update if breakpoint changed significantly
    let newBreakpoint = AppState.currentBreakpoint;
    if (newViewportWidth < 375) newBreakpoint = 'xs';
    else if (newViewportWidth < 568) newBreakpoint = 'sm';
    else if (newViewportWidth < 768) newBreakpoint = 'md';
    else if (newViewportWidth < 1024) newBreakpoint = 'lg';
    else if (newViewportWidth < 1440) newBreakpoint = 'xl';
    else newBreakpoint = '2xl';
    
    if (newBreakpoint !== AppState.currentBreakpoint) {
        AppState.currentBreakpoint = newBreakpoint;
        DOM.body.className = DOM.body.className.replace(/\bbreakpoint-\w+\b/g, '');
        DOM.body.classList.add(`breakpoint-${newBreakpoint}`);
        
        console.log('🔄 Breakpoint changed:', newBreakpoint);
        
        // Close mobile menu if resizing to desktop
        if (newViewportWidth > 768 && AppState.isMenuOpen && window.mobileMenu) {
            window.mobileMenu.close();
        }
    }
    
    // Update device type
    AppState.isMobile = newViewportWidth <= 768;
    AppState.isTablet = newViewportWidth > 768 && newViewportWidth <= 1024;
    AppState.isDesktop = newViewportWidth > 1024;
    
    DOM.body.classList.toggle('is-mobile', AppState.isMobile);
    DOM.body.classList.toggle('is-tablet', AppState.isTablet);
    DOM.body.classList.toggle('is-desktop', AppState.isDesktop);
}

function setupViewport() {
    // Prevent zoom on mobile input focus
    if (AppState.isMobile) {
        document.addEventListener('touchstart', function(e) {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // Set initial orientation
    handleOrientationChange();
}

// ===== TOUCH OPTIMIZATIONS =====

function initTouchOptimizations() {
    if (!AppState.isTouchDevice) return;
    
    // Add touch-specific event listeners
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Prevent pull-to-refresh on iOS
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    
    // Add momentum scrolling for iOS
    if (iOS()) {
        document.addEventListener('touchmove', function(e) {
            if (e.scale !== 1) {
                e.preventDefault();
            }
        }, { passive: false });
    }
}

function handleTouchStart(e) {
    AppState.touchStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
    // Prevent rubber-band scrolling on iOS when at top
    if (window.scrollY === 0 && e.touches[0].clientY > AppState.touchStartY) {
        e.preventDefault();
    }
}

function handleTouchEnd() {
    AppState.touchStartY = null;
}

function iOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ===== SCROLL MANAGEMENT =====

function initScrollManagement() {
    // Initialize smooth scroll
    initSmoothScroll();
    
    // Initialize header scroll effect
    initHeaderScroll();
    
    // Listen for scroll events with throttling
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (!scrollTimeout) {
            scrollTimeout = setTimeout(() => {
                AppState.scrollPosition = window.pageYOffset;
                scrollTimeout = null;
            }, 100);
        }
    });
    
    // Update scroll position on load
    AppState.scrollPosition = window.pageYOffset;
}

function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;
            
            // Calculate offset based on device
            const headerHeight = DOM.header ? DOM.header.offsetHeight : 80;
            const offset = AppState.isMobile ? headerHeight - 10 : headerHeight;
            
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
            
            // Smooth scroll with different behavior based on preferences
            if (AppState.prefersReducedMotion) {
                window.scrollTo({ top: targetPosition });
            } else {
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
            
            // Close mobile menu if open
            if (AppState.isMenuOpen && window.mobileMenu) {
                window.mobileMenu.close();
            }
            
            // Update URL without page reload
            history.pushState(null, null, targetId);
        });
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        const hash = window.location.hash;
        if (hash) {
            const targetElement = document.querySelector(hash);
            if (targetElement) {
                const headerHeight = DOM.header ? DOM.header.offsetHeight : 80;
                const offset = AppState.isMobile ? headerHeight - 10 : headerHeight;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
                
                window.scrollTo({ top: targetPosition });
            }
        }
    });
}

function initHeaderScroll() {
    if (!DOM.header) return;
    
    let lastScrollTop = 0;
    const scrollThreshold = 100;
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add/remove scrolled class
        if (scrollTop > scrollThreshold) {
            DOM.header.classList.add('scrolled');
        } else {
            DOM.header.classList.remove('scrolled');
        }
        
        // Hide/show header on scroll (only on mobile)
        if (AppState.isMobile) {
            if (scrollTop > lastScrollTop && scrollTop > 200) {
                DOM.header.classList.add('hidden');
            } else {
                DOM.header.classList.remove('hidden');
            }
        }
        
        lastScrollTop = scrollTop;
    });
}

// ===== PRINT OPTIMIZATIONS =====

function initPrintOptimizations() {
    // Add print styles dynamically
    window.addEventListener('beforeprint', () => {
        DOM.body.classList.add('printing');
        console.log('🖨️ Preparing for print...');
    });
    
    window.addEventListener('afterprint', () => {
        DOM.body.classList.remove('printing');
        console.log('✅ Print complete');
    });
    
    // Add print button for mobile (optional)
    if (AppState.isMobile) {
        const printButton = document.createElement('button');
        printButton.className = 'print-button hidden';
        printButton.innerHTML = '🖨️ Печать';
        printButton.addEventListener('click', () => window.print());
        document.body.appendChild(printButton);
    }
}

// ===== THEME MANAGEMENT =====

function initDarkTheme() {
    // Force dark theme for our design
    DOM.body.classList.add('dark-theme');
    
    // Set meta theme-color for mobile browsers
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.name = 'theme-color';
        document.head.appendChild(metaThemeColor);
    }
    
    // Update theme color based on scroll
    updateThemeColor();
    
    // Update on scroll
    window.addEventListener('scroll', updateThemeColor);
}

function updateThemeColor() {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) return;
    
    const scrollTop = window.pageYOffset;
    
    if (scrollTop > 100) {
        metaThemeColor.content = '#000000'; // Darker when scrolled
    } else {
        metaThemeColor.content = '#0a0a0a'; // Slightly lighter at top
    }
}

// ===== ERROR HANDLING =====

function showErrorFallback() {
    // Show user-friendly error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-fallback';
    errorMessage.innerHTML = `
        <div class="error-content">
            <h3>Что-то пошло не так</h3>
            <p>Попробуйте обновить страницу или вернуться позже.</p>
            <button onclick="location.reload()">🔄 Обновить страницу</button>
        </div>
    `;
    
    document.body.appendChild(errorMessage);
}

// ===== UTILITY FUNCTIONS =====

function prefetchImportantLinks() {
    // Prefetch next likely pages
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href !== '#') {
            const linkElement = document.createElement('link');
            linkElement.rel = 'prefetch';
            linkElement.href = href;
            document.head.appendChild(linkElement);
        }
    });
}

// ===== PUBLIC API =====

// Export utility functions for other scripts
window.AppUtils = {
    getState: () => ({ ...AppState }),
    isMobile: () => AppState.isMobile,
    isTablet: () => AppState.isTablet,
    isDesktop: () => AppState.isDesktop,
    getNetworkStatus: () => AppState.networkStatus,
    getBreakpoint: () => AppState.currentBreakpoint,
    scrollToElement: (elementId, offset = 0) => {
        const element = document.querySelector(elementId);
        if (element) {
            const headerHeight = DOM.header ? DOM.header.offsetHeight : 80;
            const targetPosition = element.getBoundingClientRect().top + window.pageYOffset - headerHeight - offset;
            
            if (AppState.prefersReducedMotion) {
                window.scrollTo({ top: targetPosition });
            } else {
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    },
    updateMenuState: (isOpen) => {
        AppState.isMenuOpen = isOpen;
        if (isOpen) {
            DOM.body.classList.add('menu-open');
        } else {
            DOM.body.classList.remove('menu-open');
        }
    }
};

// ===== ERROR BOUNDARY =====

// Global error handler
window.addEventListener('error', function(e) {
    console.error('🚨 Global error caught:', e.error);
    
    // Don't show error UI for minor errors
    if (e.error instanceof TypeError && e.error.message.includes('undefined')) {
        return;
    }
    
    // Log to console only in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.error('Stack:', e.error.stack);
    }
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', function(e) {
    console.error('🚨 Unhandled promise rejection:', e.reason);
});

// ===== CLEANUP =====

// Clean up event listeners on page unload
window.addEventListener('beforeunload', function() {
    // Remove any temporary elements
    const tempElements = document.querySelectorAll('.offline-notification, .error-fallback');
    tempElements.forEach(el => el.remove());
    
    // Clean up observers
    if (window.imageObserver) {
        window.imageObserver.disconnect();
    }
});

// ===== INITIALIZATION COMPLETE =====

// Add loaded class after everything is ready
window.addEventListener('load', function() {
    DOM.body.classList.add('loaded');
    
    // Remove loading spinner if exists
    const loadingSpinner = document.querySelector('.loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    
    console.log('🚀 Page fully loaded');
});