import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
import logging

# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

def get_database_url():
    """
    Получаем URL базы данных для Render.
    Render предоставляет DATABASE_URL в формате:
    postgresql://user:password@host:port/database
    """
    
    # 1. Проверяем есть ли DATABASE_URL от Render
    database_url = os.getenv("DATABASE_URL")
    
    # 2. ДЛЯ RENDER: Исправляем схему если нужно
    if database_url:
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
            logger.info("✅ Исправлен протокол подключения к БД (postgres -> postgresql)")
        
        # Проверяем что это URL от Render (не локальный)
        if "render.com" in database_url or "dpg-" in database_url:
            logger.info("🌐 Используется PostgreSQL от Render")
        else:
            logger.info("📁 Используется внешняя PostgreSQL")
        
        logger.info(f"🔧 URL БД: {database_url.split('@')[1] if '@' in database_url else database_url[:50]}...")
        return database_url
    
    # 3. Если DATABASE_URL нет - РЕЖИМ ЭМЕРГЕНЦИИ
    logger.warning("⚠️  DATABASE_URL не найден! Проверьте Environment Variables на Render.")
    
    # 3.1 Сначала проверим альтернативные переменные
    for var_name in ["POSTGRES_URL", "POSTGRESQL_URL", "DB_URL"]:
        alt_url = os.getenv(var_name)
        if alt_url:
            logger.info(f"✅ Найден альтернативный URL: {var_name}")
            return alt_url
    
    # 3.2 Фоллбэк для тестирования
    logger.error("❌ DATABASE_URL не установлен! Используем SQLite для тестирования.")
    return "sqlite:///./avtorend_test.db"

def create_db_engine():
    """Создаем engine с настройками для Render"""
    
    database_url = get_database_url()
    
    # Параметры подключения
    connect_args = {}
    
    # Для SQLite
    if "sqlite" in database_url:
        connect_args = {"check_same_thread": False}
        logger.warning("⚠️  Используется SQLite! Данные будут храниться временно.")
    
    # Для PostgreSQL на Render
    else:
        # Важные настройки для Render PostgreSQL
        connect_args = {
            "connect_timeout": 10,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5
        }
    
    try:
        engine = create_engine(
            database_url,
            # Оптимальные настройки для Render
            pool_size=5,           # Меньше для бесплатного плана
            max_overflow=10,       # Небольшой оверфлоу
            pool_pre_ping=True,    # Критически важно для Render!
            pool_recycle=300,      # Пересоздавать соединения
            pool_timeout=30,       # Таймаут для получения соединения
            echo=False,            # Не логировать SQL (можно включить для дебага)
            connect_args=connect_args
        )
        
        logger.info("✅ Engine базы данных создан")
        return engine
        
    except Exception as e:
        logger.error(f"❌ Ошибка создания engine: {e}")
        
        # Фоллбэк: простой engine для продолжения работы
        if "postgresql" in database_url:
            # Пробуем создать без сложных настроек
            try:
                engine = create_engine(database_url, echo=False)
                logger.info("✅ Engine создан с минимальными настройками")
                return engine
            except:
                pass
        
        # Последний шанс: SQLite
        logger.warning("🔄 Переход на SQLite...")
        return create_engine("sqlite:///./fallback.db", connect_args={"check_same_thread": False})

def test_connection():
    """Тестируем подключение к базе данных"""
    try:
        engine = create_db_engine()
        with engine.connect() as conn:
            # Разный SQL для разных СУБД
            if "sqlite" in str(engine.url):
                result = conn.execute(text("SELECT sqlite_version();"))
                version = result.fetchone()[0]
                db_type = "SQLite"
            else:
                result = conn.execute(text("SELECT version();"))
                version = result.fetchone()[0]
                db_type = version.split()[0] if version else "PostgreSQL"
            
            # Получаем список таблиц
            if "sqlite" in str(engine.url):
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            else:
                result = conn.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
            
            tables = [row[0] for row in result]
            
            logger.info(f"✅ Подключение к БД успешно: {db_type} v{version}")
            logger.info(f"📊 Таблиц в базе: {len(tables)}")
            if tables:
                logger.info(f"📋 Таблицы: {tables}")
            
            return {
                "connected": True,
                "type": db_type,
                "version": version,
                "tables": tables,
                "tables_count": len(tables)
            }
            
    except Exception as e:
        logger.error(f"❌ Ошибка подключения к БД: {e}")
        return {
            "connected": False,
            "error": str(e),
            "type": "unknown"
        }

# Создаем engine глобально
try:
    engine = create_db_engine()
    # Не тестируем при импорте - может замедлить запуск
    logger.info("🔧 Engine инициализирован (тестирование отложено)")
except Exception as e:
    logger.error(f"❌ Не удалось создать engine: {e}")
    engine = None

# Создаем сессии
if engine:
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False
    )
else:
    SessionLocal = None
    logger.warning("⚠️  SessionLocal не создан.")

# Базовый класс для моделей
Base = declarative_base()

def get_db():
    """Dependency для получения сессии БД"""
    if SessionLocal is None:
        logger.error("❌ SessionLocal не инициализирован")
        # Возвращаем заглушку чтобы FastAPI не падал
        class DummyDB:
            def close(self): pass
            def commit(self): pass
            def rollback(self): pass
            def execute(self, *args, **kwargs):
                raise RuntimeError("База данных недоступна")
            def query(self, *args, **kwargs):
                raise RuntimeError("База данных недоступна")
        
        db = DummyDB()
        try:
            yield db
        finally:
            db.close()
        return
    
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"❌ Ошибка БД в сессии: {e}")
        db.rollback()
        raise
    finally:
        db.close()

# Функция для создания таблиц
def create_tables():
    """Создает все таблицы в базе данных"""
    if engine is None:
        logger.error("❌ Engine не создан")
        return False
    
    try:
        logger.info("🗄️  Начинаем создание таблиц...")
        Base.metadata.create_all(bind=engine)
        
        # Проверяем что создалось
        with engine.connect() as conn:
            if "sqlite" in str(engine.url):
                result = conn.execute(text("SELECT COUNT(name) FROM sqlite_master WHERE type='table';"))
            else:
                result = conn.execute(text("""
                    SELECT COUNT(table_name) 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
            
            table_count = result.scalar()
        
        logger.info(f"✅ Таблицы успешно созданы. Всего таблиц: {table_count}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка при создании таблиц: {e}")
        return False

# Добавим функцию для проверки на Render
def check_render_environment():
    """Проверяем что мы на Render и настройки верны"""
    is_render = bool(os.getenv("RENDER"))
    has_db_url = bool(os.getenv("DATABASE_URL"))
    
    logger.info(f"🌐 Render окружение: {is_render}")
    logger.info(f"🔗 DATABASE_URL установлен: {has_db_url}")
    
    if is_render and not has_db_url:
        logger.error("❌ ВНИМАНИЕ: Вы на Render, но DATABASE_URL не установлен!")
        logger.error("   Добавьте DATABASE_URL в Environment Variables")
        logger.error("   Или создайте PostgreSQL сервис на Render")
    
    return {
        "is_render": is_render,
        "has_db_url": has_db_url,
        "python_version": sys.version
    }

# Автоматически проверяем окружение при импорте
if __name__ != "__main__":
    check_render_environment()
