require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { migrate } = require('./db');
const { bot } = require('./bot');
const { verifyBotWebhook } = require('./middleware');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');

// Auto-build client if not built yet
if (!fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  console.log('Client build not found, building React app...');
  try {
    const clientDir = path.join(__dirname, '..', 'client');
    execSync('npm install', { cwd: clientDir, stdio: 'inherit', env: { ...process.env, CI: 'false' } });
    execSync('npm run build', { cwd: clientDir, stdio: 'inherit', env: { ...process.env, CI: 'false' } });
    console.log('Client build complete');
  } catch (buildErr) {
    console.error('Client build failed. Check logs above for details.');
  }
}

// Serve React static files
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["https://web.telegram.org", "https://web.telegram.org.k"],
    },
  },
  frameguard: false,
}));

app.use(helmet.xContentTypeOptions());
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

// CORS
const allowedOrigins = [
  'https://web.telegram.org',
  'https://web.telegram.org.k',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(express.json());

// Bot webhook endpoint
app.post(`/webhook/${process.env.WEBHOOK_SECRET_PATH}`, verifyBotWebhook, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// API routes
app.use('/api', routes);

// SPA catch-all
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) return next();
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Server is running. Frontend not built yet.');
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const start = async () => {
  try {
    await migrate();

    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL && !process.env.WEBHOOK_URL.includes('.railway.internal')) {
      try {
        const webhookUrl = `${process.env.WEBHOOK_URL}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Bot webhook set to: ${webhookUrl}`);
      } catch (webhookErr) {
        console.error('Webhook failed, falling back to polling:', webhookErr.message);
        bot.launch();
      }
    } else {
      bot.launch();
      console.log('Bot started in polling mode');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
