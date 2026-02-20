// Variabili globali
let myChart = null;
let periodCounter = 0;

// Riferimenti DOM
const amountInput = document.getElementById('amount');
const yearsInput = document.getElementById('years');
const rateInput = document.getElementById('rate');
const isVariableCheckbox = document.getElementById('isVariable');
const variableSection = document.getElementById('variable-section');
const ratePeriodsContainer = document.getElementById('rate-periods-container');
const addPeriodBtn = document.getElementById('addPeriodBtn');
const extraAmountInput = document.getElementById('extraAmount');
const extraFrequencySelect = document.getElementById('extraFrequency');
const extraStartMonthInput = document.getElementById('extraStartMonth');
const extraDurationInput = document.getElementById('extraDuration');
const extraEffectSelect = document.getElementById('extraEffect');
const roundUpAmountInput = document.getElementById('roundUpAmount');
const roundUpAnnualIncreaseInput = document.getElementById('roundUpAnnualIncrease');
const rateNumericInput = document.getElementById('rateNumeric');

const outInitialPayment = document.getElementById('outInitialPayment');
const outMaxPayment = document.getElementById('outMaxPayment');
const outTotalInterest = document.getElementById('outTotalInterest');
const outTotalPaid = document.getElementById('outTotalPaid');
const savedTimeBox = document.getElementById('saved-time-box');
const outSavedTime = document.getElementById('outSavedTime');
const rataBox = document.getElementById('rataBox');
const rataSensitivityPanel = document.getElementById('rataSensitivityPanel');

// Event Listeners
amountInput.addEventListener('input', calculate);
yearsInput.addEventListener('input', calculate);
rateInput.addEventListener('input', calculate);
extraAmountInput.addEventListener('input', calculate);
extraFrequencySelect.addEventListener('change', calculate);
extraStartMonthInput.addEventListener('input', calculate);
extraDurationInput.addEventListener('input', calculate);
extraEffectSelect.addEventListener('change', calculate);
roundUpAmountInput.addEventListener('input', calculate);
roundUpAnnualIncreaseInput.addEventListener('input', calculate);

if (rateNumericInput) {
    rateNumericInput.addEventListener('input', function () {
        const val = parseFloat(this.value);
        if (!isNaN(val)) {
            rateInput.value = val;
            calculate();
        }
    });
}

// Toggle Sensitivity Panel
rataBox.addEventListener('click', function () {
    const isOpen = rataSensitivityPanel.style.display !== 'none';
    rataSensitivityPanel.style.display = isOpen ? 'none' : 'block';
    rataBox.classList.toggle('active', !isOpen);
});

isVariableCheckbox.addEventListener('change', function () {
    variableSection.style.display = this.checked ? 'block' : 'none';

    // Disabilita Euribor se variabile manuale è attivo
    if (this.checked && euriborCheckbox.checked) {
        euriborCheckbox.checked = false;
        euriborSection.style.display = 'none';
    }
    calculate();
});

addPeriodBtn.addEventListener('click', function () {
    addRatePeriod();
});

// Event Listeners Euribor
euriborCheckbox.addEventListener('change', function () {
    euriborSection.style.display = this.checked ? 'block' : 'none';

    if (this.checked) {
        // Disabilita lo scenario variabile manuale quando Euribor è attivo
        if (isVariableCheckbox.checked) {
            isVariableCheckbox.checked = false;
            variableSection.style.display = 'none';
        }

        if (euriborAllData) {
            updateEuriborUI();
        } else {
            euriborStatus.textContent = '❌ Dati Euribor non trovati. Eseguire update_euribor.py';
            euriborStatus.style.color = 'var(--danger)';
        }
    }

    calculate();
});

euriborTenorSelect.addEventListener('change', function () {
    if (euriborAllData) {
        updateEuriborUI();
        calculate();
    }
});

euriborStartInput.addEventListener('change', calculate);
euriborSpreadInput.addEventListener('input', calculate);

// Funzioni per gestire periodi di tasso variabile
function addRatePeriod(startMonth = 1, endMonth = 12, rate = 4.0) {
    periodCounter++;
    const id = 'period-' + periodCounter;

    const row = document.createElement('div');
    row.className = 'rate-period-row';
    row.id = id;

    row.innerHTML = `
        <div>
            <label>Mese Inizio</label>
            <input type="number" class="period-start" value="${startMonth}" min="1" step="1">
        </div>
        <div>
            <label>Mese Fine</label>
            <input type="number" class="period-end" value="${endMonth}" min="1" step="1">
        </div>
        <div>
            <label>Tasso (%)</label>
            <input type="number" class="period-rate" value="${rate}" step="0.01">
        </div>
        <button class="btn btn-remove" onclick="removeRatePeriod('${id}')">✕</button>
    `;

    ratePeriodsContainer.appendChild(row);

    // Aggiungi listener agli input
    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', calculate);
    });

    calculate();
}

function removeRatePeriod(id) {
    const row = document.getElementById(id);
    if (row) {
        row.remove();
        calculate();
    }
}

function getRatePeriods() {
    const periods = [];
    const rows = ratePeriodsContainer.querySelectorAll('.rate-period-row');

    rows.forEach(row => {
        const start = parseInt(row.querySelector('.period-start').value) || 1;
        const end = parseInt(row.querySelector('.period-end').value) || 1;
        const rate = parseFloat(row.querySelector('.period-rate').value) || 0;

        periods.push({ start, end, rate });
    });

    return periods;
}

// Funzione di formattazione valuta
function fmtCurr(val) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);
}

// Funzione principale di calcolo
function calculate() {
    const P = parseFloat(amountInput.value) || 0;
    const years = parseInt(yearsInput.value) || 0;
    const baseRate = parseFloat(rateInput.value) || 0;

    // Sincronizza il badge numerico se non è l'elemento attivo (per evitare loop di focus/input)
    if (rateNumericInput && document.activeElement !== rateNumericInput) {
        rateNumericInput.value = baseRate.toFixed(1);
    }
    updateSliderFill(rateInput);
    const extraPayment = parseFloat(extraAmountInput.value) || 0;
    const extraFreqValue = extraFrequencySelect.value;
    const extraStartMonth = parseInt(extraStartMonthInput.value) || 0;
    const extraDurationYears = parseInt(extraDurationInput.value) || 0;
    const extraEffect = extraEffectSelect.value; // 'duration' o 'installment'
    const roundUpAmount = parseFloat(roundUpAmountInput.value) || 0;
    const roundUpAnnualIncrease = parseFloat(roundUpAnnualIncreaseInput.value) || 0;

    if (P <= 0 || years <= 0) {
        resetOutputs();
        return;
    }

    const totalMonths = years * 12;
    const isVariable = isVariableCheckbox.checked;
    const ratePeriods = isVariable ? getRatePeriods() : [];

    // Controlla se la modalità Euribor è attiva
    const euriborConfig = (typeof getEuriborConfig === 'function') ? getEuriborConfig() : { active: false, rates: [] };

    // Converti frequenza extra
    let extraFreqMonths = 0; // ogni quanti mesi si applica l'extra
    if (extraFreqValue === '1_monthly') {
        extraFreqMonths = 1;
    } else if (extraFreqValue === '1') {
        extraFreqMonths = -1; // una tantum, solo mese 1
    } else {
        extraFreqMonths = parseInt(extraFreqValue) || 0;
    }

    // 1. Simulazione Baseline (Senza Extra) - per calcolare il risparmio
    const baselineResults = runSimulation({
        P,
        totalMonths,
        baseRate,
        euriborConfig,
        ratePeriods,
        isVariable,
        extraPayment: 0,
        extraFreqMonths: 0,
        extraStartMonth: 0,
        extraDurationYears: 0,
        extraEffect: 'duration',
        roundUpAmount: 0,
        roundUpAnnualIncrease: 0,
        generateChart: false
    });

    // 2. Simulazione Attuale (Con Extra Input Utente)
    const results = runSimulation({
        P,
        totalMonths,
        baseRate,
        euriborConfig,
        ratePeriods,
        isVariable,
        extraPayment,
        extraFreqMonths,
        extraStartMonth,
        extraDurationYears,
        extraEffect,
        roundUpAmount,
        roundUpAnnualIncrease,
        generateChart: true
    });

    // Calcolo Risparmi
    const interestSaved = Math.max(0, baselineResults.totalInterestPaid - results.totalInterestPaid);

    let savedMonths = 0;
    const hasExtras = (extraPayment > 0 && extraFreqMonths !== 0) || roundUpAmount > 0 || roundUpAnnualIncrease > 0;

    // Calcola mesi risparmiati rispetto alla durata totale prevista
    // Nota: confrontiamo con totalMonths perché è la durata contrattuale.
    if (hasExtras && results.actualMonths < totalMonths) {
        savedMonths = totalMonths - results.actualMonths;
    }

    // Aggiorna output numerici
    outInitialPayment.innerText = fmtCurr(results.firstRata);
    outMaxPayment.innerText = fmtCurr(results.maxRataSeen);
    outTotalInterest.innerText = fmtCurr(results.totalInterestPaid);
    outTotalPaid.innerText = fmtCurr(P + results.totalInterestPaid);

    // Gestione Box Risparmio (Tempo + Interessi)
    if (hasExtras && (savedMonths > 0 || interestSaved > 1.0 || results.totalExtraPaid > 0)) {
        let savedText = '';

        // Tempo Risparmiato
        if (savedMonths > 0) {
            const savedYears = Math.floor(savedMonths / 12);
            const savedMonthsRemainder = savedMonths % 12;
            if (savedYears > 0) savedText += savedYears + ' anni';
            if (savedMonthsRemainder > 0) savedText += (savedText ? ' e ' : '') + savedMonthsRemainder + ' mesi';
        } else {
            savedText = 'Nessuna riduzione durata';
        }

        // Modifica etichetta box
        const savedLabel = savedTimeBox.querySelector('.label');
        if (savedLabel) savedLabel.textContent = '📊 Analisi Estinzione';

        // Costruisci il contenuto HTML più strutturato
        let htmlContent = `<div style="margin-bottom: 8px; font-weight:600; font-size: 1.1em; color: var(--text-main);">${savedText} <span style="font-weight:400; font-size:0.9em; color:var(--text-muted);">in meno</span></div>`;

        htmlContent += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">`;

        // Colonna Extra Versato
        if (results.totalExtraPaid > 0) {
            htmlContent += `
             <div style="text-align: right; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 15px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block;">Extra Versato</span>
                <span style="font-size: 1.1rem; font-weight: 700; color: #fb923c;">${fmtCurr(results.totalExtraPaid)}</span>
             </div>`;
        } else {
            htmlContent += `<div></div>`; // Spacer if 0
        }

        // Colonna Risparmio Interessi
        htmlContent += `
             <div style="text-align: left; padding-left: 5px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block;">Interessi Risparmiati</span>
                <span style="font-size: 1.1rem; font-weight: 700; color: #10b981;">${fmtCurr(interestSaved)}</span>
             </div>
        `;

        htmlContent += `</div>`;

        outSavedTime.innerHTML = htmlContent;
        savedTimeBox.style.display = 'block';
    } else {
        savedTimeBox.style.display = 'none';
        // Ripristina etichetta default se necessario, ma non critico
    }

    updateChart(results.chartLabels, results.chartDataBalance, results.chartDataInterest, results.chartDataPayment, results.chartDataActualPayment, results.chartDataRate, results.historicalEndLabel);

    // Aggiorna tabella sensibilità
    updateSensitivityTable(P, years, baseRate);
}

function runSimulation(params) {
    const {
        P,
        totalMonths,
        baseRate,
        euriborConfig,
        ratePeriods,
        isVariable,
        extraPayment,
        extraFreqMonths,
        extraStartMonth,
        extraDurationYears,
        extraEffect,
        roundUpAmount,
        roundUpAnnualIncrease,
        generateChart
    } = params;

    // --- Calcola la rata iniziale standard (ammortamento francese) ---
    // Se Euribor è attivo, usa il primo tasso Euribor; altrimenti il tasso base
    let firstRate = baseRate;
    if (euriborConfig.active && euriborConfig.rates.length > 0) {
        firstRate = euriborConfig.rates[0];
    }
    let initialMonthlyRate = Math.max(0, firstRate / 100 / 12);
    let initialRata;
    if (initialMonthlyRate === 0) {
        initialRata = P / totalMonths;
    } else {
        initialRata = (P * initialMonthlyRate) / (1 - Math.pow(1 + initialMonthlyRate, -totalMonths));
    }

    // Variabili di simulazione
    let currentBalance = P;
    let totalInterestPaid = 0;
    let totalExtraPaid = 0; // Nuovo accumulatore per extra
    let firstRata = initialRata;
    let maxRataSeen = 0;
    let currentRata = initialRata; // rata corrente (può cambiare con tasso variabile o modalità 'installment')
    let prevAnnualRate = firstRate; // per tracciare i cambi di tasso
    let historicalEndLabel = null; // etichetta esatta per la linea rossa
    let actualMonths = totalMonths; // mesi effettivi del mutuo

    // Dati per il grafico
    let chartLabels = [];
    let chartDataBalance = [];
    let chartDataInterest = [];
    let chartDataPayment = [];
    let chartDataActualPayment = [];
    let chartDataRate = [];

    // Simulazione mese per mese
    for (let m = 1; m <= totalMonths && currentBalance > 0.01; m++) {

        // 1. Determina il tasso per questo mese
        let currentAnnualRate = baseRate;

        if (euriborConfig.active && euriborConfig.rates.length > 0) {
            // Modalità Euribor: usa il tasso storico per questo mese
            currentAnnualRate = euriborConfig.rates[Math.min(m - 1, euriborConfig.rates.length - 1)];
        } else if (isVariable && ratePeriods.length > 0) {
            // Modalità variabile manuale
            for (let period of ratePeriods) {
                if (m >= period.start && m <= period.end) {
                    currentAnnualRate = period.rate;
                    break;
                }
            }
        }
        let monthlyRate = Math.max(0, currentAnnualRate / 100 / 12);

        // Se il tasso è cambiato, ricalcola la rata sul debito residuo e mesi rimanenti
        if (currentAnnualRate !== prevAnnualRate) {
            let remainingMonths = totalMonths - (m - 1);
            if (remainingMonths > 0 && currentBalance > 0.01) {
                if (monthlyRate === 0) {
                    currentRata = currentBalance / remainingMonths;
                } else {
                    currentRata = (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
                }
            }
            prevAnnualRate = currentAnnualRate;
        }

        // 2. Calcola gli interessi di questo mese
        let quotaInteressi = currentBalance * monthlyRate;

        // 3. Determina la rata mensile da pagare
        let rataDaPagare = currentRata;

        // Se il saldo restante è inferiore alla rata, chiudi il mutuo
        if (currentBalance + quotaInteressi <= rataDaPagare) {
            rataDaPagare = currentBalance + quotaInteressi;
        }

        let quotaCapitale = rataDaPagare - quotaInteressi;

        // 4. Gestione Estinzione Parziale
        let extraPeriodic = 0;  // Extra da pagamenti periodici (soggetto a effetto durata/rata)
        let extraRoundup = 0;   // Extra da arrotondamento (riduce sempre e solo la durata)
        let applyExtra = false;

        // Controlla se siamo nel periodo valido per gli extra (basato su mese di inizio e durata)
        const isInExtraPeriod = (m > extraStartMonth) && (extraDurationYears === 0 || m <= extraStartMonth + (extraDurationYears * 12));

        // Extra periodici (importo fisso con frequenza specifica)
        if (extraPayment > 0 && extraFreqMonths !== 0 && isInExtraPeriod) {
            if (extraFreqMonths === -1 && m === extraStartMonth + 1) {
                applyExtra = true; // Una tantum (primo mese utile dopo l'inizio)
            } else if (extraFreqMonths === 1) {
                applyExtra = true; // Mensile
            } else if (extraFreqMonths > 1) {
                // Per frequenze periodiche, considera l'offset del mese di inizio
                if ((m - extraStartMonth) % extraFreqMonths === 0) applyExtra = true;
            }

            if (applyExtra) {
                extraPeriodic = Math.min(extraPayment, currentBalance - quotaCapitale);
                if (extraPeriodic < 0) extraPeriodic = 0;
            }
        }

        // Arrotondamento rata (solo se attivo e nel periodo valido)
        // L'arrotondamento non può essere negativo: se roundUpAmount < currentRata, extra rimane 0
        // L'arrotondamento riduce SEMPRE la durata (non innesca ricalcolo rata)
        if (roundUpAmount > 0 && isInExtraPeriod) {
            // Incremento annuo composto sull'importo target (ogni 12 mesi)
            const yearsElapsed = Math.floor((m - 1) / 12);
            const growthFactor = Math.pow(1 + roundUpAnnualIncrease / 100, yearsElapsed);
            const effectiveRoundUpAmount = roundUpAmount * growthFactor;

            if (effectiveRoundUpAmount > currentRata) {
                const roundUpDiff = effectiveRoundUpAmount - currentRata;
                const maxRoundUpExtra = Math.max(0, currentBalance - quotaCapitale - extraPeriodic);
                extraRoundup = Math.min(roundUpDiff, maxRoundUpExtra);
            }
        }

        let extra = extraPeriodic + extraRoundup;
        totalExtraPaid += extra;

        // 5. Applica pagamenti
        totalInterestPaid += quotaInteressi;
        let capitalePagato = quotaCapitale + extra;

        if (capitalePagato >= currentBalance) {
            capitalePagato = currentBalance;
            currentBalance = 0;
        } else {
            currentBalance -= capitalePagato;
        }

        // Traccia la rata (solo la rata standard, non gli extra)
        if (rataDaPagare > maxRataSeen) maxRataSeen = rataDaPagare;

        // 6. Dopo un pagamento extra PERIODICO, ricalcola la rata se in modalità 'installment'
        // L'arrotondamento NON innesca il ricalcolo: riduce sempre solo la durata
        if (extraPeriodic > 0 && extraEffect === 'installment' && currentBalance > 0.01) {
            let remainingMonths = totalMonths - m;
            if (remainingMonths > 0) {
                if (monthlyRate === 0) {
                    currentRata = currentBalance / remainingMonths;
                } else {
                    currentRata = (currentBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
                }
            }
        }

        // 7. Dati Grafico (campionamento trimestrale + punto di fine storia)
        if (generateChart) {
            const isHistoricalEnd = (euriborConfig.active && m === euriborConfig.historicalCount);

            if (m === 1 || m % 3 === 0 || isHistoricalEnd || currentBalance <= 0.01) {
                let label = 'Mese ' + m;
                chartLabels.push(label);
                chartDataBalance.push(Math.max(0, currentBalance));
                chartDataInterest.push(totalInterestPaid);
                // Rata teorica (senza extra) per la linea base
                chartDataPayment.push(currentRata);
                // Versamento effettivo = rata pagata + extra versati (arrotondamento + periodici)
                chartDataActualPayment.push(rataDaPagare + extra);
                chartDataRate.push(currentAnnualRate); // Store rate

                // Salva l'etichetta se siamo alla fine della storia reale (e non è la fine del mutuo)
                if (isHistoricalEnd && m < totalMonths && currentBalance > 0.01) {
                    historicalEndLabel = label;
                }
            }
        }

        // Traccia i mesi effettivi se il mutuo termina anticipatamente
        if (currentBalance <= 0.01) {
            actualMonths = m;
            break;
        }
    }

    return {
        firstRata,
        maxRataSeen,
        totalInterestPaid,
        totalExtraPaid,
        actualMonths,
        chartLabels,
        chartDataBalance,
        chartDataInterest,
        chartDataPayment,
        chartDataActualPayment,
        chartDataRate,
        historicalEndLabel
    };
}

function resetOutputs() {
    outInitialPayment.innerText = '--';
    outMaxPayment.innerText = '--';
    outTotalInterest.innerText = '--';
    outTotalPaid.innerText = '--';
    if (myChart) myChart.destroy();
}

// Configurazione Grafico
function updateChart(labels, balanceData, interestData, paymentData, actualPaymentData, rateData, historicalEndLabel) {
    const ctx = document.getElementById('mortgageChart').getContext('2d');

    if (myChart) myChart.destroy();

    // Create Gradients
    let gradientBalance = ctx.createLinearGradient(0, 0, 0, 400);
    gradientBalance.addColorStop(0, 'rgba(16, 185, 129, 0.4)'); // Emerald 500
    gradientBalance.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    let gradientInterest = ctx.createLinearGradient(0, 0, 0, 400);
    gradientInterest.addColorStop(0, 'rgba(244, 63, 94, 0.4)'); // Rose 500
    gradientInterest.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

    const annotations = {};
    if (historicalEndLabel) {
        annotations.historicalLine = {
            type: 'line',
            xMin: historicalEndLabel,
            xMax: historicalEndLabel,
            borderColor: '#fb923c', // Orange 400
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

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8';

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Debito Residuo (€)',
                    data: balanceData,
                    borderColor: '#10b981', // Emerald 500
                    backgroundColor: gradientBalance,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    yAxisID: 'y'
                },
                {
                    label: 'Rata Mensile (€)',
                    data: paymentData,
                    borderColor: '#3b82f6', // Blue 500
                    backgroundColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y_payment'
                },
                {
                    label: 'Versamento Effettivo (€)',
                    hidden: true,
                    data: actualPaymentData,
                    borderColor: '#f59e0b', // Amber 400
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    yAxisID: 'y_payment'
                },
                {
                    label: 'Interessi Cumulati (€)',
                    data: interestData,
                    borderColor: '#f43f5e', // Rose 500
                    backgroundColor: gradientInterest,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Tasso %',
                    data: rateData,
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 0,
                    yAxisID: 'y_hidden' // Use hidden axis
                }
            ]
        },
        options: {
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
                        filter: function (item, chart) {
                            // Hide "Tasso %" from legend
                            return !item.text.includes('Tasso');
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate 900
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
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 12,
                        font: { size: 11 }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        callback: (val) => (val / 1000).toFixed(0) + 'k',
                        font: { size: 11 }
                    },
                    title: {
                        display: false,
                    }
                },
                y_payment: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { display: false },
                    // Impostiamo un range che lasci "aria" sopra le linee della rata
                    suggestedMin: (() => {
                        const minVal = Math.min(...paymentData, ...actualPaymentData.filter(v => v > 0), 500);
                        return minVal * 0.9;
                    })(),
                    suggestedMax: (() => {
                        const maxVal = Math.max(...paymentData, ...actualPaymentData, 500);
                        return maxVal * 1.1;
                    })(),
                    ticks: {
                        callback: (val) => val.toFixed(0) + ' €',
                        color: '#60a5fa', // Blue 400
                        font: { size: 11 }
                    },
                    title: {
                        display: true,
                        text: 'Importi Mensili',
                        color: '#60a5fa',
                        font: { size: 10, weight: 600 }
                    }
                },
                y_hidden: {
                    type: 'linear',
                    display: false, // Hidden axis for rate data
                    min: 0,
                    max: 10
                }
            }
        }
    });
}

// Funzione per calcolare la rata con ammortamento francese
function calcRata(principal, years, annualRate) {
    if (principal <= 0 || years <= 0) return 0;
    const months = years * 12;
    const mr = Math.max(0, annualRate / 100 / 12);
    if (mr === 0) return principal / months;
    return (principal * mr) / (1 - Math.pow(1 + mr, -months));
}

// Aggiorna la tabella sensibilità 3x3
function updateSensitivityTable(P, years, baseRate) {
    const yearOffsets = [5, 0, -5];
    const rateOffsets = [0.5, 0, -0.5];
    const cellIds = [
        ['cell-plus5y-plus05r', 'cell-curr-y-plus05r', 'cell-minus5y-plus05r'],
        ['cell-plus5y-curr-r', 'cell-curr-y-curr-r', 'cell-minus5y-curr-r'],
        ['cell-plus5y-minus05r', 'cell-curr-y-minus05r', 'cell-minus5y-minus05r']
    ];

    // Aggiorna intestazioni colonne (anni)
    for (let c = 0; c < 3; c++) {
        const y = years + yearOffsets[c];
        const hdr = document.getElementById('hdr-col-' + c);
        if (yearOffsets[c] === 0) {
            hdr.textContent = y + ' anni';
        } else {
            const sign = yearOffsets[c] > 0 ? '+' : '';
            hdr.textContent = y + ' anni (' + sign + yearOffsets[c] + ')';
        }
    }

    // Aggiorna intestazioni righe (tasso)
    const pctFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    for (let r = 0; r < 3; r++) {
        const rate = baseRate + rateOffsets[r];
        const hdr = document.getElementById('hdr-row-' + r);
        if (rateOffsets[r] === 0) {
            hdr.textContent = pctFmt.format(rate) + '%';
        } else {
            const sign = rateOffsets[r] > 0 ? '+' : '';
            hdr.textContent = pctFmt.format(rate) + '% (' + sign + pctFmt.format(rateOffsets[r]) + ')';
        }
    }

    // Aggiorna celle valori
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const y = years + yearOffsets[c];
            const rate = baseRate + rateOffsets[r];
            const cell = document.getElementById(cellIds[r][c]);
            if (y <= 0 || rate < 0) {
                cell.textContent = 'N/A';
            } else {
                cell.textContent = fmtCurr(calcRata(P, y, rate));
            }
        }
    }
}

// Funzione per il fill dinamico dei range input (stile volume)
function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = parseFloat(slider.value) || 0;
    const percentage = ((value - min) / (max - min)) * 100;

    // Gradient from active color (indigo) to transparent/muted
    slider.style.background = `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`;
}

// Avvio iniziale
calculate();
