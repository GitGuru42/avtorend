# schemas.py - Production ready Pydantic схемы
from pydantic import BaseModel, validator, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from enum import Enum
import re

class CarCategory(str, Enum):
    ECONOMY = "economy"
    COMFORT = "comfort"
    BUSINESS = "business"
    PREMIUM = "premium"
    SUV = "suv"
    MINIVAN = "minivan"
    SPORT = "sport"
    ELECTRIC = "electric"

class CarStatus(str, Enum):
    AVAILABLE = "available"
    RENTED = "rented"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"
    UNAVAILABLE = "unavailable"

class TransmissionType(str, Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"
    CVT = "cvt"
    SEMI_AUTOMATIC = "semi_automatic"

class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"
    FAILED = "failed"

# ============ СХЕМЫ ДЛЯ КАТЕГОРИЙ ============

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    slug: str = Field(..., min_length=2, max_length=50, pattern="^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=100)

class CategoryCreate(CategoryBase):
    sort_order: int = Field(0, ge=0)
    is_active: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=50)
    slug: Optional[str] = Field(None, min_length=2, max_length=50, pattern="^[a-z0-9-]+$")
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=100)
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None

class Category(CategoryBase):
    id: int
    sort_order: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ СХЕМЫ ДЛЯ АВТОМОБИЛЕЙ ============

class CarBase(BaseModel):
    brand: str = Field(..., min_length=2, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=1900, le=datetime.now().year + 1)
    license_plate: str = Field(..., min_length=2, max_length=20)
    category_id: int = Field(..., gt=0)
    engine_capacity: float = Field(..., gt=0, le=10.0)
    horsepower: int = Field(..., gt=0, le=2000)
    fuel_type: str = Field(..., min_length=3, max_length=50)
    transmission: TransmissionType
    fuel_consumption: float = Field(..., gt=0, le=50.0)
    doors: int = Field(..., ge=2, le=6)
    seats: int = Field(..., ge=1, le=9)
    color: str = Field(..., min_length=2, max_length=50)
    daily_price: float = Field(..., gt=0)
    deposit: float = Field(..., ge=0)
    mileage: int = Field(..., ge=0)
    features: List[str] = Field(default_factory=list)
    description: Optional[str] = Field(None, max_length=2000)

    @validator('license_plate')
    def validate_license_plate(cls, v):
        # Простая валидация номера
        v = v.strip().upper()
        if len(v) < 2 or len(v) > 20:
            raise ValueError('Номерной знак должен быть от 2 до 20 символов')
        return v
    
    @validator('fuel_type')
    def validate_fuel_type(cls, v):
        allowed = ['бензин', 'дизель', 'электрокар', 'гибрид', 'газ', 'бензин/газ']
        v_lower = v.lower()
        if v_lower not in allowed:
            raise ValueError(f'Тип топлива должен быть одним из: {", ".join(allowed)}')
        return v
    
    @validator('color')
    def validate_color(cls, v):
        v = v.strip().capitalize()
        if len(v) < 2:
            raise ValueError('Цвет должен содержать хотя бы 2 символа')
        return v

class CarCreate(CarBase):
    images: List[str] = Field(default_factory=list)
    thumbnail: Optional[str] = None
    
    @validator('images', pre=True, always=True)
    def validate_images(cls, v):
        """Валидация и нормализация путей к изображениям"""
        if not v or not isinstance(v, list):
            return []
        
        corrected = []
        for img in v:
            if not img or not isinstance(img, str):
                continue
            
            img = img.strip()
            if not img:
                continue
            
            # Нормализуем путь для web-доступа
            corrected.append(cls.normalize_image_path(img))
        
        return corrected
    
    @validator('thumbnail', pre=True, always=True)
    def validate_thumbnail(cls, v, values):
        """Валидация и нормализация пути к thumbnail"""
        if not v or not isinstance(v, str):
            # Если нет thumbnail, берем первое фото из images
            if 'images' in values and values['images']:
                images = values['images']
                if images and len(images) > 0:
                    return cls.normalize_image_path(images[0])
            return None
        
        v = v.strip()
        return cls.normalize_image_path(v)
    
    @staticmethod
    def normalize_image_path(image_path: str) -> str:
        """Нормализация пути к изображению для web-доступа"""
        # Убираем двойные слеши
        while '//' in image_path:
            image_path = image_path.replace('//', '/')
        
        # Убираем пробелы и специальные символы
        image_path = image_path.strip()
        
        # Если путь уже правильный (начинается с /static/uploads/cars/)
        if image_path.startswith('/static/uploads/cars/'):
            return image_path
        
        # Если только имя файла
        if '/' not in image_path:
            return f'/static/uploads/cars/{image_path}'
        
        # Извлекаем имя файла из любого пути
        filename = image_path.split('/')[-1]
        
        # Очищаем имя файла
        filename = re.sub(r'[^\w\s.-]', '', filename)
        filename = filename.strip()
        
        return f'/static/uploads/cars/{filename}'

class CarUpdate(BaseModel):
    brand: Optional[str] = Field(None, min_length=2, max_length=100)
    model: Optional[str] = Field(None, min_length=1, max_length=100)
    year: Optional[int] = Field(None, ge=1900, le=datetime.now().year + 1)
    license_plate: Optional[str] = Field(None, min_length=2, max_length=20)
    category_id: Optional[int] = Field(None, gt=0)
    engine_capacity: Optional[float] = Field(None, gt=0, le=10.0)
    horsepower: Optional[int] = Field(None, gt=0, le=2000)
    fuel_type: Optional[str] = Field(None, min_length=3, max_length=50)
    transmission: Optional[TransmissionType] = None
    fuel_consumption: Optional[float] = Field(None, gt=0, le=50.0)
    doors: Optional[int] = Field(None, ge=2, le=6)
    seats: Optional[int] = Field(None, ge=1, le=9)
    color: Optional[str] = Field(None, min_length=2, max_length=50)
    daily_price: Optional[float] = Field(None, gt=0)
    deposit: Optional[float] = Field(None, ge=0)
    mileage: Optional[int] = Field(None, ge=0)
    features: Optional[List[str]] = None
    images: Optional[List[str]] = None
    thumbnail: Optional[str] = None
    description: Optional[str] = Field(None, max_length=2000)
    status: Optional[CarStatus] = None
    is_active: Optional[bool] = None

class Car(CarBase):
    id: int
    status: CarStatus
    images: List[str]
    thumbnail: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class CarDetail(Car):
    category: Optional[Category] = None

# ============ СХЕМЫ ДЛЯ БРОНИРОВАНИЙ ============

class BookingBase(BaseModel):
    car_id: int = Field(..., gt=0)
    start_date: datetime
    end_date: datetime
    customer_name: str = Field(..., min_length=2, max_length=255)
    customer_email: str = Field(..., max_length=255)
    customer_phone: str = Field(..., min_length=5, max_length=20)
    customer_notes: Optional[str] = Field(None, max_length=1000)
    
    @validator('end_date')
    def validate_dates(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError('Дата окончания должна быть позже даты начала')
        return v
    
    @validator('customer_email')
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Неверный формат email')
        return v

class BookingCreate(BookingBase):
    pass

class Booking(BookingBase):
    id: int
    user_id: Optional[int]
    total_days: int
    total_price: float
    status: str
    payment_status: str
    payment_method: Optional[str]
    transaction_id: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class BookingDetail(Booking):
    car: Optional[Car] = None
    user: Optional[Any] = None  # Можно добавить User схему

# ============ СХЕМЫ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ ============

class UserBase(BaseModel):
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=5, max_length=20)
    full_name: str = Field(..., min_length=2, max_length=255)
    
    @validator('email')
    def validate_email(cls, v):
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Неверный формат email')
        return v

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    email_verified: bool
    phone_verified: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# ============ СХЕМЫ ДЛЯ ФИЛЬТРАЦИИ ============

class CarFilter(BaseModel):
    category_id: Optional[int] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    min_year: Optional[int] = None
    max_year: Optional[int] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_seats: Optional[int] = None
    max_seats: Optional[int] = None
    fuel_type: Optional[str] = None
    transmission: Optional[TransmissionType] = None
    status: Optional[CarStatus] = CarStatus.AVAILABLE
    is_active: Optional[bool] = True
    
    class Config:
        use_enum_values = True

# ============ СХЕМЫ ДЛЯ ОТВЕТОВ API ============

class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[Any] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
    total_pages: int

# ============ СХЕМЫ ДЛЯ ЗАГРУЗКИ ФАЙЛОВ ============

class FileUploadResponse(BaseModel):
    filename: str
    url: str
    size: int
    content_type: str

class MultipleFilesUploadResponse(BaseModel):
    files: List[FileUploadResponse]
    total_size: int
    uploaded_count: int

# ============ СХЕМЫ ДЛЯ ПОИСКА ============

class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)