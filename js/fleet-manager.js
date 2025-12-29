// js/fleet-manager.js - Управление отображением автопарка с динамической фильтрацией по категориям
class FleetManager {
    constructor() {
        this.carsGrid = document.getElementById('carsGrid');
        this.filtersContainer = document.querySelector('.fleet-filters');
        this.currentCategoryId = 'all';
        this.cars = [];
        this.categories = [];
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        console.log('🚗 Инициализация FleetManager...');
        
        try {
            // 1. Загружаем категории
            await this.loadCategories();
            
            // 2. Создаем динамические фильтры
            this.createCategoryFilters();
            
            // 3. Загружаем все автомобили
            await this.loadAllCars();
            
            console.log('✅ FleetManager инициализирован');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации FleetManager:', error);
            this.showError('Не удалось загрузить автопарк. Попробуйте обновить страницу.');
        }
    }

    async loadCategories() {
        try {
            if (window.carAPI) {
                this.categories = await window.carAPI.getCategories();
                console.log('📊 Загружены категории из API:', this.categories);
            } else {
                this.categories = this.getMockCategories();
                console.log('📊 Используем тестовые категории');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            this.categories = this.getMockCategories();
        }
    }

    createCategoryFilters() {
        if (!this.filtersContainer) {
            console.warn('Контейнер для фильтров не найден');
            return;
        }
        
        // Очищаем контейнер
        this.filtersContainer.innerHTML = '';
        
        // Создаем кнопку "Все"
        const allButton = this.createFilterButton('all', 'Все автомобили', '🚗', true);
        this.filtersContainer.appendChild(allButton);
        
        // Создаем кнопки для каждой категории
        this.categories.forEach(category => {
            const button = this.createFilterButton(
                category.id, 
                category.name, 
                category.icon || this.getCategoryIcon(category.slug),
                false
            );
            this.filtersContainer.appendChild(button);
        });
        
        console.log(`✅ Создано ${this.categories.length + 1} фильтров категорий`);
    }

    createFilterButton(categoryId, text, icon, isActive = false) {
        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.type = 'button';
        button.dataset.categoryId = categoryId;
        button.innerHTML = `
            ${icon ? `<span class="filter-icon">${icon}</span>` : ''}
            <span class="filter-text">${text}</span>
        `;
        
        if (isActive) {
            button.classList.add('active');
        }
        
        // Назначаем обработчик
        button.addEventListener('click', () => {
            this.onFilterClick(categoryId);
        });
        
        return button;
    }

    // ✅ ПРОСТОЙ МЕТОД: Обработка клика по фильтру
    async onFilterClick(categoryId) {
        console.log(`🎯 Клик по фильтру: ${categoryId}`);
        
        // Обновляем активную кнопку
        const buttons = this.filtersContainer.querySelectorAll('.filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        
        const activeBtn = this.filtersContainer.querySelector(`[data-category-id="${categoryId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Сохраняем текущую категорию
        this.currentCategoryId = categoryId;
        
        // Показываем скелетон загрузки
        this.showSkeleton();
        
        // Загружаем автомобили с фильтром
        await this.fetchCars(categoryId);
    }

    // ✅ ПРОСТОЙ МЕТОД: Загрузка всех автомобилей при инициализации
    async loadAllCars() {
        this.showSkeleton();
        await this.fetchCars('all');
    }

    // ✅ ОСНОВНОЙ МЕТОД: Загрузка автомобилей
    async fetchCars(categoryId) {
        this.isLoading = true;
        
        try {
            let cars = [];
            
            if (window.carAPI) {
                // Используем API с фильтром
                const filters = {};
                if (categoryId !== 'all') {
                    filters.category_id = parseInt(categoryId);
                }
                
                cars = await window.carAPI.getCars(filters);
                console.log(`🚗 API: Загружено ${cars.length} автомобилей для категории ${categoryId}`);
            } else {
                // Используем демо-данные
                await new Promise(resolve => setTimeout(resolve, 500));
                const allCars = this.getCarsFromBotDatabase();
                
                if (categoryId === 'all') {
                    cars = allCars;
                } else {
                    const categoryIdNum = parseInt(categoryId);
                    cars = allCars.filter(car => car.category_id === categoryIdNum);
                }
                console.log(`🚗 Демо: Загружено ${cars.length} автомобилей для категории ${categoryId}`);
            }
            
            this.cars = cars;
            this.renderCars();
            
        } catch (error) {
            console.error('❌ Ошибка загрузки автомобилей:', error);
            this.showError('Ошибка загрузки автомобилей. Проверьте подключение к серверу.');
        } finally {
            this.isLoading = false;
        }
    }

    // ✅ МЕТОД: Отображение автомобилей
    renderCars() {
        if (!this.carsGrid) return;
        
        if (this.cars.length === 0) {
            this.carsGrid.innerHTML = this.createNoCarsMessage();
            return;
        }

        const carsHTML = this.cars.map(car => this.createCarCard(car)).join('');
        this.carsGrid.innerHTML = carsHTML;
        
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
        `.repeat(4);
        
        this.carsGrid.innerHTML = skeletonHTML;
    }

    createCarCard(car) {
        const category = this.categories.find(c => c.id === car.category_id);
        const categoryName = category?.name || 'Не указано';
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(car.daily_price || 0);
        const carImage = this.getCarImage(car);
        
        return `
            <div class="car-card" data-car-id="${car.id}">
                <div class="car-image-container">
                    <img src="${carImage}" 
                         alt="${car.brand} ${car.model}" 
                         class="car-image"
                         loading="lazy">
                    
                    <div class="car-badges">
                        <span class="car-category-badge">${categoryName}</span>
                        <span class="car-status-badge ${car.status || 'available'}">
                            ${this.getStatusText(car.status)}
                        </span>
                    </div>
                </div>
                
                <div class="car-info">
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
                    
                    <p class="car-description">
                        ${car.description || `${car.brand} ${car.model} ${car.year} года. Отличное состояние.`}
                    </p>
                    
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
                    
                    <div class="car-actions">
                        <button class="car-book-btn" onclick="window.fleetManager.bookCar(${car.id})">
                            <span class="btn-icon">📅</span>
                            <span class="btn-text">Забронировать</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getCarImage(car) {
        if (!car) return this.getRandomCarImage();
        
        if (window.carAPI && typeof window.carAPI.getCarImageUrl === 'function') {
            return window.carAPI.getCarImageUrl(car);
        }
        
        if (car.images && car.images.length > 0) {
            return this.getCorrectImageUrl(car.images[0]);
        }
        
        if (car.thumbnail) {
            return this.getCorrectImageUrl(car.thumbnail);
        }
        
        return this.getRandomCarImage();
    }
    
    getCorrectImageUrl(imagePath) {
        if (!imagePath || typeof imagePath !== 'string') {
            return this.getDefaultCarImage();
        }
        
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        
        if (imagePath.startsWith('/static/uploads/cars/')) {
            return imagePath;
        }
        
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

    getCarsFromBotDatabase() {
        // Статические данные для демо
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
                images: ["/static/photos_cars/default-car-1.jpg"],
                thumbnail: "/static/photos_cars/default-car-1.jpg",
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
                images: ["/static/photos_cars/default-car-2.jpg"],
                thumbnail: "/static/photos_cars/default-car-2.jpg",
                description: "BMW X5 2023 года",
                status: "available"
            },
            {
                id: 3,
                brand: "Mercedes",
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
                images: ["/static/photos_cars/default-car-3.jpg"],
                thumbnail: "/static/photos_cars/default-car-3.jpg",
                description: "Mercedes S-Class 2023 года",
                status: "available"
            },
            {
                id: 4,
                brand: "Kia",
                model: "Rio",
                year: 2021,
                category_id: 1,
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
            <div class="no-cars-message">
                <div class="no-cars-icon">🚗</div>
                <h3>Автомобили не найдены</h3>
                <p class="subtext">К сожалению, нет доступных автомобилей ${categoryName}.</p>
                <button class="retry-btn" onclick="window.fleetManager.onFilterClick('all')">
                    <span class="btn-icon">🔄</span>
                    Показать все автомобили
                </button>
            </div>
        `;
    }

    showError(message) {
        if (!this.carsGrid) return;
        
        this.carsGrid.innerHTML = `
            <div class="error-message">
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

    bookCar(carId) {
        const car = this.cars.find(c => c.id == carId);
        if (!car) return;
        
        alert(`Бронирование ${car.brand} ${car.model}\nЦена: ${car.daily_price} ₽/сутки`);
    }
}

// Глобальный экземпляр
window.fleetManager = new FleetManager();
