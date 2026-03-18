import { SCENARIOS } from '../engine/scenarios.js';

export default function ScenarioButtons({ mode, onSelect }) {
  const available = Object.entries(SCENARIOS).filter(
    ([, s]) => s.modes.includes(mode)
  );

  return (
    <div className="mb-4">
      <label className="text-xs text-[#8b949e] uppercase tracking-wider mb-2 block">
        Preset Scenarios
      </label>
      <div className="flex flex-wrap gap-2">
        {available.map(([key, scenario]) => (
          <button
            key={key}
            onClick={() => onSelect(scenario)}
            className="px-3 py-1.5 text-xs rounded-md bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#58a6ff] transition-colors"
          >
            {scenario.name}
          </button>
        ))}
      </div>
    </div>
  );
}
