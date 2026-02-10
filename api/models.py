# models.py - Production ready для PostgreSQL на Render
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ENUM
import enum

# ✅ ИСПРАВЛЕНО: Безопасный импорт для Render и локальной разработки
try:
    from .database import Base
except ImportError:
    # Для случаев когда модуль импортируется напрямую
    try:
        from database import Base
    except ImportError:
        # Создаем заглушку для импорта
        from sqlalchemy.ext.declarative import declarative_base
        Base = declarative_base()
        print("⚠️  База Base создана через declarative_base()")

# Enum для категорий автомобилей
class CarCategory(str, enum.Enum):
    ECONOMY = "economy"
    COMFORT = "comfort"
    BUSINESS = "business"
    PREMIUM = "premium"
    SUV = "suv"
    MINIVAN = "minivan"
    SPORT = "sport"
    ELECTRIC = "electric"

# Enum для статусов автомобилей
#
# ⚠️ ВАЖНО ПРО РЕГИСТР:
# PostgreSQL ENUM значения регистрозависимы.
# По вашим проверкам в psql (enum_range(NULL::carstatus)) допустимы значения
# "AVAILABLE" и "UNAVAILABLE". Поэтому держим значения в БД как есть.
# Если позже расширите ENUM в БД (через миграции), можно будет вернуть остальные статусы.
class CarStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"

# Enum для типов трансмиссии
# По вашим проверкам в psql (enum_range(NULL::transmissiontype)) допустимы:
# MANUAL, AUTOMATIC, CVT, SEMI_AUTOMATIC
class TransmissionType(str, enum.Enum):
    MANUAL = "MANUAL"
    AUTOMATIC = "AUTOMATIC"
    CVT = "CVT"
    SEMI_AUTOMATIC = "SEMI_AUTOMATIC"

# Создаем ENUM типы для PostgreSQL
car_status_enum = ENUM(
    CarStatus,
    name="carstatus",
    create_type=True,  # Создавать тип в БД
    values_callable=lambda obj: [e.value for e in obj]
)

transmission_type_enum = ENUM(
    TransmissionType,
    name="transmissiontype",
    create_type=True,
    values_callable=lambda obj: [e.value for e in obj]
)

# Модель категории автомобиля
class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    slug = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)  # Иконка для фронтенда
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    cars = relationship("Car", back_populates="category", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name='{self.name}')>"

# Модель автомобиля
class Car(Base):
    __tablename__ = "cars"
    
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    
    # Основная информация
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(100), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    license_plate = Column(String(20), unique=True, nullable=False, index=True)
    vin = Column(String(50), unique=True, nullable=True, index=True)
    
    # Технические характеристики
    engine_capacity = Column(Float, nullable=False)  # в литрах
    horsepower = Column(Integer, nullable=False)
    fuel_type = Column(String(50), nullable=False, index=True)  # бензин, дизель, электрокар, гибрид
    transmission = Column(transmission_type_enum, nullable=False, index=True)
    fuel_consumption = Column(Float, nullable=False)  # л/100км
    doors = Column(Integer, nullable=False)
    seats = Column(Integer, nullable=False)
    color = Column(String(50), nullable=False)
    
    # Арендная информация
    daily_price = Column(Float, nullable=False, index=True)
    weekly_price = Column(Float, nullable=True)
    monthly_price = Column(Float, nullable=True)
    deposit = Column(Float, nullable=False)  # залог
    min_rent_days = Column(Integer, default=1)
    max_rent_days = Column(Integer, nullable=True)
    
    # Состояние и статус
    status = Column(car_status_enum, default=CarStatus.AVAILABLE, index=True)
    mileage = Column(Integer, nullable=False, default=0)  # текущий пробег
    last_maintenance = Column(DateTime(timezone=True), nullable=True)
    next_maintenance = Column(DateTime(timezone=True), nullable=True)
    
    # Описание и медиа
    description = Column(Text, nullable=True)
    features = Column(JSON, default=list)  # список опций: ['кондиционер', 'подогрев сидений', ...]
    images = Column(JSON, default=list)  # список путей к изображениям
    thumbnail = Column(String(500), nullable=True)  # главное изображение
    
    # Мета-данные
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Связи
    category = relationship("Category", back_populates="cars")
    bookings = relationship("Booking", back_populates="car", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Car(id={self.id}, brand='{self.brand}', model='{self.model}', year={self.year})>"
    
    @property
    def full_name(self):
        """Полное название автомобиля"""
        return f"{self.brand} {self.model} ({self.year})"

# Модель бронирования
class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    car_id = Column(Integer, ForeignKey("cars.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    start_date = Column(DateTime, nullable=False, index=True)
    end_date = Column(DateTime, nullable=False, index=True)
    total_days = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)
    status = Column(String(50), default="pending", index=True)  # pending, confirmed, cancelled, completed
    
    # Информация о клиенте
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    customer_notes = Column(Text, nullable=True)
    
    # Платежная информация
    payment_status = Column(String(50), default="pending")  # pending, paid, refunded
    payment_method = Column(String(50), nullable=True)
    transaction_id = Column(String(100), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    car = relationship("Car", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    
    def __repr__(self):
        return f"<Booking(id={self.id}, car_id={self.car_id}, status='{self.status}')>"

# Модель пользователя
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    driver_license = Column(String(50), nullable=True)
    passport_data = Column(JSON, nullable=True)
    
    # Дополнительные поля для аутентификации
    password_hash = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    # Верификация
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', full_name='{self.full_name}')>"

# Модель для логов действий
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)  # create_car, update_car, delete_car и т.д.
    table_name = Column(String(50), nullable=False)
    record_id = Column(Integer, nullable=True)
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User")
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action}', table='{self.table_name}')>"