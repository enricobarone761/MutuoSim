/**
 * ===========================================================================
 *  MutuoSim — engine.js
 * ===========================================================================
 *  Motore di calcolo finanziario. Contiene le formule pure per l'ammortamento
 *  e la simulazione mese per mese senza alcuna dipendenza dal DOM.
 */

/**
 * Formula ammortamento francese (pura).
 * @param {number} principal  - Capitale del mutuo (€)
 * @param {number} years      - Durata in anni
 * @param {number} annualRate - Tasso annuo (%)
 * @returns {number} Rata mensile (€)
 */
function calcRata(principal, years, annualRate) {
    if (principal <= 0 || years <= 0) return 0;
    const months = years * 12;
    const mr = Math.max(0, annualRate / 100 / 12);
    if (mr === 0) return principal / months;
    return (principal * mr) / (1 - Math.pow(1 + mr, -months));
}

/**
 * Simula il mutuo mese per mese con ammortamento francese.
 * @param {Object} params - Parametri di simulazione
 * @returns {Object} Risultati della simulazione
 */
function runSimulation(params) {
    const {
        P,
        totalMonths,
        baseRate,
        euriborConfig,
        ratePeriods,
        isVariable,
        extraPaymentsList,
        capitalAdditionsList = [],
        roundUpStartMonth,
        roundUpAmount,
        roundUpAnnualIncrease,
        generateChart
    } = params;

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

    let currentBalance = P;
    let rataBalance = P;
    let totalInterestPaid = 0;
    let totalExtraPaid = 0;
    let firstRata = initialRata;
    let maxRataSeen = 0;
    let currentRata = initialRata;
    let prevAnnualRate = firstRate;
    let actualMonths = totalMonths;

    let fullLabels = [];
    let fullDataBalance = [];
    let fullDataInterest = [];
    let fullDataPayment = [];
    let fullDataActualPayment = [];
    let fullDataRate = [];
    let historicalEndMonth = null;
    let amortizationSchedule = [];

    for (let m = 1; m <= totalMonths && currentBalance > 0.01; m++) {
        let currentAnnualRate = baseRate;
        if (euriborConfig.active && euriborConfig.rates.length > 0) {
            currentAnnualRate = euriborConfig.rates[Math.min(m - 1, euriborConfig.rates.length - 1)];
        } else if (isVariable && ratePeriods.length > 0) {
            for (let period of ratePeriods) {
                if (m >= period.start && m <= period.end) {
                    currentAnnualRate = period.rate;
                    break;
                }
            }
        }
        let monthlyRate = Math.max(0, currentAnnualRate / 100 / 12);

        if (currentAnnualRate !== prevAnnualRate) {
            let remainingMonths = totalMonths - (m - 1);
            if (remainingMonths > 0 && rataBalance > 0.01) {
                if (monthlyRate === 0) {
                    currentRata = rataBalance / remainingMonths;
                } else {
                    currentRata = (rataBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
                }
            }
            prevAnnualRate = currentAnnualRate;
        }

        let hasCapitalAddition = false;
        let capitalAddedThisMonth = 0;
        if (capitalAdditionsList && capitalAdditionsList.length > 0) {
            for (let ca of capitalAdditionsList) {
                if (m === ca.start) {
                    capitalAddedThisMonth += ca.amount;
                    hasCapitalAddition = true;
                }
            }
        }

        if (hasCapitalAddition) {
            currentBalance += capitalAddedThisMonth;
            rataBalance += capitalAddedThisMonth;
            let remainingMonths = totalMonths - (m - 1);
            if (remainingMonths > 0 && rataBalance > 0.01) {
                if (monthlyRate === 0) {
                    currentRata = rataBalance / remainingMonths;
                } else {
                    currentRata = (rataBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
                }
            }
        }

        let quotaInteressi = currentBalance * monthlyRate;
        let rataDaPagare = currentRata;
        if (currentBalance + quotaInteressi <= rataDaPagare) {
            rataDaPagare = currentBalance + quotaInteressi;
        }
        if (m === 1) firstRata = rataDaPagare;
        let quotaCapitale = rataDaPagare - quotaInteressi;

        let extraPeriodic = 0;
        let extraRoundup = 0;
        let hasInstallmentEffectExtra = false;

        for (let ep of extraPaymentsList) {
            const startMonth = Math.max(1, ep.start);
            const isInExtraPeriod = (m >= startMonth) && (ep.duration === 0 || m <= ep.start + (ep.duration * 12));
            if (isInExtraPeriod) {
                let applyExtra = false;
                if (ep.freqMonths === -1 && m === Math.max(1, ep.start)) applyExtra = true;
                else if (ep.freqMonths === 1) applyExtra = true;
                else if (ep.freqMonths > 1) {
                    if ((m - startMonth) % ep.freqMonths === 0) applyExtra = true;
                }

                if (applyExtra) {
                    let epAmount = Math.min(ep.amount, currentBalance - quotaCapitale - extraPeriodic);
                    if (epAmount < 0) epAmount = 0;
                    extraPeriodic += epAmount;
                    if (epAmount > 0 && ep.effect === 'installment') {
                        rataBalance -= epAmount;
                        hasInstallmentEffectExtra = true;
                    }
                }
            }
        }

        const isInRoundUpPeriod = (m > roundUpStartMonth);
        if (roundUpAmount > 0 && isInRoundUpPeriod) {
            const yearsElapsed = Math.floor((m - 1 - roundUpStartMonth) / 12);
            let growthFactor = 1;
            if (yearsElapsed > 0) {
                growthFactor = Math.pow(1 + roundUpAnnualIncrease / 100, yearsElapsed);
            }
            let effectiveRoundUpAmount = roundUpAmount * growthFactor;
            // Se l'incremento annuo è attivo, arrotonda alla decina più vicina (es: 827.42 -> 830, 851.37 -> 850)
            if (roundUpAnnualIncrease > 0) {
                effectiveRoundUpAmount = Math.round(effectiveRoundUpAmount / 10) * 10;
            }

            if (effectiveRoundUpAmount > currentRata) {
                const roundUpDiff = effectiveRoundUpAmount - currentRata;
                const maxRoundUpExtra = Math.max(0, currentBalance - quotaCapitale - extraPeriodic);
                extraRoundup = Math.min(roundUpDiff, maxRoundUpExtra);
            }
        }

        let extra = extraPeriodic + extraRoundup;
        totalExtraPaid += extra;

        totalInterestPaid += quotaInteressi;
        let capitalePagato = quotaCapitale + extra;
        rataBalance -= quotaCapitale;

        if (capitalePagato >= currentBalance) {
            capitalePagato = currentBalance;
            currentBalance = 0;
        } else {
            currentBalance -= capitalePagato;
        }

        if (rataDaPagare > maxRataSeen) maxRataSeen = rataDaPagare;

        if (hasInstallmentEffectExtra && currentBalance > 0.01) {
            let remainingMonths = totalMonths - m;
            if (remainingMonths > 0) {
                if (monthlyRate === 0) {
                    currentRata = rataBalance / remainingMonths;
                } else {
                    currentRata = (rataBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -remainingMonths));
                }
            }
        }

        amortizationSchedule.push({
            month: m,
            payment: rataDaPagare,
            interest: quotaInteressi,
            extra: extra,
            capitalAddition: capitalAddedThisMonth,
            totalPaid: quotaCapitale + quotaInteressi + extra
        });

        if (generateChart) {
            fullLabels.push('Mese ' + m);
            fullDataBalance.push(Math.max(0, currentBalance));
            fullDataInterest.push(totalInterestPaid);
            fullDataPayment.push(currentRata);
            fullDataActualPayment.push(rataDaPagare + extra);
            fullDataRate.push(currentAnnualRate);
            if (euriborConfig.active && m === euriborConfig.historicalCount) {
                historicalEndMonth = m;
            }
        }

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
        fullLabels,
        fullDataBalance,
        fullDataInterest,
        fullDataPayment,
        fullDataActualPayment,
        fullDataRate,
        historicalEndMonth,
        amortizationSchedule
    };
}

/**
 * Calcola lo scenario ibrido: Mutuo ridotto + Prestito Personale.
 * @param {Object} baseParams - Parametri originali del mutuo
 * @param {Object} hybridParams - Parametri del prestito personale
 * @returns {Object} Oggetto con i risultati del confronto
 */
function calculateHybridScenario(baseParams, hybridParams) {
    // 1. Mutuo Standard (Scenario A)
    const resA = runSimulation({ ...baseParams, generateChart: false });

    // 2. Mutuo Ridotto (Scenario B1)
    const reducedAmount = Math.max(0, baseParams.P - hybridParams.loanAmount);
    const pB1 = { ...baseParams, P: reducedAmount, generateChart: false };
    const resB1 = runSimulation(pB1);

    // 3. Prestito Personale (Scenario B2)
    const loanAmount = Math.min(baseParams.P, hybridParams.loanAmount);
    const loanRate = hybridParams.loanRate;
    const loanYears = Math.max(1, hybridParams.loanYears);
    const loanMonths = loanYears * 12;

    let loanRata = 0;
    let totalLoanPaid = 0;
    let totalLoanInterest = 0;

    if (loanAmount > 0) {
        const monthlyLoanRate = loanRate / 100 / 12;
        if (monthlyLoanRate === 0) {
            loanRata = loanAmount / loanMonths;
        } else {
            loanRata = (loanAmount * monthlyLoanRate) / (1 - Math.pow(1 + monthlyLoanRate, -loanMonths));
        }
        totalLoanPaid = loanRata * loanMonths;
        totalLoanInterest = totalLoanPaid - loanAmount;
    }

    // 4. Risultati B (Ibrido)
    const totalInterestB = resB1.totalInterestPaid + totalLoanInterest;

    // Totale pagato Scenario A (Standard): P + Interessi + Extra
    const totalPaidA = baseParams.P + resA.totalInterestPaid + resA.totalExtraPaid;

    // Totale pagato Scenario B (Ibrido): 
    // Capitale Mutuo Ridotto + Interessi Mutuo Ridotto + Extra Mutuo Ridotto + Totale Versato PL
    const totalPaidB = reducedAmount + resB1.totalInterestPaid + resB1.totalExtraPaid + totalLoanPaid;

    return {
        scenarioA: {
            totalInterest: resA.totalInterestPaid,
            totalPaid: totalPaidA,
            firstRata: resA.firstRata
        },
        scenarioB: {
            mortgageFirstRata: resB1.firstRata,
            loanRata: loanRata,
            combinedRata: resB1.firstRata + loanRata,
            totalInterest: totalInterestB,
            totalPaid: totalPaidB,
            loanDurationMonths: loanMonths
        },
        interestSaving: resA.totalInterestPaid - totalInterestB,
        totalSaving: totalPaidA - totalPaidB
    };
}

/**
 * Calcola lo scenario di Surroga: trasferimento del mutuo a una nuova banca con
 * nuovo tasso e/o nuova durata a partire dal mese indicato.
 *
 * @param {Object} baseSimResults  - Risultato completo di runSimulation() (con generateChart:true)
 * @param {Object} surrogaParams   - Parametri della surroga
 * @param {number} surrogaParams.month        - Mese in cui avviene la surroga (1-based)
 * @param {number} surrogaParams.newRate      - Nuovo tasso annuo (%)
 * @param {number} surrogaParams.newYears     - Nuova durata (anni)
 * @param {number} surrogaParams.costPerizia  - Costo perizia (€)
 * @param {number} surrogaParams.costIstru    - Costo istruttoria (€)
 * @param {number} surrogaParams.costAssicMese- Costo assicurazione mensile aggiuntiva (€)
 * @param {number} surrogaParams.currentRate  - Tasso corrente al mese di surroga (%)
 * @returns {Object|null} Risultati confronto con/senza surroga, o null se dati insufficienti
 */
function calculateSurroga(baseSimResults, surrogaParams) {
    const {
        month,
        newRate,
        newYears,   // ora contiene mesi (non anni) — il campo UI è stato cambiato in mesi
        costPerizia,
        costIstru,
        costAssicMese,
        currentRate
    } = surrogaParams;

    if (!baseSimResults || !baseSimResults.fullDataBalance || baseSimResults.fullDataBalance.length === 0) {
        return null;
    }

    const totalMonths = baseSimResults.fullDataBalance.length;

    // Mese di surroga 1-based → indice 0-based
    const surrogaIdx = Math.min(month - 1, totalMonths - 1);
    if (surrogaIdx < 0) return null;

    // Debito residuo al mese di surroga
    const debitoResiduo = baseSimResults.fullDataBalance[surrogaIdx];
    if (debitoResiduo <= 0.01) return null;

    // Rata corrente al mese di surroga (dal piano di ammortamento)
    const schedRow = baseSimResults.amortizationSchedule[surrogaIdx] || null;
    const rataAttuale = schedRow ? schedRow.payment : 0;

    // ── Scenario A: continua senza surroga ──
    // Interessi residui dal mese successivo alla surroga fino alla fine
    let intSenzaSurr = 0;
    for (let i = surrogaIdx; i < baseSimResults.amortizationSchedule.length; i++) {
        intSenzaSurr += baseSimResults.amortizationSchedule[i].interest;
    }

    // ── Scenario B: surroga ──
    // newYears contiene già mesi (il campo UI è in mesi dal refactoring)
    const newMonths = Math.max(1, newYears);   // nessuna moltiplicazione × 12
    const newMonthlyRate = Math.max(0, newRate / 100 / 12);
    let rataNuova;
    if (newMonthlyRate === 0) {
        rataNuova = debitoResiduo / newMonths;
    } else {
        rataNuova = (debitoResiduo * newMonthlyRate) / (1 - Math.pow(1 + newMonthlyRate, -newMonths));
    }

    // Interessi totali nuovo mutuo
    const intConSurr = (rataNuova * newMonths) - debitoResiduo;

    // Costi accessori totali della surroga
    const costiAccessori = (costPerizia || 0) + (costIstru || 0);
    const costiAssicTotali = (costAssicMese || 0) * newMonths;
    const costiTotali = costiAccessori + costiAssicTotali;

    // Risparmio interessi lordo (prima dei costi)
    const risparmioInteressiLordo = intSenzaSurr - intConSurr;

    // Risparmio netto (dopo costi)
    const risparmioInteressiNetto = risparmioInteressiLordo - costiTotali;

    // Risparmio rata mensile
    const risparmioRata = rataAttuale - rataNuova;

    // Break-even: quanti mesi per recuperare i costi con il risparmio mensile sulla rata
    let breakEvenMonths = null;
    if (costiAccessori > 0 && risparmioRata > 0) {
        breakEvenMonths = Math.ceil(costiAccessori / risparmioRata);
    }

    return {
        debitoResiduo,
        rataAttuale,
        rataNuova,
        risparmioRata,
        intSenzaSurr,
        intConSurr,
        risparmioInteressiLordo,
        costiTotali,
        risparmioInteressiNetto,
        breakEvenMonths,
        newMonths,
        surrogaMonth: month
    };
}

