// js/fleet-manager.js - Управление отображением автопарка (Cloudinary версия)
class FleetManager {
    constructor() {
        this.carsGrid = document.getElementById('carsGrid');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.currentFilter = 'all';
        this.cars = [];
        this.categories = [];
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        console.log('🚗 Инициализация FleetManager (Cloudinary)...');
        
        // Запускаем загрузку сразу
        this.startLoading();
    }

    async startLoading() {
        try {
            this.showLoading();
            
            // Загружаем категории
            await this.loadCategories();
            
            // Загружаем автомобили
            await this.loadCars();
            
            // Настраиваем фильтры
            this.setupFilters();
            
            // Настраиваем события
            this.setupEvents();
            
            console.log('✅ FleetManager инициализирован (Cloudinary)');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FleetManager:', error);
            this.showError('Не удалось загрузить автопарк. Попробуйте обновить страницу.');
        }
    }

    async loadCategories() {
        try {
            // Пробуем загрузить из API
            if (window.carAPI) {
                this.categories = await window.carAPI.getCategories();
                console.log('📊 Загружены категории из API:', this.categories.length);
            } else {
                // Используем тестовые категории
                this.categories = this.getMockCategories();
                console.log('📊 Используем тестовые категории');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            this.categories = this.getMockCategories();
        }
    }

    async loadCars(filters = {}) {
        this.isLoading = true;
        
        try {
            // Показываем скелетоны загрузки
            this.showSkeleton();
            
            // Используем API если доступен
            if (window.carAPI) {
                const apiFilters = {};
                
                // Конвертируем фильтры
                if (filters.category && filters.category !== 'all') {
                    const category = this.categories.find(c => c.slug === filters.category);
                    if (category) {
                        apiFilters.category_id = category.id;
                    }
                }
                
                this.cars = await window.carAPI.getCars(apiFilters);
                console.log('🚗 Загружены автомобили из API:', this.cars.length);
                
                // ✅ ВАЖНО: Проверяем данные для Cloudinary
                if (this.cars.length > 0) {
                    console.log('☁️ Cloudinary данные автомобиля:');
                    console.log('   Изображения:', this.cars[0].images);
                    console.log('   Thumbnail:', this.cars[0].thumbnail);
                    console.log('   Обработанный URL:', this.getCorrectImageUrl(this.cars[0].images?.[0]));
                    
                    // Логируем все типы URL для отладки
                    this.cars.forEach(car => {
                        if (car.images && car.images.length > 0) {
                            const firstImage = car.images[0];
                            console.log(`   ${car.brand} ${car.model}: ${firstImage} -> ${this.getCorrectImageUrl(firstImage)}`);
                        }
                    });
                }
                
            } else {
                // Используем демо данные с Cloudinary фото
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.cars = this.getCloudinaryDemoCars();
                console.log('🚗 Используем Cloudinary демо данные:', this.cars.length);
            }
            
            // Отрисовываем автомобили
            this.renderCars();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки автомобилей:', error);
            this.showNotification('warning', 'Не удалось загрузить актуальные данные.');
            
            // Показываем сообщение об ошибке
            this.showError('Ошибка загрузки автомобилей. Проверьте подключение к серверу.');
            
        } finally {
            this.isLoading = false;
        }
    }

    // ✅ Cloudinary версия: Получение фото автомобиля
    getCarImage(car) {
        if (!car) return this.getRandomCarImage();
        
        // 1. Используем хелпер из carAPI если он есть
        if (window.carAPI && typeof window.carAPI.getCarImageUrl === 'function') {
            return window.carAPI.getCarImageUrl(car);
        }
        
        // 2. Берем первое фото из массива images
        if (car.images && car.images.length > 0) {
            const firstImage = car.images[0];
            return this.getCorrectImageUrl(firstImage);
        }
        
        // 3. Проверяем thumbnail
        if (car.thumbnail) {
            return this.getCorrectImageUrl(car.thumbnail);
        }
        
        // 4. Если фото нет - используем заглушку
        return this.getRandomCarImage();
    }
    
    // ✅ ОСНОВНОЙ МЕТОД: Получение правильного URL для фото (Cloudinary оптимизированный)
    getCorrectImageUrl(imagePath) {
        // === DEBUG ===
        console.log('=== DEBUG getCorrectImageUrl ===');
        console.log('Input:', imagePath);
        console.log('Type:', typeof imagePath);
        
        if (!imagePath || typeof imagePath !== 'string') {
            console.log('⚠️ Пустой или неверный imagePath, возвращаем placeholder');
            return this.getDefaultCarImage();
        }
        
        // ✅ 1. Cloudinary URL (новые загруженные фото)
        if (imagePath.includes('res.cloudinary.com')) {
            console.log('☁️ Обнаружен Cloudinary URL');
            
            // Проверяем, есть ли уже параметры оптимизации
            if (imagePath.includes('/w_') || imagePath.includes('/c_')) {
                console.log('✅ Cloudinary URL уже оптимизирован');
                return imagePath;
            }
            
            try {
                // Добавляем параметры оптимизации для Cloudinary
                // Формат: https://res.cloudinary.com/CLOUD_NAME/image/upload/TRANSFORMATIONS/PUBLIC_ID.EXT
                let optimizedUrl = imagePath;
                
                // Ищем позицию "/upload/"
                const uploadIndex = imagePath.indexOf('/upload/');
                if (uploadIndex !== -1) {
                    // Вставляем параметры трансформации после "/upload/"
                    const before = imagePath.substring(0, uploadIndex + 8); // +8 для "/upload/"
                    const after = imagePath.substring(uploadIndex + 8);
                    
                    // Параметры оптимизации для веба:
                    // w_800 - ширина 800px
                    // h_600 - высота 600px
                    // c_fill - заполнение области
                    // q_auto - автоматическое качество
                    // f_webp - формат WebP (если браузер поддерживает)
                    optimizedUrl = `${before}w_800,h_600,c_fill,q_auto,f_webp/${after}`;
                    
                    console.log('✅ Cloudinary URL оптимизирован:', optimizedUrl);
                }
                
                return optimizedUrl;
                
            } catch (e) {
                console.error('❌ Ошибка обработки Cloudinary URL:', e);
                return imagePath; // Возвращаем оригинальный URL
            }
        }
        
        // ✅ 2. Уже полный URL (но не Cloudinary)
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            console.log('🌐 Обнаружен обычный HTTP URL');
            return imagePath;
        }
        
        // ✅ 3. Локальные пути на сервере (старые данные)
        if (imagePath.startsWith('/static/uploads/cars/')) {
            console.log('📁 Обнаружен локальный путь:', imagePath);
            return imagePath;
        }
        
        if (imagePath.startsWith('/static/photos_cars/')) {
            console.log('📁 Обнаружен старый локальный путь photos_cars');
            return imagePath;
        }
        
        // ✅ 4. Если только имя файла (старый формат)
        if (!imagePath.includes('/') && 
            (imagePath.includes('.jpg') || imagePath.includes('.jpeg') || 
             imagePath.includes('.png') || imagePath.includes('.webp'))) {
            console.log('📄 Обнаружено только имя файла, добавляем путь');
            return `/static/uploads/cars/${imagePath}`;
        }
        
        // ✅ 5. Если относительный путь (старый формат)
        if (imagePath.includes('uploads/cars/') || imagePath.includes('photos_cars/')) {
            console.log('🔄 Обнаружен относительный путь, конвертируем');
            const filename = imagePath.split('/').pop();
            return `/static/uploads/cars/${filename}`;
        }
        
        // ✅ 6. Любой другой случай
        console.log('❓ Неизвестный формат, пытаемся извлечь имя файла');
        const filename = imagePath.split('/').pop();
        if (filename && (filename.includes('.jpg') || filename.includes('.png') || filename.includes('.webp'))) {
            return `/static/uploads/cars/${filename}`;
        }
        
        // ✅ 7. Fallback на placeholder
        console.log('⚠️ Не удалось определить тип пути, возвращаем placeholder');
        return this.getDefaultCarImage();
    }
    
    // ✅ Cloudinary placeholder
    getDefaultCarImage() {
        // Cloudinary демо изображения (всегда доступны)
        const cloudinaryPlaceholders = [
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/car.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/automotive.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/road-trip.jpg'
        ];
        
        const localPlaceholders = [
            '/static/uploads/cars/placeholder.jpg',
            '/static/photos_cars/default-car.jpg',
            '/images/default-car.jpg'
        ];
        
        // Пробуем сначала Cloudinary (всегда работает)
        return cloudinaryPlaceholders[0];
    }

    showSkeleton() {
        if (!this.carsGrid) return;
        
        const skeletonHTML = `
            <div class="car-card skeleton">
                <div class="car-image-container skeleton-image"></div>
                <div class="car-info">
                    <div class="skeleton-line" style="width: 70%; height: 24px; margin-bottom: 12px;"></div>
                    <div class="skeleton-line" style="width: 50%; height: 20px; margin-bottom: 16px;"></div>
                    <div class="car-specs">
                        <div class="car-spec">
                            <div class="skeleton-circle" style="width: 20px; height: 20px;"></div>
                            <div class="skeleton-line" style="width: 60px; height: 16px;"></div>
                        </div>
                        <div class="car-spec">
                            <div class="skeleton-circle" style="width: 20px; height: 20px;"></div>
                            <div class="skeleton-line" style="width: 60px; height: 16px;"></div>
                        </div>
                        <div class="car-spec">
                            <div class="skeleton-circle" style="width: 20px; height: 20px;"></div>
                            <div class="skeleton-line" style="width: 60px; height: 16px;"></div>
                        </div>
                        <div class="car-spec">
                            <div class="skeleton-circle" style="width: 20px; height: 20px;"></div>
                            <div class="skeleton-line" style="width: 60px; height: 16px;"></div>
                        </div>
                    </div>
                    <div class="car-actions">
                        <div class="skeleton-line" style="width: 100%; height: 44px; border-radius: 8px;"></div>
                    </div>
                </div>
            </div>
        `.repeat(6);
        
        this.carsGrid.innerHTML = skeletonHTML;
    }

    renderCars() {
        if (!this.carsGrid) return;
        
        if (this.isLoading) {
            this.showSkeleton();
            return;
        }
        
        if (this.cars.length === 0) {
            this.carsGrid.innerHTML = this.createNoCarsMessage();
            return;
        }

        // Создаем HTML для каждого автомобиля
        const carsHTML = this.cars.map(car => this.createCarCard(car)).join('');
        
        this.carsGrid.innerHTML = carsHTML;
        
        // Инициализируем AOS для новых элементов
        if (window.AOS) {
            setTimeout(() => AOS.refresh(), 100);
        }
        
        // Анимация появления
        setTimeout(() => {
            const cards = this.carsGrid.querySelectorAll('.car-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('loaded');
                }, index * 100);
            });
        }, 100);
    }

    createCarCard(car) {
        // Находим категорию
        const category = car.category || this.categories.find(c => c.id === car.category_id);
        const categoryName = category?.name || 'Не указано';
        const categorySlug = category?.slug || 'other';
        
        // Форматируем данные
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(car.daily_price || 0);
        const formattedMileage = car.mileage ? `${car.mileage.toLocaleString('ru-RU')} км` : 'Новый';
        
        // ✅ Cloudinary оптимизированное фото
        const carImage = this.getCarImage(car);
        console.log(`🖼 Создаем карточку ${car.brand} ${car.model}:`, carImage);
        
        // ✅ Cloudinary fallback изображение
        const fallbackImage = this.getRandomCarImage();
        
        return `
            <div class="car-card" data-aos="fade-up" data-car-id="${car.id}" data-category="${categorySlug}">
                <!-- Картинка с эффектами -->
                <div class="car-image-container">
                    <div class="image-gradient"></div>
                    <img src="${carImage}" 
                         alt="${car.brand} ${car.model}" 
                         class="car-image"
                         loading="lazy"
                         onerror="console.error('❌ Ошибка загрузки изображения:', this.src); this.onerror=null; this.src='${fallbackImage}';">
                    
                    <!-- Бейджи -->
                    <div class="car-badges">
                        <span class="car-category-badge ${categorySlug}">
                            <span class="badge-icon">${this.getCategoryIcon(categorySlug)}</span>
                            ${categoryName}
                        </span>
                        <span class="car-status-badge ${car.status || 'available'}">
                            ${this.getStatusText(car.status)}
                        </span>
                    </div>
                </div>
                
                <!-- Информация об автомобиле -->
                <div class="car-info">
                    <!-- Заголовок и цена -->
                    <div class="car-header">
                        <h3 class="car-title">
                            ${car.brand} ${car.model} 
                            <span class="car-year">${car.year}</span>
                        </h3>
                        <div class="car-price">
                            <span class="price-amount">${formattedPrice} ₽</span>
                            <span class="price-period">/ сутки</span>
                        </div>
                    </div>
                    
                    <!-- Описание -->
                    <p class="car-description">
                        ${car.description || `${car.brand} ${car.model} ${car.year} года. Отличное состояние.`}
                    </p>
                    
                    <!-- Характеристики -->
                    <div class="car-specs">
                        <div class="car-spec" title="${car.seats || 4} мест">
                            <span class="spec-icon">👥</span>
                            <span class="spec-value">${car.seats || 4} мест</span>
                        </div>
                        <div class="car-spec" title="${this.getTransmissionText(car.transmission)}">
                            <span class="spec-icon">⚙️</span>
                            <span class="spec-value">${this.getTransmissionText(car.transmission)}</span>
                        </div>
                        <div class="car-spec" title="${car.fuel_type || 'Бензин'}">
                            <span class="spec-icon">⛽</span>
                            <span class="spec-value">${car.fuel_type || 'Бензин'}</span>
                        </div>
                        <div class="car-spec" title="${car.engine_capacity || '2.0'} л">
                            <span class="spec-icon">📏</span>
                            <span class="spec-value">${car.engine_capacity || '2.0'} л</span>
                        </div>
                    </div>
                    
                    <!-- Кнопки действий -->
                    <div class="car-actions">
                        <button class="car-book-btn" 
                                onclick="fleetManager.bookCar(${car.id})" 
                                ${car.status !== 'available' ? 'disabled' : ''}
                                title="${car.status !== 'available' ? 'Автомобиль недоступен' : 'Забронировать'}">
                            <span class="btn-icon">📅</span>
                            <span class="btn-text">${car.status === 'available' ? 'Забронировать' : 'Недоступен'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoryIcon(slug) {
        const icons = {
            'economy': '💰',
            'comfort': '🚗',
            'business': '💼',
            'premium': '👑',
            'suv': '🚙',
            'sport': '🏎️',
            'electric': '⚡',
            'minivan': '🚐'
        };
        return icons[slug] || '🚘';
    }

    getRandomCarImage() {
        // ✅ Cloudinary демо изображения (всегда доступны)
        const cloudinaryImages = [
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/car.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/automotive.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/road-trip.jpg',
            'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill,q_auto,f_webp/v1588016089/samples/e-commerce/auto.jpg'
        ];
        
        // ✅ Локальные fallback изображения
        const localImages = [
            '/static/uploads/cars/placeholder.jpg',
            '/static/photos_cars/default-car-1.jpg',
            '/static/photos_cars/default-car-2.jpg'
        ];
        
        // Используем Cloudinary для надежности
        return cloudinaryImages[Math.floor(Math.random() * cloudinaryImages.length)];
    }

    setupFilters() {
        if (!this.filterButtons.length) return;
        
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Обновляем активную кнопку
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Обновляем фильтр
                this.currentFilter = btn.dataset.category;
                
                // Загружаем автомобили
                this.loadCars({ category: this.currentFilter });
            });
        });
    }

    setupEvents() {
        // Обновление при изменении языка
        document.addEventListener('languageChange', () => {
            this.renderCars();
        });
    }

    // === ПУБЛИЧНЫЕ МЕТОДЫ ===
    
    showCarDetails(carId) {
        const car = this.cars.find(c => c.id == carId);
        if (!car) return;
        
        alert(`${car.brand} ${car.model} ${car.year}\nЦена: ${car.daily_price} ₽/сутки\nСтатус: ${this.getStatusText(car.status)}`);
    }

    bookCar(carId) {
        const car = this.cars.find(c => c.id == carId);
        if (!car) return;
        
        if (car.status !== 'available') {
            this.showNotification('error', 'Этот автомобиль сейчас недоступен для бронирования');
            return;
        }
        
        // Открываем форму бронирования
        this.openBookingForm(car);
    }

    // === УВЕДОМЛЕНИЯ ===
    
    showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <span class="notification-icon">${type === 'error' ? '❌' : '⚠️'}</span>
            <span class="notification-text">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===
    
    getTransmissionText(transmission) {
        const map = {
            'automatic': 'Автомат',
            'manual': 'Механика',
            'cvt': 'Вариатор',
            'semi_automatic': 'Робот'
        };
        return map[transmission] || transmission || 'Автомат';
    }

    getStatusText(status) {
        const map = {
            'available': 'Доступен',
            'rented': 'Арендован',
            'maintenance': 'Обслуживание',
            'reserved': 'Забронирован',
            'unavailable': 'Недоступен'
        };
        return map[status] || status || 'Неизвестно';
    }

    // === ДЕМО ДАННЫЕ (Cloudinary версия) ===
    
    getMockCategories() {
        return [
            { id: 1, name: "Эконом", slug: "economy", description: "Бюджетные автомобили" },
            { id: 2, name: "Комфорт", slug: "comfort", description: "Автомобили среднего класса" },
            { id: 3, name: "Бизнес", slug: "business", description: "Автомобили для деловых поездок" },
            { id: 4, name: "Премиум", slug: "premium", description: "Люкс автомобили" },
            { id: 5, name: "Внедорожник", slug: "suv", description: "Внедорожники и кроссоверы" }
        ];
    }

    // === Cloudinary демо данные ===
    async getCloudinaryDemoCars() {
        try {
            // Пробуем получить данные напрямую через fetch
            const response = await fetch('/api/cars');
            if (response.ok) {
                const cars = await response.json();
                console.log('✅ Получили данные из API:', cars.length);
                
                // Проверяем Cloudinary URL в данных
                if (cars.length > 0 && cars[0].images) {
                    console.log('☁️ Первое изображение в API:', cars[0].images[0]);
                    console.log('☁️ Это Cloudinary?', cars[0].images[0].includes('cloudinary.com'));
                }
                
                return cars;
            }
        } catch (error) {
            console.log('API не доступен, используем Cloudinary демо данные');
        }
        
        // Fallback: демо данные с Cloudinary URL
        return [
            {
                id: 1,
                brand: "Mercedes-Benz",
                model: "S-Class",
                year: 2023,
                category_id: 4,
                engine_capacity: 3.0,
                horsepower: 435,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 4,
                seats: 5,
                color: "черный",
                daily_price: 12000,
                mileage: 5000,
                features: ["массаж сидений", "вентиляция", "панорамная крыша"],
                // ✅ Cloudinary URL
                images: ["https://res.cloudinary.com/demo/image/upload/v1588016089/samples/mercedes-s-class.jpg"],
                thumbnail: "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,q_auto,f_webp/v1588016089/samples/mercedes-s-class.jpg",
                description: "Mercedes-Benz S-Class 2023. Роскошь и технологии высшего класса.",
                status: "available"
            },
            {
                id: 2,
                brand: "BMW",
                model: "X7",
                year: 2024,
                category_id: 5,
                engine_capacity: 4.4,
                horsepower: 530,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 5,
                seats: 7,
                color: "белый",
                daily_price: 15000,
                mileage: 3000,
                features: ["третий ряд сидений", "панорамная крыша", "проекционный дисплей"],
                // ✅ Cloudinary URL
                images: ["https://res.cloudinary.com/demo/image/upload/v1588016089/samples/bmw-x7.jpg"],
                thumbnail: "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,q_auto,f_webp/v1588016089/samples/bmw-x7.jpg",
                description: "BMW X7 2024. Просторный и мощный люксовый внедорожник.",
                status: "available"
            },
            {
                id: 3,
                brand: "Tesla",
                model: "Model S",
                year: 2023,
                category_id: 4,
                engine_capacity: 0, // электрический
                horsepower: 670,
                fuel_type: "электричество",
                transmission: "automatic",
                doors: 4,
                seats: 5,
                color: "красный",
                daily_price: 10000,
                mileage: 8000,
                features: ["автопилот", "панорамная крыша", "премиум звук"],
                // ✅ Cloudinary URL
                images: ["https://res.cloudinary.com/demo/image/upload/v1588016089/samples/tesla-model-s.jpg"],
                thumbnail: "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,q_auto,f_webp/v1588016089/samples/tesla-model-s.jpg",
                description: "Tesla Model S 2023. Будущее уже здесь. Молниеносное ускорение и автопилот.",
                status: "available"
            },
            {
                id: 4,
                brand: "Porsche",
                model: "911",
                year: 2023,
                category_id: 6,
                engine_capacity: 3.0,
                horsepower: 450,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 2,
                seats: 4,
                color: "желтый",
                daily_price: 18000,
                mileage: 4000,
                features: ["спорт пакет", "карбоновые элементы", "активный спойлер"],
                // ✅ Cloudinary URL
                images: ["https://res.cloudinary.com/demo/image/upload/v1588016089/samples/porsche-911.jpg"],
                thumbnail: "https://res.cloudinary.com/demo/image/upload/w_400,h_300,c_fill,q_auto,f_webp/v1588016089/samples/porsche-911.jpg",
                description: "Porsche 911 2023. Легендарный спорткар с непревзойденной динамикой.",
                status: "available"
            }
        ];
    }

    createNoCarsMessage() {
        return `
            <div class="no-cars-message" data-aos="fade-up">
                <div class="no-cars-icon">🚗</div>
                <h3>Автомобили не найдены</h3>
                <p class="subtext">Попробуйте изменить фильтры</p>
                <button class="retry-btn" onclick="fleetManager.loadCars({ category: fleetManager.currentFilter })">
                    <span class="btn-icon">🔄</span>
                    Загрузить снова
                </button>
            </div>
        `;
    }

    showLoading() {
        if (!this.carsGrid) return;
        
        this.carsGrid.innerHTML = `
            <div class="loading-cars">
                <div class="spinner"></div>
                <p>Загрузка автомобилей...</p>
            </div>
        `;
    }

    showError(message) {
        if (!this.carsGrid) return;
        
        this.carsGrid.innerHTML = `
            <div class="error-message" data-aos="fade-up">
                <div class="error-icon">⚠️</div>
                <h3>Ошибка загрузки</h3>
                <p>${message}</p>
                <button class="retry-btn" onclick="fleetManager.startLoading()">
                    <span class="btn-icon">🔄</span>
                    Повторить попытку
                </button>
            </div>
        `;
    }
}

// Глобальный экземпляр
window.fleetManager = new FleetManager();

// Глобальные функции
window.initFleetManager = () => window.fleetManager.init();
window.showCarDetails = (id) => window.fleetManager.showCarDetails(id);
window.bookCar = (id) => window.fleetManager.bookCar(id);
