function initAnimations() {
    // Initialize scroll animations
    initScrollAnimations();
    
    // Add hover effects
    initHoverEffects();
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('[data-aos]').forEach(el => {
        observer.observe(el);
    });
}

function initHoverEffects() {
    // Add subtle hover effects to interactive elements
    document.addEventListener('mouseover', function(e) {
        if (e.target.matches('.cta-button, .car-card, .filter-btn')) {
            e.target.style.transform = 'translateY(-2px)';
        }
    });
    
    document.addEventListener('mouseout', function(e) {
        if (e.target.matches('.cta-button, .car-card, .filter-btn')) {
            e.target.style.transform = 'translateY(0)';
        }
    });
}