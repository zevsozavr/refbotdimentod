const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('./db');
const { verifyTelegramAuth, verifyAdminAuth, isAdminId, generateSessionToken } = require('./middleware');
const { notifyWinner, notifyAdmin, notifyUser, notifyAdminChange, notifyAllUsers } = require('./bot');

const router = express.Router();

const uploadDir = path.join(__dirname, 'uploads/banners');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
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
const validateCasino = body('casino').isIn(['topmatch', 'tonplay']).withMessage('casino must be topmatch or tonplay');
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
        'INSERT INTO users (telegram_id, telegram_username, language, status, level_topmatch, level_tonplay) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
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
      level_tonplay: user.level_tonplay,
      casino_id_topmatch: user.casino_id_topmatch,
      casino_id_tonplay: user.casino_id_tonplay,
      wallet_topmatch: user.wallet_topmatch,
      wallet_tonplay: user.wallet_tonplay,
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
      level_tonplay: result.rows[0].level_tonplay,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_tonplay: result.rows[0].casino_id_tonplay,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_tonplay: result.rows[0].wallet_tonplay,
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
      level_tonplay: user.level_tonplay,
      casino_id_topmatch: user.casino_id_topmatch,
      casino_id_tonplay: user.casino_id_tonplay,
      wallet_topmatch: user.wallet_topmatch,
      wallet_tonplay: user.wallet_tonplay,
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

router.get('/casino/:casinoId/me', verifyTelegramAuth, async (req, res) => {
  try {
    const casinos = require('./casinos');
    const casino = casinos[req.params.casinoId];
    if (!casino) return res.status(404).json({ error: 'Casino not found' });
    const result = await pool.query('SELECT * FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    const level = user[casino.level_column];
    res.json({
      casino_id: casino.id,
      level,
      casino_account_id: user[casino.casino_id_column],
      referral_link: casino.referral_link,
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

    const userResult = await pool.query('SELECT id, telegram_username, status, ' + casino.casino_id_column + ' FROM users WHERE telegram_id = $1', [req.telegramUser.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    const oldValue = user[casino.casino_id_column];

    // Check if there's already a pending change for this field
    const existing = await pool.query(
      "SELECT id FROM pending_changes WHERE user_id = $1 AND field = $2 AND status = 'pending'",
      [user.id, casino.casino_id_column]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending change for this field' });
    }

    await pool.query(
      'INSERT INTO pending_changes (user_id, field, old_value, new_value) VALUES ($1, $2, $3, $4)',
      [user.id, casino.casino_id_column, oldValue, req.body.casino_account_id]
    );

    if (user.status === 'rejected') {
      await pool.query("UPDATE users SET status = 'pending' WHERE id = $1", [user.id]);
    }

    const casinoName = casino.id === 'topmatch' ? 'TopMatch' : 'TonPlay';
    await notifyAdminChange(user, casino.casino_id_column, req.body.casino_account_id, casinoName);

    res.json({ status: 'pending', field: casino.casino_id_column, new_value: req.body.casino_account_id });
  } catch (err) {
    console.error('Submit casino ID error:', err);
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

    const walletColumn = casino.id === 'topmatch' ? 'wallet_topmatch' : 'wallet_tonplay';

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

    const casinoName = casino.id === 'topmatch' ? 'TopMatch' : 'TonPlay';
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

    const walletColumn = casino === 'topmatch' ? 'wallet_topmatch' : 'wallet_tonplay';
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
    if (!casino || !['topmatch', 'tonplay'].includes(casino)) {
      return res.status(400).json({ error: 'casino query parameter required (topmatch or tonplay)' });
    }

    const levelColumn = casino === 'topmatch' ? 'level_topmatch' : 'level_tonplay';
    const userLevel = user[levelColumn];
    if (!userLevel) return res.json([]);

    const result = await pool.query(
      `SELECT c.*, cw.picked_at as winner_picked_at
       FROM contests c
       LEFT JOIN contest_winners cw ON cw.contest_id = c.id
       WHERE c.casino = $1 AND c.eligible_referral_type = $2
       AND c.status IN ('ended', 'winner_picked')
       ORDER BY c.end_date DESC`,
      [casino, userLevel]
    );

    const lang = user.language;
    const contests = await Promise.all(result.rows.map(async (c) => {
      let winnerInfo = null;
      if (c.status === 'winner_picked') {
        const winnerResult = await pool.query(
          `SELECT u.telegram_username FROM contest_winners cw
           JOIN users u ON u.id = cw.user_id
           WHERE cw.contest_id = $1`,
          [c.id]
        );
        if (winnerResult.rows.length > 0) {
          winnerInfo = { telegram_username: winnerResult.rows[0].telegram_username };
        }
      }
      return {
        id: c.id,
        title: lang === 'uk' ? c.title_uk : c.title_ru,
        description: lang === 'uk' ? c.description_uk : c.description_ru,
        prize: lang === 'uk' ? c.prize_uk : c.prize_ru,
        eligible_referral_type: c.eligible_referral_type,
        start_date: c.start_date,
        end_date: c.end_date,
        status: c.status,
        winner: winnerInfo,
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
    const { status, level_topmatch, level_tonplay, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status && ALLOWED_STATUSES.includes(status)) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (level_topmatch && ['1', '2', '3'].includes(level_topmatch)) {
      conditions.push(`level_topmatch = $${paramIndex++}`);
      params.push(parseInt(level_topmatch));
    }
    if (level_tonplay && ['1', '2', '3'].includes(level_tonplay)) {
      conditions.push(`level_tonplay = $${paramIndex++}`);
      params.push(parseInt(level_tonplay));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT id, telegram_id, telegram_username, language, status, level_topmatch, level_tonplay, casino_id_topmatch, casino_id_tonplay, wallet_topmatch, wallet_tonplay, created_at
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
      level_tonplay: result.rows[0].level_tonplay,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_tonplay: result.rows[0].casino_id_tonplay,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_tonplay: result.rows[0].wallet_tonplay,
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
      level_tonplay: u.level_tonplay,
      casino_id_topmatch: u.casino_id_topmatch,
      casino_id_tonplay: u.casino_id_tonplay,
      wallet_topmatch: u.wallet_topmatch,
      wallet_tonplay: u.wallet_tonplay,
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
      level_tonplay: result.rows[0].level_tonplay,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_tonplay: result.rows[0].casino_id_tonplay,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_tonplay: result.rows[0].wallet_tonplay,
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
      level_tonplay: result.rows[0].level_tonplay,
      casino_id_topmatch: result.rows[0].casino_id_topmatch,
      casino_id_tonplay: result.rows[0].casino_id_tonplay,
      wallet_topmatch: result.rows[0].wallet_topmatch,
      wallet_tonplay: result.rows[0].wallet_tonplay,
      created_at: result.rows[0].created_at,
    });
  } catch (err) {
    console.error('Unban user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/contests', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  sanitizeContestFields('title_uk'),
  sanitizeContestFields('title_ru'),
  sanitizeContestFields('description_uk'),
  sanitizeContestFields('description_ru'),
  sanitizeContestFields('prize_uk'),
  sanitizeContestFields('prize_ru'),
  validateReferralType,
  validateCasino,
  body('start_date').optional({ nullable: true }),
  body('end_date').optional({ nullable: true }),
  body('winner_count').optional({ nullable: true }).isInt({ min: 1, max: 100 }).withMessage('winner_count must be 1-100'),
  body('banner_image').optional({ nullable: true }).trim().isLength({ max: 500 }),
], handleValidationErrors, async (req, res) => {
  try {
    const { title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, winner_count, banner_image } = req.body;
    const start_date = req.body.start_date || new Date().toISOString();
    const endObj = new Date();
    endObj.setHours(23, 59, 59, 999);
    const end_date = req.body.end_date || endObj.toISOString();
    const result = await pool.query(
      `INSERT INTO contests (title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, eligible_referral_type, casino, start_date, end_date, winner_count, banner_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date, winner_count || 1, banner_image || null]
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
  sanitizeContestFields('title_uk'),
  sanitizeContestFields('title_ru'),
  sanitizeContestFields('description_uk'),
  sanitizeContestFields('description_ru'),
  sanitizeContestFields('prize_uk'),
  sanitizeContestFields('prize_ru'),
  validateReferralType,
  validateCasino,
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('winner_count').optional({ nullable: true }).isInt({ min: 1, max: 100 }).withMessage('winner_count must be 1-100'),
  body('banner_image').optional({ nullable: true }).trim().isLength({ max: 500 }),
], handleValidationErrors, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const { title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date, winner_count, banner_image } = req.body;

    const existing = await pool.query('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    if (existing.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Can only edit active contests' });
    }

    const result = await pool.query(
      `UPDATE contests SET title_uk=$1, title_ru=$2, description_uk=$3, description_ru=$4,
       prize_uk=$5, prize_ru=$6, eligible_referral_type=$7, casino=$8, start_date=$9, end_date=$10,
       winner_count=$11, banner_image=$12
       WHERE id=$13 RETURNING *`,
      [title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date, winner_count || 1, banner_image || null, contestId]
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

    if (new Date(contest.end_date) > new Date()) {
      return res.status(403).json({ error: 'Contest has not ended yet' });
    }

    const levelColumn = contest.casino === 'topmatch' ? 'level_topmatch' : 'level_tonplay';
    const walletColumn = contest.casino === 'topmatch' ? 'wallet_topmatch' : 'wallet_tonplay';
    const winnerCount = contest.winner_count || 1;

    const usersResult = await pool.query(
      `SELECT u.* FROM users u
       JOIN contest_participants cp ON cp.user_id = u.id
       WHERE cp.contest_id = $1
       AND u.status = 'verified'
       AND u.${levelColumn} = $2
       AND u.${walletColumn} IS NOT NULL
       ORDER BY RANDOM() LIMIT $3`,
      [contestId, contest.eligible_referral_type, winnerCount]
    );

    if (usersResult.rows.length === 0) {
      return res.status(404).json({ error: 'No eligible users found' });
    }

    const winners = usersResult.rows;

    for (const w of winners) {
      await pool.query(
        'INSERT INTO contest_winners (contest_id, user_id) VALUES ($1, $2)',
        [contestId, w.id]
      );
    }

    await pool.query(
      "UPDATE contests SET status = 'winner_picked' WHERE id = $1",
      [contestId]
    );

    for (const w of winners) {
      await notifyWinner(w, contest, w.language);
    }
    await notifyAdmin(winners, contest);

    res.json({
      winners: winners.map(w => ({
        telegram_id: w.telegram_id,
        telegram_username: w.telegram_username,
      })),
    });
  } catch (err) {
    console.error('Pick winner error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/broadcast', verifyTelegramAuth, verifyAdminAuth, adminLimiter, [
  sanitizeMessageFields('message_uk'),
  sanitizeMessageFields('message_ru'),
  body('target_referral_type').optional({ nullable: true }).custom((value) => {
    if (value === null || value === undefined || value === '') return true;
    const num = parseInt(value);
    return [1, 2, 3].includes(num);
  }).withMessage('target_referral_type must be 1, 2, 3, or null'),
], handleValidationErrors, async (req, res) => {
  try {
    const { message_uk, message_ru, target_referral_type } = req.body;
    let query = "SELECT * FROM users WHERE status = 'verified'";
    const params = [];

    if (target_referral_type !== null && target_referral_type !== undefined && target_referral_type !== '') {
      query += ' AND (level_topmatch = $1 OR level_tonplay = $1)';
      params.push(parseInt(target_referral_type));
    }

    const usersResult = await pool.query(query, params);
    let sentCount = 0;

    for (const user of usersResult.rows) {
      try {
        await notifyUser(user.telegram_id, message_uk, message_ru, user.language);
        sentCount++;
      } catch (e) {
        console.error(`Failed to send broadcast to ${user.telegram_id}:`, e);
      }
    }

    await pool.query(
      'INSERT INTO broadcasts (message_uk, message_ru, target_referral_type) VALUES ($1, $2, $3)',
      [message_uk, message_ru, target_referral_type || null]
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
    if (casino && ['topmatch', 'tonplay'].includes(casino)) {
      query += ' WHERE casino = $1';
      params.push(casino);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin contests error:', err);
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
      const levelColumn = change.field === 'casino_id_topmatch' ? 'level_topmatch' : 'level_tonplay';
      await pool.query(
        `UPDATE users SET ${levelColumn} = COALESCE(${levelColumn}, 1) WHERE id = $1 AND ${levelColumn} IS NULL`,
        [change.user_id]
      );
    }

    await pool.query(
      "UPDATE pending_changes SET status = 'approved', reviewed_at = NOW() WHERE id = $1",
      [changeId]
    );

    const casinoName = change.field.startsWith('casino_id_topmatch') || change.field.startsWith('wallet_topmatch') ? 'TopMatch' : 'TonPlay';
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

    const casinoName = change.field.startsWith('casino_id_topmatch') || change.field.startsWith('wallet_topmatch') ? 'TopMatch' : 'TonPlay';
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
    const type1TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_tonplay = 1');
    const type2TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_tonplay = 2');
    const type3TonResult = await pool.query('SELECT COUNT(*) FROM users WHERE level_tonplay = 3');
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
        tonplay: {
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
    const { banner_image, link, start_time, text_ru, text_uk } = req.body;
    if (!link || !start_time) {
      return res.status(400).json({ error: 'link and start_time are required' });
    }
    const result = await pool.query(
      `INSERT INTO streams (banner_image, link, start_time, text_ru, text_uk)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [banner_image || null, link, start_time, text_ru || null, text_uk || null]
    );
    const startDate = new Date(start_time);
    const timeStr = startDate.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
    notifyAllUsers(
      `📺 Новий стрім!${text_uk ? `\n${text_uk}` : ''}\n🕐 ${timeStr}\n🔗 ${link}`,
      `📺 Новый стрим!${text_ru ? `\n${text_ru}` : ''}\n🕐 ${timeStr}\n🔗 ${link}`
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
    const { banner_image, link, start_time, text_ru, text_uk, status } = req.body;
    const result = await pool.query(
      `UPDATE streams SET banner_image = COALESCE($1, banner_image), link = COALESCE($2, link), start_time = COALESCE($3, start_time), text_ru = COALESCE($4, text_ru), text_uk = COALESCE($5, text_uk), status = COALESCE($6, status)
       WHERE id = $7 RETURNING *`,
      [banner_image, link, start_time, text_ru, text_uk, status, id]
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
    const { title_uk, title_ru, text_uk, text_ru, banner_image } = req.body;
    if (!title_uk || !title_ru) {
      return res.status(400).json({ error: 'title_uk and title_ru are required' });
    }
    const result = await pool.query(
      `INSERT INTO announcements (title_uk, title_ru, text_uk, text_ru, banner_image)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title_uk, title_ru, text_uk || null, text_ru || null, banner_image || null]
    );
    notifyAllUsers(
      `📢 ${title_uk}`,
      `📢 ${title_ru}`
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/announcements/:id', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title_uk, title_ru, text_uk, text_ru, banner_image } = req.body;
    const result = await pool.query(
      `UPDATE announcements SET title_uk = COALESCE($1, title_uk), title_ru = COALESCE($2, title_ru), text_uk = COALESCE($3, text_uk), text_ru = COALESCE($4, text_ru), banner_image = COALESCE($5, banner_image)
       WHERE id = $6 RETURNING *`,
      [title_uk, title_ru, text_uk, text_ru, banner_image, id]
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
