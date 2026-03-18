const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

const DHHF_TICKERS = {
  au: { ticker: '^AXJO', weight: 0.37, international: false },
  us: { ticker: '^GSPC', weight: 0.41, international: true },
  devExUs: { ticker: 'EFA', weight: 0.16, international: true },
  em: { ticker: 'EEM', weight: 0.06, international: true },
};

const FX_TICKER = 'AUDUSD=X';
const DHHF_FEE = 0.0019; // 0.19% p.a.
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(ticker, start, end) {
  return `yf_${ticker}_${start}_${end}`;
}

function getFromCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or disabled
  }
}

async function fetchTicker(ticker, startDate, endDate) {
  const period1 = Math.floor(new Date(startDate).getTime() / 1000);
  const period2 = Math.floor(new Date(endDate).getTime() / 1000);
  const cacheKey = getCacheKey(ticker, startDate, endDate);

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1mo&period1=${period1}&period2=${period2}`;
  const proxiedUrl = CORS_PROXY + encodeURIComponent(url);

  const res = await fetch(proxiedUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${ticker}: ${res.status}`);
  const json = await res.json();

  const chart = json.chart?.result?.[0];
  if (!chart) throw new Error(`No data for ${ticker}`);

  const timestamps = chart.timestamp || [];
  const closes = chart.indicators?.adjclose?.[0]?.adjclose
    || chart.indicators?.quote?.[0]?.close
    || [];

  const data = timestamps.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 7),
    close: closes[i],
  })).filter(d => d.close != null && !isNaN(d.close));

  setCache(cacheKey, data);
  return data;
}

function alignSeries(seriesMap) {
  // Find common date set
  const dateSets = Object.values(seriesMap).map(s => new Set(s.map(d => d.date)));
  const commonDates = [...dateSets[0]].filter(d => dateSets.every(set => set.has(d))).sort();

  const aligned = {};
  for (const [key, series] of Object.entries(seriesMap)) {
    const byDate = Object.fromEntries(series.map(d => [d.date, d.close]));
    aligned[key] = commonDates.map(d => byDate[d]);
  }

  return { dates: commonDates, aligned };
}

function computeReturns(prices) {
  return prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
}

export async function buildDhhfNav(startDate, endDate, enableCurrencyEffect) {
  // Fetch all tickers in parallel
  const tickerKeys = Object.keys(DHHF_TICKERS);
  const fetches = tickerKeys.map(k => fetchTicker(DHHF_TICKERS[k].ticker, startDate, endDate));
  fetches.push(fetchTicker(FX_TICKER, startDate, endDate));

  const results = await Promise.all(fetches);

  const seriesMap = {};
  tickerKeys.forEach((k, i) => { seriesMap[k] = results[i]; });
  seriesMap.fx = results[results.length - 1];

  const { dates, aligned } = alignSeries(seriesMap);

  // Compute monthly returns for each sleeve
  const sleeveReturns = {};
  for (const k of tickerKeys) {
    sleeveReturns[k] = computeReturns(aligned[k]);
  }
  const fxReturns = computeReturns(aligned.fx);

  // Blend
  const monthlyFee = DHHF_FEE / 12;
  let nav = 100;
  const navSeries = [{ date: dates[0], nav: 100 }];
  const audSeries = [{ date: dates[0], aud: 100 }];
  let audIndex = 100;

  for (let i = 0; i < sleeveReturns.au.length; i++) {
    let blendedReturn = 0;
    for (const k of tickerKeys) {
      let r = sleeveReturns[k][i];
      // Apply currency translation for international sleeves
      if (enableCurrencyEffect && DHHF_TICKERS[k].international) {
        // AUD strengthening hurts international returns when translated back
        r = (1 + r) / (1 + fxReturns[i]) - 1;
      }
      blendedReturn += DHHF_TICKERS[k].weight * r;
    }
    nav *= (1 + blendedReturn - monthlyFee);
    audIndex *= (1 + fxReturns[i]);
    navSeries.push({ date: dates[i + 1], nav });
    audSeries.push({ date: dates[i + 1], aud: audIndex });
  }

  return { navSeries, audSeries };
}
