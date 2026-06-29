// Vercel serverless entry point
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });

const { migrate, ensureSchema } = require('../server/db');
const { bot } = require('../server/bot');
const app = require('../server/app');

let initialized = false;

const initialize = async () => {
  if (initialized) return;
  initialized = true;
  try {
    // On most cold starts the schema already exists, so this is a single cheap
    // lookup. Set RUN_MIGRATIONS=true to force the full migration (fresh DB or
    // after a schema change).
    if (process.env.RUN_MIGRATIONS === 'true') {
      await migrate();
    } else {
      await ensureSchema();
    }
    // Prefer Vercel's auto-provided production domain so the webhook always
    // targets the correct deployment, independent of a manually-set WEBHOOK_URL.
    const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const webhookUrlBase = (prodUrl ? `https://${prodUrl}` : (process.env.WEBHOOK_URL || '')).trim();
    if (webhookUrlBase && webhookUrlBase.startsWith('https://')) {
      const webhookUrl = `${webhookUrlBase}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
      await bot.telegram.setWebhook(webhookUrl);
      console.log('Bot webhook set to:', webhookUrl);
    }
  } catch (err) {
    console.error('Initialization error:', err);
  }
};

initialize();

module.exports = app;
