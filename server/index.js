require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { migrate } = require('./db');
const { bot } = require('./bot');
const { runContestMaintenance } = require('./contestJobs');
const app = require('./app');

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    const uploadDir = path.join(__dirname, 'uploads', 'banners');
    fs.mkdirSync(uploadDir, { recursive: true });

    await migrate();

    const webhookUrlBase = (process.env.WEBHOOK_URL || '').trim();

    if (webhookUrlBase && webhookUrlBase.startsWith('https://')) {
      try {
        const webhookUrl = `${webhookUrlBase}/webhook/${process.env.WEBHOOK_SECRET_PATH}`;
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

    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Головне меню / Главное меню' },
      { command: 'notifications', description: '🔔 Сповіщення / Уведомления' },
    ]).catch(e => console.error('setMyCommands error:', e));

    // Run contest maintenance (reminders, auto-end, auto-pick winners) every
    // minute on this long-lived process. On serverless (Vercel) this is driven
    // by an HTTP cron hitting /api/cron/run instead.
    setInterval(() => { runContestMaintenance().catch(e => console.error('Contest maintenance error:', e)); }, 60000);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
