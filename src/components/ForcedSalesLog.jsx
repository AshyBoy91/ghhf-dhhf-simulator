export default function ForcedSalesLog({ data, mode }) {
  if (!data || data.length === 0) return null;

  const sales = data.filter(d => d.forcedSale !== null);
  if (sales.length === 0) return null;

  const totalAmount = sales.reduce((sum, d) => sum + d.forcedSale, 0);

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Forced Sales Log</h3>
      <div className="text-xs text-[#f85149] mb-2 font-semibold">
        {sales.length} events, ${(totalAmount / 1000).toFixed(1)}k total liquidated
      </div>
      <div className="max-h-40 overflow-y-auto text-xs font-mono text-[#8b949e] space-y-0.5">
        {sales.map((d, i) => (
          <div key={i}>
            <span className="text-[#f85149]">{d.date}</span>: ${(d.forcedSale / 1000).toFixed(1)}k sold
            (LVR was {d.ghhfLvr > 40 ? d.ghhfLvr.toFixed(1) : '>40'}%)
          </div>
        ))}
      </div>
    </div>
  );
}
