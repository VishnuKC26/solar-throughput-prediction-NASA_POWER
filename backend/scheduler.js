// // backend/scheduler.js
// const cron = require('node-cron');
// const Site = require('./models/Site');
// const { execFile } = require('child_process');
// const path = require('path');

// // NOTE: scheduler.js lives in backend/, mailer is at backend/mail/mailer_gmail_app.js
// const { sendForecastEmail } = require('./mail/mailer_gmail_app');

// const python = process.env.PYTHON_CMD || 'python';
// const script = process.env.ML_SCRIPT || path.join(__dirname, 'ml_runner.py'); // set ML_SCRIPT if your script is elsewhere
// const ML_MAX_BUFFER = Number(process.env.ML_MAX_BUFFER_BYTES) || 5 * 1024 * 1024; // 5MB

// function runMlForSite(site) {
//   return new Promise((resolve, reject) => {
//     const args = [
//       script,
//       '--lat', String(site.latitude ?? site.lat ?? ''),
//       '--lon', String(site.longitude ?? site.lon ?? ''),
//       '--area', String(site.panel_area_m2 ?? site.area_m2 ?? site.area ?? 1),
//       '--eff', String(site.efficiency ?? site.eff ?? 0.18)
//     ];

//     execFile(python, args, { maxBuffer: ML_MAX_BUFFER }, (err, stdout, stderr) => {
//       if (err) {
//         console.error('Scheduler ML runner error for site', site._id?.toString?.() || site._id, err);
//         if (stderr) console.error('ml stderr:', stderr.toString());
//         return reject(err);
//       }
//       if (!stdout) {
//         const msg = 'No stdout from ML script';
//         console.error(msg, 'for site', site._id);
//         return reject(new Error(msg));
//       }
//       try {
//         const json = JSON.parse(stdout);
//         resolve(json);
//       } catch (e) {
//         console.error('Scheduler ML parse error for site', site._id, e);
//         console.error('stdout was:', stdout);
//         reject(e);
//       }
//     });
//   });
// }

// async function shouldSendAlert(site, devPct) {
//   // must have alerts enabled
//   if (!site.alerts_enabled && !site.alerts_always_send) {
//     return { send: false, reason: 'alerts not enabled' };
//   }

//   // recipients required
//   const recipients = Array.isArray(site.alert_recipients) ? site.alert_recipients.map(s => String(s).trim()).filter(Boolean) : [];
//   // fallback to legacy user_email only if recipients is empty
//   if (recipients.length === 0 && site.user_email) recipients.push(String(site.user_email).trim());

//   if (recipients.length === 0) {
//     return { send: false, reason: 'no recipients' };
//   }

//   // rate limit check
//   const minInterval = Number(site.min_alert_interval_ms ?? site.minAlertIntervalMs ?? process.env.DEFAULT_MIN_ALERT_INTERVAL_MS ?? 3600000);
//   if (site.last_alert_sent_at) {
//     const last = new Date(site.last_alert_sent_at).getTime();
//     const now = Date.now();
//     if ((now - last) < minInterval) {
//       return { send: false, reason: 'rate_limited' };
//     }
//   }

//   // threshold check (unless forced)
//   const threshold = Number(site.alert_threshold_pct ?? process.env.DEFAULT_DEVIATION_THRESHOLD ?? 30);
//   if (!site.alerts_always_send && (typeof devPct !== 'number' || Math.abs(devPct) < threshold)) {
//     return { send: false, reason: 'threshold_not_exceeded', threshold };
//   }

//   return { send: true, recipients };
// }

// async function evaluateAndAlert(site, out) {
//   try {
//     const pred = out?.predictions?.[0]?.pred_kwh ?? out?.predictions?.[0]?.pred ?? null;
//     const baseline = out?.baseline ?? null;
//     if (pred === null || baseline === null) {
//       return { emailed: false, reason: 'predictor_missing_values' };
//     }

//     const dev = ((pred - baseline) / (baseline || 1)) * 100;

//     const check = await shouldSendAlert(site, dev);
//     if (!check.send) {
//       return { emailed: false, reason: check.reason, extra: check.threshold ?? null };
//     }

//     // Build subject/html using the sendForecastEmail contract
//     const siteName = site.name || 'Site';
//     const subject = `SolarHQ alert — ${siteName} ${dev.toFixed(1)}% deviation`;
//     const extraText = `Forecast generated on ${new Date().toLocaleString()}`;
//     const forecast = out;

//     // sendForecastEmail expects { recipients: [], subject, forecast, siteName, extraText, unsubscribeUrl }
//     try {
//       const sendResult = await sendForecastEmail({
//         recipients: check.recipients,
//         subject,
//         forecast,
//         siteName,
//         extraText,
//         unsubscribeUrl: process.env.UNSUBSCRIBE_BASE_URL ? `${process.env.UNSUBSCRIBE_BASE_URL}?site=${site._id}` : null
//       });

//       // on success, record alert in site.alerts and update last_alert_sent_at
//       const now = new Date();
//       site.alerts = site.alerts || [];
//       site.alerts.push({
//         date: now,
//         type: 'deviation',
//         message: `Sent alert: ${dev.toFixed(1)}% deviation`,
//         sent: true
//       });
//       site.last_alert_sent_at = now;
//       await site.save();

//       return { emailed: true, recipients: check.recipients, sendResult };
//     } catch (e) {
//       console.error('Scheduler: failed to send email for site', site._id, e);
//       // record failed alert
//       site.alerts = site.alerts || [];
//       site.alerts.push({
//         date: new Date(),
//         type: 'deviation',
//         message: `Send failed: ${String(e && (e.message || e))}`,
//         sent: false
//       });
//       await site.save();
//       return { emailed: false, reason: 'send_error', error: e && e.message ? e.message : String(e) };
//     }
//   } catch (e) {
//     console.error('evaluateAndAlert internal error for site', site._id, e);
//     return { emailed: false, reason: 'internal_error', error: e && e.message ? e.message : String(e) };
//   }
// }

// module.exports = {
//   start() {
//     // TESTING MODE: run every 30 seconds (change cron to production schedule when ready)
//     cron.schedule('*/30 * * * * *', async () => {
//       console.log('Scheduler: running forecasts (TESTING - every 30s)');
//       try {
//         // find all enabled sites and populate the userId if needed
//         const sites = await Site.find({ enabled: { $ne: false } }).populate('userId');
//         for (const site of sites) {
//           try {
//             // Skip demo/sample entries if any (optional)
//             if (site._id && String(site._id).startsWith('site-')) {
//               console.log('Scheduler: skipping demo site', site._id);
//               continue;
//             }

//             const out = await runMlForSite(site);

//             // persist last_forecast and timestamp
//             site.last_forecast = out;
//             site.last_forecast_at = new Date();
//             await site.save();

//             // evaluate and possibly send email alert
//             const res = await evaluateAndAlert(site, out);
//             console.log('Scheduler: site', site._id.toString(), 'alert result =>', res);
//           } catch (e) {
//             console.error('Scheduler failure for site', site._id, e);
//           }
//         }
//         console.log('Scheduler finished');
//       } catch (e) {
//         console.error('Scheduler main error', e);
//       }
//     }, { timezone: process.env.SCHED_TZ || 'UTC' });

//     console.log('Scheduler started (TESTING MODE - every 30 seconds)');
//   },

//   // helper to run once for manual testing
//   async runOnce() {
//     const sites = await Site.find({ enabled: { $ne: false } }).populate('userId');
//     const results = [];
//     for (const site of sites) {
//       try {
//         const out = await runMlForSite(site);
//         site.last_forecast = out;
//         site.last_forecast_at = new Date();
//         await site.save();
//         const res = await evaluateAndAlert(site, out);
//         results.push({ siteId: site._id.toString(), result: res });
//       } catch (e) {
//         results.push({ siteId: site._id ? site._id.toString() : null, error: e && e.message ? e.message : String(e) });
//       }
//     }
//     return results;
//   }
// };
// backend/scheduler.js
const cron = require('node-cron');
const Site = require('./models/Site');
const { execFile } = require('child_process');
const path = require('path');

// NOTE: scheduler.js lives in backend/, mailer is at backend/mail/mailer_gmail_app.js
// require both forecast and alert senders (sendAlertEmail is the new additive API)
const { sendForecastEmail, sendAlertEmail } = require('./mail/mailer_gmail_app');

const python = process.env.PYTHON_CMD || 'python';
const script = process.env.ML_SCRIPT || path.join(__dirname, 'ml_runner.py'); // set ML_SCRIPT if your script is elsewhere
const ML_MAX_BUFFER = Number(process.env.ML_MAX_BUFFER_BYTES) || 5 * 1024 * 1024; // 5MB

function runMlForSite(site) {
  return new Promise((resolve, reject) => {
    const args = [
      script,
      '--lat', String(site.latitude ?? site.lat ?? ''),
      '--lon', String(site.longitude ?? site.lon ?? ''),
      '--area', String(site.panel_area_m2 ?? site.area_m2 ?? site.area ?? 1),
      '--eff', String(site.efficiency ?? site.eff ?? 0.18)
    ];

    execFile(python, args, { maxBuffer: ML_MAX_BUFFER }, (err, stdout, stderr) => {
      if (err) {
        console.error('Scheduler ML runner error for site', site._id?.toString?.() || site._id, err);
        if (stderr) console.error('ml stderr:', stderr.toString());
        return reject(err);
      }
      if (!stdout) {
        const msg = 'No stdout from ML script';
        console.error(msg, 'for site', site._id);
        return reject(new Error(msg));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (e) {
        console.error('Scheduler ML parse error for site', site._id, e);
        console.error('stdout was:', stdout);
        reject(e);
      }
    });
  });
}

/**
 * Helpers for alert email content and severity
 */
function getDeviationInfoFromPercent(pct) {
  // pct is absolute percent (positive number). Map to severity.
  const p = Math.abs(Number(pct) || 0);
  let severity = 'info';
  if (p > 100) severity = 'critical';
  else if (p > 70) severity = 'severe';
  else if (p > 30) severity = 'moderate';
  else if (p > 10) severity = 'minor';
  return { percentError: p, severity };
}

function getRecommendations(severity) {
  return {
    info: [
      'Observed small variance in output — no immediate action required.',
      'Continue monitoring generation for the next reporting interval.'
    ],
    minor: [
      'Observed a modest drop in solar output. Verify short-term causes (temporary cloud cover, passing shading).',
      'Confirm telemetry timestamps and sensor readings to rule out data alignment issues.',
      'Prepare backup supply plan: notify operations to have on-call backup resources on standby (generator or grid-transfer ready).'
    ],
    moderate: [
      'Significant drop in solar output detected. Check inverter status and string-level outputs immediately.',
      'Inspect weather feed and recent maintenance logs for causes (soiling, shading, or partial array issues).',
      'Initiate backup power readiness: notify operations to start pre-loading backup generators or request grid-import permission.'
    ],
    severe: [
      'Large and sustained reduction in generation — treat as high priority.',
      'Check inverter alarms, DC-string current measurements and combiner status immediately.',
      'Deploy backup resources now: start standby generators or switch to alternative supply to avoid load shedding.',
      'If automatic transfer is enabled, verify transfer succeeded; if not, execute manual transfer procedures.'
    ],
    critical: [
      'Critical generation loss detected (>100% deviation or near-zero output). Immediate action required.',
      'Isolate the issue and ensure safety procedures are followed for electrical equipment.',
      'Activate emergency backup power immediately (generators / utility grid transfer) to maintain supply.',
      'Escalate to engineering and operations teams now — coordinate field dispatch and confirm backup stabilization before resuming automated operations.'
    ]
  }[severity || 'info'];
}

function buildFormattedEmail({ severity, siteName, predicted, actual, percentError, timestamp, message, recommendations }) {
  const accent = {
    info: '#0b6efd',
    minor: '#f59e0b',
    moderate: '#f97316',
    severe: '#ef4444',
    critical: '#b91c1c'
  }[severity] || '#0b6efd';

  const sevLabel = (severity || 'info').toUpperCase();
  const deviation = percentError != null ? Number(percentError).toFixed(1) + '%' : '—';
  const predictedVal = predicted != null ? String(predicted) + ' kW' : '—';
  const actualVal = actual != null ? String(actual) + ' kW' : '—';
  const timeVal = timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString();

  // professional, link-free HTML (no dashboard link)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; background:#f4f6f8; color:#222; }
  .wrapper { max-width:640px; margin:24px auto; background:#fff; border-radius:10px; padding:24px; box-shadow:0 6px 20px rgba(0,0,0,0.06); }
  .header { border-left:6px solid ${accent}; padding-left:16px; margin-bottom:18px; }
  .title { font-size:20px; font-weight:700; color:${accent}; }
  .subtitle { font-size:13px; color:#555; margin-top:6px; }
  .section { margin-top:16px; }
  .grid { display:flex; gap:12px; flex-wrap:wrap; }
  .card { flex:1 1 45%; background:#f9fbfc; border:1px solid #e7eef6; padding:12px; border-radius:8px; }
  .label { font-size:12px; color:#777; margin-bottom:6px; }
  .value { font-weight:700; font-size:16px; color:#111; }
  .recs { margin-top:12px; font-size:14px; color:#222; }
  .backup { margin-top:14px; padding:12px; background:#fff6f6; border:1px solid #ffe8e8; color:#8b1c1c; border-radius:8px; font-weight:700; }
  @media (max-width:520px) { .card { flex:1 1 100%; } }
</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="title">${sevLabel} ALERT — ${siteName || 'Solar Site'}</div>
      <div class="subtitle">Forecast anomaly detected • ${timeVal}</div>
    </div>

    <div class="section">
      <div style="font-size:14px;color:#333;">${message || 'A forecast deviation has been detected for this site.'}</div>
    </div>

    <div class="section">
      <div class="grid" role="group" aria-label="Forecast details">
        <div class="card"><div class="label">Predicted</div><div class="value">${predictedVal}</div></div>
        <div class="card"><div class="label">Actual</div><div class="value">${actualVal}</div></div>
        <div class="card"><div class="label">Deviation</div><div class="value" style="color:${accent}">${deviation}</div></div>
        <div class="card"><div class="label">Timestamp</div><div class="value">${timeVal}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title" style="font-weight:700;margin-bottom:8px;">Recommended actions (generation & backup)</div>
      <div class="recs"><ul style="margin:0 0 0 16px; padding:0;">${(recommendations || []).map(r => `<li style="margin-bottom:8px">${r}</li>`).join('')}</ul></div>
    </div>

    ${['moderate','severe','critical'].includes((severity||'').toLowerCase()) ? `<div class="backup">Due to the observed reduction in solar output, please <strong>prepare or activate backup power resources</strong> (generators, grid-import, battery dispatch) immediately as appropriate for this site. Confirm load transfer and stabilization before resuming automated operations.</div>` : ''}

  </div>
</body>
</html>`;
}

/**
 * decide if alert should be sent for a site given deviation percent (absolute)
 */
async function shouldSendAlert(site, devPct) {
  // must have alerts enabled
  if (!site.alerts_enabled && !site.alerts_always_send) {
    return { send: false, reason: 'alerts not enabled' };
  }

  // recipients required
  const recipients = Array.isArray(site.alert_recipients) ? site.alert_recipients.map(s => String(s).trim()).filter(Boolean) : [];
  // fallback to legacy user_email only if recipients is empty
  if (recipients.length === 0 && site.user_email) recipients.push(String(site.user_email).trim());

  if (recipients.length === 0) {
    return { send: false, reason: 'no recipients' };
  }

  // rate limit check
  const minInterval = Number(site.min_alert_interval_ms ?? site.minAlertIntervalMs ?? process.env.DEFAULT_MIN_ALERT_INTERVAL_MS ?? 3600000);
  if (site.last_alert_sent_at) {
    const last = new Date(site.last_alert_sent_at).getTime();
    const now = Date.now();
    if ((now - last) < minInterval) {
      return { send: false, reason: 'rate_limited' };
    }
  }

  // threshold check (unless forced)
  const threshold = Number(site.alert_threshold_pct ?? process.env.DEFAULT_DEVIATION_THRESHOLD ?? 30);
  if (!site.alerts_always_send && (typeof devPct !== 'number' || Math.abs(devPct) < threshold)) {
    return { send: false, reason: 'threshold_not_exceeded', threshold };
  }

  return { send: true, recipients };
}

async function evaluateAndAlert(site, out) {
  try {
    const pred = out?.predictions?.[0]?.pred_kwh ?? out?.predictions?.[0]?.pred ?? null;
    const baseline = out?.baseline ?? null;
    if (pred === null || baseline === null) {
      return { emailed: false, reason: 'predictor_missing_values' };
    }

    // deviation: (pred - baseline)/baseline * 100
    const dev = ((pred - baseline) / (baseline || 1)) * 100;
    const devAbs = Math.abs(dev);

    const check = await shouldSendAlert(site, devAbs);
    if (!check.send) {
      return { emailed: false, reason: check.reason, extra: check.threshold ?? null };
    }

    // Build alert HTML (no links) and send using sendAlertEmail
    const siteName = site.name || 'Site';
    const devInfo = getDeviationInfoFromPercent(devAbs);
    const severity = devInfo.severity;
    const recs = getRecommendations(severity);

    // message summarizing change - contextual
    const direction = dev < 0 ? 'decrease' : 'increase';
    const message = `Forecast shows a ${devAbs.toFixed(1)}% ${direction} in expected generation compared to baseline. Predicted: ${pred} kW; Baseline: ${baseline} kW.`;

    const html = buildFormattedEmail({
      severity,
      siteName,
      predicted: pred,
      actual: null,
      percentError: devAbs,
      timestamp: out?.generated_at || out?.timestamp || new Date(),
      message,
      recommendations: recs
    });

    const subject = `${severity.toUpperCase()} ALERT — ${siteName} — ${devAbs.toFixed(1)}% deviation`;

    try {
      await sendAlertEmail({ recipients: check.recipients, subject, html });
      // on success, record alert in site.alerts and update last_alert_sent_at
      const now = new Date();
      site.alerts = site.alerts || [];
      site.alerts.push({
        date: now,
        type: 'deviation',
        message: `Sent alert: ${devAbs.toFixed(1)}% deviation`,
        sent: true
      });
      site.last_alert_sent_at = now;
      await site.save();

      return { emailed: true, recipients: check.recipients };
    } catch (e) {
      console.error('Scheduler: failed to send alert email for site', site._id, e);
      // record failed alert
      site.alerts = site.alerts || [];
      site.alerts.push({
        date: new Date(),
        type: 'deviation',
        message: `Send failed: ${String(e && (e.message || e))}`,
        sent: false
      });
      await site.save();
      return { emailed: false, reason: 'send_error', error: e && e.message ? e.message : String(e) };
    }
  } catch (e) {
    console.error('evaluateAndAlert internal error for site', site._id, e);
    return { emailed: false, reason: 'internal_error', error: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  start() {
    // TESTING MODE: run every 30 seconds (change cron to production schedule when ready)
    cron.schedule('*/30 * * * * *', async () => {
      console.log('Scheduler: running forecasts (TESTING - every 30s)');
      try {
        // find all enabled sites and populate the userId if needed
        const sites = await Site.find({ enabled: { $ne: false } }).populate('userId');
        for (const site of sites) {
          try {
            // Skip demo/sample entries if any (optional)
            if (site._id && String(site._id).startsWith('site-')) {
              console.log('Scheduler: skipping demo site', site._id);
              continue;
            }

            const out = await runMlForSite(site);

            // persist last_forecast and timestamp
            site.last_forecast = out;
            site.last_forecast_at = new Date();
            await site.save();

            // evaluate and possibly send email alert
            const res = await evaluateAndAlert(site, out);
            console.log('Scheduler: site', site._id.toString(), 'alert result =>', res);
          } catch (e) {
            console.error('Scheduler failure for site', site._id, e);
          }
        }
        console.log('Scheduler finished');
      } catch (e) {
        console.error('Scheduler main error', e);
      }
    }, { timezone: process.env.SCHED_TZ || 'UTC' });

    console.log('Scheduler started (TESTING MODE - every 30 seconds)');
  },

  // helper to run once for manual testing
  async runOnce() {
    const sites = await Site.find({ enabled: { $ne: false } }).populate('userId');
    const results = [];
    for (const site of sites) {
      try {
        const out = await runMlForSite(site);
        site.last_forecast = out;
        site.last_forecast_at = new Date();
        await site.save();
        const res = await evaluateAndAlert(site, out);
        results.push({ siteId: site._id.toString(), result: res });
      } catch (e) {
        results.push({ siteId: site._id ? site._id.toString() : null, error: e && e.message ? e.message : String(e) });
      }
    }
    return results;
  }
};
