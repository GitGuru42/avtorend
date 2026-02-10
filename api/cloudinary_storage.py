"""
cloudinary_storage.py - Универсальное хранилище для фото
Поддерживает Cloudinary для продакшена и локальное для разработки
"""

import os
import logging
from pathlib import Path
from typing import List, Optional
import hashlib
from datetime import datetime

logger = logging.getLogger(__name__)

class CarPhotoStorage:
    """Класс для управления хранением фото автомобилей"""
    
    def __init__(self):
        self.use_cloudinary = bool(os.getenv('CLOUDINARY_API_KEY'))
        
        if self.use_cloudinary:
            try:
                import cloudinary
                import cloudinary.uploader
                import cloudinary.api
                
                cloudinary.config(
                    cloud_name=os.getenv('CLOUDINARY_CLOUD_NAME'),
                    api_key=os.getenv('CLOUDINARY_API_KEY'),
                    api_secret=os.getenv('CLOUDINARY_API_SECRET'),
                    secure=True
                )
                self.cloudinary = cloudinary
                logger.info("✅ Cloudinary настроен")
            except ImportError:
                logger.error("❌ Cloudinary не установлен. Используйте: pip install cloudinary")
                self.use_cloudinary = False
            except Exception as e:
                logger.error(f"❌ Ошибка настройки Cloudinary: {e}")
                self.use_cloudinary = False
        
        # Локальная директория для загрузки
        if os.getenv("RENDER"):
            self.upload_dir = Path("/opt/render/project/src/static/uploads/cars")
        else:
            self.upload_dir = Path("static/uploads/cars")
        
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    def save_photo(self, temp_file_path: str, car_id: int, photo_index: int) -> str:
        """
        Сохраняет фото и возвращает URL
        
        Args:
            temp_file_path: путь к временному файлу
            car_id: ID автомобиля
            photo_index: индекс фото (0, 1, 2...)
        
        Returns:
            URL фото (Cloudinary или локальный)
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        original_filename = Path(temp_file_path).name
        filename_base = f"car_{car_id}_{timestamp}_{photo_index}"
        
        if self.use_cloudinary:
            return self._save_to_cloudinary(temp_file_path, car_id, filename_base)
        else:
            return self._save_locally(temp_file_path, car_id, filename_base, original_filename)
    
    def _save_to_cloudinary(self, file_path: str, car_id: int, filename_base: str) -> str:
        """Сохраняет фото в Cloudinary"""
        try:
            # Создаем уникальный public_id
            public_id = f"avtorend/car_{car_id}/{filename_base}"
            
            # Загружаем в Cloudinary
            result = self.cloudinary.uploader.upload(
                file_path,
                public_id=public_id,
                folder=f"avtorend/car_{car_id}",
                overwrite=False,
                resource_type="image",
                transformation=[
                    {"width": 1200, "height": 800, "crop": "limit", "quality": "auto"},
                    {"fetch_format": "auto"}
                ]
            )
            
            # Возвращаем оптимизированный URL
            optimized_url = self.cloudinary.CloudinaryImage(public_id).build_url(
                width=800,
                height=600,
                crop="fill",
                gravity="auto",
                quality="auto",
                fetch_format="webp"  # Современный формат
            )
            
            logger.info(f"✅ Фото загружено в Cloudinary: {public_id}")
            return optimized_url
            
        except Exception as e:
            logger.error(f"❌ Ошибка загрузки в Cloudinary: {e}")
            # Fallback: сохраняем локально
            return self._save_locally(file_path, car_id, filename_base, "cloudinary_fallback.jpg")
    
    def _save_locally(self, file_path: str, car_id: int, filename_base: str, original_name: str) -> str:
        """Сохраняет фото локально (для разработки)"""
        try:
            from PIL import Image
            
            # Создаем имя файла
            ext = Path(original_name).suffix or ".jpg"
            filename = f"{filename_base}{ext}"
            target_path = self.upload_dir / filename
            
            # Оптимизируем и сохраняем
            img = Image.open(file_path)
            
            # Ресайз для веба
            if img.height > 1080 or img.width > 1920:
                img.thumbnail((1920, 1080))
            
            # Конвертируем в RGB если нужно
            if img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else img)
                img = background
            
            img.save(target_path, "JPEG", quality=85, optimize=True)
            
            # Возвращаем веб-путь
            web_path = f"/static/uploads/cars/{filename}"
            logger.info(f"✅ Фото сохранено локально: {target_path}")
            return web_path
            
        except Exception as e:
            logger.error(f"❌ Ошибка локального сохранения: {e}")
            # Возвращаем placeholder
            return "/static/uploads/cars/placeholder.jpg"
    
    def delete_photo(self, photo_url: str) -> bool:
        """Удаляет фото по URL"""
        if self.use_cloudinary and "res.cloudinary.com" in photo_url:
            try:
                # Извлекаем public_id из URL
                parts = photo_url.split('/')
                public_id = parts[-1].split('.')[0]  # Берем имя без расширения
                public_id = f"avtorend/{public_id}"
                
                result = self.cloudinary.uploader.destroy(public_id)
                return result.get('result') == 'ok'
            except Exception as e:
                logger.error(f"❌ Ошибка удаления из Cloudinary: {e}")
                return False
        
        # Локальное удаление
        elif photo_url.startswith('/static/'):
            try:
                local_path = photo_url[1:]  # Убираем первый слэш
                file_path = Path(local_path)
                if file_path.exists():
                    file_path.unlink()
                    return True
            except Exception as e:
                logger.error(f"❌ Ошибка локального удаления: {e}")
        
        return False
    
    def delete_all_car_photos(self, car_id: int) -> bool:
        """Удаляет все фото автомобиля"""
        if self.use_cloudinary:
            try:
                # Удаляем всю папку с фото автомобиля
                result = self.cloudinary.api.delete_resources_by_prefix(f"avtorend/car_{car_id}/")
                return result.get('deleted', {})
            except Exception as e:
                logger.error(f"❌ Ошибка удаления фото автомобиля: {e}")
                return {}
        
        # Локальное удаление
        try:
            deleted_files = []
            pattern = f"car_{car_id}_*"
            for file_path in self.upload_dir.glob(pattern):
                file_path.unlink()
                deleted_files.append(file_path.name)
            return len(deleted_files) > 0
        except Exception as e:
            logger.error(f"❌ Ошибка локального удаления фото: {e}")
            return False

# Синглтон экземпляр
photo_storage = CarPhotoStorage()
