import { getMarginalRate, TAX_BRACKET_INFO } from '../engine/projection.js';

function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8b949e]">{label}</span>
        <span className="text-[#e6edf3] font-mono">{typeof value === 'number' ? value.toLocaleString() : value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, min = 0, step = 1000, prefix = '' }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b949e] text-sm">{prefix}</span>
        )}
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          step={step}
          className={`w-full ${prefix ? 'pl-7' : ''}`}
        />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs uppercase tracking-wider text-[#58a6ff] font-semibold mb-3 border-b border-[#30363d] pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function ProjectionPanel({ params, setParams, onRun, loading }) {
  const update = (key, val) => setParams(prev => ({ ...prev, [key]: val }));
  const marginalRate = getMarginalRate(params.annualIncome);

  return (
    <div className="w-80 min-w-[320px] bg-[#161b22] border-l border-[#30363d] p-4 overflow-y-auto h-[calc(100vh-60px)]">

      <Section title="Your Income">
        <NumberInput
          label="Annual Taxable Income (AUD)"
          value={params.annualIncome}
          onChange={v => update('annualIncome', v)}
          step={5000}
          prefix="$"
        />
        <div className="text-xs text-[#8b949e] bg-[#0d1117] rounded-md p-2 mb-3">
          <span>Marginal rate: </span>
          <span className="text-[#d29922] font-bold">{(marginalRate * 100).toFixed(0)}% + 2% Medicare</span>
          <div className="mt-1 text-[#484f58]">
            {TAX_BRACKET_INFO.map((b, i) => (
              <div key={i} className={marginalRate === b.rate ? 'text-[#d29922]' : ''}>
                {b.label}: {b.rateLabel}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Investment">
        <NumberInput
          label="Initial Investment (AUD)"
          value={params.initialInvestment}
          onChange={v => update('initialInvestment', v)}
          step={5000}
          prefix="$"
        />
        <NumberInput
          label="Monthly DCA (AUD)"
          value={params.dcaMonthly}
          onChange={v => update('dcaMonthly', v)}
          step={100}
          prefix="$"
        />
        <Slider
          label="Investment Horizon"
          value={params.investmentHorizon}
          onChange={v => update('investmentHorizon', v)}
          min={1} max={40} unit=" years"
        />
      </Section>

      <Section title="Market Assumptions">
        <Slider
          label="Expected Annual Return"
          value={params.expectedReturn}
          onChange={v => update('expectedReturn', v)}
          min={0} max={20} step={0.5} unit="%"
        />
        <Slider
          label="RBA Cash Rate"
          value={params.rbaCashRate}
          onChange={v => update('rbaCashRate', v)}
          min={0} max={15} step={0.25} unit="%"
        />
        <Slider
          label="Credit Spread"
          value={params.creditSpread}
          onChange={v => update('creditSpread', v)}
          min={0} max={8} step={0.25} unit="%"
        />
        <Slider
          label="Starting LVR"
          value={params.startingLVR}
          onChange={v => update('startingLVR', v)}
          min={20} max={40} unit="%"
        />
      </Section>

      <Section title="Dividend & Tax Info">
        <div className="text-xs text-[#8b949e] bg-[#0d1117] rounded-md p-2 space-y-1">
          <div>DHHF yield: <span className="text-[#58a6ff]">3.5% p.a.</span> (~37% franked via AU equities)</div>
          <div>GHHF yield: <span className="text-[#3fb950]">2.5% p.a.</span> (lower due to internal interest costs)</div>
          <div>Corporate tax rate: <span className="text-[#e6edf3]">30%</span></div>
          <div>Franking credit = <span className="text-[#d29922]">dividend x 30/70</span></div>
          <div className="border-t border-[#30363d] pt-1 mt-1">
            Interest is paid <span className="text-[#f85149]">internally by the fund</span> — reduces NAV, not claimed by investor
          </div>
          <div>Franking credits <span className="text-[#3fb950]">flow through</span> to investor on AU equity distributions</div>
        </div>
      </Section>

      <button
        onClick={onRun}
        disabled={loading}
        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors bg-[#238636] hover:bg-[#2ea043] text-white disabled:opacity-50"
      >
        {loading ? 'Calculating...' : 'Calculate Projection'}
      </button>
    </div>
  );
}
