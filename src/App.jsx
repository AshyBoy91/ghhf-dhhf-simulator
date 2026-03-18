import { useState, useCallback } from 'react';
import Header from './components/Header.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import ProjectionPanel from './components/ProjectionPanel.jsx';
import KpiCards from './components/KpiCards.jsx';
import ChartNav from './components/ChartNav.jsx';
import ChartLvr from './components/ChartLvr.jsx';
import ChartBorrowing from './components/ChartBorrowing.jsx';
import ChartAud from './components/ChartAud.jsx';
import ChartDca from './components/ChartDca.jsx';
import ForcedSalesLog from './components/ForcedSalesLog.jsx';
import ChartProjection from './components/ChartProjection.jsx';
import { runSimulation, runHistoricalSimulation, computeKPIs } from './engine/simulate.js';
import { buildDhhfNav } from './engine/fetchHistorical.js';
import { runProjection } from './engine/projection.js';
import { DEFAULT_PARAMS } from './engine/scenarios.js';

const DEFAULT_PROJECTION_PARAMS = {
  annualIncome: 120000,
  initialInvestment: 10000,
  dcaMonthly: 1000,
  expectedReturn: 10,
  investmentHorizon: 20,
  rbaCashRate: 4.35,
  creditSpread: 2.0,
  startingLVR: 35,
};

function App() {
  const [mode, setMode] = useState('synthetic');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [projParams, setProjParams] = useState({ ...DEFAULT_PROJECTION_PARAMS });
  const [simData, setSimData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [projData, setProjData] = useState(null);
  const [projKpis, setProjKpis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode !== 'projection') {
      setParams(prev => ({ ...prev, mode: newMode }));
    }
  };

  const handleRunSim = useCallback(async () => {
    setLoading(true);
    try {
      let simResult;

      if (mode === 'historical') {
        try {
          const { navSeries, audSeries } = await buildDhhfNav(
            params.simStart, params.simEnd, params.enableCurrencyEffect
          );
          simResult = runHistoricalSimulation(params, navSeries, audSeries);
        } catch (err) {
          console.error('Historical fetch failed:', err);
          showToast('Historical data fetch failed. Falling back to Synthetic mode.');
          handleModeChange('synthetic');
          simResult = runSimulation(params);
        }
      } else {
        simResult = runSimulation(params);
      }

      setSimData(simResult.output);
      setKpis(computeKPIs(simResult, params));
    } catch (err) {
      console.error('Simulation error:', err);
      showToast('Simulation error: ' + err.message);
    }
    setLoading(false);
  }, [mode, params]);

  const handleRunProjection = useCallback(() => {
    setLoading(true);
    try {
      const { output, kpis: pKpis } = runProjection(projParams);
      setProjData(output);
      setProjKpis(pKpis);
    } catch (err) {
      console.error('Projection error:', err);
      showToast('Projection error: ' + err.message);
    }
    setLoading(false);
  }, [projParams]);

  const isProjection = mode === 'projection';

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <Header mode={mode} setMode={handleModeChange} />

      <div className="flex">
        {/* Main content area */}
        <div className="flex-1 p-6 overflow-y-auto h-[calc(100vh-60px)]">
          {/* Crash sim modes */}
          {!isProjection && !simData && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-20">&#x1F4C8;</div>
                <h2 className="text-xl text-[#8b949e] mb-2">Crash & DCA Simulator</h2>
                <p className="text-sm text-[#484f58]">
                  Configure parameters in the sidebar and click "Run Simulation" to start
                </p>
              </div>
            </div>
          )}

          {!isProjection && simData && (
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

          {/* Projection mode */}
          {isProjection && !projData && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-20">&#x1F4B0;</div>
                <h2 className="text-xl text-[#8b949e] mb-2">Expected Returns Projection</h2>
                <p className="text-sm text-[#484f58]">
                  Enter your income, DCA amount, and expected returns to compare GHHF vs DHHF
                </p>
                <p className="text-xs text-[#484f58] mt-1">
                  Includes dividend reinvestment, franking credits, and interest tax deductions
                </p>
              </div>
            </div>
          )}

          {isProjection && projData && (
            <ChartProjection data={projData} kpis={projKpis} />
          )}
        </div>

        {/* Right sidebar */}
        {isProjection ? (
          <ProjectionPanel
            params={projParams}
            setParams={setProjParams}
            onRun={handleRunProjection}
            loading={loading}
          />
        ) : (
          <ControlPanel
            params={params}
            setParams={setParams}
            mode={mode}
            onRunSim={handleRunSim}
            loading={loading}
          />
        )}
      </div>

      {toast && (
        <div className="fixed top-5 right-5 bg-[#21262d] border border-[#d29922] text-[#e6edf3] px-5 py-3 rounded-lg z-50 text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
