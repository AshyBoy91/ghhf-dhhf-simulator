import { manageLVR } from './lvrManager.js';
import { processDCA } from './dcaEngine.js';

function monthDiff(d1, d2) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function generateSyntheticReturns(params) {
  const { simStart, simEnd, crashStart, crashDepth, crashDuration, recoveryPace } = params;
  const start = new Date(simStart);
  const end = new Date(simEnd);
  const crashStartDate = new Date(crashStart);
  const totalMonths = monthDiff(start, end);

  const baseMonthlyReturn = Math.pow(1.10, 1 / 12) - 1; // ~10% p.a. total return

  const returns = [];
  const audReturns = [];
  const audCrashDepth = 0.15;

  // Crash: multiplicative monthly return to reach exact crashDepth over crashDuration months
  // (1 + r)^n = (1 - crashDepth), so r = (1-crashDepth)^(1/n) - 1
  const crashMonthlyReturn = Math.pow(1 - crashDepth, 1 / crashDuration) - 1;
  const audCrashMonthlyReturn = Math.pow(1 - audCrashDepth, 1 / crashDuration) - 1;

  // Track actual crash-end level for recovery curve
  const crashEndLevel = 1 - crashDepth; // exact target after crash

  for (let m = 0; m < totalMonths; m++) {
    const currentDate = addMonths(start, m);
    const monthsSinceCrashStart = monthDiff(crashStartDate, currentDate);

    let monthReturn;
    let audReturn = 0;

    if (currentDate < crashStartDate) {
      // Pre-crash: normal growth
      monthReturn = baseMonthlyReturn;
    } else if (monthsSinceCrashStart >= 0 && monthsSinceCrashStart < crashDuration) {
      // Crash phase: multiplicative drawdown to reach exact crashDepth
      monthReturn = crashMonthlyReturn;
      audReturn = audCrashMonthlyReturn;
    } else if (monthsSinceCrashStart >= crashDuration && monthsSinceCrashStart < crashDuration + recoveryPace) {
      // Recovery phase: quadratic ease-out from crashEndLevel back to 1.0
      const recoveryMonth = monthsSinceCrashStart - crashDuration;
      const t1 = recoveryMonth / recoveryPace;
      const t2 = (recoveryMonth + 1) / recoveryPace;
      const level1 = crashEndLevel + (1 - crashEndLevel) * (1 - Math.pow(1 - t1, 2));
      const level2 = crashEndLevel + (1 - crashEndLevel) * (1 - Math.pow(1 - t2, 2));
      monthReturn = (level2 - level1) / level1;

      // AUD recovery: slower (2x recovery pace)
      const audCrashEnd = 1 - audCrashDepth;
      const audRecoveryPace = recoveryPace * 2;
      const audT1 = Math.min(recoveryMonth / audRecoveryPace, 1);
      const audT2 = Math.min((recoveryMonth + 1) / audRecoveryPace, 1);
      const audLevel1 = audCrashEnd + (1 - audCrashEnd) * (1 - Math.pow(1 - audT1, 2));
      const audLevel2 = audCrashEnd + (1 - audCrashEnd) * (1 - Math.pow(1 - audT2, 2));
      audReturn = (audLevel2 - audLevel1) / audLevel1;
    } else {
      // Post-recovery: normal growth
      monthReturn = baseMonthlyReturn;
    }

    returns.push(monthReturn);
    audReturns.push(audReturn);
  }

  return { returns, audReturns, totalMonths };
}

export function runSimulation(params) {
  const {
    simStart, crashStart, crashDuration,
    rbaCashRate, crisisCreditSpread, startingLVR,
    initialInvestment,
    enableTxCosts, enableCurrencyEffect,
  } = params;

  const start = new Date(simStart);
  const crashStartDate = new Date(crashStart);

  const { returns, audReturns, totalMonths } = generateSyntheticReturns(params);

  const dhhfFeeMonthly = 0.0019 / 12;
  const ghhfFeeMonthly = 0.0035 / 12;

  // LVR = debt / gross, so gross = equity / (1 - LVR)
  const lvrDecimal = startingLVR / 100;
  const grossExposure = 1 / (1 - lvrDecimal);

  const output = [];
  let dhhfNav = 100;
  let ghhfGross = initialInvestment * grossExposure;
  let ghhfDebt = ghhfGross - initialInvestment;
  let ghhfEquity = initialInvestment;
  let audIndex = 100;
  let prevDca = null;

  // Accumulators for KPIs
  let totalInterestPaid = 0;
  let totalFeesPaid = 0;

  for (let m = 0; m < totalMonths; m++) {
    const date = addMonths(start, m);
    const monthsSinceCrashStart = monthDiff(crashStartDate, date);
    const isCrashPeriod = monthsSinceCrashStart >= 0 && monthsSinceCrashStart < crashDuration;

    const marketReturn = returns[m];

    // Currency effect on returns (international portion ~63%)
    let effectiveReturn = marketReturn;
    if (enableCurrencyEffect && audReturns[m] !== 0) {
      const intlPortion = 0.63;
      const domPortion = 0.37;
      const intlReturnAud = (1 + marketReturn) / (1 + audReturns[m]) - 1;
      effectiveReturn = domPortion * marketReturn + intlPortion * intlReturnAud;
    }

    // --- DHHF ---
    // Total return already includes dividends; just subtract fee
    dhhfNav *= (1 + effectiveReturn - dhhfFeeMonthly);

    // --- GHHF ---
    // Borrowing rate: full crisis spread during crash, base RBA rate + small margin outside
    const borrowingRate = (rbaCashRate + (isCrashPeriod ? crisisCreditSpread : 0)) / 100;
    const monthlyBorrowingRate = borrowingRate / 12;

    // 1. Gross assets grow by market return
    ghhfGross *= (1 + effectiveReturn);
    // 2. Management fee on gross
    const feeThisMonth = ghhfGross * ghhfFeeMonthly;
    ghhfGross -= feeThisMonth;
    totalFeesPaid += feeThisMonth;
    // 3. Interest paid from gross assets (not capitalised into debt)
    const interestCost = ghhfDebt * monthlyBorrowingRate;
    ghhfGross -= interestCost;
    totalInterestPaid += interestCost;
    // 4. Equity = gross - debt
    ghhfEquity = ghhfGross - ghhfDebt;

    // LVR management (forced sales / re-gearing)
    const lvrResult = manageLVR(ghhfGross, ghhfDebt, effectiveReturn, isCrashPeriod, enableTxCosts);
    ghhfGross = lvrResult.grossAssets;
    ghhfDebt = lvrResult.debt;
    ghhfEquity = ghhfGross - ghhfDebt;

    // GHHF NAV index (base 100)
    const ghhfNav = (ghhfEquity / initialInvestment) * 100;

    // AUD index
    audIndex *= (1 + audReturns[m]);

    // DCA
    const dcaResult = processDCA(params, date, dhhfNav, Math.max(ghhfNav, 0.01), prevDca);
    prevDca = dcaResult;

    // Portfolio values
    const portfolioDhhf = initialInvestment * (dhhfNav / 100);
    const portfolioGhhf = Math.max(ghhfEquity, 0);

    output.push({
      date: date.toISOString().slice(0, 7),
      dateObj: date,
      dhhfNav: Math.max(dhhfNav, 0),
      ghhfNav: Math.max(ghhfNav, 0),
      ghhfLvr: lvrResult.lvr * 100,
      borrowingRate: borrowingRate * 100,
      rbaCashRateVal: rbaCashRate,
      audIndex,
      forcedSale: lvrResult.forcedSale ? Math.round(lvrResult.forcedSale) : null,
      dcaUnits: dcaResult.dcaUnitsThisMonth,
      portfolioDhhf: Math.max(portfolioDhhf, 0),
      portfolioGhhf,
      cumulativeDca: dcaResult.cumulativeInvested,
      dcaPortfolioDhhf: dcaResult.portfolioDhhf || 0,
      dcaPortfolioGhhf: dcaResult.portfolioGhhf || 0,
    });
  }

  return { output, totalInterestPaid, totalFeesPaid };
}

export function runHistoricalSimulation(params, navSeries, audSeries) {
  const {
    rbaCashRate, crisisCreditSpread, startingLVR,
    initialInvestment,
    enableTxCosts, crashStart, crashDuration,
  } = params;

  const crashStartDate = new Date(crashStart);
  const ghhfFeeMonthly = 0.0035 / 12;
  const lvrDecimal = startingLVR / 100;
  const grossExposure = 1 / (1 - lvrDecimal);

  const output = [];
  let ghhfGross = initialInvestment * grossExposure;
  let ghhfDebt = ghhfGross - initialInvestment;
  let ghhfEquity = initialInvestment;
  let prevDca = null;
  let totalInterestPaid = 0;
  let totalFeesPaid = 0;

  for (let i = 0; i < navSeries.length; i++) {
    const { date, nav: dhhfNav } = navSeries[i];
    const dateObj = new Date(date + '-01');
    const monthsSinceCrash = monthDiff(crashStartDate, dateObj);
    const isCrashPeriod = monthsSinceCrash >= 0 && monthsSinceCrash < (crashDuration || 17);

    // Market return from DHHF NAV changes
    let marketReturn = 0;
    if (i > 0) {
      marketReturn = (dhhfNav - navSeries[i - 1].nav) / navSeries[i - 1].nav;
    }

    const borrowingRate = (rbaCashRate + (isCrashPeriod ? crisisCreditSpread : 0)) / 100;
    const monthlyBorrowingRate = borrowingRate / 12;

    // 1. Gross assets grow by market return
    ghhfGross *= (1 + marketReturn);
    // 2. Fee on gross
    const feeThisMonth = ghhfGross * ghhfFeeMonthly;
    ghhfGross -= feeThisMonth;
    totalFeesPaid += feeThisMonth;
    // 3. Interest paid from gross assets
    const interestCost = ghhfDebt * monthlyBorrowingRate;
    ghhfGross -= interestCost;
    totalInterestPaid += interestCost;
    // 4. Equity
    ghhfEquity = ghhfGross - ghhfDebt;

    // LVR management
    const lvrResult = manageLVR(ghhfGross, ghhfDebt, marketReturn, isCrashPeriod, enableTxCosts);
    ghhfGross = lvrResult.grossAssets;
    ghhfDebt = lvrResult.debt;
    ghhfEquity = ghhfGross - ghhfDebt;

    const ghhfNavIdx = (ghhfEquity / initialInvestment) * 100;
    const portfolioDhhf = initialInvestment * (dhhfNav / 100);

    const dcaResult = processDCA(params, dateObj, dhhfNav, Math.max(ghhfNavIdx, 0.01), prevDca);
    prevDca = dcaResult;

    output.push({
      date,
      dateObj,
      dhhfNav,
      ghhfNav: Math.max(ghhfNavIdx, 0),
      ghhfLvr: lvrResult.lvr * 100,
      borrowingRate: borrowingRate * 100,
      rbaCashRateVal: rbaCashRate,
      audIndex: audSeries[i]?.aud || 100,
      forcedSale: lvrResult.forcedSale ? Math.round(lvrResult.forcedSale) : null,
      dcaUnits: dcaResult.dcaUnitsThisMonth,
      portfolioDhhf: Math.max(portfolioDhhf, 0),
      portfolioGhhf: Math.max(ghhfEquity, 0),
      cumulativeDca: dcaResult.cumulativeInvested,
      dcaPortfolioDhhf: dcaResult.portfolioDhhf || 0,
      dcaPortfolioGhhf: dcaResult.portfolioGhhf || 0,
    });
  }

  return { output, totalInterestPaid, totalFeesPaid };
}

export function computeKPIs(simResult, params) {
  const output = simResult.output || simResult;
  const totalInterestPaid = simResult.totalInterestPaid || 0;
  const totalFeesPaid = simResult.totalFeesPaid || 0;

  if (!output || output.length === 0) return {};

  const dhhfValues = output.map(d => d.dhhfNav);
  const ghhfValues = output.map(d => d.ghhfNav);

  // Peak drawdown
  let dhhfMaxDD = 0, ghhfMaxDD = 0;
  let dhhfPeak = dhhfValues[0], ghhfPeak = ghhfValues[0];
  for (let i = 1; i < output.length; i++) {
    dhhfPeak = Math.max(dhhfPeak, dhhfValues[i]);
    ghhfPeak = Math.max(ghhfPeak, ghhfValues[i]);
    dhhfMaxDD = Math.max(dhhfMaxDD, (dhhfPeak - dhhfValues[i]) / dhhfPeak);
    ghhfMaxDD = Math.max(ghhfMaxDD, (ghhfPeak - ghhfValues[i]) / ghhfPeak);
  }

  // Recovery time
  let dhhfRecoveryMonths = null;
  let ghhfRecoveryMonths = null;
  const crashIdx = output.findIndex(d => d.dhhfNav < 100);
  if (crashIdx >= 0) {
    for (let i = crashIdx; i < output.length; i++) {
      if (dhhfRecoveryMonths === null && dhhfValues[i] >= 100) {
        dhhfRecoveryMonths = i - crashIdx;
      }
      if (ghhfRecoveryMonths === null && ghhfValues[i] >= 100) {
        ghhfRecoveryMonths = i - crashIdx;
      }
    }
  }

  // Forced sales
  const forcedSales = output.filter(d => d.forcedSale !== null);
  const totalForcedSaleAmount = forcedSales.reduce((sum, d) => sum + d.forcedSale, 0);

  // Final values
  const finalDhhf = output[output.length - 1].portfolioDhhf;
  const finalGhhf = output[output.length - 1].portfolioGhhf;

  return {
    peakDrawdownDhhf: (dhhfMaxDD * 100).toFixed(1),
    peakDrawdownGhhf: (ghhfMaxDD * 100).toFixed(1),
    dhhfRecovery: dhhfRecoveryMonths !== null ? (dhhfRecoveryMonths / 12).toFixed(1) : 'N/A',
    ghhfRecovery: ghhfRecoveryMonths !== null ? (ghhfRecoveryMonths / 12).toFixed(1) : 'N/A',
    recoveryDiff: (dhhfRecoveryMonths !== null && ghhfRecoveryMonths !== null)
      ? ((ghhfRecoveryMonths - dhhfRecoveryMonths) / 12).toFixed(1) : 'N/A',
    forcedSaleCount: forcedSales.length,
    totalForcedSales: Math.round(totalForcedSaleAmount),
    totalInterest: Math.round(totalInterestPaid),
    totalFees: Math.round(totalFeesPaid),
    dcaTotalInvested: output[output.length - 1].cumulativeDca,
    finalDhhf: Math.round(finalDhhf),
    finalGhhf: Math.round(finalGhhf),
  };
}
