// // backend/mail/mailer_gmail_app.js
// require('dotenv').config();
// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS, // app password
//   }
// });

// // Verify connection once at startup
// transporter.verify()
//   .then(() => console.log('Gmail transporter ready (App Password)'))
//   .catch(err => {
//     console.error('Gmail transporter verify failed:', err && err.message ? err.message : err);
//   });

// /**
//  * Send a forecast email.
//  * - recipients: array of emails (required)
//  * - subject: string
//  * - forecast: object used to build table (predictions + baseline)
//  * - siteName: string for subject/body
//  * - extraText: optional string for top of email
//  * - unsubscribeUrl: optional link shown in footer
//  */
// async function sendForecastEmail({ recipients = [], subject, forecast = {}, siteName = 'Site', extraText = '', unsubscribeUrl = null }) {
//   // Validate recipients
//   if (!Array.isArray(recipients)) {
//     throw new Error('recipients must be an array of email addresses');
//   }
//   const cleaned = recipients.map(r => (typeof r === 'string' ? r.trim() : '')).filter(r => r && /\S+@\S+\.\S+/.test(r));
//   if (cleaned.length === 0) {
//     throw new Error('No valid recipients provided — aborting sendForecastEmail.');
//   }

//   // Build HTML table rows from forecast
//   const rows = (forecast.predictions || []).map(p => `
//     <tr>
//       <td style="padding:6px 12px;border:1px solid #eee">${p.date}</td>
//       <td style="padding:6px 12px;border:1px solid #eee;text-align:right">${(p.pred_kwh ?? p.pred ?? 0).toFixed(2)}</td>
//     </tr>
//   `).join('');

//   const html = `
//     <div style="font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#0b1220;">
//       <h2 style="margin-bottom:0.2rem">7-day forecast — ${siteName}</h2>
//       ${extraText ? `<p style="margin-top:0.2rem">${extraText}</p>` : ''}
//       <table style="border-collapse:collapse;width:100%;max-width:600px;margin-top:8px">
//         <thead>
//           <tr>
//             <th style="text-align:left;padding:6px 12px;border:1px solid #eee;background:#fafafa">Date</th>
//             <th style="text-align:right;padding:6px 12px;border:1px solid #eee;background:#fafafa">Predicted kWh</th>
//           </tr>
//         </thead>
//         <tbody>
//           ${rows}
//           <tr>
//             <td style="padding:6px 12px;border:1px solid #eee"><strong>Baseline (ma7)</strong></td>
//             <td style="padding:6px 12px;border:1px solid #eee;text-align:right"><strong>${(forecast.baseline||0).toFixed(2)}</strong></td>
//           </tr>
//         </tbody>
//       </table>
//       ${unsubscribeUrl ? `<p style="font-size:12px;color:#666;margin-top:12px">To unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>` : ''}
//     </div>
//   `;

//   // Batch sending: send to first recipient as 'to', others as 'bcc' in batches.
//   const batchSize = Number(process.env.EMAIL_BATCH_SIZE || 20);
//   const delayMs = Number(process.env.EMAIL_BATCH_DELAY_MS || 1000);

//   const chunks = [];
//   for (let i = 0; i < cleaned.length; i += batchSize) {
//     chunks.push(cleaned.slice(i, i + batchSize));
//   }

//   let totalSent = 0;
//   const results = [];

//   for (const chunk of chunks) {
//     const to = chunk[0];
//     const bcc = chunk.length > 1 ? chunk.slice(1).join(',') : undefined;

//     const mailOptions = {
//       from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
//       to,
//       bcc,
//       replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || process.env.EMAIL_USER,
//       subject: subject || `7-day forecast for ${siteName}`,
//       html
//     };

//     // send
//     try {
//       const info = await transporter.sendMail(mailOptions);
//       console.log('Sent mail batch: to=', to, 'bccCount=', chunk.length - 1, 'messageId=', info.messageId);
//       results.push({ ok: true, to, bccCount: chunk.length - 1, messageId: info.messageId });
//       totalSent += chunk.length;
//     } catch (err) {
//       console.error('Error sending mail batch to', to, 'bccCount=', chunk.length - 1, err && err.message ? err.message : err);
//       results.push({ ok: false, to, bccCount: chunk.length - 1, error: err && err.message ? err.message : String(err) });
//     }

//     if (delayMs) await new Promise(r => setTimeout(r, delayMs));
//   }

//   return { ok: true, attempted: cleaned.length, sent: totalSent, results };
// }

// module.exports = { sendForecastEmail };
// backend/mail/mailer_gmail_app.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // app password
  }
});

// Verify connection once at startup
transporter.verify()
  .then(() => console.log('Gmail transporter ready (App Password)'))
  .catch(err => {
    console.error('Gmail transporter verify failed:', err && err.message ? err.message : err);
  });

/**
 * Send a forecast email.
 * - recipients: array of emails (required)
 * - subject: string
 * - forecast: object used to build table (predictions + baseline)
 * - siteName: string for subject/body
 * - extraText: optional string for top of email
 * - unsubscribeUrl: optional link shown in footer
 */
async function sendForecastEmail({ recipients = [], subject, forecast = {}, siteName = 'Site', extraText = '', unsubscribeUrl = null }) {
  // Validate recipients
  if (!Array.isArray(recipients)) {
    throw new Error('recipients must be an array of email addresses');
  }
  const cleaned = recipients.map(r => (typeof r === 'string' ? r.trim() : '')).filter(r => r && /\S+@\S+\.\S+/.test(r));
  if (cleaned.length === 0) {
    throw new Error('No valid recipients provided — aborting sendForecastEmail.');
  }

  // Build HTML table rows from forecast
  const rows = (forecast.predictions || []).map(p => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #eee">${p.date}</td>
      <td style="padding:6px 12px;border:1px solid #eee;text-align:right">${(p.pred_kwh ?? p.pred ?? 0).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color:#0b1220;">
      <h2 style="margin-bottom:0.2rem">7-day forecast — ${siteName}</h2>
      ${extraText ? `<p style="margin-top:0.2rem">${extraText}</p>` : ''}
      <table style="border-collapse:collapse;width:100%;max-width:600px;margin-top:8px">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 12px;border:1px solid #eee;background:#fafafa">Date</th>
            <th style="text-align:right;padding:6px 12px;border:1px solid #eee;background:#fafafa">Predicted kWh</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr>
            <td style="padding:6px 12px;border:1px solid #eee"><strong>Baseline (ma7)</strong></td>
            <td style="padding:6px 12px;border:1px solid #eee;text-align:right"><strong>${(forecast.baseline||0).toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
      ${unsubscribeUrl ? `<p style="font-size:12px;color:#666;margin-top:12px">To unsubscribe: <a href="${unsubscribeUrl}">${unsubscribeUrl}</a></p>` : ''}
    </div>
  `;

  // Batch sending: send to first recipient as 'to', others as 'bcc' in batches.
  const batchSize = Number(process.env.EMAIL_BATCH_SIZE || 20);
  const delayMs = Number(process.env.EMAIL_BATCH_DELAY_MS || 1000);

  const chunks = [];
  for (let i = 0; i < cleaned.length; i += batchSize) {
    chunks.push(cleaned.slice(i, i + batchSize));
  }

  let totalSent = 0;
  const results = [];

  for (const chunk of chunks) {
    const to = chunk[0];
    const bcc = chunk.length > 1 ? chunk.slice(1).join(',') : undefined;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      bcc,
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      subject: subject || `7-day forecast for ${siteName}`,
      html
    };

    // send
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Sent mail batch: to=', to, 'bccCount=', chunk.length - 1, 'messageId=', info.messageId);
      results.push({ ok: true, to, bccCount: chunk.length - 1, messageId: info.messageId });
      totalSent += chunk.length;
    } catch (err) {
      console.error('Error sending mail batch to', to, 'bccCount=', chunk.length - 1, err && err.message ? err.message : err);
      results.push({ ok: false, to, bccCount: chunk.length - 1, error: err && err.message ? err.message : String(err) });
    }

    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  }

  return { ok: true, attempted: cleaned.length, sent: totalSent, results };
}

/**
 * Send an alert email (HTML already built).
 * - recipients: array of emails
 * - subject: string
 * - html: full HTML string (required)
 *
 * Uses same batching logic as sendForecastEmail.
 */
async function sendAlertEmail({ recipients = [], subject = '', html = '' }) {
  if (!Array.isArray(recipients)) {
    throw new Error('recipients must be an array of email addresses');
  }
  const cleaned = recipients.map(r => (typeof r === 'string' ? r.trim() : '')).filter(r => r && /\S+@\S+\.\S+/.test(r));
  if (cleaned.length === 0) {
    throw new Error('No valid recipients provided — aborting sendAlertEmail.');
  }
  if (!html || typeof html !== 'string') {
    throw new Error('html (string) is required for sendAlertEmail');
  }

  // re-use batching settings
  const batchSize = Number(process.env.EMAIL_BATCH_SIZE || 20);
  const delayMs = Number(process.env.EMAIL_BATCH_DELAY_MS || 1000);

  const chunks = [];
  for (let i = 0; i < cleaned.length; i += batchSize) {
    chunks.push(cleaned.slice(i, i + batchSize));
  }

  let totalSent = 0;
  const results = [];

  for (const chunk of chunks) {
    const to = chunk[0];
    const bcc = chunk.length > 1 ? chunk.slice(1).join(',') : undefined;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      bcc,
      replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      subject: subject || 'Solar alert',
      html
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Sent alert batch: to=', to, 'bccCount=', chunk.length - 1, 'messageId=', info.messageId);
      results.push({ ok: true, to, bccCount: chunk.length - 1, messageId: info.messageId });
      totalSent += chunk.length;
    } catch (err) {
      console.error('Error sending alert batch to', to, 'bccCount=', chunk.length - 1, err && err.message ? err.message : err);
      results.push({ ok: false, to, bccCount: chunk.length - 1, error: err && err.message ? err.message : String(err) });
    }

    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  }

  return { ok: true, attempted: cleaned.length, sent: totalSent, results };
}

module.exports = { sendForecastEmail, sendAlertEmail };
