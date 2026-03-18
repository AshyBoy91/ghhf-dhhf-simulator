import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

export default function ChartDca({ data, params }) {
  if (!params.dcaAmount || params.dcaAmount <= 0 || !data || data.length === 0) return null;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">DCA Portfolio Value</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
            formatter={(val) => `$${Math.round(val).toLocaleString()}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="cumulativeDca"
            name="Total Invested"
            fill="#30363d"
            stroke="#8b949e"
            fillOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="dcaPortfolioDhhf"
            name="DHHF+DCA Value"
            stroke="#58a6ff"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="dcaPortfolioGhhf"
            name="GHHF+DCA Value"
            stroke="#3fb950"
            dot={false}
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
