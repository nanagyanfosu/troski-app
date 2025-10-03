// Example Express server to accept Expo push token registrations and send pushes.
// This is a minimal example for development and demonstration only.

const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

// In-memory store for demo purposes
const tokensByRoute = {};

app.post('/api/push/register', (req, res) => {
  const { token, route } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  const key = route?.id || route?.name || route?.routeNum || 'global';
  tokensByRoute[key] = tokensByRoute[key] || new Set();
  tokensByRoute[key].add(token);
  return res.json({ ok: true });
});

// Simple root endpoint so browser visits to / show something useful
app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'Troski push example server is running' });
});

// Debug endpoint to list registered tokens (not for production)
app.get('/api/push/tokens', (_req, res) => {
  const out = {};
  Object.keys(tokensByRoute).forEach(k => {
    out[k] = Array.from(tokensByRoute[k]);
  });
  res.json({ ok: true, tokens: out });
});

app.post('/api/push/send', async (req, res) => {
  const { routeKey, title, body } = req.body || {};
  const pushTokens = Array.from(tokensByRoute[routeKey] || []);
  if (pushTokens.length === 0) return res.status(404).json({ error: 'no tokens' });

  // Build messages for Expo
  const messages = pushTokens.map(t => ({ to: t, sound: 'default', title, body }));

  try {
    const chunks = [];
    // Expo's push endpoint accepts one or many messages, but this simple example sends all at once.
    const resp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const data = await resp.json();
    return res.json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3003;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`Push example server listening on http://${HOST}:${PORT}`);
});

// Helpful process-level handlers for debugging
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Graceful shutdown on SIGINT/SIGTERM
const shutdown = () => {
  console.log('Shutting down push example server...');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Note: For a production-ready implementation, persist tokens to a DB, handle invalid tokens, and respect Expo's recommended batching and retry behavior.
