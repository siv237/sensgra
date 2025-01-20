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
                
                return this.createDataset(sensorId, color);
            });

            // Создаём график
            const chart = this.createChart(`${type}-chart`, {
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
                                generateLabels: (chart) => {
                                    const datasets = chart.data.datasets;
                                    // Создаем массив с данными для сортировки
                                    const items = datasets.map((dataset, i) => ({
                                        value: dataset.value || '',
                                        label: dataset.label,
                                        color: dataset.borderColor,
                                        hidden: dataset.hidden,
                                        index: i,
                                        numValue: dataset.data.length > 0 ? dataset.data[dataset.data.length - 1].y : -Infinity,
                                        highlighted: dataset.highlighted
                                    }));
                                    
                                    // Сортируем по значению
                                    items.sort((a, b) => b.numValue - a.numValue);
                                    
                                    // Возвращаем отсортированные элементы легенды
                                    return items.map(item => ({
                                        text: `${item.value} ${item.label}`,
                                        fillStyle: item.hidden ? 'transparent' : item.color,
                                        strokeStyle: item.color,
                                        lineWidth: item.highlighted ? 3 : 1,
                                        hidden: item.hidden,
                                        index: item.index
                                    }));
                                },
                                usePointStyle: false,
                                boxWidth: 12,
                                padding: 8,
                                font: {
                                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                    size: 12
                                }
                            },
                            onClick: (e, legendItem, legend) => {
                                const index = legendItem.index;
                                const chart = legend.chart;
                                const meta = chart.getDatasetMeta(index);
                                const dataset = chart.data.datasets[index];

                                // Определяем текущее состояние
                                if (!dataset.highlighted && !meta.hidden) {
                                    // Обычный -> Жирный
                                    dataset.highlighted = true;
                                    dataset.borderWidth = 3;
                                } else if (dataset.highlighted && !meta.hidden) {
                                    // Жирный -> Скрытый
                                    meta.hidden = true;
                                    dataset.hidden = true;
                                    dataset.highlighted = false;
                                    dataset.borderWidth = 1;
                                } else {
                                    // Скрытый -> Обычный
                                    meta.hidden = false;
                                    dataset.hidden = false;
                                    dataset.highlighted = false;
                                    dataset.borderWidth = 1;
                                }

                                chart.update();
                            },
                            onHover: (e, legendItem, legend) => {
                                e.native.target.style.cursor = 'pointer';
                            },
                            onLeave: (e, legendItem, legend) => {
                                e.native.target.style.cursor = 'default';
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

    createChart(canvasId, config) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const chart = new Chart(ctx, config);

        return chart;
    }

    // Создание датасета для сенсора
    createDataset(sensorId, color) {
        return {
            label: this.formatSensorName(sensorId),
            data: [],
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 1,  // Начальная толщина 1
            highlighted: false,
            pointRadius: 0,
            tension: 0.1,
            fill: false
        };
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

    // Форматирование значения с единицей измерения
    formatValue(value, unit) {
        const formatted = Number(value).toFixed(2);
        return `${formatted}${unit}`.padEnd(8);
    }

    // Обновление легенды с текущими значениями
    updateLegend(chart, updates, config) {
        const datasets = chart.data.datasets;
        updates.forEach(({ sensorId, data }, i) => {
            if (data && data.length > 0) {
                const lastValue = data[data.length - 1][1];
                const name = this.formatSensorName(sensorId);
                const value = this.formatValue(lastValue, config.unit);
                datasets[i].label = name;
                datasets[i].value = value;
            }
        });
    }

    // Обновление данных графика
    async updateChart(type, info) {
        const { chart, sensors, config } = info;
        
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

            // Обновляем легенду с текущими значениями
            this.updateLegend(chart, updates, config);

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
