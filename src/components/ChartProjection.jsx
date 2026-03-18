import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

function ProjectionKpiCards({ kpis }) {
  if (!kpis) return null;

  const cards = [
    { label: 'DHHF Final Value', value: `$${(kpis.dhhfFinalBalance / 1000).toFixed(0)}k`, color: '#58a6ff', sub: `Return: ${kpis.dhhfTotalReturn}%` },
    { label: 'GHHF Final Value', value: `$${(kpis.ghhfFinalBalance / 1000).toFixed(0)}k`, color: '#3fb950', sub: `Return: ${kpis.ghhfTotalReturn}%` },
    { label: 'GHHF Outperformance', value: `${kpis.outperformance >= 0 ? '+' : ''}$${(kpis.outperformance / 1000).toFixed(0)}k`, color: kpis.outperformance >= 0 ? '#3fb950' : '#f85149' },
    { label: 'Total Contributed', value: `$${(kpis.totalContributed / 1000).toFixed(0)}k`, color: '#8b949e' },
    { label: 'Marginal Tax Rate', value: `${kpis.marginalRate}%`, color: '#d29922', sub: 'Incl. Medicare levy' },
    { label: 'GHHF Gross Exposure', value: `${kpis.grossExposure.toFixed(2)}x`, color: '#bc8cff', sub: `Borrowing at ${kpis.borrowingCostPa.toFixed(1)}% p.a.` },
    { label: 'DHHF Dividends Received', value: `$${(kpis.dhhfTotalDividends / 1000).toFixed(0)}k`, color: '#58a6ff', sub: `Franking credits: $${(kpis.dhhfFrankingCredits / 1000).toFixed(1)}k` },
    { label: 'GHHF Dividends Received', value: `$${(kpis.ghhfTotalDividends / 1000).toFixed(0)}k`, color: '#3fb950', sub: `Franking credits: $${(kpis.ghhfFrankingCredits / 1000).toFixed(1)}k` },
    { label: 'GHHF Internal Interest', value: `$${(kpis.ghhfTotalInterest / 1000).toFixed(0)}k`, color: '#f85149', sub: 'Paid by fund, reduces NAV' },
  ];

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {cards.map((c, i) => (
        <div key={i} className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 min-w-[140px]">
          <div className="text-xs text-[#8b949e] mb-1">{c.label}</div>
          <div className="text-lg font-bold" style={{ color: c.color }}>{c.value}</div>
          {c.sub && <div className="text-xs text-[#8b949e] mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function fmt(val) {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val.toFixed(0)}`;
}

export default function ChartProjection({ data, kpis }) {
  if (!data || data.length === 0) return null;

  // Show yearly data points for readability
  const yearly = data.filter(d => d.month % 12 === 0 || d.month === 1);

  return (
    <div>
      <ProjectionKpiCards kpis={kpis} />

      {/* Portfolio Growth Chart */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">Portfolio Value Over Time</h3>
        <p className="text-xs text-[#484f58] mb-3">GHHF outperforms in positive markets due to geared exposure</p>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={yearly} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#8b949e' }}
              formatter={(val) => `$${Math.round(val).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="totalContributed"
              name="Total Contributed"
              fill="#30363d"
              stroke="#8b949e"
              fillOpacity={0.4}
            />
            <Line type="monotone" dataKey="dhhfBalance" name="DHHF (ungeared)" stroke="#58a6ff" dot={false} strokeWidth={2} strokeDasharray="5 5" />
            <Line type="monotone" dataKey="ghhfBalance" name="GHHF (geared)" stroke="#3fb950" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gains Comparison */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">Cumulative Gains (Above Contributions)</h3>
        <p className="text-xs text-[#484f58] mb-3">Leverage amplifies gains — the gap widens over time with compounding</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={yearly} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => `$${Math.round(val).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="dhhfGain" name="DHHF Gain" stroke="#58a6ff" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="ghhfGain" name="GHHF Gain" stroke="#3fb950" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Dividend & Franking Credits */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">Cumulative Dividends & Franking Credits</h3>
        <p className="text-xs text-[#484f58] mb-3">Franking credits offset personal tax on the AU equity portion of distributions</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={yearly} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => `$${Math.round(val).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="cumulativeDhhfDividends" name="DHHF Dividends" stroke="#58a6ff" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="cumulativeGhhfDividends" name="GHHF Dividends" stroke="#3fb950" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="cumulativeDhhfFrankingCredits" name="DHHF Franking Credits" stroke="#79c0ff" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="cumulativeGhhfFrankingCredits" name="GHHF Franking Credits" stroke="#7ee787" dot={false} strokeWidth={1.5} strokeDasharray="4 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* GHHF Internal Costs */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">GHHF Internal Borrowing Cost</h3>
        <p className="text-xs text-[#484f58] mb-3">Interest is paid internally by the fund — it reduces NAV but enables leveraged exposure</p>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={yearly} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} tickFormatter={fmt} />
            <Tooltip
              contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
              formatter={(val) => `$${Math.round(val).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="ghhfDebt" name="GHHF Debt" fill="#f8514920" stroke="#f85149" fillOpacity={0.3} dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="cumulativeInterestPaid" name="Cumulative Interest (internal)" stroke="#f85149" dot={false} strokeWidth={2} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ghhfGross" name="GHHF Gross Assets" stroke="#bc8cff" dot={false} strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
