from __future__ import annotations

"""Pydantic schemas (Pydantic v2).

Цель файла — строго согласовать валидацию входных данных с ограничениями БД
(NOT NULL, ENUM значения) и при этом быть удобным для API/бота.

Ключевые моменты:
- Не дублируем Enum'ы: используем Enum'ы из api.models, чтобы не ловить рассинхрон.
- Поля, которые в БД nullable=False, делаем обязательными (иначе получите IntegrityError).
- Для ENUM'ов принимаем как Enum, так и строку; строки нормализуем.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import CarStatus, TransmissionType


# =====================
# CATEGORY
# =====================


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    icon: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None


# =====================
# CAR
# =====================


class CarBase(BaseModel):
    # Основная информация
    brand: str = Field(..., min_length=1, max_length=100)
    model: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=1900, le=2100)

    category_id: int = Field(..., gt=0)

    license_plate: str = Field(..., min_length=1, max_length=20)
    vin: Optional[str] = Field(None, max_length=50)

    # Технические характеристики (в БД nullable=False)
    engine_capacity: float = Field(..., gt=0)
    horsepower: int = Field(..., gt=0)
    fuel_type: str = Field(..., min_length=1, max_length=50)
    transmission: TransmissionType = Field(...)
    fuel_consumption: float = Field(..., gt=0)
    doors: int = Field(..., gt=0)
    seats: int = Field(..., gt=0)
    color: str = Field(..., min_length=1, max_length=50)

    # Аренда (в БД deposit nullable=False)
    daily_price: float = Field(..., gt=0)
    weekly_price: Optional[float] = Field(None, ge=0)
    monthly_price: Optional[float] = Field(None, ge=0)
    deposit: float = Field(..., ge=0)

    min_rent_days: int = Field(1, ge=1)
    max_rent_days: Optional[int] = Field(None, ge=1)

    # Состояние/статус
    status: CarStatus = CarStatus.AVAILABLE
    mileage: int = Field(0, ge=0)
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None

    # Описание/медиа
    description: Optional[str] = Field(None, max_length=2000)
    features: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    thumbnail: Optional[str] = None

    is_active: bool = True

    # --- validators ---

    @field_validator("license_plate")
    @classmethod
    def normalize_license_plate(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("license_plate не может быть пустым")
        return v

    @field_validator("vin")
    @classmethod
    def normalize_vin(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().upper()
        return v or None

    @field_validator("transmission", mode="before")
    @classmethod
    def coerce_transmission(cls, v):
        """Принимаем Enum/строку.

        В БД transmissiontype хранит значения вроде 'CVT', 'AUTOMATIC' и т.д.
        Поэтому строку приводим к UPPER и маппим на TransmissionType.
        """
        if isinstance(v, TransmissionType):
            return v
        if isinstance(v, str):
            s = v.strip()
            if not s:
                raise ValueError("transmission пустой")
            s_up = s.upper()
            # позволяем также варианты вида semi_automatic
            s_up = s_up.replace(" ", "_")
            return TransmissionType(s_up)
        return v

    @field_validator("status", mode="before")
    @classmethod
    def coerce_status(cls, v):
        if isinstance(v, CarStatus):
            return v
        if isinstance(v, str):
            s = v.strip()
            if not s:
                raise ValueError("status пустой")
            return CarStatus(s.upper())
        return v


class CarCreate(CarBase):
    pass


class Car(CarBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CarDetail(Car):
    category: Optional[Category] = None


# =====================
# BOOKINGS
# =====================


class BookingBase(BaseModel):
    car_id: int = Field(..., gt=0)
    start_date: datetime
    end_date: datetime
    customer_name: str = Field(..., min_length=2, max_length=255)
    customer_email: str = Field(..., max_length=255)
    customer_phone: str = Field(..., min_length=5, max_length=20)
    customer_notes: Optional[str] = Field(None, max_length=1000)

    @field_validator("customer_email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Неверный формат email")
        return v

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v: datetime, info) -> datetime:
        start_date = info.data.get("start_date")
        if start_date and v <= start_date:
            raise ValueError("Дата окончания должна быть позже даты начала")
        return v


class BookingCreate(BookingBase):
    pass


class Booking(BookingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    total_days: int
    total_price: float
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BookingDetail(Booking):
    car: Optional[Car] = None
    user: Optional[Any] = None


# =====================
# USERS
# =====================


class UserBase(BaseModel):
    email: str = Field(..., max_length=255)
    phone: str = Field(..., min_length=5, max_length=20)
    full_name: str = Field(..., min_length=2, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Неверный формат email")
        return v


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class User(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    is_admin: bool
    email_verified: bool
    phone_verified: bool
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


# =====================
# FILTERS / RESPONSES
# =====================


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
    status: Optional[CarStatus] = None
    is_active: Optional[bool] = True


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


class FileUploadResponse(BaseModel):
    filename: str
    url: str
    size: int
    content_type: str


class MultipleFilesUploadResponse(BaseModel):
    files: List[FileUploadResponse]
    total_size: int
    uploaded_count: int


class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=100)
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)
