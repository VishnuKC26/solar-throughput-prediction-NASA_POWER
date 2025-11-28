// backend/add-email-to-all-sites.js
const mongoose = require('mongoose');
require('dotenv').config();
const Site = require('./models/Site');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('Set MONGO_URI or MONGODB_URI in backend/.env');
  process.exit(1);
}

const NEW_RECIPIENT = process.env.NEW_RECIPIENT || process.env.TEST_RECIPIENT || process.env.EMAIL_USER;
if (!NEW_RECIPIENT) {
  console.error('Set NEW_RECIPIENT or TEST_RECIPIENT or EMAIL_USER in env to use as recipient.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB. Adding recipient to sites:', NEW_RECIPIENT);

  const sites = await Site.find({}).exec();
  console.log('Found', sites.length, 'sites');

  let updated = 0;
  for (const s of sites) {
    // initialize fields if missing
    if (!Array.isArray(s.alert_recipients)) s.alert_recipients = [];
    // add only if not present
    if (!s.alert_recipients.includes(NEW_RECIPIENT)) {
      s.alert_recipients.push(NEW_RECIPIENT);
      // optionally enable alerts by default (comment this out if you don't want auto-enable)
      s.alerts_enabled = typeof s.alerts_enabled === 'undefined' ? true : s.alerts_enabled;
      await s.save();
      updated++;
      console.log('Updated site', s._id.toString());
    }
  }

  console.log(`Done. Updated ${updated}/${sites.length} sites.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
