#!/usr/bin/env python3
import json
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import rrdtool
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Загружаем конфиг типов сенсоров
with open('static/sensor_types.json', 'r') as f:
    SENSOR_TYPES = json.load(f)['types']

# Путь к файлу состояния
CHART_STATE_FILE = 'static/chart_state.json'

# Загружаем состояние при старте
def load_chart_state():
    if os.path.exists(CHART_STATE_FILE):
        try:
            with open(CHART_STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

# Сохраняем состояние
def save_chart_state(state):
    os.makedirs(os.path.dirname(CHART_STATE_FILE), exist_ok=True)
    with open(CHART_STATE_FILE, 'w') as f:
        json.dump(state, f)

# Глобальное состояние графиков
CHART_STATE = load_chart_state()

class SensorManager:
    def __init__(self, rrd_dir: str = 'rrd'):
        self.rrd_dir = rrd_dir
        self.sensors: Dict[str, List[str]] = {}  # type -> [sensor_names]
        self._scan_sensors()

    def _scan_sensors(self):
        """Сканирует RRD файлы и группирует их по типам"""
        if not os.path.exists(self.rrd_dir):
            return

        # Сбрасываем список сенсоров
        self.sensors = {type_name: [] for type_name in SENSOR_TYPES}
        
        # Сканируем все RRD файлы
        for file in os.listdir(self.rrd_dir):
            if not file.endswith('.rrd'):
                continue
                
            sensor_name = file[:-4]  # убираем .rrd
            
            # Определяем тип сенсора по регуляркам
            for type_name, type_config in SENSOR_TYPES.items():
                for pattern in type_config['matches']:
                    if re.search(pattern, sensor_name):
                        self.sensors[type_name].append(sensor_name)
                        break

    def get_sensor_data(self, sensor_name: str, start: Optional[str] = None, end: str = 'now') -> List[tuple]:
        """Получает данные сенсора из RRD"""
        rrd_path = os.path.join(self.rrd_dir, f"{sensor_name}.rrd")
        if not os.path.exists(rrd_path):
            return []

        # Определяем временной интервал
        if start is None:
            start = 'end-1h'  # последний час по умолчанию

        try:
            # Получаем данные из RRD
            data = rrdtool.fetch(
                rrd_path,
                'AVERAGE',
                '--start', start,
                '--end', end
            )
            
            # Распаковываем данные
            start_time, end_time, step = data[0]
            columns = data[1]
            values = data[2]
            
            # Формируем список точек [timestamp, value]
            points = []
            timestamp = start_time
            for row in values:
                if row[0] is not None:  # пропускаем пустые значения
                    points.append((timestamp * 1000, float(row[0])))
                timestamp += step
                
            return points
            
        except Exception as e:
            app.logger.error(f"Ошибка чтения RRD {sensor_name}: {e}")
            return []

    def get_sensors_by_type(self, type_name: str) -> List[str]:
        """Возвращает список сенсоров заданного типа"""
        return sorted(self.sensors.get(type_name, []))

    def get_device_name(self, sensor_name: str) -> str:
        """Извлекает имя устройства из имени сенсора"""
        # Имя до первого подчеркивания - имя устройства
        device = sensor_name.split('_')[0]
        
        # Делаем имя красивее
        device = device.replace('-', ' ').replace('isa', '').replace('pci', '')
        device = ' '.join(word.capitalize() for word in device.split())
        
        return device

# Создаём менеджер сенсоров
sensor_manager = SensorManager()

@app.route('/')
def index():
    """Главная страница"""
    return render_template(
        'index.html',
        sensor_types=SENSOR_TYPES,
        sensors=sensor_manager.sensors
    )

@app.route('/api/sensors/<type_name>')
def get_sensors(type_name):
    """API: список сенсоров заданного типа"""
    if type_name not in SENSOR_TYPES:
        return jsonify({'error': 'Unknown sensor type'}), 404
        
    sensors = []
    for sensor in sensor_manager.get_sensors_by_type(type_name):
        sensors.append({
            'id': sensor,
            'device': sensor_manager.get_device_name(sensor),
            'name': sensor.split('_')[-3]  # последняя часть перед _input
        })
        
    return jsonify(sensors)

@app.route('/api/data/<sensor_name>')
def get_sensor_data(sensor_name):
    """API: данные сенсора"""
    # Получаем временной диапазон из query string
    start = request.args.get('start')
    end = request.args.get('end', 'now')
    
    app.logger.info(f"Запрос данных: sensor={sensor_name}, start={start}, end={end}")
    
    # Получаем данные с учетом диапазона
    data = sensor_manager.get_sensor_data(sensor_name, start, end)
    
    app.logger.info(f"Возвращаем {len(data)} точек данных")
    return jsonify(data)

@app.route('/api/chart_state', methods=['GET'])
def get_chart_state():
    """Получить состояние всех графиков"""
    return jsonify(CHART_STATE)

@app.route('/api/chart_state', methods=['POST'])
def update_chart_state():
    """Обновить состояние графиков"""
    global CHART_STATE
    CHART_STATE = request.json
    save_chart_state(CHART_STATE)
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=23723, debug=True)
