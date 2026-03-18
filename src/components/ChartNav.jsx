import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Scatter, ComposedChart, Legend,
} from 'recharts';

export default function ChartNav({ data, params }) {
  if (!data || data.length === 0) return null;

  const hasDca = params.dcaAmount > 0;
  const forcedSales = data.filter(d => d.forcedSale !== null);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">NAV vs Time (Base 100, Total Return)</h3>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#8b949e' }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={100} stroke="#30363d" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="dhhfNav"
            name="DHHF"
            stroke="#58a6ff"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="ghhfNav"
            name="GHHF"
            stroke="#3fb950"
            dot={false}
            strokeWidth={2}
          />
          {hasDca && (
            <Line
              type="monotone"
              dataKey="dcaPortfolioDhhf"
              name="DHHF+DCA"
              stroke="#79c0ff"
              dot={false}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          {hasDca && (
            <Line
              type="monotone"
              dataKey="dcaPortfolioGhhf"
              name="GHHF+DCA"
              stroke="#7ee787"
              dot={false}
              strokeWidth={1}
            />
          )}
          {forcedSales.map((d, i) => (
            <ReferenceLine
              key={i}
              x={d.date}
              stroke="#f85149"
              strokeDasharray="2 2"
              strokeWidth={1}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
