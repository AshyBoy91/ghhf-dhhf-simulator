function KpiCard({ label, value, sub, color = '#e6edf3' }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 min-w-[140px]">
      <div className="text-xs text-[#8b949e] mb-1">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#8b949e] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function KpiCards({ kpis, mode, dcaEnabled }) {
  if (!kpis || !kpis.peakDrawdownDhhf) return null;

  const prefix = mode === 'historical' ? 'Actual' : 'Simulated';

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <KpiCard
        label={`${prefix} Peak Drawdown`}
        value={`${kpis.peakDrawdownDhhf}%`}
        sub={`GHHF: ${kpis.peakDrawdownGhhf}%`}
        color="#f85149"
      />
      <KpiCard
        label="DHHF Recovery"
        value={`${kpis.dhhfRecovery} yr`}
        color="#58a6ff"
      />
      <KpiCard
        label="GHHF to ATH"
        value={`${kpis.ghhfRecovery} yr`}
        sub={kpis.recoveryDiff !== 'N/A' ? `+${kpis.recoveryDiff} vs DHHF` : ''}
        color="#d29922"
      />
      <KpiCard
        label="Forced Sales"
        value={`${kpis.forcedSaleCount} events`}
        sub={`$${(kpis.totalForcedSales / 1000).toFixed(1)}k liquidated`}
        color="#f85149"
      />
      <KpiCard
        label="Interest + Fees"
        value={`$${((kpis.totalInterest + kpis.totalFees) / 1000).toFixed(1)}k`}
        sub={`Interest $${(kpis.totalInterest / 1000).toFixed(1)}k, Fees $${(kpis.totalFees / 1000).toFixed(1)}k`}
        color="#bc8cff"
      />
      {dcaEnabled && (
        <KpiCard
          label="DCA Total Invested"
          value={`$${(kpis.dcaTotalInvested / 1000).toFixed(1)}k`}
          color="#3fb950"
        />
      )}
      <KpiCard
        label="Final Portfolio"
        value={`GHHF $${(kpis.finalGhhf / 1000).toFixed(1)}k`}
        sub={`DHHF $${(kpis.finalDhhf / 1000).toFixed(1)}k`}
        color="#3fb950"
      />
    </div>
  );
}
