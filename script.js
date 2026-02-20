/**
 * ===========================================================================
 *  MutuoSim — script.js
 * ===========================================================================
 *
 *  Motore principale del simulatore di mutuo.
 *  Gestisce: input utente, simulazione ammortamento francese mese-per-mese,
 *  estinzione parziale (periodica / una-tantum), arrotondamento rata,
 *  tasso variabile manuale, integrazione Euribor storico (via euribor.js),
 *  grafico Chart.js e tabella di sensibilità 3×3.
 *
 *  ─── INDICE SEZIONI ───
 *
 *   1. VARIABILI GLOBALI & RIFERIMENTI DOM
 *   2. EVENT LISTENERS — binding di tutti gli input al ricalcolo
 *   3. GESTIONE PERIODI TASSO VARIABILE — addRatePeriod / removeRatePeriod / getRatePeriods
 *   4. UTILITÀ DI FORMATTAZIONE — fmtCurr (valuta EUR)
 *   5. FUNZIONE PRINCIPALE calculate() — orchestratore: legge input, lancia 2 simulazioni
 *      (baseline e con extra), calcola risparmi, aggiorna output e grafico
 *   6. FUNZIONE runSimulation(params) — core del motore: loop mese-per-mese con
 *      ammortamento francese, interessi, estinzione parziale, arrotondamento,
 *      tasso variabile / Euribor, generazione dati grafico
 *   7. resetOutputs() — azzera i campi output e distrugge il grafico
 *   8. updateChart() — crea/aggiorna il grafico Chart.js (5 dataset, 3 assi Y)
 *   9. calcRata() — formula pura ammortamento francese (usata dalla sensibilità)
 *  10. updateSensitivityTable() — tabella 3×3 con variazioni ±5 anni e ±0,5% tasso
 *  11. updateSliderFill() — stile dinamico slider range (effetto "volume bar")
 *  12. AVVIO — chiamata iniziale a calculate()
 *
 *  ─── DIPENDENZE ───
 *  • Chart.js + plugin annotation (CDN)
 *  • euribor.js   → espone getEuriborConfig(), updateEuriborUI(), variabili DOM Euribor
 *  • euribor_data.js → espone EURIBOR_LOCAL_DATA (tassi storici)
 *  • style.css    → variabili CSS (--accent, --danger, --text-main, --text-muted, ecc.)
 *
 * ===========================================================================
 */


/* ==========================================================================
 *  1. VARIABILI GLOBALI & RIFERIMENTI DOM
 *  --------------------------------------------------------------------------
 *  - myChart: istanza Chart.js corrente (distrutta e ricreata ad ogni ricalcolo)
 *  - periodCounter: contatore auto-incrementante per gli ID dei periodi variabili
 * ========================================================================== */

let myChart = null;
let periodCounter = 0;

// --- Input principali del mutuo ---
const amountInput = document.getElementById('amount');        // Importo del mutuo (€)
const yearsInput = document.getElementById('years');         // Durata (anni)
const rateInput = document.getElementById('rate');          // Tasso annuo (%) — slider range
const rateNumericInput = document.getElementById('rateNumeric'); // Tasso annuo (%) — input numerico badge

// --- Sezione tasso variabile manuale ---
const isVariableCheckbox = document.getElementById('isVariable');        // Checkbox attiva/disattiva
const variableSection = document.getElementById('variable-section');  // Container sezione
const ratePeriodsContainer = document.getElementById('rate-periods-container'); // Container righe periodi
const addPeriodBtn = document.getElementById('addPeriodBtn');      // Bottone "aggiungi periodo"

// --- Sezione estinzione parziale ---
const extraAmountInput = document.getElementById('extraAmount');       // Importo extra (€)
const extraFrequencySelect = document.getElementById('extraFrequency');   // Frequenza: mensile / trimestrale / annuale / una-tantum
const extraStartMonthInput = document.getElementById('extraStartMonth');  // Mese di inizio (ritardo partenza)
const extraDurationInput = document.getElementById('extraDuration');    // Durata pagamenti extra (anni, 0 = illimitato)
const extraEffectSelect = document.getElementById('extraEffect');      // Effetto: 'duration' (riduce durata) o 'installment' (riduce rata)

// --- Sezione arrotondamento rata ---
const roundUpAmountInput = document.getElementById('roundUpAmount');         // Rata arrotondata target (€)
const roundUpAnnualIncreaseInput = document.getElementById('roundUpAnnualIncrease'); // Incremento annuo (%) dell'arrotondamento

// --- Output numerici ---
const outInitialPayment = document.getElementById('outInitialPayment'); // Rata iniziale
const outMaxPayment = document.getElementById('outMaxPayment');     // Rata massima nel ciclo di vita
const outTotalInterest = document.getElementById('outTotalInterest');  // Totale interessi pagati
const outTotalPaid = document.getElementById('outTotalPaid');      // Totale versato (capitale + interessi)

// --- Box risparmio stimato ---
const savedTimeBox = document.getElementById('saved-time-box'); // Contenitore box risparmio
const outSavedTime = document.getElementById('outSavedTime');   // Div interno con durata/interessi risparmiati

// --- Tabella sensibilità ---
const rataBox = document.getElementById('rataBox');              // Box cliccabile "Rata Mensile" che apre la tabella
const rataSensitivityPanel = document.getElementById('rataSensitivityPanel'); // Pannello tabella sensibilità


/* ==========================================================================
 *  2. EVENT LISTENERS
 *  --------------------------------------------------------------------------
 *  Ogni modifica a qualsiasi input rilancia calculate() per aggiornare
 *  in tempo reale output, grafico e tabella sensibilità.
 * ========================================================================== */

// --- Input principali → ricalcolo immediato ---
amountInput.addEventListener('input', calculate);
yearsInput.addEventListener('input', calculate);
rateInput.addEventListener('input', calculate);

// --- Estinzione parziale → ricalcolo ---
extraAmountInput.addEventListener('input', calculate);
extraFrequencySelect.addEventListener('change', calculate);
extraStartMonthInput.addEventListener('input', calculate);
extraDurationInput.addEventListener('input', calculate);
extraEffectSelect.addEventListener('change', calculate);

// --- Arrotondamento rata → ricalcolo ---
roundUpAmountInput.addEventListener('input', calculate);
roundUpAnnualIncreaseInput.addEventListener('input', calculate);

// --- Sincronizzazione bidirezionale slider ↔ input numerico del tasso ---
if (rateNumericInput) {
    rateNumericInput.addEventListener('input', function () {
        const val = parseFloat(this.value);
        if (!isNaN(val)) {
            rateInput.value = val;   // Aggiorna lo slider
            calculate();
        }
    });
}

// --- Toggle pannello sensibilità (click su box rata) ---
rataBox.addEventListener('click', function () {
    const isOpen = rataSensitivityPanel.style.display !== 'none';
    rataSensitivityPanel.style.display = isOpen ? 'none' : 'block';
    rataBox.classList.toggle('active', !isOpen);
});

// --- Toggle sezione tasso variabile manuale ---
// Nota: variabile manuale ed Euribor sono mutuamente esclusivi
isVariableCheckbox.addEventListener('change', function () {
    variableSection.style.display = this.checked ? 'block' : 'none';

    // Disabilita Euribor se variabile manuale è attivato
    if (this.checked && euriborCheckbox.checked) {
        euriborCheckbox.checked = false;
        euriborSection.style.display = 'none';
    }
    calculate();
});

// --- Bottone aggiunta periodo variabile ---
addPeriodBtn.addEventListener('click', function () {
    addRatePeriod();
});

// --- Euribor: toggle, cambio tenor, data inizio, spread → ricalcolo ---
// (Le variabili DOM euriborCheckbox, euriborSection ecc. sono definite in euribor.js)
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


/* ==========================================================================
 *  3. GESTIONE PERIODI TASSO VARIABILE (manuale)
 *  --------------------------------------------------------------------------
 *  Permette di definire N intervalli [meseInizio, meseFine] con un tasso
 *  personalizzato. I periodi vengono aggiunti dinamicamente al DOM.
 *  Ogni periodo ha 3 input (inizio, fine, tasso) + bottone rimuovi.
 * ========================================================================== */

/**
 * Aggiunge una nuova riga "periodo variabile" al DOM.
 * Ogni riga contiene: mese inizio, mese fine, tasso (%), bottone rimuovi.
 * Aggiunge anche i listener 'input' → calculate() su tutti e 3 i campi.
 *
 * @param {number} startMonth - Mese di inizio del periodo (default 1)
 * @param {number} endMonth   - Mese di fine del periodo (default 12)
 * @param {number} rate       - Tasso annuo % per il periodo (default 4.0)
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

    // Ogni input della riga rilancia il calcolo
    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', calculate);
    });

    calculate();
}

/**
 * Rimuove un periodo variabile dal DOM e ricalcola.
 * @param {string} id - ID dell'elemento DOM della riga da rimuovere (es. "period-3")
 */
function removeRatePeriod(id) {
    const row = document.getElementById(id);
    if (row) {
        row.remove();
        calculate();
    }
}

/**
 * Legge dal DOM tutti i periodi di tasso variabile attualmente definiti.
 * @returns {Array<{start: number, end: number, rate: number}>}
 *   Array di oggetti con mese inizio, mese fine, tasso annuo (%).
 */
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


/* ==========================================================================
 *  4. UTILITÀ DI FORMATTAZIONE
 * ========================================================================== */

/**
 * Formatta un valore numerico come valuta EUR in formato italiano.
 * Esempio: 1234.56 → "1.234,56 €"
 *
 * @param {number} val - Importo da formattare
 * @returns {string} Stringa formattata con simbolo €
 */
function fmtCurr(val) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val);
}


/* ==========================================================================
 *  5. FUNZIONE PRINCIPALE — calculate()
 *  --------------------------------------------------------------------------
 *  Orchestratore principale. Viene chiamata ad ogni modifica degli input.
 *
 *  Flusso:
 *    1. Legge tutti gli input dal DOM
 *    2. Esegue una simulazione "baseline" (senza extra) — per calcolare i risparmi
 *    3. Esegue la simulazione "attuale" (con extra/arrotondamento dell'utente)
 *    4. Calcola risparmi (mesi e interessi)
 *    5. Aggiorna gli output numerici nel DOM
 *    6. Aggiorna il box "Analisi Estinzione" con dettagli risparmio in HTML
 *    7. Aggiorna il grafico Chart.js
 *    8. Aggiorna la tabella di sensibilità 3×3
 * ========================================================================== */

function calculate() {
    // --- Lettura input principali ---
    const P = parseFloat(amountInput.value) || 0;          // Capitale del mutuo
    const years = parseInt(yearsInput.value) || 0;         // Durata in anni
    const baseRate = parseFloat(rateInput.value) || 0;     // Tasso annuo base (%)

    // Sincronizza il badge numerico con lo slider (evita loop se l'utente sta digitando sul badge)
    if (rateNumericInput && document.activeElement !== rateNumericInput) {
        rateNumericInput.value = baseRate.toFixed(1);
    }
    updateSliderFill(rateInput);

    // --- Lettura input estinzione parziale ---
    const extraPayment = parseFloat(extraAmountInput.value) || 0;        // Importo extra per pagamento
    const extraFreqValue = extraFrequencySelect.value;                   // Codice frequenza (stringa)
    const extraStartMonth = parseInt(extraStartMonthInput.value) || 0;   // Mese inizio (ritardo)
    const extraDurationYears = parseInt(extraDurationInput.value) || 0;  // Durata extra (anni, 0 = illimitato)
    const extraEffect = extraEffectSelect.value;                         // 'duration' (riduce durata) o 'installment' (riduce rata)

    // --- Lettura input arrotondamento rata ---
    const roundUpAmount = parseFloat(roundUpAmountInput.value) || 0;              // Rata target arrotondata
    const roundUpAnnualIncrease = parseFloat(roundUpAnnualIncreaseInput.value) || 0; // Incremento % annuo

    // Validazione base: capitale e durata devono essere > 0
    if (P <= 0 || years <= 0) {
        resetOutputs();
        return;
    }

    const totalMonths = years * 12;
    const isVariable = isVariableCheckbox.checked;
    const ratePeriods = isVariable ? getRatePeriods() : [];

    // Configurazione Euribor (se il modulo euribor.js è caricato)
    const euriborConfig = (typeof getEuriborConfig === 'function') ? getEuriborConfig() : { active: false, rates: [] };

    // --- Conversione codice frequenza → numero di mesi ---
    // Valori possibili del <select>:
    //   '1_monthly' → ogni mese (1)
    //   '1'         → una tantum (-1, applicato solo una volta al primo mese utile)
    //   '3'         → trimestrale
    //   '6'         → semestrale
    //   '12'        → annuale
    let extraFreqMonths = 0;
    if (extraFreqValue === '1_monthly') {
        extraFreqMonths = 1;        // Ogni mese
    } else if (extraFreqValue === '1') {
        extraFreqMonths = -1;       // Una tantum (solo primo mese utile dopo l'inizio)
    } else {
        extraFreqMonths = parseInt(extraFreqValue) || 0;
    }

    // ── SIMULAZIONE 1: Baseline (senza extra) ──
    // Serve per calcolare il risparmio di tempo e interessi rispetto al mutuo "puro".
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
        generateChart: false   // Non servono dati per il grafico
    });

    // ── SIMULAZIONE 2: Attuale (con parametri utente) ──
    // Questa genera anche i dati per il grafico.
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

    // ── CALCOLO RISPARMI ──
    const interestSaved = Math.max(0, baselineResults.totalInterestPaid - results.totalInterestPaid);

    let savedMonths = 0;
    const hasExtras = (extraPayment > 0 && extraFreqMonths !== 0) || roundUpAmount > 0 || roundUpAnnualIncrease > 0;

    // Mesi risparmiati: differenza tra durata contrattuale e durata effettiva
    if (hasExtras && results.actualMonths < totalMonths) {
        savedMonths = totalMonths - results.actualMonths;
    }

    // ── AGGIORNAMENTO OUTPUT NUMERICI ──
    outInitialPayment.innerText = fmtCurr(results.firstRata);
    outMaxPayment.innerText = fmtCurr(results.maxRataSeen);
    outTotalInterest.innerText = fmtCurr(results.totalInterestPaid);
    outTotalPaid.innerText = fmtCurr(P + results.totalInterestPaid);

    // ── AGGIORNAMENTO BOX "ANALISI ESTINZIONE" ──
    // Mostra: tempo risparmiato, extra versato, interessi risparmiati
    if (hasExtras && (savedMonths > 0 || interestSaved > 1.0 || results.totalExtraPaid > 0)) {
        let savedText = '';

        // Formatta il tempo risparmiato in "X anni e Y mesi"
        if (savedMonths > 0) {
            const savedYears = Math.floor(savedMonths / 12);
            const savedMonthsRemainder = savedMonths % 12;
            if (savedYears > 0) savedText += savedYears + ' anni';
            if (savedMonthsRemainder > 0) savedText += (savedText ? ' e ' : '') + savedMonthsRemainder + ' mesi';
        } else {
            savedText = 'Nessuna riduzione durata';
        }

        // Aggiorna l'etichetta del box
        const savedLabel = savedTimeBox.querySelector('.label');
        if (savedLabel) savedLabel.textContent = '📊 Analisi Estinzione';

        // Costruisce il contenuto HTML con layout a griglia 2 colonne
        let htmlContent = `<div style="margin-bottom: 8px; font-weight:600; font-size: 1.1em; color: var(--text-main);">${savedText} <span style="font-weight:400; font-size:0.9em; color:var(--text-muted);">in meno</span></div>`;

        htmlContent += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">`;

        // Colonna sinistra: Extra Versato (arancione)
        if (results.totalExtraPaid > 0) {
            htmlContent += `
             <div style="text-align: right; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 15px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: block;">Extra Versato</span>
                <span style="font-size: 1.1rem; font-weight: 700; color: #fb923c;">${fmtCurr(results.totalExtraPaid)}</span>
             </div>`;
        } else {
            htmlContent += `<div></div>`; // Spacer se 0
        }

        // Colonna destra: Interessi Risparmiati (verde)
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
    }

    // ── AGGIORNAMENTO GRAFICO ──
    updateChart(results.chartLabels, results.chartDataBalance, results.chartDataInterest, results.chartDataPayment, results.chartDataActualPayment, results.chartDataRate, results.historicalEndLabel);

    // ── AGGIORNAMENTO TABELLA SENSIBILITÀ ──
    updateSensitivityTable(P, years, baseRate);
}


/* ==========================================================================
 *  6. FUNZIONE CORE — runSimulation(params)
 *  --------------------------------------------------------------------------
 *  Simula il mutuo mese per mese con ammortamento francese.
 *
 *  Gestisce:
 *    - Tasso fisso, tasso variabile manuale (periodi), tasso Euribor storico
 *    - Ricalcolo rata quando il tasso cambia (debito residuo / mesi residui)
 *    - Estinzione parziale periodica (mensile, trimestrale, annuale, una-tantum)
 *      con effetto "riduzione durata" o "riduzione rata"
 *    - Arrotondamento rata con incremento annuo composto
 *    - Campionamento dati per il grafico (trimestrale + punto fine storia)
 *
 *  @param {Object} params - Parametri di simulazione:
 *    @param {number}  params.P                    - Capitale iniziale del mutuo
 *    @param {number}  params.totalMonths           - Durata contrattuale in mesi
 *    @param {number}  params.baseRate              - Tasso annuo base (%)
 *    @param {Object}  params.euriborConfig         - {active, rates[], historicalCount}
 *    @param {Array}   params.ratePeriods           - [{start, end, rate}] periodi variabili
 *    @param {boolean} params.isVariable            - true se tasso variabile manuale attivo
 *    @param {number}  params.extraPayment          - Importo singolo pagamento extra (€)
 *    @param {number}  params.extraFreqMonths       - Frequenza extra: 1=mensile, -1=una-tantum, N=ogni N mesi
 *    @param {number}  params.extraStartMonth       - Mese dopo il quale iniziano gli extra
 *    @param {number}  params.extraDurationYears    - Durata degli extra (anni), 0=illimitato
 *    @param {string}  params.extraEffect           - 'duration' (riduce durata) o 'installment' (riduce rata)
 *    @param {number}  params.roundUpAmount         - Rata target per arrotondamento (€)
 *    @param {number}  params.roundUpAnnualIncrease - Incremento annuo (%) dell'arrotondamento
 *    @param {boolean} params.generateChart         - true per generare i dati del grafico
 *
 *  @returns {Object} Risultati della simulazione:
 *    - firstRata           {number}   Rata del primo mese
 *    - maxRataSeen         {number}   Rata massima osservata
 *    - totalInterestPaid   {number}   Totale interessi pagati
 *    - totalExtraPaid      {number}   Totale pagamenti extra effettuati
 *    - actualMonths        {number}   Mesi effettivi (≤ totalMonths se chiuso anticipatamente)
 *    - chartLabels         {string[]} Etichette asse X
 *    - chartDataBalance    {number[]} Debito residuo per punto campionato
 *    - chartDataInterest   {number[]} Interessi cumulati per punto campionato
 *    - chartDataPayment    {number[]} Rata teorica (senza extra) per punto campionato
 *    - chartDataActualPayment {number[]} Versamento effettivo (rata + extra) per punto campionato
 *    - chartDataRate       {number[]} Tasso annuo (%) per punto campionato
 *    - historicalEndLabel  {string|null} Etichetta del punto in cui finiscono i dati Euribor storici
 * ========================================================================== */

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

    // --- Calcolo rata iniziale (ammortamento francese) ---
    // Se Euribor è attivo, il primo tasso è quello storico del primo mese;
    // altrimenti si usa il tasso base impostato dall'utente.
    let firstRate = baseRate;
    if (euriborConfig.active && euriborConfig.rates.length > 0) {
        firstRate = euriborConfig.rates[0];
    }
    let initialMonthlyRate = Math.max(0, firstRate / 100 / 12);
    let initialRata;
    if (initialMonthlyRate === 0) {
        initialRata = P / totalMonths;   // Tasso zero → rata = capitale / mesi
    } else {
        // Formula ammortamento francese: R = P × r / (1 − (1+r)^−n)
        initialRata = (P * initialMonthlyRate) / (1 - Math.pow(1 + initialMonthlyRate, -totalMonths));
    }

    // --- Stato della simulazione ---
    let currentBalance = P;              // Debito residuo corrente
    let totalInterestPaid = 0;           // Accumulatore interessi pagati
    let totalExtraPaid = 0;              // Accumulatore pagamenti extra (periodici + arrotondamento)
    let firstRata = initialRata;         // Rata del primo mese (salvata per output)
    let maxRataSeen = 0;                 // Rata massima osservata (solo rata standard, senza extra)
    let currentRata = initialRata;       // Rata corrente — cambia con tasso variabile o effetto 'installment'
    let prevAnnualRate = firstRate;       // Tasso del mese precedente (per rilevare cambiamenti)
    let historicalEndLabel = null;        // Etichetta del punto di fine dati storici Euribor
    let actualMonths = totalMonths;      // Mesi effettivi (decresce se mutuo chiuso prima)

    // --- Array per il grafico (popolati solo se generateChart = true) ---
    let chartLabels = [];
    let chartDataBalance = [];
    let chartDataInterest = [];
    let chartDataPayment = [];
    let chartDataActualPayment = [];
    let chartDataRate = [];

    // ══════════════════════════════════════════════
    //  LOOP PRINCIPALE — un'iterazione per ogni mese
    // ══════════════════════════════════════════════
    for (let m = 1; m <= totalMonths && currentBalance > 0.01; m++) {

        // ── STEP 1: Determinazione tasso per il mese corrente ──
        let currentAnnualRate = baseRate;

        if (euriborConfig.active && euriborConfig.rates.length > 0) {
            // Modalità Euribor: usa il tasso storico (o il fallback se oltre i dati)
            currentAnnualRate = euriborConfig.rates[Math.min(m - 1, euriborConfig.rates.length - 1)];
        } else if (isVariable && ratePeriods.length > 0) {
            // Modalità variabile manuale: cerca il periodo che include questo mese
            for (let period of ratePeriods) {
                if (m >= period.start && m <= period.end) {
                    currentAnnualRate = period.rate;
                    break;
                }
            }
        }
        let monthlyRate = Math.max(0, currentAnnualRate / 100 / 12);

        // ── Se il tasso è cambiato rispetto al mese precedente,
        //    ricalcola la rata sul debito residuo con i mesi rimanenti ──
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

        // ── STEP 2: Calcolo interessi del mese ──
        let quotaInteressi = currentBalance * monthlyRate;

        // ── STEP 3: Determinazione rata da pagare ──
        let rataDaPagare = currentRata;

        // Se il saldo + interessi è inferiore alla rata, chiudi il mutuo con l'ultimo pagamento
        if (currentBalance + quotaInteressi <= rataDaPagare) {
            rataDaPagare = currentBalance + quotaInteressi;
        }

        let quotaCapitale = rataDaPagare - quotaInteressi;

        // ── STEP 4: Gestione estinzione parziale ──
        // Due componenti indipendenti:
        //   • extraPeriodic: pagamento extra definito dall'utente (soggetto a effetto duration/installment)
        //   • extraRoundup:  differenza tra rata arrotondata e rata corrente (riduce SEMPRE la durata)
        let extraPeriodic = 0;
        let extraRoundup = 0;
        let applyExtra = false;

        // Verifica se il mese corrente è nel periodo valido per gli extra
        // (considerando il mese di inizio e la durata specificata dall'utente)
        const isInExtraPeriod = (m > extraStartMonth) && (extraDurationYears === 0 || m <= extraStartMonth + (extraDurationYears * 12));

        // ── Extra periodici (importo fisso con frequenza specifica) ──
        if (extraPayment > 0 && extraFreqMonths !== 0 && isInExtraPeriod) {
            if (extraFreqMonths === -1 && m === extraStartMonth + 1) {
                applyExtra = true;  // Una tantum: solo il primo mese utile dopo l'inizio
            } else if (extraFreqMonths === 1) {
                applyExtra = true;  // Mensile: ogni mese
            } else if (extraFreqMonths > 1) {
                // Periodico: ogni N mesi a partire dal mese di inizio
                if ((m - extraStartMonth) % extraFreqMonths === 0) applyExtra = true;
            }

            if (applyExtra) {
                // L'extra non può eccedere il debito residuo dopo il capitale ordinario
                extraPeriodic = Math.min(extraPayment, currentBalance - quotaCapitale);
                if (extraPeriodic < 0) extraPeriodic = 0;
            }
        }

        // ── Arrotondamento rata (sempre attivo nel periodo, riduce solo la durata) ──
        // Se la rata target arrotondata è superiore alla rata corrente, la differenza
        // diventa un extra che riduce il capitale (e quindi la durata).
        // L'importo target cresce annualmente con il tasso di incremento composto.
        if (roundUpAmount > 0 && isInExtraPeriod) {
            const yearsElapsed = Math.floor((m - 1) / 12);
            const growthFactor = Math.pow(1 + roundUpAnnualIncrease / 100, yearsElapsed);
            const effectiveRoundUpAmount = roundUpAmount * growthFactor;

            if (effectiveRoundUpAmount > currentRata) {
                const roundUpDiff = effectiveRoundUpAmount - currentRata;
                // L'extra arrotondamento non può superare il debito residuo meno capitale ordinario e extra periodico
                const maxRoundUpExtra = Math.max(0, currentBalance - quotaCapitale - extraPeriodic);
                extraRoundup = Math.min(roundUpDiff, maxRoundUpExtra);
            }
        }

        let extra = extraPeriodic + extraRoundup;
        totalExtraPaid += extra;

        // ── STEP 5: Applicazione dei pagamenti ──
        totalInterestPaid += quotaInteressi;
        let capitalePagato = quotaCapitale + extra;

        // Se il capitale pagato copre tutto il debito, chiudi
        if (capitalePagato >= currentBalance) {
            capitalePagato = currentBalance;
            currentBalance = 0;
        } else {
            currentBalance -= capitalePagato;
        }

        // Traccia la rata massima (solo rata standard, senza extra)
        if (rataDaPagare > maxRataSeen) maxRataSeen = rataDaPagare;

        // ── STEP 6: Ricalcolo rata dopo extra periodico in modalità 'installment' ──
        // In modalità 'installment', gli extra periodici riducono la rata futura
        // (anziché la durata). L'arrotondamento NON innesca questo ricalcolo.
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

        // ── STEP 7: Campionamento dati per il grafico ──
        // Campionamento: mese 1, ogni 3 mesi, fine dati storici Euribor, ultimo mese
        if (generateChart) {
            const isHistoricalEnd = (euriborConfig.active && m === euriborConfig.historicalCount);

            if (m === 1 || m % 3 === 0 || isHistoricalEnd || currentBalance <= 0.01) {
                let label = 'Mese ' + m;
                chartLabels.push(label);
                chartDataBalance.push(Math.max(0, currentBalance));
                chartDataInterest.push(totalInterestPaid);
                chartDataPayment.push(currentRata);                    // Rata teorica (senza extra)
                chartDataActualPayment.push(rataDaPagare + extra);     // Versamento effettivo (rata + extra)
                chartDataRate.push(currentAnnualRate);                 // Tasso annuo corrente

                // Segna il punto di transizione da dati storici a proiezione
                if (isHistoricalEnd && m < totalMonths && currentBalance > 0.01) {
                    historicalEndLabel = label;
                }
            }
        }

        // ── Chiusura anticipata: se il debito è azzerato, registra il mese e esci ──
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


/* ==========================================================================
 *  7. resetOutputs()
 *  --------------------------------------------------------------------------
 *  Azzera tutti i campi output e distrugge il grafico.
 *  Chiamata quando gli input non sono validi (capitale o durata ≤ 0).
 * ========================================================================== */

function resetOutputs() {
    outInitialPayment.innerText = '--';
    outMaxPayment.innerText = '--';
    outTotalInterest.innerText = '--';
    outTotalPaid.innerText = '--';
    if (myChart) myChart.destroy();
}


/* ==========================================================================
 *  8. updateChart() — Grafico Chart.js
 *  --------------------------------------------------------------------------
 *  Distrugge il grafico precedente e ne crea uno nuovo con 5 dataset:
 *
 *    Dataset 0 — Debito Residuo (€)         → area verde   (asse Y sinistro)
 *    Dataset 1 — Rata Mensile (€)           → linea blu    (asse Y destro)
 *    Dataset 2 — Versamento Effettivo (€)   → linea tratteggiata ambra (asse Y destro, nascosto di default)
 *    Dataset 3 — Interessi Cumulati (€)     → area rossa   (asse Y sinistro)
 *    Dataset 4 — Tasso %                    → nascosto     (asse Y hidden, solo tooltip)
 *
 *  Se historicalEndLabel è impostato (modalità Euribor), disegna una linea
 *  verticale tratteggiata arancione con etichetta "Fine Dati Storici".
 *
 *  3 assi Y:
 *    • y:         importi in migliaia (€k)  — sinistro
 *    • y_payment: importi mensili (€)       — destro
 *    • y_hidden:  tasso 0-10% (nascosto)
 *
 *  @param {string[]} labels             - Etichette asse X (es. "Mese 1", "Mese 3", ...)
 *  @param {number[]} balanceData        - Debito residuo
 *  @param {number[]} interestData       - Interessi cumulati
 *  @param {number[]} paymentData        - Rata teorica (senza extra)
 *  @param {number[]} actualPaymentData  - Versamento effettivo (rata + extra)
 *  @param {number[]} rateData           - Tasso annuo (%)
 *  @param {string|null} historicalEndLabel - Etichetta punto fine dati storici
 * ========================================================================== */

function updateChart(labels, balanceData, interestData, paymentData, actualPaymentData, rateData, historicalEndLabel) {
    const ctx = document.getElementById('mortgageChart').getContext('2d');

    if (myChart) myChart.destroy();

    // --- Gradienti per le aree "fill" ---
    let gradientBalance = ctx.createLinearGradient(0, 0, 0, 400);
    gradientBalance.addColorStop(0, 'rgba(16, 185, 129, 0.4)');   // Emerald 500 (trasparente verso il basso)
    gradientBalance.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    let gradientInterest = ctx.createLinearGradient(0, 0, 0, 400);
    gradientInterest.addColorStop(0, 'rgba(244, 63, 94, 0.4)');   // Rose 500
    gradientInterest.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

    // --- Annotazione: linea verticale "Fine Dati Storici" (se Euribor attivo) ---
    const annotations = {};
    if (historicalEndLabel) {
        annotations.historicalLine = {
            type: 'line',
            xMin: historicalEndLabel,
            xMax: historicalEndLabel,
            borderColor: '#fb923c',      // Orange 400
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

    // --- Font e colori globali Chart.js ---
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#94a3b8';  // Slate 400

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    // Dataset 0: Debito Residuo — area verde con gradiente
                    label: 'Debito Residuo (€)',
                    data: balanceData,
                    borderColor: '#10b981',
                    backgroundColor: gradientBalance,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    yAxisID: 'y'
                },
                {
                    // Dataset 1: Rata Mensile — linea blu (rata standard senza extra)
                    label: 'Rata Mensile (€)',
                    data: paymentData,
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y_payment'
                },
                {
                    // Dataset 2: Versamento Effettivo — linea tratteggiata ambra
                    // Visibile di default, mostra rata + extra (arrotondamento + periodici)
                    label: 'Versamento Effettivo (€)',
                    hidden: false,
                    data: actualPaymentData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 4],
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.3,
                    yAxisID: 'y_payment'
                },
                {
                    // Dataset 3: Interessi Cumulati — area rossa con gradiente
                    label: 'Interessi Cumulati (€)',
                    data: interestData,
                    borderColor: '#f43f5e',
                    backgroundColor: gradientInterest,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    // Dataset 4: Tasso % — invisibile (nessun bordo/punto), serve solo per il tooltip
                    label: 'Tasso %',
                    data: rateData,
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    pointRadius: 0,
                    borderWidth: 0,
                    yAxisID: 'y_hidden'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',       // Tooltip mostra tutti i dataset per lo stesso indice X
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
                            // Nasconde "Tasso %" dalla legenda (è solo per il tooltip)
                            return !item.text.includes('Tasso');
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',   // Slate 900
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
                // Asse X — mesi
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
                // Asse Y sinistro — importi cumulativi (debito, interessi) in migliaia
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
                // Asse Y destro — importi mensili (rata, versamento effettivo) in €
                y_payment: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { display: false },
                    // Range con margine 10% sopra e sotto per leggibilità
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
                        color: '#60a5fa',    // Blue 400
                        font: { size: 11 }
                    },
                    title: {
                        display: true,
                        text: 'Importi Mensili',
                        color: '#60a5fa',
                        font: { size: 10, weight: 600 }
                    }
                },
                // Asse Y nascosto — serve per posizionare i dati del tasso (range 0-10%)
                y_hidden: {
                    type: 'linear',
                    display: false,
                    min: 0,
                    max: 10
                }
            }
        }
    });
}


/* ==========================================================================
 *  9. calcRata() — Formula ammortamento francese (pura)
 *  --------------------------------------------------------------------------
 *  Usata dalla tabella di sensibilità per calcolare rate con parametri diversi.
 *  NON tiene conto di extra, arrotondamenti o tassi variabili.
 *
 *  Formula: R = P × r / (1 − (1 + r)^−n)
 *  dove r = tasso mensile, n = numero mesi totali
 *
 *  @param {number} principal  - Capitale del mutuo (€)
 *  @param {number} years      - Durata in anni
 *  @param {number} annualRate - Tasso annuo (%)
 *  @returns {number} Rata mensile (€)
 * ========================================================================== */

function calcRata(principal, years, annualRate) {
    if (principal <= 0 || years <= 0) return 0;
    const months = years * 12;
    const mr = Math.max(0, annualRate / 100 / 12);
    if (mr === 0) return principal / months;
    return (principal * mr) / (1 - Math.pow(1 + mr, -months));
}


/* ==========================================================================
 *  10. updateSensitivityTable() — Tabella sensibilità 3×3
 *  --------------------------------------------------------------------------
 *  Mostra una matrice 3×3 di rate possibili variando:
 *    - Colonne: durata ±5 anni e attuale  (es. 35, 30, 25 anni)
 *    - Righe:   tasso ±0,5% e attuale     (es. 3,5%, 3%, 2,5%)
 *
 *  Le intestazioni mostrano il valore assoluto e il delta tra parentesi
 *  (es. "35 anni (+5)" / "3,5% (+0,5)").
 *  La cella centrale corrisponde alla configurazione corrente dell'utente.
 *
 *  Le celle sono referenziate tramite ID nel DOM:
 *    cell-{plus5y|curr|minus5y}-{plus05r|curr-r|minus05r}
 *
 *  @param {number} P        - Capitale del mutuo (€)
 *  @param {number} years    - Durata attuale (anni)
 *  @param {number} baseRate - Tasso annuo attuale (%)
 * ========================================================================== */

function updateSensitivityTable(P, years, baseRate) {
    const yearOffsets = [5, 0, -5];       // Colonne: +5, attuale, -5
    const rateOffsets = [0.5, 0, -0.5];   // Righe:   +0.5%, attuale, -0.5%

    // Mappa ID celle DOM (righe × colonne)
    const cellIds = [
        ['cell-plus5y-plus05r', 'cell-curr-y-plus05r', 'cell-minus5y-plus05r'],
        ['cell-plus5y-curr-r', 'cell-curr-y-curr-r', 'cell-minus5y-curr-r'],
        ['cell-plus5y-minus05r', 'cell-curr-y-minus05r', 'cell-minus5y-minus05r']
    ];

    // --- Aggiorna intestazioni colonne (variazioni durata) ---
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

    // --- Aggiorna intestazioni righe (variazioni tasso) ---
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

    // --- Popola le 9 celle con la rata calcolata ---
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            const y = years + yearOffsets[c];
            const rate = baseRate + rateOffsets[r];
            const cell = document.getElementById(cellIds[r][c]);
            if (y <= 0 || rate < 0) {
                cell.textContent = 'N/A';   // Combinazione non valida
            } else {
                cell.textContent = fmtCurr(calcRata(P, y, rate));
            }
        }
    }
}


/* ==========================================================================
 *  11. updateSliderFill() — Stile dinamico slider range
 *  --------------------------------------------------------------------------
 *  Applica un gradiente lineare allo sfondo dello slider per simulare
 *  un effetto "volume bar" (la parte a sinistra è colorata, la destra è opaca).
 *  Colore attivo: viola (#8b5cf6 — Violet 500).
 *
 *  @param {HTMLInputElement} slider - Elemento <input type="range">
 * ========================================================================== */

function updateSliderFill(slider) {
    if (!slider) return;
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = parseFloat(slider.value) || 0;
    const percentage = ((value - min) / (max - min)) * 100;

    slider.style.background = `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`;
}


/* ==========================================================================
 *  12. AVVIO INIZIALE
 *  --------------------------------------------------------------------------
 *  Esegue il primo calcolo al caricamento della pagina,
 *  usando i valori di default presenti nell'HTML.
 * ========================================================================== */

calculate();
