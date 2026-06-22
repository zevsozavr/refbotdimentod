require('dotenv').config();

const path = require('path');
const fs = require('fs');
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

// Trust Railway proxy
app.set('trust proxy', 1);

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

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const start = async () => {
  try {
    await migrate();

    // Try webhook only if WEBHOOK_URL starts with https://
    if (process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.startsWith('https://')) {
      try {
        const webhookUrl = `${process.env.WEBHOOK_URL}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
        await bot.telegram.setWebhook(webhookUrl);
        console.log(`Bot webhook set to: ${webhookUrl}`);
      } catch (webhookErr) {
        console.error('Webhook failed:', webhookErr.message);
        console.log('Falling back to polling...');
        await bot.telegram.deleteWebhook();
        bot.launch();
      }
    } else {
      console.log('No valid WEBHOOK_URL, using polling mode');
      await bot.telegram.deleteWebhook();
      bot.launch();
    }

    // Serve React static files
    const clientBuildPath = path.join(__dirname, '../client/build');
    const indexPath = path.join(clientBuildPath, 'index.html');
    console.log('Looking for frontend at:', indexPath);
    if (fs.existsSync(indexPath)) {
      app.use(express.static(clientBuildPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
          return next();
        }
        res.sendFile(indexPath);
      });
      console.log('Frontend static files loaded');
    } else {
      console.log('Frontend build not found — API only mode');
      app.get('*', (req, res) => {
        res.send('Server running. Frontend not built yet.');
      });
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
