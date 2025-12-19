// lang-switcher.js - Complete language switcher for LuxuryDrive website

let currentLang = 'ru';
let translations = {};

/**
 * Инициализация переключателя языка
 */
function initLangSwitcher() {
    // Проверяем сохраненный язык
    const savedLang = localStorage.getItem('preferredLang');
    if (savedLang && (savedLang === 'ru' || savedLang === 'en')) {
        currentLang = savedLang;
    }
    
    // Устанавливаем атрибут lang для HTML
    document.documentElement.lang = currentLang;
    
    // Обновляем кнопки
    updateLangButtons();
    
    // Загружаем переводы
    loadTranslations();
    
    // Добавляем обработчики событий
    setupEventListeners();
    
    console.log(`Language switcher initialized with: ${currentLang}`);
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Обработчики для кнопок переключения языка
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = e.target.dataset.lang;
            if (lang && (lang === 'ru' || lang === 'en') && lang !== currentLang) {
                switchLanguage(lang);
            }
        });
    });
    
    // Событие для обновления динамического контента
    document.addEventListener('languageChanged', (e) => {
        console.log('Language changed event received:', e.detail.lang);
        // Можно добавить дополнительную логику здесь
    });
}

/**
 * Переключение языка
 * @param {string} lang - Язык для переключения ('ru' или 'en')
 */
function switchLanguage(lang) {
    if (lang !== 'ru' && lang !== 'en') {
        console.error('Invalid language code:', lang);
        return;
    }
    
    currentLang = lang;
    
    // Сохраняем предпочтение
    localStorage.setItem('preferredLang', currentLang);
    
    // Обновляем атрибут HTML
    document.documentElement.lang = currentLang;
    
    // Обновляем кнопки
    updateLangButtons();
    
    // Загружаем новые переводы
    loadTranslations();
    
    console.log(`Language switched to: ${currentLang}`);
}

/**
 * Обновление состояния кнопок языка
 */
function updateLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        const btnLang = btn.dataset.lang;
        
        if (btnLang === currentLang) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'true');
            btn.setAttribute('disabled', 'true');
        } else {
            btn.classList.remove('active');
            btn.removeAttribute('aria-current');
            btn.removeAttribute('disabled');
        }
    });
}

/**
 * Загрузка переводов из JSON файла
 */
async function loadTranslations() {
    try {
        console.log(`Loading translations for: ${currentLang}`);
        
        const response = await fetch(`locales/${currentLang}.json`, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        translations = await response.json();
        
        console.log('Translations loaded successfully');
        
        // Применяем переводы ко всем элементам
        applyTranslations();
        
        // Обновляем динамический контент
        updateDynamicContent();
        
        // Обновляем заголовок страницы
        updatePageTitle();
        
        // Отправляем событие о смене языка
        dispatchLanguageChangedEvent();
        
    } catch (error) {
        console.error('Failed to load translations:', error);
        
        // Пробуем использовать резервные переводы
        try {
            await loadFallbackTranslations();
        } catch (fallbackError) {
            console.error('Failed to load fallback translations:', fallbackError);
            applyHardcodedFallback();
        }
    }
}

/**
 * Применение переводов ко всем элементам
 */
function applyTranslations() {
    // Обновляем текстовые элементы
    document.querySelectorAll('[data-i18n]').forEach(element => {
        updateElementTranslation(element);
    });
    
    // Обновляем плейсхолдеры
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        updatePlaceholderTranslation(element);
    });
    
    // Обновляем атрибуты title
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        updateTitleTranslation(element);
    });
    
    // Обновляем атрибуты aria-label
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
        updateAriaLabelTranslation(element);
    });
}

/**
 * Обновление текстового элемента
 */
function updateElementTranslation(element) {
    const key = element.getAttribute('data-i18n');
    if (!key) return;
    
    const value = getNestedValue(translations, key);
    
    if (value !== undefined) {
        // Проверяем, является ли элемент input или textarea
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            if (element.type !== 'submit' && element.type !== 'button') {
                // Для полей ввода обновляем плейсхолдер
                element.placeholder = value;
            } else {
                // Для кнопок обновляем value
                element.value = value;
            }
        } else {
            // Для других элементов обновляем текст
            element.textContent = value;
        }
        
        console.debug(`Updated element: ${key} -> ${value}`);
    } else {
        console.warn(`Translation not found for key: ${key}`);
    }
}

/**
 * Обновление плейсхолдера элемента
 */
function updatePlaceholderTranslation(element) {
    const key = element.getAttribute('data-i18n-placeholder');
    if (!key) return;
    
    const value = getNestedValue(translations, key);
    
    if (value !== undefined) {
        element.placeholder = value;
        console.debug(`Updated placeholder: ${key} -> ${value}`);
    }
}

/**
 * Обновление атрибута title
 */
function updateTitleTranslation(element) {
    const key = element.getAttribute('data-i18n-title');
    if (!key) return;
    
    const value = getNestedValue(translations, key);
    
    if (value !== undefined) {
        element.title = value;
    }
}

/**
 * Обновление атрибута aria-label
 */
function updateAriaLabelTranslation(element) {
    const key = element.getAttribute('data-i18n-aria-label');
    if (!key) return;
    
    const value = getNestedValue(translations, key);
    
    if (value !== undefined) {
        element.setAttribute('aria-label', value);
    }
}

/**
 * Получение значения из вложенного объекта по пути
 */
function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * Обновление динамического контента
 */
function updateDynamicContent() {
    // Обновляем фильтры автопарка
    updateFleetFilters();
    
    // Обновляем элементы автопарка
    updateFleetElements();
    
    // Обновляем сообщения чата
    updateChatMessages();
}

/**
 * Обновление фильтров автопарка
 */
function updateFleetFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons.length === 0) return;
    
    filterButtons.forEach(btn => {
        const category = btn.getAttribute('data-category');
        if (category) {
            const translationKey = `fleet.filters.${category}`;
            const translation = getNestedValue(translations, translationKey);
            
            if (translation) {
                btn.textContent = translation;
            }
        }
    });
}

/**
 * Обновление элементов автопарка
 */
function updateFleetElements() {
    // Обновляем сообщение загрузки
    const loadingText = document.querySelector('.loading-cars p');
    if (loadingText && loadingText.getAttribute('data-i18n') === 'fleet.loading') {
        const loadingTranslation = getNestedValue(translations, 'fleet.loading');
        if (loadingTranslation) {
            loadingText.textContent = loadingTranslation;
        }
    }
}

/**
 * Обновление сообщений чата
 */
function updateChatMessages() {
    // Обновляем приветственное сообщение чата
    const welcomeMessage = document.querySelector('.chat-message.bot span');
    if (welcomeMessage && welcomeMessage.getAttribute('data-i18n') === 'chat.welcome') {
        const welcomeTranslation = getNestedValue(translations, 'chat.welcome');
        if (welcomeTranslation) {
            welcomeMessage.textContent = welcomeTranslation;
        }
    }
    
    // Обновляем плейсхолдер чата
    const chatInput = document.getElementById('chatInput');
    if (chatInput && chatInput.getAttribute('data-i18n-placeholder') === 'chat.placeholder') {
        const placeholderTranslation = getNestedValue(translations, 'chat.placeholder');
        if (placeholderTranslation) {
            chatInput.placeholder = placeholderTranslation;
        }
    }
}

/**
 * Обновление заголовка страницы
 */
function updatePageTitle() {
    const pageTitle = getNestedValue(translations, 'nav.home');
    if (pageTitle) {
        document.title = `LuxuryDrive | ${pageTitle}`;
    }
}

/**
 * Отправка события о смене языка
 */
function dispatchLanguageChangedEvent() {
    const event = new CustomEvent('languageChanged', {
        detail: {
            lang: currentLang,
            translations: translations
        },
        bubbles: true
    });
    
    document.dispatchEvent(event);
}

/**
 * Загрузка резервных переводов
 */
async function loadFallbackTranslations() {
    console.log('Loading fallback translations...');
    
    // Пробуем загрузить противоположный язык как резервный
    const fallbackLang = currentLang === 'ru' ? 'en' : 'ru';
    
    try {
        const response = await fetch(`locales/${fallbackLang}.json`);
        if (response.ok) {
            translations = await response.json();
            console.log(`Loaded fallback translations from: ${fallbackLang}`);
            applyTranslations();
            updateDynamicContent();
            updatePageTitle();
            return;
        }
    } catch (error) {
        console.warn('Could not load fallback translations:', error);
    }
    
    // Если не удалось загрузить, используем хардкодные переводы
    applyHardcodedFallback();
}

/**
 * Применение хардкодных резервных переводов
 */
function applyHardcodedFallback() {
    console.log('Applying hardcoded fallback translations...');
    
    const hardcodedTranslations = {
        'ru': {
            'nav': {
                'home': 'Главная',
                'fleet': 'Автопарк',
                'about': 'О нас',
                'contact': 'Контакты'
            },
            'hero': {
                'badge': 'Премиум Класс',
                'title': {
                    'part1': 'Премиальный',
                    'part2': 'каршеринг'
                },
                'subtitle': 'Эксклюзивные автомобили с водителем. Комфорт, безопасность и стиль в каждой поездке',
                'cta': {
                    'explore': 'Выбрать авто'
                },
                'stats': {
                    'rating': 'Рейтинг',
                    'support': 'Поддержка',
                    'cars': 'Автомобилей'
                },
                'scroll': 'Исследовать автопарк'
            },
            'fleet': {
                'title': 'Наш автопарк',
                'subtitle': 'Выберите автомобиль для вашего следующего путешествия',
                'filters': {
                    'all': 'Все',
                    'business': 'Бизнес-класс',
                    'premium': 'Премиум',
                    'suv': 'Внедорожники',
                    'sport': 'Спорткары'
                },
                'loading': 'Загружаем автомобили...'
            },
            'about': {
                'title': 'Почему LuxuryDrive?',
                'description': 'Мы предоставляем эксклюзивные автомобили премиум-класса с профессиональными водителями. Наш сервис — это идеальное сочетание роскоши, комфорта и надежности.',
                'stats': {
                    'experience': 'лет опыта',
                    'clients': 'довольных клиентов',
                    'cars': 'автомобилей',
                    'rating': 'средний рейтинг'
                }
            },
            'contact': {
                'title': 'Свяжитесь с нами',
                'subtitle': 'Готовы отправиться в путешествие? Мы поможем с выбором',
                'form': {
                    'title': 'Быстрая заявка',
                    'name': 'Ваше имя',
                    'phone': 'Телефон',
                    'message': 'Сообщение или вопросы',
                    'submit': 'Отправить заявку'
                },
                'info': {
                    'phone': 'Телефон',
                    'email': 'Email',
                    'hours': 'Часы работы',
                    'address': 'Адрес'
                }
            },
            'chat': {
                'title': 'Поддержка',
                'placeholder': 'Напишите сообщение...',
                'welcome': 'Здравствуйте! Чем могу помочь с выбором автомобиля?'
            }
        },
        'en': {
            'nav': {
                'home': 'Home',
                'fleet': 'Fleet',
                'about': 'About',
                'contact': 'Contact'
            },
            'hero': {
                'badge': 'Premium Class',
                'title': {
                    'part1': 'Premium',
                    'part2': 'Car Rental'
                },
                'subtitle': 'Exclusive cars with drivers. Comfort, safety and style in every trip',
                'cta': {
                    'explore': 'Choose Car'
                },
                'stats': {
                    'rating': 'Rating',
                    'support': 'Support',
                    'cars': 'Cars'
                },
                'scroll': 'Explore Fleet'
            },
            'fleet': {
                'title': 'Our Fleet',
                'subtitle': 'Choose a car for your next journey',
                'filters': {
                    'all': 'All',
                    'business': 'Business Class',
                    'premium': 'Premium',
                    'suv': 'SUVs',
                    'sport': 'Sports Cars'
                },
                'loading': 'Loading cars...'
            },
            'about': {
                'title': 'Why LuxuryDrive?',
                'description': 'We provide exclusive premium cars with professional drivers. Our service is the perfect combination of luxury, comfort and reliability.',
                'stats': {
                    'experience': 'years of experience',
                    'clients': 'satisfied clients',
                    'cars': 'cars in fleet',
                    'rating': 'average rating'
                }
            },
            'contact': {
                'title': 'Contact Us',
                'subtitle': 'Ready to travel? We will help you choose',
                'form': {
                    'title': 'Quick Application',
                    'name': 'Your Name',
                    'phone': 'Phone',
                    'message': 'Message or questions',
                    'submit': 'Submit Application'
                },
                'info': {
                    'phone': 'Phone',
                    'email': 'Email',
                    'hours': 'Working Hours',
                    'address': 'Address'
                }
            },
            'chat': {
                'title': 'Support',
                'placeholder': 'Type your message...',
                'welcome': 'Hello! How can I help you choose a car?'
            }
        }
    };
    
    translations = hardcodedTranslations[currentLang] || hardcodedTranslations['ru'];
    applyTranslations();
    updateDynamicContent();
    updatePageTitle();
}

/**
 * Получение текущего языка
 */
function getCurrentLanguage() {
    return currentLang;
}

/**
 * Получение текущих переводов
 */
function getTranslations() {
    return translations;
}

/**
 * Получение перевода по ключу
 */
function getTranslation(key) {
    return getNestedValue(translations, key);
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', initLangSwitcher);

// Экспорт функций для использования в других скриптах
window.langSwitcher = {
    init: initLangSwitcher,
    switchLanguage: switchLanguage,
    getCurrentLanguage: getCurrentLanguage,
    getTranslations: getTranslations,
    getTranslation: getTranslation,
    reloadTranslations: loadTranslations
};

// Автоматическая инициализация при загрузке
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangSwitcher);
} else {
    initLangSwitcher();
}

console.log('Language switcher module loaded');