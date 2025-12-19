import sys
import os
# Добавляем папку api в путь Python
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.database import engine, Base
from api.models import Category, Car
def create_tables():
    print("Создаем таблицы...")
    Base.metadata.create_all(bind=engine)
    print("Таблицы созданы!")

def seed_initial_data():
    from sqlalchemy.orm import Session
    from database import SessionLocal
    
    db = SessionLocal()
    
    # Создаем категории автомобилей
    categories_data = [
        {"name": "Эконом", "slug": "economy", "icon": "eco", "description": "Бюджетные автомобили"},
        {"name": "Комфорт", "slug": "comfort", "icon": "comfort", "description": "Автомобили среднего класса"},
        {"name": "Бизнес", "slug": "business", "icon": "business", "description": "Автомобили для деловых поездок"},
        {"name": "Премиум", "slug": "premium", "icon": "premium", "description": "Люкс автомобили"},
        {"name": "Внедорожник", "slug": "suv", "icon": "suv", "description": "Внедорожники и кроссоверы"},
        {"name": "Минивэн", "slug": "minivan", "icon": "minivan", "description": "Автомобили для большой семьи"},
        {"name": "Спорткар", "slug": "sport", "icon": "sport", "description": "Спортивные автомобили"},
        {"name": "Электрокар", "slug": "electric", "icon": "electric", "description": "Электрические автомобили"},
    ]
    
    for cat_data in categories_data:
        category = db.query(Category).filter(Category.slug == cat_data["slug"]).first()
        if not category:
            category = Category(**cat_data)
            db.add(category)
    
    db.commit()
    
    # Добавляем тестовые автомобили
    cars_data = [
        {
            "brand": "Toyota",
            "model": "Camry",
            "year": 2022,
            "license_plate": "А001АА777",
            "category_id": 2,  # Комфорт
            "engine_capacity": 2.5,
            "horsepower": 203,
            "fuel_type": "бензин",
            "transmission": "automatic",
            "fuel_consumption": 7.8,
            "doors": 4,
            "seats": 5,
            "color": "черный",
            "daily_price": 3500,
            "deposit": 30000,
            "mileage": 15000,
            "features": ["кондиционер", "мультимедиа", "подогрев сидений", "камера заднего вида"],
            "images": ["/images/toyota-camry-1.jpg", "/images/toyota-camry-2.jpg"],
            "thumbnail": "/images/toyota-camry-thumb.jpg",
            "description": "Toyota Camry 2022 года в отличном состоянии"
        },
        {
            "brand": "BMW",
            "model": "X5",
            "year": 2023,
            "license_plate": "В002ВВ777",
            "category_id": 5,  # Внедорожник
            "engine_capacity": 3.0,
            "horsepower": 340,
            "fuel_type": "дизель",
            "transmission": "automatic",
            "fuel_consumption": 9.5,
            "doors": 5,
            "seats": 5,
            "color": "белый",
            "daily_price": 8500,
            "deposit": 70000,
            "mileage": 8000,
            "features": ["полный привод", "панорамная крыша", "кожаный салон", "подогрев руля"],
            "images": ["/images/bmw-x5-1.jpg", "/images/bmw-x5-2.jpg"],
            "thumbnail": "/images/bmw-x5-thumb.jpg",
            "description": "BMW X5 2023 года, полный комплект"
        }
    ]
    
    for car_data in cars_data:
        car = db.query(Car).filter(Car.license_plate == car_data["license_plate"]).first()
        if not car:
            car = Car(**car_data)
            db.add(car)
    
    db.commit()
    db.close()
    print("Начальные данные добавлены!")

if __name__ == "__main__":
    create_tables()
    seed_initial_data()