// Глобальные настройки Chart.js
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.color = '#666';
Chart.defaults.borderColor = '#ddd';
Chart.defaults.font.family = 'monospace';

// Форматирование времени
function formatDateTime(date) {
    const pad = (n) => n < 10 ? '0' + n : n;
    
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

// Генерация цвета для линии
function getRandomColor() {
    // Используем более спокойные цвета
    const colors = [
        'rgb(255, 0, 0)',    // красный
        'rgb(0, 128, 0)',    // зеленый
        'rgb(0, 0, 255)',    // синий
        'rgb(255, 165, 0)',  // оранжевый
        'rgb(128, 0, 128)',  // фиолетовый
        'rgb(0, 128, 128)',  // бирюзовый
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Класс для управления графиками
class SensorCharts {
    constructor() {
        this.charts = new Map();  // type -> Chart
        this.sensorColors = new Map();  // sensorId -> color
        this.initCharts();
        this.startUpdates();
    }

    // Инициализация графиков для каждого типа
    initCharts() {
        for (const [type, sensors] of Object.entries(window.INITIAL_SENSORS)) {
            const canvas = document.getElementById(`${type}-chart`);
            if (!canvas) continue;

            const config = window.SENSOR_TYPES[type];
            
            // Создаём датасеты для каждого сенсора
            const datasets = sensors.map(sensorId => {
                const color = getRandomColor();
                this.sensorColors.set(sensorId, color);
                
                return {
                    label: this.formatSensorName(sensorId),
                    data: [],
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0,
                    fill: false
                };
            });

            // Создаём график
            const chart = new Chart(canvas, {
                type: 'line',
                data: { datasets },
                options: {
                    animation: false,
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: config.name,
                            font: {
                                size: 14,
                                family: 'monospace'
                            },
                            padding: 10
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            titleColor: '#333',
                            bodyColor: '#333',
                            borderColor: '#ccc',
                            borderWidth: 1,
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                label: (context) => {
                                    const value = Number(context.raw.y).toFixed(2);
                                    return `${context.dataset.label}: ${value}${config.unit}`;
                                },
                                title: (tooltipItems) => {
                                    return formatDateTime(new Date(tooltipItems[0].parsed.x));
                                }
                            }
                        },
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 15,
                                padding: 10,
                                font: {
                                    family: 'monospace',
                                    size: 11
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
                                    minute: 'HH:mm:ss'
                                }
                            },
                            grid: {
                                color: '#eee',
                                drawBorder: false,
                                drawTicks: false
                            },
                            ticks: {
                                maxRotation: 0,
                                padding: 5,
                                font: {
                                    size: 10
                                }
                            },
                            position: 'bottom'
                        },
                        y: {
                            min: config.min,
                            max: config.max,
                            grid: {
                                color: '#eee',
                                drawBorder: false,
                                drawTicks: false
                            },
                            ticks: {
                                padding: 5,
                                font: {
                                    size: 10
                                }
                            },
                            position: 'right'
                        }
                    },
                    layout: {
                        padding: {
                            top: 10,
                            right: 10,
                            bottom: 10,
                            left: 10
                        }
                    }
                }
            });

            // Сохраняем график
            this.charts.set(type, {
                chart,
                sensors,
                config
            });
        }
    }

    // Форматирование имени сенсора
    formatSensorName(sensorId) {
        const parts = sensorId.split('_');
        const device = parts[0]
            .replace(/-/g, ' ')
            .replace(/isa|pci/g, '')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
        const sensor = parts[parts.length - 3]
            .replace(/([A-Z])/g, ' $1')
            .trim();
            
        return `${device} - ${sensor}`;
    }

    // Обновление данных графика
    async updateChart(type, info) {
        const { chart, sensors } = info;
        
        try {
            // Получаем новые данные для всех сенсоров
            const updates = await Promise.all(
                sensors.map(async sensorId => {
                    const response = await fetch(`/api/data/${sensorId}`);
                    const data = await response.json();
                    return { sensorId, data };
                })
            );

            // Обновляем все датасеты
            updates.forEach(({ sensorId, data }, index) => {
                chart.data.datasets[index].data = data.map(([x, y]) => ({x, y}));
            });

            chart.update('none');  // без анимации
        } catch (error) {
            console.error(`Error updating ${type}:`, error);
        }
    }

    // Запуск периодического обновления
    startUpdates() {
        // Обновляем каждые 5 секунд
        setInterval(() => {
            for (const [type, info] of this.charts.entries()) {
                this.updateChart(type, info);
            }
        }, 5000);

        // И сразу обновляем первый раз
        for (const [type, info] of this.charts.entries()) {
            this.updateChart(type, info);
        }
    }
}

// Создаём графики когда страница загрузится
document.addEventListener('DOMContentLoaded', () => {
    new SensorCharts();
});
