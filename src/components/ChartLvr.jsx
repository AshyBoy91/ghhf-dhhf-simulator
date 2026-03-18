import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, Legend,
} from 'recharts';

export default function ChartLvr({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">LVR % Over Time</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8b949e' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#8b949e' }} domain={[0, 60]} />
          <Tooltip
            contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceArea y1={30} y2={40} fill="#d29922" fillOpacity={0.1} />
          <ReferenceLine y={40} stroke="#f85149" strokeDasharray="4 4" label={{ value: '40% sell', fill: '#f85149', fontSize: 10 }} />
          <ReferenceLine y={30} stroke="#58a6ff" strokeDasharray="4 4" label={{ value: '30% gear', fill: '#58a6ff', fontSize: 10 }} />
          <ReferenceLine y={35} stroke="#8b949e" strokeDasharray="2 2" />
          <Line
            type="monotone"
            dataKey="ghhfLvr"
            name="GHHF LVR"
            stroke="#d29922"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
