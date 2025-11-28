// backend/utils/email.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log('Email transporter verified');
  } catch (err) {
    console.error('Email transporter verify failed', err);
  }
}

/**
 * sendEmail({ to, subject, text, html })
 * returns Promise from nodemailer
 */
async function sendEmail({ to, subject, text, html }) {
  const mail = {
    from: process.env.FROM_EMAIL || process.env.GMAIL_USER,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mail);
}

module.exports = { transporter, sendEmail, verifyTransporter };
