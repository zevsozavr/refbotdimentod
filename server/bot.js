const { Telegraf } = require('telegraf');
const { isAdminId } = require('./middleware');
const { pool } = require('./db');

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

bot.command('start', async (ctx) => {
  await ctx.reply('🌐 Оберіть мову / Выберите язык:', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🇺🇦 Українська', callback_data: 'lang_uk' },
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
      ]],
    },
  });
});

bot.action('lang_uk', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await pool.query(
      `INSERT INTO users (telegram_id, telegram_username, language, status)
       VALUES ($1, $2, 'uk', 'verified')
       ON CONFLICT (telegram_id) DO UPDATE SET language = 'uk', telegram_username = $2`,
      [ctx.from.id, ctx.from.username || null]
    );
  } catch (e) { console.error('lang_uk error:', e); }
  await ctx.editMessageText('✅ Мову встановлено: Українська', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Відкрити додаток', web_app: { url: process.env.APP_URL } },
      ]],
    },
  });
});

bot.action('lang_ru', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    await pool.query(
      `INSERT INTO users (telegram_id, telegram_username, language, status)
       VALUES ($1, $2, 'ru', 'verified')
       ON CONFLICT (telegram_id) DO UPDATE SET language = 'ru', telegram_username = $2`,
      [ctx.from.id, ctx.from.username || null]
    );
  } catch (e) { console.error('lang_ru error:', e); }
  await ctx.editMessageText('✅ Язык установлен: Русский', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Открыть приложение', web_app: { url: process.env.APP_URL } },
      ]],
    },
  });
});

const notifyWinner = async (user, contest, language) => {
  try {
    const wallet = contest.casino === 'topmatch' ? user.wallet_topmatch : user.wallet_tonplay;
    const walletLine = wallet ? `\nTRC20 гаманець для отримання призу: ${wallet}` : '\n⚠️ Будь ласка, вкажіть ваш TRC20 USDT гаманець в налаштуваннях додатку для отримання призу.';
    const walletLineRu = wallet ? `\nTRC20 кошелек для получения приза: ${wallet}` : '\n⚠️ Пожалуйста, укажите ваш TRC20 USDT кошелек в настройках приложения для получения приза.';
    const message = language === 'uk'
      ? `Вітаємо! Ви виграли в конкурсі "${contest.title_uk}"!\nПриз: ${contest.prize_uk}${walletLine}\n\nАдміністратор зв'яжеться з вами для підтвердження та відправки призу на ваш TRC20 гаманець.`
      : `Поздравляем! Вы выиграли в конкурсе "${contest.title_ru}"!\nПриз: ${contest.prize_ru}${walletLineRu}\n\nАдминистратор свяжется с вами для подтверждения и отправки приза на ваш TRC20 кошелек.`;

    await bot.telegram.sendMessage(user.telegram_id, message);
  } catch (err) {
    console.error('Error notifying winner:', err);
  }
};

const notifyAdmin = async (winner, contest) => {
  try {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const casinoName = contest.casino === 'topmatch' ? 'TopMatch' : 'TonPlay';
    const casinoId = contest.casino === 'topmatch' ? winner.casino_id_topmatch : winner.casino_id_tonplay;
    const wallet = contest.casino === 'topmatch' ? winner.wallet_topmatch : winner.wallet_tonplay;
    const message = `🏆 Новий переможець / Новый победитель\n\nКазино / Казино: ${casinoName}\nTelegram ID: ${winner.telegram_id}\nUsername: @${winner.telegram_username || 'N/A'}\nCasino ID: ${casinoId || 'N/A'}\nTRC20 USDT: ${wallet || 'N/A'}\nКонкурс / Конкурс: ${contest.title_uk} / ${contest.title_ru}\nПриз / Приз: ${contest.prize_uk} / ${contest.prize_ru}`;

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

const notifyAdminChange = async (user, field, newValue, casinoName) => {
  try {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const fieldLabel = field.startsWith('casino_id') ? `${casinoName} ID` : `${casinoName} TRC20`;
    const message = `✏️ Запит на зміну / Запрос на изменение\n\nКористувач / Пользователь: @${user.telegram_username || `ID: ${user.telegram_id}`}\nПоле / Поле: ${fieldLabel}\nНове значення / Новое значение: ${newValue}\n\nПерейдіть в адмін-панель щоб підтвердити / Перейдите в админ-панель чтобы подтвердить`;

    for (const adminId of adminIds) {
      try {
        await bot.telegram.sendMessage(adminId, message);
      } catch (e) {
        console.error(`Error notifying admin ${adminId}:`, e);
      }
    }
  } catch (err) {
    console.error('Error notifying admins about change:', err);
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

module.exports = { bot, notifyWinner, notifyAdmin, notifyUser, notifyAdminChange };
