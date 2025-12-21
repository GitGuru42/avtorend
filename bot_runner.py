#!/usr/bin/env python3
"""
bot_runner.py - Telegram бот для AvtoRend (отдельный процесс)
Запускается как отдельный сервис на Render
"""

import os
import sys
import logging
from pathlib import Path

# ========== НАСТРОЙКА ПУТЕЙ ==========
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# ========== НАСТРОЙКА ЛОГИРОВАНИЯ ==========
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ========== ПРОВЕРКА ТОКЕНА ==========
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    logger.error("❌ TELEGRAM_BOT_TOKEN не найден!")
    print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!")
    print("ℹ️  Добавьте TELEGRAM_BOT_TOKEN в Environment Variables на Render")
    sys.exit(1)

print("=" * 60)
print("🤖 TELEGRAM BOT - AvtoRend Админ Панель")
print("=" * 60)
print(f"🔐 Токен: {TOKEN[:15]}...")
print(f"📁 Рабочая директория: {current_dir}")

# ========== ЗАПУСК БОТА ==========
try:
    # Проверяем наличие файла бота
    bot_file = current_dir / "api" / "telegram_bot.py"
    if not bot_file.exists():
        print(f"❌ Файл бота не найден: {bot_file}")
        sys.exit(1)
    
    print(f"✅ Файл бота найден: {bot_file}")
    
    # Импортируем функцию запуска бота
    try:
        from api.telegram_bot import start_bot
        print("✅ Функция start_bot() импортирована")
    except ImportError as e:
        print(f"❌ Ошибка импорта: {e}")
        print("Попытка альтернативного импорта...")
        
        # Альтернативный импорт
        sys.path.insert(0, str(current_dir / "api"))
        from telegram_bot import start_bot
        print("✅ Функция start_bot() импортирована альтернативно")
    
    # Запускаем бота
    print("\n" + "=" * 60)
    print("🚀 ЗАПУСК ТЕЛЕГРАМ БОТА...")
    print("=" * 60)
    
    start_bot()
    
except Exception as e:
    logger.error(f"❌ Критическая ошибка: {e}")
    print(f"\n❌ ТРАССИРОВКА ОШИБКИ:")
    import traceback
    traceback.print_exc()
    sys.exit(1)
