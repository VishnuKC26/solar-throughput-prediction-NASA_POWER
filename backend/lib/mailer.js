// lib/mailer.js
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');


const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST,
port: parseInt(process.env.SMTP_PORT || '587'),
secure: process.env.SMTP_PORT === '465',
auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});


// Keep template loader in case you still use templates; htmlOverride will bypass this
const templates = {};
const loadTemplate = (name) => {
if (templates[name]) return templates[name];
const file = fs.readFileSync(path.join(__dirname, '..', 'templates', `${name}.html`), 'utf8');
templates[name] = Handlebars.compile(file);
return templates[name];
};


async function sendAlertEmail({ to, subject, templateName, variables, htmlOverride }) {
const html = htmlOverride || (templateName ? loadTemplate(templateName)(variables) : '<div/>');
const mailOptions = { from: process.env.SMTP_FROM, to, subject, html };
return transporter.sendMail(mailOptions);
}


module.exports = { sendAlertEmail };