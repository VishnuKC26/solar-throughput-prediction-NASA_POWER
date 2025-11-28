// backend/models/Site.js
const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  type: { type: String },
  message: { type: String },
  sent: { type: Boolean, default: false }
}, { _id: false });

const SiteSchema = new mongoose.Schema({
  userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'My site' },

  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },

  panel_area_m2: { type: Number, default: 1.0 },
  efficiency: { type: Number, default: 0.18 },

  model_path: { type: String, default: null },

  // alerting / notification fields
  alert_threshold_pct: { type: Number, default: 30 },     // percent deviation threshold
  alert_recipients: { type: [String], default: [] },     // preferred: list of emails
  alerts_enabled: { type: Boolean, default: false },     // process this site for alerts
  alerts_always_send: { type: Boolean, default: false }, // for testing: force email send
  min_alert_interval_ms: { type: Number, default: 3600000 }, // rate limit per site (ms)
  last_alert_sent_at: { type: Date, default: null },     // timestamp last email was sent

  alerts: { type: [AlertSchema], default: [] },          // historical alert entries

  last_forecast: { type: mongoose.Schema.Types.Mixed, default: null },
  last_forecast_at: { type: Date, default: null },

  // legacy single-email field (kept for backwards compatibility)
  user_email: { type: String, default: null },

  enabled: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

SiteSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

SiteSchema.index({ userId: 1 });

module.exports = mongoose.model('Site', SiteSchema);
