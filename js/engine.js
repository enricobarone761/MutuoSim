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
            totalPaid: rataDaPagare + extra
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
