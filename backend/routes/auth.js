// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let User;
try {
  User = require('../models/User');
} catch (e) {
  console.error('Failed to require ../models/User', e);
  router.post('/signup', (req, res) => res.status(500).json({ error: 'Server misconfigured: User model missing' }));
  router.post('/login', (req, res) => res.status(500).json({ error: 'Server misconfigured: User model missing' }));
  module.exports = router;
  return;
}

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hash, name });
    await user.save();

    const token = jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { _id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Signup error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Defensive: ensure password hash exists
    if (!user.password || typeof user.password !== 'string') {
      // Log redacted user so you can inspect in server logs (do NOT log full password)
      const redacted = { ...user, password: user.password ? '[REDACTED_PRESENT]' : '[MISSING]' };
      console.error('Login attempt for user with missing password hash:', redacted);
      return res.status(500).json({ error: 'User account is misconfigured: no password hash. Please reset password.' });
    }

    // compare
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { _id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
