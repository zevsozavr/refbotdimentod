const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const { verifyTelegramAuth, verifyAdminAuth, isAdminId, generateSessionToken } = require('./middleware');
const { notifyWinner, notifyAdmin, notifyUser } = require('./bot');

const router = express.Router();

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
  max: 60,
  message: { error: 'Too many admin requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
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
        `UPDATE users SET telegram_username = $1, language = $2,
         status = CASE WHEN $3::boolean THEN 'verified' ELSE status END
         WHERE telegram_id = $4 RETURNING *`,
        [telegram_username || null, language, needsVerify, telegram_id]
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

    const result = await pool.query(
      `UPDATE users
       SET ${casino.casino_id_column} = $1,
           ${casino.level_column} = COALESCE(${casino.level_column}, 1)
       WHERE telegram_id = $2
       RETURNING *`,
      [req.body.casino_account_id, req.telegramUser.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const u = result.rows[0];
    res.json({
      casino_id: casino.id,
      casino_account_id: u[casino.casino_id_column],
      level: u[casino.level_column],
    });
  } catch (err) {
    console.error('Submit casino ID error:', err);
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
    const result = await pool.query(
      `SELECT * FROM contests WHERE casino = $1 AND eligible_referral_type = $2 AND status = 'active' AND end_date > NOW() ORDER BY end_date ASC`,
      [casino, userLevel]
    );
    const lang = user.language;
    res.json(result.rows.map(c => ({
      id: c.id,
      title: lang === 'uk' ? c.title_uk : c.title_ru,
      description: lang === 'uk' ? c.description_uk : c.description_ru,
      prize: lang === 'uk' ? c.prize_uk : c.prize_ru,
      eligible_level: c.eligible_referral_type,
      casino: c.casino,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
    })));
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

    const result = await pool.query(
      `SELECT c.*, cw.picked_at as winner_picked_at
       FROM contests c
       LEFT JOIN contest_winners cw ON cw.contest_id = c.id
       WHERE c.eligible_referral_type = $1
       AND c.status IN ('ended', 'winner_picked')
       ORDER BY c.end_date DESC`,
      [user.referral_type]
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
      `SELECT id, telegram_id, telegram_username, language, status, level_topmatch, level_tonplay, casino_id_topmatch, casino_id_tonplay, created_at
       FROM users ${whereClause}
       ORDER BY created_at DESC
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
  body('start_date').isISO8601().withMessage('start_date must be valid ISO 8601'),
  body('end_date').isISO8601().withMessage('end_date must be valid ISO 8601'),
], handleValidationErrors, async (req, res) => {
  try {
    const { title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date } = req.body;
    const result = await pool.query(
      `INSERT INTO contests (title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, eligible_referral_type, casino, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date]
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
], handleValidationErrors, async (req, res) => {
  try {
    const contestId = parseInt(req.params.id);
    const { title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date } = req.body;

    const existing = await pool.query('SELECT * FROM contests WHERE id = $1', [contestId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contest not found' });
    }
    if (existing.rows[0].status !== 'active') {
      return res.status(403).json({ error: 'Can only edit active contests' });
    }

    const result = await pool.query(
      `UPDATE contests SET title_uk=$1, title_ru=$2, description_uk=$3, description_ru=$4,
       prize_uk=$5, prize_ru=$6, eligible_referral_type=$7, casino=$8, start_date=$9, end_date=$10
       WHERE id=$11 RETURNING *`,
      [title_uk, title_ru, description_uk, description_ru, prize_uk, prize_ru, referral_type, casino, start_date, end_date, contestId]
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
    if (existing.rows[0].status === 'winner_picked') {
      return res.status(403).json({ error: 'Cannot delete contest with winner picked' });
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

    const usersResult = await pool.query(
      `SELECT * FROM users
       WHERE status = 'verified'
       AND referral_type = $1
       ORDER BY RANDOM() LIMIT 1`,
      [contest.eligible_referral_type]
    );

    if (usersResult.rows.length === 0) {
      return res.status(404).json({ error: 'No eligible users found' });
    }

    const winner = usersResult.rows[0];

    await pool.query(
      'INSERT INTO contest_winners (contest_id, user_id) VALUES ($1, $2)',
      [contestId, winner.id]
    );

    await pool.query(
      "UPDATE contests SET status = 'winner_picked' WHERE id = $1",
      [contestId]
    );

    await notifyWinner(winner, contest, winner.language);
    await notifyAdmin(winner, contest);

    res.json({
      telegram_id: winner.telegram_id,
      telegram_username: winner.telegram_username,
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
      query += ' AND referral_type = $1';
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

router.get('/admin/stats', verifyTelegramAuth, verifyAdminAuth, adminLimiter, async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM users');
    const pendingResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'pending'");
    const verifiedResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'verified'");
    const bannedResult = await pool.query("SELECT COUNT(*) FROM users WHERE status = 'banned'");
    const type1Result = await pool.query('SELECT COUNT(*) FROM users WHERE referral_type = 1');
    const type2Result = await pool.query('SELECT COUNT(*) FROM users WHERE referral_type = 2');
    const type3Result = await pool.query('SELECT COUNT(*) FROM users WHERE referral_type = 3');
    const activeContestsResult = await pool.query("SELECT COUNT(*) FROM contests WHERE status = 'active'");
    const winnersPickedResult = await pool.query("SELECT COUNT(*) FROM contests WHERE status = 'winner_picked'");
    const broadcastsResult = await pool.query('SELECT COUNT(*) FROM broadcasts');

    res.json({
      totalUsers: parseInt(totalResult.rows[0].count),
      pending: parseInt(pendingResult.rows[0].count),
      verified: parseInt(verifiedResult.rows[0].count),
      banned: parseInt(bannedResult.rows[0].count),
      usersByType: {
        type1: parseInt(type1Result.rows[0].count),
        type2: parseInt(type2Result.rows[0].count),
        type3: parseInt(type3Result.rows[0].count),
      },
      activeContests: parseInt(activeContestsResult.rows[0].count),
      winnersPicked: parseInt(winnersPickedResult.rows[0].count),
      broadcastsSent: parseInt(broadcastsResult.rows[0].count),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
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

module.exports = router;
