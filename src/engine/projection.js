// Australian tax brackets (Stage 3 tax cuts, 2024-25 onwards)
const TAX_BRACKETS = [
  { min: 0, max: 18200, rate: 0 },
  { min: 18200, max: 45000, rate: 0.16 },
  { min: 45000, max: 135000, rate: 0.30 },
  { min: 135000, max: 190000, rate: 0.37 },
  { min: 190000, max: Infinity, rate: 0.45 },
];

const CORPORATE_TAX_RATE = 0.30;
const MEDICARE_LEVY = 0.02;

// DHHF constants
const DHHF_FEE = 0.0019;           // 0.19% p.a. on NAV
const DHHF_DIVIDEND_YIELD = 0.035;  // 3.5% p.a. distribution yield
const DHHF_AU_WEIGHT = 0.37;       // AU equity portion (eligible for franking)
const DHHF_FRANKING_RATE = 1.0;    // AU dividends ~100% franked

// GHHF constants
const GHHF_FEE = 0.0035;           // 0.35% p.a. on GROSS assets
// GHHF holds the same underlying assets as DHHF, so gross assets earn the same
// 3.5% dividend yield. Interest is paid from this income. Net distribution to
// investors = (3.5% * gross - interest). Franking credits pass through pro-rata.
const UNDERLYING_DIVIDEND_YIELD = 0.035; // same underlying yield on gross
const GHHF_AU_WEIGHT = 0.37;
const GHHF_FRANKING_RATE = 1.0;

export function getMarginalRate(taxableIncome) {
  for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
    if (taxableIncome > TAX_BRACKETS[i].min) {
      return TAX_BRACKETS[i].rate;
    }
  }
  return 0;
}

export function computeTax(taxableIncome) {
  let tax = 0;
  for (const bracket of TAX_BRACKETS) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  tax += taxableIncome * MEDICARE_LEVY;
  return tax;
}

// Franking credit calculation for the investor at tax time
function computeFrankingBenefit(dividend, auWeight, frankingRate, marginalRate) {
  const frankedAmount = dividend * auWeight * frankingRate;
  const frankingCredit = frankedAmount * CORPORATE_TAX_RATE / (1 - CORPORATE_TAX_RATE);
  const grossedUp = frankedAmount + frankingCredit;
  const taxOwed = grossedUp * (marginalRate + MEDICARE_LEVY);
  const unfrankedAmount = dividend * (1 - auWeight * frankingRate);
  const taxOnUnfranked = unfrankedAmount * (marginalRate + MEDICARE_LEVY);
  const netTaxOnDividends = taxOwed + taxOnUnfranked - frankingCredit;

  return {
    frankingCredit,
    netTaxOnDividends,
  };
}

export function runProjection(params) {
  const {
    annualIncome,
    initialInvestment,
    dcaMonthly,
    expectedReturn, // % p.a. total return (capital + dividends)
    investmentHorizon, // years
    rbaCashRate,
    creditSpread,
    startingLVR,
  } = params;

  const marginalRate = getMarginalRate(annualIncome);
  const annualReturn = expectedReturn / 100;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const borrowingRate = (rbaCashRate + creditSpread) / 100;
  const monthlyBorrowingRate = borrowingRate / 12;
  const lvrDecimal = startingLVR / 100;
  // LVR = debt / gross, so gross = equity / (1 - LVR)
  const grossExposure = 1 / (1 - lvrDecimal); // ~1.538x at 35% LVR
  const totalMonths = investmentHorizon * 12;

  const output = [];

  // --- DHHF ---
  // NAV grows by total market return minus fees. Dividends are part of the
  // total return (not added on top), tracked separately for franking only.
  let dhhfNav = initialInvestment;
  let dhhfTotalContributed = initialInvestment;
  let dhhfTotalDividends = 0;
  let dhhfTotalFrankingCredits = 0;
  let dhhfTotalTaxOnDividends = 0;

  // --- GHHF ---
  // Gross assets get full market exposure. Interest is PAID from gross assets
  // (not capitalised into debt). Fee on gross. Equity = gross - debt.
  let ghhfGross = initialInvestment * grossExposure;
  let ghhfDebt = ghhfGross - initialInvestment;
  let ghhfEquity = initialInvestment;
  let ghhfTotalContributed = initialInvestment;
  let ghhfTotalDividends = 0;
  let ghhfTotalFrankingCredits = 0;
  let ghhfTotalTaxOnDividends = 0;
  let ghhfTotalInterestPaid = 0;

  for (let m = 0; m < totalMonths; m++) {
    const year = Math.floor(m / 12) + 1;

    // ===== DHHF =====
    // Total return (includes dividends)
    dhhfNav *= (1 + monthlyReturn);
    // Management fee
    dhhfNav -= dhhfNav * (DHHF_FEE / 12);
    // Track dividends for franking (portion of total return distributed as income)
    const dhhfDiv = dhhfNav * (DHHF_DIVIDEND_YIELD / 12);
    dhhfTotalDividends += dhhfDiv;
    const dhhfFranking = computeFrankingBenefit(dhhfDiv, DHHF_AU_WEIGHT, DHHF_FRANKING_RATE, marginalRate);
    dhhfTotalFrankingCredits += dhhfFranking.frankingCredit;
    dhhfTotalTaxOnDividends += dhhfFranking.netTaxOnDividends;
    // DCA
    dhhfNav += dcaMonthly;
    dhhfTotalContributed += dcaMonthly;

    // ===== GHHF =====
    // 1. Gross assets grow by market return (leveraged exposure)
    ghhfGross *= (1 + monthlyReturn);
    // 2. Management fee on gross
    ghhfGross -= ghhfGross * (GHHF_FEE / 12);
    // 3. Interest PAID from gross assets (reduces gross, debt unchanged)
    const monthlyInterest = ghhfDebt * monthlyBorrowingRate;
    ghhfGross -= monthlyInterest;
    ghhfTotalInterestPaid += monthlyInterest;
    // 4. Equity = gross - debt
    ghhfEquity = ghhfGross - ghhfDebt;

    // 5. LVR rebalancing — maintain target band (same as real GHHF)
    let currentLvr = ghhfGross > 0 ? ghhfDebt / ghhfGross : 0;
    if (currentLvr < 0.30) {
      // Re-gear: borrow more and buy assets to return to target LVR
      const newBorrowing = (lvrDecimal * ghhfGross - ghhfDebt) / (1 - lvrDecimal);
      ghhfDebt += newBorrowing;
      ghhfGross += newBorrowing;
      ghhfEquity = ghhfGross - ghhfDebt;
    } else if (currentLvr > 0.40) {
      // Forced sale: sell assets to pay down debt
      const saleAmount = (ghhfDebt - lvrDecimal * ghhfGross) / (1 - lvrDecimal);
      ghhfDebt -= saleAmount;
      ghhfGross -= saleAmount;
      ghhfEquity = ghhfGross - ghhfDebt;
    }

    // Track dividends & franking credits
    // Underlying assets earn 3.5% income on GROSS. Fund pays interest from that.
    // Net cash distribution = gross income - interest.
    // Franking credits are generated on the GROSS AU dividend income (1.54x more
    // than DHHF) and pass through fully — interest doesn't reduce franking credits.
    const grossDividendIncome = ghhfGross * (UNDERLYING_DIVIDEND_YIELD / 12);
    const ghhfNetDistribution = Math.max(grossDividendIncome - monthlyInterest, 0);
    ghhfTotalDividends += ghhfNetDistribution;
    // Franking credits: based on GROSS AU dividend income, not net distribution
    const grossAuDividend = ghhfGross * (UNDERLYING_DIVIDEND_YIELD / 12) * GHHF_AU_WEIGHT * GHHF_FRANKING_RATE;
    const ghhfFrankingCredit = grossAuDividend * CORPORATE_TAX_RATE / (1 - CORPORATE_TAX_RATE);
    ghhfTotalFrankingCredits += ghhfFrankingCredit;
    // Tax on distribution: investor pays tax on net distribution + franking credits
    const grossedUpDist = ghhfNetDistribution + ghhfFrankingCredit;
    const taxOnDist = grossedUpDist * (marginalRate + MEDICARE_LEVY) - ghhfFrankingCredit;
    ghhfTotalTaxOnDividends += taxOnDist;
    // 6. DCA: new equity + proportional new borrowing to maintain target LVR
    const dcaNewGross = dcaMonthly * grossExposure;
    const dcaNewDebt = dcaNewGross - dcaMonthly;
    ghhfGross += dcaNewGross;
    ghhfDebt += dcaNewDebt;
    ghhfTotalContributed += dcaMonthly;
    ghhfEquity = ghhfGross - ghhfDebt;

    output.push({
      month: m + 1,
      year,
      date: `Y${year}`,
      dhhfBalance: Math.max(dhhfNav, 0),
      ghhfBalance: Math.max(ghhfEquity, 0),
      totalContributed: dhhfTotalContributed,
      dhhfGain: Math.max(dhhfNav - dhhfTotalContributed, 0),
      ghhfGain: Math.max(ghhfEquity - ghhfTotalContributed, 0),
      ghhfGross: Math.max(ghhfGross, 0),
      ghhfDebt,
      ghhfLvr: ghhfGross > 0 ? (ghhfDebt / ghhfGross) * 100 : 0,
      cumulativeDhhfDividends: dhhfTotalDividends,
      cumulativeGhhfDividends: ghhfTotalDividends,
      cumulativeDhhfFrankingCredits: dhhfTotalFrankingCredits,
      cumulativeGhhfFrankingCredits: ghhfTotalFrankingCredits,
      cumulativeInterestPaid: ghhfTotalInterestPaid,
    });
  }

  const final = output[output.length - 1];

  const kpis = {
    marginalRate: ((marginalRate + MEDICARE_LEVY) * 100).toFixed(1),
    dhhfFinalBalance: Math.round(final.dhhfBalance),
    ghhfFinalBalance: Math.round(final.ghhfBalance),
    totalContributed: Math.round(final.totalContributed),
    dhhfTotalReturn: (((final.dhhfBalance / final.totalContributed) - 1) * 100).toFixed(1),
    ghhfTotalReturn: (((Math.max(final.ghhfBalance, 0) / final.totalContributed) - 1) * 100).toFixed(1),
    outperformance: Math.round(final.ghhfBalance - final.dhhfBalance),
    dhhfTotalDividends: Math.round(dhhfTotalDividends),
    ghhfTotalDividends: Math.round(ghhfTotalDividends),
    dhhfFrankingCredits: Math.round(dhhfTotalFrankingCredits),
    ghhfFrankingCredits: Math.round(ghhfTotalFrankingCredits),
    dhhfAfterTaxDividends: Math.round(dhhfTotalDividends - dhhfTotalTaxOnDividends),
    ghhfAfterTaxDividends: Math.round(ghhfTotalDividends - ghhfTotalTaxOnDividends),
    ghhfTotalInterest: Math.round(ghhfTotalInterestPaid),
    borrowingCostPa: borrowingRate * 100,
    grossExposure: grossExposure,
  };

  return { output, kpis };
}

export const TAX_BRACKET_INFO = TAX_BRACKETS.map(b => ({
  ...b,
  label: b.max === Infinity
    ? `$${(b.min / 1000).toFixed(0)}k+`
    : `$${(b.min / 1000).toFixed(0)}k-$${(b.max / 1000).toFixed(0)}k`,
  rateLabel: `${(b.rate * 100).toFixed(0)}%`,
}));
