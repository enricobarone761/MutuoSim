// ===========================================================================
//  MutuoSim — euribor.test.js
// ===========================================================================
//  Test per la logica pura di getEuriborRatesForMortgage.
//
//  euribor.js non può essere caricato direttamente (ha riferimenti DOM).
//  Ridefinisco qui le sole funzioni pure che vogliamo testare, mantenendo
//  la logica identica a euribor.js. I test usano un dataset mock inline.
// ===========================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Ridefinizione funzioni pure (estratte da euribor.js, nessun DOM)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versione testabile di getEuriborRatesForMortgage.
 * Accetta il dataset come parametro invece di leggere dalla variabile globale.
 *
 * @param {Object} data         - dataset { 'YYYY-MM': rate }
 * @param {string} startMonth   - mese inizio "YYYY-MM"
 * @param {number} totalMonths  - durata in mesi
 * @param {number} spread       - spread da aggiungere al tasso Euribor (%)
 * @param {number} baseRateFallback - tasso fallback quando dato mancante (%)
 * @returns {number[]}
 */
function _getEuriborRates(data, startMonth, totalMonths, spread = 0, baseRateFallback = 0) {
    if (!data) return [];

    const rates = [];
    let [year, month] = startMonth.split('-').map(Number);

    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        let effectiveRate;

        if (data[key] !== undefined) {
            effectiveRate = Math.max(0, data[key]) + spread;
        } else {
            effectiveRate = baseRateFallback;
        }

        rates.push(effectiveRate);

        month++;
        if (month > 12) { month = 1; year++; }
    }

    return rates;
}

/**
 * Applica CAP ai tassi euribor.
 */
function _applyCapFloor(rates, capValue) {
    if (!isFinite(capValue)) return rates;
    return rates.map(r => Math.min(capValue, r));
}

/**
 * Conta quanti mesi hanno dati storici reali.
 */
function _countHistoricalMonths(data, startMonth, totalMonths) {
    if (!data) return 0;
    let [year, month] = startMonth.split('-').map(Number);
    let count = 0;
    for (let i = 0; i < totalMonths; i++) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (data[key] !== undefined) count++;
        else break;
        month++; if (month > 12) { month = 1; year++; }
    }
    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset mock
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EURIBOR = {
    '2023-01': 2.50,
    '2023-02': 2.65,
    '2023-03': 2.90,
    '2023-04': 3.10,
    '2023-05': 3.35,
    '2023-06': 3.50,
    '2023-07': 3.65,
    '2023-08': 3.70,
    '2023-09': 3.95,
    '2023-10': 4.00,
    '2023-11': 3.90,
    '2023-12': 3.85
    // 2024 non presente → fallback
};

const MOCK_EURIBOR_NEG = {
    '2021-01': -0.50,
    '2021-02': -0.48,
    '2021-03': -0.45
};

// ─────────────────────────────────────────────────────────────────────────────
// Test: lunghezza array
// ─────────────────────────────────────────────────────────────────────────────

describe('getEuriborRates — lunghezza array', () => {
    it('ritorna esattamente totalMonths elementi', () => {
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-01', 24, 1, 2);
        expect(rates.length).toBe(24);
    });

    it('ritorna totalMonths elementi anche quando i dati sono parziali', () => {
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-06', 18, 0, 0);
        expect(rates.length).toBe(18);
    });

    it('ritorna array vuoto se data è null', () => {
        const rates = _getEuriborRates(null, '2023-01', 12, 0, 2);
        expect(rates.length).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: utilizzo dati storici
// ─────────────────────────────────────────────────────────────────────────────

describe('getEuriborRates — dati storici presenti', () => {
    it('il primo mese usa il dato storico + spread (no fallback)', () => {
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-01', 1, 0, 99);
        // 2023-01 = 2.50, spread = 0
        expect(rates[0]).toBeCloseTo(2.50, 4);
    });

    it('lo spread viene sommato correttamente al dato storico', () => {
        const spread = 1.5;
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-01', 3, spread, 0);
        expect(rates[0]).toBeCloseTo(2.50 + spread, 4);
        expect(rates[1]).toBeCloseTo(2.65 + spread, 4);
        expect(rates[2]).toBeCloseTo(2.90 + spread, 4);
    });

    it('i tassi storici sono quelli del dataset per tutti i 12 mesi di dati', () => {
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-01', 12, 0, 0);
        const expected = [2.50, 2.65, 2.90, 3.10, 3.35, 3.50, 3.65, 3.70, 3.95, 4.00, 3.90, 3.85];
        rates.forEach((r, i) => expect(r).toBeCloseTo(expected[i], 4));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: fallback
// ─────────────────────────────────────────────────────────────────────────────

describe('getEuriborRates — fallback per mesi senza dato', () => {
    it('i mesi senza dato usano il baseRateFallback', () => {
        // 2023: 12 mesi di dati. Da 2024-01 in poi → fallback
        const rates = _getEuriborRates(MOCK_EURIBOR, '2023-01', 15, 0, 5.0);
        // mesi 13, 14, 15 sono 2024-01, 2024-02, 2024-03 → non nel dataset
        expect(rates[12]).toBeCloseTo(5.0, 4);
        expect(rates[13]).toBeCloseTo(5.0, 4);
        expect(rates[14]).toBeCloseTo(5.0, 4);
    });

    it(`con dati mancanti dall'inizio, usa sempre il fallback`, () => {
        const rates = _getEuriborRates(MOCK_EURIBOR, '1990-01', 6, 0, 3.5);
        rates.forEach(r => expect(r).toBeCloseTo(3.5, 4));
    });

    it('fallback con spread = fallbackRate (lo spread NON si applica al fallback)', () => {
        // Verifica che lo spread sia applicato solo ai dati storici, non al fallback
        const rates = _getEuriborRates(MOCK_EURIBOR, '2024-01', 3, 2.0, 1.0);
        // 2024 non nel dataset → fallback = 1.0 (spread non sommato al fallback)
        rates.forEach(r => expect(r).toBeCloseTo(1.0, 4));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: tassi negativi (floor a 0)
// ─────────────────────────────────────────────────────────────────────────────

describe('getEuriborRates — floor a 0 per tassi negativi', () => {
    it('tasso euribor negativo senza spread → clampato a 0', () => {
        const rates = _getEuriborRates(MOCK_EURIBOR_NEG, '2021-01', 3, 0, 0);
        // -0.50, -0.48, -0.45 → tutti 0 (Math.max(0, value) + spread)
        rates.forEach(r => expect(r).toBeCloseTo(0, 4));
    });

    it('tasso euribor negativo CON spread positivo → clampato a 0 poi sommato spread', () => {
        // Math.max(0, -0.50) + 1.0 = 0 + 1.0 = 1.0
        const rates = _getEuriborRates(MOCK_EURIBOR_NEG, '2021-01', 3, 1.0, 0);
        rates.forEach(r => expect(r).toBeCloseTo(1.0, 4));
    });

    it('tasso euribor negativo CON spread piccolo → clampato quindi spread', () => {
        // Math.max(0, -0.50) + 0.3 = 0.3
        const rates = _getEuriborRates(MOCK_EURIBOR_NEG, '2021-01', 1, 0.3, 0);
        expect(rates[0]).toBeCloseTo(0.3, 4);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: CAP
// ─────────────────────────────────────────────────────────────────────────────

describe('applyCapFloor — applicazione CAP', () => {
    it('CAP tronca i tassi che lo superano', () => {
        const rates = [1.0, 2.0, 3.0, 4.0, 5.0];
        const capped = _applyCapFloor(rates, 3.0);
        expect(capped[0]).toBeCloseTo(1.0, 4);
        expect(capped[1]).toBeCloseTo(2.0, 4);
        expect(capped[2]).toBeCloseTo(3.0, 4);
        expect(capped[3]).toBeCloseTo(3.0, 4); // troncato
        expect(capped[4]).toBeCloseTo(3.0, 4); // troncato
    });

    it('CAP = Infinity lascia i tassi inalterati', () => {
        const rates = [1.0, 5.0, 10.0];
        const capped = _applyCapFloor(rates, Infinity);
        rates.forEach((r, i) => expect(capped[i]).toBeCloseTo(r, 4));
    });

    it('CAP su tassi già sotto il limite → nessuna modifica', () => {
        const rates = [1.0, 2.0, 2.5];
        const capped = _applyCapFloor(rates, 5.0);
        rates.forEach((r, i) => expect(capped[i]).toBeCloseTo(r, 4));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: conteggio mesi storici
// ─────────────────────────────────────────────────────────────────────────────

describe('countHistoricalMonths — mesi con dati reali', () => {
    it('conta i mesi consecutivi con dati storici (si ferma al primo gap)', () => {
        // MOCK_EURIBOR ha 12 mesi da 2023-01 a 2023-12 consecutivi
        const count = _countHistoricalMonths(MOCK_EURIBOR, '2023-01', 24);
        expect(count).toBe(12);
    });

    it('partendo da 2023-06: conta 7 mesi storici (giu-dic 2023)', () => {
        const count = _countHistoricalMonths(MOCK_EURIBOR, '2023-06', 24);
        expect(count).toBe(7);
    });

    it('partendo da una data futura non nel dataset: 0 mesi storici', () => {
        const count = _countHistoricalMonths(MOCK_EURIBOR, '2030-01', 12);
        expect(count).toBe(0);
    });

    it('con null come dataset: 0 mesi storici', () => {
        const count = _countHistoricalMonths(null, '2023-01', 12);
        expect(count).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: integrazione con runSimulation (Euribor come array di tassi)
// ─────────────────────────────────────────────────────────────────────────────

describe('runSimulation con Euribor config mock', () => {
    it('totalInterestPaid più alto con spread maggiore (tasso più alto → più interessi)', () => {
        const rates0 = _getEuriborRates(MOCK_EURIBOR, '2023-01', 12, 0, 2);
        const rates2 = _getEuriborRates(MOCK_EURIBOR, '2023-01', 12, 2, 2);

        const params = (euriborRates) => ({
            P: 100000,
            totalMonths: 12,
            baseRate: 3,
            euriborConfig: { active: true, rates: euriborRates },
            ratePeriods: [],
            isVariable: false,
            extraPaymentsList: [],
            capitalAdditionsList: [],
            roundUpStartMonth: 0,
            roundUpAmount: 0,
            roundUpAnnualIncrease: 0,
            generateChart: false
        });

        const res0 = runSimulation(params(rates0));
        const res2 = runSimulation(params(rates2));
        expect(res2.totalInterestPaid > res0.totalInterestPaid).toBeTruthy();
    });

    it('con tutti i mesi fallback, risultato simile al mutuo a tasso fisso', () => {
        // Usa fallback per tutti i 120 mesi
        const rates = _getEuriborRates(MOCK_EURIBOR, '2030-01', 120, 0, 3);
        const resEuribor = runSimulation({
            P: 100000,
            totalMonths: 120,
            baseRate: 3,
            euriborConfig: { active: true, rates },
            ratePeriods: [],
            isVariable: false,
            extraPaymentsList: [],
            capitalAdditionsList: [],
            roundUpStartMonth: 0,
            roundUpAmount: 0,
            roundUpAnnualIncrease: 0,
            generateChart: false
        });
        const resFisso = runSimulation({
            P: 100000,
            totalMonths: 120,
            baseRate: 3,
            euriborConfig: { active: false, rates: [] },
            ratePeriods: [],
            isVariable: false,
            extraPaymentsList: [],
            capitalAdditionsList: [],
            roundUpStartMonth: 0,
            roundUpAmount: 0,
            roundUpAnnualIncrease: 0,
            generateChart: false
        });
        expect(resEuribor.totalInterestPaid).toBeCloseTo(resFisso.totalInterestPaid, 0);
    });
});
