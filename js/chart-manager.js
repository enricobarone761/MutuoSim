/**
 * ===========================================================================
 *  MutuoSim — chart-manager.js
 * ===========================================================================
 *  Gestione del grafico Chart.js e del selettore d'intervallo (range slider).
 *
 *  Changelog rispetto alla versione precedente:
 *  - Niente più destroy()/new Chart(): usiamo update() in-place → zero flash
 *  - Campionamento a 120 punti max (era 60): spline sempre liscia anche con
 *    il punto "Oggi" incluso, nessuna inflessione artificiale
 *  - oggiDot: mantenuta animazione pulsante, ma posizionamento ora robusto
 *    (aggiornato dopo ogni chart.update(), non solo onComplete)
 */

let myChart = null;
const MIN_CHART_RANGE = 6;

// Riferimento al wrapper del dot "Oggi" sovrapposto al canvas
let oggiDotEl = null;
// Salviamo l'ultima todayLabel per il riposizionamento al resize
let _lastTodayLabel = null;

/* ─── oggiDot overlay ─────────────────────────────────────────────────────── */

/**
 * Rimuove il dot "Oggi" precedente e ne crea uno nuovo in posizione corretta.
 * Chiamato dopo ogni chart.update() per garantire la posizione esatta.
 */
function placeOggiDot(chart, todayLabel) {
    if (oggiDotEl && oggiDotEl.parentNode) {
        oggiDotEl.parentNode.removeChild(oggiDotEl);
    }
    oggiDotEl = null;
    _lastTodayLabel = todayLabel || null;

    if (!todayLabel || !chart) return;

    const labelIndex = chart.data.labels.indexOf(todayLabel);
    if (labelIndex === -1) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data[labelIndex]) return;

    const point = meta.data[labelIndex];
    const canvasEl = chart.canvas;
    const wrapper = canvasEl.closest('.chart-container') || canvasEl.parentElement;

    const dot = document.createElement('div');
    dot.className = 'oggi-dot-wrapper';
    dot.style.left = point.x + 'px';
    dot.style.top = point.y + 'px';

    const core = document.createElement('div');
    core.className = 'oggi-dot-core';
    const ring = document.createElement('div');
    ring.className = 'oggi-dot-ring';

    dot.appendChild(ring);
    dot.appendChild(core);
    wrapper.appendChild(dot);
    oggiDotEl = dot;
}

/**
 * Riposiziona il dot "Oggi" se il canvas viene ridimensionato.
 * Collegato all'evento resize del ResizeObserver del chart container.
 */
function refreshOggiDotPosition() {
    if (myChart && _lastTodayLabel) {
        placeOggiDot(myChart, _lastTodayLabel);
    }
}

/* ─── helper ───────────────────────────────────────────────────────────────── */

/**
 * Genera le label del grafico come date formattate se startDate è fornito.
 */
function buildLabels(totalMonths, startDate) {
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const labels = [];
    for (let m = 1; m <= totalMonths; m++) {
        if (startDate) {
            const d = new Date(startDate);
            d.setMonth(d.getMonth() + (m - 1));
            labels.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
        } else {
            labels.push('Mese ' + m);
        }
    }
    return labels;
}

/* ─── range UI ─────────────────────────────────────────────────────────────── */

/**
 * Gestisce il cambio dell'intervallo del grafico.
 */
function handleRangeChange() {
    let min = parseInt(chartRangeMin.value);
    let max = parseInt(chartRangeMax.value);

    if (min > max - MIN_CHART_RANGE) {
        if (this === chartRangeMin) {
            chartRangeMin.value = Math.max(1, max - MIN_CHART_RANGE);
            min = parseInt(chartRangeMin.value);
        } else {
            const total = parseInt(chartRangeMax.max);
            chartRangeMax.value = Math.min(total, min + MIN_CHART_RANGE);
            max = parseInt(chartRangeMax.value);
        }
    }

    updateRangeUI();

    if (typeof lastFullResults !== 'undefined' && lastFullResults) {
        updateChart(
            lastFullResults.fullLabels,
            lastFullResults.fullDataBalance,
            lastFullResults.fullDataInterest,
            lastFullResults.fullDataPayment,
            lastFullResults.fullDataActualPayment,
            lastFullResults.fullDataRate,
            lastFullResults.historicalEndMonth,
            false,
            lastFullResults.startDate || null,
            lastFullResults.currentMonthIndex || null
        );
    }
}

/**
 * Aggiorna la barra visiva e le etichette del selettore d'intervallo.
 */
function updateRangeUI(startDate) {
    const min = parseInt(chartRangeMin.value);
    const max = parseInt(chartRangeMax.value);
    const total = parseInt(chartRangeMax.max);

    const safeTotal = Math.max(total, 2);
    const left = ((min - 1) / (safeTotal - 1)) * 100;
    const right = ((max - 1) / (safeTotal - 1)) * 100;

    rangeTrack.style.left = left + '%';
    rangeTrack.style.width = (right - left) + '%';

    // Preferisce date reali se disponibili
    const src = (startDate instanceof Date && !isNaN(startDate))
        ? startDate
        : (typeof lastFullResults !== 'undefined' && lastFullResults && lastFullResults.startDate)
            ? lastFullResults.startDate
            : null;

    if (src) {
        const mnths = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        const fmt = (offset) => {
            const d = new Date(src);
            d.setMonth(d.getMonth() + offset);
            return `${mnths[d.getMonth()]} ${d.getFullYear()}`;
        };
        rangeLabelStart.textContent = fmt(min - 1);
        rangeLabelEnd.textContent = fmt(max - 1);
    } else {
        rangeLabelStart.textContent = `Mese ${min}`;
        rangeLabelEnd.textContent = `Mese ${max}`;
    }
}

/**
 * Reset dell'intervallo del grafico all'intera durata.
 */
function resetChartRange() {
    chartRangeMin.value = 1;
    chartRangeMax.value = chartRangeMax.max;
    updateRangeUI();
    if (typeof lastFullResults !== 'undefined' && lastFullResults) {
        updateChart(
            lastFullResults.fullLabels,
            lastFullResults.fullDataBalance,
            lastFullResults.fullDataInterest,
            lastFullResults.fullDataPayment,
            lastFullResults.fullDataActualPayment,
            lastFullResults.fullDataRate,
            lastFullResults.historicalEndMonth,
            false,
            lastFullResults.startDate || null,
            lastFullResults.currentMonthIndex || null
        );
    }
}

/* ─── sampling ─────────────────────────────────────────────────────────────── */

/**
 * Campiona i dati nell'intervallo [startM, endM].
 * Cap a 120 punti (era 60) per evitare inflessioni della spline.
 * Garantisce vicini del punto "Oggi" per una curva liscia intorno ad esso.
 */
function sampleData(startM, endM, allData, currentMonthIndex, historicalEndMonth) {
    const realLabels = allData.labels;

    const result = {
        labels: [], sampledMonths: [],
        balance: [], interest: [], payment: [], actualPayment: [], rate: [],
        historicalEndLabel: null, todayLabel: null
    };

    for (let m = startM; m <= endM; m++) {
        const i = m - 1;
        result.labels.push(realLabels[i]);
        result.sampledMonths.push(m);
        result.balance.push(allData.balance[i]);
        result.interest.push(allData.interest[i]);
        result.payment.push(allData.payment[i]);
        result.actualPayment.push(allData.actualPayment[i]);
        result.rate.push(allData.rate[i]);

        if (m === historicalEndMonth) result.historicalEndLabel = realLabels[i];
        if (currentMonthIndex !== null && m === currentMonthIndex) result.todayLabel = realLabels[i];
    }

    return result;
}

/* ─── datasets & annotations ──────────────────────────────────────────────── */

function buildDatasets(sampled, ltvData, propVal, ctx) {
    const gradBalance = ctx.createLinearGradient(0, 0, 0, 420);
    gradBalance.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradBalance.addColorStop(0.6, 'rgba(16, 185, 129, 0.07)');
    gradBalance.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    const gradInterest = ctx.createLinearGradient(0, 0, 0, 420);
    gradInterest.addColorStop(0, 'rgba(244, 63, 94, 0.28)');
    gradInterest.addColorStop(0.65, 'rgba(244, 63, 94, 0.05)');
    gradInterest.addColorStop(1, 'rgba(244, 63, 94, 0.00)');

    const datasets = [
        {
            label: 'Debito Residuo (€)',
            data: sampled.balance,
            borderColor: '#10b981',
            backgroundColor: gradBalance,
            fill: true,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            yAxisID: 'y'
        },
        {
            label: 'Rata Mensile (€)',
            data: sampled.payment,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.07)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_payment'
        },
        {
            label: 'Versamento Effettivo (€)',
            data: sampled.actualPayment,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_payment'
        },
        {
            label: 'Interessi Cumulati (€)',
            data: sampled.interest,
            borderColor: '#f43f5e',
            backgroundColor: gradInterest,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.35,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y'
        },
        {
            label: 'Tasso %',
            data: sampled.rate,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 0,
            yAxisID: 'y_hidden'
        }
    ];

    if (propVal > 0 && ltvData.length > 0) {
        datasets.push({
            label: 'LTV (%)',
            data: ltvData,
            borderColor: '#a855f7',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [3, 3],
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_ltv'
        });
    }

    return datasets;
}

function buildAnnotations(sampled) {
    const annotations = {};

    if (sampled.historicalEndLabel) {
        annotations.historicalLine = {
            type: 'line',
            xMin: sampled.historicalEndLabel,
            xMax: sampled.historicalEndLabel,
            borderColor: '#fb923c',
            borderWidth: 1.5,
            borderDash: [6, 4],
            label: {
                display: true,
                content: 'Fine Dati Storici',
                backgroundColor: 'rgba(0,0,0,0.75)',
                color: '#fff',
                font: { size: 10, weight: '600' },
                position: 'start',
                padding: { x: 6, y: 3 },
                borderRadius: 4
            }
        };
    }

    if (sampled.todayLabel) {
        annotations.todayLine = {
            type: 'line',
            xMin: sampled.todayLabel,
            xMax: sampled.todayLabel,
            borderColor: 'rgba(251,146,60,0.55)',
            borderWidth: 1.5,
            borderDash: [4, 4],
            label: {
                display: true,
                content: 'Oggi',
                backgroundColor: 'rgba(251,146,60,0.88)',
                color: '#fff',
                font: { size: 10, weight: '700' },
                position: 'end',
                padding: { x: 6, y: 3 },
                borderRadius: 4
            }
        };
    }

    return annotations;
}

function calcPaymentAxisLimits(paymentData, actualPaymentData) {
    const allVis = [...paymentData, ...actualPaymentData].filter(v => v > 0);
    if (allVis.length > 0) {
        const minVal = Math.min(...allVis);
        const maxVal = Math.max(...allVis);
        const marginTop = maxVal * 0.20;
        const marginBottom = minVal * 0.20;
        const sMax = maxVal + marginTop;
        const sMin = minVal - marginBottom;
        return {
            suggestedMax: sMax,
            suggestedMin: sMin < maxVal * 0.25 ? 0 : Math.max(0, sMin)
        };
    }
    return { suggestedMin: 0, suggestedMax: 1500 };
}

/* ─── main entry point ─────────────────────────────────────────────────────── */

/**
 * Crea o aggiorna il grafico Chart.js in-place (niente destroy/recreate).
 */
function updateChart(
    allLabels, allBalanceData, allInterestData, allPaymentData,
    allActualPaymentData, allRateData, historicalEndMonth,
    shouldAnimate = true, startDate = null, currentMonthIndex = null
) {
    const ctxElement = document.getElementById('mortgageChart');
    if (!ctxElement) return;

    const startM = parseInt(chartRangeMin.value) || 1;
    const endM = parseInt(chartRangeMax.value) || allLabels.length;

    const realLabels = buildLabels(allLabels.length, startDate);

    const allData = {
        labels: realLabels,
        balance: allBalanceData,
        interest: allInterestData,
        payment: allPaymentData,
        actualPayment: allActualPaymentData,
        rate: allRateData
    };

    const sampled = sampleData(startM, endM, allData, currentMonthIndex, historicalEndMonth);

    const propVal = (typeof lastFullResults !== 'undefined' && lastFullResults && lastFullResults.propertyValue)
        ? lastFullResults.propertyValue : null;
    const ltvData = propVal > 0
        ? sampled.balance.map(bal => parseFloat(((bal / propVal) * 100).toFixed(2)))
        : [];

    const payAxisLimits = calcPaymentAxisLimits(sampled.payment, sampled.actualPayment);
    const annotations = buildAnnotations(sampled);

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8';

    if (!myChart) {
        // ── Prima creazione ────────────────────────────────────────────────
        const ctx = ctxElement.getContext('2d');
        const datasets = buildDatasets(sampled, ltvData, propVal, ctx);

        myChart = new Chart(ctx, {
            type: 'line',
            data: { labels: sampled.labels, datasets },
            options: _buildChartOptions(shouldAnimate, annotations, payAxisLimits, propVal, sampled)
        });

        // Posiziona dot dopo il primo render
        if (shouldAnimate) {
            myChart.options.animation.onComplete = () => placeOggiDot(myChart, sampled.todayLabel);
        } else {
            placeOggiDot(myChart, sampled.todayLabel);
        }

        // Riposiziona al resize del container
        const container = ctxElement.closest('.chart-container') || ctxElement.parentElement;
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(refreshOggiDotPosition).observe(container);
        }

    } else {
        // ── Aggiornamento in-place — niente flash ──────────────────────────
        const ctx = ctxElement.getContext('2d');
        const datasets = buildDatasets(sampled, ltvData, propVal, ctx);

        myChart.data.labels = sampled.labels;

        // Sincronizza numero di dataset (es. LTV appare/sparisce)
        while (myChart.data.datasets.length > datasets.length) myChart.data.datasets.pop();
        while (myChart.data.datasets.length < datasets.length) myChart.data.datasets.push({});
        datasets.forEach((ds, i) => Object.assign(myChart.data.datasets[i], ds));

        myChart.options.plugins.annotation.annotations = annotations;
        myChart.options.scales.y_payment.suggestedMin = payAxisLimits.suggestedMin;
        myChart.options.scales.y_payment.suggestedMax = payAxisLimits.suggestedMax;
        myChart.options.scales.y_ltv.display = propVal > 0;

        if (shouldAnimate) {
            myChart.options.animation = {
                onComplete: () => placeOggiDot(myChart, sampled.todayLabel)
            };
            myChart.update();
        } else {
            myChart.options.animation = { duration: 0 };
            myChart.update('none');
            // Con 'none' il render è sincrono → posizionamento immediato
            placeOggiDot(myChart, sampled.todayLabel);
        }
    }
}

/**
 * Costruisce l'oggetto options per Chart.js (prima creazione).
 */
function _buildChartOptions(shouldAnimate, annotations, payAxisLimits, propVal, sampled) {
    return {
        animation: shouldAnimate ? {} : { duration: 0 },
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    padding: 20,
                    font: { size: 12, weight: 500 },
                    filter: item => !item.text.includes('Tasso %')
                },
                onClick: function (evt, legendItem, legend) {
                    Chart.defaults.plugins.legend.onClick(evt, legendItem, legend);
                    const chart = legend.chart;
                    const paymentDatasetIndices = [1, 2];
                    const visibleValues = [];
                    for (const idx of paymentDatasetIndices) {
                        if (!chart.getDatasetMeta(idx).hidden) {
                            chart.data.datasets[idx].data.forEach(v => { if (v > 0) visibleValues.push(v); });
                        }
                    }
                    if (visibleValues.length > 0) {
                        const minVal = Math.min(...visibleValues);
                        const maxVal = Math.max(...visibleValues);
                        const marginTop = maxVal * 0.2;
                        const marginBottom = minVal * 0.2;
                        chart.options.scales.y_payment.suggestedMax = maxVal + marginTop;
                        const minCandidate = minVal - marginBottom;
                        chart.options.scales.y_payment.suggestedMin =
                            minCandidate < maxVal * 0.25 ? 0 : Math.max(0, minCandidate);
                    } else {
                        chart.options.scales.y_payment.suggestedMin = 0;
                        chart.options.scales.y_payment.suggestedMax = 2000;
                    }
                    chart.update();
                    placeOggiDot(chart, _lastTodayLabel);
                }
            },
            annotation: { annotations },
            tooltip: {
                backgroundColor: 'rgba(10, 15, 30, 0.92)',
                titleColor: '#f8fafc',
                bodyColor: '#cbd5e1',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                displayColors: true,
                titleFont: { size: 13, weight: 600 },
                bodyFont: { size: 12 },
                callbacks: {
                    title: function (items) {
                        const label = items[0]?.label || '';
                        return (_lastTodayLabel && label === _lastTodayLabel)
                            ? `${label}  ← Oggi`
                            : label;
                    },
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label === 'Tasso %') return `Tasso: ${context.parsed.y.toFixed(2)}%`;
                        if (context.dataset.yAxisID === 'y_ltv') {
                            if (context.parsed.y === null) return null;
                            return `${label}: ${context.parsed.y.toFixed(1)}%`;
                        }
                        if (label) label += ': ';
                        if (context.parsed.y !== null) label += fmtCurr(context.parsed.y);
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    maxRotation: 35,
                    minRotation: 0,
                    font: { size: 11 },
                    color: '#64748b'
                }
            },
            y: {
                position: 'left',
                beginAtZero: true,
                ticks: {
                    callback: val => (val / 1000) + 'k€',
                    font: { size: 11 },
                    color: '#64748b'
                },
                grid: { color: 'rgba(255,255,255,0.04)' }
            },
            y_payment: {
                position: 'right',
                beginAtZero: false,
                ...payAxisLimits,
                ticks: {
                    callback: val => val.toLocaleString('it-IT', { maximumFractionDigits: 0 }) + '€',
                    font: { size: 11 },
                    color: '#64748b'
                },
                grid: { display: false }
            },
            y_hidden: {
                display: false,
                min: 0,
                max: 10
            },
            y_ltv: {
                display: propVal > 0,
                position: 'right',
                min: 0,
                max: 105,
                ticks: {
                    callback: val => val + '%',
                    maxTicksLimit: 6,
                    color: '#a855f7',
                    font: { size: 11 }
                },
                grid: { display: false }
            }
        }
    };
}
