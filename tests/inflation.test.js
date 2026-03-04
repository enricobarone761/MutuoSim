// ===========================================================================
//  MutuoSim — inflation.test.js
// ===========================================================================
//  Test per le funzioni pure di inflazione: buildInflationRates e calcRealCost.
//
//  Le funzioni vengono ridefinite qui inline (copiate dalla logica di inflation.js)
//  perché inflation.js ha riferimenti DOM che impediscono il caricamento diretto.
//  I test verificano la correttezza matematica della logica pura, indipendentemente
//  dal DOM o dai dati reali HICP.
// ===========================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Ridefinizione delle funzioni pure (estratte da inflation.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Versione testabile di buildInflationRates che accetta un oggetto dati
 * anziché leggere da variabile globale.
 */
function _buildInflationRates(startMonth, totalMonths, fallbackAnnualRate, mockData) {
    const fallbackMonthly = Math.pow(1 + fallbackAnnualRate / 100, 1 / 12) - 1;

    function getHistorical(period) {
        if (!mockData || !mockData.IT_HICP_YOY) return null;
        const val = mockData.IT_HICP_YOY[period];
        return (val !== undefined && val !== null) ? val : null;
    }

    if (!startMonth || !mockData || !mockData.IT_HICP_YOY) {
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
        const yoy = getHistorical(key);

        if (yoy !== null) {
            rates.push(Math.pow(1 + yoy / 100, 1 / 12) - 1);
            historicalCount++;
        } else {
            rates.push(fallbackMonthly);
        }

        month++;
        if (month > 12) { month = 1; year++; }
    }

    return { rates, historicalCount };
}

/**
 * Versione testabile di calcRealCost (estratta da inflation.js).
 */
function _calcRealCost(amortizationSchedule, inflRates, todayIdx, initialCosts, monthlyInsurance) {
    let realCost = 0;

    amortizationSchedule.forEach(row => {
        const m = row.month;
        const nominalPayment = row.payment + row.extra + monthlyInsurance;

        let cumulativeInflation = 1.0;
        if (m > todayIdx) {
            for (let k = todayIdx; k < m; k++) {
                const rateIdx = Math.min(k, inflRates.length - 1);
                cumulativeInflation *= (1 + inflRates[rateIdx]);
            }
        } else if (m < todayIdx) {
            for (let k = m; k < todayIdx; k++) {
                const rateIdx = Math.min(k - 1, inflRates.length - 1);
                cumulativeInflation *= (1 + inflRates[rateIdx]);
            }
        }

        realCost += nominalPayment / cumulativeInflation;
    });

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un piano di ammortamento semplificato per i test.
 * @param {number} months - numero di mesi
 * @param {number} payment - pagamento fisso mensile
 * @returns {Array}
 */
function makeSchedule(months, payment) {
    return Array.from({ length: months }, (_, i) => ({
        month: i + 1,
        payment: payment,
        interest: 0,
        extra: 0,
        capitalAddition: 0,
        totalPaid: payment
    }));
}

/** Tasso mensile geometrico da un tasso annuo percentuale. */
function annualToMonthly(annualPct) {
    return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildInflationRates
// ─────────────────────────────────────────────────────────────────────────────

describe('buildInflationRates — senza dati storici (mockData=null)', () => {
    it('usa il fallback per tutti i mesi', () => {
        const { rates, historicalCount } = _buildInflationRates(null, 12, 2, null);
        expect(rates.length).toBe(12);
        expect(historicalCount).toBe(0);
        const expectedMonthly = annualToMonthly(2);
        rates.forEach(r => expect(r).toBeCloseTo(expectedMonthly, 8));
    });

    it('senza startMonth usa sempre il fallback', () => {
        const mockData = { IT_HICP_YOY: { '2023-01': 10 } };
        const { rates, historicalCount } = _buildInflationRates(null, 6, 3, mockData);
        expect(historicalCount).toBe(0);
        const expected = annualToMonthly(3);
        rates.forEach(r => expect(r).toBeCloseTo(expected, 8));
    });

    it('tasso annuo 0% → tasso mensile = 0', () => {
        const { rates } = _buildInflationRates(null, 12, 0, null);
        rates.forEach(r => expect(r).toBeCloseTo(0, 10));
    });
});

describe('buildInflationRates — con dati storici mock', () => {
    const mockData = {
        IT_HICP_YOY: {
            '2022-01': 5.0,
            '2022-02': 6.0,
            '2022-03': 7.0
            // altri mesi non presenti → fallback
        }
    };

    it('conta correttamente i mesi storici', () => {
        const { historicalCount } = _buildInflationRates('2022-01', 6, 2, mockData);
        expect(historicalCount).toBe(3); // solo gen/feb/mar 2022 sono presenti
    });

    it('i mesi storici usano il tasso geometrico dal YoY', () => {
        const { rates } = _buildInflationRates('2022-01', 3, 2, mockData);
        const expected0 = annualToMonthly(5.0);
        const expected1 = annualToMonthly(6.0);
        const expected2 = annualToMonthly(7.0);
        expect(rates[0]).toBeCloseTo(expected0, 8);
        expect(rates[1]).toBeCloseTo(expected1, 8);
        expect(rates[2]).toBeCloseTo(expected2, 8);
    });

    it('i mesi senza dato usano il fallback', () => {
        const { rates } = _buildInflationRates('2022-01', 6, 2, mockData);
        const expectedFallback = annualToMonthly(2);
        // mesi 4, 5, 6 non nel dataset
        expect(rates[3]).toBeCloseTo(expectedFallback, 8);
        expect(rates[4]).toBeCloseTo(expectedFallback, 8);
        expect(rates[5]).toBeCloseTo(expectedFallback, 8);
    });

    it('array ha sempre totalMonths elementi', () => {
        const { rates } = _buildInflationRates('2022-01', 24, 2, mockData);
        expect(rates.length).toBe(24);
    });

    it('dati YoY positivi producono tassi mensili positivi', () => {
        const { rates } = _buildInflationRates('2022-01', 3, 0, mockData);
        rates.forEach(r => expect(r > 0).toBeTruthy());
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcRealCost
// ─────────────────────────────────────────────────────────────────────────────

describe('calcRealCost — inflazione zero: costo reale = nominale', () => {
    it('con inflazione 0% su 12 mesi, realCost = somma pagamenti + costi iniziali', () => {
        const schedule = makeSchedule(12, 1000);
        const inflRates = Array(12).fill(0);
        const realCost = _calcRealCost(schedule, inflRates, 0, 500, 0);
        // 12 mesi × 1000 + 500 costi iniziali = 12500
        expect(realCost).toBeCloseTo(12500, 1);
    });

    it('con inflazione zero e assicurazione mensile, costo reale = pagamenti + assic + costi iniziali', () => {
        const schedule = makeSchedule(12, 1000);
        const inflRates = Array(12).fill(0);
        const realCost = _calcRealCost(schedule, inflRates, 0, 0, 50);
        // 12 × (1000 + 50) = 12600
        expect(realCost).toBeCloseTo(12600, 1);
    });
});

describe('calcRealCost — inflazione positiva riduce il costo reale', () => {
    it('con inflazione 5% annuo, costo reale < costo nominale (todayIdx=0)', () => {
        const schedule = makeSchedule(120, 1000);
        const monthlyRate = annualToMonthly(5);
        const inflRates = Array(120).fill(monthlyRate);

        const realCost = _calcRealCost(schedule, inflRates, 0, 0, 0);
        const nominalCost = 120 * 1000; // 120000
        expect(realCost < nominalCost).toBeTruthy();
    });

    it('con inflazione più alta, il costo reale è ancora più basso', () => {
        const schedule = makeSchedule(120, 1000);
        const monthly5 = annualToMonthly(5);
        const monthly10 = annualToMonthly(10);

        const real5 = _calcRealCost(schedule, Array(120).fill(monthly5), 0, 0, 0);
        const real10 = _calcRealCost(schedule, Array(120).fill(monthly10), 0, 0, 0);
        expect(real10 < real5).toBeTruthy();
    });

    it('con inflazione 3% e todayIdx nel mezzo, costo reale ≠ nominale', () => {
        const schedule = makeSchedule(60, 1000);
        const monthlyRate = annualToMonthly(3);
        const inflRates = Array(60).fill(monthlyRate);
        const realCost = _calcRealCost(schedule, inflRates, 30, 0, 0);
        const nominalCost = 60 * 1000;
        // Non possiamo sapere se > o < ma non deve essere uguale al nominale
        expect(Math.abs(realCost - nominalCost) > 10).toBeTruthy();
    });
});

describe('calcRealCost — gestione costi iniziali', () => {
    it('costi iniziali con todayIdx=0 vengono aggiunti direttamente senza sconto', () => {
        const schedule = makeSchedule(1, 1000);
        const inflRates = [annualToMonthly(5)];

        // todayIdx=0: i costi iniziali vengono sommati senza sconto
        const realCost = _calcRealCost(schedule, inflRates, 0, 2000, 0);
        // Il primo pagamento (mese 1) viene scontato per 1 mese
        const pay1 = 1000 / (1 + inflRates[0]);
        expect(realCost).toBeCloseTo(pay1 + 2000, 2);
    });

    it('con todayIdx=0 e inflazione zero, costi iniziali = valore nominale esatto', () => {
        const schedule = makeSchedule(12, 500);
        const inflRates = Array(12).fill(0);
        const realCost = _calcRealCost(schedule, inflRates, 0, 1500, 0);
        expect(realCost).toBeCloseTo(12 * 500 + 1500, 1);
    });
});

describe('calcRealCost — proprietà matematiche', () => {
    it('costo reale cresce linearmente con il numero di mesi (inflazione zero)', () => {
        const sched12 = makeSchedule(12, 1000);
        const sched24 = makeSchedule(24, 1000);
        const infl12 = Array(12).fill(0);
        const infl24 = Array(24).fill(0);

        const r12 = _calcRealCost(sched12, infl12, 0, 0, 0);
        const r24 = _calcRealCost(sched24, infl24, 0, 0, 0);
        expect(r24).toBeCloseTo(r12 * 2, 1);
    });

    it('con pagamento doppio, il costo reale raddoppia (inflazione zero)', () => {
        const s1 = makeSchedule(12, 1000);
        const s2 = makeSchedule(12, 2000);
        const infl = Array(12).fill(0);

        const r1 = _calcRealCost(s1, infl, 0, 0, 0);
        const r2 = _calcRealCost(s2, infl, 0, 0, 0);
        expect(r2).toBeCloseTo(r1 * 2, 1);
    });
});
