# Sensgra

Система мониторинга показаний системных сенсоров с долгосрочным хранением данных и визуализацией.

## Возможности

- Автоматическое обнаружение и мониторинг всех доступных сенсоров
- Адаптивное создание баз данных для новых сенсоров
- Интерактивные графики с гибкой настройкой отображения
- Эффективное хранение истории с автоматическим усреднением (RRDtool)
- Сохранение пользовательских настроек отображения

## Компоненты

Система состоит из двух независимых компонентов:

1. **sensor-logger.py** - демон для сбора данных:
   - Автоматически находит все доступные сенсоры через lm-sensors
   - При появлении новых сенсоров создаёт для них базы данных
   - Работает полностью автономно без настройки
   - Собирает данные каждые 5 секунд
   - Автоматическое усреднение старых данных

2. **app.py** - веб-интерфейс для визуализации:
   - Строит интерактивные графики на основе RRD
   - Позволяет включать/отключать отображение сенсоров
   - Запоминает настройки отображения
   - Гибкая группировка по типам данных

## Хранение данных

Для каждого сенсора автоматически создаётся RRD база с четырьмя уровнями детализации:

- 7 дней с шагом 30 секунд (20160 точек)
- 30 дней с шагом 5 минут (8640 точек)
- 1 год с шагом 30 минут (17520 точек)
- 4 года с шагом 2 часа (17520 точек)

Это позволяет хранить:
- Детальные данные за последнюю неделю
- Подробную историю за месяц
- Средние значения за год
- Долгосрочную историю за 4 года

При этом размер базы остаётся постоянным независимо от времени работы.

## Настройка отображения

- Настройки влияют только на отображение в веб-интерфейсе
- Логгер работает независимо от этого файла
- Сенсоры группируются по типу для удобства просмотра
- Можно задавать свои имена для устройств и сенсоров
- Состояние графиков (видимость и выделение) сохраняется на сервере
- Поддерживаются три состояния для каждого датчика:
  - Обычное отображение (тонкая линия)
  - Выделенное состояние (жирная линия)
  - Скрытое состояние (датчик не отображается)
- Состояние сохраняется при:
  - Перезагрузке страницы
  - Переключении периода отображения
  - Перезапуске сервера

## Требования

- Python 3.11+
- lm-sensors
- RRDtool с библиотеками разработки
- Современный веб-браузер

## Установка

1. Установите системные зависимости:
```bash
# Debian/Ubuntu
sudo apt install python3-venv lm-sensors rrdtool librrd-dev

# Arch Linux
sudo pacman -S python lm_sensors rrdtool

# Fedora
sudo dnf install python3 lm_sensors rrdtool rrdtool-devel
```

2. Настройте и проверьте lm-sensors:
```bash
# Автоматическое обнаружение сенсоров
sudo sensors-detect --auto

# Убедитесь что загружены нужные модули ядра
sudo modprobe coretemp  # Сенсоры температуры процессора
sudo modprobe nct6775   # Сенсоры материнской платы (если есть)
sudo modprobe drivetemp # Сенсоры температуры жестких дисков

# Проверка что сенсоры определились
sensors -j
```

3. Настройте калибровку сенсоров:
```bash
# Основной конфиг lm-sensors находится в /etc/sensors3.conf
# Пользовательские настройки нужно размещать в /etc/sensors.d/
# чтобы они не затерлись при обновлении пакета

# Создаем файл с настройками для вашей материнской платы
sudo nano /etc/sensors.d/myboard.conf

# Пример содержимого файла:
chip "nct6779-*"
    # Названия сенсоров
    label in0 "Vcore"
    label in2 "AVCC"
    label in3 "+3.3V"
    label in7 "3VSB"
    label in8 "Vbat"

    # Пределы напряжений (90-110% от номинала)
    set in2_min  3.3 * 0.90
    set in2_max  3.3 * 1.10
    set in3_min  3.3 * 0.90
    set in3_max  3.3 * 1.10

    # Коррекция показаний (если значения неточные)
    compute in3  @*2, @/2  # Умножить на 2 при чтении, делить на 2 при записи

# Применяем новые настройки
sudo service kmod restart
```

4. Добавьте модули в автозагрузку:
```bash
# Создаем конфиг для автозагрузки модулей
echo "coretemp" | sudo tee /etc/modules-load.d/sensors.conf
echo "nct6775" | sudo tee -a /etc/modules-load.d/sensors.conf
echo "drivetemp" | sudo tee -a /etc/modules-load.d/sensors.conf

# Применяем изменения
sudo systemctl restart systemd-modules-load
```

5. Клонируйте репозиторий и перейдите в директорию:
```bash
git clone https://github.com/siv237/sensgra.git
cd sensgra
```

6. Запустите скрипт установки и запуска:
```bash
# Создаст venv, установит зависимости и запустит логгер
./run.sh
```

После запуска логгер будет:
- Автоматически находить все доступные сенсоры
- Создавать RRD базы для новых сенсоров
- Собирать данные каждые 5 секунд
- Хранить историю с автоматическим усреднением

## Установка как системная служба

1. Создайте симлинк на файл службы (нужны права root для доступа к сенсорам):
```bash
sudo ln -sf /path/to/sensgra/sensgra.service /etc/systemd/system/
```

2. Перезагрузите конфигурацию systemd и запустите:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sensgra
sudo systemctl start sensgra
```

Служба запускается от пользователя root, так как для чтения данных с сенсоров требуются соответствующие права доступа.

Управление службой:
- Остановка: `sudo systemctl stop sensgra`
- Перезапуск: `sudo systemctl restart sensgra`
- Просмотр логов: `sudo journalctl -u sensgra`
- Статус: `sudo systemctl status sensgra`



## Структура проекта

- `sensor-logger.py` - демон сбора данных
- `app.py` - веб-сервер Flask
- `templates/` - шаблоны страниц
- `static/` - статические файлы (JS, CSS)
- `rrd/` - директория с RRD базами данных
