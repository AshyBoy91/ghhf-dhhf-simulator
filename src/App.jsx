import { useState, useCallback } from 'react';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import KpiCards from './components/KpiCards.jsx';
import ChartNav from './components/ChartNav.jsx';
import ChartLvr from './components/ChartLvr.jsx';
import ChartBorrowing from './components/ChartBorrowing.jsx';
import ChartAud from './components/ChartAud.jsx';
import ChartDca from './components/ChartDca.jsx';
import ForcedSalesLog from './components/ForcedSalesLog.jsx';
import { runSimulation, runHistoricalSimulation, computeKPIs } from './engine/simulate.js';
import { buildDhhfNav } from './engine/fetchHistorical.js';
import { DEFAULT_PARAMS } from './engine/scenarios.js';

function App() {
  const [mode, setMode] = useState('synthetic');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [simData, setSimData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setParams(prev => ({ ...prev, mode: newMode }));
  };

  const handleRunSim = useCallback(async () => {
    setLoading(true);
    try {
      let data;

      if (mode === 'historical') {
        try {
          const { navSeries, audSeries } = await buildDhhfNav(
            params.simStart, params.simEnd, params.enableCurrencyEffect
          );
          data = runHistoricalSimulation(params, navSeries, audSeries);
        } catch (err) {
          console.error('Historical fetch failed:', err);
          showToast('Historical data fetch failed. Falling back to Synthetic mode.');
          handleModeChange('synthetic');
          data = runSimulation(params);
        }
      } else {
        data = runSimulation(params);
      }

      setSimData(data);
      setKpis(computeKPIs(data, params));
    } catch (err) {
      console.error('Simulation error:', err);
      showToast('Simulation error: ' + err.message);
    }
    setLoading(false);
  }, [mode, params]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <Header mode={mode} setMode={handleModeChange} />

      <div className="flex">
        {/* Main content area */}
        <div className="flex-1 p-6 overflow-y-auto h-[calc(100vh-60px)]">
          {!simData && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-20">&#x1F4C8;</div>
                <h2 className="text-xl text-[#8b949e] mb-2">GHHF / DHHF Simulator</h2>
                <p className="text-sm text-[#484f58]">
                  Configure parameters in the sidebar and click "Run Simulation" to start
                </p>
              </div>
            </div>
          )}

          {simData && (
            <>
              <KpiCards kpis={kpis} mode={mode} dcaEnabled={params.dcaAmount > 0} />
              <ChartNav data={simData} params={params} />
              <ChartLvr data={simData} />
              <ChartBorrowing data={simData} />
              <ChartAud data={simData} enabled={params.enableCurrencyEffect} />
              <ChartDca data={simData} params={params} />
              <ForcedSalesLog data={simData} mode={mode} />
            </>
          )}
        </div>

        {/* Right sidebar */}
        <ControlPanel
          params={params}
          setParams={setParams}
          mode={mode}
          onRunSim={handleRunSim}
          loading={loading}
        />
      </div>

      {toast && (
        <div className="fixed top-5 right-5 bg-[#21262d] border border-[#d29922] text-[#e6edf3] px-5 py-3 rounded-lg z-50 text-sm animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
