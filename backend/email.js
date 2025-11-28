// backend/email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

let transporter;

if (provider === 'gmail') {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
} else if (provider === 'sendgrid') {
  transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey', // literal 'apikey' for SendGrid SMTP
      pass: process.env.SENDGRID_API_KEY
    }
  });
} else {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: (process.env.SMTP_SECURE === 'true'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

transporter.verify((err, success) => {
  if (err) {
    console.warn('Email transporter verification warning:', err.message || err);
  } else {
    console.log('Email transporter verified');
  }
});

async function sendEmail(to, subject, html, text, fromOverride) {
  const from = fromOverride || process.env.FROM_EMAIL;
  if (!from) throw new Error('FROM_EMAIL not set in env and no fromOverride provided');
  const mail = { from, to, subject, html, text };
  return transporter.sendMail(mail);
}

module.exports = { sendEmail };
