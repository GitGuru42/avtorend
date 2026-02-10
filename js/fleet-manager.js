// js/fleet-manager.js
// Управление отображением автопарка с динамической фильтрацией

class FleetManager {
    constructor() {
        this.carsGrid = null;
        this.filtersContainer = null;

        this.currentCategoryId = 'all';
        this.cars = [];
        this.categories = [];
        this.isLoading = false;
    }

    async init() {
        console.log('🚗 FleetManager init');

        this.carsGrid = document.getElementById('carsGrid');
        this.filtersContainer = document.querySelector('.fleet-filters');

        if (!this.carsGrid) {
            console.error('❌ #carsGrid не найден');
            return;
        }

        try {
            await this.loadCategories();
            this.createCategoryFilters();
            await this.loadAllCars();
            console.log('✅ FleetManager готов');
        } catch (e) {
            console.error('❌ FleetManager error:', e);
            this.showError('Ошибка загрузки автопарка');
        }
    }

    /* ===================== API ===================== */

    async loadCategories() {
        try {
            if (window.carAPI?.getCategories) {
                this.categories = await window.carAPI.getCategories();
            } else {
                this.categories = this.getMockCategories();
            }
        } catch {
            this.categories = this.getMockCategories();
        }
    }

    async loadAllCars() {
        this.showSkeleton();
        await this.fetchCars('all');
    }

    async fetchCars(categoryId) {
        this.isLoading = true;

        try {
            let cars = [];

            if (window.carAPI?.getCars) {
                const filters = {};

                if (categoryId !== 'all') {
                    filters.category_id = Number(categoryId);
                }

                cars = await window.carAPI.getCars(filters);
            } else {
                await new Promise(r => setTimeout(r, 400));
                const all = this.getCarsFromBotDatabase();
                cars = categoryId === 'all'
                    ? all
                    : all.filter(c => c.category_id === Number(categoryId));
            }

            this.cars = Array.isArray(cars) ? cars : [];
            this.renderCars();

        } catch (e) {
            console.error('❌ fetchCars error:', e);
            this.showError('Не удалось загрузить автомобили');
        } finally {
            this.isLoading = false;
        }
    }

    /* ===================== FILTERS ===================== */

    createCategoryFilters() {
        if (!this.filtersContainer) return;

        this.filtersContainer.innerHTML = '';

        this.filtersContainer.appendChild(
            this.createFilterButton('all', 'Все', '🚗', true)
        );

        this.categories.forEach(c => {
            this.filtersContainer.appendChild(
                this.createFilterButton(
                    c.id,
                    c.name,
                    c.icon || this.getCategoryIcon(c.slug)
                )
            );
        });
    }

    createFilterButton(id, text, icon, active = false) {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.dataset.categoryId = id;
        btn.innerHTML = `
            <span>${icon}</span>
            <span>${text}</span>
        `;
        if (active) btn.classList.add('active');

        btn.onclick = () => this.onFilterClick(id);
        return btn;
    }

    async onFilterClick(id) {
        if (this.isLoading) return;

        this.currentCategoryId = id;

        this.filtersContainer?.querySelectorAll('.filter-btn')
            .forEach(b => b.classList.remove('active'));

        this.filtersContainer
            ?.querySelector(`[data-category-id="${id}"]`)
            ?.classList.add('active');

        this.showSkeleton();
        await this.fetchCars(id);
    }

    /* ===================== RENDER ===================== */

    renderCars() {
        if (!this.cars.length) {
            this.carsGrid.innerHTML = this.createNoCarsMessage();
            return;
        }

        this.carsGrid.innerHTML = this.cars
            .map(c => this.createCarCard(c))
            .join('');
    }

    createCarCard(car) {
        const cat = this.categories.find(c => c.id === car.category_id);
        const price = new Intl.NumberFormat('ru-RU').format(car.daily_price || 0);

        return `
        <div class="car-card">
            <div class="car-image-container">
                <img src="${this.getCarImage(car)}" loading="lazy">
                <span class="car-category-badge">${cat?.name || '—'}</span>
            </div>

            <div class="car-info">
                <h3>${car.brand} ${car.model} (${car.year})</h3>
                <div class="price">${price} ₽ / сутки</div>

                <div class="car-specs">
                    <span>👥 ${car.seats || 4}</span>
                    <span>⚙️ ${this.getTransmissionText(car.transmission)}</span>
                    <span>⛽ ${car.fuel_type || 'Бензин'}</span>
                </div>

                <button onclick="fleetManager.bookCar(${car.id})">
                    Забронировать
                </button>
            </div>
        </div>`;
    }

    showSkeleton() {
        this.carsGrid.innerHTML = '<div class="skeleton">Загрузка...</div>'.repeat(4);
    }

    /* ===================== HELPERS ===================== */

    getCarImage(car) {
        if (window.carAPI?.getCarImageUrl) {
            return window.carAPI.getCarImageUrl(car);
        }

        if (car.images?.[0]?.startsWith('http')) {
            return car.images[0]; // Cloudinary
        }

        return car.images?.[0] || '/static/photos_cars/default-car.jpg';
    }

    getTransmissionText(v) {
        return {
            automatic: 'Автомат',
            manual: 'Механика',
            cvt: 'Вариатор'
        }[v] || 'Автомат';
    }

    bookCar(id) {
        const car = this.cars.find(c => c.id === id);
        if (car) {
            alert(`${car.brand} ${car.model}\n${car.daily_price} ₽ / сутки`);
        }
    }

    showError(msg) {
        this.carsGrid.innerHTML = `<div class="error">${msg}</div>`;
    }

    createNoCarsMessage() {
        return `<div class="no-cars">Автомобили не найдены</div>`;
    }

    /* ===================== DEMO ===================== */

    getMockCategories() {
        return [
            { id: 1, name: 'Эконом', slug: 'economy', icon: '💰' },
            { id: 2, name: 'Комфорт', slug: 'comfort', icon: '🚗' },
            { id: 5, name: 'SUV', slug: 'suv', icon: '🚙' }
        ];
    }

    getCarsFromBotDatabase() {
        return [];
    }

    getCategoryIcon(slug) {
        return { economy: '💰', comfort: '🚗', suv: '🚙' }[slug] || '🚘';
    }
}

/* ✅ безопасная инициализация */
document.addEventListener('DOMContentLoaded', () => {
    window.fleetManager = new FleetManager();
    window.fleetManager.init();
});
