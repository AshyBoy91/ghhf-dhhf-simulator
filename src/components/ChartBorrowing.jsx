import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

export default function ChartBorrowing({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Borrowing Rate % Over Time</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="rbaCashRateVal"
            name="RBA Cash Rate"
            stroke="#8b949e"
            strokeDasharray="5 5"
            dot={false}
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="borrowingRate"
            name="Total Borrowing Rate"
            stroke="#bc8cff"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
