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
    openAmortizationBtn.addEventListener('click', () => {
        amortizationDrawer.classList.add('open');
    });
    closeAmortizationBtn.addEventListener('click', () => {
        amortizationDrawer.classList.remove('open');
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

    const baselineResults = runSimulation({
        P, totalMonths, baseRate, euriborConfig, ratePeriods, isVariable,
        extraPaymentsList: [], capitalAdditionsList, roundUpStartMonth: 0, roundUpAmount: 0, roundUpAnnualIncrease: 0,
        generateChart: false
    });

    const results = runSimulation({
        P, totalMonths, baseRate, euriborConfig, ratePeriods, isVariable,
        extraPaymentsList, capitalAdditionsList, roundUpStartMonth, roundUpAmount, roundUpAnnualIncrease,
        generateChart: true
    });

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
}

// Avvio Iniziale
calculate();
