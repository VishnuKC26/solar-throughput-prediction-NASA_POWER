// backend/migrate-sites-add-fields.js
const mongoose = require('mongoose');
require('dotenv').config();
const Site = require('./models/Site');

// accept either MONGO_URI or MONGODB_URI
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGO connection string not set. Set MONGO_URI or MONGODB_URI in backend/.env or export it in your shell.');
  console.error('Example (PowerShell): $env:MONGO_URI = "mongodb://localhost:27017/mydb" ; node migrate-sites-add-fields.js');
  process.exit(1);
}

// mask password for debug output (if URI contains @)
function maskUri(uri) {
  try {
    const idx = uri.indexOf('@');
    if (idx === -1) return uri;
    // keep protocol and host, mask credentials portion
    const protocolAndCreds = uri.slice(0, idx);
    const afterAt = uri.slice(idx);
    // replace the credentials between '://' and '@' with '***'
    const parts = protocolAndCreds.split('://');
    if (parts.length === 2) {
      return parts[0] + '://' + '***' + afterAt;
    }
    return '***' + afterAt;
  } catch {
    return '***';
  }
}

async function run() {
  console.log('DEBUG: process.cwd() =', process.cwd());
  console.log('DEBUG: Using DB URI =', maskUri(MONGO_URI));

  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed:', err && err.message ? err.message : err);
    process.exit(1);
  }

  const defaultFields = {
    alerts_enabled: false,
    alert_recipients: [],
    alert_threshold_pct: 30,
    alerts_always_send: false,
    min_alert_interval_ms: 3600000
  };

  try {
    const sites = await Site.find({}).exec();
    for (const s of sites) {
      let changed = false;
      for (const k of Object.keys(defaultFields)) {
        if (typeof s[k] === 'undefined') {
          s[k] = defaultFields[k];
          changed = true;
        }
      }
      if (changed) {
        await s.save();
        console.log('Updated site', s._id.toString());
      }
    }
    console.log('Migration done.');
  } catch (err) {
    console.error('Migration error:', err && err.message ? err.message : err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(0);
  }
}

run();
