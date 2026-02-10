// js/video-hero.js

document.addEventListener('DOMContentLoaded', function() {
    const video = document.querySelector('.luxury-car-video');
    const muteBtn = document.querySelector('.mute-btn');
    const pauseBtn = document.querySelector('.pause-btn');
    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');
    
    // Проверка поддержки видео
    if (!video) return;
    
    // Инициализация видео
    function initVideo() {
        // Предзагрузка видео
        video.load();
        
        // Обработчики событий видео
        video.addEventListener('loadeddata', handleVideoLoaded);
        video.addEventListener('error', handleVideoError);
        video.addEventListener('waiting', handleVideoBuffering);
        video.addEventListener('playing', handleVideoPlaying);
        
        // Настройка контролов
        setupVideoControls();
        
        // Адаптация для мобильных устройств
        adaptForMobile();
    }
    
    // Видео загружено
    function handleVideoLoaded() {
        console.log('✅ Видео загружено');
        video.classList.remove('loading');
        video.classList.add('loaded');
        
        // Автоматическое воспроизведение с обработкой ошибок
        const playPromise = video.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Автовоспроизведение заблокировано, показываем кнопку воспроизведения');
                showPlayButton();
            });
        }
    }
    
    // Ошибка загрузки видео
    function handleVideoError() {
        console.error('❌ Ошибка загрузки видео');
        // Можно показать fallback изображение
        const fallbackImg = video.querySelector('img');
        if (fallbackImg) {
            video.style.display = 'none';
            fallbackImg.style.display = 'block';
        }
    }
    
    // Видео буферизуется
    function handleVideoBuffering() {
        console.log('⏳ Видео буферизуется...');
        video.classList.add('buffering');
    }
    
    // Видео воспроизводится
    function handleVideoPlaying() {
        console.log('▶️ Видео воспроизводится');
        video.classList.remove('buffering');
    }
    
    // Настройка контролов видео
    function setupVideoControls() {
        // Кнопка mute/unmute
        muteBtn.addEventListener('click', function() {
            video.muted = !video.muted;
            updateMuteButton();
        });
        
        // Кнопка play/pause
        pauseBtn.addEventListener('click', function() {
            if (video.paused) {
                video.play();
                updatePlayButton(true);
            } else {
                video.pause();
                updatePlayButton(false);
            }
        });
        
        // Обновление иконок при изменении состояния
        video.addEventListener('volumechange', updateMuteButton);
        video.addEventListener('play', () => updatePlayButton(true));
        video.addEventListener('pause', () => updatePlayButton(false));
        
        // Инициализация иконок
        updateMuteButton();
        updatePlayButton(!video.paused);
    }
    
    // Обновление кнопки mute
    function updateMuteButton() {
        const svgPath = muteBtn.querySelector('svg');
        if (video.muted) {
            // Показываем иконку "без звука"
            svgPath.innerHTML = `
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M23 9L17 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M17 9L23 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            `;
        } else {
            // Показываем иконку "со звуком"
            svgPath.innerHTML = `
                <path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M19 9L15 13M15 9L19 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            `;
        }
    }
    
    // Обновление кнопки play/pause
    function updatePlayButton(isPlaying) {
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
    
    // Показать кнопку воспроизведения (если автовоспроизведение заблокировано)
    function showPlayButton() {
        pauseBtn.style.opacity = '1';
        pauseBtn.style.transform = 'scale(1.2)';
        
        // Мигающая анимация для привлечения внимания
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            pauseBtn.style.opacity = pauseBtn.style.opacity === '1' ? '0.6' : '1';
            blinkCount++;
            
            if (blinkCount >= 6) {
                clearInterval(blinkInterval);
                pauseBtn.style.opacity = '1';
            }
        }, 500);
    }
    
    // Адаптация для мобильных устройств
    function adaptForMobile() {
        // На мобильных устройствах всегда включаем muted для автовоспроизведения
        if (/Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent)) {
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
        }
        
        // Оптимизация для слабых устройств
        if (isLowEndDevice()) {
            console.log('📱 Слабое устройство, оптимизируем видео...');
            video.preload = 'metadata';
            video.autoplay = false;
        }
    }
    
    // Проверка на слабые устройства
    function isLowEndDevice() {
        const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
        const isSlowConnection = navigator.connection && 
            (navigator.connection.saveData || 
             navigator.connection.effectiveType === 'slow-2g' || 
             navigator.connection.effectiveType === '2g');
        
        return isMobile || isSlowConnection;
    }
    
    // Оптимизация производительности
    function optimizePerformance() {
        // Приостанавливаем видео при скрытии страницы
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                video.pause();
            } else {
                // Возобновляем только если видео было на паузе пользователем
                if (!video.pausedByUser) {
                    video.play().catch(e => console.log('Не удалось возобновить видео:', e));
                }
            }
        });
        
        // Отслеживаем, кто поставил на паузу
        video.addEventListener('pause', function() {
            video.pausedByUser = true;
            setTimeout(() => {
                video.pausedByUser = false;
            }, 100);
        });
        
        video.addEventListener('play', function() {
            video.pausedByUser = false;
        });
    }
    
    // Запуск инициализации
    initVideo();
    optimizePerformance();
    
    // Fallback: если видео не загрузилось за 5 секунд
    setTimeout(() => {
        if (video.readyState < 2) { // HAVE_CURRENT_DATA или меньше
            console.log('⚠️ Видео медленно загружается, показываем fallback...');
            const fallbackImg = video.querySelector('img');
            if (fallbackImg) {
                video.style.opacity = '0';
                fallbackImg.style.display = 'block';
                fallbackImg.style.opacity = '1';
            }
        }
    }, 5000);
});