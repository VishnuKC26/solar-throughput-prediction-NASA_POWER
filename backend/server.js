// backend/server.js
require('dotenv').config(); // loads .env from backend folder
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const sitesRoutes = require('./routes/sites');
const scheduler = require('./scheduler'); // ensure scheduler.js exists (or adjust)

const app = express();

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || true })); // dev: allow all origins
app.use(express.json());

// Healthcheck
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);

// debug info (redact password)
const rawUri = process.env.MONGODB_URI || '';
const redactedUri = rawUri.replace(/(:\/\/[^:]+):([^@]+@)/, '://$1:****@');
console.log('NODE_ENV =', process.env.NODE_ENV || 'development');
console.log('PORT =', process.env.PORT || 4000);
console.log('MONGODB_URI =', redactedUri);

// Mongoose connect options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000
  // For debugging TLS issues you could add:
  // tls: true, tlsAllowInvalidCertificates: true, tlsAllowInvalidHostnames: true
};

const PORT = process.env.PORT || 4000;

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('Mongo connected');

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);

      // start scheduler safely
      try {
        if (scheduler && typeof scheduler.start === 'function') {
          scheduler.start();
          console.log('Scheduler started');
        } else {
          console.log('No scheduler.start() found - skipping scheduler startup');
        }
      } catch (schedErr) {
        console.warn('Scheduler.start() error (caught):', schedErr);
      }
    });

    // graceful shutdown
    const shutdown = (signal) => {
      console.log('Shutdown signal received:', signal);
      server.close(() => {
        console.log('HTTP server closed');
        mongoose.disconnect().then(() => {
          console.log('Mongo disconnected');
          process.exit(0);
        }).catch((e) => {
          console.error('Error disconnecting Mongo', e);
          process.exit(1);
        });
      });

      // force exit if not closed in time
      setTimeout(() => {
        console.warn('Forcing shutdown');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch(err => {
    console.error('Mongo connect error:', err);
    // exit so the issue is obvious (nodemon/docker can restart)
    process.exit(1);
  });

// global handlers to log unexpected errors
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
