export function processDCA(params, monthDate, dhhfNav, ghhfNav, prevDca) {
  const { dcaAmount, dcaStart, dcaEnd } = params;
  const dcaStartDate = new Date(dcaStart);
  const dcaEndDate = new Date(dcaEnd);

  const prev = prevDca || {
    dhhfUnits: 0,
    ghhfUnits: 0,
    cumulativeInvested: 0,
  };

  if (dcaAmount <= 0 || monthDate < dcaStartDate || monthDate > dcaEndDate) {
    return {
      ...prev,
      dcaUnitsThisMonth: 0,
      portfolioDhhf: prev.dhhfUnits * dhhfNav,
      portfolioGhhf: prev.ghhfUnits * ghhfNav,
    };
  }

  const dhhfUnitsBought = dcaAmount / dhhfNav;
  const ghhfUnitsBought = dcaAmount / ghhfNav;

  const newDhhfUnits = prev.dhhfUnits + dhhfUnitsBought;
  const newGhhfUnits = prev.ghhfUnits + ghhfUnitsBought;
  const newCumulative = prev.cumulativeInvested + dcaAmount;

  return {
    dhhfUnits: newDhhfUnits,
    ghhfUnits: newGhhfUnits,
    cumulativeInvested: newCumulative,
    dcaUnitsThisMonth: dhhfUnitsBought,
    portfolioDhhf: newDhhfUnits * dhhfNav,
    portfolioGhhf: newGhhfUnits * ghhfNav,
  };
}
