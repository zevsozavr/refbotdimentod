const { Telegraf } = require('telegraf');
const { isAdminId } = require('./middleware');

const bot = new Telegraf(process.env.BOT_TOKEN);

let miniAppUrlPromise = null;
const getMiniAppUrl = async () => {
  if (process.env.MINI_APP_URL) return process.env.MINI_APP_URL;
  if (!miniAppUrlPromise) {
    miniAppUrlPromise = (async () => {
      const fallback = (process.env.WEBHOOK_URL || '').trim().replace(/\/webhook\/[^/]+$/, '');
      if (fallback) {
        console.log('MINI_APP_URL not set, using web app URL:', fallback);
        return fallback;
      }
      try {
        const me = await bot.telegram.getMe();
        const url = `https://t.me/${me.username}/app`;
        console.log('MINI_APP_URL not set, constructed:', url);
        return url;
      } catch {
        console.log('MINI_APP_URL not set and could not determine URL');
        return 'https://t.me/your_bot/your_app';
      }
    })();
  }
  return miniAppUrlPromise;
};

const getKeyboard = async (language) => ({
  inline_keyboard: [[
    {
      text: language === 'uk' ? 'Відкрити Mini App' : 'Открыть Mini App',
      url: await getMiniAppUrl(),
    }
  ]]
});

bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const { pool } = require('./db');
  try {
    const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    const user = result.rows[0];

    const keyboard = await getKeyboard(user ? user.language : 'uk');
    if (user && user.status === 'verified') {
      await ctx.reply(
        user.language === 'uk'
          ? 'Ласкаво просимо назад! Натисніть кнопку нижче, щоб відкрити Mini App.'
          : 'Добро пожаловать назад! Нажмите кнопку ниже, чтобы открыть Mini App.',
        { reply_markup: keyboard }
      );
    } else {
      const lang = user ? user.language : 'uk';
      await ctx.reply(
        lang === 'uk'
          ? 'Ласкаво просимо! Натисніть кнопку нижче, щоб відкрити Mini App та зареєструватися.'
          : 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть Mini App и зарегистрироваться.',
        { reply_markup: keyboard }
      );
    }
  } catch (err) {
    console.error('Bot start error:', err);
  }
});

const notifyWinner = async (user, contest, language) => {
  try {
    const message = language === 'uk'
      ? `Вітаємо! Ви виграли в конкурсі "${contest.title_uk}"!\nПриз: ${contest.prize_uk}\n\nБудь ласка, очікуйте, поки адміністратор зв'яжеться з вами для отримання деталей.`
      : `Поздравляем! Вы выиграли в конкурсе "${contest.title_ru}"!\nПриз: ${contest.prize_ru}\n\nПожалуйста, ожидайте, пока администратор свяжется с вами для получения деталей.`;

    await bot.telegram.sendMessage(user.telegram_id, message);
  } catch (err) {
    console.error('Error notifying winner:', err);
  }
};

const notifyAdmin = async (winner, contest) => {
  try {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const message = `🏆 Новий переможець / Новый победитель\n\nTelegram ID: ${winner.telegram_id}\nUsername: @${winner.telegram_username || 'N/A'}\nCasino ID: ${winner.casino_id || 'N/A'}\nКонкурс / Конкурс: ${contest.title_uk} / ${contest.title_ru}\nПриз / Приз: ${contest.prize_uk} / ${contest.prize_ru}`;

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, message);
      } catch (e) {
        console.error(`Error notifying admin ${adminId}:`, e);
      }
    }
  } catch (err) {
    console.error('Error notifying admins:', err);
  }
};

const notifyUser = async (telegramId, textUk, textRu, language) => {
  try {
    const message = language === 'uk' ? textUk : textRu;
    await bot.telegram.sendMessage(telegramId, message);
  } catch (err) {
    console.error('Error sending notification:', err);
  }
};

module.exports = { bot, notifyWinner, notifyAdmin, notifyUser };
