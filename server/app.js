const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

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
  const host = req.headers['host'];
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-telegram-init-data,x-session-token');
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

app.use(express.json({ limit: '1mb' }));

app.use('/photos', express.static(path.join(__dirname, '../resources/photos')));
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Bot webhook — path is already secret via WEBHOOK_SECRET_PATH
const { bot } = require('./bot');
app.post(`/webhook/${process.env.WEBHOOK_SECRET_PATH}`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.use('/api', routes);

// Serve built React client (for non-Vercel deployments)
const clientBuildPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      return next();
    }
    const indexPath = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
