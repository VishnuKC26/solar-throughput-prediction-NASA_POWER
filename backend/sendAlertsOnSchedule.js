// backend/sendAlertsOnSchedule.js
const { spawn } = require('child_process');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const { sendForecastEmail } = require('./mail/mailer_gmail_app'); // existing mailer
const Site = require('./models/Site'); // your Site model file

// Paths adjusted to your repo layout (backend is sibling to ml/)
const PREDICT_SCRIPT = path.resolve(__dirname, '..', 'ml', 'predict.py');
const DEFAULT_MODEL = path.resolve(__dirname, '..', 'ml', 'xgb_model_h1.joblib');

const DAYS = Number(process.env.FORECAST_DAYS || 7);
const MIN_INTERVAL_BETWEEN_ALERTS_MS = Number(process.env.MIN_ALERT_INTERVAL_MS || (1000 * 60 * 60)); // 1 hour
const SITE_DELAY_MS = Number(process.env.SITE_DELAY_MS || 1000); // delay between site processing

function runPredictor({ lat, lon, area = 1.0, eff = 0.18, model = DEFAULT_MODEL, days = DAYS }) {
  return new Promise((resolve, reject) => {
    const args = [
      PREDICT_SCRIPT,
      '--lat', String(lat),
      '--lon', String(lon),
      '--area', String(area),
      '--eff', String(eff),
      '--model', String(model),
      '--days', String(days)
    ];

    const py = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    py.stdout.on('data', c => stdout += c.toString());
    py.stderr.on('data', c => stderr += c.toString());

    py.on('close', code => {
      if (code !== 0) {
        try {
          const maybe = JSON.parse(stdout);
          return reject(new Error(maybe.error || `predictor failed (exit ${code})`));
        } catch (e) {
          return reject(new Error(`Predictor crashed. stderr: ${stderr || stdout}`));
        }
      }
      try {
        const out = JSON.parse(stdout);
        return resolve(out);
      } catch (e) {
        return reject(new Error('Predictor returned invalid JSON'));
      }
    });

    py.on('error', err => reject(err));
  });
}

function computeDeviationPct(forecast) {
  if (!forecast || !Array.isArray(forecast.predictions) || forecast.predictions.length === 0) return null;
  const first = Number(forecast.predictions[0].pred_kwh ?? forecast.predictions[0].pred ?? 0);
  const baseline = Number(forecast.baseline ?? 0);
  if (!baseline || baseline === 0) return null;
  return ((first - baseline) / baseline) * 100;
}

function shouldSendAlert(site, forecast) {
  if (!site) return false;
  if (!site.alerts_enabled) return false;
  const recipients = (site.alert_recipients || []).filter(Boolean);
  if (!recipients || recipients.length === 0) return false;

  if (site.last_alert_sent_at) {
    const elapsed = Date.now() - new Date(site.last_alert_sent_at).getTime();
    if (elapsed < (site.min_alert_interval_ms || MIN_INTERVAL_BETWEEN_ALERTS_MS)) {
      return false;
    }
  }

  if (site.alerts_always_send) return true;

  const dev = computeDeviationPct(forecast);
  if (dev === null || dev === undefined) return false;

  const threshold = Number(site.alert_threshold_pct ?? 30);
  if (Math.abs(dev) >= threshold) return true;

  return false;
}

async function processSite(site) {
  try {
    const lat = site.latitude ?? site.lat;
    const lon = site.longitude ?? site.lon;
    const area = site.panel_area_m2 ?? site.area ?? 1.0;
    const eff = site.efficiency ?? site.eff ?? 0.18;

    const forecast = await runPredictor({ lat, lon, area, eff });

    const willSend = shouldSendAlert(site, forecast);

    // Always persist the latest forecast (useful for UI/history)
    site.last_forecast = forecast;
    site.last_forecast_at = new Date().toISOString();

    if (willSend) {
      const recipients = (site.alert_recipients || []).map(String).filter(Boolean);
      const subject = `Solar forecast alert — ${site.name || site._id}`;
      const extraText = `Forecast generated on ${new Date().toLocaleString()}. Deviation threshold: ${site.alert_threshold_pct ?? 30}%`;

      await sendForecastEmail({
        to: recipients,
        subject,
        forecast,
        siteName: site.name || `Site ${site._id}`,
        extraText
      });

      site.last_alert_sent_at = new Date().toISOString();
      await site.save();

      return { siteId: site._id, emailed: true };
    } else {
      await site.save();
      return { siteId: site._id, emailed: false, reason: 'threshold not exceeded or recipients missing' };
    }
  } catch (err) {
    console.error(`processSite error for ${site._id}:`, err && err.message ? err.message : err);
    return { siteId: site._id, error: err.message || String(err) };
  }
}

async function runOnce() {
  console.log('Scheduler run started at', new Date().toISOString());
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  }

  // Only process sites that have alerts_enabled true to reduce load
  const sites = await Site.find({ alerts_enabled: true }).exec();
  const results = [];
  for (const s of sites) {
    const r = await processSite(s);
    results.push(r);
    await new Promise(r => setTimeout(r, SITE_DELAY_MS));
  }

  console.log('Scheduler run completed at', new Date().toISOString(), 'results:', results);
  return results;
}

if (require.main === module) {
  const CronJob = require('cron').CronJob; // npm i cron
  const cronExpr = process.env.SCHEDULE_CRON || '5 * * * *'; // default hourly at minute 5
  const tz = process.env.TZ || 'UTC';
  console.log('Starting scheduler (cron:', cronExpr, 'tz:', tz, ')');

  const job = new CronJob(cronExpr, async () => {
    try {
      await runOnce();
    } catch (e) {
      console.error('Scheduled run error', e);
    }
  }, null, true, tz);
}

module.exports = { runOnce };
