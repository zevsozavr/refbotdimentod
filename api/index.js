require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { migrate } = require('../server/db');
const { bot } = require('../server/bot');
const routes = require('../server/routes');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.telegram.org"],
      frameAncestors: ["https://web.telegram.org", "https://web.telegram.org.k"],
    },
  },
  frameguard: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  const serverOrigin = req.protocol + '://' + host;
  const allowed = [
    'https://web.telegram.org',
    'https://web.telegram.org.k',
    process.env.APP_URL,
    serverOrigin,
  ].filter(Boolean);

  if (!origin || allowed.includes(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-telegram-init-data');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '50mb' }));

// photos
app.use('/photos', express.static(path.join(__dirname, '../resources/photos')));

// uploaded banners — Vercel has no persistent fs; use /tmp
const uploadsDir = path.join('/tmp', 'uploads', 'banners');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join('/tmp', 'uploads')));

// Bot webhook
app.post(`/webhook/${process.env.WEBHOOK_SECRET_PATH}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// API routes
app.use('/api', routes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Init on cold start
const init = async () => {
  try {
    await migrate();
    const webhookUrlBase = (process.env.WEBHOOK_URL || '').trim();
    if (webhookUrlBase && webhookUrlBase.startsWith('https://')) {
      try {
        const webhookUrl = `${webhookUrlBase}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Bot webhook set to: ${webhookUrl}`);
      } catch (webhookErr) {
        console.error('Webhook failed:', webhookErr.message);
        await bot.telegram.deleteWebhook();
      }
    }
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Головне меню / Головне меню' },
      { command: 'notifications', description: '🔔 Сповіщення / Уведомления' },
    ]).catch(e => console.error('setMyCommands error:', e));
    console.log('Vercel serverless init complete');
  } catch (err) {
    console.error('Init error:', err);
  }
};
init();

module.exports = app;
