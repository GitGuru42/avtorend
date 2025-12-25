// js/api.js - Production ready API client для Render с Cloudinary поддержкой
class CarAPI {
    constructor() {
        // ✅ ОПТИМИЗИРОВАНО: Автоматическое определение URL для разных окружений
        this.baseUrl = this.detectApiUrl();
        console.log('🌐 API URL для окружения:', this.baseUrl);
        
        // ✅ CLOUDINARY: Конфигурация для обработки изображений
        this.cloudinaryConfig = {
            baseUrl: 'https://res.cloudinary.com',
            // ✅ ВАЖНО: ЗАМЕНИТЕ 'YOUR_CLOUD_NAME' НА ВАШ РЕАЛЬНЫЙ CLOUD NAME!
            cloudName: 'daxfsz15l', // ← ЗАМЕНИТЕ ЭТО НА ВАШ CLOUD NAME!
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
        
        // Проверка Cloudinary конфигурации
        this.checkCloudinaryConfig();
    }
    
    checkCloudinaryConfig() {
        const cloudName = this.cloudinaryConfig.cloudName;
        if (!cloudName || cloudName === 'ваш_cloud_name_здесь') {
            console.warn('⚠️ ВНИМАНИЕ: Cloudinary cloud_name не настроен!');
            console.warn('   Замените "ваш_cloud_name_здесь" на ваш реальный Cloud Name из Cloudinary Console');
            console.warn('   Зайдите на https://cloudinary.com/console и найдите "Cloud Name"');
        } else {
            console.log(`✅ Cloudinary настроен с cloud_name: ${cloudName}`);
        }
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
    
    // ✅ НОВЫЙ: Проверка является ли URL вашего Cloudinary
    isOurCloudinaryUrl(url) {
        const cloudName = this.cloudinaryConfig.cloudName;
        return url && typeof url === 'string' && 
               url.includes('res.cloudinary.com') && 
               url.includes(`/${cloudName}/`);
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
                // Проверяем, есть ли уже трансформации
                if (!pathParts[versionIndex - 1].includes('w_')) {
                    // Добавляем трансформацию перед версией
                    pathParts.splice(versionIndex, 0, transformations);
                }
            } else {
                // URL без версии: /upload/...
                // Проверяем, есть ли уже трансформации
                if (!pathParts[uploadIndex + 1].includes('w_')) {
                    // Добавляем трансформацию после upload
                    pathParts.splice(uploadIndex + 1, 0, transformations);
                }
            }
            
            urlObj.pathname = pathParts.join('/');
            return urlObj.toString();
            
        } catch (error) {
            console.warn('❌ Ошибка оптимизации Cloudinary URL:', error);
            return url;
        }
    }
    
    // ✅ ПЕРЕРАБОТАННЫЙ: Получение Cloudinary URL с поддержкой структуры папок /avtorend/
    getCloudinaryImageWithFallback(imageUrl, size = 'card', car = null) {
        if (!imageUrl) {
            return this.getDefaultCarImage();
        }
        
        console.log('📁 Обрабатываем изображение:', imageUrl.substring(0, 100));
        
        // ✅ ВАЖНО: Ваш Cloudinary cloud_name
        const cloudName = this.cloudinaryConfig.cloudName;
        
        // ✅ 1. Если это уже Cloudinary URL (ваш или demo)
        if (this.isCloudinaryUrl(imageUrl)) {
            console.log('☁️ Обнаружен Cloudinary URL');
            
            // Проверяем, это demo или ваш аккаунт?
            if (imageUrl.includes('/demo/')) {
                console.warn('⚠️ Обнаружен DEMO URL Cloudinary');
                // Заменяем demo на ваш cloud_name
                imageUrl = imageUrl.replace('/demo/', `/${cloudName}/`);
            }
            
            // Проверяем, содержит ли URL ваш cloud_name
            if (!imageUrl.includes(`/${cloudName}/`)) {
                console.warn(`⚠️ Cloudinary URL не содержит ваш cloud_name "${cloudName}"`);
                console.warn(`   URL содержит: ${imageUrl.split('/')[3]}`);
                
                // Пытаемся исправить URL
                const urlParts = imageUrl.split('/');
                const cloudIndex = urlParts.indexOf('cloudinary.com') + 1;
                if (cloudIndex > 0 && urlParts[cloudIndex]) {
                    urlParts[cloudIndex] = cloudName;
                    imageUrl = urlParts.join('/');
                    console.log('✅ Исправленный URL:', imageUrl);
                }
            }
            
            return this.optimizeCloudinaryUrl(imageUrl, size);
        }
        
        // ✅ 2. Если это путь в папке /avtorend/ (ваша структура)
        // Пример: "avtorend/mercedes-s-class-1/main.jpg"
        // Или: "/avtorend/bmw-x5-2/interior.jpg"
        if (imageUrl.includes('avtorend/')) {
            console.log('📂 Обнаружен путь в папке avtorend:', imageUrl);
            
            // Убираем ведущий слэш если есть
            let publicId = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
            
            // Удаляем расширение файла для Cloudinary
            publicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
            
            // Формируем Cloudinary URL
            const transformation = this.cloudinaryConfig.transformations[size] || '';
            const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
            
            const result = transformation ? 
                `${baseUrl}/${transformation}/${publicId}` :
                `${baseUrl}/${publicId}`;
            
            console.log('✅ Сформирован Cloudinary URL:', result.substring(0, 100));
            return result;
        }
        
        // ✅ 3. Если это только имя файла (например: "main.jpg")
        // Используем данные автомобиля для построения пути
        if (!imageUrl.includes('/') && imageUrl.includes('.') && car) {
            console.log('📄 Обнаружено только имя файла, используем данные авто');
            
            // Генерируем имя папки на основе бренда, модели и ID
            const folderName = this.generateCarFolderName(car);
            const fileName = imageUrl.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
            
            // Формируем public_id для Cloudinary: avtorend/{folder}/{file}
            const publicId = `avtorend/${folderName}/${fileName}`;
            
            // Формируем Cloudinary URL
            const transformation = this.cloudinaryConfig.transformations[size] || '';
            const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
            
            const result = transformation ? 
                `${baseUrl}/${transformation}/${publicId}` :
                `${baseUrl}/${publicId}`;
            
            console.log('✅ Сгенерирован URL на основе данных авто:', result.substring(0, 100));
            return result;
        }
        
        // ✅ 4. Если это локальный путь
        if (imageUrl.startsWith('/static/') || imageUrl.startsWith('/uploads/')) {
            console.log('🌐 Обнаружен локальный путь');
            // Для продакшена на Render добавляем origin
            if (window.location.hostname.includes('onrender.com')) {
                return window.location.origin + imageUrl;
            }
            return imageUrl;
        }
        
        // ✅ 5. Любой другой случай - возвращаем placeholder
        console.log('⚠️ Неизвестный формат, используем placeholder');
        return this.getDefaultCarImage(size);
    }
    
    // ✅ НОВЫЙ: Генерация имени папки для автомобиля
    generateCarFolderName(car) {
        if (!car) return 'unknown';
        
        // Создаем имя папки: brand-model-id
        // Пример: mercedes-s-class-1, bmw-x5-2
        const brandSlug = car.brand ? 
            car.brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 
            'unknown';
        const modelSlug = car.model ? 
            car.model.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 
            'unknown';
        const carId = car.id || '0';
        
        return `${brandSlug}-${modelSlug}-${carId}`;
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение изображения автомобиля с поддержкой структуры папок
    getCarImageUrl(car, index = 0, size = 'card') {
        if (!car) {
            return this.getDefaultCarImage();
        }
        
        console.log(`🚗 Получаем фото для: ${car.brand} ${car.model} (ID: ${car.id}, индекс: ${index})`);
        
        let imageUrl = null;
        
        // 1. Пытаемся получить изображение по индексу из массива images
        if (car.images && Array.isArray(car.images) && car.images.length > index) {
            imageUrl = car.images[index];
            console.log('📸 Используем изображение из массива:', imageUrl);
        }
        // 2. Или используем thumbnail
        else if (car.thumbnail) {
            imageUrl = car.thumbnail;
            console.log('📸 Используем thumbnail:', imageUrl);
        }
        // 3. Формируем путь на основе данных автомобиля
        else {
            console.log('📸 Изображение не найдено, формируем путь на основе данных авто');
            
            // Генерируем имя папки
            const folderName = this.generateCarFolderName(car);
            const fileName = 'main'; // Главное фото по умолчанию
            
            // Формируем public_id для Cloudinary: avtorend/{folder}/{file}
            imageUrl = `avtorend/${folderName}/${fileName}`;
            console.log('📁 Сгенерированный путь:', imageUrl);
        }
        
        // Обрабатываем URL в зависимости от источника
        return this.getCloudinaryImageWithFallback(imageUrl, size, car);
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение всех изображений автомобиля
    getAllCarImages(car, size = 'gallery') {
        if (!car || !car.images || !Array.isArray(car.images) || car.images.length === 0) {
            return [this.getDefaultCarImage(size)];
        }
        
        return car.images.map((img, index) => 
            this.getCloudinaryImageWithFallback(img, size, car)
        );
    }
    
    // ✅ ОБНОВЛЕННЫЙ: Получение дефолтного изображения с вашей структурой
    getDefaultCarImage(size = 'card') {
        const cloudName = this.cloudinaryConfig.cloudName;
        
        // Если cloud_name не указан, используем статичные placeholder
        if (!cloudName || cloudName === 'ваш_cloud_name_здесь') {
            console.warn('⚠️ Cloudinary cloud_name не настроен! Используем статичные placeholder');
            const staticPlaceholders = {
                card: '/static/uploads/cars/placeholder.jpg',
                thumbnail: '/static/uploads/cars/placeholder-thumb.jpg',
                gallery: '/static/uploads/cars/placeholder-large.jpg'
            };
            
            // Для продакшена на Render добавляем origin
            if (window.location.hostname.includes('onrender.com')) {
                return Object.fromEntries(
                    Object.entries(staticPlaceholders).map(([key, value]) => 
                        [key, window.location.origin + value]
                    )
                )[size] || window.location.origin + staticPlaceholders.card;
            }
            
            return staticPlaceholders[size] || staticPlaceholders.card;
        }
        
        // ✅ Cloudinary изображения с ВАШИМ cloud_name и структурой папок
        // Предполагаем, что у вас есть placeholder в папке /avtorend/placeholder/
        const cloudinaryImages = {
            card: `https://res.cloudinary.com/${cloudName}/image/upload/w_800,h_600,c_fill,q_auto,f_webp/avtorend/placeholder/car`,
            thumbnail: `https://res.cloudinary.com/${cloudName}/image/upload/w_400,h_300,c_fill,q_auto,f_webp/avtorend/placeholder/car`,
            gallery: `https://res.cloudinary.com/${cloudName}/image/upload/w_1200,h_800,c_limit,q_auto,f_webp/avtorend/placeholder/car`
        };
        
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
                const firstCar = data[0];
                console.log('☁️ Первый автомобиль в ответе:');
                console.log('   ID:', firstCar.id);
                console.log('   Бренд:', firstCar.brand);
                console.log('   Модель:', firstCar.model);
                console.log('   Изображения:', firstCar.images);
                
                if (firstCar.images && firstCar.images.length > 0) {
                    const firstImage = firstCar.images[0];
                    console.log('   Первое изображение URL:', firstImage);
                    console.log('   Это Cloudinary?', this.isCloudinaryUrl(firstImage));
                    console.log('   Это наш Cloudinary?', this.isOurCloudinaryUrl(firstImage));
                    
                    // Показываем обработанный URL
                    const processedUrl = this.getCarImageUrl(firstCar);
                    console.log('   Обработанный URL:', processedUrl);
                    console.log('   Содержит наш cloud_name?', processedUrl.includes(this.cloudinaryConfig.cloudName));
                }
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
                processedCar.images = processedCar.images.map((img, index) => 
                    this.getCloudinaryImageWithFallback(img, 'card', car)
                );
            }
            
            // Обрабатываем thumbnail
            if (processedCar.thumbnail) {
                processedCar.thumbnail = this.getCloudinaryImageWithFallback(processedCar.thumbnail, 'thumbnail', car);
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
    getOptimizedImageUrl: (url, car = null) => {
        if (!window.carAPI) return url;
        return window.carAPI.getCloudinaryImageWithFallback(url, 'card', car);
    },
    
    // Fallback для ошибок изображений
    handleImageError: (imgElement, car = null) => {
        if (imgElement) {
            console.warn('❌ Ошибка загрузки изображения:', imgElement.src);
            imgElement.onerror = null;
            imgElement.src = window.carAPI ? 
                window.carAPI.getDefaultCarImage('card') : 
                '/static/uploads/cars/placeholder.jpg';
        }
    }
};

// ✅ НОВОЕ: Отладка Cloudinary
window.debugCloudinary = function() {
    console.log('🔍 Cloudinary Debug Info:');
    console.log('   Cloud Name:', window.carAPI.cloudinaryConfig.cloudName);
    console.log('   API URL:', window.carAPI.baseUrl);
    
    // Проверяем API
    fetch('/api/cars')
        .then(r => r.json())
        .then(cars => {
            if (cars.length > 0) {
                const car = cars[0];
                console.log('   Первая машина:', {
                    id: car.id,
                    brand: car.brand,
                    model: car.model,
                    images: car.images,
                    thumbnail: car.thumbnail
                });
                
                if (car.images && car.images.length > 0) {
                    const originalUrl = car.images[0];
                    const processedUrl = window.carAPI.getCarImageUrl(car);
                    console.log('   Оригинальный URL:', originalUrl);
                    console.log('   Обработанный URL:', processedUrl);
                    console.log('   Разница:', originalUrl !== processedUrl ? 'ДА' : 'НЕТ');
                }
            }
        })
        .catch(err => console.log('   API не доступен:', err));
};
