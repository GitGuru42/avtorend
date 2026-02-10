"""
telegram_bot.py - Telegram бот для AvtoRend (продакшен версия)
Только Cloudinary хранилище, без локального сохранения
"""

import os
import logging
import sys
from datetime import datetime
from pathlib import Path
import html

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
print("🤖 TELEGRAM BOT - AvtoRend Админ Панель (PRODUCTION)")
print("=" * 60)

# ========== ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ==========
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ .env файл загружен")
except ImportError:
    print("⚠️  python-dotenv не установлен, используем системные переменные")

# ========== ПРОВЕРКА КЛЮЧЕЙ CLOUDINARY (ОБЯЗАТЕЛЬНО) ==========
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
    print("❌ ОШИБКА: Cloudinary ключи не настроены!")
    print("ℹ️  Настройте в Environment Variables на Render:")
    print("    CLOUDINARY_CLOUD_NAME")
    print("    CLOUDINARY_API_KEY")
    print("    CLOUDINARY_API_SECRET")
    sys.exit(1)

print(f"☁️  Cloudinary: {CLOUDINARY_CLOUD_NAME}")
print(f"🔑 API Key: {CLOUDINARY_API_KEY[:8]}...")

# ========== КОНФИГУРАЦИЯ ==========
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_IDS = list(map(int, os.getenv("TELEGRAM_ADMIN_IDS", "").split(","))) if os.getenv("TELEGRAM_ADMIN_IDS") else []

if not TOKEN:
    logger.error("❌ TELEGRAM_BOT_TOKEN не найден!")
    print("❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!")
    sys.exit(1)

print(f"🔐 Токен: {TOKEN[:15]}...")
print(f"👑 Админов: {len(ADMIN_IDS) if ADMIN_IDS else 'не настроено'}")

# ========== ИНИЦИАЛИЗАЦИЯ CLOUDINARY ==========
try:
    import cloudinary
    import cloudinary.uploader
    import cloudinary.api
    
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    
    # Проверка конфигурации Cloudinary
    print("=" * 60)
    print("🔍 Cloudinary Configuration Check:")
    print(f"   CLOUDINARY_CLOUD_NAME env: '{CLOUDINARY_CLOUD_NAME}'")
    print(f"   cloudinary.config().cloud_name: '{cloudinary.config().cloud_name}'")
    print("=" * 60)
    
    # Проверяем подключение к Cloudinary
    cloudinary.api.ping()
    print("✅ Cloudinary подключен и работает")
    
except ImportError:
    print("❌ Cloudinary не установлен. Установите: pip install cloudinary")
    sys.exit(1)
except Exception as e:
    print(f"❌ Ошибка подключения к Cloudinary: {e}")
    sys.exit(1)

# ========== ИМПОРТЫ БАЗЫ ДАННЫХ ==========
try:
    from api.models import Car, Category, CarStatus, TransmissionType
    from api.database import SessionLocal
    from api.schemas import CarCreate
    print("✅ Модули БД импортированы")
except ImportError as e:
    print(f"❌ Ошибка импорта БД: {e}")
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

# ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
def escape_markdown(text: str) -> str:
    """Экранирует специальные символы Markdown"""
    if not text:
        return text
    # Экранируем символы, которые могут сломать Markdown
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    for char in escape_chars:
        text = text.replace(char, f'\\{char}')
    return text

# ========== ОТЛАДОЧНАЯ КОМАНДА ==========
async def debug(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отладочная команда - показывает информацию"""
    user_id = update.effective_user.id
    username = update.effective_user.username or "без username"
    
    await update.message.reply_text(
        f"🔧 *Отладка бота*\n\n"
        f"👤 Ваш ID: `{user_id}`\n"
        f"📛 Username: @{username}\n"
        f"📋 ADMIN_IDS: `{ADMIN_IDS}`\n"
        f"🔍 В списке админов: **{'✅ ДА' if user_id in ADMIN_IDS else '❌ НЕТ'}**\n\n"
        f"☁️  Cloudinary: {CLOUDINARY_CLOUD_NAME}\n"
        f"📦 Хранилище: **ТОЛЬКО CLOUDINARY**\n\n"
        f"📋 *Тестируйте команды:*\n"
        f"• `/list_cars` - список авто\n"
        f"• `/add_car` - добавить авто\n"
        f"• `/status` - статус системы\n"
        f"• `/check_photos` - проверить фото в БД",
        parse_mode='Markdown'
    )

# ========== ОСНОВНЫЕ КОМАНДЫ ==========
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start - панель администратора"""
    await update.message.reply_text(
        "🚗 *Админ-панель AvtoRend (PRODUCTION)*\n\n"
        "📋 *Доступные команды:*\n"
        "`/add_car` - Добавить новую машину\n"
        "`/list_cars` - Показать все машины\n"
        "`/edit_car <id> <поле> <значение>` - Редактировать\n"
        "`/delete_car <id>` - Удалить машину\n"
        "`/status` - Статус системы\n"
        "`/debug` - Отладка\n"
        "`/check_photos` - Проверить фото в БД\n"
        "`/cancel` - Отменить операцию\n\n"
        "☁️  *Хранилище фото:* Cloudinary\n\n"
        "🔧 *Примеры:*\n"
        "`/delete_car 1`\n"
        "`/edit_car 1 daily_price 3000`",
        parse_mode='Markdown'
    )

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
        f"📊 *Статус системы (PRODUCTION)*\n\n"
        f"🤖 Бот: ✅ Работает\n"
        f"🗄️  База данных: {db_status}\n"
        f"🚗 Автомобилей: {cars_count}\n"
        f"📂 Категорий: {categories_count}\n"
        f"👑 Админов: {len(ADMIN_IDS)}\n"
        f"☁️  Хранилище фото: **Cloudinary**\n"
        f"🌐 Хостинг: {'Render' if os.getenv('RENDER') else 'Локальный'}\n\n"
        f"🟢 Система функционирует нормально"
    )
    
    await update.message.reply_text(status_text, parse_mode='Markdown')

# ========== КОМАНДА ПРОВЕРКИ ФОТО ==========
async def check_photos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Проверить пути к фото в БД"""
    try:
        db = SessionLocal()
        cars = db.query(Car).order_by(Car.id).all()
        
        if not cars:
            await update.message.reply_text("🚫 В базе нет автомобилей.")
            db.close()
            return
        
        for car in cars:
            photos_info = []
            for i, img in enumerate(car.images or []):
                if 'cloudinary.com' in img:
                    photos_info.append(f"✅ Cloudinary {i+1}")
                elif '/static/uploads/' in img:
                    photos_info.append(f"❌ Локальный {i+1}")
                elif img.startswith('http'):
                    photos_info.append(f"🌐 Другой URL {i+1}")
                else:
                    photos_info.append(f"❓ Неизвестный {i+1}")
            
            sample_url = car.images[0][:100] + "..." if car.images and len(car.images[0]) > 100 else car.images[0] if car.images else "Нет фото"
            
            await update.message.reply_text(
                f"🚗 *{car.brand} {car.model} (ID: {car.id})*\n"
                f"📸 Фото: {len(car.images)} шт. - {', '.join(photos_info) if photos_info else 'Нет'}\n"
                f"🔗 Пример: `{sample_url}`",
                parse_mode='Markdown'
            )
        
        db.close()
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка проверки фото: {str(e)[:200]}")

# ========== ДОБАВЛЕНИЕ АВТОМОБИЛЯ ==========
async def add_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начать процесс добавления машины"""
    user_id = update.effective_user.id
    user_data_store[user_id] = {"photos": []}
    
    await update.message.reply_text(
        "🚗 *Добавление нового автомобиля (Cloudinary)*\n\n"
        "Введите марку автомобиля (например: Toyota):",
        parse_mode='Markdown'
    )
    return BRAND

async def process_brand(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка марки"""
    user_id = update.effective_user.id
    user_data_store[user_id]["brand"] = update.message.text
    
    await update.message.reply_text("Введите модель (например: Camry):")
    return MODEL

async def process_model(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка модели"""
    user_id = update.effective_user.id
    user_data_store[user_id]["model"] = update.message.text
    
    await update.message.reply_text("Введите год выпуска (например: 2023):")
    return YEAR

async def process_year(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка года"""
    try:
        year = int(update.message.text)
        if year < 1900 or year > datetime.now().year + 1:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректный год (например: 2023):")
        return YEAR
    
    user_id = update.effective_user.id
    user_data_store[user_id]["year"] = year
    
    await update.message.reply_text("Введите номерной знак (например: A123BC):")
    return LICENSE_PLATE

async def process_license_plate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка номера"""
    user_id = update.effective_user.id
    user_data_store[user_id]["license_plate"] = update.message.text.upper()
    
    # Показываем доступные категории
    try:
        db = SessionLocal()
        categories = db.query(Category).filter(Category.is_active == True).all()
        db.close()
        
        if not categories:
            await update.message.reply_text("❌ Нет доступных категорий.")
            return ConversationHandler.END
        
        keyboard = []
        for category in categories:
            keyboard.append([InlineKeyboardButton(
                f"{category.name} (ID: {category.id})", 
                callback_data=f"cat_{category.id}"
            )])
        
        await update.message.reply_text(
            "📂 Выберите категорию автомобиля:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return CATEGORY_ID
    except Exception as e:
        logger.error(f"Ошибка при получении категорий: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке категорий.")
        return ConversationHandler.END

async def process_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка выбора категории"""
    query = update.callback_query
    await query.answer()
    
    category_id = int(query.data.split("_")[1])
    user_id = query.from_user.id
    user_data_store[user_id]["category_id"] = category_id
    
    try:
        db = SessionLocal()
        category = db.query(Category).filter(Category.id == category_id).first()
        db.close()
        
        category_name = category.name if category else f"ID: {category_id}"
        await query.edit_message_text(f"✅ Категория: {category_name}\n\nВведите объем двигателя в литрах (например: 2.0):")
        return ENGINE_CAPACITY
    except Exception as e:
        await query.edit_message_text("❌ Ошибка при загрузке категории.")
        return ConversationHandler.END

async def process_engine_capacity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка объема двигателя"""
    try:
        capacity = float(update.message.text.replace(",", "."))
        if capacity <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректный объем (например: 2.0):")
        return ENGINE_CAPACITY
    
    user_id = update.effective_user.id
    user_data_store[user_id]["engine_capacity"] = capacity
    
    await update.message.reply_text("Введите мощность в л.с. (например: 150):")
    return HORSEPOWER

async def process_horsepower(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка мощности"""
    try:
        hp = int(update.message.text)
        if hp <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректную мощность (например: 150):")
        return HORSEPOWER
    
    user_id = update.effective_user.id
    user_data_store[user_id]["horsepower"] = hp
    
    await update.message.reply_text("Введите тип топлива (бензин, дизель, электрокар, гибрид):")
    return FUEL_TYPE

async def process_fuel_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка типа топлива"""
    user_id = update.effective_user.id
    user_data_store[user_id]["fuel_type"] = update.message.text
    
    keyboard = [
        [InlineKeyboardButton("Автомат", callback_data="trans_automatic")],
        [InlineKeyboardButton("Механика", callback_data="trans_manual")],
        [InlineKeyboardButton("Вариатор", callback_data="trans_cvt")],
        [InlineKeyboardButton("Робот", callback_data="trans_semi_automatic")],
    ]
    
    await update.message.reply_text(
        "Выберите тип трансмиссии:",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )
    return TRANSMISSION

async def process_transmission(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка трансмиссии"""
    query = update.callback_query
    await query.answer()
    
    trans_map = {
        "trans_automatic": TransmissionType.AUTOMATIC,
        "trans_manual": TransmissionType.MANUAL,
        "trans_cvt": TransmissionType.CVT,
        "trans_semi_automatic": TransmissionType.SEMI_AUTOMATIC,
    }
    
    user_id = query.from_user.id
    user_data_store[user_id]["transmission"] = trans_map[query.data]
    
    await query.edit_message_text(f"✅ Трансмиссия: {trans_map[query.data].value}\n\nВведите расход топлива (л/100км, например: 8.5):")
    return FUEL_CONSUMPTION

async def process_fuel_consumption(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка расхода"""
    try:
        consumption = float(update.message.text.replace(",", "."))
        if consumption <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректный расход (например: 8.5):")
        return FUEL_CONSUMPTION
    
    user_id = update.effective_user.id
    user_data_store[user_id]["fuel_consumption"] = consumption
    
    await update.message.reply_text("Введите количество дверей (например: 4):")
    return DOORS

async def process_doors(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка количества дверей"""
    try:
        doors = int(update.message.text)
        if doors <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректное количество дверей (например: 4):")
        return DOORS
    
    user_id = update.effective_user.id
    user_data_store[user_id]["doors"] = doors
    
    await update.message.reply_text("Введите количество мест (например: 5):")
    return SEATS

async def process_seats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка количества мест"""
    try:
        seats = int(update.message.text)
        if seats <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректное количество мест (например: 5):")
        return SEATS
    
    user_id = update.effective_user.id
    user_data_store[user_id]["seats"] = seats
    
    await update.message.reply_text("Введите цвет автомобиля (например: Черный):")
    return COLOR

async def process_color(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка цвета"""
    user_id = update.effective_user.id
    user_data_store[user_id]["color"] = update.message.text
    
    await update.message.reply_text("Введите цену за день (например: 2500):")
    return DAILY_PRICE

async def process_daily_price(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка цены"""
    try:
        price = float(update.message.text.replace(",", "."))
        if price <= 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректную цену (например: 2500):")
        return DAILY_PRICE
    
    user_id = update.effective_user.id
    user_data_store[user_id]["daily_price"] = price
    
    await update.message.reply_text("Введите сумму залога (например: 10000):")
    return DEPOSIT

async def process_deposit(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка залога"""
    try:
        deposit = float(update.message.text.replace(",", "."))
        if deposit < 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректную сумму залога (например: 10000):")
        return DEPOSIT
    
    user_id = update.effective_user.id
    user_data_store[user_id]["deposit"] = deposit
    
    await update.message.reply_text("Введите текущий пробег в км (например: 15000):")
    return MILEAGE

async def process_mileage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка пробега"""
    try:
        mileage = int(update.message.text)
        if mileage < 0:
            raise ValueError
    except ValueError:
        await update.message.reply_text("Пожалуйста, введите корректный пробег (например: 15000):")
        return MILEAGE
    
    user_id = update.effective_user.id
    user_data_store[user_id]["mileage"] = mileage
    
    await update.message.reply_text(
        "Введите опции через запятую (например: кондиционер, подогрев сидений):\n"
        "Или отправьте 'нет', если опций нет:"
    )
    return FEATURES

async def process_features(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка опций"""
    user_id = update.effective_user.id
    text = update.message.text.strip()
    
    if text.lower() == 'нет':
        features = []
    else:
        features = [f.strip() for f in text.split(",")]
    
    user_data_store[user_id]["features"] = features
    
    await update.message.reply_text("Введите описание автомобиля (или отправьте 'нет' для пропуска):")
    return DESCRIPTION

async def process_description(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка описания"""
    user_id = update.effective_user.id
    text = update.message.text.strip()
    
    if text.lower() == 'нет':
        description = None
    else:
        description = text
    
    user_data_store[user_id]["description"] = description
    
    await update.message.reply_text(
        "📸 *Отправьте фотографии автомобиля (можно несколько).*\n"
        "После загрузки всех фото отправьте команду /done\n"
        "Минимум 1 фото рекомендуется.\n\n"
        "☁️  *Фото будут сохранены в Cloudinary*",
        parse_mode='Markdown'
    )
    return PHOTOS

async def process_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка загрузки фото - ТОЛЬКО Cloudinary"""
    user_id = update.effective_user.id
    
    if "photos" not in user_data_store.get(user_id, {}):
        user_data_store[user_id] = {"photos": []}
    
    try:
        photo_file = await update.message.photo[-1].get_file()
        
        # Создаем временный файл
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        temp_filename = f"temp_{user_id}_{timestamp}.jpg"
        
        # Создаем временную директорию
        temp_dir = Path("temp_uploads")
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / temp_filename
        
        # Скачиваем фото
        await photo_file.download_to_drive(temp_path)
        
        # Получаем car_id для папки в Cloudinary
        car_id = user_data_store[user_id].get("temp_car_id", 0)
        if car_id == 0:
            # Генерируем временный ID для папки в Cloudinary
            car_id = int(datetime.now().timestamp()) % 1000000
            user_data_store[user_id]["temp_car_id"] = car_id
        
        # ========== ЗАГРУЗКА В CLOUDINARY ==========
        try:
            # ✅ ВАЖНО: Используем правильный формат public_id с расширением
            photo_index = len(user_data_store[user_id]['photos']) + 1
            public_id = f"avtorend/car_{car_id}/photo_{timestamp}_{photo_index}"
            
            print(f"🔍 Загрузка в Cloudinary...")
            print(f"   Public ID: {public_id}")
            print(f"   Файл: {temp_path}")
            print(f"   Размер: {temp_path.stat().st_size} байт")
            
            # Загружаем фото в Cloudinary с правильными параметрами
            result = cloudinary.uploader.upload(
                str(temp_path),
                public_id=public_id,
                overwrite=False,
                resource_type="image",
                timeout=30
            )
            
            cloudinary_url = result.get('secure_url')
            
            if not cloudinary_url:
                raise ValueError("Cloudinary не вернул URL")
            
            # Проверяем URL
            print(f"✅ Cloudinary загрузка успешна!")
            print(f"   Public ID: {result.get('public_id')}")
            print(f"   Secure URL: {cloudinary_url[:100]}...")
            print(f"   Содержит 'res.cloudinary.com': {'✅ Да' if 'res.cloudinary.com' in cloudinary_url else '❌ Нет'}")
            
            # ✅ Сохраняем Cloudinary URL
            user_data_store[user_id]["photos"].append(cloudinary_url)
            print(f"✅ URL добавлен. Всего фото: {len(user_data_store[user_id]['photos'])}")
            
            # Удаляем временный файл
            if temp_path.exists():
                temp_path.unlink()
            
            await update.message.reply_text(
                f"✅ Фото загружено в Cloudinary!\n"
                f"📸 Загружено фото: {len(user_data_store[user_id]['photos'])}\n"
                f"Отправьте еще фото или /done для продолжения"
            )
            
            # Очищаем временную директорию если пуста
            try:
                if temp_dir.exists() and not any(temp_dir.iterdir()):
                    temp_dir.rmdir()
            except:
                pass
                
            return PHOTOS
            
        except Exception as cloudinary_error:
            logger.error(f"Ошибка Cloudinary: {cloudinary_error}")
            # Удаляем временный файл
            if temp_path.exists():
                temp_path.unlink()
            
            await update.message.reply_text(
                f"❌ Ошибка загрузки в Cloudinary: {str(cloudinary_error)[:100]}"
            )
            return PHOTOS
            
    except Exception as e:
        logger.error(f"Общая ошибка загрузки фото: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке фото. Попробуйте еще раз.")
        return PHOTOS

async def process_done_photos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Завершение загрузки фото"""
    user_id = update.effective_user.id
    
    if not user_data_store[user_id].get("photos"):
        await update.message.reply_text(
            "❌ Вы не загрузили ни одного фото!\n"
            "Пожалуйста, загрузите хотя бы одно фото:"
        )
        return PHOTOS
    
    # ✅ ОТЛАДКА: Проверяем, какие URLs у нас есть
    print("=" * 60)
    print("🔍 ОТЛАДКА: Фото перед сохранением в БД:")
    photos = user_data_store[user_id].get("photos", [])
    for i, photo_url in enumerate(photos):
        print(f"  Фото {i+1}: {photo_url}")
        print(f"    Тип: {'Cloudinary' if 'cloudinary.com' in photo_url else 'Локальный'}")
    print(f"  Всего фото: {len(photos)}")
    print("=" * 60)
    
    # Подтверждение данных
    data = user_data_store[user_id]
    
    summary = (
        f"📋 *Проверьте данные автомобиля:*\n\n"
        f"🚗 {data['brand']} {data['model']} ({data['year']})\n"
        f"📌 Номер: {data['license_plate']}\n"
        f"📂 Категория ID: {data['category_id']}\n"
        f"⚙️ Двигатель: {data['engine_capacity']}л, {data['horsepower']}л.с.\n"
        f"⛽ Топливо: {data['fuel_type']}, расход: {data['fuel_consumption']}л/100км\n"
        f"🔄 Трансмиссия: {data['transmission'].value}\n"
        f"🚪 Дверей: {data['doors']}, Мест: {data['seats']}\n"
        f"🎨 Цвет: {data['color']}\n"
        f"💰 Цена/день: {data['daily_price']} руб.\n"
        f"💵 Залог: {data['deposit']} руб.\n"
        f"📏 Пробег: {data['mileage']} км\n"
        f"📸 Фото в Cloudinary: {len(data['photos'])} шт.\n"
    )
    
    if data.get('features'):
        summary += f"🎯 Опции: {', '.join(data['features'])}\n"
    
    if data.get('description'):
        summary += f"📝 Описание: {data['description'][:100]}...\n"
    
    keyboard = [
        [InlineKeyboardButton("✅ Сохранить в БД", callback_data="confirm_save")],
        [InlineKeyboardButton("❌ Отменить", callback_data="confirm_cancel")]
    ]
    
    await update.message.reply_text(
        summary,
        reply_markup=InlineKeyboardMarkup(keyboard),
        parse_mode='Markdown'
    )
    return CONFIRM

async def process_confirmation(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка подтверждения"""
    query = update.callback_query
    await query.answer()
    
    user_id = query.from_user.id
    data = user_data_store[user_id]
    
    if query.data == "confirm_cancel":
        await query.edit_message_text("❌ Добавление автомобиля отменено.")
        user_data_store.pop(user_id, None)
        return ConversationHandler.END
    
    # ✅ КРИТИЧЕСКАЯ ОТЛАДКА: Что реально в данных
    print("=" * 60)
    print("🔍 КРИТИЧЕСКАЯ ПРОВЕРКА ДАННЫХ ПЕРЕД СОХРАНЕНИЕМ:")
    photos = data.get("photos", [])
    print(f"   Всего фото в данных пользователя: {len(photos)}")
    for i, url in enumerate(photos):
        print(f"   Фото {i+1}: {url}")
        print(f"      Тип: {'Cloudinary' if 'cloudinary.com' in url else 'Локальный'}")
    print("=" * 60)
    
    # Фильтруем только Cloudinary URLs
    cloudinary_photos = []
    for photo_url in photos:
        if 'res.cloudinary.com' in photo_url:
            cloudinary_photos.append(photo_url)
            print(f"✅ Cloudinary URL добавлен: {photo_url[:80]}...")
        else:
            print(f"❌ Пропущен не-Cloudinary URL: {photo_url}")
    
    print(f"✅ Итого Cloudinary фото: {len(cloudinary_photos)}")
    
    if not cloudinary_photos:
        await query.edit_message_text("❌ Нет Cloudinary фото для сохранения!")
        return ConversationHandler.END
    
    # Сохранение в БД
    try:
        db = SessionLocal()
        
        # ✅ ВАЖНО: Проверяем данные ПЕРЕД созданием схемы
        car_data = {
            "brand": data["brand"],
            "model": data["model"],
            "year": data["year"],
            "license_plate": data["license_plate"],
            "category_id": data["category_id"],
            "engine_capacity": data["engine_capacity"],
            "horsepower": data["horsepower"],
            "fuel_type": data["fuel_type"],
            "transmission": data["transmission"],
            "fuel_consumption": data["fuel_consumption"],
            "doors": data["doors"],
            "seats": data["seats"],
            "color": data["color"],
            "daily_price": data["daily_price"],
            "deposit": data["deposit"],
            "mileage": data["mileage"],
            "features": data.get("features", []),
            "images": cloudinary_photos,  # ✅ ТОЛЬКО Cloudinary URLs
            "thumbnail": cloudinary_photos[0] if cloudinary_photos else None,
            "description": data.get("description"),
            "status": CarStatus.AVAILABLE,
            "is_active": True
        }
        
        print(f"✅ Данные для CarCreate:")
        print(f"   images: {car_data['images']}")
        print(f"   thumbnail: {car_data['thumbnail']}")
        
        # ✅ ОТЛАДКА: Что происходит внутри CarCreate
        try:
            car_schema = CarCreate(**car_data)
            print(f"✅ CarCreate создана успешно")
            print(f"   images после валидации: {car_schema.images}")
        except Exception as e:
            print(f"❌ Ошибка в CarCreate: {e}")
            await query.edit_message_text(f"❌ Ошибка валидации: {str(e)[:200]}")
            db.close()
            return ConversationHandler.END
        
        # Создаем объект Car
        db_car = Car(**car_schema.model_dump())
        
        # ✅ ОТЛАДКА: Что в объекте Car перед сохранением
        print(f"✅ Объект Car перед сохранением:")
        print(f"   id: будет сгенерирован")
        print(f"   images в объекте: {db_car.images}")
        
        db.add(db_car)
        db.commit()
        db.refresh(db_car)
        
        # ✅ КРИТИЧЕСКАЯ ОТЛАДКА: Что реально сохранилось в БД
        print("=" * 60)
        print("🔍 ПРОВЕРКА СОХРАНЕННЫХ ДАННЫХ:")
        saved_car = db.query(Car).filter(Car.id == db_car.id).first()
        print(f"✅ Автомобиль сохранен с ID: {saved_car.id}")
        print(f"   Сохраненные фото: {len(saved_car.images) if saved_car.images else 0}")
        
        if saved_car.images:
            for i, img in enumerate(saved_car.images):
                print(f"   Фото {i+1}: {img}")
                print(f"      Это Cloudinary? {'✅ Да' if 'cloudinary.com' in img else '❌ НЕТ!'}")
        
        category = db.query(Category).filter(Category.id == db_car.category_id).first()
        db.close()
        
        # Отправляем сообщение пользователю
        if saved_car.images and 'cloudinary.com' in saved_car.images[0]:
            await query.edit_message_text(
                f"✅ *Автомобиль успешно добавлен!*\n\n"
                f"🆔 ID: {saved_car.id}\n"
                f"🚗 {saved_car.brand} {saved_car.model}\n"
                f"📸 Фото: {len(saved_car.images)} шт. ☁️\n"
                f"✅ Cloudinary URL сохранены правильно!",
                parse_mode='Markdown'
            )
        else:
            await query.edit_message_text(
                f"⚠️ *Автомобиль добавлен, но есть проблема!*\n\n"
                f"🆔 ID: {saved_car.id}\n"
                f"🚗 {saved_car.brand} {saved_car.model}\n"
                f"📸 Фото: {len(saved_car.images) if saved_car.images else 0} шт.\n"
                f"❌ Cloudinary URLs НЕ сохранены правильно!\n"
                f"   Первое фото: {saved_car.images[0][:50] if saved_car.images else 'Нет'}",
                parse_mode='Markdown'
            )
        
        # Очищаем временные данные
        user_data_store.pop(user_id, None)
        
    except Exception as e:
        logger.error(f"Ошибка сохранения автомобиля: {e}")
        import traceback
        traceback.print_exc()
        
        await query.edit_message_text(
            f"❌ Ошибка при сохранении в БД:\n\n"
            f"```{str(e)[:200]}```",
            parse_mode='Markdown'
        )
    
    return ConversationHandler.END

# ========== СПИСОК АВТОМОБИЛЕЙ ==========
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
            # car.status — это Enum из api.models.CarStatus (значения регистрозависимы)
            status_icons = {
                "AVAILABLE": "✅",
                "UNAVAILABLE": "⛔",
            }
            icon = status_icons.get(getattr(car.status, "value", str(car.status)), "❓")
            
            # Проверяем тип фото
            photo_type = "☁️" if car.images and 'cloudinary.com' in car.images[0] else "💾" if car.images else "❌"
            
            message += (
                f"{icon} *ID: {car.id}*\n"
                f"   {car.brand} {car.model} ({car.year})\n"
                f"   Номер: {car.license_plate}\n"
                f"   Цена: {car.daily_price} руб./день\n"
                f"   Фото: {len(car.images)} шт. {photo_type}\n\n"
            )
        
        if len(cars) > 10:
            message += f"... и еще {len(cars) - 10} автомобилей\n"
        
        message += f"Всего: *{len(cars)}* автомобилей\n"
        message += f"☁️ = Cloudinary, 💾 = Локальные, ❌ = Нет фото"
        
        await update.message.reply_text(message, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Ошибка при получении списка автомобилей: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке списка автомобилей.")

# ========== УДАЛЕНИЕ АВТОМОБИЛЯ ==========
async def delete_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Удалить машину по ID и фото из Cloudinary"""
    if not context.args:
        await update.message.reply_text("Используйте: /delete_car <ID автомобиля>\nПример: `/delete_car 1`", parse_mode='Markdown')
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
        
        # Удаляем фото из Cloudinary (только если это Cloudinary URLs)
        deleted_count = 0
        cloudinary_count = 0
        
        for image_url in car.images:
            if "res.cloudinary.com" in image_url:
                cloudinary_count += 1
                try:
                    # Извлекаем public_id из URL
                    # Пример URL: https://res.cloudinary.com/daxfsz15l/image/upload/v1766578214/avtorend/car_123/photo_123.jpg
                    parts = image_url.split('/')
                    
                    # Ищем index после 'upload'
                    try:
                        upload_index = parts.index('upload')
                        # public_id - это все после 'upload/v1234567890/'
                        if upload_index + 2 < len(parts):
                            public_id_parts = parts[upload_index + 2:]  # Пропускаем 'upload' и версию 'v1234567890'
                            public_id = '/'.join(public_id_parts)
                            # Убираем расширение файла
                            public_id = public_id.rsplit('.', 1)[0]
                            
                            print(f"🔍 Удаление из Cloudinary: public_id={public_id}")
                            
                            # Удаляем из Cloudinary
                            result = cloudinary.uploader.destroy(public_id)
                            if result.get('result') == 'ok':
                                deleted_count += 1
                                logger.info(f"Удалено из Cloudinary: {public_id}")
                            else:
                                logger.warning(f"Не удалось удалить из Cloudinary: {public_id}")
                    except ValueError:
                        logger.warning(f"Не найден 'upload' в URL: {image_url}")
                            
                except Exception as e:
                    logger.error(f"Ошибка удаления фото из Cloudinary: {e}")
        
        # Удаляем запись из БД
        db.delete(car)
        db.commit()
        db.close()
        
        await update.message.reply_text(
            f"✅ *Автомобиль удален*\n\n"
            f"🚗 {car.brand} {car.model}\n"
            f"🆔 ID: {car.id}\n"
            f"📌 Номер: {car.license_plate}\n"
            f"📸 Cloudinary фото: {cloudinary_count} шт.\n"
            f"🗑️  Удалено из Cloudinary: {deleted_count} шт.",
            parse_mode='Markdown'
        )
    except Exception as e:
        logger.error(f"Ошибка удаления автомобиля: {e}")
        await update.message.reply_text(f"❌ Ошибка при удалении автомобиля: {e}")

# ========== РЕДАКТИРОВАНИЕ АВТОМОБИЛЯ ==========
async def edit_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Редактировать машину по ID"""
    if not context.args:
        await update.message.reply_text(
            "*Используйте:* /edit_car <id> <поле> <значение>\n\n"
            "*Доступные поля:*\n"
            "• `daily_price` - цена за день\n"
            "• `deposit` - залог\n" 
            "• `status` - статус (AVAILABLE, UNAVAILABLE)\n"
            "• `mileage` - пробег\n"
            "• `description` - описание\n\n"
            "*Пример:*\n"
            "`/edit_car 1 daily_price 3000`\n"
            "`/edit_car 1 status UNAVAILABLE`",
            parse_mode='Markdown'
        )
        return
    
    if len(context.args) < 3:
        await update.message.reply_text(
            "Недостаточно аргументов. Формат:\n"
            "`/edit_car <id> <поле> <значение>`",
            parse_mode='Markdown'
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
            # Разрешаем вводить статус в любом регистре: available/AVAILABLE
            normalized = value.strip().upper()
            allowed = [s.value for s in CarStatus]
            if normalized in allowed:
                car.status = CarStatus(normalized)
            else:
                await update.message.reply_text(
                    f"❌ Неверный статус. Допустимые: {', '.join(allowed)}"
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
    print("🚀 ЗАПУСК ТЕЛЕГРАМ БОТА (PRODUCTION)")
    print("=" * 60)
    print(f"☁️  Cloudinary: {CLOUDINARY_CLOUD_NAME}")
    print(f"🔐 Хранилище: ТОЛЬКО CLOUDINARY")
    print("=" * 60)
    
    try:
        # Создаем приложение
        application = Application.builder().token(TOKEN).build()
        
        # 1. РЕГИСТРИРУЕМ ОБЫЧНЫЕ КОМАНДЫ ПЕРВЫМИ
        application.add_handler(CommandHandler("debug", debug))
        application.add_handler(CommandHandler("start", start))
        application.add_handler(CommandHandler("status", admin_status))
        application.add_handler(CommandHandler("list_cars", list_cars))
        application.add_handler(CommandHandler("delete_car", delete_car))
        application.add_handler(CommandHandler("edit_car", edit_car))
        application.add_handler(CommandHandler("check_photos", check_photos))
        application.add_handler(CommandHandler("cancel", cancel))
        
        # 2. ПОТОМ ConversationHandler (важно - ПОСЛЕ обычных команд!)
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
        
        application.add_handler(conv_handler)
        
        # Обработчик ошибок
        application.add_error_handler(error_handler)
        
        print("✅ Приложение создано")
        print("✅ Зарегистрированы команды:")
        print("   • /debug - отладка")
        print("   • /start - начало работы")
        print("   • /status - статус системы")
        print("   • /list_cars - список авто")
        print("   • /delete_car <id> - удалить авто")
        print("   • /edit_car <id> <поле> <значение> - редактировать")
        print("   • /check_photos - проверить фото в БД")
        print("   • /add_car - добавить авто")
        print("   • /cancel - отмена")
        print("\n🔄 Запуск polling...")
        print("📱 Отправьте /debug боту для проверки")
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
    print("🔧 Прямой запуск бота (production)...")
    start_bot()
