// ===== CHAT WIDGET WITH TELEGRAM INTEGRATION =====

class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.userInfo = {};
        this.isTyping = false;
        this.userId = null; // ID пользователя в Telegram
        this.ws = null; // WebSocket соединение
        this.wsConnected = false;
        this.chatId = null; // Chat ID из Telegram
        
        // API endpoints
        this.apiEndpoint = 'http://localhost:8000/send'; // Отправка сообщений
        this.wsEndpoint = 'ws://localhost:8000/ws/'; // WebSocket endpoint
        
        this.init();
    }

    init() {
        console.log('💬 Инициализация чата...');
        console.log('🌐 API Endpoint:', this.apiEndpoint);
        
        // Проверка существования элементов
        this.elements = {
            chatWidget: document.getElementById('chatWidget'),
            chatToggle: document.getElementById('chatToggle'),
            chatClose: document.getElementById('chatClose'),
            chatMessages: document.getElementById('chatMessages'),
            chatInput: document.getElementById('chatInput'),
            chatSend: document.getElementById('chatSend')
        };
        
        // Проверяем что все элементы найдены
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                console.error(`❌ Элемент не найден: ${key}`);
                return;
            }
        }
        
        // Собираем информацию о пользователе
        this.collectUserInfo();
        
        // Загружаем сохраненные сообщения
        this.loadMessages();
        
        // Устанавливаем обработчики событий
        this.setupEventListeners();
        
        // Добавляем CSS для улучшенного чата
        this.addChatStyles();
        
        // Принудительно гарантируем CSS для скролла
        this.guaranteeScrollStyles();
        
        // Генерируем временный user_id для WebSocket
        this.generateUserId();
        
        // Устанавливаем WebSocket соединение
        this.setupWebSocket();
        
        console.log('✅ Чат инициализирован');
        console.log('👤 User ID:', this.userId);
    }
    
    generateUserId() {
        // Генерируем уникальный ID пользователя
        if (!this.userId) {
            // Пробуем получить из localStorage
            const savedUserId = localStorage.getItem('luxurydrive_user_id');
            if (savedUserId) {
                this.userId = parseInt(savedUserId);
            } else {
                // Генерируем новый ID
                this.userId = Date.now() % 1000000;
                localStorage.setItem('luxurydrive_user_id', this.userId.toString());
            }
        }
    }
    
    setupWebSocket() {
        if (!this.userId) {
            console.error('❌ Не удалось сгенерировать user_id для WebSocket');
            return;
        }
        
        const wsUrl = `${this.wsEndpoint}${this.userId}`;
        console.log('🌐 Подключение WebSocket:', wsUrl);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket подключен');
                this.wsConnected = true;
                
                // Регистрируем chat_id если он уже есть
                if (this.chatId) {
                    this.registerChatId();
                }
                
                // Отправляем ping каждые 30 секунд для поддержания соединения
                this.startPingInterval();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('❌ Ошибка обработки WebSocket сообщения:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket ошибка:', error);
                this.wsConnected = false;
            };
            
            this.ws.onclose = () => {
                console.log('❌ WebSocket отключен');
                this.wsConnected = false;
                this.stopPingInterval();
                
                // Пытаемся переподключиться через 5 секунд
                setTimeout(() => {
                    if (this.userId) {
                        console.log('🔄 Попытка переподключения WebSocket...');
                        this.setupWebSocket();
                    }
                }, 5000);
            };
        } catch (e) {
            console.error('❌ Ошибка создания WebSocket:', e);
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'message':
                // Получено сообщение от менеджера
                const sender = data.sender || 'support';
                const message = data.text;
                
                console.log(`📥 Сообщение от ${sender}:`, message);
                
                // Добавляем сообщение в чат
                this.addMessage(message, 'bot');
                
                // Показываем уведомление если чат закрыт
                if (!this.isOpen) {
                    this.showNotification(`Новое сообщение от ${sender}`);
                }
                break;
                
            case 'pong':
                // Ответ на ping
                console.log('🏓 Pong received');
                break;
                
            case 'chat_id_registered':
                console.log('✅ Chat ID зарегистрирован на сервере');
                break;
        }
    }
    
    startPingInterval() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000); // Каждые 30 секунд
    }
    
    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
    }
    
    registerChatId() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.chatId) {
            this.ws.send(JSON.stringify({
                type: 'register_chat_id',
                chat_id: this.chatId
            }));
        }
    }
    
    showNotification(message) {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = 'chat-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">💬</span>
                <span class="notification-text">${message}</span>
                <button class="notification-close">×</button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 30px;
            background: var(--primary-color);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1002;
            max-width: 300px;
            animation: slideIn 0.3s ease;
            cursor: pointer;
        `;
        
        // Анимация появления
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Открыть чат при клике на уведомление
        notification.addEventListener('click', () => {
            if (!this.isOpen) {
                this.openChat();
            }
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        });
        
        // Обработчик закрытия
        notification.querySelector('.notification-close').addEventListener('click', (e) => {
            e.stopPropagation();
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        });
        
        // Автоматическое закрытие через 10 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }, 10000);
    }
    
    collectUserInfo() {
        // Собираем информацию о пользователе
        this.userInfo = {
            url: window.location.href,
            referrer: document.referrer || 'Прямой заход',
            userAgent: navigator.userAgent.substring(0, 100),
            language: navigator.language || 'en',
            screen: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            platform: navigator.platform,
            user_id: this.userId
        };
        
        console.log('👤 Информация о пользователе собрана');
    }
    
    loadMessages() {
        try {
            const saved = localStorage.getItem('luxurydrive_chat');
            if (saved) {
                this.messages = JSON.parse(saved);
                this.renderMessages();
            }
        } catch (e) {
            console.warn('Не удалось загрузить историю чата:', e);
        }
    }
    
    saveMessages() {
        try {
            // Сохраняем только последние 50 сообщений
            const toSave = this.messages.slice(-50);
            localStorage.setItem('luxurydrive_chat', JSON.stringify(toSave));
        } catch (e) {
            console.warn('Не удалось сохранить историю чата:', e);
        }
    }
    
    setupEventListeners() {
        const { chatToggle, chatClose, chatInput, chatSend } = this.elements;
        
        // Открытие/закрытие чата
        chatToggle.addEventListener('click', () => this.toggleChat());
        chatClose.addEventListener('click', () => this.closeChat());
        
        // Отправка сообщения по Enter
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Отправка сообщения по клику
        chatSend.addEventListener('click', () => this.sendMessage());
        
        // Закрытие по клику вне чата
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.elements.chatWidget.contains(e.target) && 
                !chatToggle.contains(e.target)) {
                this.closeChat();
            }
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeChat();
            }
        });
    }
    
    addChatStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Гарантия работы скролла */
            .chat-messages {
                min-height: 0 !important;
                flex-basis: 0 !important;
                flex-shrink: 1 !important;
                overflow-y: auto !important;
            }
            
            .typing-indicator {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 10px 15px;
                opacity: 0.7;
            }
            
            .typing-dot {
                width: 8px;
                height: 8px;
                background: var(--text-secondary);
                border-radius: 50%;
                animation: typingAnimation 1.4s infinite ease-in-out;
            }
            
            .typing-dot:nth-child(1) { animation-delay: -0.32s; }
            .typing-dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes typingAnimation {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            
            .message-status {
                font-size: 11px;
                opacity: 0.6;
                margin-top: 2px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .message-time {
                font-size: 11px;
                opacity: 0.5;
                margin-left: auto;
            }
            
            .chat-message.sent .message-status {
                text-align: right;
            }
            
            .message-error {
                color: #ff6b6b;
            }
            
            .message-success {
                color: #51cf66;
            }
            
            /* Для скроллбара */
            .chat-messages::-webkit-scrollbar {
                width: 6px;
            }
            
            .chat-messages::-webkit-scrollbar-track {
                background: rgba(0, 0, 0, 0.05);
                border-radius: 3px;
            }
            
            .chat-messages::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
            
            .chat-messages::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.3);
            }
            
            /* Стили для сообщений от менеджера */
            .chat-message.bot.support {
                background: #e3f2fd;
                border-left: 3px solid #2196f3;
            }
            
            .chat-message.bot.support .message-text {
                color: #1565c0;
            }
            
            .message-sender {
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 4px;
                opacity: 0.8;
            }
            
            .chat-message.bot.support .message-sender {
                color: #1976d2;
            }
        `;
        document.head.appendChild(style);
    }
    
    guaranteeScrollStyles() {
        // Принудительно устанавливаем стили для гарантии скролла
        if (this.elements.chatMessages) {
            Object.assign(this.elements.chatMessages.style, {
                'min-height': '0',
                'flex-basis': '0',
                'flex-shrink': '1',
                'overflow-y': 'auto',
                'display': 'flex',
                'flex-direction': 'column'
            });
        }
        
        if (this.elements.chatWidget) {
            Object.assign(this.elements.chatWidget.style, {
                'display': 'none',
                'flex-direction': 'column'
            });
        }
    }
    
    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
    
    openChat() {
        this.isOpen = true;
        this.elements.chatWidget.style.display = 'flex';
        this.elements.chatWidget.classList.add('active');
        this.elements.chatToggle.style.opacity = '0.5';
        
        // Фокусируемся на поле ввода
        setTimeout(() => {
            this.elements.chatInput.focus();
            this.scrollToBottom();
        }, 100);
    }
    
    closeChat() {
        this.isOpen = false;
        this.elements.chatWidget.classList.remove('active');
        this.elements.chatToggle.style.opacity = '1';
        
        setTimeout(() => {
            this.elements.chatWidget.style.display = 'none';
        }, 300);
    }
    
    async sendMessage() {
        const input = this.elements.chatInput;
        const message = input.value.trim();
        
        if (!message) return;
        
        // Очищаем поле ввода
        input.value = '';
        
        // Добавляем сообщение пользователя
        this.addMessage(message, 'user');
        
        // Показываем индикатор "печатает"
        this.showTypingIndicator();
        
        try {
            // Отправляем в Telegram через наш API
            const response = await this.sendToTelegram(message);
            
            // Скрываем индикатор
            this.hideTypingIndicator();
            
            if (response.success) {
                // Сохраняем chat_id для будущих ответов
                if (response.chat_id && !this.chatId) {
                    this.chatId = response.chat_id;
                    console.log('💾 Chat ID получен:', this.chatId);
                    
                    // Регистрируем chat_id на сервере
                    this.registerChatId();
                }
                
                // Обновляем статус сообщения
                this.updateMessageStatus('✓ Доставлено в Telegram');
                
                // Добавляем автоматический ответ если нет WebSocket соединения
                if (!this.wsConnected) {
                    setTimeout(() => {
                        this.addBotResponse();
                    }, 1000);
                }
            } else {
                this.updateMessageStatus('✗ Ошибка отправки: ' + (response.error || 'Неизвестная ошибка'));
                console.error('Ошибка отправки:', response.error);
                
                // Все равно показываем ответ бота при ошибке
                setTimeout(() => {
                    this.addBotResponse();
                }, 1000);
            }
            
        } catch (error) {
            this.hideTypingIndicator();
            this.updateMessageStatus('✗ Ошибка сети');
            console.error('Ошибка сети:', error);
            
            // Показываем альтернативный ответ
            setTimeout(() => {
                this.addBotResponse();
            }, 1000);
        }
    }
    
    async sendToTelegram(message) {
        const isRussian = /[а-яА-Я]/.test(message);
        const language = isRussian ? 'ru' : 'en';
        
        const data = {
            message: message,
            userInfo: this.userInfo,
            language: language
        };
        
        console.log('📤 Отправка в API:', data);
        
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            console.log('📥 Ответ API:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            
            // Сохраняем chat_id из ответа
            if (result.chat_id) {
                this.chatId = result.chat_id;
            }
            
            return result;
        } catch (error) {
            console.error('❌ Ошибка fetch:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
    
    addMessage(text, sender, options = {}) {
        const message = {
            id: Date.now(),
            text: text,
            sender: sender,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: Date.now(),
            from_manager: options.from_manager || false,
            manager_name: options.manager_name || null
        };
        
        this.messages.push(message);
        this.saveMessages();
        this.renderMessage(message);
        
        // Гарантируем прокрутку
        this.scrollToBottom();
        
        return message;
    }
    
    updateMessageStatus(status) {
        const lastMessage = this.messages[this.messages.length - 1];
        if (lastMessage && lastMessage.sender === 'user') {
            lastMessage.status = status;
            this.saveMessages();
            
            // Обновляем в DOM
            const messageElement = document.querySelector(`[data-message-id="${lastMessage.id}"]`);
            if (messageElement) {
                const statusElement = messageElement.querySelector('.message-status');
                if (statusElement) {
                    statusElement.textContent = status;
                    statusElement.className = `message-status ${status.includes('✓') ? 'message-success' : 'message-error'}`;
                }
            }
        }
    }
    
    showTypingIndicator() {
        if (this.isTyping) return;
        
        this.isTyping = true;
        const typingHtml = `
            <div class="chat-message bot typing-indicator" id="typingIndicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.elements.chatMessages.insertAdjacentHTML('beforeend', typingHtml);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.isTyping = false;
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    addBotResponse() {
        const responses = {
            ru: [
                "Спасибо за ваше сообщение! Наш менеджер свяжется с вами в ближайшее время.",
                "Ваше сообщение получено. Мы ответим вам в рабочее время: Пн-Пт с 9:00 до 18:00.",
                "Спасибо за обращение! Для ускорения обработки заявки вы можете позвонить нам.",
                "Сообщение доставлено. Хотите забронировать автомобиль прямо сейчас?",
                "Мы получили ваше сообщение. Обычно мы отвечаем в течение 15 минут в рабочее время."
            ],
            en: [
                "Thank you for your message! Our manager will contact you shortly.",
                "Your message has been received. We will respond during business hours: Mon-Fri 9:00-18:00.",
                "Thank you for contacting us! To speed up processing, you can call us.",
                "Message delivered. Would you like to book a car right now?",
                "We have received your message. We usually respond within 15 minutes during business hours."
            ]
        };
        
        // Определяем язык последнего сообщения
        const lastMessage = this.messages[this.messages.length - 1];
        const isRussian = lastMessage && /[а-яА-Я]/.test(lastMessage.text);
        const lang = isRussian ? 'ru' : 'en';
        
        const randomResponse = responses[lang][Math.floor(Math.random() * responses[lang].length)];
        this.addMessage(randomResponse, 'bot');
    }
    
    renderMessages() {
        this.elements.chatMessages.innerHTML = '';
        this.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        const messageClass = message.sender === 'user' ? 'sent' : 'received';
        const isSupportMessage = message.from_manager || message.sender === 'bot';
        const supportClass = isSupportMessage ? 'support' : '';
        
        let messageHtml = `
            <div class="chat-message ${message.sender} ${messageClass} ${supportClass}" data-message-id="${message.id}">
                <div class="message-content">
        `;
        
        // Добавляем имя отправителя для сообщений от менеджера
        if (message.manager_name) {
            messageHtml += `<div class="message-sender">${message.manager_name}</div>`;
        } else if (message.from_manager) {
            messageHtml += `<div class="message-sender">Поддержка</div>`;
        }
        
        messageHtml += `
                    <div class="message-text">${this.escapeHtml(message.text)}</div>
                    <div class="message-footer">
                        <div class="message-time">${message.time}</div>
                        ${message.sender === 'user' && message.status ? 
                            `<div class="message-status ${message.status.includes('✓') ? 'message-success' : 'message-error'}">${message.status}</div>` : 
                            ''}
                    </div>
                </div>
            </div>
        `;
        
        this.elements.chatMessages.insertAdjacentHTML('beforeend', messageHtml);
    }
    
    scrollToBottom() {
        if (!this.elements.chatMessages) return;
        
        // Используем несколько методов для гарантии прокрутки
        const scroll = () => {
            const messages = this.elements.chatMessages;
            messages.scrollTop = messages.scrollHeight;
        };
        
        // Первая попытка сразу
        scroll();
        
        // Вторая попытка через небольшой таймаут
        setTimeout(scroll, 10);
        
        // Третья попытка через animation frame
        requestAnimationFrame(() => {
            scroll();
            
            // Четвертая попытка после следующего frame
            requestAnimationFrame(() => {
                scroll();
            });
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.chatWidget = new ChatWidget();
    console.log('🚀 ChatWidget загружен');
});

// Экспорт для использования в других модулях
window.ChatWidget = ChatWidget;