/**
 * ===========================================================================
 *  MutuoSim — globals.js
 * ===========================================================================
 *  Definizione dei riferimenti DOM globali utilizzati da tutti i moduli.
 *  Questo file deve essere caricato per primo.
 */

// --- Input principali del mutuo ---
const amountInput = document.getElementById('amount');
const yearsInput = document.getElementById('years');
const targetRataInput = document.getElementById('targetRata');
const calcYearsFromRataBtn = document.getElementById('calcYearsFromRataBtn');
const rateInput = document.getElementById('rate');
const rateNumericInput = document.getElementById('rateNumeric');

// --- Sezione tasso variabile manuale ---
const isVariableCheckbox = document.getElementById('isVariable');
const variableSection = document.getElementById('variable-section');
const ratePeriodsContainer = document.getElementById('rate-periods-container');
const addPeriodBtn = document.getElementById('addPeriodBtn');

// --- Sezione estinzione parziale ---
const extraPaymentsContainer = document.getElementById('extra-payments-container');
const addExtraPaymentBtn = document.getElementById('addExtraPaymentBtn');

// --- Sezione aggiunta capitale ---
const capitalAdditionsContainer = document.getElementById('capital-additions-container');
const addCapitalAdditionBtn = document.getElementById('addCapitalAdditionBtn');

// --- Sezione arrotondamento rata ---
const roundUpStartMonthInput = document.getElementById('roundUpStartMonth');
const roundUpAmountInput = document.getElementById('roundUpAmount');
const roundUpAnnualIncreaseInput = document.getElementById('roundUpAnnualIncrease');

// --- Output numerici ---
const outInitialPayment = document.getElementById('outInitialPayment');
const outMaxPayment = document.getElementById('outMaxPayment');
const outTotalInterest = document.getElementById('outTotalInterest');
const outTotalPaid = document.getElementById('outTotalPaid');

// --- Box risparmio stimato ---
const savedTimeBox = document.getElementById('saved-time-box');
const outSavedTime = document.getElementById('outSavedTime');

// --- Sezione Soluzione Ibrida ---
const hybridToggle = document.getElementById('hybridToggle');
const hybridSection = document.getElementById('hybrid-section');
const hybridLoanAmountInput = document.getElementById('hybridLoanAmount');
const hybridLoanRateInput = document.getElementById('hybridLoanRate');
const hybridLoanYearsInput = document.getElementById('hybridLoanYears');
const hybridResultsBox = document.getElementById('hybrid-results');
const outHybridCombinedRata = document.getElementById('outHybridCombinedRata');
const outHybridInterestSaving = document.getElementById('outHybridInterestSaving');
const outHybridTotalDiff = document.getElementById('outHybridTotalDiff');

// --- Tabella sensibilità ---
const rataBox = document.getElementById('rataBox');
const rataSensitivityPanel = document.getElementById('rataSensitivityPanel');

// --- Piano Ammortamento ---
const openAmortizationBtn = document.getElementById('openAmortizationBtn');
const closeAmortizationBtn = document.getElementById('closeAmortizationBtn');
const amortizationDrawer = document.getElementById('amortizationDrawer');

// --- Selettore Intervallo Grafico ---
const chartRangeMin = document.getElementById('chartRangeMin');
const chartRangeMax = document.getElementById('chartRangeMax');
const rangeTrack = document.getElementById('rangeTrack');
const rangeLabelStart = document.getElementById('rangeLabelStart');
const rangeLabelEnd = document.getElementById('rangeLabelEnd');

// Stato Globale Condiviso
let lastFullResults = null;

// --- Advanced Features ---
const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
const closeAdvancedBtn = document.getElementById('closeAdvancedBtn');
const advancedSection = document.getElementById('advancedSection');

const costIstruttoria = document.getElementById('costIstruttoria');
const costPerizia = document.getElementById('costPerizia');
const costNotaio = document.getElementById('costNotaio');
const costImposta = document.getElementById('costImposta');
const costAssicurazione = document.getElementById('costAssicurazione');
const outTaeg = document.getElementById('outTaeg');

const calcDetrazione = document.getElementById('calcDetrazione');
const detrazioneBox = document.getElementById('detrazioneBox');
const outDetrazioneTotale = document.getElementById('outDetrazioneTotale');

const investmentRate = document.getElementById('investmentRate');
const outInvestmentValue = document.getElementById('outInvestmentValue');

const monthlyIncome = document.getElementById('monthlyIncome');
const dtiBox = document.getElementById('dtiBox');
const outDti = document.getElementById('outDti');

const propertyValue = document.getElementById('propertyValue');

const saveScenario1Btn = document.getElementById('saveScenario1Btn');
const loadScenario1Btn = document.getElementById('loadScenario1Btn');
const saveScenario2Btn = document.getElementById('saveScenario2Btn');
const loadScenario2Btn = document.getElementById('loadScenario2Btn');
const interestHeatmapContainer = document.getElementById('interestHeatmapContainer');
