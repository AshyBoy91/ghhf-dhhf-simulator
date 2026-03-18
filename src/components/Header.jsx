const MODES = [
  { key: 'historical', label: 'Historical' },
  { key: 'synthetic', label: 'Synthetic' },
  { key: 'projection', label: 'Expected Returns' },
];

export default function Header({ mode, setMode }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
      <div>
        <h1 className="text-xl font-bold text-[#e6edf3] m-0">
          GHHF / DHHF Simulator
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Compare geared vs ungeared ETF performance
        </p>
      </div>
      <div className="flex bg-[#21262d] rounded-lg p-1">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === m.key
                ? 'bg-[#58a6ff] text-white'
                : 'text-[#8b949e] hover:text-[#e6edf3]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </header>
  );
}
