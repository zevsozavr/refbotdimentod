// Vercel serverless entry point
require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });

const { migrate } = require('../server/db');
const { bot } = require('../server/bot');
const app = require('../server/app');

let initialized = false;

const initialize = async () => {
  if (initialized) return;
  initialized = true;
  try {
    await migrate();
    const webhookUrlBase = (process.env.WEBHOOK_URL || '').trim();
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
