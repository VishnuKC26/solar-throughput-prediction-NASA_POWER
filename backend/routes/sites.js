// backend/routes/sites.js
const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const auth = require('../middleware/auth');
const { spawnSync } = require('child_process');
const path = require('path');

router.use(auth);

function normalizeRecipients(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  return [String(input).trim()].filter(Boolean);
}

function isValidEmail(e) {
  if (!e || typeof e !== 'string') return false;
  // simple email check
  return /\S+@\S+\.\S+/.test(e.trim());
}

function sanitizeRecipients(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map(a => (typeof a === 'string' ? a.trim() : ''))
    .filter(a => a.length > 0 && isValidEmail(a));
}

// create site
router.post('/', async (req, res) => {
  try {
    // whitelist of allowed fields from the client
    const {
      name,
      latitude,
      longitude,
      panel_area_m2,
      area,
      efficiency,
      model_path,
      alert_recipients,
      alerts_enabled,
      alerts_always_send,
      alert_threshold_pct
    } = req.body;

    // sanity checks
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const payload = {
      userId: req.userId,
      name: name || 'My site',
      latitude: Number(latitude),
      longitude: Number(longitude),
      panel_area_m2: typeof panel_area_m2 !== 'undefined' ? Number(panel_area_m2) : (typeof area !== 'undefined' ? Number(area) : 1.0),
      efficiency: typeof efficiency !== 'undefined' ? Number(efficiency) : 0.18,
      model_path: model_path || null
    };

    // alert fields (optional)
    const recs = normalizeRecipients(alert_recipients);
    const valid = sanitizeRecipients(recs);
    if (valid.length > 0) payload.alert_recipients = valid;
    if (typeof alerts_enabled !== 'undefined') payload.alerts_enabled = !!alerts_enabled;
    if (typeof alerts_always_send !== 'undefined') payload.alerts_always_send = !!alerts_always_send;
    if (typeof alert_threshold_pct !== 'undefined') payload.alert_threshold_pct = Number(alert_threshold_pct);

    const site = new Site(payload);
    await site.save();
    res.json(site);
  } catch (err) {
    console.error('POST /api/sites error', err);
    res.status(500).json({ error: err.message });
  }
});

// list user sites
router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ userId: req.userId }).lean();
    res.json(sites);
  } catch (err) {
    console.error('GET /api/sites error', err);
    res.status(500).json({ error: err.message });
  }
});

// get single site (important for Dashboard polling)
router.get('/:id', async (req, res) => {
  try {
    const site = await Site.findById(req.params.id).lean();
    if (!site || site.userId.toString() !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(site);
  } catch (err) {
    console.error('GET /api/sites/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

// update site (PUT)
router.put('/:id', async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site || site.userId.toString() !== req.userId) return res.status(404).json({ error: 'Not found' });

    // whitelist allowed updatable fields
    const allowed = {};
    const {
      name,
      latitude,
      longitude,
      panel_area_m2,
      area,
      efficiency,
      model_path,
      enabled,
      user_email,
      alert_recipients,
      alerts_enabled,
      alerts_always_send,
      alert_threshold_pct
    } = req.body;

    if (typeof name !== 'undefined') allowed.name = name;
    if (typeof latitude !== 'undefined') allowed.latitude = Number(latitude);
    if (typeof longitude !== 'undefined') allowed.longitude = Number(longitude);
    if (typeof panel_area_m2 !== 'undefined') allowed.panel_area_m2 = Number(panel_area_m2);
    if (typeof area !== 'undefined' && typeof panel_area_m2 === 'undefined') allowed.panel_area_m2 = Number(area);
    if (typeof efficiency !== 'undefined') allowed.efficiency = Number(efficiency);
    if (typeof model_path !== 'undefined') allowed.model_path = model_path;
    if (typeof enabled !== 'undefined') allowed.enabled = !!enabled;
    if (typeof user_email !== 'undefined') allowed.user_email = (user_email && typeof user_email === 'string') ? user_email.trim() : null;

    // sanitize recipients if provided
    if (typeof alert_recipients !== 'undefined') {
      const recs = normalizeRecipients(alert_recipients);
      const valid = sanitizeRecipients(recs);
      allowed.alert_recipients = valid;
    }

    if (typeof alerts_enabled !== 'undefined') allowed.alerts_enabled = !!alerts_enabled;
    if (typeof alerts_always_send !== 'undefined') allowed.alerts_always_send = !!alerts_always_send;
    if (typeof alert_threshold_pct !== 'undefined') allowed.alert_threshold_pct = Number(alert_threshold_pct);

    // apply updates
    Object.assign(site, allowed);
    await site.save();
    res.json(site);
  } catch (err) {
    console.error('PUT /api/sites/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

// delete site
router.delete('/:id', async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site || site.userId.toString() !== req.userId) return res.status(404).json({ error: 'Not found' });
    await site.remove();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/sites/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

// trigger forecast for a site (calls Python predictor)
// create site (robust + debug)
router.post('/', async (req, res) => {
  try {
    // DEBUG: log incoming body so we can see exactly what frontend sent
    console.log('DEBUG: POST /api/sites body =>', JSON.stringify(req.body || {}, null, 2));

    // accept multiple possible field names from frontend
    const {
      name,
      latitude,
      longitude,
      panel_area_m2,
      area,
      efficiency,
      model_path,
      alert_recipients,
      alertEmail,
      alert_email,
      alerts_enabled,
      alerts_always_send,
      alert_threshold_pct
    } = req.body;

    // sanity checks
    if (typeof latitude === 'undefined' || typeof longitude === 'undefined') {
      return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const payload = {
      userId: req.userId,
      name: name || 'My site',
      latitude: Number(latitude),
      longitude: Number(longitude),
      panel_area_m2: typeof panel_area_m2 !== 'undefined' ? Number(panel_area_m2) : (typeof area !== 'undefined' ? Number(area) : 1.0),
      efficiency: typeof efficiency !== 'undefined' ? Number(efficiency) : 0.18,
      model_path: model_path || null
    };

    // Build recipients flexibly
    let recs = [];
    if (Array.isArray(alert_recipients)) recs = alert_recipients.map(String).map(s => s.trim()).filter(Boolean);
    else if (typeof alertEmail === 'string' && alertEmail.trim()) recs = [alertEmail.trim()];
    else if (typeof alert_email === 'string' && alert_email.trim()) recs = [alert_email.trim()];
    else if (typeof req.body.alert_recipients === 'string' && req.body.alert_recipients.trim()) {
      // sometimes client may send CSV string
      recs = req.body.alert_recipients.split(',').map(s => s.trim()).filter(Boolean);
    }

    // validate emails
    recs = recs.filter(r => /\S+@\S+\.\S+/.test(r));
    if (recs.length > 0) payload.alert_recipients = recs;

    if (typeof alerts_enabled !== 'undefined') payload.alerts_enabled = !!alerts_enabled;
    if (typeof alerts_always_send !== 'undefined') payload.alerts_always_send = !!alerts_always_send;
    if (typeof alert_threshold_pct !== 'undefined') payload.alert_threshold_pct = Number(alert_threshold_pct);

    const site = new Site(payload);
    await site.save();

    // DEBUG: show saved site excerpt
    console.log('DEBUG: saved site =>', site._id.toString(), 'alert_recipients=', site.alert_recipients);

    res.json(site);
  } catch (err) {
    console.error('POST /api/sites error', err);
    res.status(500).json({ error: err.message });
  }
});


// trigger forecast for a site (calls Python predictor)
router.post('/:id/forecast', async (req, res) => {
  try {
    console.log('POST /api/sites/:id/forecast called for id=', req.params.id);

    const site = await Site.findById(req.params.id);
    if (!site || site.userId.toString() !== req.userId) {
      return res.status(404).json({ error: 'Not found' });
    }

    // build python command
    const py = process.env.ML_PYTHON || 'python';
    const script = path.resolve(__dirname, '..', 'ml_runner.py'); // adjust if your runner path differs
    const args = [
      script,
      '--lat', String(site.latitude ?? site.lat ?? ''),
      '--lon', String(site.longitude ?? site.lon ?? ''),
      '--area', String(site.panel_area_m2 ?? site.area_m2 ?? site.area ?? 1),
      '--eff', String(site.efficiency ?? site.eff ?? 0.18)
    ];

    console.log('Spawning python:', py, args.join(' '));
    const sp = spawnSync(py, args, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

    if (sp.error) {
      console.error('Python spawn error', sp.error);
      if (sp.stderr) console.error('python stderr:', sp.stderr);
      return res.status(500).json({ error: 'Python runner spawn error', details: String(sp.error) });
    }

    if (sp.status !== 0) {
      console.error('Python exited with non-zero status', sp.status, 'stderr:', sp.stderr);
      return res.status(500).json({ error: 'Python runner failed', stderr: sp.stderr ? String(sp.stderr) : null });
    }

    if (!sp.stdout) {
      console.error('Python produced no stdout for site', site._id);
      return res.status(500).json({ error: 'No output from predictor' });
    }

    // parse predictor output
    let out;
    try {
      out = JSON.parse(sp.stdout);
    } catch (e) {
      console.error('Predictor JSON parse error for site', site._id, e);
      console.error('Raw stdout (first 2000 chars):', sp.stdout.slice(0, 2000));
      return res.status(500).json({ error: 'Predictor returned invalid JSON', raw: sp.stdout.slice(0, 2000) });
    }

    // Save forecast into site
    site.last_forecast = out;
    site.last_forecast_at = new Date();
    await site.save();

    // return the saved site object (so frontend can update immediately)
    return res.json({ site, forecast: out });
  } catch (err) {
    console.error('POST /api/sites/:id/forecast error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});


module.exports = router;
