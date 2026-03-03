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
        let P = parseFloat(amountInput.value) || 0;
        const target = parseFloat(targetRataInput.value) || 0;
        const rate = parseFloat(rateInput.value) || 0;

        if (P <= 0 || target <= 0) return;

        let loanRata = 0;
        const isHybridActive = hybridToggle && hybridToggle.checked;
        if (isHybridActive) {
            const hAmount = parseFloat(hybridLoanAmountInput.value) || 0;
            const hRate = parseFloat(hybridLoanRateInput.value) || 0;
            const hYears = parseInt(hybridLoanYearsInput.value) || 0;
            const hMonths = Math.max(1, hYears * 12);

            const mortgageAmount = Math.max(0, P - hAmount);
            const actualLoanAmount = Math.min(P, hAmount);

            const monthlyLoanRate = hRate / 100 / 12;
            if (monthlyLoanRate === 0) {
                loanRata = actualLoanAmount / hMonths;
            } else {
                loanRata = (actualLoanAmount * monthlyLoanRate) / (1 - Math.pow(1 + monthlyLoanRate, -hMonths));
            }
            P = mortgageAmount;
        }

        let bestY = 1;
        let minDiff = Infinity;

        for (let y = 1; y <= 30; y++) {
            const r = calcRata(P, y, rate) + loanRata;
            const diff = Math.abs(r - target);
            if (diff < minDiff) {
                minDiff = diff;
                bestY = y;
            }
        }

        yearsInput.value = bestY;
        calculate();

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
        e.stopPropagation();
        amortizationDrawer.classList.add('open');
    });
    closeAmortizationBtn.addEventListener('click', () => {
        amortizationDrawer.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (amortizationDrawer.classList.contains('open') && !amortizationDrawer.contains(e.target)) {
            amortizationDrawer.classList.remove('open');
        }
    });

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

// --- Event Listeners Data Inizio & Indicatore Oggi ---
if (startDateToggle) {
    startDateToggle.addEventListener('change', function () {
        startDateSection.style.display = this.checked ? 'block' : 'none';
        if (typeof updateEuriborUI === 'function') updateEuriborUI();
        calculate();
    });
}
if (startDateInput) {
    startDateInput.addEventListener('change', () => {
        if (typeof updateEuriborUI === 'function') updateEuriborUI();
        calculate();
    });
}
const startDateTodayBtn = document.getElementById('startDateTodayBtn');
if (startDateTodayBtn) {
    startDateTodayBtn.addEventListener('click', function () {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        startDateInput.value = `${yyyy}-${mm}`;
        calculate();
    });
}

// --- Event Listeners Avanzate ---
if (toggleAdvancedBtn) {
    toggleAdvancedBtn.addEventListener('click', () => {
        advancedSection.classList.toggle('collapsed');
    });
    closeAdvancedBtn.addEventListener('click', () => {
        advancedSection.classList.add('collapsed');
    });

    [costIstruttoria, costPerizia, costNotaio, costImposta, costAssicurazione].forEach(el => {
        if (el) el.addEventListener('input', calculate);
    });

    if (calcDetrazione) {
        calcDetrazione.addEventListener('change', () => {
            detrazioneBox.style.display = calcDetrazione.checked ? 'flex' : 'none';
            calculate();
        });
    }

    if (investmentRate) investmentRate.addEventListener('input', calculate);
    if (monthlyIncome) monthlyIncome.addEventListener('input', calculate);
    if (propertyValue) propertyValue.addEventListener('input', calculate);
    if (inflationRateInput) inflationRateInput.addEventListener('input', calculate);
    if (showLtvOnChart) showLtvOnChart.addEventListener('change', calculate);
    if (showInflationOnChart) showInflationOnChart.addEventListener('change', calculate);

    if (addScenarioBtn) addScenarioBtn.addEventListener('click', addScenario);
}

/* ==========================================================================
 *  DYNAMIC SCENARIOS MANAGEMENT
 * ========================================================================== */

let scenarios = [];

function initScenarios() {
    const saved = localStorage.getItem('mutuosim_dynamic_scenarios');
    if (saved) {
        try {
            scenarios = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading scenarios', e);
            scenarios = [];
        }
    }
    renderScenarios();
}

function renderScenarios() {
    if (!scenariosContainer) return;
    scenariosContainer.innerHTML = '';

    if (scenarios.length === 0) {
        scenariosContainer.innerHTML = `
            <div style="text-align:center; padding: 20px; color:var(--text-muted); font-size:0.85rem; border:1px dashed var(--border-color); border-radius: var(--border-radius);">
                Nessun scenario salvato.
            </div>`;
    }

    scenarios.forEach(scenario => {
        const row = document.createElement('div');
        row.className = 'scenario-row';
        row.dataset.id = scenario.id;

        row.innerHTML = `
            <div class="scenario-row-header">
                <input type="text" class="scenario-name-input" value="${scenario.name}" placeholder="Nome scenario...">
                <button class="btn scenario-btn-delete" title="Elimina scenario">✕</button>
            </div>
            <div class="scenario-actions">
                <button class="btn scenario-btn btn-add" style="border-style: solid;" onclick="saveToScenario(${scenario.id})">
                    💾 Salva
                </button>
                <button class="btn scenario-btn btn-add" style="border-style: dashed;" onclick="loadFromScenario(${scenario.id})">
                    📂 Carica
                </button>
            </div>
        `;

        const nameInput = row.querySelector('.scenario-name-input');
        nameInput.addEventListener('change', (e) => {
            renameScenario(scenario.id, e.target.value);
        });

        const deleteBtn = row.querySelector('.scenario-btn-delete');
        deleteBtn.addEventListener('click', () => {
            deleteScenario(scenario.id);
        });

        scenariosContainer.appendChild(row);
    });
}

function addScenario() {
    const id = Date.now();
    scenarios.push({
        id: id,
        name: `Scenario ${scenarios.length + 1}`,
        data: null
    });
    saveScenariosToStorage();
    renderScenarios();
}

function deleteScenario(id) {
    if (!confirm('Eliminare questo scenario?')) return;
    scenarios = scenarios.filter(s => s.id !== id);
    saveScenariosToStorage();
    renderScenarios();
}

function renameScenario(id, newName) {
    const scenario = scenarios.find(s => s.id === id);
    if (scenario) {
        scenario.name = newName;
        saveScenariosToStorage();
    }
}

function saveToScenario(id) {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) return;

    scenario.data = {
        amount: amountInput.value,
        years: yearsInput.value,
        rate: rateInput.value,
        costIstruttoria: costIstruttoria.value,
        costPerizia: costPerizia.value,
        costNotaio: costNotaio.value,
        costImposta: costImposta.value,
        costAssicurazione: costAssicurazione.value,
        investmentRate: investmentRate.value,
        monthlyIncome: monthlyIncome.value,
        propertyValue: propertyValue.value,
        inflationRate: inflationRateInput ? inflationRateInput.value : '2.0',
        startDateToggle: startDateToggle ? startDateToggle.checked : false,
        startDate: startDateInput ? startDateInput.value : ''
    };

    saveScenariosToStorage();

    const row = scenariosContainer.querySelector(`[data-id="${id}"]`);
    const saveBtn = row.querySelector('button[onclick*="saveToScenario"]');
    const oldText = saveBtn.innerHTML;
    saveBtn.innerHTML = '✅ Salvato';
    saveBtn.style.color = '#10b981';
    setTimeout(() => {
        saveBtn.innerHTML = oldText;
        saveBtn.style.color = '';
    }, 1500);
}

function loadFromScenario(id) {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario || !scenario.data) {
        alert('Nessun dato salvato in questo scenario.');
        return;
    }

    const data = scenario.data;
    if (data.amount) amountInput.value = data.amount;
    if (data.years) yearsInput.value = data.years;
    if (data.rate) {
        rateInput.value = data.rate;
        if (rateNumericInput) rateNumericInput.value = data.rate;
    }
    if (data.costIstruttoria) costIstruttoria.value = data.costIstruttoria;
    if (data.costPerizia) costPerizia.value = data.costPerizia;
    if (data.costNotaio) costNotaio.value = data.costNotaio;
    if (data.costImposta) costImposta.value = data.costImposta;
    if (data.costAssicurazione) costAssicurazione.value = data.costAssicurazione;
    if (data.investmentRate) investmentRate.value = data.investmentRate;
    if (data.monthlyIncome) monthlyIncome.value = data.monthlyIncome;
    if (data.propertyValue) propertyValue.value = data.propertyValue;
    if (data.inflationRate && inflationRateInput) inflationRateInput.value = data.inflationRate;
    if (startDateToggle && data.startDateToggle !== undefined) {
        startDateToggle.checked = data.startDateToggle;
        startDateSection.style.display = data.startDateToggle ? 'block' : 'none';
    }
    if (startDateInput && data.startDate) startDateInput.value = data.startDate;

    calculate();

    const row = scenariosContainer.querySelector(`[data-id="${id}"]`);
    const loadBtn = row.querySelector('button[onclick*="loadFromScenario"]');
    const oldText = loadBtn.innerHTML;
    loadBtn.innerHTML = '✨ Caricato';
    loadBtn.style.color = '#10b981';
    setTimeout(() => {
        loadBtn.innerHTML = oldText;
        loadBtn.style.color = '';
    }, 1500);
}

function saveScenariosToStorage() {
    localStorage.setItem('mutuosim_dynamic_scenarios', JSON.stringify(scenarios));
}

// Make globally available for onclick
window.saveToScenario = saveToScenario;
window.loadFromScenario = loadFromScenario;

initScenarios();

/* ==========================================================================
 *  3. CALCULATE() — Orchestratore
 * ========================================================================== */

function calculate() {
    const P = parseFloat(amountInput.value) || 0;
    let years = parseInt(yearsInput.value) || 0;
    if (years > 30) {
        years = 30;
        yearsInput.value = 30;
    }
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
        let hYears = parseInt(hybridLoanYearsInput.value) || 0;
        if (hYears > 30) {
            hYears = 30;
            hybridLoanYearsInput.value = 30;
        }
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

    if (isHybridActive && loanRata > 0) {
        let hybridMaxRata = 0;
        results.amortizationSchedule.forEach(row => {
            if (row.month <= loanMonths) {
                row.payment += loanRata;
                row.totalPaid += loanRata;
            }
            if (row.payment > hybridMaxRata) hybridMaxRata = row.payment;
        });
        results.maxRataSeen = hybridMaxRata;
        if (results.amortizationSchedule.length > 0) {
            results.firstRata = results.amortizationSchedule[0].payment;
        }

        results.fullDataActualPayment = results.fullDataActualPayment.map((val, idx) => {
            return (idx < loanMonths) ? val + loanRata : val;
        });
        results.fullDataPayment = results.fullDataPayment.map((val, idx) => {
            return (idx < loanMonths) ? val + loanRata : val;
        });

        const hAmount = parseFloat(hybridLoanAmountInput.value) || 0;
        const totalLoanInterest = (loanRata * loanMonths) - Math.min(P, hAmount);
        results.totalInterestPaid += totalLoanInterest;
    }

    const interestSaved = Math.max(0, baselineResults.totalInterestPaid - results.totalInterestPaid);
    let savedMonths = 0;
    const hasExtras = extraPaymentsList.length > 0 || roundUpAmount > 0 || roundUpAnnualIncrease > 0;

    if (hasExtras && results.actualMonths < totalMonths) {
        savedMonths = totalMonths - results.actualMonths;
    }

    // --- Data Inizio & Mese Corrente ---
    let startDate = null;
    let currentMonthIndex = null;
    const startDateActive = startDateToggle && startDateToggle.checked && startDateInput && startDateInput.value;
    if (startDateActive) {
        startDate = new Date(startDateInput.value + '-01');
        const nowSystem = new Date();
        const now = new Date(nowSystem.getFullYear(), nowSystem.getMonth(), 1);
        const diffMonths = (now.getFullYear() - startDate.getFullYear()) * 12
            + (now.getMonth() - startDate.getMonth());
        // +1 perché m nel grafico è 1-based (mese 1 = primo mese del mutuo)
        const currentMonthIndex1Based = diffMonths + 1;
        if (currentMonthIndex1Based >= 1 && currentMonthIndex1Based <= results.actualMonths) {
            currentMonthIndex = currentMonthIndex1Based;
        }
    }

    // Salva startDate e currentMonthIndex in lastFullResults per handleRangeChange
    results.startDate = startDate;
    results.currentMonthIndex = currentMonthIndex;

    // LTV
    const propValInitial = parseFloat(propertyValue.value) || 0;
    // propertyValueRaw è sempre valorizzato (per UI box e barra)
    results.propertyValueRaw = propValInitial;
    // propertyValue nel grafico: solo se il toggle "Mostra nel grafico" è attivo
    const ltvOnChart = showLtvOnChart && showLtvOnChart.checked;
    results.propertyValue = (propValInitial > 0 && ltvOnChart) ? propValInitial : null;

    // Inflazione nel grafico: array YoY% per mese (storico HICP + fallback)
    const inflOnChart = showInflationOnChart && showInflationOnChart.checked;
    if (inflOnChart && typeof getInflationRatesForChart === 'function') {
        const inflStartMonth = (startDateActive && startDateInput && startDateInput.value)
            ? startDateInput.value : null;
        const fallbackRate = parseFloat(inflationRateInput ? inflationRateInput.value : 0) || 0;
        results.fullDataInflation = getInflationRatesForChart(
            inflStartMonth, results.actualMonths, fallbackRate
        );
    } else {
        results.fullDataInflation = null;
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

    // updateRangeUI gestisce le label (con date reali se disponibili)
    updateRangeUI(startDate);

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
        results.historicalEndMonth,
        true,
        startDate,
        currentMonthIndex,
        results.fullDataInflation || null
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

    updateSensitivityTable(simP, years, baseRate, loanRata);

    // --- Calcoli Avanzati (Right Sidebar) ---
    if (advancedSection) {
        const cIstru = parseFloat(costIstruttoria.value) || 0;
        const cPeri = parseFloat(costPerizia.value) || 0;
        const cNot = parseFloat(costNotaio.value) || 0;
        const cImp = parseFloat(costImposta.value) || 0;
        const cAssic = parseFloat(costAssicurazione.value) || 0;

        const initialCosts = cIstru + cPeri + cNot + cImp;
        const totalAssicurazione = cAssic * results.actualMonths;

        const baseTotalPaid = P + results.totalInterestPaid + totalAssicurazione + initialCosts;
        outTotalPaid.innerText = fmtCurr(baseTotalPaid);

        // TAEG
        const P_netto = P - initialCosts;
        if (P_netto > 0 && results.actualMonths > 0) {
            const avgPayment = (results.totalInterestPaid + P) / results.actualMonths + cAssic;
            const n = results.actualMonths;
            let r = baseRate / 100 / 12;
            for (let iter = 0; iter < 100; iter++) {
                const pow = Math.pow(1 + r, n);
                const f = P_netto - avgPayment * (1 - 1 / pow) / r;
                const df = avgPayment * (
                    (1 - 1 / pow) / (r * r) -
                    n / (r * pow * (1 + r))
                );
                const r_new = r - f / df;
                if (Math.abs(r_new - r) < 1e-10) { r = r_new; break; }
                r = r_new;
                if (r < 0) { r = 0.0001; }
            }
            const taeg = (Math.pow(1 + r, 12) - 1) * 100;
            outTaeg.innerText = (isFinite(taeg) && taeg > 0) ? taeg.toFixed(2) + '%' : '--';
        } else {
            outTaeg.innerText = '--';
        }

        // Detrazione
        if (calcDetrazione && calcDetrazione.checked) {
            let totalDetrazione = 0;
            let currentYearInterest = 0;
            results.amortizationSchedule.forEach(row => {
                currentYearInterest += row.interest;
                if (row.month % 12 === 0 || row.month === results.actualMonths) {
                    const detraibile = Math.min(currentYearInterest, 4000);
                    totalDetrazione += detraibile * 0.19;
                    currentYearInterest = 0;
                }
            });
            outDetrazioneTotale.innerText = fmtCurr(totalDetrazione);
        }

        // Investimento Alternativo
        const invRateAnn = parseFloat(investmentRate.value) || 0;
        const invRateMo = invRateAnn / 100 / 12;
        // const mortRateMo = baseRate / 100 / 12; (Non più usato, usiamo tassi esatti)
        const baseN = baselineResults.actualMonths;

        let futureValue = 0;
        let fvPrepay = 0;

        const investmentNote = document.getElementById('investmentNote');
        const investmentVerdict = document.getElementById('investmentVerdict');
        const outInvestmentSaving = document.getElementById('outInvestmentSaving');

        if (results.totalExtraPaid > 0) {

            // Per il calcolo tasse/detrazioni perse
            const isDetrazioneActive = calcDetrazione && calcDetrazione.checked;
            let lostDeductionFV = 0;

            if (isDetrazioneActive) {
                // Calcoliamo la detrazione teorica e reale per anno per trovare quella persa
                let currentYearBaseInt = 0;
                let currentYearNewInt = 0;

                for (let m = 1; m <= baseN; m++) {
                    const baseRow = baselineResults.amortizationSchedule.find(r => r.month === m);
                    const newRow = results.amortizationSchedule.find(r => r.month === m);

                    if (baseRow) currentYearBaseInt += baseRow.interest;
                    if (newRow) currentYearNewInt += newRow.interest;

                    if (m % 12 === 0 || m === baseN) {
                        const baseDeduction = Math.min(currentYearBaseInt, 4000) * 0.19;
                        const newDeduction = Math.min(currentYearNewInt, 4000) * 0.19;
                        const lostDeduction = Math.max(0, baseDeduction - newDeduction);

                        // Capitalizza la detrazione persa fino alla fine del mutuo base
                        if (lostDeduction > 0) {
                            const monthsRemaining = baseN - m;
                            lostDeductionFV += lostDeduction * Math.pow(1 + invRateMo, monthsRemaining);
                        }

                        currentYearBaseInt = 0;
                        currentYearNewInt = 0;
                    }
                }
            }

            // Calcolo esatto per singolo versamento
            results.amortizationSchedule.forEach(row => {
                const extra = row.extra + (row.capitalAddition || 0);
                if (extra > 0) {
                    const rem = Math.max(0, baseN - row.month);

                    // Valore Futuro Investimento: matura al tasso mensile fisso (invRateMo)
                    futureValue += extra * Math.pow(1 + invRateMo, rem);

                    // Valore Futuro Estinzione: l'equivalente del risparmio composto 
                    // calcolato secondo i tassi base mese per mese da "row.month" a "baseN"
                    let fvCompoundPrepay = extra;
                    for (let f = row.month + 1; f <= baseN; f++) {
                        let fvRate = baseRate;
                        // Usa il tasso reale per quel mese, prelevato dalla baseline
                        const rateIndex = Math.min(f - 1, baselineResults.fullDataRate.length - 1);
                        if (rateIndex >= 0) {
                            fvRate = baselineResults.fullDataRate[rateIndex] || baseRate;
                        }
                        fvCompoundPrepay *= (1 + (fvRate / 100 / 12));
                    }
                    fvPrepay += fvCompoundPrepay;
                }
            });

            // Sottrae il FV delle detrazioni perse dal vantaggio dell'estinzione
            if (lostDeductionFV > 0) {
                fvPrepay -= lostDeductionFV;
            }

            outInvestmentValue.innerText = fmtCurr(futureValue);
            if (outInvestmentSaving) outInvestmentSaving.innerText = fmtCurr(fvPrepay);
            if (investmentNote) investmentNote.style.display = 'none';

            if (investmentVerdict) {
                investmentVerdict.style.display = 'block';
                if (Math.abs(futureValue - fvPrepay) < 1) {
                    investmentVerdict.textContent = `⚖️ Pareggio: le due strategie sono equivalenti.`;
                    investmentVerdict.style.background = 'rgba(148,163,184,0.1)';
                    investmentVerdict.style.color = 'var(--text-muted)';
                } else if (futureValue > fvPrepay) {
                    const diff = futureValue - fvPrepay;
                    let text = `📈 Investire conviene: il tuo investimento rende ${fmtCurr(diff)} in più del risparmio da estinzione.`;
                    if (isDetrazioneActive && lostDeductionFV > 0) {
                        text += ` (Include ${fmtCurr(lostDeductionFV)} di detrazioni fiscali perse composte)`;
                    }
                    investmentVerdict.textContent = text;
                    investmentVerdict.style.background = 'rgba(59,130,246,0.12)';
                    investmentVerdict.style.color = '#3b82f6';
                } else {
                    const diff = fvPrepay - futureValue;
                    let text = `🏦 Estinguere conviene: il risparmio composto vale ${fmtCurr(diff)} in più del tuo investimento.`;
                    if (isDetrazioneActive && lostDeductionFV > 0) {
                        text += ` (A netto di ${fmtCurr(lostDeductionFV)} di detrazioni fiscali perse composte)`;
                    }
                    investmentVerdict.textContent = text;
                    investmentVerdict.style.background = 'rgba(16,185,129,0.12)';
                    investmentVerdict.style.color = '#10b981';
                }
            }
        } else {
            outInvestmentValue.innerText = '--';
            if (outInvestmentSaving) outInvestmentSaving.innerText = '--';
            if (investmentNote) investmentNote.style.display = 'block';
            if (investmentVerdict) investmentVerdict.style.display = 'none';
        }

        // ===== INFLAZIONE SUL COSTO REALE — delegato a inflation.js =====
        if (typeof updateInflationUI === 'function') {
            // Usa la data di inizio mutuo (YYYY-MM) se attiva, per i dati storici HICP
            const inflStartMonth = (startDateActive && startDateInput && startDateInput.value)
                ? startDateInput.value
                : null;

            updateInflationUI({
                amortizationSchedule: results.amortizationSchedule,
                baseTotalPaid,
                initialCosts,
                monthlyInsurance: cAssic,
                currentMonthIndex,
                startMonth: inflStartMonth
            });
        }

        // Heatmap Interessi
        if (interestHeatmapContainer) {
            let yearlyInterests = [];
            let currentYearInterest = 0;
            results.amortizationSchedule.forEach(row => {
                currentYearInterest += row.interest;
                if (row.month % 12 === 0 || row.month === results.actualMonths) {
                    yearlyInterests.push(currentYearInterest);
                    currentYearInterest = 0;
                }
            });

            interestHeatmapContainer.innerHTML = '';
            if (yearlyInterests.length > 0) {
                const maxInt = Math.max(...yearlyInterests);
                yearlyInterests.forEach((val, idx) => {
                    const intensity = maxInt > 0 ? (val / maxInt) : 0;
                    const alpha = 0.2 + (intensity * 0.8);
                    const div = document.createElement('div');
                    div.style.flex = '1';
                    div.style.height = '100%';
                    div.style.backgroundColor = `rgba(244, 63, 94, ${alpha})`;
                    div.title = `Anno ${idx + 1}: ${fmtCurr(val)}`;
                    interestHeatmapContainer.appendChild(div);
                });
            }
        }

        // DTI
        const mIncome = parseFloat(monthlyIncome.value) || 0;
        if (mIncome > 0) {
            const totalMonthlyPayment = results.firstRata + cAssic;
            const dti = (totalMonthlyPayment / mIncome) * 100;
            outDti.innerText = dti.toFixed(1) + '%';
            if (dti > 33) {
                outDti.style.color = '#f43f5e';
            } else {
                outDti.style.color = '#10b981';
            }
        } else {
            outDti.innerText = '--';
        }

        // LTV — la UI usa sempre il valore grezzo, il grafico usa results.propertyValue
        const propVal = results.propertyValueRaw || 0;

        const ltvResultBox = document.getElementById('ltvResultBox');
        const outLtvPercent = document.getElementById('outLtvPercent');
        const ltvBar = document.getElementById('ltvBar');
        const ltvMessage = document.getElementById('ltvMessage');

        if (propVal > 0) {
            const totalCapitalAdditions = capitalAdditionsList.reduce((sum, ca) => sum + (ca.amount || 0), 0);
            const totalFinanziato = P + totalCapitalAdditions;
            // LTV iniziale (all'accensione)
            const ltvIniziale = (totalFinanziato / propVal) * 100;

            // LTV corrente: se c'è un mese corrente, usa il debito residuo di quel mese
            let ltvCorrente = ltvIniziale;
            let debitoResiduo = totalFinanziato;
            const hasTodayIndex = currentMonthIndex !== null && currentMonthIndex > 0;
            if (hasTodayIndex && results.amortizationSchedule && results.amortizationSchedule.length > 0) {
                // Trova il saldo residuo al mese corrente nel piano di ammortamento
                const idx = Math.min(currentMonthIndex, results.amortizationSchedule.length) - 1;
                const scheduleRow = results.amortizationSchedule[idx];
                if (scheduleRow) {
                    // Il campo 'balance' non è disponibile nel piano, usiamo fullDataBalance
                    const balIdx = Math.min(currentMonthIndex - 1, results.fullDataBalance.length - 1);
                    if (balIdx >= 0 && results.fullDataBalance[balIdx] !== undefined) {
                        debitoResiduo = results.fullDataBalance[balIdx];
                        ltvCorrente = (debitoResiduo / propVal) * 100;
                    }
                }
            }

            // La barra e il valore principale mostrano il LTV corrente (o iniziale se non c'è data)
            const ltv = ltvCorrente;
            const ltvClamped = Math.min(ltv, 100);

            if (ltvResultBox) ltvResultBox.style.display = 'block';

            // Aggiorna etichetta del box contestualmente
            const ltvLabel = ltvResultBox.querySelector('.ltv-label-header');
            if (ltvLabel) {
                ltvLabel.textContent = hasTodayIndex ? 'LTV attuale' : 'LTV all\'accensione';
            }

            if (outLtvPercent) {
                outLtvPercent.textContent = ltv.toFixed(1) + '%';
            }

            // Mostra confronto iniziale se in modalità corrente
            const ltvCompareEl = document.getElementById('ltvCompare');
            if (ltvCompareEl) {
                if (hasTodayIndex) {
                    const guadagno = ltvIniziale - ltvCorrente;
                    ltvCompareEl.innerHTML = `<span style="color:var(--text-muted);font-size:0.72rem;">All'accensione: <strong>${ltvIniziale.toFixed(1)}%</strong></span>&nbsp;&nbsp;<span style="color:#10b981;font-size:0.72rem;">▼ ${guadagno.toFixed(1)}pp migliorato</span>`;
                    ltvCompareEl.style.display = 'block';
                } else {
                    ltvCompareEl.style.display = 'none';
                }
            }

            if (ltvBar) {
                ltvBar.style.width = ltvClamped + '%';
                if (ltv <= 60) {
                    ltvBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
                    outLtvPercent.style.color = '#10b981';
                } else if (ltv <= 80) {
                    ltvBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
                    outLtvPercent.style.color = '#f59e0b';
                } else {
                    ltvBar.style.background = 'linear-gradient(90deg, #f43f5e, #fb7185)';
                    outLtvPercent.style.color = '#f43f5e';
                }
            }
            if (ltvMessage) {
                if (ltv <= 60) {
                    ltvMessage.textContent = '✅ Ottimo: la banca ti vede come mutuatario a basso rischio. Potresti ottenere condizioni migliori in caso di surroga.';
                    ltvMessage.style.background = 'rgba(16,185,129,0.1)';
                    ltvMessage.style.color = '#10b981';
                } else if (ltv <= 80) {
                    ltvMessage.textContent = '⚠️ Nella norma: LTV tra 60-80% è accettato dalle banche, ma difficilmente otterrai condizioni preferenziali.';
                    ltvMessage.style.background = 'rgba(245,158,11,0.1)';
                    ltvMessage.style.color = '#f59e0b';
                } else {
                    ltvMessage.textContent = '🔴 Elevato: LTV > 80% può limitare la possibilità di surroga o rinegoziazione. Le banche potrebbero richiedere garanzie aggiuntive.';
                    ltvMessage.style.background = 'rgba(244,63,94,0.1)';
                    ltvMessage.style.color = '#f43f5e';
                }
            }
        } else {
            if (ltvResultBox) ltvResultBox.style.display = 'none';
        }

        // ===== BARRA AVANZAMENTO RIMBORSO =====
        if (repaymentProgressContainer && repaymentProgressNoDate) {
            if (startDateActive && currentMonthIndex !== null && currentMonthIndex >= 0) {
                repaymentProgressContainer.style.display = 'block';
                repaymentProgressNoDate.style.display = 'none';

                const pct = Math.min(100, (currentMonthIndex / results.actualMonths) * 100);
                repaymentProgressBar.style.width = pct.toFixed(1) + '%';

                if (outCurrentMonth) outCurrentMonth.textContent = currentMonthIndex;
                if (outTotalMonths) outTotalMonths.textContent = results.actualMonths;
                if (outRepaymentPercent) outRepaymentPercent.textContent = pct.toFixed(1) + '%';

                // Colore percentuale
                if (outRepaymentPercent) {
                    if (pct < 33) outRepaymentPercent.style.color = '#10b981';
                    else if (pct < 66) outRepaymentPercent.style.color = '#f59e0b';
                    else outRepaymentPercent.style.color = '#fb923c';
                }

                // Data fine prevista
                if (outRepaymentEndDate && startDate) {
                    const endDate = new Date(startDate);
                    endDate.setMonth(endDate.getMonth() + results.actualMonths - 1);
                    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                    outRepaymentEndDate.textContent = `Fine prevista: ${monthNames[endDate.getMonth()]} ${endDate.getFullYear()}`;
                }
            } else {
                repaymentProgressContainer.style.display = 'none';
                repaymentProgressNoDate.style.display = 'block';
            }
        }
    }

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
