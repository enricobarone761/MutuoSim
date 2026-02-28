/**
 * ===========================================================================
 *  MutuoSim — ui-manager.js
 * ===========================================================================
 *  Gestione dell'interfaccia dinamica: aggiunta/rimozione di periodi di tasso,
 *  estinzioni parziali e aggiunte di capitale.
 */

let periodCounter = 0;
let extraPaymentCounter = 0;
let capitalAdditionCounter = 0;

/**
 * Aggiunge una nuova riga "periodo variabile" al DOM.
 */
function addRatePeriod(startMonth = 1, endMonth = 12, rate = 4.0) {
    periodCounter++;
    const id = 'period-' + periodCounter;
    const row = document.createElement('div');
    row.className = 'rate-period-row';
    row.id = id;

    row.innerHTML = `
        <div>
            <label>Mese Inizio</label>
            <input type="number" class="period-start" value="${startMonth}" min="1" max="360" step="1">
        </div>
        <div>
            <label>Mese Fine</label>
            <input type="number" class="period-end" value="${endMonth}" min="1" max="360" step="1">
        </div>
        <div>
            <label>Tasso (%)</label>
            <input type="number" class="period-rate" value="${rate}" step="0.01">
        </div>
        <button class="btn btn-remove" onclick="removeRatePeriod('${id}')">✕</button>
    `;

    ratePeriodsContainer.appendChild(row);

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

/**
 * Gestione Estinzioni Parziali
 */
function addExtraPayment() {
    extraPaymentCounter++;
    const id = 'extra-pmt-' + extraPaymentCounter;
    const row = document.createElement('div');
    row.className = 'extra-payment-item';
    row.id = id;

    row.innerHTML = `
        <button class="btn btn-remove btn-remove-extra" onclick="removeExtraPayment('${id}')" title="Rimuovi" style="position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; line-height: 1;">✕</button>
        <div class="input-group" style="margin-bottom: 8px; padding-right: 40px;">
            <label>Importo Extra (€)</label>
            <input type="number" class="extra-amount" value="1000" step="50">
        </div>
        <div class="input-group" style="margin-bottom: 8px;">
            <label>Frequenza</label>
            <select class="extra-frequency">
                <option value="0">Mai</option>
                <option value="1">Una Tantum (Inizio)</option>
                <option value="12">Annuale</option>
                <option value="6">Semestrale</option>
                <option value="3">Trimestrale</option>
                <option value="1_monthly">Mensile</option>
            </select>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-end;">
            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                <label>Inizio Mese <span style="font-weight: 400; font-size: 0.75rem;">(0=Subito)</span></label>
                <input type="number" class="extra-start" value="0" step="1" min="0" max="360">
            </div>
            <div class="input-group" style="flex: 1; margin-bottom: 0;">
                <label>Durata <span style="font-weight: 400; font-size: 0.75rem;">(Anni, 0=Sempre)</span></label>
                <input type="number" class="extra-duration" value="0" step="1" min="0" max="30">
            </div>
        </div>
        <div class="input-group" style="margin-bottom: 0;">
            <label>Effetto</label>
            <select class="extra-effect">
                <option value="duration">Riduci Durata</option>
                <option value="installment">Riduci Rata</option>
            </select>
        </div>
    `;

    extraPaymentsContainer.appendChild(row);
    row.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('input', calculate);
        if (input.tagName === 'SELECT') {
            input.addEventListener('change', calculate);
        }
    });

    calculate();
}

function removeExtraPayment(id) {
    const row = document.getElementById(id);
    if (row) {
        row.remove();
        calculate();
    }
}

function getExtraPayments() {
    const payments = [];
    if (!extraPaymentsContainer) return payments;
    const rows = extraPaymentsContainer.querySelectorAll('.extra-payment-item');
    rows.forEach(row => {
        const amount = parseFloat(row.querySelector('.extra-amount').value) || 0;
        const freqVal = row.querySelector('.extra-frequency').value;
        const start = parseInt(row.querySelector('.extra-start').value) || 0;
        const duration = parseInt(row.querySelector('.extra-duration').value) || 0;
        const effect = row.querySelector('.extra-effect').value;

        let freqMonths = 0;
        if (freqVal === '1_monthly') freqMonths = 1;
        else if (freqVal === '1') freqMonths = -1;
        else freqMonths = parseInt(freqVal) || 0;

        if (amount > 0 && freqMonths !== 0) {
            payments.push({ amount, freqMonths, start, duration, effect });
        }
    });
    return payments;
}

/**
 * Gestione Aggiunte Capitale
 */
function addCapitalAddition() {
    capitalAdditionCounter++;
    const id = 'capital-add-' + capitalAdditionCounter;
    const row = document.createElement('div');
    row.className = 'extra-payment-item';
    row.id = id;
    row.style.padding = '8px 12px';
    row.style.marginBottom = '8px';
    row.style.background = 'rgba(16, 185, 129, 0.03)';
    row.style.border = '1px solid rgba(16, 185, 129, 0.1)';

    row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div style="flex: 2;">
                <label style="font-size: 0.7rem; margin-bottom: 2px; color: var(--text-muted);">+ Capitale (€)</label>
                <input type="number" class="capital-amount" value="10000" step="1000" style="padding: 4px 8px; font-size: 0.85rem;">
            </div>
            <div style="flex: 1.2;">
                <label style="font-size: 0.7rem; margin-bottom: 2px; color: var(--text-muted);">Mese</label>
                <input type="number" class="capital-start" value="12" step="1" min="1" max="360" style="padding: 4px 8px; font-size: 0.85rem;">
            </div>
            <button class="btn-remove" onclick="removeCapitalAddition('${id}')" title="Rimuovi" 
                    style="background: transparent; border: none; color: #f43f5e; cursor: pointer; padding: 4px; font-size: 1rem; margin-top: 14px;">✕</button>
        </div>
    `;

    capitalAdditionsContainer.appendChild(row);
    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', calculate);
    });
    calculate();
}

function removeCapitalAddition(id) {
    const row = document.getElementById(id);
    if (row) {
        row.remove();
        calculate();
    }
}

function getCapitalAdditions() {
    const additions = [];
    if (!capitalAdditionsContainer) return additions;
    const rows = capitalAdditionsContainer.querySelectorAll('.extra-payment-item');
    rows.forEach(row => {
        const amount = parseFloat(row.querySelector('.capital-amount').value) || 0;
        const start = parseInt(row.querySelector('.capital-start').value) || 0;
        if (amount > 0 && start > 0) {
            additions.push({ amount, start });
        }
    });
    return additions;
}

/**
 * Gestione Soluzione Ibrida
 */
function toggleHybridSection() {
    const isVisible = hybridToggle.checked;
    hybridSection.style.display = isVisible ? 'block' : 'none';
    hybridResultsBox.style.display = isVisible ? 'block' : 'none';
    calculate();
}

function updateHybridUI(results) {
    if (!results) return;

    outHybridCombinedRata.textContent = fmtCurr(results.scenarioB.combinedRata);

    const intSaving = results.interestSaving;
    outHybridInterestSaving.textContent = (intSaving >= 0 ? '+' : '') + fmtCurr(intSaving);
    outHybridInterestSaving.style.color = intSaving >= 0 ? '#10b981' : '#f43f5e';

    const totalDiff = results.totalSaving;
    outHybridTotalDiff.textContent = (totalDiff >= 0 ? 'Risparmio: ' : 'Sovrapprezzo: ') + fmtCurr(Math.abs(totalDiff));
    outHybridTotalDiff.style.color = totalDiff >= 0 ? '#10b981' : '#f43f5e';
}

/**
 * Tabella Sensibilità e Reset
 */
function updateSensitivityTable(P, years, baseRate, offsetRata = 0) {
    let yearOffsets = [5, 0, -5];

    // Se siamo a 30 anni, spostiamo gli offset per non superare il limite (es. mostra 30, 25, 20)
    if (years + yearOffsets[0] > 30) {
        const diff = (years + yearOffsets[0]) - 30;
        yearOffsets = yearOffsets.map(o => o - diff);
    }

    const rateOffsets = [0.5, 0, -0.5];
    const cellIds = [
        ['cell-plus5y-plus05r', 'cell-curr-y-plus05r', 'cell-minus5y-plus05r'],
        ['cell-plus5y-curr-r', 'cell-curr-y-curr-r', 'cell-minus5y-curr-r'],
        ['cell-plus5y-minus05r', 'cell-curr-y-minus05r', 'cell-minus5y-minus05r']
    ];

    for (let c = 0; c < 3; c++) {
        const y = years + yearOffsets[c];
        const hdr = document.getElementById('hdr-col-' + c);
        if (yearOffsets[c] === 0) hdr.textContent = y + ' anni';
        else {
            const sign = yearOffsets[c] > 0 ? '+' : '';
            hdr.textContent = y + ' anni (' + sign + yearOffsets[c] + ')';
        }
    }

    const pctFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    for (let r = 0; r < 3; r++) {
        const rate = baseRate + rateOffsets[r];
        const hdr = document.getElementById('hdr-row-' + r);
        if (rateOffsets[r] === 0) hdr.textContent = pctFmt.format(rate) + '%';
        else {
            const sign = rateOffsets[r] > 0 ? '+' : '';
            hdr.textContent = pctFmt.format(rate) + '% (' + sign + pctFmt.format(pctFmt.format ? rateOffsets[r] : rateOffsets[r]) + ')';
        }
    }

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const y = years + yearOffsets[c];
            const rate = baseRate + rateOffsets[r];
            const cell = document.getElementById(cellIds[r][c]);
            if (y <= 0 || rate < 0) cell.textContent = 'N/A';
            else cell.textContent = fmtCurr(calcRata(P, y, rate) + offsetRata);
        }
    }
}

function resetOutputs() {
    outInitialPayment.innerText = '--';
    outMaxPayment.innerText = '--';
    outTotalInterest.innerText = '--';
    outTotalPaid.innerText = '--';
    if (typeof myChart !== 'undefined' && myChart) myChart.destroy();
}
