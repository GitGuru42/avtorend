import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
import logging

# Настройка логгера
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

def get_database_url():
    """
    Получаем URL базы данных для разных окружений.
    
    Render предоставляет DATABASE_URL в формате:
    postgresql://user:password@host:port/database
    """
    
    # 1. Основная переменная для Render/Heroku
    database_url = os.getenv("DATABASE_URL")
    
    # 2. Если не найдено, пробуем альтернативные имена
    if not database_url:
        database_url = os.getenv("POSTGRES_URL")
    
    # 3. Исправляем схему для SQLAlchemy (если нужно)
    if database_url:
        # Некоторые хостинги используют postgres:// вместо postgresql://
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
            logger.info("✅ Исправлен протокол подключения к БД (postgres -> postgresql)")
    
    # 4. Для локальной разработки
    if not database_url:
        env = os.getenv("ENVIRONMENT", "development")
        
        if env == "production":
            raise ValueError(
                "❌ DATABASE_URL не установлена для production окружения! "
                "Настройте подключение к PostgreSQL на Render."
            )
        else:
            # Локальная PostgreSQL
            database_url = "postgresql://itichnik:1234@localhost:5432/avtorend"
            logger.info("📁 Используется локальная PostgreSQL БД")
    
    logger.info(f"🔧 URL БД: {database_url[:30]}...")  # Логируем только начало для безопасности
    
    return database_url

def create_db_engine():
    """Создаем engine с настройками для продакшена"""
    
    database_url = get_database_url()
    
    # Параметры подключения
    connect_args = {}
    
    # Для SQLite нужно special args
    if "sqlite" in database_url:
        connect_args = {"check_same_thread": False}
    
    engine = create_engine(
        database_url,
        # Настройки пула соединений для продакшена
        pool_size=10,           # Максимальное количество соединений в пуле
        max_overflow=20,        # Максимум временных соединений сверх pool_size
        pool_pre_ping=True,     # Проверять соединение перед использованием
        pool_recycle=300,       # Пересоздавать соединения каждые 300 секунд
        echo=False,             # Не выводить SQL-запросы в лог (для продакшена)
        connect_args=connect_args
    )
    
    return engine

def test_connection():
    """Тестируем подключение к базе данных"""
    try:
        engine = create_db_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]
            logger.info(f"✅ Подключение к БД успешно: {version.split()[0]}")
            return True
    except Exception as e:
        logger.error(f"❌ Ошибка подключения к БД: {e}")
        return False

# Создаем engine
try:
    engine = create_db_engine()
    test_connection()  # Тестируем при импорте
except Exception as e:
    logger.error(f"❌ Не удалось создать engine: {e}")
    # Создаем заглушку для импорта
    engine = None

# Создаем сессии
if engine:
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False  # Не сбрасывать объекты после коммита
    )
else:
    SessionLocal = None
    logger.warning("⚠️  SessionLocal не создан. Проверьте подключение к БД.")

# Базовый класс для моделей
Base = declarative_base()

def get_db():
    """
    Dependency для получения сессии БД.
    Используется в FastAPI endpoints.
    """
    if SessionLocal is None:
        raise RuntimeError("❌ База данных не настроена. Проверьте подключение.")
    
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"❌ Ошибка БД: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# Функция для создания таблиц
def create_tables():
    """Создает все таблицы в базе данных"""
    if engine is None:
        logger.error("❌ Engine не создан, таблицы не созданы")
        return False
    
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Таблицы успешно созданы/проверены")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при создании таблиц: {e}")
        return False

# Функция для сброса таблиц (только для разработки!)
def drop_tables():
    """Удаляет все таблицы (ИСПОЛЬЗОВАТЬ С ОСТОРОЖНОСТЬЮ!)"""
    if engine is None:
        logger.error("❌ Engine не создан")
        return False
    
    try:
        Base.metadata.drop_all(bind=engine)
        logger.warning("⚠️  Все таблицы удалены!")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка при удалении таблиц: {e}")
        return False

# Автоматически создаем таблицы при импорте в development
if __name__ != "__main__" and os.getenv("ENVIRONMENT") == "development":
    if engine:
        create_tables()