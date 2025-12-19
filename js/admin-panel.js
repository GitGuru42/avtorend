// ===== ADMIN PANEL FOR FLEET MANAGEMENT =====

const AdminPanel = {
    isOpen: false,
    currentTab: 'add',
    selectedCars: new Set(),
    searchTerm: '',
    currentCategory: 'all'
};

// Initialize Admin Panel
function initAdminPanel() {
    console.log('⚙️ Initializing admin panel...');
    
    // Setup admin access button
    setupAdminAccess();
    
    // Setup admin modal
    setupAdminModal();
    
    // Load cars for edit tab
    loadAdminCars();
    
    // Setup event listeners
    setupAdminEventListeners();
    
    // Check for admin password in URL
    checkAdminAccess();
    
    console.log('✅ Admin panel initialized');
}

// Setup Admin Access Button
function setupAdminAccess() {
    const adminBtn = document.getElementById('adminAccessBtn');
    
    // Show admin button if password is set
    const adminPassword = localStorage.getItem('luxurydrive_admin');
    if (adminPassword) {
        adminBtn.classList.add('visible');
    }
    
    adminBtn.addEventListener('click', openAdminPanel);
}

// Setup Admin Modal
function setupAdminModal() {
    const modal = document.getElementById('adminPanelModal');
    const closeBtn = document.getElementById('adminCloseBtn');
    const tabs = document.querySelectorAll('.admin-tab');
    
    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            switchTab(tabId);
        });
    });
    
    // Close modal
    closeBtn.addEventListener('click', closeAdminPanel);
    
    // Close on escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && AdminPanel.isOpen) {
            closeAdminPanel();
        }
    });
    
    // Close on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeAdminPanel();
        }
    });
    
    // Form submission
    const addCarForm = document.getElementById('addCarForm');
    if (addCarForm) {
        addCarForm.addEventListener('submit', handleAddCar);
    }
}

// Open Admin Panel
function openAdminPanel() {
    // Check admin access
    if (!checkAdminPassword()) {
        requestAdminPassword();
        return;
    }
    
    AdminPanel.isOpen = true;
    const modal = document.getElementById('adminPanelModal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Load current tab data
    switchTab(AdminPanel.currentTab);
    
    // Update stats
    updateAdminStats();
    
    console.log('📊 Admin panel opened');
}

// Close Admin Panel
function closeAdminPanel() {
    AdminPanel.isOpen = false;
    const modal = document.getElementById('adminPanelModal');
    modal.classList.remove('active');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Clear selection
    AdminPanel.selectedCars.clear();
    
    console.log('📊 Admin panel closed');
}

// Switch Tab
function switchTab(tabId) {
    AdminPanel.currentTab = tabId;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId + 'Tab') {
            content.classList.add('active');
        }
    });
    
    // Load tab data
    switch(tabId) {
        case 'edit':
            loadAdminCars();
            break;
        case 'manage':
            updateAdminStats();
            break;
        case 'stats':
            loadStats();
            break;
    }
}

// ===== CAR MANAGEMENT FUNCTIONS =====

// Load cars for admin panel
function loadAdminCars() {
    const carsList = document.getElementById('adminCarsList');
    if (!carsList) return;
    
    carsList.innerHTML = '<div class="loading-cars">Загрузка автомобилей...</div>';
    
    setTimeout(() => {
        renderAdminCarsList();
    }, 500);
}

// Render cars list for admin
function renderAdminCarsList() {
    const carsList = document.getElementById('adminCarsList');
    if (!carsList) return;
    
    let filteredCars = [...cars];
    
    // Apply search filter
    if (AdminPanel.searchTerm) {
        const searchLower = AdminPanel.searchTerm.toLowerCase();
        filteredCars = filteredCars.filter(car => 
            car.title_ru.toLowerCase().includes(searchLower) ||
            car.title_en.toLowerCase().includes(searchLower) ||
            car.id.toString().includes(searchLower)
        );
    }
    
    // Apply category filter
    if (AdminPanel.currentCategory !== 'all') {
        filteredCars = filteredCars.filter(car => 
            car.category === AdminPanel.currentCategory
        );
    }
    
    if (filteredCars.length === 0) {
        carsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🚗</div>
                <h3>Автомобили не найдены</h3>
                <p>Попробуйте изменить параметры поиска</p>
            </div>
        `;
        return;
    }
    
    carsList.innerHTML = filteredCars.map(car => `
        <div class="car-item" data-car-id="${car.id}">
            <input type="checkbox" class="car-select" 
                   onchange="toggleCarSelection(${car.id}, this.checked)"
                   ${AdminPanel.selectedCars.has(car.id) ? 'checked' : ''}>
            
            <img src="${car.image || 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=200&h=150&fit=crop'}" 
                 alt="${car.title_ru}" 
                 class="car-image-small"
                 onerror="this.src='https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=200&h=150&fit=crop'">
            
            <div class="car-info-small">
                <div class="car-title-small">${car.title_ru}</div>
                <div class="car-details-small">
                    <span>ID: ${car.id}</span>
                    <span>•</span>
                    <span>${getCategoryLabel(car.category)}</span>
                    <span>•</span>
                    <span>${car.price ? car.price.toLocaleString('ru-RU') + ' ₽/день' : 'Цена не указана'}</span>
                </div>
            </div>
            
            <div class="car-status ${car.status || 'active'}">
                ${getStatusLabel(car.status || 'active')}
            </div>
            
            <div class="car-actions">
                <button class="car-action-btn" onclick="editCar(${car.id})" title="Редактировать">
                    ✏️
                </button>
                <button class="car-action-btn" onclick="toggleCarStatus(${car.id})" title="${car.status === 'active' ? 'Отключить' : 'Активировать'}">
                    ${car.status === 'active' ? '⛔' : '✅'}
                </button>
                <button class="car-action-btn delete" onclick="deleteCar(${car.id})" title="Удалить">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

// Search cars
function searchCars() {
    AdminPanel.searchTerm = document.getElementById('carSearch').value;
    renderAdminCarsList();
}

// Filter cars by category
function filterCarsAdmin() {
    AdminPanel.currentCategory = document.getElementById('categoryFilter').value;
    renderAdminCarsList();
}

// Toggle car selection
function toggleCarSelection(carId, isSelected) {
    if (isSelected) {
        AdminPanel.selectedCars.add(carId);
    } else {
        AdminPanel.selectedCars.delete(carId);
    }
}

// ===== CAR CRUD OPERATIONS =====

// Add new car
async function handleAddCar(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const carData = Object.fromEntries(formData);
    
    try {
        // Process car data
        carData.id = cars.length + 1;
        carData.price = parseInt(carData.price_day) || parseInt(carData.price) || 0;
        carData.passengers = parseInt(carData.passengers) || 4;
        carData.bags = parseInt(carData.bags) || 3;
        carData.status = carData.status || 'active';
        carData.features = carData.features ? carData.features.split(',').map(f => f.trim()) : [];
        
        // Handle extra images
        if (carData.extra_images) {
            carData.extra_images = carData.extra_images.split(',').map(img => img.trim());
        }
        
        // Add to cars array
        cars.push(carData);
        
        // Save to localStorage (in real app - API call)
        saveCarsToStorage();
        
        // Show success message
        showNotification('Автомобиль успешно добавлен!', 'success');
        
        // Reset form
        form.reset();
        
        // Update UI
        if (typeof renderCars === 'function') {
            renderCars();
        }
        
        renderAdminCarsList();
        updateAdminStats();
        
        console.log('✅ Car added:', carData);
        
    } catch (error) {
        console.error('❌ Error adding car:', error);
        showNotification('Ошибка при добавлении автомобиля', 'error');
    }
}

// Edit car
function editCar(carId) {
    const car = cars.find(c => c.id === carId);
    if (!car) return;
    
    const editBody = document.getElementById('editCarBody');
    const modal = document.getElementById('editCarModal');
    
    editBody.innerHTML = `
        <form id="editCarForm" class="admin-form">
            <div class="form-grid">
                <div class="form-group">
                    <label>Название (Русский)</label>
                    <input type="text" name="title_ru" value="${car.title_ru}" required>
                </div>
                <div class="form-group">
                    <label>Название (English)</label>
                    <input type="text" name="title_en" value="${car.title_en || car.title_ru}" required>
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <select name="category" required>
                        <option value="business" ${car.category === 'business' ? 'selected' : ''}>Бизнес</option>
                        <option value="premium" ${car.category === 'premium' ? 'selected' : ''}>Премиум</option>
                        <option value="suv" ${car.category === 'suv' ? 'selected' : ''}>Внедорожник</option>
                        <option value="luxury" ${car.category === 'luxury' ? 'selected' : ''}>Люкс</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Статус</label>
                    <select name="status">
                        <option value="active" ${car.status === 'active' ? 'selected' : ''}>Активна</option>
                        <option value="maintenance" ${car.status === 'maintenance' ? 'selected' : ''}>На обслуживании</option>
                        <option value="unavailable" ${car.status === 'unavailable' ? 'selected' : ''}>Недоступна</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Цена в день (₽)</label>
                    <input type="number" name="price" value="${car.price || 0}" required>
                </div>
                <div class="form-group">
                    <label>Пассажиры</label>
                    <input type="number" name="passengers" value="${car.passengers || 4}" required>
                </div>
                <div class="form-group">
                    <label>Места для багажа</label>
                    <input type="number" name="bags" value="${car.bags || 3}" required>
                </div>
                <div class="form-group full-width">
                    <label>Особенности (через запятую)</label>
                    <input type="text" name="features" value="${car.features ? car.features.join(', ') : ''}">
                </div>
                <div class="form-group full-width">
                    <label>Ссылка на изображение</label>
                    <input type="url" name="image" value="${car.image || ''}" required>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-secondary" onclick="closeEditModal()">
                    Отмена
                </button>
                <button type="submit" class="btn-primary">
                    Сохранить изменения
                </button>
                <button type="button" class="btn-danger" onclick="deleteCar(${car.id})">
                    🗑️ Удалить автомобиль
                </button>
            </div>
        </form>
    `;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Form submission
    document.getElementById('editCarForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateCar(carId, new FormData(this));
    });
}

// Update car
function updateCar(carId, formData) {
    const carData = Object.fromEntries(formData);
    const index = cars.findIndex(c => c.id === carId);
    
    if (index === -1) return;
    
    // Update car data
    cars[index] = {
        ...cars[index],
        ...carData,
        id: carId,
        price: parseInt(carData.price) || 0,
        passengers: parseInt(carData.passengers) || 4,
        bags: parseInt(carData.bags) || 3,
        features: carData.features ? carData.features.split(',').map(f => f.trim()) : []
    };
    
    // Save changes
    saveCarsToStorage();
    
    // Update UI
    closeEditModal();
    renderCars();
    renderAdminCarsList();
    showNotification('Автомобиль успешно обновлен!', 'success');
}

// Toggle car status
function toggleCarStatus(carId) {
    const car = cars.find(c => c.id === carId);
    if (!car) return;
    
    // Toggle status
    if (car.status === 'active') {
        car.status = 'unavailable';
    } else {
        car.status = 'active';
    }
    
    // Save changes
    saveCarsToStorage();
    
    // Update UI
    renderCars();
    renderAdminCarsList();
    updateAdminStats();
    
    showNotification(`Статус автомобиля изменен на: ${getStatusLabel(car.status)}`, 'info');
}

// Delete car
function deleteCar(carId) {
    if (!confirm('Вы уверены, что хотите удалить этот автомобиль?')) {
        return;
    }
    
    const index = cars.findIndex(c => c.id === carId);
    if (index === -1) return;
    
    // Remove car
    cars.splice(index, 1);
    
    // Save changes
    saveCarsToStorage();
    
    // Update UI
    closeEditModal();
    renderCars();
    renderAdminCarsList();
    updateAdminStats();
    
    showNotification('Автомобиль успешно удален!', 'success');
}

// ===== BULK OPERATIONS =====

// Toggle all cars status
function toggleAllCars(status) {
    if (!confirm(`Вы уверены, что хотите ${status === 'active' ? 'активировать' : 'отключить'} все автомобили?`)) {
        return;
    }
    
    cars.forEach(car => {
        car.status = status;
    });
    
    saveCarsToStorage();
    renderCars();
    renderAdminCarsList();
    updateAdminStats();
    
    showNotification(`Все автомобили ${status === 'active' ? 'активированы' : 'отключены'}!`, 'success');
}

// Apply bulk action
function applyBulkAction() {
    const action = document.getElementById('bulkAction').value;
    const value = document.getElementById('bulkValue').value;
    
    if (AdminPanel.selectedCars.size === 0) {
        showNotification('Выберите автомобили для массового редактирования', 'warning');
        return;
    }
    
    if (!value) {
        showNotification('Введите значение для изменения', 'warning');
        return;
    }
    
    AdminPanel.selectedCars.forEach(carId => {
        const car = cars.find(c => c.id === carId);
        if (car) {
            switch(action) {
                case 'price':
                    car.price = parseInt(value);
                    break;
                case 'status':
                    car.status = value;
                    break;
                case 'category':
                    car.category = value;
                    break;
            }
        }
    });
    
    saveCarsToStorage();
    renderCars();
    renderAdminCarsList();
    updateAdminStats();
    
    showNotification(`Изменения применены к ${AdminPanel.selectedCars.size} автомобилям`, 'success');
    
    // Clear selection
    AdminPanel.selectedCars.clear();
    document.querySelectorAll('.car-select').forEach(cb => cb.checked = false);
}

// ===== STATISTICS =====

// Update admin stats
function updateAdminStats() {
    const stats = {
        active: cars.filter(c => c.status === 'active').length,
        maintenance: cars.filter(c => c.status === 'maintenance').length,
        unavailable: cars.filter(c => c.status === 'unavailable').length,
        total: cars.length
    };
    
    document.getElementById('activeCount').textContent = stats.active;
    document.getElementById('maintenanceCount').textContent = stats.maintenance;
    document.getElementById('unavailableCount').textContent = stats.unavailable;
    document.getElementById('totalCount').textContent = stats.total;
}

// Load statistics
function loadStats() {
    // In real app, this would be API call
    // For now, show sample data
    const popularCarsList = document.getElementById('popularCarsList');
    
    if (popularCarsList) {
        const popularCars = [...cars]
            .sort((a, b) => (b.rentals || 0) - (a.rentals || 0))
            .slice(0, 5);
        
        popularCarsList.innerHTML = popularCars.map(car => `
            <div class="popular-car-item">
                <img src="${car.image}" alt="${car.title_ru}" class="popular-car-image">
                <div class="popular-car-info">
                    <div class="popular-car-title">${car.title_ru}</div>
                    <div class="popular-car-stats">
                        <span>📊 ${car.rentals || 0} аренд</span>
                        <span>⭐ ${car.rating || 'Нет оценок'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

// ===== IMPORT/EXPORT =====

// Export cars data
function exportCars() {
    const dataStr = JSON.stringify(cars, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `luxurydrive-cars-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Данные экспортированы в JSON файл', 'success');
}

// Import cars data
function importCars() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedCars = JSON.parse(e.target.result);
                
                if (!Array.isArray(importedCars)) {
                    throw new Error('Invalid data format');
                }
                
                // Merge with existing cars
                importedCars.forEach(importedCar => {
                    const existingIndex = cars.findIndex(c => c.id === importedCar.id);
                    if (existingIndex >= 0) {
                        // Update existing
                        cars[existingIndex] = { ...cars[existingIndex], ...importedCar };
                    } else {
                        // Add new with new ID
                        importedCar.id = Math.max(...cars.map(c => c.id), 0) + 1;
                        cars.push(importedCar);
                    }
                });
                
                saveCarsToStorage();
                renderCars();
                renderAdminCarsList();
                updateAdminStats();
                
                showNotification(`Импортировано ${importedCars.length} автомобилей`, 'success');
                
            } catch (error) {
                console.error('Import error:', error);
                showNotification('Ошибка при импорте файла', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ===== PREVIEW FUNCTION =====

// Preview car
function previewCar() {
    const form = document.getElementById('addCarForm');
    const formData = new FormData(form);
    const carData = Object.fromEntries(formData);
    
    const previewBody = document.getElementById('previewBody');
    const modal = document.getElementById('previewModal');
    
    previewBody.innerHTML = `
        <div class="car-preview">
            <img src="${carData.image_url || 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&h=400&fit=crop'}" 
                 alt="${carData.title_ru}" 
                 class="preview-image"
                 onerror="this.src='https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&h=400&fit=crop'">
            
            <div class="preview-info">
                <h2>${carData.title_ru}</h2>
                <div class="preview-category">${getCategoryLabel(carData.category)}</div>
                
                <div class="preview-details">
                    <div class="detail-item">
                        <strong>Цена в день:</strong> ${parseInt(carData.price_day || 0).toLocaleString('ru-RU')} ₽
                    </div>
                    <div class="detail-item">
                        <strong>Пассажиры:</strong> ${carData.passengers}
                    </div>
                    <div class="detail-item">
                        <strong>Багаж:</strong> ${carData.bags} мест
                    </div>
                    <div class="detail-item">
                        <strong>Коробка:</strong> ${carData.transmission === 'automatic' ? 'Автомат' : 'Механика'}
                    </div>
                    <div class="detail-item">
                        <strong>Топливо:</strong> ${getFuelLabel(carData.fuel_type)}
                    </div>
                    <div class="detail-item">
                        <strong>Статус:</strong> ${getStatusLabel(carData.status)}
                    </div>
                </div>
                
                ${carData.features ? `
                    <div class="preview-features">
                        <strong>Особенности:</strong>
                        <div class="features-list">
                            ${carData.features.split(',').map(f => `<span class="feature-tag">${f.trim()}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${carData.description ? `
                    <div class="preview-description">
                        <strong>Описание:</strong>
                        <p>${carData.description}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Close preview
function closePreview() {
    document.getElementById('previewModal').style.display = 'none';
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editCarModal').style.display = 'none';
}

// ===== ADMIN ACCESS CONTROL =====

// Check admin access
function checkAdminAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const adminParam = urlParams.get('admin');
    
    if (adminParam === 'true' || adminParam === 'luxurydrive') {
        localStorage.setItem('luxurydrive_admin', 'true');
        document.getElementById('adminAccessBtn').classList.add('visible');
    }
}

// Check admin password
function checkAdminPassword() {
    return localStorage.getItem('luxurydrive_admin') === 'true';
}

// Request admin password
function requestAdminPassword() {
    const password = prompt('Введите пароль администратора:');
    
    if (password === 'luxurydrive' || password === 'admin123') {
        localStorage.setItem('luxurydrive_admin', 'true');
        document.getElementById('adminAccessBtn').classList.add('visible');
        openAdminPanel();
        return true;
    } else {
        alert('Неверный пароль!');
        return false;
    }
}

// ===== UTILITY FUNCTIONS =====

function getStatusLabel(status) {
    const labels = {
        'active': 'Активна',
        'maintenance': 'На обслуживании',
        'unavailable': 'Недоступна',
        'sold': 'Продана'
    };
    return labels[status] || status;
}

function getFuelLabel(fuel) {
    const labels = {
        'petrol': 'Бензин',
        'diesel': 'Дизель',
        'hybrid': 'Гибрид',
        'electric': 'Электричество'
    };
    return labels[fuel] || fuel;
}

function saveCarsToStorage() {
    try {
        localStorage.setItem('luxurydrive_cars', JSON.stringify(cars));
    } catch (error) {
        console.error('Error saving cars:', error);
    }
}

function loadCarsFromStorage() {
    try {
        const savedCars = localStorage.getItem('luxurydrive_cars');
        if (savedCars) {
            const parsedCars = JSON.parse(savedCars);
            if (Array.isArray(parsedCars)) {
                cars = parsedCars;
                return true;
            }
        }
    } catch (error) {
        console.error('Error loading cars:', error);
    }
    return false;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== INITIALIZATION =====

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Load cars from storage first
    loadCarsFromStorage();
    
    // Initialize admin panel
    setTimeout(() => {
        initAdminPanel();
    }, 1000);
});

// Make functions globally available
window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.switchTab = switchTab;
window.searchCars = searchCars;
window.filterCarsAdmin = filterCarsAdmin;
window.toggleCarSelection = toggleCarSelection;
window.editCar = editCar;
window.toggleCarStatus = toggleCarStatus;
window.deleteCar = deleteCar;
window.toggleAllCars = toggleAllCars;
window.applyBulkAction = applyBulkAction;
window.exportCars = exportCars;
window.importCars = importCars;
window.previewCar = previewCar;
window.closePreview = closePreview;
window.closeEditModal = closeEditModal;