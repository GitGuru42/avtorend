// js/fleet-manager.js - Управление отображением автопарка (Cloudinary версия)
class FleetManager {
    constructor() {
        this.carsGrid = document.getElementById('carsGrid');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.currentFilter = 'all';
        this.cars = [];
        this.categories = [];
        this.isLoading = false;
        
        // ✅ НАСТРОЙКИ CLOUDINARY (ЗАМЕНИТЕ НА ВАШИ!)
        this.CLOUDINARY_CLOUD_NAME = 'daxfsz15l'; // ЗАМЕНИТЕ НА ВАШ CLOUD_NAME!
        this.CLOUDINARY_API_KEY = '288599529822729'; // Ваш API Key (если нужно)
        this.CLOUDINARY_API_SECRET = 'OVtrZJHmq-QzHWSnU1BewtRApU4'; // Ваш API Secret (если нужно)
        
        this.init();
    }

    async init() {
        console.log('🚗 Инициализация FleetManager (Cloudinary)...');
        console.log(`☁️ Cloudinary Cloud Name: ${this.CLOUDINARY_CLOUD_NAME}`);
        this.startLoading();
    }

    async startLoading() {
        try {
            this.showLoading();
            await this.loadCategories();
            await this.loadCars();
            this.setupFilters();
            this.setupEvents();
            console.log('✅ FleetManager инициализирован (Cloudinary)');
        } catch (error) {
            console.error('❌ Ошибка инициализации FleetManager:', error);
            this.showError('Не удалось загрузить автопарк. Попробуйте обновить страницу.');
        }
    }

    async loadCategories() {
        try {
            if (window.carAPI) {
                this.categories = await window.carAPI.getCategories();
            } else {
                this.categories = this.getMockCategories();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            this.categories = this.getMockCategories();
        }
    }

    async loadCars(filters = {}) {
        this.isLoading = true;
        
        try {
            this.showSkeleton();
            
            if (window.carAPI) {
                const apiFilters = {};
                if (filters.category && filters.category !== 'all') {
                    const category = this.categories.find(c => c.slug === filters.category);
                    if (category) {
                        apiFilters.category_id = category.id;
                    }
                }
                
                this.cars = await window.carAPI.getCars(apiFilters);
                console.log('🚗 Загружены автомобили из API:', this.cars.length);
                
                // ✅ Cloudinary отладка
                if (this.cars.length > 0) {
                    console.log('☁️ Первый автомобиль (Cloudinary):');
                    console.log('   Изображения:', this.cars[0].images);
                    console.log('   Обработанный URL:', this.getCarImage(this.cars[0]));
                    
                    // Проверим Cloudinary URL
                    const firstImage = this.cars[0]?.images?.[0];
                    if (firstImage) {
                        console.log('   Исходный URL:', firstImage);
                        console.log('   Содержит ваш cloud_name:', firstImage.includes(this.CLOUDINARY_CLOUD_NAME));
                    }
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.cars = this.getCloudinaryDemoCars();
            }
            
            this.renderCars();
        } catch (error) {
            console.error('❌ Ошибка загрузки автомобилей:', error);
            this.showError('Ошибка загрузки автомобилей. Проверьте подключение к серверу.');
        } finally {
            this.isLoading = false;
        }
    }

    // ✅ Cloudinary версия: Получение фото автомобиля
    getCarImage(car) {
        if (!car) return this.getCloudinaryPlaceholder();
        
        // 1. Используем хелпер из carAPI
        if (window.carAPI && typeof window.carAPI.getCarImageUrl === 'function') {
            return window.carAPI.getCarImageUrl(car);
        }
        
        // 2. Берем первое фото из массива images
        if (car.images && car.images.length > 0) {
            const firstImage = car.images[0];
            return this.processCloudinaryUrl(firstImage);
        }
        
        // 3. Проверяем thumbnail
        if (car.thumbnail) {
            return this.processCloudinaryUrl(car.thumbnail);
        }
        
        // 4. Если фото нет - используем Cloudinary placeholder
        return this.getCloudinaryPlaceholder();
    }
    
    // ✅ ОСНОВНОЙ МЕТОД: Обработка Cloudinary URL
    processCloudinaryUrl(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') {
            console.log('⚠️ URL изображения отсутствует или некорректен');
            return this.getCloudinaryPlaceholder();
        }
        
        console.log('🔍 Обрабатываем URL:', imageUrl);
        
        // ✅ Если это уже полный URL с вашим Cloudinary
        if (imageUrl.includes('res.cloudinary.com')) {
            console.log('☁️ Обнаружен Cloudinary URL');
            
            // ✅ ВАЖНО: Проверяем, что URL содержит ваш cloud_name, а не demo
            if (imageUrl.includes('/demo/')) {
                console.warn('⚠️ Обнаружен DEMO Cloudinary URL. Заменяем на ваш cloud_name...');
                // Заменяем demo на ваш cloud_name
                imageUrl = imageUrl.replace('/demo/', `/${this.CLOUDINARY_CLOUD_NAME}/`);
                console.log('✅ Заменён на:', imageUrl);
            }
            
            // Проверяем, содержит ли URL ваш cloud_name
            if (!imageUrl.includes(this.CLOUDINARY_CLOUD_NAME)) {
                console.warn(`⚠️ Cloudinary URL не содержит ваш cloud_name "${this.CLOUDINARY_CLOUD_NAME}"`);
                console.warn(`   URL содержит: ${imageUrl.split('/')[3]}`);
            }
            
            // Проверяем, есть ли уже параметры оптимизации
            if (imageUrl.includes('/w_') || imageUrl.includes('/c_')) {
                console.log('✅ Cloudinary URL уже оптимизирован');
                return imageUrl;
            }
            
            try {
                // Добавляем параметры оптимизации для Cloudinary
                // Формат: https://res.cloudinary.com/CLOUD_NAME/image/upload/TRANSFORMATIONS/PUBLIC_ID
                let optimizedUrl = imageUrl;
                
                // Ищем позицию "/upload/"
                const uploadIndex = imageUrl.indexOf('/upload/');
                if (uploadIndex !== -1) {
                    const before = imageUrl.substring(0, uploadIndex + 8); // +8 для "/upload/"
                    const after = imageUrl.substring(uploadIndex + 8);
                    
                    // Параметры оптимизации для веба:
                    optimizedUrl = `${before}w_800,h_600,c_fill,q_auto,f_webp/${after}`;
                    
                    console.log('✅ Cloudinary URL оптимизирован для веба');
                }
                
                return optimizedUrl;
            } catch (e) {
                console.error('❌ Ошибка обработки Cloudinary URL:', e);
                return imageUrl; // Возвращаем как есть
            }
        }
        
        // ✅ Если это просто имя файла или путь (старый формат)
        if (imageUrl.includes('.jpg') || imageUrl.includes('.png') || imageUrl.includes('.webp')) {
            console.log('📄 Обнаружено имя файла или путь:', imageUrl);
            
            // Если это только имя файла без пути
            if (!imageUrl.includes('/') && !imageUrl.includes('http')) {
                console.log('📁 Только имя файла, формируем Cloudinary URL');
                // Формируем Cloudinary URL из имени файла
                return `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_800,h_600,c_fill,q_auto,f_webp/${imageUrl}`;
            }
            
            // Если это локальный путь на вашем сервере
            if (imageUrl.includes('avtorend.onrender.com') || imageUrl.includes('/static/') || imageUrl.includes('/uploads/')) {
                console.log('🌐 Обнаружен локальный путь, возвращаем как есть');
                return imageUrl; // Оставляем как есть
            }
        }
        
        // ✅ Fallback на Cloudinary placeholder
        console.log('⚠️ Неизвестный формат URL, используем placeholder');
        return this.getCloudinaryPlaceholder();
    }
    
    // ✅ Cloudinary placeholder (ИСПРАВЛЕННЫЙ)
    getCloudinaryPlaceholder() {
        // ✅ ИСПРАВЛЕНО: Используем ВАШ cloud_name вместо demo
        
        // Если cloud_name не установлен, используем общий placeholder
        if (!this.CLOUDINARY_CLOUD_NAME || this.CLOUDINARY_CLOUD_NAME === 'your_cloud_name_here') {
            console.error('❌ Cloudinary cloud_name не установлен! Установите this.CLOUDINARY_CLOUD_NAME');
            
            // Возвращаем статичный URL без cloud_name (может не работать)
            return 'https://via.placeholder.com/800x600/2c2c2c/ffffff?text=Car+Image';
        }
        
        // Cloudinary изображения с ВАШИМ cloud_name
        const cloudinaryPlaceholders = [
            `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_800,h_600,c_fill,q_auto,f_webp/samples/car`,
            `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_800,h_600,c_fill,q_auto,f_webp/samples/automotive`,
            `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_800,h_600,c_fill,q_auto,f_webp/samples/road-trip`
        ];
        
        return cloudinaryPlaceholders[Math.floor(Math.random() * cloudinaryPlaceholders.length)];
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

        const carsHTML = this.cars.map(car => this.createCarCard(car)).join('');
        this.carsGrid.innerHTML = carsHTML;
        
        if (window.AOS) {
            setTimeout(() => AOS.refresh(), 100);
        }
        
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
        const category = car.category || this.categories.find(c => c.id === car.category_id);
        const categoryName = category?.name || 'Не указано';
        const categorySlug = category?.slug || 'other';
        
        const formattedPrice = new Intl.NumberFormat('ru-RU').format(car.daily_price || 0);
        
        // ✅ Cloudinary оптимизированное фото
        const carImage = this.getCarImage(car);
        
        return `
            <div class="car-card" data-aos="fade-up" data-car-id="${car.id}" data-category="${categorySlug}">
                <!-- Картинка -->
                <div class="car-image-container">
                    <div class="image-gradient"></div>
                    <img src="${carImage}" 
                         alt="${car.brand} ${car.model}" 
                         class="car-image"
                         loading="lazy"
                         onerror="this.onerror=null; this.src='${this.getCloudinaryPlaceholder()}'; console.log('⚠️ Ошибка загрузки изображения, использован placeholder');">
                    
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
                
                <!-- Информация -->
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
            'economy': '💰', 'comfort': '🚗', 'business': '💼', 'premium': '👑',
            'suv': '🚙', 'sport': '🏎️', 'electric': '⚡', 'minivan': '🚐'
        };
        return icons[slug] || '🚘';
    }

    setupFilters() {
        if (!this.filterButtons.length) return;
        
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.category;
                this.loadCars({ category: this.currentFilter });
            });
        });
    }

    setupEvents() {
        document.addEventListener('languageChange', () => {
            this.renderCars();
        });
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

    // === ДЕМО ДАННЫЕ (Cloudinary версия - ИСПРАВЛЕННЫЕ) ===
    getMockCategories() {
        return [
            { id: 1, name: "Эконом", slug: "economy", description: "Бюджетные автомобили" },
            { id: 2, name: "Комфорт", slug: "comfort", description: "Автомобили среднего класса" },
            { id: 3, name: "Бизнес", slug: "business", description: "Автомобили для деловых поездок" },
            { id: 4, name: "Премиум", slug: "premium", description: "Люкс автомобили" },
            { id: 5, name: "Внедорожник", slug: "suv", description: "Внедорожники и кроссоверы" }
        ];
    }

    async getCloudinaryDemoCars() {
        try {
            const response = await fetch('/api/cars');
            if (response.ok) {
                const cars = await response.json();
                console.log('✅ Получили данные из API:', cars.length);
                return cars;
            }
        } catch (error) {
            console.log('API не доступен, используем Cloudinary демо данные');
        }
        
        // Fallback: демо данные с Cloudinary URL (ИСПРАВЛЕННЫЕ)
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
                images: [`https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/samples/car`],
                thumbnail: `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_400,h_300,c_fill,q_auto,f_webp/samples/car`,
                description: "Mercedes-Benz S-Class 2023",
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
                features: ["третий ряд сидений", "панорамная крыша"],
                images: [`https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/samples/automotive`],
                thumbnail: `https://res.cloudinary.com/${this.CLOUDINARY_CLOUD_NAME}/image/upload/w_400,h_300,c_fill,q_auto,f_webp/samples/automotive`,
                description: "BMW X7 2024",
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
}

// Глобальный экземпляр
window.fleetManager = new FleetManager();

// Глобальные функции
window.initFleetManager = () => window.fleetManager.init();
window.showCarDetails = (id) => window.fleetManager.showCarDetails(id);
window.bookCar = (id) => window.fleetManager.bookCar(id);

// ✅ ДОБАВЛЕНО: Отладка Cloudinary
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Проверка Cloudinary настроек...');
    console.log(`☁️ Cloud Name: ${window.fleetManager.CLOUDINARY_CLOUD_NAME}`);
    
    if (window.fleetManager.CLOUDINARY_CLOUD_NAME === 'your_cloud_name_here') {
        console.error('❌ ВНИМАНИЕ: Cloudinary cloud_name не настроен!');
        console.error('   Пожалуйста, откройте Cloudinary Console и найдите ваш Cloud Name.');
        console.error('   Затем замените "your_cloud_name_here" в fleet-manager.js на ваш реальный cloud_name.');
        
        // Покажем предупреждение пользователю
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #ff4444;
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 9999;
            max-width: 300px;
            font-family: Arial, sans-serif;
            font-size: 12px;
        `;
        warningDiv.innerHTML = `
            <strong>⚠️ Cloudinary не настроен</strong><br>
            Замените "your_cloud_name_here" в fleet-manager.js
        `;
        document.body.appendChild(warningDiv);
        setTimeout(() => warningDiv.remove(), 10000);
    }
});
