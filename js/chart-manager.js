/**
 * ===========================================================================
 *  MutuoSim — chart-manager.js
 * ===========================================================================
 *  Gestione del grafico Chart.js e del selettore d'intervallo (range slider).
 */

let myChart = null;
const MIN_CHART_RANGE = 6; // Differenza minima tra min e max in mesi

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
            false
        );
    }
}

/**
 * Aggiorna lo stile visivo e le etichette del selettore d'intervallo.
 */
function updateRangeUI() {
    const min = parseInt(chartRangeMin.value);
    const max = parseInt(chartRangeMax.value);
    const total = parseInt(chartRangeMax.max);

    const left = ((min - 1) / (total - 1)) * 100;
    const right = ((max - 1) / (total - 1)) * 100;

    rangeTrack.style.left = left + '%';
    rangeTrack.style.width = (right - left) + '%';

    rangeLabelStart.textContent = `Inizio: Mese ${min}`;
    rangeLabelEnd.textContent = `Fine: Mese ${max}`;
}

/**
 * Crea o aggiorna il grafico Chart.js.
 */
function updateChart(allLabels, allBalanceData, allInterestData, allPaymentData, allActualPaymentData, allRateData, historicalEndMonth, shouldAnimate = true) {
    const ctxElement = document.getElementById('mortgageChart');
    if (!ctxElement) return;
    const ctx = ctxElement.getContext('2d');

    const startM = parseInt(chartRangeMin.value) || 1;
    const endM = parseInt(chartRangeMax.value) || allLabels.length;

    const windowSize = endM - startM + 1;
    let step = Math.max(1, Math.floor(windowSize / 60));

    let labels = [];
    let balanceData = [];
    let interestData = [];
    let paymentData = [];
    let actualPaymentData = [];
    let rateData = [];
    let historicalEndLabel = null;

    for (let i = startM - 1; i < endM; i++) {
        const m = i + 1;

        // Campionamento intelligente: preserviamo i punti "critici"
        const isRegularStep = (m - startM) % step === 0;
        const isSpike = allActualPaymentData[i] > (allPaymentData[i] + 1);
        const isRateChange = i > 0 && Math.abs(allRateData[i] - allRateData[i - 1]) > 0.0001;
        const isInstallmentChange = i > 0 && Math.abs(allPaymentData[i] - allPaymentData[i - 1]) > 0.01;

        if (m === startM || m === endM || isRegularStep || m === historicalEndMonth || isSpike || isRateChange || isInstallmentChange) {
            labels.push(allLabels[i]);
            balanceData.push(allBalanceData[i]);
            interestData.push(allInterestData[i]);
            paymentData.push(allPaymentData[i]);
            actualPaymentData.push(allActualPaymentData[i]);
            rateData.push(allRateData[i]);

            if (m === historicalEndMonth) {
                historicalEndLabel = allLabels[i];
            }
        }
    }

    // Costruisci dati LTV se abbiamo un propertyValue valido
    let ltvData = [];
    const propVal = (typeof lastFullResults !== 'undefined' && lastFullResults && lastFullResults.propertyValue)
        ? lastFullResults.propertyValue
        : null;
    if (propVal > 0) {
        ltvData = balanceData.map(bal => (bal / propVal) * 100);
    }

    if (myChart) myChart.destroy();

    let gradientBalance = ctx.createLinearGradient(0, 0, 0, 400);
    gradientBalance.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradientBalance.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    let gradientInterest = ctx.createLinearGradient(0, 0, 0, 400);
    gradientInterest.addColorStop(0, 'rgba(244, 63, 94, 0.4)');
    gradientInterest.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

    const annotations = {};
    if (historicalEndLabel) {
        annotations.historicalLine = {
            type: 'line',
            xMin: historicalEndLabel,
            xMax: historicalEndLabel,
            borderColor: '#fb923c',
            borderWidth: 2,
            borderDash: [6, 4],
            label: {
                display: true,
                content: 'Fine Dati Storici',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                font: { size: 10 },
                position: 'start'
            }
        };
    }

    const datasets = [
        {
            label: 'Debito Residuo (€)',
            data: balanceData,
            borderColor: '#10b981',
            backgroundColor: gradientBalance,
            fill: true,
            tension: 0.1,
            cubicInterpolationMode: 'monotone',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 6,
            yAxisID: 'y'
        },
        {
            label: 'Rata Mensile (€)',
            data: paymentData,
            borderColor: '#3b82f6',
            backgroundColor: '#3b82f6',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_payment'
        },
        {
            label: 'Versamento Effettivo (€)',
            hidden: false,
            data: actualPaymentData,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_payment'
        },
        {
            label: 'Interessi Cumulati (€)',
            data: interestData,
            borderColor: '#f43f5e',
            backgroundColor: gradientInterest,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y'
        },
        {
            label: 'Tasso %',
            data: rateData,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 0,
            yAxisID: 'y_hidden'
        }
    ];

    if (propVal > 0) {
        datasets.push({
            label: 'LTV (%)',
            data: ltvData,
            borderColor: '#a855f7',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [2, 2],
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.1,
            cubicInterpolationMode: 'monotone',
            yAxisID: 'y_ltv'
        });
    }

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8';

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            animation: shouldAnimate ? {} : false,
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 20,
                        font: { size: 12, weight: 500 },
                        filter: function (item) {
                            return !item.text.includes('Tasso');
                        }
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

                            // Logica intelligente: se il valore minimo è alto (>25% del massimo), facciamo zoom
                            // Altrimenti includiamo lo zero per dare prospettiva.
                            const marginTop = maxVal * 0.2;
                            const marginBottom = minVal * 0.2;

                            chart.options.scales.y_payment.suggestedMax = maxVal + marginTop;

                            const minCandidate = minVal - marginBottom;
                            if (minCandidate < maxVal * 0.25) {
                                chart.options.scales.y_payment.suggestedMin = 0;
                            } else {
                                chart.options.scales.y_payment.suggestedMin = Math.max(0, minCandidate);
                            }
                        } else {
                            chart.options.scales.y_payment.suggestedMin = 0;
                            chart.options.scales.y_payment.suggestedMax = 2000;
                        }
                        chart.update();
                    }
                },
                annotation: {
                    annotations: annotations
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#f8fafc',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    titleFont: { size: 13, weight: 600 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label === 'Tasso %') {
                                return `Tasso: ${context.parsed.y.toFixed(2)}%`;
                            }
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += fmtCurr(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    position: 'left',
                    beginAtZero: true,
                    ticks: {
                        callback: function (val) {
                            return (val / 1000) + 'k€';
                        }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y_payment: {
                    position: 'right',
                    beginAtZero: false,
                    // Calcolo dinamico e intelligente dei limiti
                    ...(function () {
                        const allVis = [...paymentData, ...actualPaymentData].filter(v => v > 0);
                        if (allVis.length > 0) {
                            const minVal = Math.min(...allVis);
                            const maxVal = Math.max(...allVis);
                            const marginTop = maxVal * 0.2;
                            const marginBottom = minVal * 0.2;

                            const sMax = maxVal + marginTop;
                            const sMin = minVal - marginBottom;

                            return {
                                suggestedMax: sMax,
                                suggestedMin: sMin < maxVal * 0.25 ? 0 : Math.max(0, sMin)
                            };
                        }
                        return { suggestedMin: 0, suggestedMax: 1500 };
                    })(),
                    ticks: {
                        callback: function (val) {
                            return val + '€';
                        }
                    },
                    grid: { display: false }
                },
                y_hidden: {
                    display: false,
                    min: 0,
                    max: 10
                }
            }
        }
    });
}
