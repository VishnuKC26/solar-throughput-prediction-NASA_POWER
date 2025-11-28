// backend/test-send-mail.js
require('dotenv').config();
const { sendForecastEmail } = require('./mail/mailer_gmail_app');

(async ()=> {
  try {
    const recipients = [ process.env.TEST_RECIPIENT || process.env.EMAIL_USER ];
    console.log('TEST: sending to', recipients);
    const fakeForecast = {
      predictions: [
        { date: new Date().toISOString().slice(0,10), pred_kwh: 12.34 },
        { date: new Date(Date.now()+86400000).toISOString().slice(0,10), pred_kwh: 11.11 }
      ],
      baseline: 10.0
    };
    const res = await sendForecastEmail({
      recipients,
      subject: 'Test — solar scheduler',
      forecast: fakeForecast,
      siteName: 'Test Site',
      extraText: 'This is a local test'
    });
    console.log('sendForecastEmail result:', res);
  } catch (e) {
    console.error('test-send-mail error:', e && e.message ? e.message : e);
  }
  process.exit(0);
})();
