import sys
import os
import logging
from typing import List, Optional
from datetime import datetime
from pathlib import Path

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, ContextTypes, filters
)
from sqlalchemy.orm import Session
from PIL import Image

# ✅ ИСПРАВЛЕНО: правильные импорты для Render
# Убираем sys.path.append - используем относительные импорты
try:
    # Для локальной разработки
    from api.models import Car, Category, CarStatus, TransmissionType
    from api.database import SessionLocal
    from api.schemas import CarCreate
except ImportError:
    # Для Render или если структура другая
    try:
        from models import Car, Category, CarStatus, TransmissionType
        from database import SessionLocal
        from schemas import CarCreate
    except ImportError as e:
        logging.error(f"❌ Ошибка импорта: {e}")
        raise

from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_IDS = list(map(int, os.getenv("TELEGRAM_ADMIN_IDS", "").split(","))) if os.getenv("TELEGRAM_ADMIN_IDS") else []

# ✅ ИСПРАВЛЕНО: Путь для загрузки изображений на Render
# На Render используем абсолютный путь внутри контейнера
if os.getenv("RENDER"):
    # На Render
    UPLOAD_DIR = Path("/opt/render/project/src/static/uploads/cars")
else:
    # Локально
    UPLOAD_DIR = Path("static/uploads/cars")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Состояния для ConversationHandler
(
    BRAND, MODEL, YEAR, LICENSE_PLATE, CATEGORY_ID, 
    ENGINE_CAPACITY, HORSEPOWER, FUEL_TYPE, TRANSMISSION,
    FUEL_CONSUMPTION, DOORS, SEATS, COLOR, DAILY_PRICE,
    DEPOSIT, MILEAGE, FEATURES, DESCRIPTION, PHOTOS, CONFIRM
) = range(20)

# Временное хранилище данных при добавлении машины
user_data_store = {}

def admin_only(func):
    """Декоратор для ограничения доступа только администраторам"""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        user_id = update.effective_user.id
        if not ADMIN_IDS:
            await update.message.reply_text("⚠️ ADMIN_IDS не настроены в .env файле")
            return
        if user_id not in ADMIN_IDS:
            await update.message.reply_text("⛔ У вас нет прав для выполнения этой команды.")
            return
        return await func(update, context, *args, **kwargs)
    return wrapper

@admin_only
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    await update.message.reply_text(
        "🚗 Добро пожаловать в панель управления автопарком!\n\n"
        "Доступные команды:\n"
        "/add_car - Добавить новую машину\n"
        "/edit_car <id> - Редактировать машину (укажите ID)\n"
        "/delete_car <id> - Удалить машину (укажите ID)\n"
        "/list_cars - Показать все машины\n"
        "/cancel - Отменить текущую операцию"
    )

@admin_only
async def add_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начать процесс добавления машины"""
    user_id = update.effective_user.id
    user_data_store[user_id] = {"photos": []}
    
    await update.message.reply_text(
        "Давайте добавим новую машину.\n"
        "Введите марку автомобиля (например: Toyota):"
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
            await update.message.reply_text("Нет доступных категорий. Сначала создайте категории через админку.")
            return ConversationHandler.END
        
        keyboard = []
        for category in categories:
            keyboard.append([InlineKeyboardButton(
                f"{category.name} (ID: {category.id})", 
                callback_data=f"cat_{category.id}"
            )])
        
        await update.message.reply_text(
            "Выберите категорию автомобиля:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return CATEGORY_ID
    except Exception as e:
        logger.error(f"Ошибка при получении категорий: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке категорий. Попробуйте позже.")
        return ConversationHandler.END

async def process_category(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка выбора категории"""
    query = update.callback_query
    await query.answer()
    
    category_id = int(query.data.split("_")[1])
    user_id = query.from_user.id
    user_data_store[user_id]["category_id"] = category_id
    
    # Получаем название категории для отображения
    try:
        db = SessionLocal()
        category = db.query(Category).filter(Category.id == category_id).first()
        db.close()
        
        category_name = category.name if category else f"ID: {category_id}"
        await query.edit_message_text(f"Категория выбрана: {category_name}\n\n"
                                      "Введите объем двигателя в литрах (например: 2.0):")
        return ENGINE_CAPACITY
    except Exception as e:
        logger.error(f"Ошибка при получении категории: {e}")
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
    
    await query.edit_message_text(f"Трансмиссия: {trans_map[query.data].value}\n\n"
                                  "Введите расход топлива (л/100км, например: 8.5):")
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
        "Введите опции через запятую (например: кондиционер, подогрев сидений, парктроники):\n"
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
        "Отправьте фотографии автомобиля (можно несколько).\n"
        "После загрузки всех фото отправьте команду /done\n"
        "Минимум 1 фото рекомендуется."
    )
    return PHOTOS

async def process_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка загрузки фото"""
    user_id = update.effective_user.id
    
    if "photos" not in user_data_store[user_id]:
        user_data_store[user_id]["photos"] = []
    
    try:
        photo_file = await update.message.photo[-1].get_file()
        
        # Генерируем уникальное имя файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"car_{timestamp}_{len(user_data_store[user_id]['photos'])}.jpg"
        filepath = UPLOAD_DIR / filename
        
        # Сохраняем фото
        await photo_file.download_to_drive(filepath)
        
        # Оптимизируем изображение
        try:
            img = Image.open(filepath)
            if img.height > 1080 or img.width > 1920:
                img.thumbnail((1920, 1080))
                img.save(filepath, "JPEG", quality=85)
        except Exception as e:
            logger.error(f"Ошибка оптимизации изображения: {e}")
        
        # ✅ ИСПРАВЛЕНО: Сохраняем путь для web-доступа
        # На Render статика доступна через /static/
        web_path = f"/static/uploads/cars/{filename}"
        user_data_store[user_id]["photos"].append(web_path)
        
        await update.message.reply_text(f"✅ Фото сохранено! Загружено фото: {len(user_data_store[user_id]['photos'])}\n"
                                        "Отправьте еще фото или /done для продолжения")
        return PHOTOS
    except Exception as e:
        logger.error(f"Ошибка загрузки фото: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке фото. Попробуйте еще раз.")
        return PHOTOS

async def process_done_photos(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Завершение загрузки фото"""
    user_id = update.effective_user.id
    
    if not user_data_store[user_id].get("photos"):
        await update.message.reply_text("Вы не загрузили ни одного фото. Пожалуйста, загрузите хотя бы одно фото:")
        return PHOTOS
    
    # Подтверждение данных
    data = user_data_store[user_id]
    
    summary = (
        f"📋 Проверьте данные автомобиля:\n\n"
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
        f"📸 Фото: {len(data['photos'])} шт.\n"
    )
    
    if data.get('features'):
        summary += f"🎯 Опции: {', '.join(data['features'])}\n"
    
    if data.get('description'):
        summary += f"📝 Описание: {data['description'][:100]}...\n"
    
    keyboard = [
        [InlineKeyboardButton("✅ Сохранить", callback_data="confirm_save")],
        [InlineKeyboardButton("❌ Отменить", callback_data="confirm_cancel")]
    ]
    
    await update.message.reply_text(
        summary,
        reply_markup=InlineKeyboardMarkup(keyboard)
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
    
    # Сохранение в БД
    try:
        db = SessionLocal()
        
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
            "images": data.get("photos", []),  # Теперь здесь правильные пути
            "thumbnail": data.get("photos", [""])[0] if data.get("photos") else None,
            "description": data.get("description"),
            "status": CarStatus.AVAILABLE,
            "is_active": True
        }
        
        # Используем Pydantic схему для валидации
        car_schema = CarCreate(**car_data)
        
        # Создаем объект Car
        db_car = Car(**car_schema.model_dump())
        db.add(db_car)
        db.commit()
        db.refresh(db_car)
        
        # Получаем категорию для отображения
        category = db.query(Category).filter(Category.id == db_car.category_id).first()
        db.close()
        
        # Отправляем подтверждение
        await query.edit_message_text(
            f"✅ Автомобиль успешно добавлен!\n"
            f"ID: {db_car.id}\n"
            f"Марка: {db_car.brand} {db_car.model}\n"
            f"Категория: {category.name if category else 'Неизвестно'}\n"
            f"Номер: {db_car.license_plate}\n"
            f"Цена: {db_car.daily_price} руб./день"
        )
        
        # Очищаем временные данные
        user_data_store.pop(user_id, None)
        
    except Exception as e:
        logger.error(f"Ошибка сохранения автомобиля: {e}")
        await query.edit_message_text(f"❌ Ошибка при сохранении: {str(e)}")
    
    return ConversationHandler.END

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
        
        message = "📋 Список автомобилей:\n\n"
        for car in cars:
            status_icons = {
                "available": "✅",
                "rented": "🔴",
                "maintenance": "🔧",
                "reserved": "🟡",
                "unavailable": "⛔"
            }
            icon = status_icons.get(car.status.value, "❓")
            
            message += (
                f"{icon} ID: {car.id}\n"
                f"   {car.brand} {car.model} ({car.year})\n"
                f"   Номер: {car.license_plate}\n"
                f"   Цена: {car.daily_price} руб./день\n"
                f"   Статус: {car.status.value}\n"
                f"   ---\n"
            )
        
        # Разбиваем сообщение если слишком длинное
        if len(message) > 4000:
            parts = [message[i:i+4000] for i in range(0, len(message), 4000)]
            for part in parts:
                await update.message.reply_text(part)
        else:
            await update.message.reply_text(message)
    except Exception as e:
        logger.error(f"Ошибка при получении списка автомобилей: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке списка автомобилей.")

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
                # Преобразуем web-путь в локальный
                if image_path.startswith('/static/'):
                    local_path = image_path[8:]  # Убираем '/static/'
                    file_path = Path("static") / local_path
                else:
                    file_path = Path("static/uploads/cars") / Path(image_path).name
                
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"Удален файл: {file_path}")
            except Exception as e:
                logger.error(f"Ошибка удаления изображения {image_path}: {e}")
        
        db.delete(car)
        db.commit()
        db.close()
        
        await update.message.reply_text(f"✅ Автомобиль {car.brand} {car.model} (ID: {car.id}) удален")
    except Exception as e:
        logger.error(f"Ошибка удаления автомобиля: {e}")
        await update.message.reply_text(f"❌ Ошибка при удалении автомобиля: {e}")

@admin_only
async def edit_car(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Редактировать машину по ID"""
    if not context.args:
        await update.message.reply_text("Используйте: /edit_car <ID автомобиля>")
        await update.message.reply_text(
            "Доступные поля для редактирования:\n"
            "daily_price, deposit, status, mileage, description\n"
            "Пример: /edit_car 15 daily_price 3000"
        )
        return
    
    if len(context.args) < 3:
        await update.message.reply_text(
            "Недостаточно аргументов. Формат:\n"
            "/edit_car <id> <поле> <значение>\n"
            "Пример: /edit_car 15 daily_price 3000"
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
                    f"Неверный статус. Допустимые значения: {', '.join([s.value for s in CarStatus])}"
                )
                db.close()
                return
        elif field == "description":
            car.description = value
        else:
            await update.message.reply_text(
                f"Поле '{field}' недоступно для редактирования через бота"
            )
            db.close()
            return
        
        db.commit()
        await update.message.reply_text(
            f"✅ Автомобиль ID: {car_id} обновлен\n"
            f"Поле '{field}' изменено на '{value}'"
        )
        
    except ValueError as e:
        await update.message.reply_text(f"Неверное значение для поля {field}: {e}")
    except Exception as e:
        logger.error(f"Ошибка редактирования автомобиля: {e}")
        await update.message.reply_text(f"❌ Ошибка при редактировании: {e}")
    finally:
        try:
            db.close()
        except:
            pass

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отмена текущей операции"""
    user_id = update.effective_user.id
    user_data_store.pop(user_id, None)
    await update.message.reply_text("Операция отменена.")
    return ConversationHandler.END

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик ошибок"""
    logger.error(f"Update {update} вызвал ошибку {context.error}")
    if update and update.message:
        await update.message.reply_text("Произошла ошибка. Попробуйте еще раз.")

def main():
    """Запуск бота"""
    if not TOKEN:
        logger.error("❌ TELEGRAM_BOT_TOKEN не установлен в .env файле")
        print("❌ TELEGRAM_BOT_TOKEN не установлен. Проверьте .env файл")
        return
    
    if not ADMIN_IDS:
        logger.warning("⚠️  ADMIN_IDS не настроены. Бот будет доступен всем.")
        print("⚠️  ВНИМАНИЕ: ADMIN_IDS не настроены. Добавьте TELEGRAM_ADMIN_IDS в .env")
    
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
        fallbacks=[CommandHandler("cancel", cancel)]
    )
    
    # Регистрируем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(conv_handler)
    application.add_handler(CommandHandler("list_cars", list_cars))
    application.add_handler(CommandHandler("delete_car", delete_car))
    application.add_handler(CommandHandler("edit_car", edit_car))
    application.add_handler(CommandHandler("cancel", cancel))
    
    # Обработчик ошибок
    application.add_error_handler(error_handler)
    
    # Запускаем бота
    logger.info("🤖 Бот запущен...")
    print("🚀 Telegram бот запущен!")
    print(f"👑 Администраторы: {ADMIN_IDS if ADMIN_IDS else 'не настроены'}")
    
    # ✅ ИСПРАВЛЕНО: Правильный запуск для production
    if os.getenv("RENDER"):
        # На Render используем webhook
        print("🌐 Режим: Render (Production)")
        application.run_webhook(
            listen="0.0.0.0",
            port=int(os.getenv("PORT", 8443)),
            url_path=TOKEN,
            webhook_url=f"https://{os.getenv('RENDER_EXTERNAL_HOSTNAME')}/{TOKEN}"
        )
    else:
        # Локально используем polling
        print("💻 Режим: Local (Development)")
        application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()