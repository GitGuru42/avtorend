// js/api.js - Production ready API client для Render с Cloudinary поддержкой
class CarAPI {
    constructor() {
        // ✅ ОПТИМИЗИРОВАНО: Автоматическое определение URL для разных окружений
        this.baseUrl = this.detectApiUrl();
        console.log('🌐 API URL для окружения:', this.baseUrl);
        
        // ✅ CLOUDINARY: Конфигурация для обработки изображений
        this.cloudinaryConfig = {
            baseUrl: 'https://res.cloudinary.com',
            transformations: {
                thumbnail: 'w_400,h_300,c_fill,q_auto,f_webp',
                card: 'w_800,h_600,c_fill,q_auto,f_webp',
                gallery: 'w_1200,h_800,c_limit,q_auto,f_webp',
                original: ''
            }
        };
        
        // Кэширование с TTL (Time To Live)
        this.cache = {
            cars: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 }, // 5 минут
            categories: { data: null, timestamp: 0, ttl: 30 * 60 * 1000 }, // 30 минут
        };
        
        // Настройки по умолчанию
        this.defaultHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        
        // Конфигурация
        this.config = {
            retryAttempts: 3,
            retryDelay: 1000,
            timeout: 10000, // 10 секунд
            useCache: true,
        };
    }
    
    detectApiUrl() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        // 1. Локальная разработка
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        }
        
        // 2. Preview окружение на Render
        if (hostname.includes('.onrender.com')) {
            // Если frontend и backend на разных субдоменах
            const subdomain = hostname.split('.')[0];
            
            // Если frontend называется avtorend-frontend, то API на avtorend-api
            if (subdomain.includes('frontend') || subdomain.includes('client')) {
                const apiSubdomain = subdomain.replace('frontend', 'api').replace('client', 'api');
                return `${protocol}//${apiSubdomain}.onrender.com`;
            }
            
            // Иначе API на том же домене
            return `${protocol}//${hostname}`;
        }
        
        // 3. Продакшн (предполагаем что API на том же домене)
        // Если API на поддомене api.example.com
        if (!hostname.startsWith('api.')) {
            return `${protocol}//api.${hostname}`;
        }
        
        // 4. По умолчанию - текущий домен
        return window.location.origin;
    }
    
    // ============ CLOUDINARY МЕТОДЫ ============
    
    // ✅ НОВЫЙ: Проверка является ли URL Cloudinary
    isCloudinaryUrl(url) {
        return url && typeof url === 'string' && url.includes('res.cloudinary.com');
    }
    
    // ✅ НОВЫЙ: Оптимизация Cloudinary URL с параметрами
    optimizeCloudinaryUrl(url, size = 'card') {
        if (!this.isCloudinaryUrl(url)) {
            return url;
        }
        
        try {
            const transformations = this.cloudinaryConfig.transformations[size];
            if (!transformations) {
                return url;
            }
            
            // Разбираем URL
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            
            // Ищем индекс 'upload' в пути
            const uploadIndex = pathParts.indexOf('upload');
            if (uploadIndex === -1) {
                return url;
            }
            
            // Если уже есть параметры трансформации, заменяем их
            // Иначе добавляем новые
            const versionIndex = uploadIndex + 1;
            const isVersion = pathParts[versionIndex] && pathParts[versionIndex].startsWith('v');
            
            if (isVersion) {
                // URL уже имеет версию: /upload/v123456/...
                // Добавляем трансформацию перед версией
                pathParts.splice(versionIndex, 0, transformations);
            } else {
                // URL без версии: /upload/...
                // Добавляем трансформацию после upload
                pathParts.splice(uploadIndex + 1, 0, transformations);
            }
            
            urlObj.pathname = pathParts.join('/');
            return urlObj.toString();
            
        } catch (error) {
            console.warn('❌ Ошибка оптимизации Cloudinary URL:', error);
            return url;
        }
    }
    
    // ✅ НОВЫЙ: Получение Cloudinary URL с fallback
    getCloudinaryImageWithFallback(imageUrl, size = 'card') {
        if (!imageUrl) {
            return this.getDefaultCarImage();
        }
        
        // Если это Cloudinary URL, оптимизируем его
        if (this.isCloudinaryUrl(imageUrl)) {
            return this.optimizeCloudinaryUrl(imageUrl, size);
        }
        
        // Если это локальный путь
        if (imageUrl.startsWith('/static/')) {
            // Для продакшена на Render добавляем origin
            if (window.location.hostname.includes('onrender.com')) {
                return window.location.origin + imageUrl;
            }
            return imageUrl;
        }
        
        // Если только имя файла
        if (!imageUrl.includes('/') && imageUrl.includes('.')) {
            const fullUrl = `/static/uploads/cars/${imageUrl}`;
            if (window.location.hostname.includes('onrender.com')) {
                return window.location.origin + fullUrl;
            }
            return fullUrl;
        }
        
        // Любой другой случай
        return this.getDefaultCarImage();
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение изображения автомобиля
    getCarImageUrl(car, index = 0, size = 'card') {
        if (!car) {
            return this.getDefaultCarImage();
        }
        
        let imageUrl = null;
        
        // 1. Пытаемся получить изображение по индексу из массива images
        if (car.images && Array.isArray(car.images) && car.images.length > index) {
            imageUrl = car.images[index];
        }
        // 2. Или используем thumbnail
        else if (car.thumbnail) {
            imageUrl = car.thumbnail;
        }
        // 3. Или дефолтное изображение
        else {
            return this.getDefaultCarImage(size);
        }
        
        // Обрабатываем URL в зависимости от источника
        return this.getCloudinaryImageWithFallback(imageUrl, size);
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение всех изображений автомобиля
    getAllCarImages(car, size = 'gallery') {
        if (!car || !car.images || !Array.isArray(car.images) || car.images.length === 0) {
            return [this.getDefaultCarImage(size)];
        }
        
        return car.images.map(img => this.getCloudinaryImageWithFallback(img, size));
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение дефолтного изображения
    getDefaultCarImage(size = 'card') {
        // Cloudinary демо изображения (всегда доступны)
        const cloudinaryImages = {
            card: 'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/car.jpg',
            thumbnail: 'https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,q_auto,f_webp/v1588016089/samples/automotive.jpg',
            gallery: 'https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_limit,q_auto,f_webp/v1588016089/samples/road-trip.jpg'
        };
        
        // Локальные fallback (если нужны)
        const localImages = {
            card: '/static/uploads/cars/placeholder.jpg',
            thumbnail: '/static/uploads/cars/placeholder-thumb.jpg',
            gallery: '/static/uploads/cars/placeholder-large.jpg'
        };
        
        // Используем Cloudinary для надежности
        return cloudinaryImages[size] || cloudinaryImages.card;
    }
    
    // ============ ОСНОВНЫЕ МЕТОДЫ API ============
    
    async getCars(filters = {}, forceRefresh = false) {
        const cacheKey = JSON.stringify(filters);
        
        // Проверка кэша
        if (this.config.useCache && !forceRefresh && this.cache.cars.data) {
            const cache = this.cache.cars;
            const now = Date.now();
            
            if (cache.timestamp + cache.ttl > now) {
                console.log('📦 Используем кэшированные данные автомобилей');
                // ✅ ОБРАБАТЫВАЕМ Cloudinary URL в кэшированных данных
                return this.processCarsWithCloudinary(this.filterCars(cache.data, filters));
            }
        }
        
        try {
            const params = new URLSearchParams();
            
            // Добавляем фильтры в параметры запроса
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, value);
                }
            });
            
            // Добавляем timestamp для предотвращения кэширования браузером
            params.append('_t', Date.now());
            
            const url = `${this.baseUrl}/api/cars?${params.toString()}`;
            console.log('📡 Загрузка автомобилей:', url);
            
            const data = await this.makeRequest(url);
            
            // ✅ ЛОГИРУЕМ Cloudinary URL для отладки
            if (data.length > 0) {
                console.log('☁️ Первый автомобиль в ответе:');
                console.log('   Бренд:', data[0].brand);
                console.log('   Изображения:', data[0].images);
                console.log('   Первое изображение URL:', data[0].images?.[0]);
                console.log('   Это Cloudinary?', this.isCloudinaryUrl(data[0].images?.[0]));
                console.log('   Оптимизированный URL:', this.getCarImageUrl(data[0]));
            }
            
            // Кэшируем результат
            if (this.config.useCache) {
                this.cache.cars = {
                    data: data,
                    timestamp: Date.now(),
                    ttl: 5 * 60 * 1000 // 5 минут
                };
            }
            
            console.log(`✅ Получено ${data.length} автомобилей`);
            
            // ✅ ОБРАБАТЫВАЕМ Cloudinary URL перед возвратом
            return this.processCarsWithCloudinary(data);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки автомобилей:', error);
            
            // Если есть кэш, вернуть его даже если просрочен
            if (this.cache.cars.data) {
                console.log('⚠️ Используем просроченный кэш как fallback');
                // ✅ ОБРАБАТЫВАЕМ Cloudinary URL в кэше
                return this.processCarsWithCloudinary(this.filterCars(this.cache.cars.data, filters));
            }
            
            // Для продакшена - лучше пустой массив, чем ошибка
            this.showUserNotification('Не удалось загрузить автомобили. Пожалуйста, попробуйте позже.', 'error');
            return [];
        }
    }
    
    // ✅ НОВЫЙ: Обработка автомобилей с Cloudinary URL
    processCarsWithCloudinary(cars) {
        if (!Array.isArray(cars)) return cars;
        
        return cars.map(car => {
            // Создаем копию автомобиля для обработки
            const processedCar = { ...car };
            
            // Обрабатываем массив изображений
            if (processedCar.images && Array.isArray(processedCar.images)) {
                processedCar.images = processedCar.images.map(img => 
                    this.getCloudinaryImageWithFallback(img, 'card')
                );
            }
            
            // Обрабатываем thumbnail
            if (processedCar.thumbnail) {
                processedCar.thumbnail = this.getCloudinaryImageWithFallback(processedCar.thumbnail, 'thumbnail');
            }
            
            return processedCar;
        });
    }
    
    async getCategories(forceRefresh = false) {
        // Проверка кэша
        if (this.config.useCache && !forceRefresh && this.cache.categories.data) {
            const cache = this.cache.categories;
            const now = Date.now();
            
            if (cache.timestamp + cache.ttl > now) {
                console.log('📦 Используем кэшированные категории');
                return cache.data;
            }
        }
        
        try {
            const url = `${this.baseUrl}/api/categories?_t=${Date.now()}`;
            console.log('📡 Загрузка категорий:', url);
            
            const data = await this.makeRequest(url);
            
            // Кэшируем результат
            if (this.config.useCache) {
                this.cache.categories = {
                    data: data,
                    timestamp: Date.now(),
                    ttl: 30 * 60 * 1000 // 30 минут
                };
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            
            // Если есть кэш, вернуть его
            if (this.cache.categories.data) {
                return this.cache.categories.data;
            }
            
            // Дефолтные категории для fallback
            return this.getDefaultCategories();
        }
    }
    
    async getCarById(id) {
        if (!id || isNaN(id)) {
            throw new Error('Неверный ID автомобиля');
        }
        
        try {
            const url = `${this.baseUrl}/api/cars/${id}?_t=${Date.now()}`;
            console.log('📡 Загрузка автомобиля ID:', id);
            
            const car = await this.makeRequest(url);
            
            if (!car) {
                throw new Error('Автомобиль не найден');
            }
            
            // ✅ ОБРАБАТЫВАЕМ Cloudinary URL
            return this.processCarsWithCloudinary([car])[0];
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки автомобиля ID ${id}:`, error);
            this.showUserNotification('Автомобиль не найден', 'error');
            return null;
        }
    }
    
    async createBooking(bookingData) {
        try {
            const url = `${this.baseUrl}/api/bookings`;
            console.log('📡 Создание бронирования:', bookingData);
            
            const response = await this.makeRequest(url, {
                method: 'POST',
                headers: this.defaultHeaders,
                body: JSON.stringify(bookingData)
            });
            
            this.showUserNotification('Бронирование успешно создано!', 'success');
            return response;
            
        } catch (error) {
            console.error('❌ Ошибка создания бронирования:', error);
            this.showUserNotification('Ошибка при создании бронирования', 'error');
            throw error;
        }
    }
    
    // ============ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ============
    
    async makeRequest(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
        
        const requestOptions = {
            signal: controller.signal,
            headers: this.defaultHeaders,
            ...options
        };
        
        let lastError;
        
        // Retry логика
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, requestOptions);
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                const data = await response.json();
                return data;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < this.config.retryAttempts) {
                    console.log(`🔄 Повторная попытка ${attempt}/${this.config.retryAttempts}`);
                    await this.delay(this.config.retryDelay * attempt);
                }
            }
        }
        
        clearTimeout(timeoutId);
        throw lastError;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    filterCars(cars, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return cars;
        }
        
        return cars.filter(car => {
            // Фильтрация по категории
            if (filters.category_id && car.category_id != filters.category_id) {
                return false;
            }
            
            // Фильтрация по цене
            if (filters.min_price && car.daily_price < filters.min_price) {
                return false;
            }
            
            if (filters.max_price && car.daily_price > filters.max_price) {
                return false;
            }
            
            // Фильтрация по статусу
            if (filters.status && car.status !== filters.status) {
                return false;
            }
            
            // Фильтрация по бренду
            if (filters.brand && !car.brand.toLowerCase().includes(filters.brand.toLowerCase())) {
                return false;
            }
            
            return true;
        });
    }
    
    // ============ УТИЛИТЫ ============
    
    getDefaultCategories() {
        return [
            { id: 1, name: "Эконом", slug: "economy", description: "Бюджетные автомобили", icon: "💰" },
            { id: 2, name: "Комфорт", slug: "comfort", description: "Автомобили среднего класса", icon: "🚗" },
            { id: 3, name: "Бизнес", slug: "business", description: "Автомобили для деловых поездок", icon: "💼" },
            { id: 4, name: "Премиум", slug: "premium", description: "Люкс автомобили", icon: "⭐" },
            { id: 5, name: "Внедорожник", slug: "suv", description: "Внедорожники и кроссоверы", icon: "🚙" },
            { id: 6, name: "Минивэн", slug: "minivan", description: "Для больших семей", icon: "🚐" },
            { id: 7, name: "Спорт", slug: "sport", description: "Спортивные автомобили", icon: "🏎️" },
            { id: 8, name: "Электрокар", slug: "electric", description: "Электрические автомобили", icon: "⚡" }
        ];
    }
    
    showUserNotification(message, type = 'info') {
        // Создаем уведомление для пользователя
        const notification = document.createElement('div');
        notification.className = `api-notification api-notification-${type}`;
        notification.innerHTML = `
            <div class="api-notification-content">
                <span class="api-notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="api-notification-text">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            notification.classList.add('api-notification-hide');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Добавляем стили если их нет
        if (!document.querySelector('#api-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'api-notification-styles';
            styles.textContent = `
                .api-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-family: system-ui, -apple-system, sans-serif;
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 400px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transform: translateX(0);
                    transition: transform 0.3s ease;
                }
                .api-notification-hide {
                    transform: translateX(100%);
                }
                .api-notification-success {
                    background: #10b981;
                    border-left: 4px solid #059669;
                }
                .api-notification-error {
                    background: #ef4444;
                    border-left: 4px solid #dc2626;
                }
                .api-notification-info {
                    background: #3b82f6;
                    border-left: 4px solid #2563eb;
                }
                .api-notification-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .api-notification-icon {
                    font-size: 20px;
                }
            `;
            document.head.appendChild(styles);
        }
    }
    
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    // Очистка кэша
    clearCache(cacheType = null) {
        if (!cacheType) {
            this.cache = {
                cars: { data: null, timestamp: 0, ttl: 5 * 60 * 1000 },
                categories: { data: null, timestamp: 0, ttl: 30 * 60 * 1000 },
            };
        } else if (this.cache[cacheType]) {
            this.cache[cacheType] = { data: null, timestamp: 0, ttl: 0 };
        }
        
        console.log('🗑️ Кэш очищен');
    }
    
    // Проверка подключения к API
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, { 
                method: 'GET',
                headers: this.defaultHeaders
            });
            
            const data = await response.json();
            return {
                status: response.ok,
                data: data
            };
        } catch (error) {
            return {
                status: false,
                error: error.message
            };
        }
    }
}

// Создаем глобальный экземпляр API
window.carAPI = new CarAPI();

// Экспорт для модульных систем
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CarAPI;
}

// Добавляем обработчик ошибок на window
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Показываем пользователю уведомление
    if (window.carAPI) {
        window.carAPI.showUserNotification('Произошла ошибка в приложении', 'error');
    }
});

// ✅ НОВОЕ: Глобальные хелперы для Cloudinary
window.cloudinaryHelpers = {
    // Проверка Cloudinary URL
    isCloudinaryUrl: (url) => {
        return url && typeof url === 'string' && url.includes('res.cloudinary.com');
    },
    
    // Получение оптимизированного URL
    getOptimizedImageUrl: (url, width = 800, height = 600) => {
        if (!window.carAPI) return url;
        return window.carAPI.getCloudinaryImageWithFallback(url, 'card');
    },
    
    // Fallback для ошибок изображений
    handleImageError: (imgElement) => {
        if (imgElement) {
            console.warn('❌ Ошибка загрузки изображения:', imgElement.src);
            imgElement.onerror = null;
            imgElement.src = window.carAPI ? window.carAPI.getDefaultCarImage() : '/static/uploads/cars/placeholder.jpg';
        }
    }
};
