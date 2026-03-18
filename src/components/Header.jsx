export default function Header({ mode, setMode }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#30363d]">
      <div>
        <h1 className="text-xl font-bold text-[#e6edf3] m-0">
          GHHF / DHHF Crash & DCA Simulator
        </h1>
        <p className="text-xs text-[#8b949e] mt-1">
          Compare geared vs ungeared ETF performance through crash scenarios
        </p>
      </div>
      <div className="flex bg-[#21262d] rounded-lg p-1">
        <button
          onClick={() => setMode('historical')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'historical'
              ? 'bg-[#58a6ff] text-white'
              : 'text-[#8b949e] hover:text-[#e6edf3]'
          }`}
        >
          Historical
        </button>
        <button
          onClick={() => setMode('synthetic')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'synthetic'
              ? 'bg-[#58a6ff] text-white'
              : 'text-[#8b949e] hover:text-[#e6edf3]'
          }`}
        >
          Synthetic
        </button>
      </div>
    </header>
  );
}
