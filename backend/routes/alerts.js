// routes/alerts.js
const express = require('express');
const router = express.Router();
const { sendForecastEmail } = require('../mailer_gmail_app'); // or oauth2 version

router.post('/:siteId/send-alerts', async (req, res) => {
  const { recipients = [], subject, extraText } = req.body;
  const siteId = req.params.siteId;
  // fetch forecast from your predictor or DB (assume forecastObj available)
  const forecast = req.body.forecast; // or compute here

  if (!forecast) return res.status(400).json({ error: 'forecast required' });
  try {
    const info = await sendForecastEmail({ recipients, subject, forecast, siteName: `Site ${siteId}`, extraText, unsubscribeUrl: req.body.unsubscribeUrl });
    return res.json({ ok: true, info });
  } catch (err) {
    console.error('sendForecastEmail failed', err && err.message ? err.message : err);
    return res.status(500).json({ error: err.message || 'send failed' });
  }
});

module.exports = router;
