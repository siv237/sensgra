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
        'rgb(255, 99, 132)',   // красный
        'rgb(75, 192, 192)',   // бирюзовый
        'rgb(54, 162, 235)',   // синий
        'rgb(255, 159, 64)',   // оранжевый
        'rgb(153, 102, 255)',  // фиолетовый
        'rgb(255, 205, 86)',   // желтый
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Класс для управления графиками
class SensorCharts {
    constructor() {
        this.charts = new Map();  // type -> Chart
        this.sensorColors = new Map();  // sensorId -> color
        this.currentPeriod = '10m';  // период по умолчанию
        
        // Инициализация
        this.initPeriodButtons();
        this.initCharts();
        this.startUpdates();
        
        console.log('SensorCharts initialized');
    }

    // Инициализация кнопок периода
    initPeriodButtons() {
        console.log('Initializing period buttons');
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                console.log('Period button clicked:', btn.dataset.period);
                
                // Убираем active со всех кнопок
                document.querySelectorAll('.period-btn').forEach(b => 
                    b.classList.remove('active')
                );
                
                // Добавляем active на нажатую кнопку
                btn.classList.add('active');
                
                // Обновляем период и перезагружаем данные
                this.currentPeriod = btn.dataset.period;
                this.reloadAllData();
            });
        });
    }

    // Получение временного диапазона для текущего периода
    getPeriodRange() {
        const now = Date.now();
        let startTime;
        
        switch(this.currentPeriod) {
            case '10m': startTime = now - 10 * 60 * 1000; break;
            case '1h':  startTime = now - 60 * 60 * 1000; break;
            case '1d':  startTime = now - 24 * 60 * 60 * 1000; break;
            case '1w':  startTime = now - 7 * 24 * 60 * 60 * 1000; break;
            default:    startTime = now - 60 * 60 * 1000;
        }
        
        // Для API используем RRDtool формат
        const start = `end-${this.currentPeriod}`;
        const end = 'now';
        
        console.log('Time range:', { start, end, period: this.currentPeriod, 
                                   startTime: new Date(startTime), 
                                   endTime: new Date(now) });
        
        return { start, end, startTime, endTime: now };
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

    // Создание графика
    createChart(canvasId, config) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                animation: false,
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'DD.MM.YYYY'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Время'
                        },
                        // Явно задаем границы оси X
                        min: undefined,  // Будем устанавливать динамически
                        max: undefined,  // Будем устанавливать динамически
                        grid: {
                            display: true,
                            color: (ctx) => {
                                const hour = new Date(ctx.tick.value).getHours();
                                return hour === 0 ? '#666' : '#eee';
                            },
                            lineWidth: (ctx) => {
                                const hour = new Date(ctx.tick.value).getHours();
                                return hour === 0 ? 1 : 0.5;
                            }
                        },
                        ticks: {
                            source: 'auto',
                            maxRotation: 0,
                            callback: function(value) {
                                const date = new Date(value);
                                const hours = date.getHours();
                                if (hours === 0) {
                                    return date.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'});
                                }
                                return date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: config.unit
                        },
                        min: config.min,
                        max: config.max
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: config.name,
                        font: {
                            size: 16,
                            family: 'monospace'
                        },
                        padding: 20
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        titleColor: '#333',
                        bodyColor: '#333',
                        borderColor: '#ccc',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            title: (items) => formatDateTime(new Date(items[0].parsed.x)),
                            label: (item) => {
                                const value = item.parsed.y.toFixed(1);
                                return `${item.dataset.label}: ${value}${config.unit}`;
                            }
                        }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 10,
                            font: {
                                family: 'monospace'
                            },
                            generateLabels: (chart) => {
                                return chart.data.datasets.map((dataset, i) => ({
                                    text: `${dataset.value || ''} ${dataset.label}`,
                                    fillStyle: dataset.borderColor,
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: dataset.borderWidth,
                                    hidden: dataset.hidden,
                                    index: i
                                }));
                            }
                        },
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.index;
                            const chart = legend.chart;
                            const meta = chart.getDatasetMeta(index);
                            const dataset = chart.data.datasets[index];

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
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvasId.split('-')[0], chart);
        return chart;
    }

    // Создание датасета для сенсора
    createDataset(sensorId, color) {
        return {
            label: this.formatSensorName(sensorId),
            sensorId: sensorId,
            data: [],
            borderColor: color,
            backgroundColor: color,
            borderWidth: 1,
            tension: 0.2,
            pointRadius: 0,
            fill: false,
            spanGaps: false  // Не соединять точки если между ними большой промежуток
        };
    }

    // Инициализация графиков
    initCharts() {
        console.log('Initializing charts');
        for (const [type, config] of Object.entries(window.SENSOR_TYPES)) {
            const sensors = window.INITIAL_SENSORS[type] || [];
            if (!sensors.length) continue;

            console.log(`Creating chart for ${type} with ${sensors.length} sensors`);
            
            // Создаём график
            const chart = this.createChart(`${type}-chart`, config);
            
            // Добавляем датасеты для каждого сенсора
            sensors.forEach(sensorId => {
                const color = getRandomColor();
                this.sensorColors.set(sensorId, color);
                chart.data.datasets.push(this.createDataset(sensorId, color));
            });
            
            chart.update();
            
            // Загружаем начальные данные
            this.loadChartData(type, chart);
        }
    }

    // Загрузка данных для всего графика
    async loadChartData(type, chart) {
        console.log(`Loading data for ${type}`);
        const { start, end, startTime, endTime } = this.getPeriodRange();
        
        // Устанавливаем границы оси X
        chart.options.scales.x.min = startTime;
        chart.options.scales.x.max = endTime;
        
        // Настраиваем unit в зависимости от периода
        switch(this.currentPeriod) {
            case '10m':
                chart.options.scales.x.time.unit = 'minute';
                chart.options.scales.x.time.stepSize = 1;
                break;
            case '1h':
                chart.options.scales.x.time.unit = 'minute';
                chart.options.scales.x.time.stepSize = 5;
                break;
            case '1d':
                chart.options.scales.x.time.unit = 'hour';
                chart.options.scales.x.time.stepSize = 2;
                break;
            case '1w':
                chart.options.scales.x.time.unit = 'day';
                chart.options.scales.x.time.stepSize = 1;
                break;
        }
        
        // Загружаем данные для каждого сенсора
        const updates = await Promise.all(
            chart.data.datasets.map(async dataset => {
                const url = `/api/data/${dataset.sensorId}?start=${start}&end=${end}`;
                console.log(`Fetching: ${url}`);
                
                try {
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log(`Got ${data.length} points for ${dataset.sensorId}`);
                    
                    // Обновляем данные
                    dataset.data = data;
                    
                    // Обновляем значение в легенде
                    if (data.length > 0) {
                        const lastValue = data[data.length - 1][1];
                        dataset.value = lastValue.toFixed(1);
                    }
                    
                } catch (error) {
                    console.error(`Error loading data for ${dataset.sensorId}:`, error);
                }
            })
        );
        
        chart.update('none');
    }

    // Перезагрузка данных для всех графиков
    reloadAllData() {
        console.log('Reloading all data');
        for (const [type, chart] of this.charts.entries()) {
            this.loadChartData(type, chart);
        }
    }

    // Запуск периодического обновления
    startUpdates() {
        // Обновляем каждые 5 секунд
        setInterval(() => this.reloadAllData(), 5000);
    }
}

// Создаём графики когда страница загрузится
document.addEventListener('DOMContentLoaded', () => {
    window.charts = new SensorCharts();
});
