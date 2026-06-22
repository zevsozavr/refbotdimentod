require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { migrate } = require('./db');
const { bot, verifyBotWebhook } = require('./bot');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(helmet.xContentTypeOptions());
app.use(helmet.frameguard({ action: 'deny' }));
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));

// CORS lockdown
const allowedOrigins = [
  'https://web.telegram.org',
  'https://web.telegram.org.k',
  process.env.MINI_APP_URL || '',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
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

// Bot webhook endpoint (before main router to avoid auth middleware)
app.post(`/webhook/${process.env.WEBHOOK_SECRET_PATH}`, verifyBotWebhook, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// API routes
app.use('/api', routes);

// Error handler - generic messages only
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start
const start = async () => {
  try {
    await migrate();

    if (process.env.NODE_ENV === 'production') {
      const webhookUrl = `${process.env.WEBHOOK_URL}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`Bot webhook set to: ${webhookUrl}`);
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

// Graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
