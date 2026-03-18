const LVR_TARGET = 0.35;
const LVR_UPPER = 0.40;
const LVR_LOWER = 0.30;
const BASE_TX_COST = 0.001; // 0.1%

export function manageLVR(grossAssets, debt, monthReturn, isCrashPeriod, enableTxCosts) {
  let lvr = debt / grossAssets;
  let forcedSale = null;
  let newDebt = debt;
  let newGross = grossAssets;

  if (lvr > LVR_UPPER) {
    // Sell assets to return to target LVR
    // target: newDebt / (grossAssets - saleAmount) = LVR_TARGET
    // saleAmount goes to pay down debt
    const saleAmount = (debt - LVR_TARGET * grossAssets) / (1 - LVR_TARGET);
    const txCost = enableTxCosts
      ? saleAmount * (BASE_TX_COST + (isCrashPeriod ? 0.005 : 0))
      : 0;
    const netSale = saleAmount - txCost;
    newDebt = debt - netSale;
    newGross = grossAssets - saleAmount;
    forcedSale = saleAmount;
  } else if (lvr < LVR_LOWER) {
    // Re-gear up to target
    // target: (debt + newBorrowing) / (grossAssets + newBorrowing) = LVR_TARGET
    const newBorrowing = (LVR_TARGET * grossAssets - debt) / (1 - LVR_TARGET);
    newDebt = debt + newBorrowing;
    newGross = grossAssets + newBorrowing;
  }

  return {
    grossAssets: newGross,
    debt: newDebt,
    lvr: newDebt / newGross,
    forcedSale,
  };
}
