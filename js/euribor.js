// =============================================
// MODULO EURIBOR - Dati locali da euribor_data.js
// =============================================

// I dati sono caricati da euribor_data.js come variabile globale EURIBOR_LOCAL_DATA
// Nessun fetch necessario → nessun problema CORS
const euriborAllData = (typeof EURIBOR_LOCAL_DATA !== 'undefined') ? EURIBOR_LOCAL_DATA : null;

/**
 * Ritorna i dati per il tenor selezionato (1M o 3M).
 */
function getEuriborSeriesData(tenor = '3M') {
    if (!euriborAllData || !euriborAllData[tenor]) return null;
    return euriborAllData[tenor];
}

/**
 * Ritorna le date disponibili ordinate per il tenor selezionato.
 */
function getEuriborDateRange(tenor = '3M') {
    const data = getEuriborSeriesData(tenor);
    if (!data) return { min: '1999-01', max: '2026-01' };
    const keys = Object.keys(data).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
}

/**
 * Dato un mese di inizio (formato "YYYY-MM") e un numero di mesi,
 * ritorna un array di tassi Euribor mensili + spread.
 * Se i dati storici finiscono, usa il baseRateFallback.
 */
function getEuriborRatesForMortgage(startMonth, totalMonths, spread = 0, baseRateFallback = 0, tenor = '3M') {
    const data = getEuriborSeriesData(tenor);
    if (!data) return [];

    const rates = [];
    let [year, month] = startMonth.split('-').map(Number);
    let lastKnownHistoricalRate = null;

    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        let effectiveRate;

        if (data[key] !== undefined) {
            lastKnownHistoricalRate = data[key];
            effectiveRate = Math.max(0, lastKnownHistoricalRate) + spread;
        } else {
            effectiveRate = baseRateFallback;
        }

        rates.push(effectiveRate);

        month++;
        if (month > 12) {
            month = 1;
            year++;
        }
    }

    return rates;
}

// =============================================
// INTEGRAZIONE CON IL CALCOLATORE MUTUO
// =============================================

// Riferimenti DOM per la sezione Euribor (accessibili globalmente per script.js)
const euriborCheckbox = document.getElementById('useEuribor');
const euriborSection = document.getElementById('euribor-section');
const euriborStartInput = document.getElementById('euriborStart');
const euriborSpreadInput = document.getElementById('euriborSpread');
const euriborTenorSelect = document.getElementById('euriborTenor');
const euriborStatus = document.getElementById('euriborStatus');

/**
 * Aggiorna l'interfaccia Euribor dopo il caricamento dati o cambio tenor.
 */
function updateEuriborUI() {
    const tenor = euriborTenorSelect.value;
    const data = getEuriborSeriesData(tenor);
    if (!data) return;

    const count = Object.keys(data).length;
    const range = getEuriborDateRange(tenor);
    const meta = euriborAllData._meta || {};

    euriborStatus.innerHTML = `✅ Euribor <strong>${tenor}</strong>: ${count} mesi (${range.min} → ${range.max})<br>
        <small style="opacity:0.6">Aggiornato: ${meta.updated || 'N/D'}</small>`;
    euriborStatus.style.color = 'var(--accent)';

    // Aggiorna limiti date picker
    euriborStartInput.min = range.min;
    euriborStartInput.max = range.max;
    if (!euriborStartInput.value) {
        euriborStartInput.value = range.min;
    }
}

/**
 * Funzione chiamata da calculate() in script.js per ottenere la configurazione Euribor.
 */
function getEuriborConfig() {
    if (!euriborCheckbox.checked || !euriborAllData) {
        return { active: false, rates: [] };
    }

    const tenor = euriborTenorSelect.value;
    const startMonth = euriborStartInput.value;
    const spread = parseFloat(euriborSpreadInput.value) || 0;
    const years = parseInt(yearsInput.value) || 0;
    const totalMonths = years * 12;
    const baseRateFallback = parseFloat(rateInput.value) || 0;

    if (!startMonth || totalMonths <= 0) {
        return { active: false, rates: [] };
    }

    const rates = getEuriborRatesForMortgage(startMonth, totalMonths, spread, baseRateFallback, tenor);

    // Conta quanti mesi hanno dati storici reali
    const data = getEuriborSeriesData(tenor);
    let historicalCount = 0;
    let [year, month] = startMonth.split('-').map(Number);
    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (data && data[key] !== undefined) historicalCount++;
        else break;
        month++; if (month > 12) { month = 1; year++; }
    }

    return { active: true, rates, historicalCount };
}
