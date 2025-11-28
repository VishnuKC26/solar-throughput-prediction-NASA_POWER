// sample data used to render the dashboard while you wire the backend
export const siteSample = {
  id: 'site-1',
  name: 'Rooftop PV — Building A',
  latitude: 28.6139,
  longitude: 77.2090,
  panel_area_m2: 12,
  efficiency: 0.18,
  summary: {
    avg_kwh: 24.6,
    peak_kwh: 30.2,
    best_day: '2025-11-10',
    pr: 0.78
  },
  // 7-day forecast (kWh)
  forecast: [
    { day: '2025-11-09', pred: 22.5 },
    { day: '2025-11-10', pred: 30.2 },
    { day: '2025-11-11', pred: 28.1 },
    { day: '2025-11-12', pred: 25.0 },
    { day: '2025-11-13', pred: 20.4 },
    { day: '2025-11-14', pred: 18.9 },
    { day: '2025-11-15', pred: 21.6 }
  ],
  alerts: [
    { id: 'a1', type: 'low', title: '3-day low production streak predicted', details: 'Days 11–13 show 30% below baseline', date: '2025-11-09' },
    { id: 'a2', type: 'opportunity', title: 'Good production predicted', details: 'Nov 10 expected to be best in week', date: '2025-11-09' }
  ]
};
