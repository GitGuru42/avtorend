// js/fleet-manager.js - Управление отображением автопарка с динамической фильтрацией по категориям
class FleetManager {
    constructor() {
        this.carsGrid = document.getElementById('carsGrid');
        this.filtersContainer = document.querySelector('.fleet-filters');
        this.currentCategoryId = 'all'; // 'all' или ID категории
        this.cars = [];
        this.categories = [];
        this.isLoading = false;
        
        // ✅ ДОБАВЛЕНО: Флаг для предотвращения рекурсии
        this.isProcessingFilter = false;
        
        this.init();
    }

    async init() {
        console.log('🚗 Инициализация FleetManager с динамическими фильтрами...');
        
        try {
            this.showLoading();
            
            // 1. Загружаем категории из API
            await this.loadCategories();
            
            // 2. Создаем динамические фильтры
            this.createCategoryFilters();
            
            // 3. Загружаем автомобили (все по умолчанию)
            await this.loadCars({});
            
            console.log('✅ FleetManager инициализирован с динамическими фильтрами');
            
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
                console.log('📊 Загружены категории из API:', this.categories);
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

    // ✅ НОВЫЙ МЕТОД: Создание динамических фильтров категорий
    createCategoryFilters() {
        if (!this.filtersContainer) {
            console.warn('Контейнер для фильтров не найден');
            return;
        }
        
        // Очищаем статические фильтры
        this.filtersContainer.innerHTML = '';
        
        // Создаем кнопку "Все"
        const allButton = this.createFilterButton('all', 'Все автомобили', '🚗');
        this.filtersContainer.appendChild(allButton);
        
        // Создаем кнопки для каждой категории
        this.categories.forEach(category => {
            const button = this.createFilterButton(
                category.id, 
                category.name, 
                category.icon || this.getCategoryIcon(category.slug)
            );
            this.filtersContainer.appendChild(button);
        });
        
        console.log(`✅ Создано ${this.categories.length + 1} фильтров категорий`);
    }

    // ✅ НОВЫЙ МЕТОД: Создание кнопки фильтра
    createFilterButton(categoryId, text, icon) {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.type = 'button'; // ✅ ВАЖНО: Предотвращаем отправку формы
        button.dataset.categoryId = categoryId;
        button.innerHTML = `
            ${icon ? `<span class="filter-icon">${icon}</span>` : ''}
            <span class="filter-text">${text}</span>
        `;
        
        // Активируем кнопку "Все" по умолчанию
        if (categoryId === 'all') {
            button.classList.add('active');
        }
        
        // ✅ ИСПРАВЛЕНО: Делегирование событий
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleFilterClick(categoryId);
        });
        
        return button;
    }

    // ✅ ИСПРАВЛЕННЫЙ МЕТОД: Обработка клика по фильтру
    async handleFilterClick(categoryId) {
        // ✅ Проверяем, не идет ли уже обработка
        if (this.isProcessingFilter) {
            console.log('⚠️ Фильтрация уже выполняется, пропускаем клик');
            return;
        }
        
        // ✅ Обновляем активную кнопку
        const allButtons = this.filtersContainer.querySelectorAll('.filter-btn');
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        const activeButton = this.filtersContainer.querySelector(`[data-category-id="${categoryId}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        
        // ✅ Сохраняем текущую категорию
        this.currentCategoryId = categoryId;
        
        console.log(`🎯 Применен фильтр: ${categoryId === 'all' ? 'Все автомобили' : 'Категория ID ' + categoryId}`);
        
        // ✅ Загружаем автомобили с фильтром
        await this.filterCarsByCategory(categoryId);
    }

    // ✅ НОВЫЙ МЕТОД: Фильтрация автомобилей по категории
    async filterCarsByCategory(categoryId) {
        if (this.isProcessingFilter) {
            return;
        }
        
        this.isProcessingFilter = true;
        
        try {
            // Показываем индикатор загрузки
            this.showSkeleton();
            
            if (categoryId === 'all') {
                await this.loadCars({});
            } else {
                await this.loadCars({ category_id: parseInt(categoryId) });
            }
            
        } catch (error) {
            console.error('❌ Ошибка фильтрации:', error);
            this.showNotification('error', 'Не удалось применить фильтр');
        } finally {
            this.isProcessingFilter = false;
        }
    }

    async loadCars(filters = {}) {
        // ✅ Проверяем, не идет ли уже загрузка
        if (this.isLoading) {
            console.log('⚠️ Загрузка уже выполняется');
            return;
        }
        
        this.isLoading = true;
        
        try {
            // Используем API если доступен
            if (window.carAPI) {
                this.cars = await window.carAPI.getCars(filters);
                console.log('🚗 Загружены автомобили с фильтром:', filters, 'Количество:', this.cars.length);
            } else {
                // Используем демо данные с фильтрацией
                await new Promise(resolve => setTimeout(resolve, 500)); // ✅ Уменьшили время для демо
                const allCars = this.getCarsFromBotDatabase();
                
                // Применяем фильтрацию локально для демо
                if (filters.category_id) {
                    this.cars = allCars.filter(car => car.category_id === filters.category_id);
                } else {
                    this.cars = allCars;
                }
                console.log('🚗 Используем демо данные:', this.cars.length);
            }
            
            // ✅ Отрисовываем автомобили
            this.renderCars();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки автомобилей:', error);
            this.showNotification('warning', 'Не удалось загрузить актуальные данные.');
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
    
    getCorrectImageUrl(imagePath) {
        if (!imagePath || typeof imagePath !== 'string') {
            return this.getDefaultCarImage();
        }
        
        // Если уже полный URL
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        
        if (imagePath.startsWith('/static/uploads/cars/')) {
            return imagePath;
        }
        
        // Если только имя файла
        if (!imagePath.includes('/') && imagePath.includes('.jpg')) {
            return `/static/uploads/cars/${imagePath}`;
        }
        
        // Любой другой случай
        const filename = imagePath.split('/').pop();
        return `/static/uploads/cars/${filename}`;
    }
    
    getDefaultCarImage() {
        const defaultImages = [
            '/static/photos_cars/default-car.jpg',
            '/static/uploads/cars/default-car.jpg',
            '/images/default-car.jpg'
        ];
        return defaultImages[0];
    }

    showSkeleton() {
        if (!this.carsGrid) return;
        
        // ✅ Очищаем контейнер
        this.carsGrid.innerHTML = '';
        
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
        `.repeat(4);
        
        this.carsGrid.innerHTML = skeletonHTML;
    }

    renderCars() {
        if (!this.carsGrid) return;
        
        // ✅ Проверяем, не идет ли загрузка
        if (this.isLoading) {
            return; // Не вызываем showSkeleton здесь
        }
        
        if (this.cars.length === 0) {
            this.carsGrid.innerHTML = this.createNoCarsMessage();
            return;
        }

        const carsHTML = this.cars.map(car => this.createCarCard(car)).join('');
        this.carsGrid.innerHTML = carsHTML;
        
        // Инициализируем AOS для новых элементов
        if (window.AOS) {
            setTimeout(() => {
                if (window.AOS) {
                    AOS.refresh();
                }
            }, 100);
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
        
        // Получаем фото
        const carImage = this.getCarImage(car);
        
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
                                onclick="window.fleetManager.bookCar(${car.id})" 
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
        const localImages = [
            '/static/photos_cars/default-car-1.jpg',
            '/static/photos_cars/default-car-2.jpg',
            '/static/photos_cars/default-car-3.jpg'
        ];
        
        return localImages[Math.floor(Math.random() * localImages.length)];
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

    // === ДЕМО ДАННЫЕ ===
    
    getMockCategories() {
        return [
            { id: 1, name: "Эконом", slug: "economy", icon: "💰" },
            { id: 2, name: "Комфорт", slug: "comfort", icon: "🚗" },
            { id: 3, name: "Бизнес", slug: "business", icon: "💼" },
            { id: 4, name: "Премиум", slug: "premium", icon: "👑" },
            { id: 5, name: "Внедорожник", slug: "suv", icon: "🚙" },
            { id: 6, name: "Минивэн", slug: "minivan", icon: "🚐" },
            { id: 7, name: "Спорт", slug: "sport", icon: "🏎️" },
            { id: 8, name: "Электрокар", slug: "electric", icon: "⚡" }
        ];
    }

    async getCarsFromBotDatabase() {
        try {
            const response = await fetch('http://localhost:8000/api/cars');
            if (response.ok) {
                const cars = await response.json();
                console.log('✅ Получили данные напрямую из API:', cars.length);
                return cars;
            }
        } catch (error) {
            console.log('API не доступен, используем fallback');
        }
        
        // Fallback: демо данные для разных категорий
        return [
            {
                id: 1,
                brand: "Toyota",
                model: "Camry",
                year: 2022,
                category_id: 2, // Комфорт
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
                category_id: 5, // Внедорожник
                engine_capacity: 3.0,
                horsepower: 340,
                fuel_type: "дизель",
                transmission: "automatic",
                doors: 5,
                seats: 5,
                color: "белый",
                daily_price: 8500,
                mileage: 8000,
                images: ["/static/photos_cars/car_20241219_120000_1.jpg"],
                thumbnail: "/static/photos_cars/car_20241219_120000_1.jpg",
                description: "BMW X5 2023 года",
                status: "available"
            },
            {
                id: 3,
                brand: "Mercedes",
                model: "S-Class",
                year: 2023,
                category_id: 4, // Премиум
                engine_capacity: 3.0,
                horsepower: 435,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 4,
                seats: 5,
                color: "черный",
                daily_price: 12000,
                mileage: 5000,
                images: ["/static/photos_cars/car_20241219_120000_2.jpg"],
                thumbnail: "/static/photos_cars/car_20241219_120000_2.jpg",
                description: "Mercedes S-Class 2023 года",
                status: "available"
            },
            {
                id: 4,
                brand: "Audi",
                model: "Q7",
                year: 2022,
                category_id: 5, // Внедорожник
                engine_capacity: 3.0,
                horsepower: 340,
                fuel_type: "дизель",
                transmission: "automatic",
                doors: 5,
                seats: 7,
                color: "серый",
                daily_price: 9500,
                mileage: 12000,
                images: ["/static/photos_cars/car_20241219_120000_3.jpg"],
                thumbnail: "/static/photos_cars/car_20241219_120000_3.jpg",
                description: "Audi Q7 2022 года",
                status: "available"
            },
            {
                id: 5,
                brand: "Kia",
                model: "Rio",
                year: 2021,
                category_id: 1, // Эконом
                engine_capacity: 1.6,
                horsepower: 123,
                fuel_type: "бензин",
                transmission: "automatic",
                doors: 4,
                seats: 5,
                color: "белый",
                daily_price: 2000,
                mileage: 25000,
                images: ["/static/photos_cars/default-car-1.jpg"],
                thumbnail: "/static/photos_cars/default-car-1.jpg",
                description: "Kia Rio 2021 года",
                status: "available"
            }
        ];
    }

    createNoCarsMessage() {
        const categoryName = this.currentCategoryId === 'all' 
            ? 'во всех категориях' 
            : 'в этой категории';
        
        return `
            <div class="no-cars-message" data-aos="fade-up">
                <div class="no-cars-icon">🚗</div>
                <h3>Автомобили не найдены</h3>
                <p class="subtext">К сожалению, нет доступных автомобилей ${categoryName}.</p>
                <button class="retry-btn" onclick="window.fleetManager.handleFilterClick('all')">
                    <span class="btn-icon">🔄</span>
                    Показать все автомобили
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
                <button class="retry-btn" onclick="window.fleetManager.init()">
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
