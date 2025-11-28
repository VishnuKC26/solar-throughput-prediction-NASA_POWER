
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSites, getSite, triggerForecast } from '../api';

// Clean Forecast Chart with tooltip and solid fills (no gradients)
function ForecastChart({ data = [], width = 1000, height = 360 }) {
  const [hover, setHover] = useState(null);

  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <svg className="mx-auto mb-4 w-16 h-16 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-lg">No forecast data available</p>
      </div>
    </div>
  );

  const vals = data.map(d => Number(d.pred || 0));
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const allSame = range < 0.001;

  const padding = { top: 34, right: 48, bottom: 54, left: 56 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const stepX = chartWidth / Math.max(1, vals.length - 1);

  const points = vals.map((v, i) => {
    const x = padding.left + i * stepX;
    let y;
    if (allSame) {
      y = padding.top + chartHeight / 2;
    } else {
      y = padding.top + chartHeight - ((v - min) / range) * chartHeight;
    }
    return { x, y, value: v, raw: data[i] };
  });

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');

  const areaPath = `M ${padding.left},${padding.top + chartHeight} ` +
    points.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${padding.left + chartWidth},${padding.top + chartHeight} Z`;

  const Tooltip = ({ t }) => {
    if (!t) return null;
    const pad = 8;
    const textLines = [t.title, `${t.value.toFixed(2)} kWh`];
    const widthBox = Math.max(...textLines.map(l => l.length)) * 7 + pad * 2;
    const heightBox = 28 + (textLines.length - 1) * 16;
    let tx = t.x - widthBox / 2;
    const minX = padding.left;
    const maxX = padding.left + chartWidth - widthBox;
    if (tx < minX) tx = minX;
    if (tx > maxX) tx = maxX;
    const ty = t.y - heightBox - 12;
    return (
      <g>
        <rect x={tx} y={ty} rx={8} ry={8} width={widthBox} height={heightBox} fill="#0b1220" opacity={0.95} />
        <text x={tx + pad} y={ty + 18} fill="#e6eef8" fontSize={12} fontWeight={700}>{textLines[0]}</text>
        <text x={tx + pad} y={ty + 36} fill="#9fb5d9" fontSize={11}>{textLines[1]}</text>
      </g>
    );
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
      {/* subtle background */}
      <rect x={0} y={0} width={width} height={height} rx={14} fill="transparent" />

      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const y = padding.top + chartHeight * ratio;
        const value = max - (range * ratio);
        return (
          <g key={i}>
            <line 
              x1={padding.left} 
              y1={y} 
              x2={padding.left + chartWidth} 
              y2={y} 
              stroke="#0f1724" 
              strokeWidth="1" 
              strokeDasharray="6,6"
              opacity="0.22"
            />
            <text 
              x={padding.left - 14} 
              y={y + 4} 
              fill="#94a3b8" 
              fontSize="11" 
              textAnchor="end"
            >
              {value.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* area fill - solid color with opacity */}
      <path d={areaPath} fill="#0ea5e9" opacity={0.08} />

      {/* line - solid color */}
      <polyline 
        points={linePoints} 
        fill="none" 
        stroke="#0ea5e9" 
        strokeWidth="3" 
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle 
            cx={p.x} 
            cy={p.y} 
            r={6} 
            fill="#0b1220"
            stroke="#0ea5e9"
            strokeWidth="2"
            onMouseEnter={() => setHover({ x: p.x, y: p.y, value: p.value, title: new Date((p.raw?.date) || p.raw?.day || p.raw?.timestamp || Date.now()).toLocaleDateString() })}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer', transition: 'transform 120ms ease' }}
          />
          <circle 
            cx={p.x} 
            cy={p.y} 
            r={3} 
            fill="#0ea5e9"
            pointerEvents="none"
          />
        </g>
      ))}

      {/* x-axis labels */}
      {data.map((d, i) => {
        const x = padding.left + i * stepX;
        const date = new Date(d.date || d.day || d.timestamp || Date.now());
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = date.getDate();
        return (
          <g key={i}>
            <text 
              x={x} 
              y={height - 26} 
              fill="#94a3b8" 
              fontSize="12" 
              textAnchor="middle"
              fontWeight={600}
            >
              {dayName}
            </text>
            <text 
              x={x} 
              y={height - 12} 
              fill="#7c8797" 
              fontSize="11" 
              textAnchor="middle"
            >
              {dayNum}
            </text>
          </g>
        );
      })}

      {/* y-axis label */}
      <text 
        x={padding.left - 42} 
        y={padding.top - 12} 
        fill="#94a3b8" 
        fontSize="11"
        fontWeight={600}
      >
        kWh
      </text>

      <Tooltip t={hover} />
    </svg>
  );
}

// tiny helper to format ISO timestamp
function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || '—';
  }
}

function makeHistoryEntryFromSite(site) {
  const lf = site?.last_forecast;
  const ts = site?.last_forecast_at ?? new Date().toISOString();
  let pred = null;
  let baseline = null;

  if (Array.isArray(lf)) {
    pred = Number(lf[0]?.pred ?? lf[0]?.pred_kwh ?? 0);
  } else if (lf?.predictions && lf.predictions.length > 0) {
    pred = Number(lf.predictions[0].pred_kwh ?? lf.predictions[0].pred ?? 0);
    baseline = Number(lf.baseline ?? null);
  }

  baseline = baseline ?? Number(site?.last_forecast?.baseline ?? site?.baseline ?? null);
  const devPct = (baseline && pred !== null) ? ((pred - baseline) / baseline) * 100 : null;

  return {
    ts,
    pred: pred ?? null,
    baseline: baseline ?? null,
    devPct: devPct ?? null,
    raw: lf ?? null
  };
}

export default function DashboardPage() {
  const [sites, setSites] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [historyMap, setHistoryMap] = useState({});
  const [lastUpdateKey, setLastUpdateKey] = useState(0);

  const selectedRef = useRef(null);
  const sitesRef = useRef([]);
  const selectedPollRef = useRef(null);
  const listPollRef = useRef(null);

  const getId = s => (s?._id || s?.id || '').toString();

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { sitesRef.current = sites; }, [sites]);

  useEffect(() => {
    (async () => {
      try {
        const arr = Array.isArray(await getSites()) ? await getSites() : [];
        setSites(arr);
        if (!selectedRef.current && arr.length > 0) setSelected(arr[0]);
      } catch (e) {
        console.error('Initial loadSites error', e);
      }
    })();
  }, []);

  useEffect(() => {
    async function pollSelectedSite() {
      const cur = selectedRef.current;
      if (!cur || !getId(cur)) return;
      try {
        const fresh = await getSite(getId(cur));
        if (!fresh) return;

        const freshTs = fresh.last_forecast_at ?? fresh.lastForecastAt ?? null;
        const selectedTs = cur.last_forecast_at ?? cur.lastForecastAt ?? null;
        const changed = (!!freshTs && freshTs !== selectedTs) || (fresh.last_forecast && !cur.last_forecast);

        if (changed) {
          setSelected(fresh);
          setSites(prev => prev.map(s => (getId(s) === getId(fresh) ? fresh : s)));

          const entry = makeHistoryEntryFromSite(fresh);
          setHistoryMap(prev => {
            const curHist = prev[getId(fresh)] || [];
            if (curHist.length > 0 && curHist[0].ts === entry.ts) return prev;
            return { ...prev, [getId(fresh)]: [entry, ...curHist].slice(0, 50) };
          });

          setLastUpdateKey(Date.now());
        } else {
          setSelected(prev => ({ ...(prev || {}), ...(fresh || {}) }));
          setSites(prev => prev.map(s => (getId(s) === getId(fresh) ? ({ ...(s || {}), ...(fresh || {}) }) : s)));
        }
      } catch (e) {
        // ignore
      }
    }

    async function pollList() {
      try {
        const arr = Array.isArray(await getSites()) ? await getSites() : [];
        setSites(arr);

        const cur = selectedRef.current;
        if (cur) {
          const match = arr.find(s => getId(s) === getId(cur));
          if (match) setSelected(prev => ({ ...(prev || {}), ...(match || {}) }));
          else setSelected(arr.length > 0 ? arr[0] : null);
        } else {
          if (arr.length > 0) setSelected(arr[0]);
        }
      } catch (e) {
        console.error('pollList error', e);
      }
    }

    selectedPollRef.current = setInterval(pollSelectedSite, 15000);
    listPollRef.current = setInterval(pollList, 60000);

    pollSelectedSite().catch(() => {});

    return () => {
      if (selectedPollRef.current) clearInterval(selectedPollRef.current);
      if (listPollRef.current) clearInterval(listPollRef.current);
    };
  }, []);

  function handleSelectChange(e) {
    const id = e.target.value;
    const found = sitesRef.current.find(s => (s._id || s.id) === id) || null;
    setSelected(found);

    (async () => {
      if (!found) return;
      try {
        const fresh = await getSite(getId(found));
        if (fresh) {
          setSelected(fresh);
          setSites(prev => prev.map(s => (getId(s) === getId(fresh) ? fresh : s)));

          if (fresh.last_forecast) {
            const entry = makeHistoryEntryFromSite(fresh);
            setHistoryMap(prev => {
              const curHist = prev[getId(fresh)] || [];
              if (curHist.length > 0 && curHist[0].ts === entry.ts) return prev;
              return { ...prev, [getId(fresh)]: [entry, ...curHist].slice(0, 50) };
            });
          }
        }
      } catch (e) {}
    })();
  }

  async function onRunForecast() {
    const cur = selectedRef.current || selected;
    if (!cur || !getId(cur)) {
      alert('Select a site to run forecast.');
      return;
    }

    setLoadingForecast(true);
    try {
      const res = await triggerForecast(getId(cur));

      if (res && res.site) {
        const fresh = res.site;
        setSelected(fresh);
        setSites(prev => prev.map(s => (getId(s) === getId(fresh) ? fresh : s)));

        const entry = makeHistoryEntryFromSite(fresh);
        setHistoryMap(prev => {
          const curHist = prev[getId(fresh)] || [];
          if (curHist.length > 0 && curHist[0].ts === entry.ts) return prev;
          return { ...prev, [getId(fresh)]: [entry, ...curHist].slice(0, 50) };
        });

        setLastUpdateKey(Date.now());
      } else if (res && res.forecast) {
        const updated = { ...(cur || {}), last_forecast: res.forecast, last_forecast_at: new Date().toISOString() };
        setSelected(updated);
        setSites(prev => prev.map(s => (getId(s) === getId(updated) ? updated : s)));

        const entry = makeHistoryEntryFromSite(updated);
        setHistoryMap(prev => {
          const curHist = prev[getId(updated)] || [];
          if (curHist.length > 0 && curHist[0].ts === entry.ts) return prev;
          return { ...prev, [getId(updated)]: [entry, ...curHist].slice(0, 50) };
        });

        setLastUpdateKey(Date.now());
      } else {
        const arr = Array.isArray(await getSites()) ? await getSites() : [];
        setSites(arr);
      }

      alert('Forecast run complete — dashboard updated.');
    } catch (err) {
      console.error('Run forecast failed', err);
      alert('Forecast failed: ' + (err?.message || JSON.stringify(err)));
    } finally {
      setLoadingForecast(false);
    }
  }

  const series = useMemo(() => {
    if (!selected) return [];

    const extractSeries = (forecastData) => {
      if (!forecastData) return null;
      if (Array.isArray(forecastData)) {
        return forecastData.map(p => ({ date: p.date || p.day || p.timestamp, pred: Number(p.pred || p.pred_kwh || p.prediction || 0) }));
      }
      if (forecastData.predictions && Array.isArray(forecastData.predictions)) {
        return forecastData.predictions.map(p => ({ date: p.date || p.day || p.timestamp, pred: Number(p.pred_kwh ?? p.pred ?? p.prediction ?? 0) }));
      }
      if (forecastData.forecast) return extractSeries(forecastData.forecast);
      if (forecastData.pred || forecastData.pred_kwh || forecastData.prediction) {
        return [{ date: forecastData.date || forecastData.day || forecastData.timestamp || 'N/A', pred: Number(forecastData.pred || forecastData.pred_kwh || forecastData.prediction || 0) }];
      }
      return null;
    };

    const lf = selected.last_forecast || selected.forecast;
    const extracted = extractSeries(lf);
    if (extracted && extracted.length > 0) return extracted;

    const sid = getId(selected);
    const hist = sid ? (historyMap[sid] || []) : [];
    if (hist.length > 0) {
      const latest = hist[0];
      const histExtracted = extractSeries(latest.raw);
      if (histExtracted && histExtracted.length > 0) return histExtracted;
      if (latest.pred !== null && latest.pred !== undefined) return [{ date: fmt(latest.ts), pred: Number(latest.pred) }];
    }

    return [];
  }, [selected, lastUpdateKey, historyMap]);

  const metric = useMemo(() => {
    if (!series || series.length === 0) return { pred: 0, baseline: 0, devPct: 0 };
    const pred = Number(series[0].pred || 0);
    const baseline = Number(selected?.last_forecast?.baseline ?? selected?.baseline ?? 0);
    const devPct = baseline ? ((pred - baseline) / baseline) * 100 : 0;
    return { pred, baseline, devPct };
  }, [series, selected, lastUpdateKey]);

  const selectedHistory = (selected && historyMap[getId(selected)]) || [];

  return (
    <div className="min-h-screen bg-slate-900 p-8 font-sans text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between"> 
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Solar Energy Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">Last refresh</div>
            <div className="text-sm font-medium text-slate-200">{new Date(lastUpdateKey || Date.now()).toLocaleString()}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-300 mb-2">Select Site</label>
              <div className="flex gap-3">
                <select
                  className="flex-1 bg-transparent text-slate-100 border border-slate-700 rounded-xl p-3 focus:ring-0 transition-all"
                  value={selected ? getId(selected) : ''}
                  onChange={handleSelectChange}
                >
                  <option value="">-- Select a solar site --</option>
                  {sites.map(s => (
                    <option key={getId(s)} value={getId(s)}>{s.name || `${s.latitude}°, ${s.longitude}°`}</option>
                  ))}
                </select>

                <button
                  className="bg-slate-700 px-5 py-3 rounded-xl font-semibold shadow-sm hover:bg-slate-600 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={onRunForecast}
                  disabled={loadingForecast}
                >
                  {loadingForecast ? 'Running…' : 'Run Forecast'}
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto flex items-center gap-4">
              <div className="text-sm text-slate-400">Manage sites</div>
              <button
                className="bg-slate-700 hover:bg-slate-6'00 px-4 py-2 rounded-lg text-sm text-slate-200"
                onClick={() => window.location.href = '/sites'}
              >
                Sites
              </button>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-400">Predicted Output</div>
              <div className="text-xl">Output</div>
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-white">{metric.pred.toFixed(2)}</div>
            <div className="text-sm text-slate-400 mt-1">kWh (Next Day)</div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-400">Baseline Average</div>
              <div className="text-xl">Baseline</div>
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-white">{metric.baseline.toFixed(2)}</div>
            <div className="text-sm text-slate-400 mt-1">kWh (7-day avg)</div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-sm ${Math.abs(metric.devPct) >= (selected?.alert_threshold_pct ?? 30) ? 'border-red-600' : 'border-emerald-500'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-400">Deviation</div>
              <div className="text-xl">Status</div>
            </div>
            <div className={`text-3xl md:text-4xl font-extrabold mb-1 ${Math.abs(metric.devPct) >= (selected?.alert_threshold_pct ?? 30) ? 'text-red-400' : 'text-green-300'}`}>
              {metric.devPct >= 0 ? '+' : ''}{metric.devPct.toFixed(1)}%
            </div>
            <div className="text-sm text-slate-400">Threshold: ±{selected?.alert_threshold_pct ?? 30}%</div>
          </div>
        </div>

        {/* Forecast Chart */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-700">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">7-Day Forecast</h2>
              <p className="text-slate-400">Predicted solar production for the upcoming week</p>
            </div>
            <div className="text-sm text-slate-400">Data source: model • {selected?.name || '—'}</div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4">
            <ForecastChart data={series} />
          </div>

          {series.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mt-4">
              {series.map((r, i) => {
                const baseline = metric.baseline || 0;
                const diff = baseline > 0 ? ((Number(r.pred) - baseline) / baseline * 100) : 0;
                const date = new Date(r.date);
                return (
                  <div key={i} className="p-3 rounded-lg bg-slate-800 border border-slate-700 hover:shadow-sm transition-transform">
                    <div className="text-xs text-slate-400 font-semibold">{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-sm text-slate-500">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div className="text-lg font-bold text-slate-100 mt-2">{Number(r.pred).toFixed(2)}</div>
                    <div className="text-xs text-slate-400">kWh</div>
                    <div className={`text-xs font-semibold mt-2 ${diff >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{diff >= 0 ? 'Up' : 'Down'} {Math.abs(diff).toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Site Details */}
        {selected && (
          <div className="bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">Site Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-36">Site Name:</span>
                  <span className="text-white font-medium">{selected.name || '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-36">Location:</span>
                  <span className="text-white font-medium">{selected.latitude}°, {selected.longitude}°</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-36">Panel Area:</span>
                  <span className="text-white font-medium">{selected.panel_area_m2 ?? selected.area ?? '—'} m²</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-36">Efficiency:</span>
                  <span className="text-white font-medium">{selected.efficiency ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm w-36">Last Forecast:</span>
                  <span className="text-white font-medium">{selected.last_forecast_at ? new Date(selected.last_forecast_at).toLocaleString() : 'Never'}</span>
                </div>

                <div className="pt-2">
                  <button className="px-4 py-2 rounded-lg bg-slate-700 font-semibold shadow-sm" onClick={() => window.location.href = '/sites'}>Manage Sites</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
