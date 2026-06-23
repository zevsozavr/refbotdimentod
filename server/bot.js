const { Telegraf, Markup } = require('telegraf');
const { isAdminId } = require('./middleware');
const { pool } = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ─── REMINDER INTERVAL ───

const checkContestReminders = async () => {
  try {
    const reminders = await pool.query(
      `SELECT cr.id, cr.contest_id, c.title_uk, c.title_ru, c.start_date, c.casino
       FROM contest_reminders cr
       JOIN contests c ON c.id = cr.contest_id
       WHERE cr.sent = FALSE AND c.status = 'active' AND c.start_date <= NOW() + INTERVAL '15 minutes' AND c.start_date > NOW()`
    );
    for (const r of reminders.rows) {
      const participants = await pool.query(
        `SELECT u.telegram_id, u.language FROM contest_participants cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.contest_id = $1`,
        [r.contest_id]
      );
      for (const p of participants.rows) {
        const msg = p.language === 'uk'
          ? `🔔 Конкурс "${r.title_uk}" розпочнеться за 15 хвилин!\nКазино: ${r.casino === 'topmatch' ? 'TopMatch' : 'TonPlay'}`
          : `🔔 Конкурс "${r.title_ru}" начнется через 15 минут!\nКазино: ${r.casino === 'topmatch' ? 'TopMatch' : 'TonPlay'}`;
        try { await bot.telegram.sendMessage(p.telegram_id, msg); } catch (e) { /* ignore */ }
      }
      await pool.query('UPDATE contest_reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1', [r.id]);
    }
  } catch (err) {
    console.error('Contest reminder check error:', err);
  }
};

setInterval(checkContestReminders, 60000);

// ─── NOTIFICATION MENU ───

const sendNotificationMenu = async (ctx, language) => {
  const lang = language || 'uk';
  const text = lang === 'uk' ? '🔔 Сповіщення' : '🔔 Уведомления';
  await ctx.reply(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'uk' ? '🏆 Конкурси' : '🏆 Конкурсы', callback_data: 'notif_contests' }],
        [{ text: lang === 'uk' ? '📺 Стріми' : '📺 Стримы', callback_data: 'notif_streams' }],
        [{ text: lang === 'uk' ? '◀️ Назад' : '◀️ Назад', callback_data: 'notif_back' }],
      ],
    },
  });
};

bot.hears(/^(🔔 Сповіщення|🔔 Уведомления|Notifications)$/, async (ctx) => {
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  await sendNotificationMenu(ctx, lang);
});

bot.action('notif_main', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  await sendNotificationMenu(ctx, lang);
});

bot.action('notif_back', async (ctx) => {
  await ctx.answerCbQuery();
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  const text = lang === 'uk'
    ? '🌐 Оберіть мову / Выберите язык:'
    : '🌐 Выберите язык / Оберіть мову:';
  await ctx.editMessageText(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🇺🇦 Українська', callback_data: 'lang_uk' }],
        [{ text: '🇷🇺 Русский', callback_data: 'lang_ru' }],
      ],
    },
  });
});

bot.action(/^notif_contests$/, async (ctx) => {
  await ctx.answerCbQuery();
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  const contests = await pool.query(
    "SELECT * FROM contests WHERE status = 'active' AND start_date > NOW() AND end_date > NOW() ORDER BY start_date ASC LIMIT 5"
  );
  if (contests.rows.length === 0) {
    const emptyText = lang === 'uk' ? 'Немає майбутніх конкурсів' : 'Нет предстоящих конкурсов';
    await ctx.editMessageText(`📭 ${emptyText}`, {
      reply_markup: { inline_keyboard: [[{ text: lang === 'uk' ? '◀️ Назад' : '◀️ Назад', callback_data: 'notif_main' }]] },
    });
    return;
  }
  let msg = lang === 'uk' ? '🏆 *Майбутні конкурси:*\n\n' : '🏆 *Предстоящие конкурсы:*\n\n';
  for (const c of contests.rows) {
    const start = new Date(c.start_date);
    const timeStr = start.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU', { timeZone: 'Europe/Kyiv' });
    const title = lang === 'uk' ? c.title_uk : c.title_ru;
    const prize = lang === 'uk' ? c.prize_uk : c.prize_ru;
    msg += `*${title}*\n🏆 ${prize}\n🕐 ${timeStr}\n\n`;
  }
  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: lang === 'uk' ? '◀️ Назад' : '◀️ Назад', callback_data: 'notif_main' }]] },
  });
});

bot.action(/^notif_streams$/, async (ctx) => {
  await ctx.answerCbQuery();
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  const streams = await pool.query(
    "SELECT * FROM streams WHERE status = 'scheduled' AND start_time > NOW() ORDER BY start_time ASC LIMIT 5"
  );
  if (streams.rows.length === 0) {
    const emptyText = lang === 'uk' ? 'Немає майбутніх стрімів' : 'Нет предстоящих стримов';
    await ctx.editMessageText(`📭 ${emptyText}`, {
      reply_markup: { inline_keyboard: [[{ text: lang === 'uk' ? '◀️ Назад' : '◀️ Назад', callback_data: 'notif_main' }]] },
    });
    return;
  }
  let msg = lang === 'uk' ? '📺 *Майбутні стріми:*\n\n' : '📺 *Предстоящие стримы:*\n\n';
  for (const s of streams.rows) {
    const start = new Date(s.start_time);
    const timeStr = start.toLocaleString(lang === 'uk' ? 'uk-UA' : 'ru-RU', { timeZone: 'Europe/Kyiv' });
    const text = lang === 'uk' ? s.text_uk : s.text_ru;
    msg += `${s.banner_image ? '🖼️ ' : ''}${text || ''}\n🔗 ${s.link}\n🕐 ${timeStr}\n\n`;
  }
  await ctx.editMessageText(msg, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: lang === 'uk' ? '◀️ Назад' : '◀️ Назад', callback_data: 'notif_main' }]] },
  });
});

// ─── LANGUAGE SELECTION ───

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

bot.command('notifications', async (ctx) => {
  const user = await pool.query('SELECT language FROM users WHERE telegram_id = $1', [ctx.from.id]);
  const lang = user.rows[0]?.language || 'uk';
  await sendNotificationMenu(ctx, lang);
});

const sendMainMenu = async (ctx, lang) => {
  const mainText = lang === 'uk'
    ? '👋 Вітаємо! Оберіть дію:'
    : '👋 Приветствуем! Выберите действие:';
  const btnOpen = lang === 'uk' ? '🚀 Відкрити додаток' : '🚀 Открыть приложение';
  const btnNotif = lang === 'uk' ? '🔔 Сповіщення' : '🔔 Уведомления';
  await ctx.editMessageText(mainText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: btnOpen, web_app: { url: process.env.APP_URL } }],
        [{ text: btnNotif, callback_data: 'notif_main' }],
      ],
    },
  });
};

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
  await sendMainMenu(ctx, 'uk');
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
  await sendMainMenu(ctx, 'ru');
});

// ─── NOTIFY WINNER ───

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

const notifyAdmin = async (winners, contest) => {
  try {
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
    const casinoName = contest.casino === 'topmatch' ? 'TopMatch' : 'TonPlay';
    const winnersArr = Array.isArray(winners) ? winners : [winners];

    for (const winner of winnersArr) {
      const casinoId = contest.casino === 'topmatch' ? winner.casino_id_topmatch : winner.casino_id_tonplay;
      const wallet = contest.casino === 'topmatch' ? winner.wallet_topmatch : winner.wallet_tonplay;
      const message = `🏆 Переможець / Победитель\n\nКазино / Казино: ${casinoName}\nTelegram ID: ${winner.telegram_id}\nUsername: @${winner.telegram_username || 'N/A'}\nCasino ID: ${casinoId || 'N/A'}\nTRC20 USDT: ${wallet || 'N/A'}\nКонкурс / Конкурс: ${contest.title_uk} / ${contest.title_ru}\nПриз / Приз: ${contest.prize_uk} / ${contest.prize_ru}`;

      for (const adminId of adminIds) {
        try {
          await bot.telegram.sendMessage(adminId, message);
        } catch (e) {
          console.error(`Error notifying admin ${adminId}:`, e);
        }
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

const notifyAllUsers = async (textUk, textRu) => {
  try {
    const users = await pool.query("SELECT telegram_id, language FROM users WHERE status = 'verified'");
    for (const u of users.rows) {
      try {
        const msg = u.language === 'uk' ? textUk : textRu;
        await bot.telegram.sendMessage(u.telegram_id, msg);
      } catch (e) { /* user may have blocked bot */ }
    }
    console.log(`Notified ${users.rows.length} users`);
  } catch (err) {
    console.error('Error notifying all users:', err);
  }
};

module.exports = { bot, notifyWinner, notifyAdmin, notifyUser, notifyAdminChange, notifyAllUsers };
