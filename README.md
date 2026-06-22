# Casino Referral Bot — Telegram Mini App

Full-stack Telegram Mini App for casino referral tracking. Built with Node.js + Express, PostgreSQL, Telegraf, and React.

## Features

- Language selection (Ukrainian / Russian) on first open
- Casino ID submission and admin verification
- Referral type assignment (1 / 2 / 3) by admin
- Fixed referral link display for verified users
- Contest creation and management with bilingual fields
- Random winner selection for ended contests
- Telegram bot notifications for winners and admin
- Admin dashboard: user management, contest management, broadcast messaging, stats
- Dark / light theme toggle
- Full i18n (UK + RU) with zero hardcoded strings
- Security: Telegram HMAC-SHA256 initData verification, rate limiting, input validation, CORS lockdown, security headers

## Project Structure

```
/
├── server/                 # Node.js + Express backend
│   ├── index.js            # Server entry point, middleware setup
│   ├── bot.js              # Telegraf bot instance + notification helpers
│   ├── db.js               # PostgreSQL connection + migration
│   ├── middleware.js        # Auth middleware (Telegram + Admin)
│   ├── routes.js           # All API endpoints
│   ├── .env                # Environment variables (git-ignored)
│   └── .env.example        # Example environment file
├── client/                 # React Telegram Mini App
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js           # Root component with routing
│   │   ├── index.js         # React entry
│   │   ├── i18n.js          # i18next configuration
│   │   ├── axios.js         # Axios instance with initData interceptor
│   │   ├── styles.css       # Theme system (CSS variables) + component styles
│   │   ├── contexts/
│   │   │   └── AppContext.js # Global state (user, theme)
│   │   ├── components/
│   │   │   └── BottomNav.js  # Bottom navigation bar
│   │   ├── pages/
│   │   │   ├── LanguageSelect.js
│   │   │   ├── Pending.js
│   │   │   ├── Banned.js
│   │   │   ├── Rejected.js
│   │   │   ├── Home.js
│   │   │   ├── Contests.js
│   │   │   ├── Referral.js
│   │   │   ├── Settings.js
│   │   │   └── admin/
│   │   │       ├── AdminLogin.js
│   │   │       ├── AdminUsers.js
│   │   │       ├── AdminUserDetail.js
│   │   │       ├── AdminContests.js
│   │   │       ├── AdminBroadcast.js
│   │   │       └── AdminStats.js
│   │   └── locales/
│   │       ├── uk.json       # Ukrainian translations
│   │       └── ru.json       # Russian translations
│   └── package.json
├── scripts/
│   └── check-secrets.js     # Pre-build secret scan
└── README.md
```

## Environment Variables

All secrets live exclusively in `server/.env`. None are exposed to the frontend.

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `ADMIN_TOKEN` | Secure string for admin dashboard access |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram IDs of admins (e.g. `2060988783,822479618`) |
| `DATABASE_URL` | PostgreSQL connection string (low-privilege role) |
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `REFERRAL_LINK` | Fixed referral link shown to verified users |
| `WEBHOOK_URL` | Public HTTPS URL (production only, for webhook) |
| `WEBHOOK_SECRET_PATH` | 64-char hex string for webhook secret path |
| `MINI_APP_URL` | Telegram Mini App URL for bot inline keyboard |

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Telegram bot token from [@BotFather](https://t.me/botfather)

### Setup

```bash
# 1. Clone and install server dependencies
cd server
cp .env.example .env
# Edit .env with your values
npm install

# 2. Install client dependencies
cd ../client
npm install
```

### Run

```bash
# Terminal 1: Start the server
cd server
npm run dev

# Terminal 2: Start the React dev server
cd client
npm start
```

In development, the bot runs in polling mode (no webhook needed).

### Webhook Setup (Production)

```bash
# Set the webhook (run once)
curl -F "url=https://your-app.railway.app/webhook/YOUR_WEBHOOK_SECRET_PATH" \
     -F "secret_token=YOUR_WEBHOOK_SECRET_PATH" \
     https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

## Railway Deployment

1. Push to GitHub
2. Create a new Railway project from the repo
3. Set root directory to `server`
4. Add all environment variables from `.env.example` in Railway dashboard
5. Add a PostgreSQL plugin — Railway provides `DATABASE_URL` automatically
6. Ensure `NODE_ENV=production` and `WEBHOOK_URL` points to your Railway app URL
7. Deploy — migrations run automatically on startup
8. Register the webhook as described above

For the frontend, deploy `client/` separately (e.g., Vercel, Cloudflare Pages) or serve it via Railway as a static build.

## Security

- All authenticated requests verified via Telegram HMAC-SHA256 `initData` signature
- Admin routes require both valid initData and matching `ADMIN_TOKEN`
- All secrets compared using `crypto.timingSafeEqual`
- Rate limiting on all endpoints (global 100/min, auth 10/min, etc.)
- Input validation and sanitization on every endpoint
- Helmet security headers with strict CSP
- CORS locked to `https://web.telegram.org` only
- Parameterized SQL queries only — no string concatenation
- No secrets in client bundle — pre-build scanner enforces this
- Generic error responses in production — no stack traces exposed
- Bot webhook protected by `X-Telegram-Bot-Api-Secret-Token` header

## API Endpoints

### Auth
- `POST /api/auth/init` — Register or update user
- `POST /api/auth/language` — Update user language

### User
- `POST /api/user/submit-casino-id` — Submit casino ID for verification
- `GET /api/user/me` — Get current user
- `GET /api/user/referral-link` — Get referral link (verified only)

### Contests
- `GET /api/contests` — Active contests for user
- `GET /api/contests/history` — Contest history

### Admin (requires admin auth)
- `GET /api/admin/users` — Paginated user list
- `POST /api/admin/users/:id/verify` — Approve/reject user
- `POST /api/admin/users/:id/set-referral-type` — Set referral type
- `POST /api/admin/users/:id/ban` — Ban user
- `POST /api/admin/users/:id/unban` — Unban user
- `GET /api/admin/contests` — All contests
- `POST /api/admin/contests` — Create contest
- `PUT /api/admin/contests/:id` — Update contest
- `DELETE /api/admin/contests/:id` — Delete contest
- `POST /api/admin/contests/:id/pick-winner` — Pick random winner
- `POST /api/admin/broadcast` — Send broadcast
- `GET /api/admin/stats` — Aggregated statistics
