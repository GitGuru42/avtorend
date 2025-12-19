// ===== MOBILE MENU MANAGEMENT =====

// Mobile Menu State
const MobileMenu = {
    isOpen: false,
    isAnimating: false,
    touchStartX: 0,
    touchStartY: 0,
    swipeThreshold: 50,
    menuWidth: 0,
    lastScrollPosition: 0
};

// Initialize Mobile Menu
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM готов, инициализируем мобильное меню...');
    // Wait for DOM to be ready
    setTimeout(() => {
        initMobileMenu();
    }, 100);
});

function initMobileMenu() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuClose = document.getElementById('mobileCloseBtn');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileNav = document.getElementById('mobileNav');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    const desktopLangSwitch = document.getElementById('langSwitch');
    const mobileLangSwitch = document.getElementById('mobileLangSwitch');
    
    console.log('🔍 Поиск элементов мобильного меню:');
    console.log('- Кнопка меню:', menuToggle);
    console.log('- Мобильное меню:', mobileNav);
    console.log('- Оверлей:', menuOverlay);
    console.log('- Кнопка закрытия:', menuClose);
    
    // Check if mobile menu elements exist
    if (!menuToggle || !mobileNav) {
        console.warn('⚠️ Mobile menu elements not found');
        return;
    }
    
    // Store menu width for swipe calculations
    MobileMenu.menuWidth = mobileNav.offsetWidth || 300;
    
    // Setup event listeners
    setupMenuEventListeners();
    
    // Setup touch gestures for swipe to close
    setupSwipeGestures();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
    
    // Sync language switchers
    syncLanguageSwitchers();
    
    // Add animation delays to menu items
    animateMenuItems();
    
    // Update state when window resizes
    window.addEventListener('resize', handleMenuResize);
    
    // Close menu when clicking outside on desktop
    if (window.innerWidth > 768) {
        document.addEventListener('click', handleOutsideClick);
    }
    
    console.log('✅ Mobile menu initialized');
}

function setupMenuEventListeners() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuClose = document.getElementById('mobileCloseBtn');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileNav = document.getElementById('mobileNav');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    
    console.log('🔧 Настройка обработчиков событий...');
    
    // Toggle menu on burger click
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        
        console.log('🟡 Клик по бургеру');
        console.log('- Текущее состояние:', MobileMenu.isOpen ? 'Открыто' : 'Закрыто');
        console.log('- Анимируется:', MobileMenu.isAnimating);
        
        if (MobileMenu.isAnimating) {
            console.log('⏳ Меню анимируется, пропускаем клик');
            return;
        }
        
        if (MobileMenu.isOpen) {
            console.log('🔴 Закрываем меню');
            closeMobileMenu();
        } else {
            console.log('🟢 Открываем меню');
            openMobileMenu();
        }
    });
    
    // Close menu with overlay click
    menuOverlay.addEventListener('click', function(e) {
        console.log('🟡 Клик по оверлею');
        if (e.target === menuOverlay && MobileMenu.isOpen) {
            closeMobileMenu();
        }
    });
    
    // Close menu with close button
    menuClose.addEventListener('click', function() {
        console.log('🟡 Клик по кнопке закрытия в меню');
        closeMobileMenu();
    });
    
    // Close menu when clicking a link
    mobileLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('🟡 Клик по ссылке в меню');
            // Handle anchor links
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                handleAnchorLinkClick(this, href);
            } else {
                closeMobileMenu();
            }
        });
    });
    
    // Close menu with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && MobileMenu.isOpen) {
            console.log('🟡 Нажата клавиша Escape');
            closeMobileMenu();
        }
    });
    
    // Prevent body scroll when menu is open
    mobileNav.addEventListener('touchmove', function(e) {
        if (MobileMenu.isOpen) {
            e.preventDefault();
        }
    }, { passive: false });
}

function setupSwipeGestures() {
    const mobileNav = document.getElementById('mobileNav');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    
    if (!mobileNav) return;
    
    // Touch start
    mobileNav.addEventListener('touchstart', function(e) {
        MobileMenu.touchStartX = e.touches[0].clientX;
        MobileMenu.touchStartY = e.touches[0].clientY;
        MobileMenu.touchStartTime = Date.now();
    }, { passive: true });
    
    // Touch move
    mobileNav.addEventListener('touchmove', function(e) {
        if (!MobileMenu.isOpen || MobileMenu.isAnimating) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - MobileMenu.touchStartX;
        const deltaY = Math.abs(touchY - MobileMenu.touchStartY);
        
        // Only handle horizontal swipes
        if (Math.abs(deltaX) > deltaY && deltaX > 0) {
            e.preventDefault();
            
            // Calculate swipe progress
            const swipeProgress = Math.min(deltaX / MobileMenu.menuWidth, 1);
            
            // Update menu position
            mobileNav.style.transform = `translateX(${swipeProgress * 100}%)`;
            menuOverlay.style.opacity = (1 - swipeProgress * 0.7).toString();
        }
    }, { passive: false });
    
    // Touch end
    mobileNav.addEventListener('touchend', function(e) {
        if (!MobileMenu.isOpen || MobileMenu.isAnimating) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - MobileMenu.touchStartX;
        const deltaTime = Date.now() - MobileMenu.touchStartTime;
        const velocity = deltaX / deltaTime;
        
        // Reset transform
        mobileNav.style.transform = '';
        
        // Check if swipe meets threshold
        if (deltaX > MobileMenu.swipeThreshold || velocity > 0.3) {
            closeMobileMenu();
        }
    }, { passive: true });
    
    // Also allow swipe on overlay
    menuOverlay.addEventListener('touchstart', function(e) {
        MobileMenu.touchStartX = e.touches[0].clientX;
        MobileMenu.touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    menuOverlay.addEventListener('touchend', function(e) {
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - MobileMenu.touchStartX;
        
        // Swipe right on overlay to close
        if (deltaX > MobileMenu.swipeThreshold) {
            closeMobileMenu();
        }
    }, { passive: true });
}

function setupKeyboardNavigation() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuClose = document.getElementById('mobileCloseBtn');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    
    // Trap focus inside menu when open
    document.addEventListener('keydown', function(e) {
        if (!MobileMenu.isOpen) return;
        
        const focusableElements = mobileLinks;
        const firstElement = focusableElements[0];
        const lastElement = menuClose;
        
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    });
    
    // Focus management
    menuToggle.addEventListener('click', function() {
        setTimeout(() => {
            if (MobileMenu.isOpen) {
                const closeBtn = document.getElementById('mobileCloseBtn');
                if (closeBtn) closeBtn.focus();
            } else {
                menuToggle.focus();
            }
        }, 100);
    });
}

function syncLanguageSwitchers() {
    const desktopLangSwitch = document.getElementById('langSwitch');
    const mobileLangSwitch = document.getElementById('mobileLangSwitch');
    
    if (!desktopLangSwitch || !mobileLangSwitch) return;
    
    // Sync from desktop to mobile
    desktopLangSwitch.addEventListener('click', function() {
        const currentLang = this.textContent;
        mobileLangSwitch.textContent = currentLang === 'EN' ? 'RU' : 'EN';
    });
    
    // Sync from mobile to desktop
    mobileLangSwitch.addEventListener('click', function() {
        const currentLang = this.textContent;
        desktopLangSwitch.textContent = currentLang === 'EN' ? 'RU' : 'EN';
    });
}

function animateMenuItems() {
    const menuItems = document.querySelectorAll('.mobile-nav-link');
    
    menuItems.forEach((item, index) => {
        // Add delay for staggered animation
        item.style.transitionDelay = `${index * 0.05}s`;
        
        // Add hover effect
        item.addEventListener('mouseenter', function() {
            if (!MobileMenu.isAnimating) {
                this.style.transform = 'translateX(5px)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
}

function openMobileMenu() {
    console.log('🟢 === openMobileMenu() вызвана ===');
    
    if (MobileMenu.isOpen || MobileMenu.isAnimating) {
        console.log('⏳ Меню уже открыто или анимируется');
        return;
    }
    
    MobileMenu.isAnimating = true;
    MobileMenu.isOpen = true;
    
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileNav = document.getElementById('mobileNav');
    const body = document.body;
    
    console.log('✏️ Добавляем классы:');
    console.log('- Кнопке:', menuToggle);
    console.log('- Оверлею:', menuOverlay);
    console.log('- Меню:', mobileNav);
    
    // Save current scroll position
    MobileMenu.lastScrollPosition = window.pageYOffset;
    
    // Add active classes
    if (menuToggle) menuToggle.classList.add('active');
    if (menuOverlay) menuOverlay.classList.add('active');
    if (mobileNav) mobileNav.classList.add('active');
    if (body) body.classList.add('menu-open');
    
    // Update ARIA attributes
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'true');
        menuToggle.setAttribute('aria-label', 'Закрыть меню навигации');
    }
    if (mobileNav) {
        mobileNav.setAttribute('aria-hidden', 'false');
    }
    
    // Disable body scroll
    disableBodyScroll();
    
    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('mobilemenu:open'));
    
    // Focus close button for accessibility
    setTimeout(() => {
        const closeBtn = document.getElementById('mobileCloseBtn');
        if (closeBtn) closeBtn.focus();
        
        MobileMenu.isAnimating = false;
        console.log('✅ Меню открыто');
    }, 350);
}

function closeMobileMenu() {
    console.log('🔴 === closeMobileMenu() вызвана ===');
    
    if (!MobileMenu.isOpen || MobileMenu.isAnimating) {
        console.log('⏳ Меню уже закрыто или анимируется');
        return;
    }
    
    MobileMenu.isAnimating = true;
    
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuOverlay = document.getElementById('mobileMenuOverlay');
    const mobileNav = document.getElementById('mobileNav');
    const body = document.body;
    
    console.log('✏️ Убираем классы');
    
    // Remove active classes
    if (menuToggle) menuToggle.classList.remove('active');
    if (menuOverlay) menuOverlay.classList.remove('active');
    if (mobileNav) mobileNav.classList.remove('active');
    if (body) body.classList.remove('menu-open');
    
    // Update ARIA attributes
    if (menuToggle) {
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Открыть меню навигации');
    }
    if (mobileNav) {
        mobileNav.setAttribute('aria-hidden', 'true');
    }
    
    // Enable body scroll
    enableBodyScroll();
    
    // Dispatch custom event
    document.dispatchEvent(new CustomEvent('mobilemenu:close'));
    
    // Focus menu toggle for accessibility
    setTimeout(() => {
        if (menuToggle) {
            menuToggle.focus();
            console.log('✨ Фокус возвращен на кнопку меню');
        }
        
        MobileMenu.isOpen = false;
        MobileMenu.isAnimating = false;
        console.log('✅ Меню закрыто');
    }, 350);
}

function disableBodyScroll() {
    const body = document.body;
    const scrollY = window.scrollY;
    
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    
    // For iOS
    body.style.touchAction = 'none';
    body.style.webkitOverflowScrolling = 'none';
}

function enableBodyScroll() {
    const body = document.body;
    const scrollY = parseInt(body.style.top || '0') * -1;
    
    body.style.position = '';
    body.style.top = '';
    body.style.width = '';
    body.style.overflow = '';
    body.style.touchAction = '';
    body.style.webkitOverflowScrolling = '';
    
    // Restore scroll position
    window.scrollTo(0, scrollY);
}

function handleAnchorLinkClick(linkElement, href) {
    console.log('🔗 Клик по якорной ссылке:', href);
    
    // Close menu first
    closeMobileMenu();
    
    // Wait for menu to close, then scroll to section
    setTimeout(() => {
        const targetElement = document.querySelector(href);
        if (targetElement) {
            const header = document.querySelector('.header');
            const headerHeight = header ? header.offsetHeight : 80;
            const offset = window.innerWidth < 768 ? headerHeight - 10 : headerHeight;
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
            
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                window.scrollTo({ top: targetPosition });
            } else {
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
            
            // Update URL
            history.pushState(null, null, href);
            console.log('🎯 Прокрутка к элементу:', href);
        }
    }, 400);
}

function handleMenuResize() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
        MobileMenu.menuWidth = mobileNav.offsetWidth;
    }
    
    // Close menu if resizing to desktop
    if (window.innerWidth > 768 && MobileMenu.isOpen) {
        console.log('🔄 Ресайз на десктоп, закрываем меню');
        closeMobileMenu();
    }
}

function handleOutsideClick(e) {
    const mobileNav = document.getElementById('mobileNav');
    const menuToggle = document.getElementById('mobileMenuToggle');
    
    if (MobileMenu.isOpen && 
        mobileNav && 
        !mobileNav.contains(e.target) && 
        menuToggle && 
        !menuToggle.contains(e.target)) {
        console.log('🖱️ Клик вне меню, закрываем');
        closeMobileMenu();
    }
}

// ===== PUBLIC API =====

// Export functions for use in other scripts
window.mobileMenu = {
    open: openMobileMenu,
    close: closeMobileMenu,
    toggle: function() {
        console.log('🔄 Toggle вызван');
        if (MobileMenu.isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    },
    isOpen: function() {
        return MobileMenu.isOpen;
    },
    isAnimating: function() {
        return MobileMenu.isAnimating;
    }
};

// ===== ERROR HANDLING =====

// Add error boundary for mobile menu
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(initMobileMenu, 100);
        });
    } else {
        setTimeout(initMobileMenu, 100);
    }
} catch (error) {
    console.error('❌ Mobile menu initialization failed:', error);
    
    // Provide fallback - show all navigation items
    const navLinks = document.querySelector('.nav-links');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    
    if (navLinks && mobileMenuToggle) {
        mobileMenuToggle.style.display = 'none';
        navLinks.style.display = 'flex';
        console.log('🔄 Включен фолбэк: показываем десктопную навигацию');
    }
}

// ===== PERFORMANCE OPTIMIZATIONS =====

// Debounce resize handler
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleMenuResize, 250);
});

// Throttle scroll handler
let scrollTimeout;
window.addEventListener('scroll', function() {
    if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
            // Update last scroll position
            MobileMenu.lastScrollPosition = window.pageYOffset;
            scrollTimeout = null;
        }, 100);
    }
});

// ===== ACCESSIBILITY IMPROVEMENTS =====

// Add ARIA attributes dynamically
function enhanceAccessibility() {
    console.log('♿ Улучшаем доступность меню');
    
    const menuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    
    if (menuToggle) {
        menuToggle.setAttribute('aria-haspopup', 'true');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'mobileNav');
        menuToggle.setAttribute('aria-label', 'Открыть меню навигации');
    }
    
    if (mobileNav) {
        mobileNav.setAttribute('aria-hidden', 'true');
        mobileNav.setAttribute('aria-label', 'Меню навигации');
        mobileNav.setAttribute('role', 'navigation');
    }
    
    // Update ARIA attributes when menu opens/closes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                const isOpen = mobileNav.classList.contains('active');
                
                if (menuToggle) {
                    menuToggle.setAttribute('aria-expanded', isOpen.toString());
                    menuToggle.setAttribute('aria-label', isOpen ? 'Закрыть меню навигации' : 'Открыть меню навигации');
                }
                
                if (mobileNav) {
                    mobileNav.setAttribute('aria-hidden', (!isOpen).toString());
                }
            }
        });
    });
    
    if (mobileNav) {
        observer.observe(mobileNav, { attributes: true });
    }
}

// Run accessibility enhancements after init
setTimeout(enhanceAccessibility, 500);

// ===== ANIMATION PERFORMANCE =====

// Use will-change for better performance
function optimizeAnimations() {
    const menuItems = document.querySelectorAll('.mobile-nav-link');
    const mobileNav = document.getElementById('mobileNav');
    
    if (mobileNav) {
        mobileNav.style.willChange = 'transform';
    }
    
    menuItems.forEach(item => {
        item.style.willChange = 'transform, opacity';
    });
    
    // Remove will-change after animations complete
    setTimeout(() => {
        if (mobileNav) {
            mobileNav.style.willChange = 'auto';
        }
        
        menuItems.forEach(item => {
            item.style.willChange = 'auto';
        });
    }, 1000);
}

// Run optimization
setTimeout(optimizeAnimations, 100);

// ===== CLEANUP =====

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    console.log('🧹 Очистка меню перед уходом');
    // Remove any event listeners that might cause memory leaks
    const menuToggle = document.getElementById('mobileMenuToggle');
    const menuClose = document.getElementById('mobileCloseBtn');
    
    if (menuToggle) {
        menuToggle.replaceWith(menuToggle.cloneNode(true));
    }
    
    if (menuClose) {
        menuClose.replaceWith(menuClose.cloneNode(true));
    }
});

// ===== DEBUG HELPER =====
// Добавляем глобальную функцию для отладки
window.debugMobileMenu = function() {
    console.log('=== DEBUG MOBILE MENU ===');
    console.log('Состояние:', MobileMenu);
    console.log('Кнопка меню:', document.getElementById('mobileMenuToggle'));
    console.log('Меню:', document.getElementById('mobileNav'));
    console.log('Класс active на меню:', document.getElementById('mobileNav').classList.contains('active'));
    console.log('Класс active на кнопке:', document.getElementById('mobileMenuToggle').classList.contains('active'));
    console.log('=== END DEBUG ===');
};