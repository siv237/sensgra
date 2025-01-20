#!/bin/bash

# Проверяем есть ли venv, если нет - создаём
if [ ! -d "venv" ]; then
    echo "Создаём виртуальное окружение..."
    python3 -m venv venv
fi

# Активируем venv и устанавливаем зависимости
source venv/bin/activate
pip install -r requirements.txt

# Запускаем логгер
./sensor-logger.py
