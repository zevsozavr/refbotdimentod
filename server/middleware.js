const crypto = require('crypto');

const getAdminIds = () => {
  return (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
};

const isAdminId = (telegramId) => {
  return getAdminIds().includes(String(telegramId));
};

const verifyTelegramAuth = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];

  // Development bypass — skip verification if NODE_ENV is not production
  if (process.env.NODE_ENV !== 'production') {
    const devUser = { id: parseInt(process.env.DEV_TELEGRAM_ID || '1'), first_name: 'Dev', username: 'devuser' };
    req.telegramUser = devUser;
    return next();
  }

  if (!initData || initData.trim() === '') {
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
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ error: 'Admin token required' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.ADMIN_TOKEN))) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

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

module.exports = { verifyTelegramAuth, verifyAdminAuth, verifyBotWebhook, isAdminId };
