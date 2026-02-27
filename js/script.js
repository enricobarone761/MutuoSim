/**
 * ===========================================================================
 *  MutuoSim — script.js (Controller Principal)
 * ===========================================================================
 *  Orchestratore dell'applicazione. Gestisce i riferimenti DOM, gli event
 *  listeners e il ciclo di aggiornamento calculate().
 * 
 *  Dipendenze (caricate nell'HTML):
 *  - utils.js
 *  - engine.js (runSimulation, calcRata)
 *  - ui-manager.js (gestione input dinamici)
 *  - chart-manager.js (updateChart, range slider)
 *  - euribor_data.js & euribor.js
 */

/* ==========================================================================
 *  1. STATO GLOBALE
 * ========================================================================== */


/* ==========================================================================
 *  2. EVENT LISTENERS
 * ========================================================================== */

amountInput.addEventListener('input', calculate);
yearsInput.addEventListener('input', calculate);
rateInput.addEventListener('input', calculate);

if (calcYearsFromRataBtn) {
    calcYearsFromRataBtn.addEventListener('click', () => {
        const P = parseFloat(amountInput.value) || 0;
        const target = parseFloat(targetRataInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;

        if (P <= 0 || target <= 0) return;

        let bestY = 1;
        let minDiff = Infinity;

        // Cerchiamo la durata (1-50 anni) che si avvicina di più alla rata target
        for (let y = 1; y <= 50; y++) {
            const r = calcRata(P, y, rate);
            const diff = Math.abs(r - target);
            if (diff < minDiff) {
                minDiff = diff;
                bestY = y;
            }
        }

        yearsInput.value = bestY;
        calculate();

        // Effetto grafico feedback
        calcYearsFromRataBtn.style.color = '#10b981';
        setTimeout(() => {
            calcYearsFromRataBtn.style.color = '#a855f7';
        }, 500);
    });
}

addExtraPaymentBtn.addEventListener('click', () => addExtraPayment());

if (addCapitalAdditionBtn) {
    addCapitalAdditionBtn.addEventListener('click', () => addCapitalAddition());
}

if (roundUpStartMonthInput) roundUpStartMonthInput.addEventListener('input', calculate);
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

rataBox.addEventListener('click', function () {
    const isOpen = rataSensitivityPanel.style.display !== 'none';
    rataSensitivityPanel.style.display = isOpen ? 'none' : 'block';
    rataBox.classList.toggle('active', !isOpen);
});

if (openAmortizationBtn && closeAmortizationBtn && amortizationDrawer) {
    openAmortizationBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita che il click si propaghi al document e chiuda subito il drawer
        amortizationDrawer.classList.add('open');
    });
    closeAmortizationBtn.addEventListener('click', () => {
        amortizationDrawer.classList.remove('open');
    });

    // Chiudi cliccando fuori dal drawer
    document.addEventListener('click', (e) => {
        if (amortizationDrawer.classList.contains('open') && !amortizationDrawer.contains(e.target)) {
            amortizationDrawer.classList.remove('open');
        }
    });

    // Evita che i click all'interno del drawer lo chiudano
    amortizationDrawer.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

isVariableCheckbox.addEventListener('change', function () {
    variableSection.style.display = this.checked ? 'block' : 'none';
    if (this.checked) {
        if (typeof euriborCheckbox !== 'undefined') euriborCheckbox.checked = false;
        if (typeof euriborSection !== 'undefined') euriborSection.style.display = 'none';
        if (ratePeriodsContainer.children.length === 0) {
            addRatePeriod(1, 12, parseFloat(rateInput.value) || 4.0);
        }
    }
    calculate();
});

addPeriodBtn.addEventListener('click', () => addRatePeriod());

// --- Euribor Integrazione ---
if (typeof euriborCheckbox !== 'undefined') {
    euriborCheckbox.addEventListener('change', function () {
        euriborSection.style.display = this.checked ? 'block' : 'none';
        if (this.checked) {
            isVariableCheckbox.checked = false;
            variableSection.style.display = 'none';
            if (typeof updateEuriborUI === 'function') updateEuriborUI();
        }
        calculate();
    });

    euriborStartInput.addEventListener('change', calculate);
    euriborSpreadInput.addEventListener('input', calculate);
    euriborTenorSelect.addEventListener('change', function () {
        if (typeof updateEuriborUI === 'function') updateEuriborUI();
        calculate();
    });
}

// --- Event Listeners Selettore Intervallo ---
if (chartRangeMin && chartRangeMax) {
    chartRangeMin.addEventListener('input', handleRangeChange);
    chartRangeMax.addEventListener('input', handleRangeChange);
}

// --- Event Listeners Soluzione Ibrida ---
if (hybridToggle) {
    hybridToggle.addEventListener('change', toggleHybridSection);
    hybridLoanAmountInput.addEventListener('input', calculate);
    hybridLoanRateInput.addEventListener('input', calculate);
    hybridLoanYearsInput.addEventListener('input', calculate);
}

/* ==========================================================================
 *  3. CALCULATE() — Orchestratore
 * ========================================================================== */

function calculate() {
    const P = parseFloat(amountInput.value) || 0;
    const years = parseInt(yearsInput.value) || 0;
    const baseRate = parseFloat(rateInput.value) || 0;

    if (rateNumericInput && document.activeElement !== rateNumericInput) {
        rateNumericInput.value = baseRate.toFixed(1);
    }
    updateSliderFill(rateInput);

    const extraPaymentsList = getExtraPayments();
    const capitalAdditionsList = getCapitalAdditions();

    let roundUpStartMonth = 0;
    if (roundUpStartMonthInput) roundUpStartMonth = parseInt(roundUpStartMonthInput.value) || 0;
    const roundUpAmount = parseFloat(roundUpAmountInput.value) || 0;
    const roundUpAnnualIncrease = parseFloat(roundUpAnnualIncreaseInput.value) || 0;

    if (P <= 0 || years <= 0) {
        resetOutputs();
        return;
    }

    const totalMonths = years * 12;
    const isVariable = isVariableCheckbox.checked;
    const ratePeriods = isVariable ? getRatePeriods() : [];
    const euriborConfig = (typeof getEuriborConfig === 'function') ? getEuriborConfig() : { active: false, rates: [] };

    let simP = P;
    let loanRata = 0;
    let loanMonths = 0;
    const isHybridActive = hybridToggle && hybridToggle.checked;

    if (isHybridActive) {
        const hAmount = parseFloat(hybridLoanAmountInput.value) || 0;
        const hRate = parseFloat(hybridLoanRateInput.value) || 0;
        const hYears = parseInt(hybridLoanYearsInput.value) || 0;
        simP = Math.max(0, P - hAmount);
        loanMonths = hYears * 12;

        const monthlyLoanRate = hRate / 100 / 12;
        if (monthlyLoanRate === 0) {
            loanRata = (Math.min(P, hAmount)) / Math.max(1, loanMonths);
        } else {
            loanRata = (Math.min(P, hAmount) * monthlyLoanRate) / (1 - Math.pow(1 + monthlyLoanRate, -Math.max(1, loanMonths)));
        }
    }

    const baselineResults = runSimulation({
        P: simP, totalMonths, baseRate, euriborConfig, ratePeriods, isVariable,
        extraPaymentsList: [], capitalAdditionsList, roundUpStartMonth: 0, roundUpAmount: 0, roundUpAnnualIncrease: 0,
        generateChart: false
    });

    const results = runSimulation({
        P: simP, totalMonths, baseRate, euriborConfig, ratePeriods, isVariable,
        extraPaymentsList, capitalAdditionsList, roundUpStartMonth, roundUpAmount, roundUpAnnualIncrease,
        generateChart: true
    });

    // Se ibrido attivo, aggiungiamo la rata del prestito al piano e ai dati del grafico
    if (isHybridActive && loanRata > 0) {
        results.amortizationSchedule.forEach(row => {
            if (row.month <= loanMonths) {
                row.payment += loanRata;
                row.totalPaid += loanRata;
            }
        });
        results.fullDataActualPayment = results.fullDataActualPayment.map((val, idx) => {
            return (idx < loanMonths) ? val + loanRata : val;
        });
        // Aggiorniamo anche la rata teorica per il grafico se necessario
        results.fullDataPayment = results.fullDataPayment.map((val, idx) => {
            return (idx < loanMonths) ? val + loanRata : val;
        });

        // Ricalcoliamo interessi totali per includere quelli del prestito (per gli output in UI)
        const totalLoanInterest = (loanRata * loanMonths) - Math.min(P, parseFloat(hybridLoanAmountInput.value) || 0);
        results.totalInterestPaid += totalLoanInterest;

        // Aggiorniamo rata iniziale e massima per la UI
        results.firstRata += loanRata;
        if (results.maxRataSeen < results.firstRata) results.maxRataSeen = results.firstRata;
    }

    const interestSaved = Math.max(0, baselineResults.totalInterestPaid - results.totalInterestPaid);
    let savedMonths = 0;
    const hasExtras = extraPaymentsList.length > 0 || roundUpAmount > 0 || roundUpAnnualIncrease > 0;

    if (hasExtras && results.actualMonths < totalMonths) {
        savedMonths = totalMonths - results.actualMonths;
    }

    lastFullResults = results;

    // Aggiornamento Range Chart
    const maxMonths = results.actualMonths;
    const oldMaxHistory = parseInt(chartRangeMax.oldMax || 0);
    const wasAtEnd = parseInt(chartRangeMax.value) >= oldMaxHistory - 1;

    chartRangeMin.max = maxMonths;
    chartRangeMax.max = maxMonths;

    let currentMin = parseInt(chartRangeMin.value);
    let currentMax = parseInt(chartRangeMax.value);

    if (currentMax > maxMonths || wasAtEnd) currentMax = maxMonths;
    if (currentMin > currentMax - MIN_CHART_RANGE) {
        currentMin = Math.max(1, currentMax - MIN_CHART_RANGE);
    }

    chartRangeMin.value = currentMin;
    chartRangeMax.value = currentMax;
    chartRangeMax.oldMax = maxMonths;

    updateRangeUI();

    // Aggiornamento Output UI
    outInitialPayment.innerText = fmtCurr(results.firstRata);
    outMaxPayment.innerText = fmtCurr(results.maxRataSeen);
    outTotalInterest.innerText = fmtCurr(results.totalInterestPaid);
    outTotalPaid.innerText = fmtCurr(P + results.totalInterestPaid);

    // Box Analisi Estinzione
    if (hasExtras && (savedMonths > 0 || interestSaved > 1.0 || results.totalExtraPaid > 0)) {
        let savedText = '';
        if (savedMonths > 0) {
            const savedYears = Math.floor(savedMonths / 12);
            const savedMonthsRemainder = savedMonths % 12;
            if (savedYears > 0) savedText += savedYears + ' anni';
            if (savedMonthsRemainder > 0) savedText += (savedText ? ' e ' : '') + savedMonthsRemainder + ' mesi';
        } else {
            savedText = 'Nessuna riduzione durata';
        }

        const savedLabel = savedTimeBox.querySelector('.label');
        if (savedLabel) savedLabel.textContent = '📊 Analisi Estinzione';

        let htmlContent = `<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 16px;">`;
        htmlContent += `<div style="font-weight:700; font-size: 1.5rem; color: #10b981; line-height: 1;">${savedText} <span style="font-weight:500; font-size:0.9rem; color:var(--text-muted);">in meno</span></div>`;
        htmlContent += `<div style="display: flex; gap: 32px; align-items: flex-end;">`;

        if (results.totalExtraPaid > 0) {
            htmlContent += `
             <div style="text-align: right; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 32px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 6px; line-height: 1;">Extra Versato</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: #fb923c; line-height: 1;">${fmtCurr(results.totalExtraPaid)}</span>
             </div>`;
        }
        htmlContent += `
             <div style="text-align: right;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block; margin-bottom: 6px; line-height: 1;">Interessi Risparmiati</span>
                <span style="font-size: 1.25rem; font-weight: 700; color: #10b981; line-height: 1;">${fmtCurr(interestSaved)}</span>
             </div>
        </div></div>`;

        outSavedTime.innerHTML = htmlContent;
        savedTimeBox.style.display = 'block';
    } else {
        savedTimeBox.style.display = 'none';
    }

    updateChart(
        results.fullLabels, results.fullDataBalance, results.fullDataInterest,
        results.fullDataPayment, results.fullDataActualPayment, results.fullDataRate,
        results.historicalEndMonth
    );

    const tbody = document.querySelector('#amortizationTable tbody');
    if (tbody) {
        tbody.innerHTML = '';
        results.amortizationSchedule.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center; color: var(--text-muted);">${row.month}</td>
                <td style="text-align: right;">${fmtCurr(row.payment)}</td>
                <td style="text-align: right;">${fmtCurr(row.interest)}</td>
                <td style="text-align: right; color: ${row.extra > 0 ? '#10b981' : (row.extra < 0 ? '#f43f5e' : 'inherit')};">${fmtCurr(row.extra)}</td>
                <td style="text-align: right; font-weight: 600;">${fmtCurr(row.totalPaid)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateSensitivityTable(P, years, baseRate);

    // --- Calcolo Soluzione Ibrida ---
    if (hybridToggle && hybridToggle.checked) {
        const hybridParams = {
            loanAmount: parseFloat(hybridLoanAmountInput.value) || 0,
            loanRate: parseFloat(hybridLoanRateInput.value) || 0,
            loanYears: parseInt(hybridLoanYearsInput.value) || 0
        };

        const baseParamsForHybrid = {
            P, totalMonths: years * 12, baseRate, euriborConfig, ratePeriods, isVariable,
            extraPaymentsList, capitalAdditionsList, roundUpStartMonth, roundUpAmount, roundUpAnnualIncrease,
            generateChart: false
        };

        const hybridResults = calculateHybridScenario(baseParamsForHybrid, hybridParams);
        updateHybridUI(hybridResults);
    }
}

// Avvio Iniziale
calculate();
