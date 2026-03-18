import ScenarioButtons from './ScenarioButtons.jsx';

function Slider({ label, value, onChange, min, max, step = 1, unit = '', disabled = false }) {
  return (
    <div className={`mb-3 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#8b949e]">{label}</span>
        <span className="text-[#e6edf3] font-mono">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}

function DateInput({ label, value, onChange, disabled = false }) {
  return (
    <div className={`mb-3 ${disabled ? 'opacity-40' : ''}`}>
      <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, min = 0, step = 100 }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-[#8b949e] block mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        step={step}
        className="w-full"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 mb-2 text-xs text-[#8b949e] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      {label}
    </label>
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

export default function ControlPanel({ params, setParams, mode, onRunSim, loading }) {
  const isSynthetic = mode === 'synthetic';

  const update = (key, val) => setParams(prev => ({ ...prev, [key]: val }));

  const handleScenario = (scenario) => {
    setParams(prev => ({
      ...prev,
      simStart: scenario.simStart,
      simEnd: scenario.simEnd,
      crashStart: scenario.crashStart,
      crashDepth: scenario.crashDepth,
      crashDuration: scenario.crashDuration,
      recoveryPace: scenario.recoveryPace,
      rbaCashRate: scenario.rbaCashRate,
      crisisCreditSpread: scenario.crisisCreditSpread,
    }));
  };

  return (
    <div className="w-80 min-w-[320px] bg-[#161b22] border-l border-[#30363d] p-4 overflow-y-auto h-[calc(100vh-60px)]">
      <ScenarioButtons mode={mode} onSelect={handleScenario} />

      <Section title="Date Range">
        <DateInput label="Simulation Start" value={params.simStart} onChange={v => update('simStart', v)} />
        <DateInput label="Simulation End" value={params.simEnd} onChange={v => update('simEnd', v)} />
        <DateInput
          label="Crash Start"
          value={params.crashStart}
          onChange={v => update('crashStart', v)}
          disabled={!isSynthetic && false}
        />
      </Section>

      <Section title="Crash Parameters">
        <Slider
          label="Market Crash Depth"
          value={Math.round(params.crashDepth * 100)}
          onChange={v => update('crashDepth', v / 100)}
          min={0} max={80} unit="%"
          disabled={!isSynthetic}
        />
        <Slider
          label="Crash Duration"
          value={params.crashDuration}
          onChange={v => update('crashDuration', v)}
          min={1} max={36} unit=" mo"
          disabled={!isSynthetic}
        />
        <Slider
          label="Recovery Pace"
          value={params.recoveryPace}
          onChange={v => update('recoveryPace', v)}
          min={12} max={120} unit=" mo"
          disabled={!isSynthetic}
        />
      </Section>

      <Section title="Borrowing & LVR">
        <Slider
          label="RBA Cash Rate"
          value={params.rbaCashRate}
          onChange={v => update('rbaCashRate', v)}
          min={0} max={15} step={0.25} unit="%"
        />
        <Slider
          label="Crisis Credit Spread"
          value={params.crisisCreditSpread}
          onChange={v => update('crisisCreditSpread', v)}
          min={0} max={8} step={0.25} unit="%"
        />
        <Slider
          label="Starting LVR"
          value={params.startingLVR}
          onChange={v => update('startingLVR', v)}
          min={20} max={40} unit="%"
        />
      </Section>

      <Section title="Investment & DCA">
        <NumberInput
          label="Initial Investment (AUD)"
          value={params.initialInvestment}
          onChange={v => update('initialInvestment', v)}
          step={1000}
        />
        <NumberInput
          label="DCA Amount ($/month)"
          value={params.dcaAmount}
          onChange={v => update('dcaAmount', v)}
          step={100}
        />
        {params.dcaAmount > 0 && (
          <>
            <DateInput label="DCA Start" value={params.dcaStart} onChange={v => update('dcaStart', v)} />
            <DateInput label="DCA End" value={params.dcaEnd} onChange={v => update('dcaEnd', v)} />
          </>
        )}
      </Section>

      <Section title="Realism Toggles">
        <Toggle
          label="Transaction costs (wider spreads in crash)"
          checked={params.enableTxCosts}
          onChange={v => update('enableTxCosts', v)}
        />
        <Toggle
          label="Currency effect (AUD/USD)"
          checked={params.enableCurrencyEffect}
          onChange={v => update('enableCurrencyEffect', v)}
        />
        <Toggle
          label="Volatility drag"
          checked={params.enableVolatilityDrag}
          onChange={v => update('enableVolatilityDrag', v)}
        />
      </Section>

      <button
        onClick={onRunSim}
        disabled={loading}
        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors bg-[#238636] hover:bg-[#2ea043] text-white disabled:opacity-50"
      >
        {loading ? 'Running...' : 'Run Simulation'}
      </button>
    </div>
  );
}
