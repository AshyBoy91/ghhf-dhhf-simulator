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

  const baseMonthlyReturn = Math.pow(1.10, 1 / 12) - 1; // ~10% p.a.
  const crashEndDate = addMonths(crashStartDate, crashDuration);
  const recoveryEndDate = addMonths(crashEndDate, recoveryPace);

  const returns = [];
  const audReturns = [];
  const audCrashDepth = 0.15;

  for (let m = 0; m < totalMonths; m++) {
    const currentDate = addMonths(start, m);
    const monthsSinceCrashStart = monthDiff(crashStartDate, currentDate);

    let monthReturn;
    let audReturn = 0;

    if (currentDate < crashStartDate) {
      // Pre-crash: normal growth
      monthReturn = baseMonthlyReturn;
    } else if (monthsSinceCrashStart >= 0 && monthsSinceCrashStart < crashDuration) {
      // Crash phase: linear drawdown
      const monthlyDrop = crashDepth / crashDuration;
      monthReturn = -monthlyDrop;
      audReturn = -audCrashDepth / crashDuration;
    } else if (monthsSinceCrashStart >= crashDuration && monthsSinceCrashStart < crashDuration + recoveryPace) {
      // Recovery phase: logarithmic recovery
      const recoveryMonth = monthsSinceCrashStart - crashDuration;
      const t1 = recoveryMonth / recoveryPace;
      const t2 = (recoveryMonth + 1) / recoveryPace;
      // Log recovery curve: level = (1 - crashDepth) + crashDepth * log(1 + t*e - t) / log(e)
      // Simplified: use diminishing returns curve
      const level1 = (1 - crashDepth) + crashDepth * (1 - Math.pow(1 - t1, 2));
      const level2 = (1 - crashDepth) + crashDepth * (1 - Math.pow(1 - t2, 2));
      monthReturn = (level2 - level1) / level1;

      // AUD recovery: slower
      const audRecoveryPace = recoveryPace * 2;
      const audT1 = Math.min(recoveryMonth / audRecoveryPace, 1);
      const audT2 = Math.min((recoveryMonth + 1) / audRecoveryPace, 1);
      const audLevel1 = (1 - audCrashDepth) + audCrashDepth * (1 - Math.pow(1 - audT1, 2));
      const audLevel2 = (1 - audCrashDepth) + audCrashDepth * (1 - Math.pow(1 - audT2, 2));
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
    simStart, simEnd, crashStart, crashDepth, crashDuration, recoveryPace,
    rbaCashRate, crisisCreditSpread, startingLVR,
    dcaAmount, initialInvestment,
    enableTxCosts, enableCurrencyEffect, enableVolatilityDrag,
  } = params;

  const start = new Date(simStart);
  const crashStartDate = new Date(crashStart);
  const crashEndDate = addMonths(crashStartDate, crashDuration);

  const { returns, audReturns, totalMonths } = generateSyntheticReturns(params);

  // DHHF constants
  const dhhfFeeMonthly = 0.0019 / 12;
  const dhhfDividendMonthly = 0.035 / 12;

  // GHHF constants
  const ghhfFeeMonthly = 0.0035 / 12;
  const ghhfDividendMonthly = 0.025 / 12;
  const grossExposure = 1 + startingLVR / 100; // e.g. 1.35

  const output = [];
  let dhhfNav = 100;
  let ghhfNav = 100;
  let ghhfGross = initialInvestment * grossExposure;
  let ghhfDebt = initialInvestment * (startingLVR / 100);
  let ghhfEquity = initialInvestment;
  let audIndex = 100;
  let prevDca = null;

  for (let m = 0; m < totalMonths; m++) {
    const date = addMonths(start, m);
    const monthsSinceCrashStart = monthDiff(crashStartDate, date);
    const isCrashPeriod = monthsSinceCrashStart >= 0 && monthsSinceCrashStart < crashDuration;

    const marketReturn = returns[m];

    // Currency effect on returns (international portion ~63%)
    let effectiveReturn = marketReturn;
    if (enableCurrencyEffect && audReturns[m] !== 0) {
      const intlPortion = 0.63; // US 41% + Dev 16% + EM 6%
      const domPortion = 0.37;
      const intlReturnAud = (1 + marketReturn) / (1 + audReturns[m]) - 1;
      effectiveReturn = domPortion * marketReturn + intlPortion * intlReturnAud;
    }

    // --- DHHF ---
    const dhhfReturn = effectiveReturn - dhhfFeeMonthly;
    dhhfNav *= (1 + dhhfReturn + dhhfDividendMonthly);

    // --- GHHF ---
    const borrowingRate = (rbaCashRate + (isCrashPeriod ? crisisCreditSpread : crisisCreditSpread * 0.3)) / 100;
    const monthlyBorrowingRate = borrowingRate / 12;

    // Gross asset return
    const ghhfMarketReturn = effectiveReturn * grossExposure;

    // Volatility drag
    let volDrag = 0;
    if (enableVolatilityDrag) {
      const monthlyVariance = Math.pow(marketReturn, 2);
      volDrag = 0.5 * Math.pow(grossExposure, 2) * monthlyVariance;
    }

    // Interest cost on debt
    const interestCost = ghhfDebt * monthlyBorrowingRate;

    // Update GHHF gross assets
    ghhfGross *= (1 + effectiveReturn);
    ghhfGross -= ghhfGross * ghhfFeeMonthly; // Management fee on gross
    ghhfGross -= ghhfGross * volDrag; // Vol drag

    // GHHF equity = gross - debt
    ghhfDebt += interestCost; // Interest accrues to debt
    ghhfEquity = ghhfGross - ghhfDebt;

    // Dividends (net of interest)
    const ghhfDivs = ghhfGross * ghhfDividendMonthly;
    ghhfEquity += ghhfDivs;
    ghhfGross += ghhfDivs;

    // LVR management
    const lvrResult = manageLVR(ghhfGross, ghhfDebt, effectiveReturn, isCrashPeriod, enableTxCosts);
    ghhfGross = lvrResult.grossAssets;
    ghhfDebt = lvrResult.debt;
    ghhfEquity = ghhfGross - ghhfDebt;

    // Update GHHF NAV index (base 100)
    ghhfNav = (ghhfEquity / initialInvestment) * 100;

    // AUD index
    audIndex *= (1 + audReturns[m]);

    // DCA
    const dcaResult = processDCA(params, date, dhhfNav, ghhfNav, prevDca);
    prevDca = dcaResult;

    // Portfolio values (initial investment)
    const portfolioDhhf = initialInvestment * (dhhfNav / 100);
    const portfolioGhhf = ghhfEquity;

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
      portfolioGhhf: Math.max(portfolioGhhf, 0),
      cumulativeDca: dcaResult.cumulativeInvested,
      dcaPortfolioDhhf: dcaResult.portfolioDhhf || 0,
      dcaPortfolioGhhf: dcaResult.portfolioGhhf || 0,
    });
  }

  return output;
}

export function runHistoricalSimulation(params, navSeries, audSeries) {
  const {
    rbaCashRate, crisisCreditSpread, startingLVR,
    dcaAmount, initialInvestment,
    enableTxCosts, enableVolatilityDrag, crashStart, crashDuration,
  } = params;

  const crashStartDate = new Date(crashStart);

  const dhhfFeeMonthly = 0.0019 / 12;
  const ghhfFeeMonthly = 0.0035 / 12;
  const ghhfDividendMonthly = 0.025 / 12;
  const grossExposure = 1 + startingLVR / 100;

  const output = [];
  let ghhfGross = initialInvestment * grossExposure;
  let ghhfDebt = initialInvestment * (startingLVR / 100);
  let ghhfEquity = initialInvestment;
  let prevDca = null;

  for (let i = 0; i < navSeries.length; i++) {
    const { date, nav: dhhfNav } = navSeries[i];
    const dateObj = new Date(date + '-01');
    const monthsSinceCrash = monthDiff(crashStartDate, dateObj);
    const isCrashPeriod = monthsSinceCrash >= 0 && monthsSinceCrash < (crashDuration || 17);

    // Compute GHHF from market return
    let marketReturn = 0;
    if (i > 0) {
      marketReturn = (dhhfNav - navSeries[i - 1].nav) / navSeries[i - 1].nav;
    }

    const borrowingRate = (rbaCashRate + (isCrashPeriod ? crisisCreditSpread : crisisCreditSpread * 0.3)) / 100;
    const monthlyBorrowingRate = borrowingRate / 12;
    const interestCost = ghhfDebt * monthlyBorrowingRate;

    ghhfGross *= (1 + marketReturn);
    ghhfGross -= ghhfGross * ghhfFeeMonthly;

    if (enableVolatilityDrag) {
      const volDrag = 0.5 * Math.pow(grossExposure, 2) * Math.pow(marketReturn, 2);
      ghhfGross -= ghhfGross * volDrag;
    }

    ghhfDebt += interestCost;
    ghhfEquity = ghhfGross - ghhfDebt;

    const ghhfDivs = ghhfGross * ghhfDividendMonthly;
    ghhfEquity += ghhfDivs;
    ghhfGross += ghhfDivs;

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

  return output;
}

export function computeKPIs(output, params) {
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

  // Recovery time (months to get back to 100 after first drop below)
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

  // Interest & fees estimate
  const totalMonths = output.length;
  const avgDebt = params.initialInvestment * (params.startingLVR / 100);
  const avgBorrowingRate = output.reduce((sum, d) => sum + d.borrowingRate, 0) / totalMonths / 100;
  const totalInterest = avgDebt * avgBorrowingRate * (totalMonths / 12);
  const totalFees = params.initialInvestment * 1.35 * 0.0035 * (totalMonths / 12);

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
    totalInterest: Math.round(totalInterest),
    totalFees: Math.round(totalFees),
    dcaTotalInvested: output[output.length - 1].cumulativeDca,
    finalDhhf: Math.round(finalDhhf),
    finalGhhf: Math.round(finalGhhf),
  };
}
