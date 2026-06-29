const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');
const { verifyTelegramAuth, verifyAdminAuth, isAdminId, generateSessionToken } = require('./middleware');
const { notifyWinner, notifyAdmin, notifyUser, notifyAdminChange, notifyAllUsers } = require('./bot');
const { runContestMaintenance, finalizeContest } = require('./contestJobs');

const router = express.Router();

const uploadDir = process.env.VERCEL
  ? '/tmp/uploads/banners'
  : path.join(__dirname, 'uploads/banners');
try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) return cb(null, false);
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) return cb(null, false);
    cb(null, true);
  },
});

const sanitizeHtml = (str) => {
  if (!str) return str;
  return str.replace(/<[^>]*>/g, '');
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => ({ field: e.path, message: e.msg })) });
  }
  next();
};

const validateLanguage = body('language').isIn(['uk', 'ru']).withMessage('Language must be uk or ru');
const validateTelegramId = body('telegram_id').isInt({ min: 1 }).withMessage('telegram_id must be a positive integer');
const validateReferralType = body('referral_type').isIn([1, 2, 3]).withMessage('referral_type must be 1, 2, or 3');
const validateAction = body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject');
const validateCasino = body('casino').isIn(['topmatch', 'betline']).withMessage('casino must be topmatch or betline');
const validateLevel = body('level').isIn([1, 2, 3]).withMessage('level must be 1, 2, or 3');

// TRC20 (TRON) address validation: starts with T, 34 chars, base58
const validateTrc20Address = (field) =>
  body(field)
    .trim()
    .matches(/^T[1-9A-HJ-NP-Za-km-z]{33}$/)
    .withMessage(`${field} must be a valid TRC20 (TRON) address`);

const ALLOWED_STATUSES = ['pending', 'verified', 'rejected', 'banned'];

const sanitizeContestFields = (field) =>
  body(field).trim().isLength({ max: 500 }).withMessage(`${field} max 500 characters`).customSanitizer(v => sanitizeHtml(v));

const sanitizeMessageFields = (field) =>
  body(field).trim().isLength({ max: 1000 }).withMessage(`${field} max 1000 characters`).customSanitizer(v => sanitizeHtml(v));

// Rate limiters
const authInitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── FILE UPLOAD ───

router.post('/upload', verifyTelegramAuth, verifyAdminAuth, adminLimiter, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/banners/${req.file.filename}`;
    res.json({ url });
  });
});

// ─── CRON ───
// Drives contest maintenance on serverless deployments (Vercel Cron) where the
// long-lived setInterval in index.js does not run. Accepts Vercel's own cron
// requests (x-vercel-cron header) or a Bearer CRON_SECRET for manual/external
// triggers.
const handleCron = async (req, res) => {
  const isVercelCron = !!req.headers['x-vercel-cron'];
  const secret = process.env.CRON_SECRET;
  const authed = secret && req.headers['authorization'] === `Bearer ${secret}`;
  if (!isVercelCron && !authed) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const results = await runContestMaintenance();
    res.json({ ok: true, finalized: results });
  } catch (err) {
    console.error('Cron run error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
router.get('/cron/run', handleCron);
router.post('/cron/run', handleCron);

// ─── AUTH ───

router.post('/auth/init', authInitLimiter, [
  validateTelegramId,
  body('telegram_username').optional().trim().isString(),
  validateLanguage,
], handleValidationErrors, async (req, res) => {
  try {
    const { telegram_id, telegram_username, language } = req.body;
    console.log('/auth/init called: telegram_id=%s, username=%s, lang=%s', String(telegram_id), telegram_username, language);
    const isAdmin = isAdminId(telegram_id);
    let result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [telegram_id]);
    let user;
    if (result.rows.length === 0) {
      result = await pool.query(
        'INSERT INTO users (telegram_id, telegram_username, language, status, level_topmatch, level_betline) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [telegram_id, telegram_username || null, language, 'verified', isAdmin ? 1 : null, isAdmin ? 1 : null]
      );
      user = result.rows[0];
    } else {
      const needsVerify = isAdmin && result.rows[0].status !== 'verified';
      result = await pool.query(
        `UPDATE users SET telegram_username = $1,
         status = CASE WHEN $2::boolean THEN 'verified' ELSE status END
         WHERE telegram_id = $3 RETURNING *`,
        [telegram_username || null, needsVerify, telegram_id]
      );
      user = result.rows[0];
    }
    res.json({
      id: user.id,
      telegram_id: user.telegram_id,
      telegram_username: user.telegram_username,
      language: user.language,
      status: user.status,
      level_topmatch: user.level_topmatch,
      level_betline: user.level_betline,
      casino_id_topmatch: user.casino_id_topmatch,
      casino_id_betline: user.casino_id_betline,
      wallet_topmatch: user.wallet_topmatch,
      wallet_betline: user.wallet_betline,
      created_at: user.created_at,
      is_admin: isAdminId(telegram_id),
      token: generateSessionToken(telegram_id),
    });
  } catch (err) {
    console.error('Auth init error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/auth/language', verifyTelegramAuth, [
  validateLanguage,
], handleValidationErrors, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET language = $1 WHERE telegram_id = $2 RETURNING *',
      [req.body.language, req.telegramUser.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: result.rows[0].id,
      is_admin: isAdminId(req.telegramUser.id),
      telegram_id: result.rows[0].telegram_id,
      telegram_username: result.rows[0].telegram_username,
      language: result.rows[0].language,
      status: result.rows[0].status,
      level_topmatch: result.rows[0].level_topmatch,
      level_betline: result.rows[0].level_betline,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_betline: result.rows[0].casino_id_betline,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_betline: result.rows[0].wallet_betline,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Language update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user/me', verifyTelegramAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    res.json({
      id: user.id,
      telegram_id: user.telegram_id,
      telegram_username: user.telegram_username,
      language: user.language,
      status: user.status,
      level_topmatch: user.level_topmatch,
      level_betline: user.level_betline,
      casino_id_topmatch: user.casino_id_topmatch,
      casino_id_betline: user.casino_id_betline,
      wallet_topmatch: user.wallet_topmatch,
      wallet_betline: user.wallet_betline,
      created_at: user.created_at,
      is_admin: isAdminId(req.telegramUser.id),
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/casinos', verifyTelegramAuth, (req, res) => {
  const casinos = require('./casinos');
  res.json(Object.values(casinos).map(c => ({
    id: c.id,
    name_uk: c.name_uk,
    name_ru: c.name_ru,
    photo: `/photos/${c.photo}`,
  })));
});

// ─── REFERRAL CHECK API ───
// Called by the casino's backend (or admin tool) to confirm a user as a referral.
// Protected by REFERRAL_API_KEY in the Authorization header.
// Example: POST /api/referral/check
// Body: { "casino": "topmatch", "casino_account_id": "12345", "telegram_id": 822479618 }
router.post('/referral/check', async (req, res) => {
  try {
    const expectedKey = process.env.REFERRAL_API_KEY;
    if (!expectedKey) {
      console.error('REFERRAL_API_KEY not configured — referral check endpoint unavailable');
      return res.status(503).json({ error: 'Referral API is not configured on this server' });
    }
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    const { casino, casino_account_id, telegram_id } = req.body;
    if (!casino || !['topmatch', 'betline'].includes(casino)) {
      return res.status(400).json({ error: 'Valid casino required (topmatch or betline)' });
    }
    if (!casino_account_id || !String(casino_account_id).trim()) {
      return res.status(400).json({ error: 'casino_account_id is required' });
    }

    const accountId = String(casino_account_id).trim();

    await pool.query(
      `INSERT INTO confirmed_referrals (casino, casino_account_id, sub_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (casino, casino_account_id)
       DO UPDATE SET sub_id = COALESCE(EXCLUDED.sub_id, confirmed_referrals.sub_id)`,
      [casino, accountId, telegram_id ? String(telegram_id) : null]
    );

    let matchedUser = null;
    if (telegram_id) {
      const idCol = `casino_id_${casino}`;
      const lvlCol = `level_${casino}`;
      const result = await pool.query(
        `UPDATE users
         SET ${idCol} = COALESCE(${idCol}, $1),
             ${lvlCol} = COALESCE(${lvlCol}, 1),
             status = 'verified'
         WHERE telegram_id = $2 RETURNING *`,
        [accountId, telegram_id]
      );
      if (result.rows.length > 0) {
        matchedUser = result.rows[0];
        await notifyUser(
          matchedUser.telegram_id,
          'Вітаємо! Ваш акаунт підтверджено як реферала. Рівень 1 активовано.',
          'Поздравляем! Ваш аккаунт подтвержден как реферал. Уровень 1 активирован.',
          matchedUser.language
        );
      }
    }

    res.json({ success: true, matched: !!matchedUser, user: matchedUser ? { id: matchedUser.id, telegram_id: matchedUser.telegram_id, level: matchedUser[`level_${casino}`] } : null });
  } catch (err) {
    console.error('Referral check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DEPOSIT API ───
// Called by the casino's backend (or admin tool) to report a user deposit.
// Protected by REFERRAL_API_KEY in the Authorization header.
// Example: POST /api/deposit
// Body: { "casino": "topmatch", "casino_account_id": "12345", "amount": 100.50 }
router.post('/deposit', async (req, res) => {
  try {
    const expectedKey = process.env.REFERRAL_API_KEY;
    if (!expectedKey) {
      console.error('REFERRAL_API_KEY not configured — deposit endpoint unavailable');
      return res.status(503).json({ error: 'Deposit API is not configured on this server' });
    }
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    if (apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    const { casino, casino_account_id, amount } = req.body;
    if (!casino || !['topmatch', 'betline'].includes(casino)) {
      return res.status(400).json({ error: 'Valid casino required (topmatch or betline)' });
    }
    if (!casino_account_id || !String(casino_account_id).trim()) {
      return res.status(400).json({ error: 'casino_account_id is required' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    const accountId = String(casino_account_id).trim();
    const lvlCol = `level_${casino}`;

    // Find user by casino account id
    const idCol = `casino_id_${casino}`;
    const userResult = await pool.query(
      `SELECT id, telegram_id, language, ${lvlCol}, ${idCol} FROM users WHERE ${idCol} = $1`,
      [accountId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User with this casino account ID not found' });
    }

    const user = userResult.rows[0];

    // Record the deposit
    await pool.query(
      'INSERT INTO deposits (user_id, casino, casino_account_id, amount) VALUES ($1, $2, $3, $4)',
      [user.id, casino, accountId, parsedAmount]
    );

    // Get threshold from admin settings
    const thresholdKey = `deposit_threshold_${casino}`;
    const thresholdResult = await pool.query(
      'SELECT value FROM admin_settings WHERE key = $1',
      [thresholdKey]
    );
    const threshold = parseFloat(thresholdResult.rows[0]?.value || '1000');

    // Calculate total deposits
    const totalResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM deposits WHERE user_id = $1 AND casino = $2',
      [user.id, casino]
    );
    const totalDeposits = parseFloat(totalResult.rows[0].total);

    let newLevel = null;
    if (totalDeposits >= threshold) {
      newLevel = 3;
    } else if (parsedAmount > 0) {
      newLevel = 2;
    }

    if (newLevel && (!user[lvlCol] || user[lvlCol] < newLevel)) {
      await pool.query(
        `UPDATE users SET ${lvlCol} = $1 WHERE id = $2`,
        [newLevel, user.id]
      );

      const levelMsg = newLevel === 2
        ? (user.language === 'uk' ? 'Вітаємо! Вам нараховано рівень 2 за перший депозит.' : 'Поздравляем! Вам присвоен уровень 2 за первый депозит.')
        : (user.language === 'uk' ? `Вітаємо! Вам нараховано рівень 3. Загальна сума депозитів: ${totalDeposits}` : `Поздравляем! Вам присвоен уровень 3. Общая сумма депозитов: ${totalDeposits}`);
      await notifyUser(user.telegram_id, levelMsg, levelMsg, user.language);
    }

    res.json({
      success: true,
      deposit: { casino, amount: parsedAmount },
      total_deposits: totalDeposits,
      level: newLevel || user[lvlCol],
    });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── USER DEPOSITS ───

router.get('/user/deposits', verifyTelegramAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    const result = await pool.query(
      `SELECT casino, COUNT(*) as transaction_count, COALESCE(SUM(amount), 0) as total_amount
       FROM deposits WHERE user_id = $1
       GROUP BY casino ORDER BY casino`,
      [userId]
    );

    const thresholds = await pool.query(
      "SELECT key, value FROM admin_settings WHERE key LIKE 'deposit_threshold_%'"
    );
    const thresholdMap = {};
    for (const row of thresholds.rows) {
      thresholdMap[row.key.replace('deposit_threshold_', '')] = parseFloat(row.value);
    }

    const data = result.rows.map(r => ({
      casino: r.casino,
      transaction_count: parseInt(r.transaction_count),
      total_amount: parseFloat(r.total_amount),
      threshold: thresholdMap[r.casino] || 1000,
    }));

    // Also include casinos with no deposits
    const casinos = require('./casinos');
    for (const [id] of Object.entries(casinos)) {
      if (!data.find(d => d.casino === id)) {
        data.push({
          casino: id,
          transaction_count: 0,
          total_amount: 0,
          threshold: thresholdMap[id] || 1000,
        });
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Get deposits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/casino/:casinoId/me', verifyTelegramAuth, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.params.casinoId];
    if (!casino) return res.status(404).json({ error: 'Casino not found' });
    const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const level = user[casino.level_column];

    // Tag the referral link with this user's Telegram id (sub_id) so the
    // referral check API can map a signup back to this exact user.
    let referralLink = casino.referral_link;
    if (referralLink) {
      const sep = referralLink.includes('?') ? '&' : '?';
      referralLink = `${referralLink}${sep}sub_id=${req.telegramUser.id}`;
    }

    res.json({
      casino_id: casino.id,
      level,
      casino_account_id: user[casino.casino_id_column],
      wallet: user[`wallet_${req.params.casinoId}`],
      referral_link: referralLink,
    });
  } catch (err) {
    console.error('Casino me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/casino/:casinoId/submit-id', verifyTelegramAuth, [
  body('casino_account_id')
    .trim()
    .isAlphanumeric()
    .isLength({ max: 32 })
    .withMessage('casino_account_id must be alphanumeric and max 32 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.params.casinoId];
    if (!casino) return res.status(404).json({ error: 'Casino not found' });

    const userIdResult = await pool.query('SELECT id, telegram_id, telegram_username, language, status, ' + casino.casino_id_column + ' FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userIdResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userIdResult.rows[0];
    const newAccountId = String(req.body.casino_account_id).trim();

    // Auto-check if this casino account ID is a confirmed referral
    const referralCheck = await pool.query(
      'SELECT * FROM confirmed_referrals WHERE casino = $1 AND casino_account_id = $2',
      [req.params.casinoId, newAccountId]
    );

    if (referralCheck.rows.length > 0) {
      // User IS a referral - auto-approve and set level 1
      await pool.query(
        `UPDATE users SET ${casino.casino_id_column} = $1, ${casino.level_column} = 1, status = 'verified' WHERE id = $2`,
        [newAccountId, user.id]
      );

      await notifyUser(
        user.telegram_id,
        `Вітаємо! Ваш ID ${newAccountId} для ${casino.id === 'topmatch' ? 'TopMatch' : 'Betline'} підтверджено. Рівень 1 активовано.`,
        `Поздравляем! Ваш ID ${newAccountId} для ${casino.id === 'topmatch' ? 'TopMatch' : 'Betline'} подтвержден. Уровень 1 активирован.`,
        user.language
      );

      return res.json({ status: 'verified', level: 1, casino_account_id: newAccountId, auto_approved: true });
    }

    // User is NOT a referral - reject with notification
    await notifyUser(
      user.telegram_id,
      `На жаль, ID ${newAccountId} для ${casino.id === 'topmatch' ? 'TopMatch' : 'Betline'} не знайдено як реферала. Переконайтеся, що ви зареєструвалися за нашим реферальним посиланням, та спробуйте ще раз.`,
      `К сожалению, ID ${newAccountId} для ${casino.id === 'topmatch' ? 'TopMatch' : 'Betline'} не найден как реферал. Убедитесь, что вы зарегистрировались по нашей реферальной ссылке, и попробуйте снова.`,
      user.language
    );

    await notifyAdminChange(user, casino.casino_id_column, newAccountId, casino.id === 'topmatch' ? 'TopMatch' : 'Betline');

    res.status(403).json({ error: 'Casino account ID not recognized as a referral. Make sure you registered using our referral link.' });
  } catch (err) {
    console.error('Submit casino ID error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/casino/:casinoId/submit-wallet', verifyTelegramAuth, [
  body('wallet_address')
    .trim()
    .isLength({ min: 10, max: 255 })
    .withMessage('wallet_address must be between 10 and 255 characters'),
], handleValidationErrors, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.params.casinoId];
    if (!casino) return res.status(404).json({ error: 'Casino not found' });

    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];

    const walletColumn = `wallet_${req.params.casinoId}`;

    const existing = await pool.query(
      "SELECT id FROM pending_changes WHERE user_id = $1 AND field = $2 AND status = 'pending'",
      [user.id, walletColumn]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending change for this field' });
    }

    await pool.query(
      `INSERT INTO pending_changes (user_id, change_type, casino, field, old_value, new_value)
       VALUES ($1, 'wallet', $2, $3, $4, $5)`,
      [user.id, req.params.casinoId, walletColumn, user[walletColumn], req.body.wallet_address]
    );

    const casinoName = casino.id === 'topmatch' ? 'TopMatch' : 'Betline';
    await notifyAdminChange(user, walletColumn, req.body.wallet_address, casinoName);

    res.json({ status: 'pending', field: walletColumn, new_value: req.body.wallet_address });
  } catch (err) {
    console.error('Submit wallet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User wallet submission endpoint
router.post('/wallet/:casinoId/submit', verifyTelegramAuth, [
  validateCasino,
  validateTrc20Address('wallet_address'),
  body('casino').custom((value, { req }) => value === req.params.casinoId).withMessage('casino must match the URL parameter'),
], handleValidationErrors, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.params.casinoId];
    if (!casino) return res.status(404).json({ error: 'Casino not found' });

    const walletColumn = casino.id === 'topmatch' ? 'wallet_topmatch' : 'wallet_betline';

    const userResult = await pool.query('SELECT id, telegram_username, ' + walletColumn + ' FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const oldValue = user[walletColumn];

    const existing = await pool.query(
      "SELECT id FROM pending_changes WHERE user_id = $1 AND field = $2 AND status = 'pending'",
      [user.id, walletColumn]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending change for this field' });
    }

    await pool.query(
      'INSERT INTO pending_changes (user_id, field, old_value, new_value) VALUES ($1, $2, $3, $4)',
      [user.id, walletColumn, oldValue, req.body.wallet_address]
    );

    const casinoName = casino.id === 'topmatch' ? 'TopMatch' : 'Betline';
    await notifyAdminChange(user, walletColumn, req.body.wallet_address, casinoName);

    res.json({ status: 'pending', field: walletColumn, new_value: req.body.wallet_address });
  } catch (err) {
    console.error('Submit wallet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending changes for current user
router.get('/user/pending-changes', verifyTelegramAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      "SELECT id, field, old_value, new_value, status, created_at FROM pending_changes WHERE user_id = $1 ORDER BY created_at DESC",
      [userResult.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending changes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CONTESTS ───

router.get('/contests', verifyTelegramAuth, async (req, res) => {
  try {
    const { casino } = req.query;
    const casinos = require('./casinos');
    if (!casino || !casinos[casino]) {
      return res.status(400).json({ error: 'Valid casino param required' });
    }
    const userResult = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const casinoConfig = casinos[casino];
    const userLevel = user[casinoConfig.level_column];
    if (!userLevel) return res.json([]);

    const walletColumn = casino === 'topmatch' ? 'wallet_topmatch' : 'wallet_betline';
    if (!user[walletColumn]) {
      return res.status(403).json({ error: 'You must set a TRC20 USDT wallet for this casino before participating in contests' });
    }

    const result = await pool.query(
      `SELECT * FROM contests WHERE casino = $1 AND eligible_referral_type = $2 AND status = 'active' AND end_date > NOW() ORDER BY end_date ASC`,
      [casino, userLevel]
    );
    const lang = user.language;

    const contestsWithJoin = await Promise.all(result.rows.map(async (c) => {
      const joinResult = await pool.query('SELECT id FROM contest_participants WHERE contest_id = $1 AND user_id = $2', [c.id, user.id]);
      const countResult = await pool.query('SELECT COUNT(*) FROM contest_participants WHERE contest_id = $1', [c.id]);
      return {
        id: c.id,
        title: lang === 'uk' ? c.title_uk : c.title_ru,
        description: lang === 'uk' ? c.description_uk : c.description_ru,
        prize: lang === 'uk' ? c.prize_uk : c.prize_ru,
        eligible_level: c.eligible_referral_type,
        casino: c.casino,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        winner_count: c.winner_count || 1,
        banner_image: c.banner_image,
        joined: joinResult.rows.length > 0,
        participant_count: parseInt(countResult.rows[0].count),
        started: new Date(c.start_date) <= new Date(),
      };
    }));
    res.json(contestsWithJoin);
  } catch (err) {
    console.error('Get contests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/contests/history', verifyTelegramAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    const { casino } = req.query;
    if (!casino || !['topmatch', 'betline'].includes(casino)) {
      return res.status(400).json({ error: 'casino query parameter required (topmatch or betline)' });
    }

    const levelColumn = casino === 'topmatch' ? 'level_topmatch' : 'level_betline';
    const userLevel = user[levelColumn];
    if (!userLevel) return res.json([]);

    const result = await pool.query(
      `SELECT * FROM contests c
       WHERE c.casino = $1 AND c.eligible_referral_type = $2
       AND c.status IN ('ended', 'winner_picked')
       ORDER BY c.end_date DESC`,
      [casino, userLevel]
    );

    const lang = user.language;
    const contests = await Promise.all(result.rows.map(async (c) => {
      let winners = [];
      if (c.status === 'winner_picked') {
        const winnerResult = await pool.query(
          `SELECT u.telegram_username FROM contest_winners cw
           JOIN users u ON u.id = cw.user_id
           WHERE cw.contest_id = $1`,
          [c.id]
        );
        winners = winnerResult.rows.map(r => ({ telegram_username: r.telegram_username }));
      }
      return {
        id: c.id,
        title: lang === 'uk' ? c.title_uk : c.title_ru,
        description: lang === 'uk' ? c.description_uk : c.description_ru,
        prize: lang === 'uk' ? c.prize_uk : c.prize_ru,
        eligible_referral_type: c.eligible_referral_type,
        casino: c.casino,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        winners,
      };
    }));
    res.json(contests);
  } catch (err) {
    console.error('Contest history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CONTEST JOIN/LEAVE ───

router.post('/contests/:id/join', verifyTelegramAuth, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    const contest = await pool.query("SELECT * FROM contests WHERE id = $1 AND status = 'active' AND start_date <= NOW() AND end_date > NOW()", [contestId]);
    if (contest.rows.length === 0) return res.status(404).json({ error: 'Contest not found, not active, or not started yet' });

    await pool.query(
      'INSERT INTO contest_participants (contest_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [contestId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Join contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/contests/:id/leave', verifyTelegramAuth, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const userResult = await pool.query('SELECT id FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const userId = userResult.rows[0].id;

    await pool.query(
      'DELETE FROM contest_participants WHERE contest_id = $1 AND user_id = $2',
      [contestId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Leave contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMIN ───

router.get('/admin/users', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const { status, level_topmatch, level_betline, search, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status && ALLOWED_STATUSES.includes(status)) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (search && String(search).trim()) {
      const term = String(search).trim().replace(/^@/, '');
      conditions.push(`(telegram_username ILIKE $${paramIndex} OR CAST(telegram_id AS TEXT) ILIKE $${paramIndex} OR casino_id_topmatch ILIKE $${paramIndex} OR casino_id_betline ILIKE $${paramIndex})`);
      params.push(`%${term}%`);
      paramIndex++;
    }
    if (level_topmatch && ['1', '2', '3'].includes(level_topmatch)) {
      conditions.push(`level_topmatch = $${paramIndex++}`);
      params.push(parseInt(level_topmatch));
    }
    if (level_betline && ['1', '2', '3'].includes(level_betline)) {
      conditions.push(`level_betline = $${paramIndex++}`);
      params.push(parseInt(level_betline));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT id, telegram_id, telegram_username, language, status, level_topmatch, level_betline, casino_id_topmatch, casino_id_betline, wallet_topmatch, wallet_betline, created_at
       FROM users ${whereClause}
       ORDER BY status = 'pending' DESC, created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      users: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/users/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(req.params.id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin get user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/:id/verify', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  validateAction,
], handleValidationErrors, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { action } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const newStatus = action === 'approve' ? 'verified' : 'rejected';
    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
      [newStatus, userId]
    );

    const lang = user.language;
    if (action === 'approve') {
      await notifyUser(
        user.telegram_id,
        'Вітаємо! Ваш акаунт казино підтверджено. Тепер ви маєте доступ до конкурсів та реферального посилання.',
        'Поздравляем! Ваш аккаунт казино подтвержден. Теперь у вас есть доступ к конкурсам и реферальной ссылке.',
        lang
      );
    } else {
      await notifyUser(
        user.telegram_id,
        'На жаль, ваш акаунт казино було відхилено. Ви можете подати новий Casino ID.',
        'К сожалению, ваш аккаунт казино был отклонен. Вы можете отправить новый Casino ID.',
        lang
      );
    }

    res.json({
      id: result.rows[0].id,
      telegram_id: result.rows[0].telegram_id,
      telegram_username: result.rows[0].telegram_username,
      language: result.rows[0].language,
      status: result.rows[0].status,
      level_topmatch: result.rows[0].level_topmatch,
      level_betline: result.rows[0].level_betline,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_betline: result.rows[0].casino_id_betline,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_betline: result.rows[0].wallet_betline,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Admin verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/:id/set-level', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  validateCasino,
  validateLevel,
], handleValidationErrors, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.body.casino];
    const userId = parseInt(req.params.id);
    const result = await pool.query(
      `UPDATE users SET ${casino.level_column} = $1 WHERE id = $2 RETURNING *`,
      [req.body.level, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    res.json({
      id: u.id,
      telegram_id: u.telegram_id,
      telegram_username: u.telegram_username,
      language: u.language,
      status: u.status,
      level_topmatch: u.level_topmatch,
      level_betline: u.level_betline,
      casino_id_topmatch: u.casino_id_topmatch,
      casino_id_betline: u.casino_id_betline,
      wallet_topmatch: u.wallet_topmatch,
      wallet_betline: u.wallet_betline,
      created_at: u.created_at,
    });
  } catch (err) {
    console.error('Set level error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/:id/ban', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
      ['banned', userId]
    );

    await notifyUser(
      user.telegram_id,
      'Ваш акаунт заблоковано. Якщо ви вважаєте, що це помилка, зверніться до адміністратора.',
      'Ваш аккаунт заблокирован. Если вы считаете, что это ошибка, обратитесь к администратору.',
      user.language
    );
    res.json({
      id: result.rows[0].id,
      telegram_id: result.rows[0].telegram_id,
      telegram_username: result.rows[0].telegram_username,
      language: result.rows[0].language,
      status: result.rows[0].status,
      level_topmatch: result.rows[0].level_topmatch,
      level_betline: result.rows[0].level_betline,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_betline: result.rows[0].casino_id_betline,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_betline: result.rows[0].wallet_betline,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Ban user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/users/:id/unban', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const result = await pool.query(
      'UPDATE users SET status = $1 WHERE id = $2 RETURNING *',
      ['verified', userId]
    );

    await notifyUser(
      user.telegram_id,
      'Ваш акаунт розблоковано. Ласкаво просимо назад!',
      'Ваш аккаунт разблокирован. Добро пожаловать назад!',
      user.language
    );

    res.json({
      id: result.rows[0].id,
      telegram_id: result.rows[0].telegram_id,
      telegram_username: result.rows[0].telegram_username,
      language: result.rows[0].language,
      status: result.rows[0].status,
      level_topmatch: result.rows[0].level_topmatch,
      level_betline: result.rows[0].level_betline,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_betline: result.rows[0].casino_id_betline,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_betline: result.rows[0].wallet_betline,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/contests', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  sanitizeContestFields('title'),
  sanitizeContestFields('description'),
  sanitizeContestFields('prize'),
  validateReferralType,
  validateCasino,
  body('start_date').optional({ nullable: true }),
  body('end_date').optional({ nullable: true }),
  body('winner_count').optional({ nullable: true }).isInt({ min: 1, max: 100 }).withMessage('winner_count must be 1-100'),
  body('banner_image').optional({ nullable: true }).trim().isLength({ max: 500 }),
], handleValidationErrors, async (req, res) => {
  try {
    // Single-language content: the same value is stored in both language
    // columns so every user sees identical text regardless of app language.
    const { title, description, prize, referral_type, casino, winner_count, banner_image } = req.body;
    const start_date = req.body.start_date || new Date().toISOString();
    const endObj = new Date();
    endObj.setHours(23, 59, 59, 999);
    const end_date = req.body.end_date || endObj.toISOString();
    const result = await pool.query(
      `INSERT INTO contests (title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, eligible_referral_type, casino, start_date, end_date, winner_count, banner_image)
       VALUES ($1, $1, $2, $2, $3, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, prize, referral_type, casino, start_date, end_date, winner_count || 1, banner_image || null]
    );
    await pool.query(
      'INSERT INTO contest_reminders (contest_id) VALUES ($1)',
      [result.rows[0].id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/contests/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  sanitizeContestFields('title'),
  sanitizeContestFields('description'),
  sanitizeContestFields('prize'),
  validateReferralType,
  validateCasino,
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('winner_count').optional({ nullable: true }).isInt({ min: 1, max: 100 }).withMessage('winner_count must be 1-100'),
  body('banner_image').optional({ nullable: true }).trim().isLength({ max: 500 }),
], handleValidationErrors, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const { title, description, prize, referral_type, casino, start_date, end_date, winner_count, banner_image } = req.body;

    const existing = await pool.query('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    if (existing.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Can only edit active contests' });
    }

    const result = await pool.query(
      `UPDATE contests SET title_uk=$1, title_ru=$1, description_uk=$2, description_ru=$2,
       prize_uk=$3, prize_ru=$3, eligible_referral_type=$4, casino=$5, start_date=$6, end_date=$7,
       winner_count=$8, banner_image=$9
       WHERE id=$10 RETURNING *`,
      [title, description, prize, referral_type, casino, start_date, end_date, winner_count || 1, banner_image || null, contestId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/contests/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const existing = await pool.query('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    await pool.query('DELETE FROM contests WHERE id = $1', [contestId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual winner pick — normally winners are chosen automatically when a
// contest reaches its end_date (see contestJobs). This is a fallback that
// lets an admin force the draw early, or re-run it for a contest that ended
// with no eligible participants.
router.post('/admin/contests/:id/pick-winner', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const contestResult = await pool.query('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (contestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    const contest = contestResult.rows[0];

    if (contest.status === 'winner_picked') {
      return res.status(403).json({ error: 'Winner already picked for this contest' });
    }

    // Claim the contest so the cron job cannot finalize it concurrently.
    const claim = await pool.query(
      "UPDATE contests SET status = 'finalizing' WHERE id = $1 AND status IN ('active', 'ended') RETURNING *",
      [contestId]
    );
    if (claim.rows.length === 0) {
      return res.status(409).json({ error: 'Contest is being processed, try again' });
    }

    let result;
    try {
      result = await finalizeContest(claim.rows[0]);
    } catch (e) {
      await pool.query("UPDATE contests SET status = 'active' WHERE id = $1 AND status = 'finalizing'", [contestId]);
      throw e;
    }

    if (result.winners.length === 0) {
      return res.status(404).json({ error: 'No eligible users found' });
    }
    res.json({ winners: result.winners });
  } catch (err) {
    console.error('Pick winner error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/broadcast', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  sanitizeMessageFields('message'),
  body('target_referral_type').optional({ nullable: true }).custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = parseInt(value);
    return [1, 2, 3].includes(num);
  }).withMessage('target_referral_type must be 1, 2, 3, or null'),
], handleValidationErrors, async (req, res) => {
  try {
    const { message, target_referral_type } = req.body;
    let query = "SELECT * FROM users WHERE status = 'verified'";
    const params = [];

    if (target_referral_type !== null && target_referral_type !== undefined && target_referral_type !== '') {
      query += ' AND (level_topmatch = $1 OR level_betline = $1)';
      params.push(parseInt(target_referral_type));
    }

    const usersResult = await pool.query(query, params);
    let sentCount = 0;

    for (const user of usersResult.rows) {
      try {
        await notifyUser(user.telegram_id, message, message, user.language);
        sentCount++;
      } catch (e) {
        console.error(`Failed to send broadcast to ${user.telegram_id}:`, e);
      }
    }

    await pool.query(
      'INSERT INTO broadcasts (message_uk, message_ru, target_level) VALUES ($1, $1, $2)',
      [message, target_referral_type ? parseInt(target_referral_type) : null]
    );

    res.json({ sentCount, totalUsers: usersResult.rows.length });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/contests', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const { casino } = req.query;
    let query = 'SELECT * FROM contests';
    const params = [];
    if (casino && ['topmatch', 'betline'].includes(casino)) {
      query += ' WHERE casino = $1';
      params.push(casino);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    // Expose single-language aliases (content is mirrored across _uk/_ru).
    res.json(result.rows.map(c => ({
      ...c,
      title: c.title_uk,
      description: c.description_uk,
      prize: c.prize_uk,
      eligible_level: c.eligible_referral_type,
    })));
  } catch (err) {
    console.error('Admin contests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── WINNERS REGISTRY ───

// Admin: every contest win, newest first, with winner + contest details.
router.get('/admin/winners', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const { casino } = req.query;
    const params = [];
    let where = '';
    if (casino && ['topmatch', 'betline'].includes(casino)) {
      params.push(casino);
      where = `WHERE c.casino = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT cw.id, cw.picked_at,
              c.id AS contest_id, c.title_uk AS contest_title, c.prize_uk AS prize,
              c.casino, c.eligible_referral_type AS level,
              u.id AS user_id, u.telegram_id, u.telegram_username,
              CASE WHEN c.casino = 'topmatch' THEN u.casino_id_topmatch ELSE u.casino_id_betline END AS casino_account_id,
              CASE WHEN c.casino = 'topmatch' THEN u.wallet_topmatch ELSE u.wallet_betline END AS wallet
       FROM contest_winners cw
       JOIN contests c ON c.id = cw.contest_id
       JOIN users u ON u.id = cw.user_id
       ${where}
       ORDER BY cw.picked_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin winners error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User: the current user's own wins.
router.get('/user/winnings', verifyTelegramAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, language FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const lang = user.language;

    const result = await pool.query(
      `SELECT cw.id, cw.picked_at, c.id AS contest_id, c.casino, c.eligible_referral_type AS level,
              ${lang === 'uk' ? 'c.title_uk' : 'c.title_ru'} AS title,
              ${lang === 'uk' ? 'c.prize_uk' : 'c.prize_ru'} AS prize
       FROM contest_winners cw
       JOIN contests c ON c.id = cw.contest_id
       WHERE cw.user_id = $1
       ORDER BY cw.picked_at DESC`,
      [user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('User winnings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMIN: DEPOSITS REGISTRY ───

// Admin: every user that has deposits, with totals per casino (from the
// deposit API records). Includes the level-3 threshold for context.
router.get('/admin/deposits', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.telegram_id, u.telegram_username,
              d.casino, COUNT(*) AS transaction_count, COALESCE(SUM(d.amount), 0) AS total_amount
       FROM deposits d
       JOIN users u ON u.id = d.user_id
       GROUP BY u.id, u.telegram_id, u.telegram_username, d.casino
       ORDER BY total_amount DESC`
    );

    const thresholds = await pool.query(
      "SELECT key, value FROM admin_settings WHERE key LIKE 'deposit_threshold_%'"
    );
    const thresholdMap = {};
    for (const row of thresholds.rows) {
      thresholdMap[row.key.replace('deposit_threshold_', '')] = parseFloat(row.value);
    }

    // Group rows into one entry per user with per-casino totals.
    const byUser = new Map();
    for (const r of result.rows) {
      if (!byUser.has(r.user_id)) {
        byUser.set(r.user_id, {
          user_id: r.user_id,
          telegram_id: r.telegram_id,
          telegram_username: r.telegram_username,
          casinos: {},
          grand_total: 0,
        });
      }
      const entry = byUser.get(r.user_id);
      const amount = parseFloat(r.total_amount);
      entry.casinos[r.casino] = {
        total_amount: amount,
        transaction_count: parseInt(r.transaction_count),
        threshold: thresholdMap[r.casino] || 1000,
      };
      entry.grand_total += amount;
    }

    const data = Array.from(byUser.values()).sort((a, b) => b.grand_total - a.grand_total);
    res.json({ users: data, thresholds: thresholdMap });
  } catch (err) {
    console.error('Admin deposits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMIN: PENDING CHANGES ───

router.get('/admin/pending-changes', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pc.*, u.telegram_id, u.telegram_username
       FROM pending_changes pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.status = 'pending'
       ORDER BY pc.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin pending changes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/pending-changes/:id/approve', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const changeId = parseInt(req.params.id);
    const changeResult = await pool.query("SELECT pc.*, u.telegram_id, u.language FROM pending_changes pc JOIN users u ON u.id = pc.user_id WHERE pc.id = $1 AND pc.status = 'pending'", [changeId]);
    if (changeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pending change not found or already processed' });
    }
    const change = changeResult.rows[0];

    await pool.query(
      `UPDATE users SET ${change.field} = $1 WHERE id = $2`,
      [change.new_value, change.user_id]
    );

    // If it's a casino_id, also set the level if not set
    if (change.field.startsWith('casino_id_')) {
      const levelColumn = change.field === 'casino_id_topmatch' ? 'level_topmatch' : 'level_betline';
      await pool.query(
        `UPDATE users SET ${levelColumn} = COALESCE(${levelColumn}, 1) WHERE id = $1 AND ${levelColumn} IS NULL`,
        [change.user_id]
      );
    }

    await pool.query(
      "UPDATE pending_changes SET status = 'approved', reviewed_at = NOW() WHERE id = $1",
      [changeId]
    );

    const casinoName = change.field.startsWith('casino_id_topmatch') || change.field.startsWith('wallet_topmatch') ? 'TopMatch' : 'Betline';
    const fieldLabel = change.field.startsWith('casino_id') ? `${casinoName} ID` : `${casinoName} TRC20`;
    const msg = change.language === 'uk'
      ? `✅ Ваш запит на зміну ${fieldLabel} було підтверджено адміністратором. Нове значення: ${change.new_value}`
      : `✅ Ваш запрос на изменение ${fieldLabel} был подтвержден администратором. Новое значение: ${change.new_value}`;
    try { await notifyUser(change.telegram_id, msg, msg, change.language); } catch (e) { console.error('Notify approval error:', e); }

    res.json({ success: true });
  } catch (err) {
    console.error('Approve change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/pending-changes/:id/reject', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const changeId = parseInt(req.params.id);
    const changeResult = await pool.query("SELECT pc.*, u.telegram_id, u.language FROM pending_changes pc JOIN users u ON u.id = pc.user_id WHERE pc.id = $1 AND pc.status = 'pending'", [changeId]);
    if (changeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pending change not found or already processed' });
    }
    const change = changeResult.rows[0];

    await pool.query(
      "UPDATE pending_changes SET status = 'rejected', reviewed_at = NOW() WHERE id = $1",
      [changeId]
    );

    const casinoName = change.field.startsWith('casino_id_topmatch') || change.field.startsWith('wallet_topmatch') ? 'TopMatch' : 'Betline';
    const fieldLabel = change.field.startsWith('casino_id') ? `${casinoName} ID` : `${casinoName} TRC20`;
    const msg = change.language === 'uk'
      ? `❌ Ваш запит на зміну ${fieldLabel} було відхилено адміністратором.`
      : `❌ Ваш запрос на изменение ${fieldLabel} был отклонен администратором.`;
    try {
      const { notifyUser } = require('./bot');
      await notifyUser(change.telegram_id, msg, msg, change.language);
    } catch (e) { console.error('Notify rejection error:', e); }

    res.json({ success: true });
  } catch (err) {
    console.error('Reject change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/stats', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM users');
    const pendingResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'pending'");
    const verifiedResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'verified'");
    const bannedResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'banned'");
    const type1TopResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_topmatch = 1');
    const type2TopResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_topmatch = 2');
    const type3TopResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_topmatch = 3');
    const type1TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_betline = 1');
    const type2TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_betline = 2');
    const type3TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_betline = 3');
    const activeContestsResult = await pool.query("SELECT COUNT(*) FROM contests WHERE status = 'active'");
    const winnersPickedResult = await pool.query("SELECT COUNT(*) FROM contests WHERE status = 'winner_picked'");
    const broadcastsResult = await pool.query('SELECT COUNT(*) FROM broadcasts');
    const pendingChangesResult = await pool.query("SELECT COUNT(*) FROM pending_changes WHERE status = 'pending'");

    res.json({
      totalUsers: parseInt(totalResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      verified: parseInt(verifiedResult.rows[0].count),
      banned: parseInt(bannedResult.rows[0].count),
      levelsByCasino: {
        topmatch: {
          level1: parseInt(type1TopResult.rows[0].count),
          level2: parseInt(type2TopResult.rows[0].count),
          level3: parseInt(type3TopResult.rows[0].count),
        },
        betline: {
          level1: parseInt(type1TonResult.rows[0].count),
          level2: parseInt(type2TonResult.rows[0].count),
          level3: parseInt(type3TonResult.rows[0].count),
        },
      },
      activeContests: parseInt(activeContestsResult.rows[0].count),
      winnersPicked: parseInt(winnersPickedResult.rows[0].count),
      broadcastsSent: parseInt(broadcastsResult.rows[0].count),
      pendingChanges: parseInt(pendingChangesResult.rows[0].count),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMIN SETTINGS ───

router.get('/admin/settings', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value, updated_at FROM admin_settings ORDER BY key");
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = { value: row.value, updated_at: row.updated_at };
    }
    res.json(settings);
  } catch (err) {
    console.error('Admin settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/settings', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || !key.startsWith('deposit_threshold_')) {
      return res.status(400).json({ error: 'Invalid settings key' });
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      return res.status(400).json({ error: 'Value must be a non-negative number' });
    }
    await pool.query(
      `INSERT INTO admin_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, String(numValue)]
    );
    res.json({ success: true, key, value: String(numValue) });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── STREAMS ───

router.get('/streams', verifyTelegramAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM streams WHERE status = 'scheduled' AND start_time > NOW() ORDER BY start_time ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get streams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/streams', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streams ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Admin get streams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/streams', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const { banner_image, link, start_time } = req.body;
    // Single-language: one text field, mirrored into both language columns.
    let text = req.body.text;
    if (!link || !start_time) {
      return res.status(400).json({ error: 'link and start_time are required' });
    }
    if (typeof link !== 'string' || link.length > 2000) {
      return res.status(400).json({ error: 'link must be a string with max 2000 characters' });
    }
    if (text && typeof text === 'string' && text.length > 1000) text = text.slice(0, 1000);
    const result = await pool.query(
      `INSERT INTO streams (banner_image, link, start_time, text_ru, text_uk)
       VALUES ($1, $2, $3, $4, $4) RETURNING *`,
      [banner_image || null, link, start_time, text || null]
    );
    const startDate = new Date(start_time);
    const timeStr = startDate.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
    notifyAllUsers(
      `📺 Новий стрім!${text ? `\n${text}` : ''}\n🕐 ${timeStr}\n🔗 ${link}`,
      `📺 Новый стрим!${text ? `\n${text}` : ''}\n🕐 ${timeStr}\n🔗 ${link}`
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create stream error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/streams/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { banner_image, link, start_time, status } = req.body;
    // Accept single `text`; fall back to legacy text_uk/text_ru if sent.
    const text = req.body.text !== undefined ? req.body.text : (req.body.text_uk ?? req.body.text_ru);
    const result = await pool.query(
      `UPDATE streams SET banner_image = COALESCE($1, banner_image), link = COALESCE($2, link), start_time = COALESCE($3, start_time), text_ru = COALESCE($4, text_ru), text_uk = COALESCE($4, text_uk), status = COALESCE($5, status)
       WHERE id = $6 RETURNING *`,
      [banner_image, link, start_time, text, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Stream not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update stream error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/streams/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM streams WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete stream error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── NOTIFICATIONS ───

router.get('/notifications', verifyTelegramAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [req.telegramUser.id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = userResult.rows[0];
    const clearedAt = user.notifications_cleared_at || new Date(0);

    const announcementsResult = await pool.query(
      `SELECT id, title_uk, title_ru, text_uk, text_ru, banner_image, created_at, 'announcement' as type
       FROM announcements
       WHERE created_at > $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [clearedAt]
    );

    const streamsResult = await pool.query(
      `SELECT id, text_uk, text_ru, banner_image, link, start_time, created_at, 'stream' as type
       FROM streams
       WHERE created_at > $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [clearedAt]
    );

    const all = [...announcementsResult.rows, ...streamsResult.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      unread_count: all.length,
      items: all,
    });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications/clear', verifyTelegramAuth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET notifications_cleared_at = NOW() WHERE telegram_id = $1',
      [req.telegramUser.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Clear notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ANNOUNCEMENTS ───

router.get('/announcements', verifyTelegramAuth, async (req, res) => {
  try {
    const announces = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC");
    const streams = await pool.query("SELECT * FROM streams ORDER BY start_time DESC");
    const combined = [
      ...announces.rows.map(a => ({ ...a, type: 'announce' })),
      ...streams.rows.map(s => ({ ...s, type: 'stream' })),
    ];
    combined.sort((a, b) => {
      const dateA = new Date(a.type === 'announce' ? a.created_at : a.start_time);
      const dateB = new Date(b.type === 'announce' ? b.created_at : b.start_time);
      return dateB - dateA;
    });
    res.json(combined);
  } catch (err) {
    console.error('Get announcements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/announcements', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Admin get announcements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/announcements', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    // Single-language: one title + one text, mirrored into both columns.
    const { title, text, banner_image } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (title.length > 500) return res.status(400).json({ error: 'title max 500 characters' });
    const result = await pool.query(
      `INSERT INTO announcements (title_uk, title_ru, text_uk, text_ru, banner_image)
       VALUES ($1, $1, $2, $2, $3) RETURNING *`,
      [title, text || null, banner_image || null]
    );
    notifyAllUsers(`📢 ${title}`, `📢 ${title}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/announcements/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { banner_image } = req.body;
    const title = req.body.title !== undefined ? req.body.title : (req.body.title_uk ?? req.body.title_ru);
    const text = req.body.text !== undefined ? req.body.text : (req.body.text_uk ?? req.body.text_ru);
    const result = await pool.query(
      `UPDATE announcements SET title_uk = COALESCE($1, title_uk), title_ru = COALESCE($1, title_ru), text_uk = COALESCE($2, text_uk), text_ru = COALESCE($2, text_ru), banner_image = COALESCE($3, banner_image)
       WHERE id = $4 RETURNING *`,
      [title, text, banner_image, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/admin/announcements/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
