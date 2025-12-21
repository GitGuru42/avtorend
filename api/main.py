# main.py - Production ready для Render.com
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

# ✅ Добавляем путь для импортов на Render
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Импорты с обработкой ошибок для разных окружений
try:
    from api import models, schemas
    from api.database import get_db, engine, Base
    print("✅ Модули успешно импортированы (из api.*)")
except ImportError as e:
    print(f"ℹ️  Попытка альтернативного импорта: {e}")
    try:
        import models, schemas
        from database import get_db, engine, Base
        print("✅ Модули импортированы альтернативно")
    except ImportError as e2:
        print(f"❌ Критическая ошибка импорта: {e2}")
        # Создаем минимальную структуру для запуска
        Base = None
        engine = None
        get_db = None
        models = None
        schemas = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting AvtoRend API...")
    
    try:
        # ========= СОЗДАНИЕ ТАБЛИЦ В БАЗЕ =========
        if Base and engine:
            print("🗄️  Создание таблиц в базе данных...")
            try:
                # ПРОСТОЕ создание таблиц
                Base.metadata.create_all(bind=engine)
                print("✅ Таблицы созданы (если их не было)")
                
                # Простая проверка без сложного SQL
                from sqlalchemy import text
                with engine.connect() as conn:
                    # Простой запрос для проверки
                    result = conn.execute(text("SELECT current_database()"))
                    db_name = result.scalar()
                    print(f"📊 База данных: {db_name}")
                    
            except Exception as db_error:
                print(f"⚠️  Предупреждение при создании таблиц: {db_error}")
        
        # ========= СОЗДАНИЕ ДИРЕКТОРИЙ =========
        os.makedirs("static/uploads/cars", exist_ok=True)
        os.makedirs("static/uploads/temp", exist_ok=True)
        print("✅ Директории созданы")
        
        # ========= ЗАПУСК ТЕЛЕГРАМ БОТА =========
        # try:
        #     from api.telegram_bot import start_bot
        #     import threading
            
        #     print("🤖 Инициализация Telegram бота...")
            
        #     # Запускаем бота в отдельном потоке
        #     bot_thread = threading.Thread(
        #         target=start_bot,
        #         daemon=True,  # Демон-поток (завершится с основным)
        #         name="TelegramBot"
        #     )
        #     bot_thread.start()
        #     print("✅ Telegram bot запущен в фоновом режиме")
            
        # except ImportError as e:
        #     print(f"⚠️ Файл бота не найден: {e}")
        #     print(f"Путь: {os.path.join(current_dir, 'telegram_bot.py')}")
        # except Exception as e:
        #     print(f"❌ Ошибка запуска бота: {e}")
        
        # ========= ДОБАВЛЕНИЕ ТЕСТОВЫХ ДАННЫХ =========
        try:
            from sqlalchemy.orm import Session
            from api.database import SessionLocal
            from api.models import Category, Car, CarStatus, TransmissionType
            
            db = SessionLocal()
            
            # Проверяем есть ли категории
            categories_count = db.query(Category).count()
            if categories_count == 0:
                print("📝 Добавляем тестовые категории...")
                
                categories = [
                    Category(name="Эконом", slug="economy", icon="eco", description="Бюджетные автомобили"),
                    Category(name="Комфорт", slug="comfort", icon="comfort", description="Автомобили среднего класса"),
                    Category(name="Бизнес", slug="business", icon="business", description="Автомобили для деловых поездок"),
                    Category(name="Премиум", slug="premium", icon="premium", description="Люкс автомобили"),
                ]
                
                for cat in categories:
                    db.add(cat)
                db.commit()
                print(f"✅ Добавлено категорий: {len(categories)}")
            
            # Проверяем есть ли автомобили
            cars_count = db.query(Car).count()
            if cars_count == 0:
                print("🚗 Добавляем тестовые автомобили...")
                
                # Получаем первую категорию
                category = db.query(Category).first()
                
                if category:
                    car = Car(
                        brand="Toyota",
                        model="Camry",
                        year=2022,
                        license_plate="A123BC",
                        category_id=category.id,
                        engine_capacity=2.5,
                        horsepower=203,
                        fuel_type="бензин",
                        transmission=TransmissionType.AUTOMATIC,
                        fuel_consumption=8.5,
                        doors=4,
                        seats=5,
                        color="Черный",
                        daily_price=3000,
                        deposit=15000,
                        mileage=15000,
                        status=CarStatus.AVAILABLE,
                        is_active=True
                    )
                    db.add(car)
                    db.commit()
                    print(f"✅ Добавлен тестовый автомобиль: {car.brand} {car.model}")
            
            db.close()
            
        except Exception as e:
            print(f"⚠️  Ошибка добавления тестовых данных: {e}")
        
    except Exception as e:
        print(f"⚠️ Предупреждение при запуске: {e}")
    
    yield  # ⬅️ ТОЛЬКО ОДИН YIELD ЗДЕСЬ!
    
    # ========= SHUTDOWN (после yield) =========
    # Shutdown
    print("🛑 Shutting down AvtoRend API...")
    if engine:
        engine.dispose()
        print("✅ Соединение с БД закрыто")

# ✅ Создаем приложение с lifespan
app = FastAPI(
    title="AvtoRend API",
    description="API для аренды автомобилей",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ✅ CORS настройки для продакшена
# Получаем домены из переменных окружения
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not allowed_origins or allowed_origins == [""]:
    allowed_origins = ["*"]  # Для разработки
    print("⚠️  ВНИМАНИЕ: CORS разрешены все домены. Настройте ALLOWED_ORIGINS для продакшена")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Total-Count"],
    max_age=600  # Кэшировать preflight на 10 минут
)

# ✅ ПОДКЛЮЧАЕМ ВСЕ СТАТИЧЕСКИЕ ПАПКИ
print("📁 Настройка статических файлов...")

# Определяем корневую директорию проекта
BASE_DIR = Path.cwd()

# Все папки которые нужно обслуживать как статику
STATIC_DIRS = [
    ("/styles", "styles"),
    ("/js", "js"), 
    ("/locales", "locales"),
    ("/static", "static"),
    ("/images", "images")  # если есть
]

for route, dir_name in STATIC_DIRS:
    dir_path = BASE_DIR / dir_name
    if dir_path.exists():
        app.mount(route, StaticFiles(directory=str(dir_path)), name=dir_name)
        print(f"✅ Статика подключена: {route} -> {dir_path}")
        
        # Показываем несколько файлов для проверки
        files = list(dir_path.glob("*.*"))[:3]  # только файлы с расширениями
        if files:
            print(f"   Примеры файлов: {[f.name for f in files]}")
    else:
        print(f"⚠️  Папка не найдена: {dir_path}")

# ✅ Добавляем middleware для логирования
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Пропускаем health checks из логов
    if request.url.path not in ["/health", "/favicon.ico"]:
        print(f"🌐 {request.method} {request.url.path} - начато")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    if request.url.path not in ["/health", "/favicon.ico"]:
        print(f"✅ {request.method} {request.url.path} - завершено за {process_time:.3f}с")
    
    response.headers["X-Process-Time"] = str(process_time)
    return response

# ====================== ROUTES ======================

# Health check endpoint для Render (без логирования)
@app.get("/health", include_in_schema=False)
async def health_check():
    """Проверка здоровья сервиса для мониторинга"""
    db_status = "unknown"
    if engine:
        try:
            with engine.connect() as conn:
                conn.execute("SELECT 1")
                db_status = "connected"
        except:
            db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "AvtoRend API",
        "version": "1.0.0",
        "database": db_status,
        "timestamp": time.time()
    }

# ГЛАВНАЯ СТРАНИЦА - только один эндпоинт /
@app.get("/")
async def read_root():
    """Главная страница сайта"""
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    else:
        return JSONResponse(
            status_code=404,
            content={"error": "index.html не найден", "path": str(index_path)}
        )

# API информация - отдельный эндпоинт
@app.get("/api")
async def api_info():
    """Информация о доступных API эндпоинтах"""
    return {
        "message": "AvtoRend API работает!",
        "documentation": "/api/docs",
        "health_check": "/health",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "endpoints": {
            "cars": "/api/cars",
            "categories": "/api/categories",
            "car_by_id": "/api/cars/{id}"
        }
    }

@app.get("/test")
def test():
    """Тестовый эндпоинт для проверки окружения"""
    return {
        "status": "ok", 
        "message": "Сервер работает",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "render": bool(os.getenv("RENDER")),
        "python_version": sys.version.split()[0],
        "host": os.getenv("RENDER_EXTERNAL_HOSTNAME", "localhost")
    }

@app.get("/api/info")
async def server_info():
    """Информация о сервере и конфигурации"""
    return {
        "app": "AvtoRend API",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "status": "running",
        "database": "connected" if os.getenv("DATABASE_URL") else "local",
        "hosting": "Render" if os.getenv("RENDER") else "Local",
        "debug": os.getenv("DEBUG", "false").lower() == "true"
    }

# Эндпоинт для получения всех категорий
@app.get("/api/categories", response_model=List[schemas.Category])
def get_categories(db: Session = Depends(get_db)):
    """Получить все активные категории автомобилей"""
    try:
        categories = db.query(models.Category).filter(models.Category.is_active == True).all()
        return categories
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения категорий: {str(e)}")

# Эндпоинт для получения автомобилей с фильтрацией
@app.get("/api/cars", response_model=List[schemas.Car])
def get_cars(
    db: Session = Depends(get_db),
    category_id: Optional[int] = Query(None, description="ID категории"),
    brand: Optional[str] = Query(None, description="Марка автомобиля"),
    min_price: Optional[float] = Query(None, description="Минимальная цена"),
    max_price: Optional[float] = Query(None, description="Максимальная цена"),
    status: Optional[str] = Query("available", description="Статус автомобиля"),
    limit: int = Query(100, ge=1, le=100, description="Лимит записей"),
    offset: int = Query(0, ge=0, description="Смещение")
):
    """Получить автомобили с фильтрацией по параметрам"""
    try:
        query = db.query(models.Car).filter(models.Car.is_active == True)
        
        if category_id:
            query = query.filter(models.Car.category_id == category_id)
        if brand:
            query = query.filter(models.Car.brand.ilike(f"%{brand}%"))
        if min_price:
            query = query.filter(models.Car.daily_price >= min_price)
        if max_price:
            query = query.filter(models.Car.daily_price <= max_price)
        if status:
            query = query.filter(models.Car.status == status)
        
        cars = query.offset(offset).limit(limit).all()
        
        # Добавляем заголовок с общим количеством
        total_count = query.count()
        response = Response()
        response.headers["X-Total-Count"] = str(total_count)
        
        return cars
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения автомобилей: {str(e)}")

# Эндпоинт для получения одного автомобиля
@app.get("/api/cars/{car_id}", response_model=schemas.Car)
def get_car(car_id: int, db: Session = Depends(get_db)):
    """Получить автомобиль по ID"""
    try:
        car = db.query(models.Car).filter(models.Car.id == car_id).first()
        if not car:
            raise HTTPException(status_code=404, detail="Автомобиль не найден")
        return car
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения автомобиля: {str(e)}")

# ✅ Обработчик для favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = BASE_DIR / "static" / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    # Возвращаем пустой ответ с 204 статусом
    return Response(status_code=204)

# ✅ Глобальный обработчик ошибок (ИСПРАВЛЕННЫЙ - возвращаем JSONResponse)
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    error_details = traceback.format_exc() if os.getenv("DEBUG") == "true" else None
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Внутренняя ошибка сервера",
            "path": str(request.url.path),
            "message": "Произошла внутренняя ошибка. Пожалуйста, попробуйте позже.",
            "details": error_details
        }
    )

# ✅ Эндпоинт для проверки статики
@app.get("/debug/static")
async def debug_static():
    """Отладка статических файлов"""
    result = {}
    for route, dir_name in STATIC_DIRS:
        dir_path = BASE_DIR / dir_name
        if dir_path.exists():
            files = [f.name for f in dir_path.glob("*") if f.is_file()][:10]
            result[dir_name] = {
                "exists": True,
                "path": str(dir_path),
                "files": files,
                "count": len(files)
            }
        else:
            result[dir_name] = {
                "exists": False,
                "path": str(dir_path)
            }
    return result

# Эндпоинт для проверки базы данных
@app.get("/debug/db")
async def debug_db():
    """Проверка состояния базы данных"""
    try:
        from sqlalchemy import text
        
        with engine.connect() as conn:
            # Проверяем таблицы
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]
            
            # Проверяем данные в основных таблицах
            data_counts = {}
            for table in ['categories', 'cars']:
                try:
                    if table in tables:
                        result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                        data_counts[table] = result.scalar()
                    else:
                        data_counts[table] = "table not exists"
                except:
                    data_counts[table] = "error"
            
            return {
                "status": "connected",
                "tables": tables,
                "data_counts": data_counts,
                "engine_url": str(engine.url).split('@')[1] if '@' in str(engine.url) else str(engine.url)
            }
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Простой эндпоинт для API
@app.get("/api/test-data")
async def test_data():
    """Тестовый эндпоинт для проверки работы API и БД"""
    try:
        from api.database import SessionLocal
        from api.models import Category, Car
        
        db = SessionLocal()
        
        # Получаем категории
        categories = db.query(Category).filter(Category.is_active == True).all()
        categories_data = [
            {"id": cat.id, "name": cat.name, "slug": cat.slug}
            for cat in categories
        ]
        
        # Получаем автомобили
        cars = db.query(Car).filter(Car.is_active == True).all()
        cars_data = [
            {
                "id": car.id,
                "brand": car.brand,
                "model": car.model,
                "year": car.year,
                "price": car.daily_price,
                "status": car.status.value
            }
            for car in cars
        ]
        
        db.close()
        
        return {
            "success": True,
            "categories": categories_data,
            "cars": cars_data,
            "counts": {
                "categories": len(categories_data),
                "cars": len(cars_data)
            }
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

# ====================== MAIN ======================
if __name__ == "__main__":
    import uvicorn
    
    # Конфигурация для продакшена
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    workers = int(os.getenv("WORKERS", 1))
    
    print(f"🚀 Запуск сервера на {host}:{port}")
    print(f"📊 Количество workers: {workers}")
    print(f"🔧 Режим: {'production' if not os.getenv('DEBUG') else 'development'}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        workers=workers,
        log_level="info",
        access_log=True
    )
