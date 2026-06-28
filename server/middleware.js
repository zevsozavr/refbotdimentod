const crypto = require('crypto');

const getAdminIds = () => {
  const raw = process.env.ADMIN_TELEGRAM_IDS || '';
  if (raw) console.log('ADMIN_TELEGRAM_IDS raw:', raw);
  return raw.split(',').map(id => id.trim()).filter(Boolean);
};

const isAdminId = (telegramId) => {
  const ids = getAdminIds();
  const result = ids.includes(String(telegramId));
  console.log('isAdminId check: id=%s, adminIds=%j, result=%s', String(telegramId), ids, result);
  return result;
};

// Session token — HMAC-signed telegram_id, used when Telegram initData is unavailable
const getSessionSecret = () =>
  crypto.createHmac('sha256', process.env.BOT_TOKEN).update('session').digest();

const generateSessionToken = (telegramId) => {
  const hmac = crypto.createHmac('sha256', getSessionSecret()).update(String(telegramId)).digest('base64url');
  return `${telegramId}:${hmac}`;
};

const verifySessionToken = (token) => {
  try {
    const colonIdx = token.indexOf(':');
    if (colonIdx < 0) return null;
    const id = token.slice(0, colonIdx);
    const sig = token.slice(colonIdx + 1);
    const expected = crypto.createHmac('sha256', getSessionSecret()).update(id).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return parseInt(id, 10);
  } catch { return null; }
};

const verifyTelegramAuth = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];

  // Development bypass — requires explicit DEV_MODE=true (never auto-enable in staging/prod)
  if (process.env.DEV_MODE === 'true' || process.env.__DEV_MODE === 'true') {
    if (!process.env.DEV_TELEGRAM_ID) {
      return res.status(401).json({ error: 'DEV_MODE enabled but DEV_TELEGRAM_ID is not set' });
    }
    const devUser = { id: parseInt(process.env.DEV_TELEGRAM_ID, 10), first_name: 'Dev', username: 'devuser' };
    req.telegramUser = devUser;
    return next();
  }

  // Fall back to session token when initData is empty or missing
  if (!initData || initData.trim() === '') {
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken) {
      const telegramId = verifySessionToken(sessionToken);
      if (telegramId) {
        req.telegramUser = { id: telegramId, first_name: 'User', username: '' };
        return next();
      }
    }
    return res.status(401).json({ error: 'Missing authentication data' });
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return res.status(401).json({ error: 'Invalid authentication data' });
    }
    params.delete('hash');
    const sortedKeys = Array.from(params.keys()).sort();
    const dataCheckString = sortedKeys.map(key => `${key}=${params.get(key)}`).join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash.length !== hash.length) {
      return res.status(401).json({ error: 'Invalid authentication signature' });
    }
    if (!crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash))) {
      return res.status(401).json({ error: 'Invalid authentication signature' });
    }

    const authDate = parseInt(params.get('auth_date'), 10);
    if (isNaN(authDate) || Date.now() / 1000 - authDate > 86400) {
      return res.status(401).json({ error: 'Authentication expired' });
    }

    let user;
    try {
      const userStr = params.get('user');
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {
      return res.status(401).json({ error: 'Invalid user data' });
    }

    if (!user || !user.id) {
      return res.status(401).json({ error: 'User data not found' });
    }

    req.telegramUser = user;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const verifyAdminAuth = (req, res, next) => {
  if (!req.telegramUser || !isAdminId(req.telegramUser.id)) {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }
  next();
};

const verifyBotWebhook = (req, res, next) => {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (!secretToken || secretToken !== process.env.WEBHOOK_SECRET_PATH) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

module.exports = { verifyTelegramAuth, verifyAdminAuth, verifyBotWebhook, isAdminId, generateSessionToken };
