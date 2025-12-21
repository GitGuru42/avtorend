"""
telegram_bot.py - Telegram бот для AvtoRend (отдельный сервис)
Полная админ-панель с управлением автомобилями
"""

import os
import logging
import sys
from datetime import datetime
from pathlib import Path
from PIL import Image

# ========== НАСТРОЙКА ПУТЕЙ ==========
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

# ========== НАСТРОЙКА ЛОГИРОВАНИЯ ==========
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

print("=" * 60)
print("🤖 TELEGRAM BOT - AvtoRend Админ Панель")
print("=" * 60)

# ========== ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ==========
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ .env файл загружен")
except ImportError:
    print("⚠️  python-dotenv не установлен, используем системные переменные")

# ========== КОНФИГУРАЦИЯ ==========
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_IDS = list(map(int, os.getenv("TELEGRAM_ADMIN_IDS", "").split(","))) if os.getenv("TELEGRAM_ADMIN_IDS") else []

if not TOKEN:
    logger.error("❌ TELEGRAM_BOT_TOKEN не найден!")
    print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!")
    print("ℹ️  Добавьте TELEGRAM_BOT_TOKEN в Environment Variables на Render")
    sys.exit(1)

print(f"🔐 Токен: {TOKEN[:15]}...")
print(f"👑 Админов: {len(ADMIN_IDS) if ADMIN_IDS else 'не настроено'}")

# ========== ПУТЬ ДЛЯ ЗАГРУЗКИ ИЗОБРАЖЕНИЙ ==========
if os.getenv("RENDER"):
    UPLOAD_DIR = Path("/opt/render/project/src/static/uploads/cars")
else:
    UPLOAD_DIR = Path("static/uploads/cars")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
print(f"📁 Директория для фото: {UPLOAD_DIR}")

# ========== ИМПОРТЫ БАЗЫ ДАННЫХ ==========
try:
    from api.models import Car, Category, CarStatus, TransmissionType
    from api.database import SessionLocal
    from api.schemas import CarCreate
    print("✅ Модули БД импортированы из api.*")
except ImportError as e:
    print(f"⚠️  Ошибка импорта БД: {e}")
    print("Попытка альтернативного импорта...")
    try:
        from models import Car, Category, CarStatus, TransmissionType
        from database import SessionLocal
        from schemas import CarCreate
        print("✅ Модули БД импортированы из корневой директории")
    except ImportError as e2:
        print(f"❌ Критическая ошибка импорта БД: {e2}")
        sys.exit(1)

# ========== ИМПОРТЫ TELEGRAM ==========
try:
    from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import (
        Application, 
        CommandHandler, 
        MessageHandler, 
        CallbackQueryHandler,
        ConversationHandler,
        filters,
        ContextTypes
    )
    print("✅ Модули Telegram импортированы")
except ImportError as e:
    print(f"❌ Ошибка импорта Telegram: {e}")
    print("ℹ️  Установите: pip install python-telegram-bot")
    sys.exit(1)

# ========== СОСТОЯНИЯ ДЛЯ ConversationHandler ==========
(
    BRAND, MODEL, YEAR, LICENSE_PLATE, CATEGORY_ID, 
    ENGINE_CAPACITY, HORSEPOWER, FUEL_TYPE, TRANSMISSION,
    FUEL_CONSUMPTION, DOORS, SEATS, COLOR, DAILY_PRICE,
    DEPOSIT, MILEAGE, FEATURES, DESCRIPTION, PHOTOS, CONFIRM
) = range(20)

# ========== ВРЕМЕННОЕ ХРАНИЛИЩЕ ДАННЫХ ==========
user_data_store = {}

# ========== ДЕКОРАТОРЫ ==========
def admin_only(func):
    """Декоратор для ограничения доступа только администраторам"""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user_id = update.effective_user.id
        if not ADMIN_IDS:
            await update.message.reply_text("⚠️ ADMIN_IDS не настроены в .env файле")
            return ConversationHandler.END
        if user_id not in ADMIN_IDS:
            await update.message.reply_text("⛔ У вас нет прав для выполнения этой команды.")
            return ConversationHandler.END
        return await func(update, context, *args, **kwargs)
    return wrapper

# ========== ОСНОВНЫЕ КОМАНДЫ ==========
@admin_only
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start - панель администратора"""
    await update.message.reply_text(
        "🚗 *Админ-панель AvtoRend*\n\n"
        "📋 *Доступные команды:*\n"
        "/add_car - Добавить новую машину\n"
        "/list_cars - Показать все машины\n"
        "/edit_car <id> <поле> <значение> - Редактировать машину\n"
        "/delete_car <id> - Удалить машину\n"
        "/status - Статус системы\n"
        "/cancel - Отменить операцию\n\n"
        "🔒 Доступ только для администраторов",
        parse_mode='Markdown'
    )

@admin_only
async def admin_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Статус системы для администратора"""
    try:
        db = SessionLocal()
        cars_count = db.query(Car).count()
        categories_count = db.query(Category).count()
        db.close()
        
        db_status = "✅ Подключена"
    except Exception as e:
        db_status = f"❌ Ошибка: {str(e)[:50]}"
        cars_count = "неизвестно"
        categories_count = "неизвестно"
    
    status_text = (
        f"📊 *Статус системы*\n\n"
        f"🤖 Бот: ✅ Работает\n"
        f"🗄️  База данных: {db_status}\n"
        f"🚗 Автомобилей: {cars_count}\n"
        f"📂 Категорий: {categories_count}\n"
        f"👑 Админов: {len(ADMIN_IDS)}\n"
        f"🌐 Хостинг: {'Render' if os.getenv('RENDER') else 'Локальный'}\n\n"
        f"🟢 Система функционирует нормально"
    )
    
    await update.message.reply_text(status_text, parse_mode='Markdown')

# ========== ФУНКЦИИ ДОБАВЛЕНИЯ АВТОМОБИЛЯ ==========
# (Здесь все функции process_brand, process_model и т.д. остаются БЕЗ ИЗМЕНЕНИЙ)
# Убедитесь что все функции от @admin_only до process_confirmation 
# скопированы сюда без изменений

# ========== СПИСОК АВТОМОБИЛЕЙ ==========
@admin_only
async def list_cars(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать список всех машин"""
    try:
        db = SessionLocal()
        cars = db.query(Car).filter(Car.is_active == True).order_by(Car.id).all()
        db.close()
        
        if not cars:
            await update.message.reply_text("🚫 В базе нет автомобилей.")
            return
        
        message = "📋 *Список автомобилей:*\n\n"
        for car in cars[:10]:  # Ограничиваем 10 машинами
            status_icons = {
                "available": "✅",
                "rented": "🔴",
                "maintenance": "🔧",
                "reserved": "🟡",
                "unavailable": "⛔"
            }
            icon = status_icons.get(car.status.value, "❓")
            
            message += (
                f"{icon} *ID: {car.id}*\n"
                f"   {car.brand} {car.model} ({car.year})\n"
                f"   Номер: {car.license_plate}\n"
                f"   Цена: {car.daily_price} руб./день\n"
                f"   Статус: {car.status.value}\n\n"
            )
        
        if len(cars) > 10:
            message += f"... и еще {len(cars) - 10} автомобилей\n"
        
        message += f"Всего: *{len(cars)}* автомобилей"
        
        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Ошибка при получении списка автомобилей: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке списка автомобилей.")

# ========== УДАЛЕНИЕ АВТОМОБИЛЯ ==========
@admin_only
async def delete_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Удалить машину по ID"""
    if not context.args:
        await update.message.reply_text("Используйте: /delete_car <ID автомобиля>")
        return
    
    try:
        car_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Пожалуйста, укажите числовой ID автомобиля")
        return
    
    try:
        db = SessionLocal()
        car = db.query(Car).filter(Car.id == car_id).first()
        
        if not car:
            db.close()
            await update.message.reply_text(f"❌ Автомобиль с ID {car_id} не найден")
            return
        
        # Удаляем файлы изображений
        for image_path in car.images:
            try:
                if image_path.startswith('/static/'):
                    local_path = image_path[8:]  # Убираем '/static/'
                    file_path = Path("static") / local_path
                
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Удален файл: {file_path}")
            except Exception as e:
                logger.error(f"Ошибка удаления изображения {image_path}: {e}")
        
        db.delete(car)
        db.commit()
        db.close()
        
        await update.message.reply_text(
            f"✅ *Автомобиль удален*\n\n"
            f"🚗 {car.brand} {car.model}\n"
            f"🆔 ID: {car.id}\n"
            f"📌 Номер: {car.license_plate}",
            parse_mode='Markdown'
        )
    except Exception as e:
        logger.error(f"Ошибка удаления автомобиля: {e}")
        await update.message.reply_text(f"❌ Ошибка при удалении автомобиля: {e}")

# ========== РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ ==========
@admin_only
async def edit_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Редактировать машину по ID"""
    if not context.args:
        await update.message.reply_text(
            "*Используйте:* /edit_car <id> <поле> <значение>\n\n"
            "*Доступные поля:*\n"
            "• daily_price - цена за день\n"
            "• deposit - залог\n" 
            "• status - статус (available, rented, maintenance, reserved, unavailable)\n"
            "• mileage - пробег\n"
            "• description - описание\n\n"
            "*Пример:*\n"
            "/edit_car 15 daily_price 3000\n"
            "/edit_car 15 status maintenance",
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 3:
        await update.message.reply_text(
            "Недостаточно аргументов. Формат:\n"
            "/edit_car <id> <поле> <значение>"
        )
        return
    
    try:
        car_id = int(context.args[0])
        field = context.args[1]
        value = " ".join(context.args[2:])
    except ValueError:
        await update.message.reply_text("Неверный формат ID")
        return
    
    try:
        db = SessionLocal()
        car = db.query(Car).filter(Car.id == car_id).first()
        
        if not car:
            db.close()
            await update.message.reply_text(f"❌ Автомобиль с ID {car_id} не найден")
            return
        
        old_value = getattr(car, field, None)
        
        # Обновляем поле
        if field == "daily_price":
            car.daily_price = float(value)
        elif field == "deposit":
            car.deposit = float(value)
        elif field == "mileage":
            car.mileage = int(value)
        elif field == "status":
            if value in [s.value for s in CarStatus]:
                car.status = CarStatus(value)
            else:
                await update.message.reply_text(
                    f"❌ Неверный статус. Допустимые: {', '.join([s.value for s in CarStatus])}"
                )
                db.close()
                return
        elif field == "description":
            car.description = value
        else:
            await update.message.reply_text(
                f"❌ Поле '{field}' недоступно для редактирования"
            )
            db.close()
            return
        
        db.commit()
        await update.message.reply_text(
            f"✅ *Автомобиль обновлен*\n\n"
            f"🆔 ID: {car_id}\n"
            f"🚗 {car.brand} {car.model}\n"
            f"📌 Поле: {field}\n"
            f"🔄 Было: {old_value}\n"
            f"➡️ Стало: {value}",
            parse_mode='Markdown'
        )
        
    except ValueError as e:
        await update.message.reply_text(f"❌ Неверное значение для поля {field}: {e}")
    except Exception as e:
        logger.error(f"Ошибка редактирования автомобиля: {e}")
        await update.message.reply_text(f"❌ Ошибка при редактировании: {e}")
    finally:
        try:
            db.close()
        except:
            pass

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отмена текущей операции"""
    user_id = update.effective_user.id
    if user_id in user_data_store:
        user_data_store.pop(user_id, None)
    await update.message.reply_text("Операция отменена.")
    return ConversationHandler.END

async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик ошибок"""
    logger.error(f"Update вызвал ошибку: {context.error}")
    if update and hasattr(update, 'message') and update.message:
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте еще раз.")

# ========== ГЛАВНАЯ ФУНКЦИЯ ЗАПУСКА ==========
def start_bot():
    """Запуск бота - вызывается из bot_runner.py"""
    
    print("\n" + "=" * 60)
    print("🚀 ЗАПУСК ТЕЛЕГРАМ БОТА...")
    print("=" * 60)
    
    try:
        # Создаем приложение
        application = Application.builder().token(TOKEN).build()
        
        # ConversationHandler для добавления машины
        conv_handler = ConversationHandler(
            entry_points=[CommandHandler("add_car", add_car)],
            states={
                BRAND: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_brand)],
                MODEL: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_model)],
                YEAR: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_year)],
                LICENSE_PLATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_license_plate)],
                CATEGORY_ID: [CallbackQueryHandler(process_category, pattern="^cat_")],
                ENGINE_CAPACITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_engine_capacity)],
                HORSEPOWER: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_horsepower)],
                FUEL_TYPE: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_fuel_type)],
                TRANSMISSION: [CallbackQueryHandler(process_transmission, pattern="^trans_")],
                FUEL_CONSUMPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_fuel_consumption)],
                DOORS: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_doors)],
                SEATS: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_seats)],
                COLOR: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_color)],
                DAILY_PRICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_daily_price)],
                DEPOSIT: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_deposit)],
                MILEAGE: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_mileage)],
                FEATURES: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_features)],
                DESCRIPTION: [MessageHandler(filters.TEXT & ~filters.COMMAND, process_description)],
                PHOTOS: [
                    MessageHandler(filters.PHOTO, process_photo),
                    CommandHandler("done", process_done_photos)
                ],
                CONFIRM: [CallbackQueryHandler(process_confirmation, pattern="^confirm_")]
            },
            fallbacks=[CommandHandler("cancel", cancel)],
            per_message=False
        )
        
        # Регистрируем все обработчики
        application.add_handler(CommandHandler("start", start))
        application.add_handler(CommandHandler("status", admin_status))
        application.add_handler(conv_handler)
        application.add_handler(CommandHandler("list_cars", list_cars))
        application.add_handler(CommandHandler("delete_car", delete_car))
        application.add_handler(CommandHandler("edit_car", edit_car))
        application.add_handler(CommandHandler("cancel", cancel))
        
        # Обработчик ошибок
        application.add_error_handler(error_handler)
        
        print("✅ Приложение создано")
        print("🔄 Запуск polling...")
        print("📱 Отправьте /start боту в Telegram")
        print("=" * 60 + "\n")
        
        # Запускаем бота
        application.run_polling(
            drop_pending_updates=True,
            allowed_updates=None
        )
        
    except Exception as e:
        logger.error(f"❌ Ошибка запуска бота: {e}")
        print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА:")
        import traceback
        traceback.print_exc()
        sys.exit(1)

# ========== ТОЧКА ВХОДА ==========
if __name__ == "__main__":
    print("🔧 Прямой запуск бота...")
    start_bot()
