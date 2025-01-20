#!/usr/bin/env python3
import json
import os
import subprocess
import time
from datetime import datetime
import rrdtool
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class SensorLogger:
    def __init__(self, rrd_dir='rrd'):
        self.rrd_dir = rrd_dir
        os.makedirs(rrd_dir, exist_ok=True)
        self.known_sensors = set()
        self._load_known_sensors()

    def _load_known_sensors(self):
        """Загружает список известных сенсоров из существующих RRD файлов"""
        if os.path.exists(self.rrd_dir):
            for file in os.listdir(self.rrd_dir):
                if file.endswith('.rrd'):
                    self.known_sensors.add(file[:-4])  # убираем .rrd

    def _create_rrd(self, sensor_id):
        """Создает новую RRD базу для сенсора с заданными параметрами хранения"""
        rrd_path = os.path.join(self.rrd_dir, f"{sensor_id}.rrd")
        
        # Создаем RRD с четырьмя уровнями детализации:
        # - 7 дней с шагом 30 секунд (20160 точек)
        # - 30 дней с шагом 5 минут (8640 точек) 
        # - 1 год с шагом 30 минут (17520 точек)
        # - 4 года с шагом 2 часа (17520 точек)
        rrdtool.create(
            rrd_path,
            '--step', '30',
            'DS:value:GAUGE:60:U:U',
            'RRA:AVERAGE:0.5:1:20160',    # 7 дней, 30 сек
            'RRA:AVERAGE:0.5:10:8640',    # 30 дней, 5 мин
            'RRA:AVERAGE:0.5:60:17520',   # 1 год, 30 мин
            'RRA:AVERAGE:0.5:240:17520',  # 4 года, 2 часа
            'RRA:MIN:0.5:1:20160',
            'RRA:MIN:0.5:10:8640',
            'RRA:MIN:0.5:60:17520',
            'RRA:MIN:0.5:240:17520',
            'RRA:MAX:0.5:1:20160',
            'RRA:MAX:0.5:10:8640',
            'RRA:MAX:0.5:60:17520',
            'RRA:MAX:0.5:240:17520'
        )
        self.known_sensors.add(sensor_id)
        logging.info(f"Создана новая RRD база для сенсора: {sensor_id}")

    def _update_rrd(self, sensor_id, value, timestamp=None):
        """Обновляет значение в RRD базе для указанного сенсора"""
        if timestamp is None:
            timestamp = 'N'
        rrd_path = os.path.join(self.rrd_dir, f"{sensor_id}.rrd")
        try:
            rrdtool.update(rrd_path, f'{timestamp}:{value}')
        except Exception as e:
            logging.error(f"Ошибка обновления RRD для {sensor_id}: {e}")

    def _get_sensors_data(self):
        """Получает данные со всех сенсоров через sensors -j"""
        try:
            result = subprocess.run(['sensors', '-j'], capture_output=True, text=True)
            if result.returncode != 0:
                logging.error(f"Ошибка выполнения sensors: {result.stderr}")
                return {}
            return json.loads(result.stdout)
        except Exception as e:
            logging.error(f"Ошибка получения данных с сенсоров: {e}")
            return {}

    def _process_sensor_data(self, data, device_id='', prefix=''):
        """Рекурсивно обрабатывает данные сенсоров и обновляет RRD"""
        for key, value in data.items():
            if isinstance(value, dict):
                # Рекурсивно обрабатываем вложенные словари
                new_prefix = f"{prefix}_{key}" if prefix else key
                self._process_sensor_data(value, device_id, new_prefix)
            elif isinstance(value, (int, float)):
                # Это значение сенсора
                sensor_id = f"{device_id}_{prefix}_{key}".replace(' ', '_')
                if sensor_id not in self.known_sensors:
                    self._create_rrd(sensor_id)
                self._update_rrd(sensor_id, value)

    def update(self):
        """Обновляет данные со всех сенсоров"""
        sensors_data = self._get_sensors_data()
        for device_id, device_data in sensors_data.items():
            self._process_sensor_data(device_data, device_id)

def main():
    logger = SensorLogger()
    logging.info("Запущен сбор данных с сенсоров")
    
    while True:
        try:
            logger.update()
            time.sleep(5)  # Пауза 5 секунд между обновлениями
        except KeyboardInterrupt:
            logging.info("Получен сигнал завершения")
            break
        except Exception as e:
            logging.error(f"Неожиданная ошибка: {e}")
            time.sleep(5)  # Пауза перед повторной попыткой

if __name__ == '__main__':
    main()
