/**
 * ===========================================================================
 *  MutuoSim — inflation.js
 * ===========================================================================
 *  Modulo autonomo per il calcolo del costo reale del mutuo tenendo conto
 *  dell'inflazione storica (HICP Italia, Eurostat) e di quella attesa.
 *
 *  Dipendenze:
 *  - js/data/inflation_data.js  → variabile globale INFLATION_LOCAL_DATA
 *  - globals.js                 → inflationRateInput (condiviso con script.js)
 *  - utils.js                   → fmtCurr()
 *
 *  API pubblica (chiamata da script.js):
 *  - updateInflationUI(params)  → aggiorna tutto il box inflazione
 *  - getInflationStatus()       → restituisce stringa di stato dati
 */

'use strict';

/* ─── Dati storici ─────────────────────────────────────────────────────────── */

const inflationAllData = (typeof INFLATION_LOCAL_DATA !== 'undefined')
    ? INFLATION_LOCAL_DATA
    : null;

/**
 * Ritorna il tasso YoY mensile storico per un periodo "YYYY-MM".
 * Restituisce null se non disponibile.
 * @param {string} period  - es. "2022-06"
 * @returns {number|null}
 */
function getHistoricalInflationRate(period) {
    if (!inflationAllData || !inflationAllData.IT_HICP_YOY) return null;
    const val = inflationAllData.IT_HICP_YOY[period];
    return (val !== undefined && val !== null) ? val : null;
}

/**
 * Ritorna l'intervallo di date disponibili nello storico.
 * @returns {{ min: string, max: string }}
 */
function getInflationDateRange() {
    if (!inflationAllData || !inflationAllData.IT_HICP_YOY) {
        return { min: '1997-01', max: '2025-12' };
    }
    const keys = Object.keys(inflationAllData.IT_HICP_YOY).sort();
    return { min: keys[0], max: keys[keys.length - 1] };
}

/**
 * Ritorna un array di tassi YoY% mensili adatti al grafico.
 * Usa dati HICP storici dove disponibili, fallbackRate per i mesi futuri.
 *
 * @param {string|null} startMonth       - "YYYY-MM" o null
 * @param {number}      totalMonths      - numero di mesi
 * @param {number}      fallbackRate     - tasso annuo % inserito dall'utente
 * @returns {number[]}  array di % YoY (es. 2.5, -0.1, ...) per ogni mese
 */
function getInflationRatesForChart(startMonth, totalMonths, fallbackRate) {
    if (!startMonth || !inflationAllData || !inflationAllData.IT_HICP_YOY) {
        return Array(totalMonths).fill(parseFloat((fallbackRate || 0).toFixed(2)));
    }

    const rates = [];
    let [year, month] = startMonth.split('-').map(Number);

    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const yoy = getHistoricalInflationRate(key);
        rates.push(yoy !== null ? parseFloat(yoy.toFixed(2)) : parseFloat((fallbackRate || 0).toFixed(2)));

        month++;
        if (month > 12) { month = 1; year++; }
    }
    return rates;
}

/**
 * Costruisce un array di tassi di inflazione mensile (geometrici) per ogni mese del mutuo.
 * - Se startMonth è definito, usa i dati storici reali fino a esaurimento.
 * - Per i mesi futuri (o non presenti nello storico) usa fallbackAnnualRate.
 *
 * @param {string|null} startMonth       - "YYYY-MM" o null
 * @param {number}      totalMonths      - durata mutuo in mesi
 * @param {number}      fallbackAnnualRate - tasso annuo % inserito dall'utente
 * @returns {{ rates: number[], historicalCount: number }}
 *   rates: array di tassi mensili geometrici (non %)
 *   historicalCount: quanti mesi usano dati reali
 */
function buildInflationRates(startMonth, totalMonths, fallbackAnnualRate) {
    const fallbackMonthly = Math.pow(1 + fallbackAnnualRate / 100, 1 / 12) - 1;

    if (!startMonth || !inflationAllData || !inflationAllData.IT_HICP_YOY) {
        // Nessun dato storico: usa sempre il fallback
        return {
            rates: Array(totalMonths).fill(fallbackMonthly),
            historicalCount: 0
        };
    }

    const rates = [];
    let historicalCount = 0;
    let [year, month] = startMonth.split('-').map(Number);

    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        const yoy = getHistoricalInflationRate(key);

        if (yoy !== null) {
            // Dato storico presente: converte YoY annuo in tasso mensile geometrico
            const annualRate = yoy / 100;
            rates.push(Math.pow(1 + annualRate, 1 / 12) - 1);
            historicalCount++;
        } else {
            // Nessun dato (futuro o gap): usa il fallback dell'utente
            rates.push(fallbackMonthly);
        }

        month++;
        if (month > 12) { month = 1; year++; }
    }

    return { rates, historicalCount };
}

/* ─── Calcolo costo reale ──────────────────────────────────────────────────── */

/**
 * Calcola il costo reale (valore attuale) del mutuo, scontando ogni pagamento
 * per l'inflazione accumulata dal mese di riferimento (oggi = todayIdx).
 *
 * Usa per ogni mese il tasso mensile dell'array inflRates (storico o fallback).
 *
 * @param {Array}   amortizationSchedule - piano ammortamento
 * @param {number[]} inflRates            - tasso mensile geometrico per mese
 * @param {number}  todayIdx             - indice mese "oggi" (0 = inizio mutuo)
 * @param {number}  initialCosts         - costi iniziali (pagati al mese 0)
 * @param {number}  monthlyInsurance     - assicurazione mensile
 * @returns {number} costo reale in €
 */
function calcRealCost(amortizationSchedule, inflRates, todayIdx, initialCosts, monthlyInsurance) {
    let realCost = 0;

    amortizationSchedule.forEach(row => {
        const m = row.month; // 1-indexed
        const nominalPayment = row.payment + row.extra + monthlyInsurance;

        // Inflazione cumulata dal mese todayIdx al mese m
        // Se m > todayIdx: sconto (pagamento futuro vale meno)
        // Se m < todayIdx: inflazione (pagamento passato valeva di più)
        let cumulativeInflation = 1.0;
        if (m > todayIdx) {
            // Sconto in avanti: moltiplica (1+r) per ogni mese da todayIdx a m-1
            for (let k = todayIdx; k < m; k++) {
                const rateIdx = Math.min(k, inflRates.length - 1);
                cumulativeInflation *= (1 + inflRates[rateIdx]);
            }
        } else if (m < todayIdx) {
            // Pagamento nel passato: porta a "oggi" moltiplicando (1+r)
            for (let k = m; k < todayIdx; k++) {
                const rateIdx = Math.min(k - 1, inflRates.length - 1);
                cumulativeInflation *= (1 + inflRates[rateIdx]);
            }
        }
        // m === todayIdx: cumulativeInflation rimane 1

        realCost += nominalPayment / cumulativeInflation;
    });

    // Costi iniziali (mese 0): porta a "oggi"
    if (todayIdx > 0) {
        let cumInitial = 1.0;
        for (let k = 0; k < todayIdx; k++) {
            const rateIdx = Math.min(k, inflRates.length - 1);
            cumInitial *= (1 + inflRates[rateIdx]);
        }
        realCost += initialCosts / cumInitial;
    } else {
        realCost += initialCosts;
    }

    return realCost;
}

/* ─── UI ───────────────────────────────────────────────────────────────────── */

// Riferimenti DOM (locali al modulo — inflationRateInput è in globals.js)
const _inflResultBox = document.getElementById('inflationResultBox');
const _outNominalTotal = document.getElementById('outNominalTotal');
const _outRealCostTotal = document.getElementById('outRealCostTotal');
const _inflSavingNote = document.getElementById('inflationSavingNote');
const _inflDataStatus = document.getElementById('inflationDataStatus');
const _inflHistoricalBadge = document.getElementById('inflHistoricalBadge');

/**
 * Aggiorna tutta la sezione inflazione (badge stato dati, result box, nota).
 *
 * @param {object} params
 *   @param {Array}   params.amortizationSchedule
 *   @param {number}  params.baseTotalPaid      - totale nominale (€)
 *   @param {number}  params.initialCosts       - costi iniziali (€)
 *   @param {number}  params.monthlyInsurance   - assicurazione mensile (€)
 *   @param {number|null} params.currentMonthIndex - mese corrente (null = non attivo)
 *   @param {string|null} params.startMonth     - "YYYY-MM" data inizio mutuo
 */
function updateInflationUI(params) {
    const {
        amortizationSchedule,
        baseTotalPaid,
        initialCosts,
        monthlyInsurance,
        currentMonthIndex,
        startMonth
    } = params;

    const fallbackRate = parseFloat(inflationRateInput ? inflationRateInput.value : 0) || 0;

    // Aggiorna badge stato dati storici
    _updateInflationStatusBadge(startMonth, fallbackRate);

    if (!_inflResultBox) return;

    if (fallbackRate <= 0 && !startMonth) {
        // Nessun dato da mostrare
        _inflResultBox.style.display = 'none';
        return;
    }

    const totalMonths = amortizationSchedule.length;
    if (totalMonths === 0) {
        _inflResultBox.style.display = 'none';
        return;
    }

    // Costruisci array tassi mensili (storico + fallback)
    const { rates: inflRates, historicalCount } = buildInflationRates(
        startMonth, totalMonths, fallbackRate
    );

    // currentMonthIndex è 1-based (mese 1 = primo mese del mutuo); convertiamo a 0-based per l'array inflRates
    const todayIdx = currentMonthIndex ? currentMonthIndex - 1 : 0;

    // Calcola costo reale
    const realCost = calcRealCost(
        amortizationSchedule,
        inflRates,
        todayIdx,
        initialCosts,
        monthlyInsurance
    );

    const nominalTotal = baseTotalPaid;
    const saving = nominalTotal - realCost;
    const savingPct = nominalTotal > 0 ? (saving / nominalTotal) * 100 : 0;

    // Aggiorna DOM
    _inflResultBox.style.display = 'block';
    if (_outNominalTotal) _outNominalTotal.textContent = fmtCurr(nominalTotal);
    if (_outRealCostTotal) _outRealCostTotal.textContent = fmtCurr(realCost);

    // Badge mesi storici usati
    if (_inflHistoricalBadge) {
        if (historicalCount > 0) {
            _inflHistoricalBadge.textContent =
                `📊 ${historicalCount} mes${historicalCount === 1 ? 'e' : 'i'} su dati HICP reali`;
            _inflHistoricalBadge.style.display = 'block';
        } else {
            _inflHistoricalBadge.style.display = 'none';
        }
    }

    // Nota esplicativa
    if (_inflSavingNote) {
        const timeRef = todayIdx > 0 ? 'nei tuoi euro di oggi' : "negli euro di quando hai firmato";

        if (saving > 0) {
            const historicalNote = historicalCount > 0
                ? ` (${historicalCount} mesi con dati HICP reali, il resto stimato al ${fallbackRate.toFixed(1)}%)`
                : '';
            _inflSavingNote.innerHTML =
                `🎁 <strong>Risparmio invisibile: ${fmtCurr(saving)}</strong> (−${savingPct.toFixed(1)}%)${historicalNote}<br>` +
                `Le rate future valgono meno ${timeRef}. ` +
                `In pratica, il mutuo ti costerà davvero <strong>${fmtCurr(realCost)}</strong> di sforzo economico, non ${fmtCurr(nominalTotal)}.`;
        } else {
            _inflSavingNote.textContent =
                `Con i tassi inseriti il costo reale è praticamente uguale a quello nominale.`;
        }
    }
}

/**
 * Aggiorna il badge/status che mostra lo stato dei dati storici disponibili.
 * @param {string|null} startMonth
 * @param {number}      fallbackRate
 */
function _updateInflationStatusBadge(startMonth, fallbackRate) {
    if (!_inflDataStatus) return;

    if (!inflationAllData) {
        _inflDataStatus.innerHTML =
            `⚠️ Dati storici HICP non disponibili — verrà usato il tasso inserito (${fallbackRate.toFixed(1)}%).`;
        _inflDataStatus.style.color = '#f59e0b';
        return;
    }

    const range = getInflationDateRange();
    const meta = inflationAllData._meta || {};

    if (startMonth) {
        const [startY, startM] = startMonth.split('-').map(Number);
        const [maxY, maxM] = range.max.split('-').map(Number);
        const startInRange = startMonth >= range.min;

        if (startInRange) {
            // Conta quanti mesi del mutuo hanno dati reali
            const now = new Date();
            const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            _inflDataStatus.innerHTML =
                `✅ Dati HICP reali: <strong>${range.min}</strong> → <strong>${range.max}</strong>&nbsp;` +
                `<small style="opacity:0.6">(agg. ${meta.updated ? meta.updated.slice(0, 10) : 'N/D'})</small><br>` +
                `<small style="color:var(--text-muted)">Per i mesi oltre ${range.max} viene usato il tasso stimato ${fallbackRate.toFixed(1)}%.</small>`;
            _inflDataStatus.style.color = '#10b981';
        } else {
            _inflDataStatus.innerHTML =
                `ℹ️ Data di inizio precedente allo storico disponibile (${range.min}). Verrà usato il tasso stimato.`;
            _inflDataStatus.style.color = '#94a3b8';
        }
    } else {
        _inflDataStatus.innerHTML =
            `📂 Storico HICP disponibile dal <strong>${range.min}</strong> al <strong>${range.max}</strong>. ` +
            `Attiva <em>"Data Inizio"</em> per usarlo automaticamente.`;
        _inflDataStatus.style.color = '#94a3b8';
    }
}

/**
 * Ritorna una stringa di stato sintetica (per debug o altri moduli).
 * @returns {string}
 */
function getInflationStatus() {
    if (!inflationAllData) return 'Dati non caricati';
    const range = getInflationDateRange();
    const count = Object.keys(inflationAllData.IT_HICP_YOY || {}).length;
    return `HICP Italia: ${count} mesi (${range.min} → ${range.max})`;
}
