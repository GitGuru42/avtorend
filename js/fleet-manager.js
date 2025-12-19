// js/fleet-manager.js - Управление отображением автопарка (Адаптированная версия)
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
        console.log('🚗 Инициализация FleetManager...');
        
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
            
            console.log('✅ FleetManager инициализирован');
            
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
                
                // ✅ ВАЖНО: Проверяем данные
                if (this.cars.length > 0) {
                    console.log('📸 Пример фото из API:');
                    console.log('   Изображения:', this.cars[0].images);
                    console.log('   Thumbnail:', this.cars[0].thumbnail);
                    console.log('   Прямой URL первого фото:', this.getCorrectImageUrl(this.cars[0].images?.[0]));
                }
                
            } else {
                // Используем демо данные с фото из бота
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.cars = this.getCarsFromBotDatabase();
                console.log('🚗 Используем данные из БД бота:', this.cars.length);
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

    // ✅ ИЗМЕНЕНО: Правильный метод получения фото
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
    
    // ✅ НОВЫЙ МЕТОД: Получение правильного URL для фото
    // В fleet-manager.js измени метод getCorrectImageUrl:
    getCorrectImageUrl(imagePath) {
        if (!imagePath || typeof imagePath !== 'string') {
            return this.getDefaultCarImage();
        }
        
        console.log('🔍 Обрабатываем путь к фото:', imagePath);
        
        // Если уже полный URL
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        
        // ✅ ИЗМЕНЕНО: Проверяем uploads/cars вместо photos_cars
        if (imagePath.startsWith('/static/uploads/cars/')) {
            return imagePath;
        }
        
        // Если только имя файла
        if (!imagePath.includes('/') && imagePath.includes('.jpg')) {
            return `/static/uploads/cars/${imagePath}`;
        }
        
        // Если старый путь
        if (imagePath.includes('uploads/cars/') || imagePath.includes('photos_cars/')) {
            const filename = imagePath.split('/').pop();
            return `/static/uploads/cars/${filename}`;
        }
        
        // Любой другой случай
        const filename = imagePath.split('/').pop();
        return `/static/uploads/cars/${filename}`;
    }
    
    // ✅ НОВЫЙ МЕТОД: Получение дефолтного фото
    getDefaultCarImage() {
        // Проверяем существует ли дефолтное фото
        const defaultImages = [
            '/static/photos_cars/default-car.jpg',
            '/static/uploads/cars/default-car.jpg',
            '/images/default-car.jpg'
        ];
        
        // Можно добавить проверку существования файла через fetch
        return defaultImages[0]; // Используем новый путь
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
        
        // ✅ ИЗМЕНЕНО: Используем новый метод получения фото
        const carImage = this.getCarImage(car);
        console.log(`🖼 Создаем карточку ${car.brand} ${car.model}:`, carImage);
        
        return `
            <div class="car-card" data-aos="fade-up" data-car-id="${car.id}" data-category="${categorySlug}">
                <!-- Картинка с эффектами -->
                <div class="car-image-container">
                    <div class="image-gradient"></div>
                    <img src="${carImage}" 
                         alt="${car.brand} ${car.model}" 
                         class="car-image"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='${this.getRandomCarImage()}';">
                    
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
        // ✅ Используем локальные пути вместо Unsplash
        const localImages = [
            '/static/photos_cars/default-car-1.jpg',
            '/static/photos_cars/default-car-2.jpg',
            '/static/photos_cars/default-car-3.jpg'
        ];
        
        const unsplashImages = [
            'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&h=300&fit=crop'
        ];
        
        // Пробуем сначала локальные
        return localImages[Math.floor(Math.random() * localImages.length)];
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

    // === ДЕМО ДАННЫЕ (если нет API) ===
    
    getMockCategories() {
        return [
            { id: 1, name: "Эконом", slug: "economy", description: "Бюджетные автомобили" },
            { id: 2, name: "Комфорт", slug: "comfort", description: "Автомобили среднего класса" },
            { id: 3, name: "Бизнес", slug: "business", description: "Автомобили для деловых поездок" },
            { id: 4, name: "Премиум", slug: "premium", description: "Люкс автомобили" },
            { id: 5, name: "Внедорожник", slug: "suv", description: "Внедорожники и кроссоверы" }
        ];
    }

    // === НОВЫЙ МЕТОД: Получение машин из БД бота ===
    async getCarsFromBotDatabase() {
        try {
            // Пробуем получить данные напрямую через fetch
            const response = await fetch('http://localhost:8000/api/cars');
            if (response.ok) {
                const cars = await response.json();
                console.log('✅ Получили данные напрямую из API:', cars.length);
                return cars;
            }
        } catch (error) {
            console.log('API не доступен, используем fallback');
        }
        
        // Fallback: демо данные с ПРАВИЛЬНЫМИ путями к фото
        return [
            {
                id: 1,
                brand: "Toyota",
                model: "Camry",
                year: 2022,
                category_id: 2,
                engine_capacity: 2.5,
                horsepower: 203,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 4,
                seats: 5,
                color: "черный",
                daily_price: 3500,
                mileage: 15000,
                features: ["кондиционер", "подогрев сидений"],
                // ✅ ИЗМЕНЕНО: Правильные пути
                images: ["/static/photos_cars/car_20241219_120000_0.jpg"],
                thumbnail: "/static/photos_cars/car_20241219_120000_0.jpg",
                description: "Toyota Camry 2022 года",
                status: "available"
            },
            {
                id: 2,
                brand: "BMW",
                model: "X5",
                year: 2023,
                category_id: 5,
                engine_capacity: 3.0,
                horsepower: 340,
                fuel_type: "дизель",
                transmission: "automatic",
                doors: 5,
                seats: 5,
                color: "белый",
                daily_price: 8500,
                mileage: 8000,
                // ✅ ИЗМЕНЕНО: Правильные пути
                images: ["/static/photos_cars/car_20241219_120000_1.jpg"],
                thumbnail: "/static/photos_cars/car_20241219_120000_1.jpg",
                description: "BMW X5 2023 года",
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